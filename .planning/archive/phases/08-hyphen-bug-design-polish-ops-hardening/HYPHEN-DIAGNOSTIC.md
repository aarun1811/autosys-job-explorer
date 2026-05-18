# Hyphen-Search Bug — Diagnostic Evidence (Phase 8, BUG-01)

**Date:** 2026-05-17
**Bug surface:** `/api/v4/search/initial?keyword=<hyphenated-id>` returns zero hits.
**Root cause file:** `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java:35`
**Fix path (D-8.2):** Add `caseInsensitive(true)` on the `.keyword`-branch wildcard clauses. Additive only — no reindex.

---

## (a) `_analyze` + `_search` command output

All commands executed against `http://localhost:9200` (local-dev seed stack) on 2026-05-17.

### Step 1 — Standard analyzer tokenizes `RECON-XYZ-42`

```bash
curl -sS -XPOST 'http://localhost:9200/rectrace_core_index/_analyze' \
  -H 'Content-Type: application/json' \
  -d '{"analyzer":"standard","text":"RECON-XYZ-42"}'
```

Output:

```json
{"tokens":[
  {"token":"recon","start_offset":0,"end_offset":5,"type":"<ALPHANUM>","position":0},
  {"token":"xyz","start_offset":6,"end_offset":9,"type":"<ALPHANUM>","position":1},
  {"token":"42","start_offset":10,"end_offset":12,"type":"<NUM>","position":2}
]}
```

The standard analyzer splits on `-`, lowercases, and stores three atomic tokens. A wildcard query carrying `-` literally **cannot** match any of these — wildcards operate on indexed tokens, not the original text.

### Step 2 — `.keyword` subfield analyzer preserves the literal value

```bash
curl -sS -XPOST 'http://localhost:9200/rectrace_core_index/_analyze' \
  -H 'Content-Type: application/json' \
  -d '{"field":"recon_id.keyword","text":"RECON-XYZ-42"}'
```

Output:

```json
{"tokens":[
  {"token":"RECON-XYZ-42","start_offset":0,"end_offset":12,"type":"word","position":0}
]}
```

The `.keyword` subfield stores `RECON-XYZ-42` verbatim — **case-preserved**, hyphens intact. This is the correct surface for hyphenated literal matching.

### Step 3 — Current production query: lowercased wildcard against `.keyword` returns ZERO hits

```bash
curl -sS -XGET 'http://localhost:9200/rectrace_core_index/_search' \
  -H 'Content-Type: application/json' \
  -d '{"size":2,"query":{"wildcard":{"recon_id.keyword":"*rid-xyz-42*"}},"_source":["recon_id"]}'
```

Output:

```json
{"took":4,"timed_out":false,"_shards":{"total":1,"successful":1,"skipped":0,"failed":0},
 "hits":{"total":{"value":0,"relation":"eq"},"max_score":null,"hits":[]}}
```

Same pattern against `job_name.keyword` with `*recon-xyz-42*`:

```json
{"took":3,"timed_out":false,"_shards":{"total":1,"successful":1,"skipped":0,"failed":0},
 "hits":{"total":{"value":0,"relation":"eq"},"max_score":null,"hits":[]}}
```

This is exactly what `ElasticsearchServiceV4.getUniqueValues` produces today: `pattern = "*" + keyword.toLowerCase() + "*"` → `"*rid-xyz-42*"` → run against `recon_id.keyword` whose indexed term is `"RID-XYZ-42"` → **no match** because the wildcard query is case-sensitive by default and the case-preserved keyword cannot match the lowercased pattern.

### Step 4 — Fix path: `case_insensitive: true` recovers the hits

```bash
curl -sS -XGET 'http://localhost:9200/rectrace_core_index/_search' \
  -H 'Content-Type: application/json' \
  -d '{"size":2,"query":{"wildcard":{"recon_id.keyword":{"value":"*rid-xyz-42*","case_insensitive":true}}},"_source":["recon_id"]}'
```

Output:

```json
{"took":5,"timed_out":false,"_shards":{"total":1,"successful":1,"skipped":0,"failed":0},
 "hits":{"total":{"value":2,"relation":"eq"},"max_score":1.0,
  "hits":[
    {"_index":"rectrace_core_index","_id":"a363a5be6d87b6e4","_score":1.0,"_source":{"recon_id":"RID-XYZ-42"}},
    {"_index":"rectrace_core_index","_id":"RECON-XYZ-42","_score":1.0,"_source":{"recon_id":"RID-XYZ-42"}}
  ]}}
```

Same query against `job_name.keyword` with `*recon-xyz-42*` (case-insensitive):

```json
{"took":2,"timed_out":false,"_shards":{"total":1,"successful":1,"skipped":0,"failed":0},
 "hits":{"total":{"value":2,"relation":"eq"},"max_score":1.0,
  "hits":[
    {"_index":"rectrace_core_index","_id":"a363a5be6d87b6e4","_score":1.0,"_source":{"job_name":"RECON-XYZ-42"}},
    {"_index":"rectrace_core_index","_id":"RECON-XYZ-42","_score":1.0,"_source":{"job_name":"RECON-XYZ-42"}}
  ]}}
```

≥1 hit confirmed on both `recon_id` and `job_name` — the fix path is proven.

---

## (b) Root cause — `ElasticsearchServiceV4.java:35`

`ElasticsearchServiceV4.getUniqueValues` constructs

```java
final String pattern = "*" + keyword.toLowerCase() + "*";
```

then runs the same `WildcardQuery` builder over every configured search field:

```java
.map(field -> WildcardQuery.of(w -> w.field(field).value(pattern))._toQuery())
```

For categories like `reconId` whose `searchFields = ["recon_id", "recon_id.keyword"]`, the same lowercased pattern hits both branches:

- `recon_id` (text): the standard analyzer has already split the indexed value into `[rid, xyz, 42]` (or `[recon, xyz, 42]` for `job_name`); the wildcard literal `*rid-xyz-42*` cannot match any single token because Lucene wildcards run per-term, not across-tokens, and the indexed tokens never contain `-`. **Zero matches.**
- `recon_id.keyword` (keyword): the indexed term is the case-preserved literal `RID-XYZ-42`. Wildcard matching is case-sensitive by default, so the lowercased pattern `*rid-xyz-42*` cannot match the uppercase keyword. **Zero matches.**

Net effect: hyphenated identifiers return zero hits across all categories whose `searchFields` follow the `["<field>", "<field>.keyword"]` convention — which is every hyphen-sensitive category in `search-config-v4.json`.

## (c) Text-field aside — why the `text` branch cannot win

Even removing the `.toLowerCase()` would not rescue the text branch. The standard analyzer has destroyed the hyphens at index time: the tokens `[recon, xyz, 42]` have no `-` in them. A literal wildcard pattern carrying `-` between segments matches across tokens, which Lucene wildcards do not do. The only correct surface for "literal hyphenated lookup" is the `.keyword` subfield, which is exactly where `case_insensitive: true` belongs.

We intentionally do **not** rewrite the text branch (e.g., to a match-phrase or n-gram analyzer); the simpler, additive fix is to route the hyphenated-literal intent through `.keyword` with `case_insensitive`.

## (d) Chosen fix (D-8.2 — locked)

Split the wildcard-clause builder in `ElasticsearchServiceV4.getUniqueValues` into two branches:

```java
private Query buildWildcard(String field, String pattern) {
    if (field.endsWith(".keyword")) {
        // .keyword subfield: case-preserved indexed term.
        // Use case_insensitive so user input case does not matter,
        // and keep the existing lowercased pattern so the text-branch
        // wildcard remains analyzer-aligned.
        return WildcardQuery.of(w -> w.field(field).value(pattern).caseInsensitive(true))._toQuery();
    }
    return WildcardQuery.of(w -> w.field(field).value(pattern))._toQuery();
}
```

- **Additive only.** No reindex. No `search-config-v4.json` edit. No DTO change.
- The existing `keyword.toLowerCase()` is retained — the text-branch wildcard still needs an analyzer-aligned (lowercased) pattern in case it ever matches a single, non-hyphenated token.
- `caseInsensitive(true)` on a keyword field bound by `ignore_above: 8192` does not produce a runaway scan; ES executes through an automaton and the existing `maxResults` cap (typically 100–1000) is the bound. See `<threat_model>` T-08-02.

## (e) Mapping state — no production PUT required for local-dev

`../rectrace-local-dev/es/rectrace_core_index.mapping.json` already declares `.keyword` subfields on the hyphen-sensitive fields used by Phase 8 search categories. Verified live via `GET /rectrace_core_index/_mapping`:

| field                    | `text` | `.keyword` present |
|--------------------------|--------|--------------------|
| `recon_id`               | yes    | yes                |
| `job_name`               | yes    | yes                |
| `set_id`                 | yes    | yes                |
| `box_name`               | yes    | yes                |
| `recon`                  | yes    | yes                |
| `file_name_pattern`      | yes    | yes                |
| `load_file_name_pattern` | yes    | yes                |
| `sub_acc`                | yes    | yes                |
| `tlm_instance`           | yes    | yes                |
| `machine`                | yes    | yes                |
| `load_job`               | yes    | **missing**        |
| `load_file_name`         | yes    | **missing**        |
| `app_id`                 | yes    | **missing**        |

For Phase 8 BUG-01..03 scope, the categories driving the hyphen complaint (`reconId`, `jobName`, `setId`, `boxName`, `reconName`, `fileName`, `loadFileName`, `subAcc`, `tlmInstance`, `machineName`) all have `.keyword` subfields. The three fields missing `.keyword` (`load_job`, `load_file_name`, `app_id`) are not used as primary search fields for any category whose `searchFields` follow the `<field>` + `<field>.keyword` convention — they appear only as displayed columns, not as the hyphenated-search surface.

### Production runbook (BUG-03 follow-on, NOT executed by this plan)

When deploying to a Citi production stack whose `rectrace_core_index` mapping pre-dates the Phase 0.1 seed:

```bash
# One-shot, idempotent, no-data-rewrite per D-8.9 (additive mapping update).
curl -X PUT "$ES/rectrace_core_index/_mapping" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "recon_id":               {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "job_name":               {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "set_id":                 {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "box_name":               {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "recon":                  {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "file_name_pattern":      {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "load_file_name_pattern": {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "sub_acc":                {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "tlm_instance":           {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}},
      "machine":                {"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":8192}}}
    }
  }'
```

This is the deploy-phase action. The local-dev mapping is already correct; the code fix in `ElasticsearchServiceV4` is sufficient locally.

---

## Companion regression artifacts

- `backend/rectrace/src/test/java/com/citi/gru/rectrace/service/v4/HyphenSearchRegressionTest.java` — JUnit `@SpringBootTest` gated by `-Des.live=true`; asserts ≥1 hit for hyphenated inputs across `reconId`, `jobName`, `setId`, and proves case-insensitive matching on mixed-case input.
- `scripts/smoke-hyphen-search.sh` — live-stack assertion against `http://localhost:6088`; exits 0 only when all six checks pass (3 categories × 2 cases, plus negative control and health probe).

## Test-input alignment (Rule 1 fix, recorded for traceability)

The plan body in places refers to `RECON-XYZ-42` for the `reconId` category. Per the plan's own `<context>` section (line 109) and the live ES seed verified here, `recon_id` actually contains `RID-XYZ-42` / `RID-ABC-123`; the literal `RECON-XYZ-42` lives in `job_name`. The JUnit test and smoke script use the values that **actually exist in the seed**, mapped to the correct categories:

| category | keyword         | seed field | hit       |
|----------|-----------------|------------|-----------|
| reconId  | `RID-XYZ-42`    | `recon_id` | `RID-XYZ-42` |
| jobName  | `RECON-XYZ-42`  | `job_name` | `RECON-XYZ-42` |
| setId    | `SET-ABC-123`   | `set_id`   | `SET-ABC-123` |

This preserves the spirit of the plan (3 categories × hyphenated literals, mixed case proven on at least one) while ensuring the tests can actually pass against the seed declared in the plan's own context block.
