# Hecate — Functional Requirements Document

*Version 1.0 · A Tana-style graph outliner PKM with Supertags and an AI "Mini-Task" coach · Web app + Tauri v2 native builds*

**Audience:** An AI coding agent (or human team) that will build Hecate end to end. Every requirement has an ID. Where a choice was needed, this document makes it, so the builder should not need to ask questions. "Shall" means mandatory (MVP unless marked *Phase 2*).

## 1. Product Overview

### 1.1 Vision

Hecate is a local-first personal knowledge management tool. All information is a **Node** in a graph. Nodes nest infinitely like an outliner, can be referenced from anywhere, and can be turned into typed database objects by applying **Supertags**. Hecate also reads a short AI-generated summary of what the user has been capturing and proposes tiny, concrete **Mini-Tasks** (e.g. "Read a book for 10 minutes", "Jog for 20 minutes") that improve personal life.

### 1.2 Goals

- Faithful reproduction of the original Tana outliner model: nodes, references, supertags, fields, live searches, multiple views, command line, Tana Paste.
- Runs as a web app (PWA) and as native desktop/mobile apps through Tauri v2 from one codebase.
- Local-first: works fully offline; data lives on the user's device.
- AI features are optional, privacy-conscious, and provider-agnostic.

### 1.3 Non-Goals (v1)

Real-time multi-user collaboration, public publishing, voice transcription, Tana's later AI-agent features, and a plugin marketplace.

### 1.4 Primary Persona

A solo knowledge worker who captures notes, tasks, books, people, and meetings daily and wants structure without folders.

## 2. Technology Stack (Fixed Decisions)

| Concern | Decision |
| --- | --- |
| Language | TypeScript (strict) for frontend; Rust only for Tauri shell/commands |
| Frontend | React 18 + Vite, Tailwind CSS, Radix UI primitives, Zustand for UI state |
| Inline editor | One TipTap (ProseMirror) instance per **focused** node; unfocused nodes render as static HTML for performance |
| Storage | SQLite as the single source of truth. Web: `@sqlite.org/sqlite-wasm` with OPFS in a Web Worker. Tauri: `tauri-plugin-sql` (native SQLite). Both sit behind one `StorageAdapter` interface |
| Query layer | Kysely (typed SQL builder) over the adapter |
| Full-text search | SQLite FTS5 virtual table over node text |
| Native | Tauri v2 (desktop: macOS, Windows, Linux; mobile: iOS, Android via Tauri v2 mobile targets) |
| AI | Provider abstraction. Default provider: Anthropic Messages API. Also support OpenAI-compatible endpoints and local Ollama |
| Secrets | Tauri: OS keychain through a Rust command. Web: encrypted in IndexedDB with a user passphrase |
| Tests | Vitest (unit), Playwright (e2e web), `tauri-driver`/WebDriver smoke tests (native) |
| Package layout | pnpm monorepo: `apps/web`, `apps/desktop` (Tauri), `packages/core` (domain logic, no DOM), `packages/storage`, `packages/ai`, `packages/ui` |

**Architecture rule:** `packages/core` holds all domain logic (nodes, tags, fields, queries, paste parsing) and must run in Node, browser, and worker with no platform imports. Platform differences are only in `StorageAdapter`, `SecretsAdapter`, `FileAdapter`, and `NotificationAdapter`.

## 3. Data Model

All IDs are ULIDs (text). All timestamps are Unix milliseconds (integer). Soft delete uses `deleted_at`.

### 3.1 Tables

**node**

| Column | Type | Notes |
| --- | --- | --- |
| id | text PK |  |
| parent\_id | text null | null = workspace root or Library item |
| position | text | Fractional index string for ordering among siblings |
| kind | text | `content` \| `field` \| `fieldValue` \| `tagDef` \| `fieldDef` \| `search` \| `day` \| `workspace` |
| content | text | Plain text with inline markup tokens (see 3.2) |
| collapsed | integer | 0/1 |
| done\_at | integer null | Completion state (checkbox) |
| created\_at, updated\_at, deleted\_at | integer | System fields |
| meta | text (JSON) | Kind-specific payload (e.g. search query, tagDef config) |

**node\_tag** — `(node_id, tag_def_id)` composite PK. Multi-tagging.

**ref** — `(source_node_id, target_node_id, kind)` where kind is `inline` | `field`. Maintained automatically from content tokens and field values. Indexed both directions to power backlinks.

**tag\_def** — stored as a `node` of kind `tagDef`; `meta` JSON: `{ color, extends: [tagDefId], icon?, fieldDefs: [{fieldDefId, pinned, default?, required?}], defaultContent: [templateNode], showCheckbox: boolean, buildTitle?: string }`.

**field\_def** — node of kind `fieldDef`; `meta`: `{ type, options?, targetTag?, min?, max?, multi?, autoInit?: 'none'|'today'|'currentUser'|'default' }`.

**field instance** — a child node of kind `field` whose `meta.fieldDefId` points to its definition, and whose children are `fieldValue` nodes (or a reference for Node Reference type).

**command** — `(id, name, description, steps JSON, scope)`; user-defined node commands.

**mini\_task** — `(id, title, rationale, category, duration_min, status, source_summary_id, created_at, due_at, done_at, snoozed_until, feedback)`.

**ai\_summary** — `(id, window_start, window_end, text, topics JSON, node_count, created_at, provider, model)`.

**settings** — key/value JSON (theme, AI provider, privacy toggles, notification times).

**fts\_node** — FTS5 over `node.content`, kept in sync by triggers.

### 3.2 Inline Content Markup

The `content` column stores text with these tokens; the editor converts them to and from ProseMirror marks:

- Reference: `[[node:<id>]]` (renders the **current** content of the target).
- Tag chip: `#[[tag:<tagDefId>]]`.
- Date: `[[date:2026-11-03]]` (also creates a link to the Day node).
- Bold `**x**`, italic `__x__`, code `` `x` ``, highlight `^^x^^`, link `[text](url)`.

### 3.3 Required Invariants

1. Every non-root node has exactly one parent. Cycles are forbidden; reject a move that would create one.
2. Deleting a referenced node shall show a confirm dialog listing reference count, then convert inline references to plain text snapshots.
3. `updated_at` changes on any edit to the node's content, tags, fields, or direct children list.
4. Operations are atomic transactions and are recorded in an undo stack (see REQ-7.4).

## 4. Functional Requirements

### 4.1 Node System

- **REQ-1.1 Infinite hierarchy.** Users shall nest nodes to unlimited depth. `Tab` indents, `Shift+Tab` outdents, `Enter` creates a sibling, `Shift+Enter` inserts a line break, `Backspace` on an empty node deletes it and focuses the previous node.
- **REQ-1.2 Reordering and moving.** `Alt+Shift+↑/↓` moves a node among siblings. Drag-and-drop by bullet moves a node (with its subtree) anywhere, including between panels.
- **REQ-1.3 Collapse and zoom.** Clicking the bullet zooms into that node as the page root with a breadcrumb trail. A chevron collapses and expands children; `Ctrl/Cmd+↑/↓` toggles. Collapse state persists per node.
- **REQ-1.4 Universal references.** Typing `[[` opens a node picker (fuzzy search over FTS). Selecting inserts an inline reference. Edits to the original appear everywhere instantly. A reference is not a copy; hovering shows a preview card, clicking navigates, `Ctrl/Cmd+click` opens in a side panel.
- **REQ-1.5 Backlinks.** Every node page shall show a "References" section listing every node that references it, grouped by source, each editable in place.
- **REQ-1.6 System fields.** Every node has hidden `created_at`, `updated_at`, and `done_at`. They are queryable and shown in a node's info popover. A checkbox toggles `done_at`; `Ctrl/Cmd+Enter` toggles it on the focused node.
- **REQ-1.7 Multi-select.** `Shift+click` or `Shift+↑/↓` selects ranges; bulk actions: tag, move, delete, copy as Tana Paste, set date.
- **REQ-1.8 Daily notes.** The app shall auto-create a `day` node per calendar date under a Calendar root. The home screen opens today's day node. `Ctrl/Cmd+Alt+T` jumps to today. Typing `@` followed by a natural-language date ("tomorrow", "next friday", "2026-12-01") inserts a date reference.
- **REQ-1.9 Workspace sidebar.** A left sidebar with: Today, Search, Library (all tag and field definitions), Pinned nodes, Recent nodes, Trash, Settings. Users shall pin any node.
- **REQ-1.10 Multi-panel.** Users shall open up to 3 side-by-side panels on desktop; one panel on mobile.

### 4.2 Supertags

- **REQ-3.1 Class definition.** Typing `#` in a node opens a tag picker; typing a new name and pressing `Enter` creates a new tag definition. Tags are global and managed in the Library. A tag definition page has: name, color, icon, extends, fields, default content, checkbox option, and a live list of all instances.
- **REQ-3.2 Template injection.** Applying a tag to a node shall inject, only where absent, (a) the tag's field instances with auto-initialized values, and (b) deep copies of the tag's default content nodes (copies, not references). Removing a tag shall **not** delete the injected content; it shall offer to remove empty fields that came from that tag.
- **REQ-3.3 Inheritance (Extend).** A tag may extend one or more parent tags. The child inherits all parent fields, default content, and checkbox setting; it may add fields and override a parent's field default, pinned flag, or options. Querying for a parent tag shall also return instances of descendant tags. Circular extension shall be rejected with an error.
- **REQ-3.4 Multi-tagging.** A node may carry any number of tags. Its effective fields are the union of all tags' fields, de-duplicated by `fieldDefId`; conflicts on defaults resolve by tag application order (first applied wins), shown in the UI.
- **REQ-3.5 Visual chips.** Tags render as colored chips at the end of the node's content. Clicking a chip opens a menu: open tag definition, view all instances, remove tag.
- **REQ-3.6 Tag from command line.** `Cmd+K → "Apply tag"` and `Cmd+K → "Create supertag"` shall work on the focused node or current multi-selection.
- **REQ-3.7 Starter tags.** On first run, seed optional tags: `#task` (Status options Inbox/Doing/Done, Due date, Priority), `#project`, `#person`, `#meeting` (Date, Attendees: node ref to `#person`), `#book` (Author, Status, Rating), `#idea`, `#habit`, `#goal`. Users may delete or edit them.

### 4.3 Fields

- **REQ-4.1 Attachment.** A field is attached ad hoc by typing `>` at the start of an empty child node (a field-definition picker opens; new names create a field definition), or by being part of a supertag template. Display format is `Name:: value` with the field name in a left column.
- **REQ-4.2 Auto-initialization.** Per field definition per tag: `none`, `default value`, `today` (date), or `current user`. When the tag is applied the field is created with that value. The `#task` seed sets Status to "Inbox".
- **REQ-4.3 Pinned fields.** A tag may pin chosen fields. Pinned fields render at the top of the node, even collapsed, and appear automatically as filter and sort options and as columns in table views of that tag.
- **REQ-4.4 Data types.** Supported types and their UI:

| Type | Storage in `fieldValue` | UI |
| --- | --- | --- |
| Plain text | string | Inline editor |
| Options | option id (single or multi) | Dropdown; options editable in field definition; option colors |
| Date/Time | ISO 8601 string, with optional range | Date picker plus natural-language input |
| Node reference | target node id(s) | Autocomplete restricted to nodes of `targetTag` (or any node) with inline "create new" |
| Boolean | 0/1 | Checkbox |
| URL | string, validated | Link with favicon |
| File | blob id in the `FileAdapter` store | Upload, preview image/PDF, download |
| Number | float | Numeric input with min/max (*added*) |

- **REQ-4.5 Field definitions are reusable.** The same field definition can belong to many tags. Renaming it renames it everywhere.
- **REQ-4.6 Validation.** Required fields show a warning badge when empty; type mismatches are rejected at input.

### 4.4 Live Search, Queries and Views

- **REQ-5.1 Query builder.** A visual builder creates a `search` node whose `meta.query` is the JSON below. Results update live as data changes.

```json
{
  "op": "AND",
  "clauses": [
    { "type": "hasTag", "tagId": "01H...", "includeDescendants": true },
    { "type": "field", "fieldDefId": "01H...", "cmp": "eq|neq|contains|lt|gt|between|in|empty|notEmpty", "value": "Doing" },
    { "type": "date", "on": "created_at|updated_at|done_at|<fieldDefId>", "range": "thisWeek|lastNDays:7|custom" },
    { "type": "references", "nodeId": "01H..." },
    { "type": "childOf", "nodeId": "01H...", "deep": true },
    { "type": "text", "q": "keyword" },
    { "type": "done", "value": false },
    { "op": "OR", "clauses": [] }
  ],
  "sort": [{ "by": "field|created_at|updated_at|manual", "fieldDefId": "...", "dir": "asc|desc" }],
  "group": { "by": "fieldDefId" },
  "limit": 500
}
```

Clauses nest arbitrarily with `AND`, `OR`, `NOT`. The engine compiles the JSON to SQL through Kysely. Live updates are achieved by re-evaluating a search when a write transaction touches affected node ids/tags (a dependency set computed per query); debounce at 100 ms.

- **REQ-5.2 Contextual search nodes.** A search node can live inside a tag template. The special token `$thisNode` in a query resolves to the node the template was applied to. Example: `#person` contains a search `hasTag(#meeting) AND references($thisNode)`.
- **REQ-5.3 Views.** Any search result, tag instance list, or node's children can render as:
  - **List** (outliner)
  - **Table** (rows = nodes, columns = pinned and chosen fields; inline-editable cells; column resize, reorder, hide; sortable headers)
  - **Cards / Kanban** (columns grouped by an Options or Node Reference field; dragging a card between columns edits the field value)
  - **Calendar** (month/week/day; nodes placed by a chosen Date field; drag to reschedule)

  The chosen view and its config persist per search or per node.
- **REQ-5.4 Global search.** `Cmd+K` and the sidebar search use FTS5 with prefix matching, ranking by recency and exact-match boost, and filter chips (tag, date).

### 4.5 Commands and Workflows

- **REQ-6.1 Command palette.** `Ctrl/Cmd+K` opens a fuzzy palette that finds nodes, creates searches, switches views, applies tags, navigates, toggles settings, and runs node commands. Results are grouped: Nodes, Commands, Tags, Navigation.
- **REQ-6.2 Node commands.** Built-ins: *Set date to today*, *Delay one day*, *Delay one week*, *Change status to Done*, *Toggle done*, *Duplicate*, *Move to…*, *Copy as Tana Paste*. Users can define custom commands as a list of steps: `setField(fieldDefId, value)`, `addTag(tagId)`, `removeTag`, `setDone`, `shiftDate(fieldDefId, +N days)`, `moveTo(nodeId)`. A custom command can be bound to a tag so it appears only on nodes of that tag, and can be triggered with a keyboard shortcut or a button in the node's toolbar.
- **REQ-6.3 Tana Paste.** On paste, if the clipboard text begins with `%%tana%%`, or looks like an indented bullet list, Hecate parses it into native nodes. Supported syntax:

```
%%tana%%
- Read Deep Work #book
  - Author:: Cal Newport
  - Status:: Reading
  - Rating:: 4
- Call [[Maya]] about the trip
  - Due:: [[date:2026-11-10]]
```

Rules: two-space indentation = child; `Name:: value` = field; `#tag` and `#[[multi word tag]]` = tags (created if missing); `[[Title]]` = reference by title (created if no exact match); `[[date:YYYY-MM-DD]]` = date; `[ ]` and `[x]` = checkbox states. *Copy as Tana Paste* produces the same format for export round-tripping. Parsing lives in `packages/core/paste` and must be pure and unit-tested.

- **REQ-6.4 Keyboard-first.** Every action available by mouse has a shortcut or palette entry. A keyboard shortcuts cheat sheet opens with `?`.

### 4.6 Editing Quality of Life

- **REQ-7.1 Autosave.** Writes persist to SQLite within 300 ms of an edit; no save button.
- **REQ-7.2 Offline.** The web build is a PWA with a service worker that caches the app shell; all features except AI calls work offline.
- **REQ-7.3 Import/Export.** Export the workspace as JSON (lossless), Markdown (per page), or Tana Paste. Import from Hecate JSON, Tana Paste, and Markdown outlines.
- **REQ-7.4 Undo/Redo.** A per-workspace operation log supports `Ctrl/Cmd+Z` and `Shift+Z` across content, structure, tags, and field edits, with at least 200 steps.
- **REQ-7.5 Trash.** Deleted nodes go to Trash for 30 days; restorable.
- **REQ-7.6 Theming.** Light, dark, and system themes; accent color; adjustable font size.

## 5. AI Mini-Task Coach (Hecate's Signature Feature)

### 5.1 Concept

Hecate periodically builds a **short summary** of what the user has been capturing, extracts themes, and proposes 3 to 5 **Mini-Tasks**: tiny, specific, time-boxed actions (typically 5 to 30 minutes) that improve the user's personal life (learning, health, relationships, finance, creativity, mindfulness, rest). Examples: *Read a book for 10 minutes*, *Jog for 20 minutes*, *Text a friend you mentioned last week*, *Write 3 lines in a journal about your goal*.

### 5.2 Requirements

- **REQ-AI-1 Opt-in and consent.** AI features are off by default. First enablement shows a consent screen explaining exactly what is sent. Users choose a provider and enter their own API key, or choose local Ollama (fully on-device).
- **REQ-AI-2 Scope control.** Settings let users choose what feeds the AI: all nodes, only nodes with chosen tags, or only the Daily notes. Users can exclude any node or tag via an "AI: exclude" toggle; excluded nodes and their subtrees are never sent. A `#private` tag exists by default and is excluded.
- **REQ-AI-3 Knowledge digest.** A background job selects nodes created or updated in the window (default last 7 days, configurable), up to 300 nodes. It strips field values of type File and URL query strings and truncates each node to 400 characters. It builds a compact digest of `{tags, text, fields}` rows. No node IDs or personal contact data (emails, phone numbers detected by regex) are sent.
- **REQ-AI-4 Short summary.** The AI returns a summary of at most 120 words and a list of up to 8 topics, stored in `ai_summary`. Summaries appear on a "Reflections" page and can be pinned as nodes.
- **REQ-AI-5 Mini-task generation.** Using the summary, the AI returns 3 to 5 tasks with a strict JSON schema (below). Tasks must be safe, realistic, non-medical, and connected to something the user actually captured (the `rationale` cites the topic). The app shall reject tasks over 60 minutes and de-duplicate against the last 14 days of tasks.
- **REQ-AI-6 Presentation.** A "Today's Mini-Tasks" card appears on the home screen below the daily note and as a sidebar item with a badge. Each task card shows title, duration chip, category icon, and rationale, and has actions: **Start** (opens a countdown timer for `duration_min`), **Done**, **Snooze** (until tomorrow or later), **Not for me** (feedback), and **Save as node** (creates a `#task` node with Due date and links back).
- **REQ-AI-7 Feedback loop.** Done, Snooze, and Not-for-me counts per category are stored and passed (as aggregate numbers only) to the next generation prompt so suggestions adapt. A weekly stats view shows completed tasks and streaks.
- **REQ-AI-8 Scheduling.** Generation runs on: first app open each day (if none exists for today), on manual "Refresh" (rate-limited to 5 per day), and optionally at a user-set time with a local notification (Tauri notification plugin on native, Web Notifications on the web).
- **REQ-AI-9 Failure handling.** Missing key, offline, rate limit, or invalid JSON shall show a clear inline message with Retry and never block the rest of the app. Invalid JSON is retried once with a repair prompt, then fails gracefully.
- **REQ-AI-10 Transparency.** A "What was sent?" button on every summary shows the exact digest payload. Users can delete all AI data in one click.
- **REQ-AI-11 Safety.** The system prompt forbids medical diagnosis, extreme exercise or fasting, and anything risky. If the digest suggests distress, the suggestions shall lean gentle (rest, reach out to someone) and may include a one-line prompt to talk to a trusted person or professional, without diagnosing.
- **REQ-AI-12 Cost control.** One summary call plus one generation call per run (they may be combined into a single call); max input 12k tokens; cache results by digest hash.

### 5.3 Provider Interface

```ts
interface AiProvider {
  id: 'anthropic' | 'openai-compatible' | 'ollama';
  complete(req: { system: string; user: string; maxTokens: number; json?: boolean }): Promise<string>;
}
```

On the web, calls go directly from the browser when the provider allows CORS; otherwise through an optional user-configured proxy URL. On Tauri, calls go through a Rust command using `reqwest` so keys never touch the webview.

### 5.4 Prompt Contract

**System prompt (default):** "You are Hecate, a gentle personal-growth coach. You receive a digest of notes the user captured recently. Produce a JSON object only, no prose. Summarize their recent focus in at most 120 words and list up to 8 topics. Then propose 3 to 5 mini-tasks that each take 5 to 30 minutes, are specific, safe, non-medical, and tied to a topic from the digest. Vary categories. Do not repeat tasks listed in `recentTasks`. Respect `categoryStats` (prefer categories the user completes, reduce those they dismiss)."

**User message:** JSON containing `digest`, `windowDays`, `recentTasks`, `categoryStats`, `locale`, and `today`.

**Required response schema:**

```json
{
  "summary": "string (<=120 words)",
  "topics": ["string"],
  "tasks": [
    {
      "title": "Read a book for 10 minutes",
      "rationale": "You saved notes on Deep Work this week.",
      "category": "learning|health|relationships|finance|creativity|mindfulness|rest|home",
      "duration_min": 10
    }
  ]
}
```

Validate with Zod; clamp or reject out-of-range values.

## 6. Tauri v2 Native Support

- **REQ-N1 Single codebase.** `apps/desktop` hosts the Tauri v2 project (`src-tauri`) and loads the same Vite build as `apps/web`. Platform code is reached only through the adapters in section 2.
- **REQ-N2 Native storage.** Use `tauri-plugin-sql` with SQLite at the app data directory. Run the same migrations (`packages/storage/migrations/*.sql`) on startup with a version table. Web builds run the same files in sqlite-wasm.
- **REQ-N3 Plugins and capabilities.** Use the v2 permission model: define capabilities granting only `sql`, `fs` (scoped to app data and user-chosen export/import paths), `dialog`, `notification`, `global-shortcut`, `clipboard-manager`, `updater`, `deep-link`, `store`, and `shell` is **not** granted.
- **REQ-N4 Desktop niceties.** Native menu bar with shortcuts, global quick-capture shortcut (default `Ctrl/Cmd+Shift+Space`) that opens a small always-on-top window to append a node to today's Daily note, system tray icon, window state restore, auto-update through the updater plugin, `hecate://node/<id>` deep links.
- **REQ-N5 Mobile.** Build iOS and Android through `tauri ios|android`. Mobile layout: single panel, bottom tab bar (Today, Search, Library, Tasks), swipe on a node row to indent/outdent, long-press for multi-select, safe-area insets respected, share-sheet target that appends shared text to today's note *(Phase 2)*.
- **REQ-N6 Secrets.** Store AI keys in the OS keychain via a Rust command (`keyring` crate). The webview never receives a stored key.
- **REQ-N7 Feature detection.** `isTauri()` selects adapters at startup. The web build must work with no Tauri APIs present.
- **REQ-N8 Backup.** Native: one-click backup of the SQLite file to a user-chosen folder, plus optional automatic daily backup keeping the last 7.

## 7. Sync (Phase 2)

The schema must be sync-ready from day one (ULIDs, `updated_at`, soft deletes, operation log). Phase 2 adds end-to-end encrypted sync via a user-hosted or Hecate-hosted server using per-node last-writer-wins by field, with a CRDT-based text merge for `content`. Do not build sync in the MVP, but do not make decisions that block it.

## 8. User Interface Specification

- **Layout (desktop):** 240 px collapsible sidebar, main panel(s), optional right panel for backlinks/info. Top bar: breadcrumbs, view switcher, panel controls, command-palette button.
- **Node row:** bullet (click to zoom, drag to move), content, tag chips, optional checkbox, hover toolbar (add field, apply tag, run command, more). Pinned fields appear under the content line.
- **Home screen:** today's Daily note, then the **Today's Mini-Tasks** card, then a "Recently edited" list.
- **Library page:** tabs for Supertags, Fields, Commands; each with create, rename, delete, and usage counts.
- **Tag definition page:** sections Fields (drag to reorder, pin toggle, default, required), Default content (an outliner), Extends, Appearance, Instances (embedded table view).
- **Reflections page:** list of summaries, topic chips, task history, weekly stats.
- **Accessibility:** WCAG 2.1 AA, full keyboard navigation, screen-reader labels on bullets and chips, reduced-motion respect.
- **Empty states and onboarding:** a 4-step first-run tour (capture, reference, tag, search) and a seeded sample workspace the user can delete.

## 9. Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | Typing latency under 16 ms at 10,000 nodes; virtualized rendering of long outlines |
| NFR-2 | Cold start under 2 s on web (cached) and 1.5 s native; workspace of 50,000 nodes remains usable |
| NFR-3 | Live search results update within 150 ms after a write for workspaces up to 20,000 nodes |
| NFR-4 | No data loss: writes are transactional; crash-safe via SQLite WAL (native) and OPFS (web) |
| NFR-5 | Privacy: no telemetry by default; AI payloads limited per REQ-AI-3; keys never logged |
| NFR-6 | Security: strict CSP, sanitize all rendered HTML, validate pasted and imported data, Tauri capabilities least-privilege |
| NFR-7 | Browser support: latest Chrome, Edge, Safari, Firefox (OPFS fallback to IndexedDB-backed storage when unavailable, with a visible warning) |
| NFR-8 | Test coverage: at least 80% on `packages/core`; e2e tests for every acceptance scenario in section 11 |
| NFR-9 | i18n-ready: all strings in message catalogs; English at launch |

## 10. Build Plan (Order for the AI Builder)

1. **Foundation:** monorepo, Vite + React shell, `StorageAdapter` with sqlite-wasm, migrations, Kysely, `packages/core` node CRUD, fractional ordering, undo log.
2. **Outliner:** node rendering, TipTap focus editor, keyboard map, zoom, collapse, drag/move, multi-select, Daily notes.
3. **References and search:** `[[ ]]` picker, `ref` table, backlinks, FTS5, command palette skeleton.
4. **Supertags and fields:** tag definitions, template injection, extends, multi-tag, field types, pinned fields, auto-init, Library UI, starter tags.
5. **Live search and views:** query JSON, compiler, live re-evaluation, List/Table/Cards/Calendar views, contextual search nodes.
6. **Commands and Tana Paste:** built-in and custom commands, parser and exporter, import/export.
7. **AI Coach:** provider adapters, consent and settings, digest builder, prompt, Zod validation, Mini-Task UI, timer, feedback loop, notifications.
8. **Tauri v2:** desktop shell, native adapters, keychain, quick capture, tray, updater; then iOS/Android targets.
9. **Polish:** theming, onboarding, accessibility, performance pass, PWA.
10. **Phase 2:** sync, share-sheet capture, additional AI providers.

Each step ends with passing tests and a runnable build. Do not start a step until the previous one's acceptance tests pass.

## 11. Acceptance Scenarios

1. **Nesting:** Create a 5-level outline using only the keyboard; reload; structure and collapse states persist.
2. **Reference sync:** Reference node A inside node B; edit A; B's rendering updates without reload; A's page lists B under References.
3. **Supertag template:** Create `#book` with fields Author (text), Status (options), Rating (number, pinned Status). Tag a node; fields appear with the default Status; pinned Status shows when the node is collapsed.
4. **Inheritance:** Create `#designtask` extending `#task`; tagging a node shows all `#task` fields plus the added field; a `#task` search returns it; overriding the Status default in the child works without changing the parent.
5. **Multi-tag:** A node tagged `#book` and `#idea` shows the union of fields with no duplicates.
6. **Contextual search:** `#person` template contains a search for meetings referencing `$thisNode`; creating a `#meeting` that references Maya makes it appear on Maya's page instantly.
7. **Views:** One `#task` search renders correctly as List, Table, Cards (grouped by Status; dragging a card changes the field), and Calendar (dragging changes the Due date).
8. **Command palette:** `Cmd+K` → "Delay one day" on a task with Due set moves the date by exactly one day.
9. **Tana Paste:** Pasting the sample in REQ-6.3 yields two top-level nodes with correct tags, fields, a created reference to "Maya", and a date; *Copy as Tana Paste* then paste again produces an equivalent structure.
10. **Offline:** In airplane mode, all non-AI features work and edits persist after restart.
11. **AI consent:** With AI off, no network request to any AI endpoint is ever made (verified in e2e by a network spy). After enabling with a mock provider, the Mini-Task card shows 3 to 5 valid tasks.
12. **AI privacy:** A node under `#private` or flagged "AI: exclude" never appears in the payload shown by "What was sent?".
13. **Mini-task flow:** Start launches a countdown of `duration_min`; Done records completion; Save as node creates a `#task` with a Due date; Not for me lowers that category's weight in the next payload's `categoryStats`.
14. **AI failure:** A mock provider returning malformed JSON triggers one repair retry, then shows an inline error with Retry; the outliner stays usable.
15. **Tauri parity:** The same e2e suite for scenarios 1 to 9 passes in the Tauri desktop build; the AI key is retrievable only through the Rust command; deep link `hecate://node/<id>` opens the right node.
16. **Performance:** Seed 20,000 nodes; scrolling stays smooth and a live-search update completes under 150 ms.

## 12. Open Defaults and Glossary

**Defaults the builder shall use unless told otherwise:** AI window 7 days; Mini-Task count 4; trash retention 30 days; undo depth 200; quick-capture shortcut `Ctrl/Cmd+Shift+Space`.

**Glossary:** *Node* — the single unit of data. *Supertag* — a tag acting as a typed schema with fields and a template. *Field* — a typed key/value attached to a node. *Live Search* — a stored query whose results update in real time. *Tana Paste* — the plain-text interchange format for nodes. *Mini-Task* — an AI-suggested action of 5 to 30 minutes. *Digest* — the sanitized summary payload sent to the AI.
