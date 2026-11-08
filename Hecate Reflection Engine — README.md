# Hecate Reflection Engine — README

*Version 1.0 · Specification for the module that turns a growing knowledge graph into a few meaningful, skippable, self-improving daily Reflections · Companion to the Hecate FRD (sections 3 and 5) and the Design System README (section 5)*

**Audience:** An AI coding agent implementing the engine. Every rule has a default value so no questions are needed. "Shall" is mandatory. Where this README and the FRD's AI Coach requirements (REQ-AI-3 to REQ-AI-7) differ, **this README wins**.

## 1. Purpose and Vocabulary

The **Reflection Engine** reads the user's notes (nodes), finds what is worth reflecting on, and produces a small set of **Reflections** each day. A Reflection is a short insight plus a concrete **mini-task** of 5 to 30 minutes. It improves the user's personal life and moves their own ideas forward. Some Reflections come from the user's data (an idea with no plan, an overdue task); some are **evergreen** and need no data (walk for 20 minutes).

| Term | Meaning |
| --- | --- |
| Reflection | One displayed suggestion: `{kind, title, rationale, steps, durationMin, sources}` |
| Candidate | A Reflection before ranking and wording |
| Signal | A computed fact about the graph (staleness, maturity, open loop, similarity) |
| Kind | The type of Reflection (section 6) |
| Slot | One of the visible positions in the Coach rail (default 4) |
| Reserve | Pre-ranked spare Reflections that instantly replace a skipped one |
| Maturity rung | Seed, Explored, Planned, Active, Done: how developed an item is |
| Evergreen | A Reflection from the curated library that needs no user data |

## 2. Design Principles

1. **Code finds, AI words.** Signals, candidates, ranking and selection are deterministic code. The language model only writes the title, rationale and steps for one candidate at a time. The engine **must work with AI turned off** using templates.
2. **Constant cost as data grows.** Work is incremental and cached. The model never sees more than one candidate plus its source note per call.
3. **Move things forward by one rung.** A Reflection is valuable when it advances an item one step up the maturity ladder with a small action.
4. **Grounded or honestly generic.** Every Reflection either cites source notes or is labeled generic. The model may not invent facts about the user.
5. **The user is the judge.** Skipping is instant, cheap, and teaches the engine. Nothing the user skips returns in the same form.
6. **Private by default.** Excluded nodes never become signals, candidates, embeddings or prompts.
7. **Explainable.** Every Reflection can show why it was chosen and what was sent.

## 3. Architecture

```
nodes (SQLite) ──▶ [1 Signal Extractors] ──▶ node_signal, topic, pair tables
                                   │
                                   ▼
                         [2 Candidate Generators] ──▶ candidates (typed, with source nodes)
                                   │
        preference_weight ──▶ [3 Scorer + Selector] ──▶ slots + reserve (ranked, diverse)
                                   │
                                   ▼
                          [4 Wording (LLM or template)] ──▶ Reflection records
                                   │
                                   ▼
                        Coach rail / Reflections page
                                   │ user actions
                                   ▼
                         [5 Feedback + Learning] ──▶ preference_weight, mutes, maturity bumps
```

**Package:** `packages/reflection` (pure TypeScript, no DOM). Depends on `packages/core` (nodes, tags, queries), `packages/storage` (SQL via the adapter) and `packages/ai` (providers). It runs in a Web Worker on web and in a worker thread (not the UI thread) in Tauri. Folder layout:

```
packages/reflection/src/
  signals/        maturity.ts staleness.ts loops.ts topics.ts connections.ts revisit.ts balance.ts context.ts
  candidates/     one file per kind (section 6)
  scoring/        score.ts select.ts bandit.ts
  wording/        prompts.ts templates.ts validate.ts
  evergreen/      library.json library.ts
  rollups/        build.ts
  feedback/       events.ts learn.ts mutes.ts
  engine.ts       public API (section 13)
  config.ts       defaults (section 14)
```

## 4. Data Model (new tables)

All IDs ULID text; times in Unix ms. Add migrations to `packages/storage/migrations`.

```sql
CREATE TABLE node_signal (
  node_id TEXT PRIMARY KEY,
  rung TEXT,                 -- seed|explored|planned|active|done|null (untracked)
  last_activity_at INTEGER,  -- max(updated_at) of node and its descendants
  last_opened_at INTEGER,    -- set by the UI when the node page is viewed
  child_count INTEGER, actionable_child_count INTEGER, done_child_count INTEGER,
  ref_count INTEGER, importance REAL,   -- 0..1
  category TEXT,             -- learning|health|relationships|finance|creativity|mindfulness|rest|home|work
  computed_at INTEGER, dirty INTEGER DEFAULT 0
);
CREATE TABLE node_embedding (
  node_id TEXT PRIMARY KEY, model TEXT, dim INTEGER, vec BLOB, text_hash TEXT, computed_at INTEGER
);
CREATE TABLE topic (
  id TEXT PRIMARY KEY, label TEXT, kind TEXT,       -- tag|keyword|cluster
  weekly_counts TEXT,        -- JSON of last 12 weekly counts
  trend REAL                 -- recent / baseline ratio
);
CREATE TABLE node_topic (node_id TEXT, topic_id TEXT, weight REAL, PRIMARY KEY (node_id, topic_id));
CREATE TABLE node_pair (   -- semantically close, unlinked
  a TEXT, b TEXT, similarity REAL, computed_at INTEGER, PRIMARY KEY (a, b)
);
CREATE TABLE rollup (
  id TEXT PRIMARY KEY, period TEXT,   -- day|week|month
  start_at INTEGER, end_at INTEGER, text TEXT, topics TEXT, node_count INTEGER,
  source TEXT,               -- extractive|llm
  input_hash TEXT, created_at INTEGER
);
CREATE TABLE reflection (
  id TEXT PRIMARY KEY, kind TEXT, status TEXT,  -- queued|shown|started|done|skipped|snoozed|expired
  slot INTEGER,                -- null while in reserve
  title TEXT, rationale TEXT, steps TEXT,       -- steps JSON array
  category TEXT, duration_min INTEGER,
  source_node_ids TEXT,        -- JSON array, empty for evergreen
  evergreen_id TEXT,
  score REAL, score_breakdown TEXT,             -- JSON
  wording TEXT,                -- template|llm
  run_id TEXT, created_at INTEGER, shown_at INTEGER, resolved_at INTEGER,
  snoozed_until INTEGER, skip_reason TEXT, saved_node_id TEXT
);
CREATE TABLE reflection_event (
  id TEXT PRIMARY KEY, reflection_id TEXT, type TEXT, -- shown|start|done|skip|snooze|undo|save|why|refresh
  reason TEXT, payload TEXT, at INTEGER
);
CREATE TABLE preference_weight (   -- Beta distribution per context key
  key TEXT PRIMARY KEY,            -- e.g. kind:seed_to_plan | kind_tag:seed_to_plan|#idea | category:health | topic:<id> | evergreen:<id>
  alpha REAL DEFAULT 2, beta REAL DEFAULT 2, updated_at INTEGER
);
CREATE TABLE mute (
  id TEXT PRIMARY KEY, scope TEXT,  -- node|topic|kind|evergreen
  target_id TEXT, until INTEGER,    -- null = until unmuted
  reason TEXT, created_at INTEGER
);
CREATE TABLE engine_run (
  id TEXT PRIMARY KEY, trigger TEXT, started_at INTEGER, finished_at INTEGER,
  candidates INTEGER, llm_calls INTEGER, tokens_in INTEGER, tokens_out INTEGER, error TEXT
);
```

`reflection` and `reflection_event` are never sent to any AI provider except as aggregates (section 9).

## 5. Signals (what the engine measures)

Signals are computed only for nodes that are **eligible**: not deleted, not tagged `#private`, not flagged "AI: exclude", and not inside an excluded subtree. Ineligible nodes get no row in any signal, embedding or topic table.

| ID | Signal | Definition |
| --- | --- | --- |
| S1 | Maturity rung | Computed only for nodes carrying a **tracked tag** (default `#idea`, `#goal`, `#project`, user-editable). **Seed:** no children, no filled fields, content ≤ 120 chars. **Explored:** has children but none are actionable (actionable = has a checkbox or the `#task` tag). **Planned:** ≥ 1 actionable child, none done. **Active:** ≥ 1 actionable child done, or Status field = Doing. **Done:** `done_at` set or Status = Done |
| S2 | Staleness | `days = (now − last_activity_at)`, where activity is the max `updated_at` over the node and its descendants |
| S3 | Open loops | Actionable nodes not done where `due < today` (overdue) or `Status = Inbox` for more than 7 days |
| S4 | Topic trend | Topics are tags, extracted keywords (TF-IDF on node text) and embedding clusters. `trend = count(last 7 days) / max(1, avg weekly count of previous 4 weeks)`. Rising if ≥ 1.5; fading if ≤ 0.5 with prior mass ≥ 3 |
| S5 | Connections | Among nodes edited in the last 30 days: cosine similarity ≥ 0.82, no reference in either direction, not ancestor/descendant. Keep the top 20 pairs |
| S6 | Unrevisited | Created more than 14 days ago, content ≥ 80 chars or has children, and `last_opened_at` is null or older than 21 days |
| S7 | Balance | For each category, `coverage = min(1, (captures + completed Reflections in last 14 days) / target)` with target 3. `gap = 1 − coverage`. Category comes from tag mapping first (`#book`→learning, `#habit`→health), then nearest embedding to category prototype sentences, else `work` |
| S8 | Context | Local hour, weekday, Reflections done today, median duration the user completes |
| S9 | Importance | `0..1` from: pinned (+0.3), log-scaled `ref_count` (up to +0.3), Priority field High (+0.2), created in last 7 days (+0.2) |

**Incremental computation:** a node write marks that node and its ancestors `dirty` (cheap trigger). A worker recomputes dirty rows after 60 s idle, in batches of 200. A full rebuild exists only as a maintenance command.

**Embeddings:** `EmbeddingProvider` interface with implementations in this order of preference: local Ollama embedding endpoint (user-configured model), `transformers.js` MiniLM in a worker, then none. With none, S5 and the embedding clusters of S4 are disabled and the engine falls back to tag and keyword overlap. Re-embed a node only when `text_hash` changes. Embed text = content + tag names + field values, truncated to 400 chars.

## 6. Reflection Kinds (candidate generators)

Each generator returns candidates `{kind, sourceNodeIds, facts, category, durationMin, baseScoreHints}`. The `facts` object is the only thing the wording step may use.

| Kind | Trigger | Task intent | Rung effect |
| --- | --- | --- | --- |
| `seed_to_plan` | Tracked node at **seed**, age ≥ 2 days | Brainstorm: goal in one sentence, 5 unknowns, smallest first step | Seed → Explored |
| `explore_to_plan` | Tracked node at **explored** | Turn questions into 3 concrete next actions | Explored → Planned |
| `plan_to_start` | Tracked node at **planned**, no activity ≥ 7 days | Do the first action for 10 minutes | Planned → Active |
| `unblock` | Tracked node not done, staleness ≥ 14 days | Decide: next step, park, or archive | Keeps or closes the item |
| `close_loop` | S3 open loops (group up to 3 per candidate) | Reschedule, do, or drop each | Clears overdue |
| `connect` | S5 pair | Link two notes and write one sentence on why | Adds a reference |
| `revisit` | S6 note | Recall it in 3 lines without looking, then check | Updates `last_opened_at` |
| `pattern` | S4 rising topic with ≥ 4 nodes | Write 3 lines: what is the question behind this theme? | Creates a synthesis note |
| `balance` | S7 category gap ≥ 0.67 | Small action in the neglected category, optionally tied to a recent note | Raises coverage |
| `journal` | Evening, or after ≥ 3 Reflections done | 3-line reflection prompt | Writes into today's note |
| `evergreen` | Library (section 7) | Generic task, no data needed | None |

**Worked example (hex-legged bot).** A node "Build a hex legged bot" tagged `#idea`, no children, created 3 days ago. S1 gives rung = seed. `seed_to_plan` fires with `facts = {title: "Build a hex legged bot", tags: ["#idea"], ageDays: 3}`. Resulting Reflection:

```json
{
  "kind": "seed_to_plan",
  "title": "Brainstorm a plan for the hex-legged bot (15 min)",
  "rationale": "Your idea 'Build a hex legged bot' has no plan yet.",
  "steps": ["Write the goal in one sentence", "List 5 unknowns (legs, servos, gait, power, controller)", "Name the smallest first prototype"],
  "durationMin": 15, "category": "creativity"
}
```

On **Done**, the engine offers "Save as notes" which creates child nodes under the idea from the user's answers; this lifts it to Explored and the next Reflection for it is `explore_to_plan`, not a repeat.

### 6.1 Template Fallbacks (used when AI is off, slow or invalid)

| Kind | Title template | Steps |
| --- | --- | --- |
| `seed_to_plan` | `Brainstorm a plan for {title} ({n} min)` | State the goal in one sentence · List 5 unknowns or questions · Pick the smallest first step |
| `explore_to_plan` | `Turn {title} into 3 next actions ({n} min)` | Re-read your notes · Write 3 actions starting with a verb · Tag one as the first |
| `plan_to_start` | `Start {title} with one action ({n} min)` | Open the plan · Do the first action for {n} minutes |
| `unblock` | `Decide what's next for {title} ({n} min)` | Is it still wanted? · Pick: next step, park, or archive |
| `close_loop` | `Clear {count} overdue items ({n} min)` | For each: do it, reschedule it, or drop it |
| `connect` | `Link '{a}' and '{b}' ({n} min)` | Read both · Add a reference · Write one sentence on how they relate |
| `revisit` | `Recall what you wrote about {title} ({n} min)` | Write 3 lines from memory · Compare with the note |
| `pattern` | `What is behind '{topic}'? ({n} min)` | List the related notes · Write the underlying question |
| `balance` | evergreen item from that category | — |
| `journal` | `Three lines before you wrap up (5 min)` | What went well? · What was hard? · One thing for tomorrow |

## 7. Evergreen Library

A bundled `library.json` of at least 60 items, user-extendable in Settings:

```json
{ "id": "walk-20", "title": "Take a 20-minute walk", "steps": ["Leave the screen behind", "Walk at an easy pace"], "category": "health", "durationMin": 20,
  "cooldownDays": 2, "timeOfDay": ["morning","afternoon","evening"], "energy": "medium", "needs": ["outdoors"] }
```

Categories: learning (read 10 min), health (walk, stretch, water), relationships (message someone), finance (review one expense), creativity (sketch 10 min), mindfulness (3 slow breaths × 5), rest (screens off for 15 min), home (tidy one surface).

Selection: filter by cooldown, time of day, mutes and `needs` the user has disabled; base score 0.35, multiplied by the category's S7 gap and the learned affinity. Evergreen items are **always available** so the engine never returns an empty list, including on first run.

## 8. Scoring and Selection

### 8.1 Score

Each component is normalized to 0..1.

`score = 0.30·maturityGap + 0.20·staleness + 0.20·affinity + 0.10·importance + 0.10·novelty + 0.10·timeFit − penalties`

- **maturityGap:** seed 1.0, explored 0.7, planned 0.4, others 0.2 (non-tracked kinds use their hint, `pattern` 0.6, `connect` 0.5, `revisit` 0.4, `balance` = S7 gap).
- **staleness:** `min(1, days/30)`, 0 when under 3 days.
- **affinity:** a **Thompson sample** from the Beta of the most specific key available (`kind_tag`, then `kind`) blended 50/50 with `category`.
- **importance:** S9.
- **novelty:** `1 − max cosine similarity` to titles shown in the last 14 days (token Jaccard if no embeddings); 0 if the same kind and source were shown in the last 7 days.
- **timeFit:** 1 if `durationMin ≤ availableMinutes` and the time of day matches, scaling down to 0.3 otherwise. Default available minutes: 30, reduced by `too_big` feedback (section 10).
- **penalties:** snoozed and not yet due: excluded; muted node, topic or kind: excluded; ineligible source: excluded.

Store the component values in `score_breakdown` for the "Why this?" view.

### 8.2 Slot policy

Default 4 visible slots plus 4 reserve. Choose with **greedy selection using maximal marginal relevance**: pick the highest score; for each next pick use `score − 0.4·maxSimilarityToPicked`. Constraints: at most 2 per kind, at most 1 per source node, at most 1 evergreen while at least 3 data candidates exist.

Target composition (each rule is skipped if no candidate exists): slots 1–2 best data Reflections (`seed_to_plan`, `explore_to_plan`, `connect`, `revisit`, `pattern`, `journal`); slot 3 best loop Reflection (`plan_to_start`, `unblock`, `close_loop`); slot 4 evergreen or `balance`. Remaining slots fill by score. If fewer than 4 candidates exist overall, fill with evergreen.

The highest-scoring item in the visible set becomes the featured "Do this now" card.

### 8.3 Cold start

With under 10 eligible nodes, show 1 data Reflection (if any) and fill the rest with evergreen. Priors are Beta(2,2) everywhere, so early behavior is explorative.

## 9. Wording (the only AI step)

### 9.1 Per-candidate call

One request per candidate, in parallel up to 2 at a time for local models. Input is a small JSON object:

```json
{
  "kind": "seed_to_plan",
  "facts": { "title": "Build a hex legged bot", "tags": ["#idea"], "ageDays": 3, "childTitles": [] },
  "durationMin": 15,
  "category": "creativity",
  "style": "warm, concrete, second person",
  "avoid": ["<titles of the last 5 skipped Reflections of this kind>"],
  "locale": "en"
}
```

Source note text sent is truncated to 400 characters; at most 5 child titles; no node IDs, emails or phone numbers.

**System prompt:**

> You write one Reflection for a personal knowledge app. Return JSON only. Use only the facts provided; never invent details about the user. `title` is an imperative sentence of at most 70 characters that includes the duration. `rationale` is one sentence that names the user's note when `facts` has one. `steps` has 2 to 4 short steps. Keep it safe, non-medical, and doable in the given duration. Do not repeat the style of anything in `avoid`.

**Response schema (Zod):**

```ts
const Wording = z.object({
  title: z.string().min(8).max(80),
  rationale: z.string().min(8).max(200),
  steps: z.array(z.string().min(3).max(120)).min(2).max(4),
  durationMin: z.number().int().min(5).max(30)
});
```

### 9.2 Reliability rules for small local models

- Thinking mode off; temperature 0.4; `max_tokens` 250; use the provider's JSON-schema or JSON mode when available.
- Validate. On failure, retry once with a repair message including the validation error. On a second failure, use the **template** (section 6.1) and set `wording = 'template'`.
- Reject wording whose title or steps contain strings not derivable from `facts` that look like invented entities (quoted names absent from facts) and use the template instead.
- **Latency rule:** the engine never waits on the model to display Reflections. It shows template wording immediately and swaps in LLM wording when ready if the user has not interacted with that card; the text change is a 120 ms crossfade.

### 9.3 Optional rollup summaries

The Reflections page and the "Hecate noticed" block use **rollups**: daily (extractive), weekly and monthly (LLM, max 120 words, plus up to 8 topics). Inputs are the previous tier's rollups plus the top 15 changed nodes by importance, never the whole graph. Without AI, the rollup is extractive: top topics by trend and counts of captured and completed items. Cache by `input_hash`; regenerate only when the hash changes.

### 9.4 Safety and cloud privacy

The system prompt forbids medical diagnosis, extreme exercise or fasting and risky advice. A deterministic filter rejects wording containing a blocked-term list (diet extremes, self-harm, medication dosing). If the user's recent notes contain distress language (keyword and embedding lexicon), the engine biases toward `rest`, `mindfulness` and `relationships` Reflections and may include one line suggesting talking to a trusted person or a professional. It never diagnoses.

When the provider is not local, show the consent screen (FRD REQ-AI-1). The "What was sent?" sheet lists every per-candidate payload from `engine_run`; preference data leaves the device only as aggregate numbers.

## 10. Feedback and Learning

### 10.1 Events

Every user action writes a `reflection_event` and updates state: `shown`, `start`, `done`, `skip`, `snooze`, `undo`, `save` (save as node), `why`.

### 10.2 Skip reasons

Skip is one tap on the card's Skip button; a popover offers optional reason chips (the skip is already applied if the user dismisses the popover):

| Reason | Effect |
| --- | --- |
| `not_relevant` | `beta += 1` on `kind_tag` and `kind`; mute **this source node** for 30 days (`mute scope=node`) |
| `not_interested` | Mute the **topic** (primary topic of the source) until unmuted; `beta += 0.5` on `kind` |
| `already_did` | Treat as done: `alpha += 0.3`; bump the source's rung one step; do not penalize the kind |
| `not_now` | Snooze 24 hours; no weight change; record time-of-day preference |
| `too_big` | `maxDuration` for that kind × 0.75 (floor 5); no affinity change |
| (no reason) | `beta += 0.5` on `kind_tag` and `kind`; mute this Reflection's exact source+kind pair for 14 days |

Other events: **done** → `alpha += 1` on `kind_tag`, `kind`, `category`; **snooze** → `beta += 0.1`; **start without done in 24 h** → no change. For evergreen items the keys are `evergreen:<id>` and `category`.

### 10.3 Learning rule

`preference_weight` stores Beta(α,β) per key. The affinity component is a Thompson sample, so the engine explores while uncertain and settles as evidence grows. **Decay:** daily, move α and β toward the prior with `x ← 2 + (x − 2)·0.98` (half-life about 34 days) so tastes can change. No weights are learned by the language model, and no skipped text is used to fine-tune anything; skipped titles only appear in the `avoid` list.

### 10.4 Transparency and control

The Reflections page has a **Learning** tab: muted topics and notes (each with Unmute), per-kind completion and skip rates, and "Reset learning". The Settings AI tab has toggles per kind (disable `connect` entirely, for example) and an evergreen library editor.

## 11. Skip and Replacement Flow

**State machine** for `reflection.status`: `queued → shown → started → done`, with exits `skipped`, `snoozed` (returns to `queued` at `snoozed_until`), `expired` (end of day, unresolved), and `undo` (skipped → shown).

**Skip behavior (instant, offline-capable):**

1. The card is marked `skipped`; the event is logged with the reason if given.
2. Learning updates are applied (10.2) and mutes created.
3. The engine **re-scores the reserve** with the new weights (a synchronous, millisecond operation, no model call) and promotes the best reserve item into the same slot. The replacement **must differ from the skipped item in both kind and source node when possible**, and in kind or source otherwise.
4. The new card appears in the same position with a 240 ms swap and carries template wording at once, with LLM wording arriving later (9.2).
5. A toast offers **Undo** for 5 seconds. Undo restores the skipped card and returns the replacement to the top of the reserve; learning updates from that skip are reversed.
6. If the reserve drops below 2, a background refill runs (section 12). If the reserve is empty, the replacement is an evergreen item.

**Three skips in a row** (within one day): the third replacement is evergreen, and the rail shows a small prompt "What would be useful?" with chips: *More movement*, *More creative*, *Fewer tasks today*, *Pause suggestions today*. Chips adjust category weights or the slot count for the day; "Pause" hides the rail's task list until tomorrow.

There is **no daily skip limit**; the refresh limit (5 per day) applies only to a full regenerate.

## 12. Scheduling and Triggers

| Trigger | Action |
| --- | --- |
| First app open of the day | Run the engine: recompute dirty signals, generate candidates, select slots and reserve, word the top 4 |
| Node edit | Mark `dirty`; recompute signals after 60 s idle |
| Reserve below 2 | Background refill of candidates and template wording, then LLM upgrade |
| Manual Refresh | Full regenerate; unresolved cards expire; limit 5/day; the skipped and done history is kept |
| New week (first open) | Build the weekly rollup; month change builds the monthly rollup |
| Daily user-set time | Optional notification: "Your Reflections are ready" (native notification plugin or Web Notifications) |
| Settings change (kinds, tags, mutes) | Re-score the queue immediately |

The engine never blocks the UI thread. Failure of any LLM or embedding call degrades to templates and keyword matching and never to an error screen.

## 13. Public API (`packages/reflection/src/engine.ts`)

```ts
export type ReflectionKind =
  | 'seed_to_plan' | 'explore_to_plan' | 'plan_to_start' | 'unblock' | 'close_loop'
  | 'connect' | 'revisit' | 'pattern' | 'balance' | 'journal' | 'evergreen';

export type SkipReason = 'not_relevant' | 'not_interested' | 'already_did' | 'not_now' | 'too_big';

export interface Reflection {
  id: string; kind: ReflectionKind; status: 'queued'|'shown'|'started'|'done'|'skipped'|'snoozed'|'expired';
  slot: number | null; title: string; rationale: string; steps: string[];
  category: string; durationMin: number; sourceNodeIds: string[];
  wording: 'template' | 'llm'; score: number;
}

export type UserAction =
  | { type: 'start' } | { type: 'done'; notes?: string }
  | { type: 'skip'; reason?: SkipReason }
  | { type: 'snooze'; until: number } | { type: 'undo' }
  | { type: 'save_as_node' };

export interface ReflectionEngine {
  getToday(): Promise<Reflection[]>;                         // visible slots, featured first
  refresh(opts?: { reason: 'open'|'manual'|'settings' }): Promise<Reflection[]>;
  act(id: string, action: UserAction): Promise<{ replacement?: Reflection; undoToken?: string }>;
  explain(id: string): Promise<{ breakdown: Record<string, number>; sources: string[]; sent?: unknown }>;
  getRollups(period: 'day'|'week'|'month'): Promise<Rollup[]>;
  getLearning(): Promise<{ mutes: Mute[]; stats: KindStats[] }>;
  unmute(muteId: string): Promise<void>;
  resetLearning(): Promise<void>;
  markNodeDirty(nodeId: string): void;                       // called by core on writes
  markNodeOpened(nodeId: string): void;                      // called by UI on page view
  on(event: 'changed' | 'wording-upgraded' | 'run-failed', cb: (p: unknown) => void): () => void;
}
```

**Action semantics:** `done` with `notes` and `save_as_node` create child nodes under the source node (or a node under today's Day for evergreen) tagged `#task` if the Reflection had a Due date, and register a reference back. `done` for a data Reflection runs the rung re-computation for its source.

## 14. Configuration Defaults (`config.ts`, editable in Settings)

| Key | Default |
| --- | --- |
| `slots` / `reserve` | 4 / 4 |
| `trackedTags` | `#idea`, `#goal`, `#project` |
| `seedMinAgeDays` | 2 |
| `stalledDays` | 14 |
| `unrevisitedDays` | 14 created, 21 not opened |
| `maxDurationMin` | 30 |
| `mmrLambda` | 0.4 |
| `decayPerDay` | 0.98 |
| `refreshPerDay` | 5 |
| `evergreenCooldownDays` | per item (default 2) |
| `skipMuteNodeDays` | 30 |
| `embeddingSimilarityThreshold` | 0.82 |
| `llmConcurrency` | 2 (local), 4 (cloud) |
| `aiEnabled` | false until consent |

## 15. UI Integration (see Design System README)

- **Coach rail:** slot 1 renders as "Do this now"; slots 2–4 as "Up next". Each card shows the rationale with a reference chip to the source note, or a "General" label for evergreen items.
- **Skip button:** visible on card hover and focus, with shortcut `S` when a card is focused. Click skips instantly and opens the reason popover (chips from 10.2) anchored to the card; the replacement is already in place. Toast with Undo for 5 s.
- **Overflow menu:** Snooze, Save as node, Why this? (opens the explain sheet with the score breakdown and sources), Never show for this note (a hard mute).
- **Reflections page:** history by day with status chips, rollup summaries, stats (done rate by kind, streak), and the Learning tab (10.4). With AI off, the rail shows template-worded Reflections, never an empty state.

## 16. Privacy, Performance and Quality Requirements

| ID | Requirement |
| --- | --- |
| RE-1 | Excluded or `#private` nodes never appear in signals, embeddings, prompts or the explain sheet |
| RE-2 | A full engine run on 20,000 nodes with no dirty rows completes in under 300 ms (SQL and cache only) |
| RE-3 | Skip-to-replacement latency under 50 ms (no model call) |
| RE-4 | Incremental recompute of 200 dirty nodes under 1 s excluding embeddings; embedding runs in the background |
| RE-5 | With AI off and no embeddings, the engine still produces 4 valid Reflections from templates and keyword signals |
| RE-6 | No network call to an AI provider unless AI is enabled and consent is recorded |
| RE-7 | All learning is local; "Reset learning" deletes `preference_weight`, `mute` and event aggregates |

## 17. Acceptance Tests

Use fixture workspaces and a mock `AiProvider` and `EmbeddingProvider`. Thompson sampling takes a seedable RNG so selection is reproducible in tests.

1. **Seed to plan:** an `#idea` "Build a hex legged bot" with no children, created 3 days ago, yields a `seed_to_plan` Reflection in the visible slots whose steps mention goal, unknowns and first prototype.
2. **No repeat after progress:** after marking that Reflection done with notes, the idea is Explored and the next run yields `explore_to_plan`, not `seed_to_plan`.
3. **Stalled item:** a `#project` with no activity for 20 days yields `unblock`; one inactive for 5 days does not.
4. **Evergreen without data:** an empty workspace yields 4 Reflections, all evergreen, with valid categories and durations.
5. **Mix:** a workspace with 3 seeds, 2 overdue tasks and no recent movement yields 2 data, 1 loop and 1 evergreen/balance Reflection.
6. **Skip replaces instantly:** skipping slot 2 returns a replacement within 50 ms, in the same slot, of a different kind and source.
7. **Skip learning:** after 3 skips of `connect` with `not_relevant`, the sampled affinity for `connect` drops below its prior mean in at least 90% of 1,000 seeded samples, and `connect` appears less often over the next 50 simulated days.
8. **Topic mute:** `not_interested` on a topic prevents any Reflection with that primary topic until unmuted from the Learning tab.
9. **Undo:** Undo within 5 seconds restores the skipped card, returns the replacement to the reserve, and reverses the weight changes.
10. **Three-skip rule:** three consecutive skips yield an evergreen replacement and the "What would be useful?" prompt.
11. **Latency independence:** with a mock model that takes 10 seconds, cards display template wording immediately and upgrade later.
12. **Invalid JSON:** a mock model returning malformed JSON twice results in `wording = 'template'` and no error shown.
13. **Privacy:** a node tagged `#private` is absent from all tables and from every captured prompt payload.
14. **Scale:** with 50,000 generated nodes, a run with 100 dirty nodes stays within the RE-2 and RE-4 limits and never sends more than 5 candidate payloads to the provider.
15. **Distress handling:** notes containing distress language bias results toward `rest`, `mindfulness` and `relationships` and contain no diagnosis wording.

## 18. Build Order

1. Tables and migrations; `config.ts`; evergreen library JSON.
2. Signal extractors S1, S2, S3, S9 with SQL and dirty-marking (no embeddings yet); unit tests with fixtures.
3. Candidate generators and templates for all kinds that need only S1–S3; scorer, MMR selector, slot policy; deterministic Thompson sampling.
4. `engine.getToday`, `act`, skip and replacement flow, mutes, undo; Coach rail wiring.
5. Feedback learning (Beta weights, decay) and the Learning tab.
6. Wording step with Ollama and cloud providers, Zod validation, repair, template fallback, latency swap.
7. Embeddings, S4, S5, S6, S7 and the `connect`, `revisit`, `pattern`, `balance` kinds.
8. Rollups (extractive, then LLM) and the Reflections page.
9. Scheduling, notifications, settings screens, "What was sent?" and explain sheet.
10. Performance pass against section 16 and the full acceptance suite.

Each step ends with passing tests. Do not add model-dependent behavior to steps 1 to 5; the engine must be fully useful before any model is connected.
