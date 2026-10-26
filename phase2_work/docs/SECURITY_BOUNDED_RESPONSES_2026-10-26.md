# Security checkpoint: bounded upstream response streams — 2026-10-26

Status: local implementation and 21 focused tests passed; exact-head full CI pending.
Production: **NO-GO**. This is the technical remediation for audit finding SEC-05.

## Runtime behavior

The active translation service (64 KiB), smart-audit image download (5 MiB) and both
Didit JSON readers (64 KiB) now use `src/server/boundedResponse.ts` before decoding,
JSON parsing, schema validation or base64 encoding. Existing host/redirect/MIME,
request timeout and schema checks remain in place.

The helper counts bytes delivered by the decoded fetch stream, including when
Content-Length is absent, malformed, understated or describes compressed content.
An announced oversize response is rejected early. On actual overflow or stream
failure the reader is canceled; cleanup errors cannot replace the original failure,
and the reader lock is released. No more body chunks are requested after overflow.

Retained payload storage uses one bounded byte buffer, allocated only after the
first accepted nonempty chunk, rather than an array of arbitrarily many chunks.
The helper cannot prevent an upstream/fetch implementation from allocating an
individual delivered chunk or its internal buffers. It bounds application-retained
payload bytes, not total process memory or concurrency. Existing caller deadlines
continue to bound response time; this change does not relax an API latency SLO.

Empty bodies retain existing downstream parsing/fallback behavior. Successful bytes,
UTF-8 text, schema checks and error/fallback contracts remain unchanged. Translation
and image failures still use their existing fallback/HTTP response paths.

## Validation

`tests/boundedResponse.spec.ts`: **21 local tests passed** using native Response and
ReadableStream, plus a local HTTP gzip server for actual decoded fetch consumption.
Coverage includes exact limits, binary preservation, bodyless/empty responses,
announced oversize without a read, false/missing/malformed lengths, early cancel,
invalid limits, many tiny chunks, stream/cleanup failures, split UTF-8, translation
fallback and all four production call sites. No external provider is contacted.

Didit and translation source gates now require the bounded streaming call instead
of the old whole-body buffering pattern. No check is disabled or converted into
an acceptance waiver. Full repository Node 22/Bun/emulator/browser CI is required
before merge; local focused verification used Node 24.22.1.

## Release and audit follow-up

PR #132 passed full CI 40351278302 and merged as
272fb7b6c1830949054ff048447c3e069c8d4688. Its targeted Firestore integration timeout
correction retained all assertions and passed the full suite. SEC-04 remains only
partly remediated: other logging paths and real collector access/retention need review.

SEC-01, remaining dependency findings and SEC-06/07 remain open. Real deployed rules,
independent Security/Privacy/Finance acceptance and isolated live staging/rollback
are not established by these tests. There is still no separate staging project.
Production remains **NO-GO** until the separate protected approval process is satisfied.
