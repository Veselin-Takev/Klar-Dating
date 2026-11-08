import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import {
  GoogleGenAI,
  type GoogleGenAIOptions,
  type GenerateContentParameters,
} from '@google/genai';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
import { sanitizeAiPayload } from './platform/aiPiiSanitizer';
import { observeGeminiCall } from './observability';
import {
  buildSystemInstruction,
  guardProviderOutput,
  validateProviderSchema,
  wrapUntrustedInput,
} from './platform/aiPromptSecurity';

export const aiRequest = new AsyncLocalStorage<{
  uid: string;
  endpoint: string;
  guest: boolean;
  signal: AbortSignal;
}>();
export class AiBudgetError extends Error {
  readonly status = 429;
  constructor() {
    super('AI_BUDGET_EXHAUSTED');
  }
}
const positiveLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, 100_000_000)
    : fallback;
};
export async function reserveAiBudget(
  db: TenantAwareFirestoreRepository,
  uid: string,
  units: number,
  limits: { user: number; global: number },
  now = new Date(),
) {
  if (
    !uid ||
    !Number.isSafeInteger(units) ||
    units < 1 ||
    ![limits.user, limits.global].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new Error('Invalid reservation');
  const day = now.toISOString().slice(0, 10);
  const userRef = `users/${uid}/ai_budget/${day}`;
  // This cap is tenant-global. Platform/provider aggregate budgets remain an
  // independent deployment control, never a cross-tenant database read.
  const globalRef = `system/ai_budget_${day}`;
  const counter = z.object({
    reservedUnits: z.number().int().nonnegative().safe(),
  });
  const accountSchema = z.record(z.string(), z.unknown());
  return db.transaction(async (tx) => {
    const [user, global, account, deletion] = await Promise.all([
      tx.read(userRef, counter),
      tx.read(globalRef, counter),
      tx.read(`users/${uid}`, accountSchema),
      tx.read(`account_deletions/${uid}`, accountSchema),
    ]);
    if (!account || deletion)
      throw new Error('AI account no longer exists or is pending deletion');
    const userUsed = user?.reservedUnits ?? 0,
      globalUsed = global?.reservedUnits ?? 0;
    if (userUsed + units > limits.user || globalUsed + units > limits.global)
      throw new AiBudgetError();
    const expiresAt = Timestamp.fromMillis(now.getTime() + 30 * 86400_000);
    const writeSchema = counter.extend({ expiresAt: z.unknown() });
    tx.write(userRef, writeSchema, {
      reservedUnits: userUsed + units,
      expiresAt,
    });
    tx.write(globalRef, writeSchema, {
      reservedUnits: globalUsed + units,
      expiresAt,
    });
    return { remaining: limits.user - userUsed - units };
  });
}

export function boundedGeneration(
  parameters: GenerateContentParameters,
  endpoint: string,
  signal: AbortSignal,
): { parameters: GenerateContentParameters; units: number } {
  // Sanitize the exact provider-bound copy. Local/source data remains unchanged.
  // Inline media data is deliberately excluded from textual PII replacement.
  const sanitized = sanitizeAiPayload(parameters);
  const config = sanitized.config ?? {};
  if (
    !config.responseSchema ||
    config.responseMimeType !== 'application/json'
  ) {
    throw Object.assign(new Error('AI_SCHEMA_REQUIRED'), { status: 500 });
  }

  const rawContents = sanitized.contents;
  const contents = (
    typeof rawContents === 'string'
      ? [{ role: 'user', parts: [{ text: wrapUntrustedInput(rawContents) }] }]
      : Array.isArray(rawContents)
        ? rawContents.map((entry: unknown) => {
            if (typeof entry === 'string') return wrapUntrustedInput(entry);
            if (!entry || typeof entry !== 'object') return entry;
            const record = entry as Record<string, unknown>;
            if (!Array.isArray(record.parts)) return record;
            return {
              ...record,
              parts: record.parts.map((part: unknown) => {
                if (!part || typeof part !== 'object') return part;
                const partRecord = part as Record<string, unknown>;
                if (typeof partRecord.text === 'string')
                  return {
                    ...partRecord,
                    text: wrapUntrustedInput(partRecord.text),
                  };
                return partRecord;
              }),
            };
          })
        : sanitized.contents
  ) as GenerateContentParameters['contents'];

  const securedSystemInstruction = buildSystemInstruction(
    config.systemInstruction,
  );
  // Serialized request bytes conservatively bound the provider-bound input, including schema/system instructions.
  // Media is separately bounded here; arbitrary remote fetches are never added by this wrapper.
  const bytes = Buffer.byteLength(JSON.stringify(sanitized));
  if (bytes > 64 * 1024)
    throw Object.assign(new Error('AI_INPUT_TOO_LARGE'), { status: 413 });
  const cap = /icebreaker|opening|quick-insight/.test(endpoint)
    ? 256
    : endpoint === '/api/translate'
      ? 1024
      : 2048;
  const requested = parameters.config?.maxOutputTokens;
  const output =
    typeof requested === 'number' &&
    Number.isSafeInteger(requested) &&
    requested > 0
      ? Math.min(requested, cap)
      : cap;
  return {
    units: bytes + output + 1024,
    parameters: {
      ...sanitized,
      contents,
      config: {
        ...config,
        systemInstruction: securedSystemInstruction,
        maxOutputTokens: output,
        abortSignal: signal,
        // An HTTP timeout and cancellation apply at the SDK boundary, including handlers with legacy callbacks.
        httpOptions: {
          ...config.httpOptions,
          timeout: 15_000,
          retryOptions: { attempts: 1 },
        },
      },
    },
  };
}
export function createBudgetedAI(options: GoogleGenAIOptions) {
  const client = new GoogleGenAI(options);
  return {
    models: {
      generateContent: async (parameters: GenerateContentParameters) => {
        const context = aiRequest.getStore();
        if (!context)
          throw new Error('AI request requires authenticated budget context');
        if (context.signal.aborted) throw new Error('AI request aborted');
        const bounded = boundedGeneration(
          parameters,
          context.endpoint,
          context.signal,
        );
        // Reserve before EVERY provider attempt. No refunds on timeout: upstream billing is uncertain.
        await reserveAiBudget(
          getServiceRepository('auth'),
          context.uid,
          bounded.units,
          {
            user: positiveLimit(
              context.guest
                ? process.env.AI_GUEST_DAILY_UNITS
                : process.env.AI_USER_DAILY_UNITS,
              context.guest ? 20_000 : 200_000,
            ),
            global: positiveLimit(process.env.AI_GLOBAL_DAILY_UNITS, 2_000_000),
          },
        );
        const model =
          typeof bounded.parameters.model === 'string'
            ? bounded.parameters.model
            : process.env.GEMINI_MODEL || 'gemini-3.8-flash';
        return observeGeminiCall(
          context.endpoint,
          model,
          async () => {
            const result = await client.models.generateContent(
              bounded.parameters,
            );
            const rawText =
              typeof (result as { text?: unknown }).text === 'string'
                ? (result as { text: string }).text
                : '';
            const guardedText = guardProviderOutput(rawText);
            if (
              bounded.parameters.config?.responseMimeType === 'application/json'
            ) {
              try {
                const parsed = JSON.parse(
                  guardedText
                    .replace(/^```json\s*/i, '')
                    .replace(/\s*```$/i, '')
                    .trim(),
                ) as unknown;
                if (
                  !validateProviderSchema(
                    parsed,
                    bounded.parameters.config?.responseSchema,
                  )
                ) {
                  throw new Error('AI_OUTPUT_SCHEMA_INVALID');
                }
              } catch {
                throw new Error('AI_OUTPUT_SCHEMA_INVALID');
              }
            }
            return result;
          },
          (result) => {
            const usage = (
              result as {
                usageMetadata?: {
                  promptTokenCount?: number;
                  candidatesTokenCount?: number;
                  totalTokenCount?: number;
                };
              }
            ).usageMetadata;
            return {
              inputTokens: usage?.promptTokenCount,
              outputTokens: usage?.candidatesTokenCount,
              totalTokens: usage?.totalTokenCount,
            };
          },
        );
      },
    },
  };
}
