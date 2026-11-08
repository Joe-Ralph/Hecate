# Hecate

A local-first, Tana-style **graph outliner PKM** with supertags, live search, and an AI mini-task coach. Web app (PWA) with a Tauri v2 desktop/mobile shell. All data lives in SQLite on your device; AI features are optional and provider-agnostic (Anthropic, OpenAI-compatible, or fully local Ollama).

## Quick start

```sh
pnpm install
pnpm dev        # web app on http://localhost:5173
pnpm -r build   # production build
pnpm -r test    # vitest suites (storage, query, commands, import/export, …)
```

## What's in the box

- **Outliner**: infinite nesting, keyboard-first editing, collapse, zoom with breadcrumbs (`Alt+←` to zoom out), drag-and-drop moves (also across panels), multi-select (`Shift+click` / `Shift+↑/↓`) with bulk actions.
- **Supertags**: typed schemas with fields, multi-inheritance (`extends`), multi-tagging, template injection (fields + nested default content), pinned and required fields, auto-initialized values.
- **Fields**: text, options, date, node reference (with `targetTag` restriction), boolean, URL, number (min/max). Required fields warn when empty.
- **Live search nodes**: visual query builder (AND/OR/NOT groups, tag/field/date/text/done/reference/childOf clauses), contextual `$thisNode` queries inside templates, results re-evaluate live on writes (100 ms debounce).
- **Global search**: `Cmd+K` — FTS5 full-text search with prefix matching, exact-title boost, recency ranking, and tag filter chips. `Cmd+Enter` opens a result in a side panel.
- **Views**: List / Table (inline-editable cells, sortable, hide/reorder columns) / Cards (kanban grouped by an options field, drag updates the field) / Calendar (date-field placement, drag to reschedule). View choice persists per node.
- **Daily notes & calendar tab**: auto-created day nodes, `@` natural-language dates, and a calendar page showing the nodes captured per day.
- **Commands**: built-ins (Set date to today, Delay one day/week, Status→Done, Duplicate, Move to…, Copy as Tana Paste) plus custom step-list commands with tag scoping — from the palette, the node hover menu, or the Library.
- **References & backlinks**: `[[` picker, hover preview cards, and an editable "Referenced by" section per panel. Deleting a referenced node asks first and converts incoming refs to plain-text snapshots.
- **Import/export**: lossless JSON dump (export + import with full id remapping), Markdown outlines, and recursive Tana Paste (paste directly into the outliner).
- **AI coach**: opt-in consent, digest privacy controls, mini-task generation with timers and feedback loop, reflections/rollups, weekly stats, optional daily notification.
- **Theming & PWA**: warm dark / warm light / system theme, accent color, UI font scale, offline app shell via service worker.
- **Routing**: hash-based routes (`#/today`, `#/panels`, `#/library`, `#/calendar`, `#/graph`, `#/reflections`, `#/trash`, `#/settings`) so browser Back/Forward navigates inside the app.
- **Graph view**: Nebula-style 2D graph with worker-based multi-scale force physics, incremental position-preserving updates, graph-based community detection, smooth pan/pinch/keyboard zoom, viewport culling, and render-on-demand sleep. Semantic zoom moves from clickable community meta-nodes to hubs and detailed node labels; local neighborhoods, supertag/orphan filters, display controls, and force tuning persist through settings. Layers: `layout.ts` (data/filtering), `communities.ts`, `physics.ts` + `graphWorker.ts`, `camera.ts`, `model.ts`, `renderer.ts`, `controller.ts`, and `GraphPage.tsx` / `GraphControls.tsx` (UI).

## Storage engine: `@sqlite.org/sqlite-wasm`

Hecate uses the **official SQLite WASM build** (not sql.js). Decision drivers:

- **FTS5 included** — sql.js ships without FTS5 (`no such module: fts5`, verified), and full-text search is a core feature (REQ-5.4).
- Matches the FRD §2 fixed decision (sqlite-wasm was always the intended engine).
- Runs identically in the browser and in Node (Vitest uses the same adapter, no second engine).

The swap is contained in `packages/storage/src/adapters/memory-adapter.ts` behind the `StorageAdapter` interface; all repositories are engine-agnostic. Persistence uses an IndexedDB binary snapshot (debounced 250 ms after writes) with `sqlite3_serialize`/`sqlite3_deserialize` round-tripping. **Follow-up:** OPFS persistence in a Web Worker (requires async messaging across the adapter layer). FTS5 (`fts_node`) is an external-content table kept in sync by triggers, with a one-time backfill for pre-existing databases.

## Roadmap / implementation phases

- [x] **B0 — Storage engine swap**: sql.js → `@sqlite.org/sqlite-wasm`, IndexedDB persistence preserved, wasm emitted by Vite automatically.
- [x] **A — Navigation**: zoom + breadcrumbs, backlinks section, reference hover previews, real pinned/recent sidebar. (REQ-1.3/1.4/1.5/1.9)
- [x] **B — Global FTS5 search**: trigger-synced `fts_node`, ranked omnibar results, tag filter chips. (REQ-5.4)
- [x] **C — Live search nodes**: query builder, search panels, live re-evaluation, `$thisNode`. (REQ-5.1/5.2)
- [x] **D1 — Outliner depth**: multi-select + bulk bar, drag-and-drop, safe delete with reference confirmation. (REQ-1.2/1.7, §3.3.2)
- [x] **D2 — Supertags & fields**: recursive template injection, non-destructive tag removal, pinned-when-collapsed, URL/number/boolean/nodeRef fields, required badges, multi-extends. (REQ-3.2/3.3/4.3/4.4/4.6)
- [x] **D3 — Commands**: pure executor in `packages/core`, built-ins, custom command editor, tag scoping. (REQ-6.2)
- [x] **D4 — View depth**: editable/sortable tables, kanban field grouping, calendar drag-reschedule, persisted view config. (REQ-5.3)
- [x] **D5 — Import/export**: JSON round-trip with id remap, Markdown, recursive Tana Paste. (REQ-6.3/7.3)
- [x] **D6 — Polish**: theming, PWA, notifications, weekly stats, onboarding tour, settings-key fixes.
- [x] **E — Verification**: 67 tests incl. 20k-node perf smoke (FTS ~2 ms, live query ~3 ms).

### Deliberate deviations & follow-ups

- **Live-search updates** use the store's `version` counter + debounce instead of FRD's per-query dependency sets (measured well under the 150 ms NFR at 20k nodes).
- **File field type** deferred — needs a `FileAdapter` blob store.
- **OPFS worker persistence** deferred (see above).
- **Tauri native/mobile (FRD §6) and Phase-2 sync (§7)** are out of scope for these phases.
- Undo correctness fix included: `UndoStack.undo()` now returns the original operation (it previously returned the inverted op, which the store mis-applied).

## Repository layout

```
apps/web            React + Vite web app (pages, panels, outliner, store)
apps/desktop        Tauri v2 shell
packages/core       Domain logic: types, fractional keys, query compiler, paste, commands, transfer
packages/storage    SQLite adapters, migrations, repositories (nodes, tags, refs, search, settings, ai)
packages/ai         Coach providers (Anthropic / OpenAI-compatible / Ollama / mock)
packages/reflection Local reflection engine (rollups, candidates, scoring)
packages/ui         Design system: views, palette, coach rail, components
```

Detailed requirements: `Hecate — Functional Requirements Document.md`. Design system: `Hecate Design System — README.md`. Reflection engine: `Hecate Reflection Engine — README.md`.
# Hecate
