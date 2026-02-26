# Hybrid Search MVP Plan 

Goal: get a working `search -> view -> add` flow using lexical + semantic retrieval, without logs/tests hardening yet.

Default result size for MVP: 5.

## Status (Updated Feb 26, 2026)

- Done: 1) storage + indexes, 2) deterministic embedding formatter, 3) manual reindex command
- Next: 4) semantic retrieval function

## Scope for this first pass

- Keep it simple and sequential.
- No detailed logging/metrics yet.
- No broad test suite yet.
- Prioritize: working demo over perfect ranking.

## Implementation order

1. Add storage + indexes in Convex.
   - Add `componentEmbeddings` table keyed by `componentId` with `embedding` vector column.
   - Add vector index on `componentEmbeddings.embedding`.
   - Add/confirm text index for lexical retrieval on `componentSearch.searchText`.
   - Lock embedding model + dimension (`text-embedding-3-small`).
   - Files: `apps/backend/convex/schema.ts`, related validators/types.
   - Done when: schema deploy succeeds.

2. Build deterministic embedding text formatter.
   - Build one stable text blob per component from:
     - `name`, `intent`, `capabilities[]`, `synonyms[]`, `topics[]`
   - Defer short tags (`framework`, `styling`, `primitiveLibrary`, `motionLevel`) to a later pass.
   - Keep ordering and separators fixed so reruns are stable.
   - Done when: same component always produces the same embedding text.

3. Add manual reindex command (idempotent).
   - Read all components (+ search metadata).
   - Build embedding text and generate one vector per component.
   - Upsert by `componentId` into `componentEmbeddings`.
   - Done when: running reindex twice produces the same final DB state.

4. Add semantic retrieval function.
   - Embed query text.
   - Run vector search against `componentEmbeddings`.
   - Return compact candidate rows with `componentId` and rank.
   - Internal pool default: semantic `15`.
   - Done when: semantic retrieval returns plausible candidates for real queries.

5. Keep current lexical path, then add hybrid merge (Option 1).
   - Keep existing lexical retrieval/ranking path for now.
   - Add hybrid merge using Reciprocal Rank Fusion (RRF):
     - `rrfScore = (wLex / (k + lexicalRank)) + (wSem / (k + semanticRank))`
     - Defaults: `k=20`, `wLex=1.2`, `wSem=1.0`
   - Internal pool default: lexical `15`.
   - Final output default: top `5`.
   - Compute internal `reason`: `lexical`, `semantic`, `both`.
   - Done when: default `aui search` returns useful top-5 hybrid results.

6. Add safe fallback + debug visibility.
   - If query embedding fails, return lexical-only.
   - If vector search fails, return lexical-only.
   - Add debug flag output for `reason` and score breakdown only.
   - Done when: semantic failure still returns normal lexical results.

## Out of scope for this MVP

- Detailed timing logs (`embed_ms`, `vector_ms`, etc.)
- Advanced ranking diagnostics beyond the debug flag output
- Chunk-level embeddings
- Advanced weighting/tuning
- Comprehensive test coverage

## What to embed (MVP recommendation)

Use one combined text blob per component, built from existing search and metadata fields:

- `name`
- `intent`
- `capabilities[]`
- `synonyms[]`
- `topics[]`
- defer short tags for now (reserved for filters)

Avoid embedding full source code in this first pass.

## Key decisions

Finalized decisions:

- Embedding model: `text-embedding-3-small`.
- Embedding storage: separate `componentEmbeddings` table keyed by `componentId`.
- Embedding granularity: one embedding vector per component.
- Embedding source text: `name`, `intent`, `capabilities`, `synonyms`, `topics` (short tags deferred).
- User-facing behavior: semantic retrieval is automatic; users are not required to choose retrieval mode.
- Output limit: final default result size is `5`.
- Reindex strategy: manual reindex command for now.
- Hybrid merge algorithm: Reciprocal Rank Fusion (RRF).
- RRF defaults: `k=20`, `wLex=1.2`, `wSem=1.0`.
- Internal pool defaults: lexical `15`, semantic `15`.
- Reason field: computed internally, exposed with debug flag.
- Lexical rollout strategy: Option 1 for MVP (keep current lexical path first, add semantic + RRF).
- Fallback behavior: lexical-only fallback on embedding/vector failures (no dead-end).
- Non-goals for MVP: no logs/metrics hardening and no broad test suite yet.
