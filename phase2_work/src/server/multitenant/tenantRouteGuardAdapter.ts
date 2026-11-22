import {
  createTenantContextResolver,
  type ResolveTenantContextInput,
  type TenantContext,
  type TenantContextDependencies,
  type TenantContextResolution,
} from './tenantContext';
import {
  createTenantScopedRepository,
  type TenantRepositoryOperation,
  type TenantRepositoryResult,
  type TenantResourceAuthorizationPolicy,
  type TenantScopedStore,
} from './tenantRepository';

/**
 * Package 5: isolated, injectable route-guard adapter.
 *
 * This module is deliberately not imported or mounted by server.ts. Its
 * enablement is captured from server-owned configuration at construction;
 * request data can never enable it or supply authorization evidence.
 */

export interface TenantRouteGuardServerConfig {
  readonly enabled?: unknown;
}

export interface TenantRouteGuardRequest extends ResolveTenantContextInput {
  readonly operation: TenantRepositoryOperation;
  /** Tenant-relative document path, e.g. "chats/chat-a". */
  readonly resourcePath: unknown;
  /** Data to write. It is never passed to the authorization policy. */
  readonly value?: unknown;
  readonly patch?: unknown;
}

export type TenantRouteGuardFailureCode =
  | 'tenant_route_guard_disabled'
  | 'tenant_authentication_required'
  | 'tenant_authentication_failed'
  | 'tenant_context_denied'
  | 'tenant_resource_denied'
  | 'tenant_resource_authority_unavailable'
  | 'tenant_store_unavailable';

export type TenantRouteGuardResult<T = never> =
  | Readonly<{
      ok: true;
      status: 200;
      context: TenantContext;
      path: string;
      value?: T;
    }>
  | Readonly<{
      ok: false;
      status: 401 | 403 | 503;
      code: TenantRouteGuardFailureCode;
      reason?: string;
    }>;

export interface TenantRouteGuardDependencies {
  readonly tenantContext: TenantContextDependencies;
  readonly store: TenantScopedStore;
  /** Must read authoritative owner/participant metadata server-side. */
  readonly authorizationPolicy: TenantResourceAuthorizationPolicy;
}

function denied(
  status: 401 | 403 | 503,
  code: TenantRouteGuardFailureCode,
  reason?: string,
): TenantRouteGuardResult {
  return Object.freeze({ ok: false as const, status, code, ...(reason ? { reason } : {}) });
}

function contextFailure(
  resolution: Extract<TenantContextResolution, { ok: false }>,
): TenantRouteGuardResult {
  if (resolution.status === 401) {
    return denied(401, resolution.code === 'tenant_authentication_required'
      ? 'tenant_authentication_required'
      : 'tenant_authentication_failed', resolution.code);
  }
  return denied(403, 'tenant_context_denied', resolution.code);
}

/**
 * Creates a disabled-by-default adapter. Only config.enabled === true enables
 * the resolver/repository path. No request field or client claim participates
 * in this decision. The adapter itself does not mount any HTTP route.
 */
export function createTenantRouteGuardAdapter(
  serverConfig: TenantRouteGuardServerConfig | null | undefined,
  dependencies: TenantRouteGuardDependencies,
) {
  const enabled = serverConfig?.enabled === true;
  const resolveTenantContext = enabled
    ? createTenantContextResolver(dependencies.tenantContext)
    : null;
  const repository = enabled
    ? createTenantScopedRepository(dependencies.store, dependencies.authorizationPolicy)
    : null;

  return Object.freeze({
    readonlyEnabled: enabled,

    async execute<T = unknown>(
      request: TenantRouteGuardRequest,
    ): Promise<TenantRouteGuardResult<T>> {
      // This is intentionally the first operation. When disabled, do not
      // parse credentials, resolve context, evaluate policy, or touch a store.
      if (!enabled || !resolveTenantContext || !repository) {
        return denied(503, 'tenant_route_guard_disabled');
      }

      let resolution: TenantContextResolution;
      try {
        resolution = await resolveTenantContext({
          authorizationHeader: request.authorizationHeader,
          xTenantId: request.xTenantId,
          host: request.host,
        });
      } catch {
        return denied(403, 'tenant_context_denied', 'tenant_context_resolver_failed');
      }
      if (!resolution.ok) return contextFailure(resolution);

      // Only the exact frozen context issued by tenantContext.ts is passed to
      // tenantRepository.ts. Owner/participant evidence is never read from
      // request payload, query parameters, roles, or routing hints.
      let result: TenantRepositoryResult<T>;
      try {
        switch (request.operation) {
          case 'read':
            result = await repository.read<T>(resolution.context, request.resourcePath);
            break;
          case 'create':
            result = await repository.create(
              resolution.context,
              request.resourcePath,
              request.value,
            );
            break;
          case 'update':
            result = await repository.update(
              resolution.context,
              request.resourcePath,
              request.patch,
            );
            break;
          case 'delete':
            result = await repository.delete(resolution.context, request.resourcePath);
            break;
          default:
            return denied(403, 'tenant_resource_denied', 'unsupported_operation');
        }
      } catch {
        return denied(503, 'tenant_store_unavailable');
      }

      if (!result.ok) {
        if (result.code === 'resource_authority_unavailable'
          || result.code === 'authorization_policy_unavailable'
          || result.code === 'store_unavailable') {
          return denied(503, result.code === 'store_unavailable'
            ? 'tenant_store_unavailable'
            : 'tenant_resource_authority_unavailable', result.code);
        }
        return denied(403, 'tenant_resource_denied', result.code);
      }

      return Object.freeze({
        ok: true as const,
        status: 200 as const,
        context: resolution.context,
        path: result.path,
        ...('value' in result ? { value: result.value as T } : {}),
      });
    },
  });
}
