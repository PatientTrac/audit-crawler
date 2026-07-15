# CoSuite AM — UI

React/TypeScript UI consuming ratified memo JSON produced by the Colab
pipeline downstream of Ticket 9. This repo is a **consumer only**.

## Stack & conventions
- Vite + React + TypeScript, strict mode
- `git push` with no explicit remote/branch args
- Feature work on `feature/*` branches; nothing merges to main without
  passing the schema validation gate
- Deploys via Netlify from main

## Schema contract — memo JSON (READ FIRST)

The seam between Colab (producer) and this UI (consumer) is the ratified
memo JSON, defined by `schema/memo_input_SCHEMA.json` committed in this
repo. Rules:

1. **Consume only.** UI code reads fields defined in the ratified schema.
   Never reference a field absent from it, even if present in sample
   payloads — undocumented fields are not contract.
2. **No local schema edits.** Never modify `schema/memo_input_SCHEMA.json`
   here. Changes originate as schema-change requests to the Colab side,
   pass the normal ticket lifecycle, and land here only after ratification.
3. **No speculative consumption.** Never build against proposed/pending
   fields. Stub behind a TODO with the ticket number; wire only after the
   ratified version containing the field is committed.
4. **Schema needs ≠ schema direction.** Change requests state the data
   requirement (what must display, why), not the shape. Governance review
   owns the shape.
5. **Validate at the boundary.** All memo JSON entering the UI passes
   `src/schema/validate.ts`. Failures are surfaced errors, never coerced.
6. **All memo field access goes through `src/schema/memo.ts`.** No
   component touches raw payload properties directly.

## Ratified schema pinning
- `schema/memo_input_SCHEMA.json` — the ratified schema, committed
- `schema/RATIFIED.json` — `{ "version": "...", "sha256": "..." }`
- CI recomputes the schema file hash and fails on mismatch. A new ratified
  version = new schema file + updated RATIFIED.json in the same commit,
  referencing the ratification ticket in the commit message.

## Definition of done (UI tickets)
- Types regenerated from schema if schema version changed
- Boundary validation passes on all fixtures in `fixtures/`
- No direct payload access outside `src/schema/memo.ts`
- Lint + typecheck clean
