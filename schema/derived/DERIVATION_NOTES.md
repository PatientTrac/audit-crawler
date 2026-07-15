# Derivation Notes — memo_input.schema.json v1.0

Derived from ratified spec: `schema/memo_input_SCHEMA.json` (TICKET-9, sha256 `ed7c1cc7...`).
Translator: Claude Code, 2026-07-14. Every judgment call below requires Operator disposition
before UI-3 starts. Ambiguities are clarification requests, not decisions.

---

## 1. Root-level `_comment` / `_instructions` keys

**Judgment:** Marked `additionalProperties: false` at root but allowed `_comment` and
`_instructions` as optional string properties, because the ratified spec itself contains them
and a real producer payload is likely to include them.

**Clarification request:** Should the validator reject payloads that include `_comment` /
`_instructions` at any level, or tolerate them as producer-side annotations? Currently
tolerated only at root and `exec_issues` item level (where spec shows them). Nested levels
do not allow them under `additionalProperties: false`.

---

## 2. `tally` integer lower bound

**Judgment:** Applied `"minimum": 0` to all four tally integers (`fail`, `flag`, `pass`, `na`).
The spec says "integer" with no bound stated.

**Clarification request:** Can any tally count be negative? If a producer could emit `-1` as a
sentinel, the minimum-0 constraint will reject it.

---

## 3. `sections` array — required section IDs

**Judgment:** The spec says `id: "string — A through F"` but does not say the array must
contain exactly one of each. Derived schema applies `pattern: "^[A-F]$"` per item but does
not enforce that all six are present, or that there are no duplicates.

**Clarification request:**
- Must every payload contain exactly sections A, B, C, D, E, F?
- Are duplicate section IDs an error?
- Is the order of sections enforced?

If yes to any: the derived schema needs `minItems: 6`, `maxItems: 6`, and a cross-field
uniqueness check (not expressible in JSON Schema draft-07 alone — would move into `validate.ts`
like `custody_predicate`).

---

## 4. `overall_verdict` enum casing

**Judgment:** Spec says `mixed | pass | flag | fail | na` (lowercase). Enum enforced lowercase.
The `verdict` field in `checks` items uses uppercase (`PASS | FLAG | FAIL | N/A`). These are
intentionally different — checks use uppercase, section overall_verdict uses lowercase.

**Clarification request:** Is the casing intentional and stable? If a producer accidentally
sends `"MIXED"` for `overall_verdict`, the validator will reject it. Confirm this is desired.

---

## 5. `custody_predicate` — "at most one per report"

**Judgment:** This constraint ("at most one `custody_predicate: true` across all `exec_issues`")
is cross-field and cannot be expressed in JSON Schema. Implemented as a named check
`assertCustodyPredicateAtMostOne` in `src/schema/validate.ts`, called from `validateMemo`
after Ajv validation passes. Failure throws `MemoValidationError` with a distinct message.

**Clarification request:** None — the spec is explicit. Recording here for audit trail.

---

## 6. `source_links[].url` nullability

**Judgment:** Spec says `"url": "string or null"` for sources items. Applied `["string", "null"]`
to both `source_links[].url` and `sources.groups[].items[].url`. No URI format check applied.

**Clarification request:** Should `url` fields be validated as URIs (format: "uri")? This would
reject relative paths, bare domain names, and malformed URLs. Currently any string is accepted.

---

## 7. `triage_label` nullability

**Judgment:** Spec says `triage_label: "string — ... | null"`, so typed as `["string", "null"]`.
`triage_is_reg: boolean` is always required even when `triage_label` is null.

**Clarification request:** When `triage_label` is null, should `triage_is_reg` always be `false`,
or is `triage_is_reg: true` with a null label a valid state? Currently not constrained.

---

## 8. `exec_issues` minimum length

**Judgment:** Spec says "one object per flagged/failed issue" but does not require at least one.
Derived schema allows an empty array (`exec_issues: []`).

**Clarification request:** Can a report have zero exec issues (i.e., all checks passed)? If not,
add `"minItems": 1`.

---

## 9. `findings` minimum length

**Judgment:** Same as above — `findings: []` is allowed per derived schema.

**Clarification request:** Can a section have zero findings? Consistent with exec_issues question
above.

---

## 10. `checks` minimum length and code format

**Judgment:** `checks: []` allowed. `code` is typed as string with no pattern beyond what the
spec states ("e.g. A1"). No regex enforced (e.g. `^[A-F]\d+$`).

**Clarification request:** Should check codes be validated against a fixed pattern? If section A
always contains codes A1–AN, a pattern constraint would catch producer errors early.

---

## 11. `meta.platform` always string, never null

**Judgment:** The ratified spec shows `"platform": "Perhaps*"` (a string value, not a type
description). Typed as `string`, not nullable. This differs from other meta fields which show
type descriptions in quotes.

**Clarification request:** Is `platform` always the literal product name (e.g. `"Perhaps*"`)
or a free string? Can it be null? This is the only meta field whose spec value looks like real
data rather than a type hint, which may mean it is hardcoded for all reports.

---

*End of derivation notes. Send to Operator before UI-3.*
