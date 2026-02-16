Here you go. Clean, copy-paste ready.

---

# UI Retrieval Substrate - High-Level Project Checklist

## Phase 1 - Define Scope Constraints

**Goal:** Ruthlessly narrow scope.

- [x] React only
- [x] TypeScript only
- [x] Tailwind only
- [x] 2–3 source libraries max
- [x] Component-level only (no full pages, no themes, no tokens)
- [x] CLI-first (no web UI initially)

If this isn’t painfully narrow, it’s too big.

---

## Phase 2 - Define the Data Model

- [x] Finalize component metadata schema (partial)
- [x] Decide storage format for MVP (CSV recommended)
- [x] Write script to convert CSV → structured JSON
- [x] Validate schema consistency

---

## Phase 3 - Curate Initial Dataset (50-100 Components)

- [x] Select 2–3 source libraries
- [x] Extract high-quality components
- [x] Clean and normalize code
- [x] Annotate metadata manually
- [x] Standardize naming conventions

---

## Phase 4 - Build Retrieval Engine (Simple Version)

MVP = deterministic filtering.

- [x] Load JSON dataset into memory
- [x] Implement keyword search
- [ ] Implement filter by dependency
- [x] Implement filter by framework
- [x] Implement filter by motion
- [ ] Rank by tag match count
- [x] Return structured results (metadata + code path)

No vectors. No embeddings. Not yet.

---

## Phase 5 - Build CLI Interface + Config Contract

Agent-friendly, stateless, and cloud-first.

- [ ] Add a user-facing config file as the primary interface
- [ ] Keep config abstracted from internals (no `dataPath`, no internal `topics`, no ranking weights)
- [ ] Keep CLI flags as per-run overrides, not the main API
- [ ] Add `init` command to generate a starter config
- [ ] Add `config:check` command to validate and print effective config
- [ ] Keep `search` and `get` commands stable for users and agent tool-calling
- [x] Ensure stable machine-readable output

Approximate config shape/schema (intentionally high-level):

```json
{
  "version": 1,
  "profile": "balanced",
  "defaults": {
    "limit": 8,
    "motion": "any",
    "strictness": "normal"
  },
  "response": {
    "format": "text",
    "includeCode": false
  },
  "agent": {
    "mode": "safe",
    "explain": false
  },
  "cloud": {
    "workspace": "default",
    "project": "auto"
  }
}
```

Design for LLM tool use.

---

## Phase 6 - Test With Real Agents

- [ ] Integrate with Codex / Claude / tool-calling
- [ ] Observe retrieval accuracy
- [ ] Observe hallucination patterns
- [ ] Refine metadata schema based on failures
- [ ] Adjust ranking logic
- [x] Maintain an eval harness and evolving case set
- [ ] Track trendlines/regressions over time
- [ ] Lock concrete benchmark thresholds later, after enough real usage data

Don’t guess. Test.

---

## Phase 7 - Evaluate Expansion Path

Only after CLI works reliably.

**Option A: Hosted Registry**

- [ ] Build server endpoint
- [ ] CLI fetches from remote
- [ ] Add authentication (e.g., WorkOS)

**Option B: Vector Search**

- [ ] Add embeddings
- [ ] Evaluate pgvector / Convex vector
- [ ] Compare retrieval quality

**Option C: Web Gallery**

- [ ] Visual previews
- [ ] Human browsing interface

Do not choose prematurely.

---

## Phase 8 - Packaging & Positioning

- [ ] Clean repository structure
- [ ] Write focused README
- [ ] Add usage examples
- [ ] Provide demo workflow (agent retrieves → customizes)
- [ ] Clarify positioning statement

Positioning example:
**“Structured UI Component Retrieval for AI Coding Agents.”**

---

## Core Focus

If everything feels overwhelming, reduce to:

1. Tight schema
2. High-quality curated dataset
3. Deterministic retrieval
4. Agent compatibility

Everything else is secondary.
