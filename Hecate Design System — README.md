# Hecate Design System — README

*Version 1.0 · Source of truth for UI, interaction and navigation · Derived from the "Today + Coach" screen · Pairs with the Hecate Functional Requirements Document (FRD)*

**How to use this document:** An AI coding agent or designer should be able to build every Hecate screen from this README alone. Section 2 holds the tokens, section 3 the components (anatomy, states, click behavior, keyboard), section 4 the navigation model, and section 5 the AI Coach behavior. "Shall" is mandatory. Requirement IDs (REQ-…) refer to the FRD.

## 1. Design Principles

1. **Notes first, coach second.** The outliner is the hero. The AI Coach lives in a calm side rail and never pushes writing below the fold.
2. **Capture in under two seconds.** The capture bar is always one click or one shortcut away. Triggers (`#`, `[[`, `>`, `@`) are shown, not hidden.
3. **Structure appears, never interrupts.** Tags, fields and references are lightweight chips and pills that stay out of the way until needed.
4. **Keyboard-first, mouse-friendly.** Every action has a shortcut or a Cmd+K entry; every shortcut has a visible button.
5. **Transparent AI.** Every suggestion says which note it came from. "What was sent?" is always one click away.
6. **Quiet, warm, dark.** Warm greys, one accent (violet), one color per supertag. No gradients, no emoji, no decorative motion.
7. **Local-first honesty.** The status bar always says where data lives and whether it is saved.

## 2. Foundations (Design Tokens)

### 2.1 Color

**Surfaces and lines**

| Token | Hex | Use |
| --- | --- | --- |
| `--bg` | `#121110` | App background, main column |
| `--bg-side` | `#161513` | Sidebar, coach rail, capture bar, queue cards |
| `--surface` | `#1c1a18` | Field pills, secondary buttons |
| `--surface-2` | `#1a1917` | View switcher track |
| `--hover` | `#181614` | Outline row hover |
| `--hover-nav` | `#1f1d1a` | Sidebar item hover |
| `--active` | `#24211e` | Selected sidebar item |
| `--active-2` | `#2a2723` | Selected segmented control |
| `--border` | `#2a2825` | Dividers, field borders |
| `--border-strong` | `#34312d` | Inputs, buttons, capture bar |

**Text**

| Token | Hex | Use |
| --- | --- | --- |
| `--text` | `#ece8e1` | Titles, primary content |
| `--text-2` | `#d8d2c8` | Child notes, field values |
| `--text-3` | `#c9c3b9` | Navigation labels, breadcrumbs |
| `--muted` | `#9a948a` | Labels, helper text, empty fields |
| `--faint` | `#8a847a` | Key hints, counts, metadata |

All text tokens pass 4.5:1 against `--bg` and `--bg-side`. Never use a lighter-weight grey than `--faint` for readable text.

**Accent and semantic**

| Token | Hex | Use |
| --- | --- | --- |
| `--accent` | `#c4b2ff` | Primary button fill, references, coach label, logo |
| `--accent-bg` | `#1b1726` | Featured coach card |
| `--accent-border` | `#4a3f6e` | Featured coach card border |
| `--accent-chip` | `#262033` | Badge on Reflections |
| `--ref-underline` | `#6d5aa8` | Dashed underline on references |
| `--success` | `#8fd18b` | Done states, streak |
| `--success-bg` | `#1e2a1e` | Completed day, `#task` chip |

**Supertag palette** (chip text on chip background; each new tag takes the next free pair, or the user picks)

| Tag | Text | Background |
| --- | --- | --- |
| `#task` | `#8fd18b` | `#1e2a1e` |
| `#book` | `#e8b86a` | `#2c2418` |
| `#person` | `#8cc4f0` | `#1d2630` |

Rule: colors that must be told apart also differ in lightness, never hue alone.

### 2.2 Typography

| Role | Font | Size / line | Weight | Notes |
| --- | --- | --- | --- | --- |
| Page title | Inter | 34 / 40 | 600 | Letter-spacing −0.01em |
| Node text | Inter | 16 / 26 | 400 |  |
| Child node text | Inter | 15 / 24 | 400 | `--text-2` |
| UI text, buttons | Inter | 14 / 22 | 500 |  |
| Secondary | Inter | 13 | 400 |  |
| Field pill | Inter | 12 | 400–500 |  |
| Label | JetBrains Mono | 11 | 500 | Uppercase, +0.08em |
| Key hint, count, status bar | JetBrains Mono | 11–12 | 400 |  |

Monospace is for labels and metadata only, never for note content.

### 2.3 Spacing, Radius, Elevation

- **Spacing scale:** 4, 6, 8, 10, 12, 16, 20, 24, 32, 36.
- **Radius:** checkbox 5 · chip and field 6 · nav item and row 8 · button, input, queue card 10 · featured card 14.
- **Borders over shadows.** Hecate uses 1px borders for separation. The only shadow is on floating layers (command palette, popovers): `0 12px 40px rgba(0,0,0,.5)`.
- **Layout constants:** sidebar 232 px · coach rail 344 px · top bar 56 px · status bar 32 px · main column max-width 760 px with 32 px side padding.

### 2.4 Motion

| Interaction | Duration | Easing |
| --- | --- | --- |
| Hover, focus color change | 120 ms | ease-out |
| Collapse / expand children | 160 ms | ease-in-out |
| Popover, palette open | 140 ms (fade + 4 px rise) | ease-out |
| Task complete (check, row fades to 50%) | 240 ms | ease-in-out |
| Timer ring | linear, 1 s steps | linear |

Respect `prefers-reduced-motion`: replace all movement with instant state changes.

### 2.5 Focus and Accessibility

- Focus ring: 2 px `--accent` outline with 2 px offset on every interactive element. Never remove it.
- Touch targets: 44 px minimum on touch devices; desktop nav rows may be 36 px.
- Icon-only buttons need `aria-label`. Decorative SVG is `aria-hidden`.
- Use real `<button>`, `<a>`, `<input>`; never click handlers on `div`.
- Meet WCAG 2.1 AA.

### 2.6 CSS Variable Handoff

```css
:root {
  --bg:#121110; --bg-side:#161513; --surface:#1c1a18; --hover:#181614;
  --active:#24211e; --border:#2a2825; --border-strong:#34312d;
  --text:#ece8e1; --text-2:#d8d2c8; --text-3:#c9c3b9; --muted:#9a948a; --faint:#8a847a;
  --accent:#c4b2ff; --accent-bg:#1b1726; --accent-border:#4a3f6e;
  --success:#8fd18b; --success-bg:#1e2a1e;
  --font-ui:'Inter',system-ui,sans-serif; --font-mono:'JetBrains Mono',monospace;
  --r-chip:6px; --r-row:8px; --r-btn:10px; --r-card:14px;
}
```

A light theme (Phase 2) swaps only these variables.

## 3. Components

Each component lists **Anatomy**, **States**, and **Interaction** (what every click, key and gesture does).

### 3.1 App Shell

**Anatomy:** three columns: Sidebar (232) · Main (flex, with Top bar, scroll area, Status bar) · Coach rail (344).

**Interaction:**

- The sidebar collapses with `Cmd/Ctrl+\` to a 56 px icon strip. The coach rail collapses with `Cmd/Ctrl+Shift+\` to a 40 px tab. Both states persist per device.
- Below 1100 px width the coach rail becomes a slide-over opened from a top-bar button; below 760 px the sidebar becomes a drawer and the layout switches to the mobile pattern in section 6.
- Opening a second panel (`Cmd/Ctrl+click` on a reference) splits the main column; the coach rail auto-collapses while two panels are open.

### 3.2 Sidebar

**Anatomy (top to bottom):** logo and name · command button · primary nav (Today, Library, Reflections) · Pinned · Supertags · footer (Trash, Settings).

**States:** default, hover (`--hover-nav`), selected (`--active`, white text), focus ring, drag-over (accent line).

**Interaction:**

- **Logo:** click goes to Today.
- **Command button ("Search or run command"):** click or `Cmd/Ctrl+K` opens the Command Palette (3.14). It is a button that looks like an input: it never takes typing focus itself.
- **Today:** click opens today's Day node (creates it if absent). `Alt+T` from anywhere. If already on Today, click scrolls to top and focuses the capture bar.
- **Library:** opens the Library page with tabs Supertags, Fields, Commands. Shortcut: `G` then `L`.
- **Reflections:** opens the AI summaries and task history. The badge is the count of unseen items (new summary, completed-task milestones); opening the page clears it. The badge never shows when AI is off.
- **Pinned:** each item opens its node page. Drag to reorder. Right-click or `…` on hover offers Unpin, Open in side panel, Rename. A node is pinned from its page (Pin button in the top bar) or `Cmd/Ctrl+D`. Dot color is user-chosen per pin.
- **Supertags:** lists the user's tags with the instance count at right. Click opens the tag's Instances view (table by default). `Cmd/Ctrl+click` opens its definition page. Hover reveals `…` (Edit definition, Change color, Delete). Only the top 8 by use are shown; "Show all" opens the Library.
- **Trash:** opens deleted nodes with Restore and Delete forever. **Settings:** opens the Settings modal (General, Appearance, AI, Data, Shortcuts). The `?` key hint opens the shortcut cheat sheet.

### 3.3 Top Bar

**Anatomy:** breadcrumb at left · view switcher at right · (on node pages) Pin and More buttons.

**Interaction:**

- **Breadcrumb:** each segment is a link to that ancestor; the last segment is the current page, not clickable. Overflow collapses middle segments into `…` that opens a menu. `Cmd/Ctrl+↑` on a focused node zooms out one level.
- **View switcher (List · Table · Cards · Calendar):** a segmented control (radio-group semantics). Click or arrow keys change the view of the current node or search; the choice persists per node/search. Table, Cards and Calendar are disabled with a tooltip ("Needs a tag with fields") for nodes whose children share no tag. Shortcuts: `Cmd/Ctrl+Alt+1…4`.
- Switching views keeps the selection and scroll anchor where possible and animates only a 120 ms fade.

### 3.4 Page Header (Date / Title)

**Anatomy:** mono label (weekday) · title (34/40) · one-line summary ("3 open tasks · 1 note references today").

**Interaction:**

- On a Day node the title is a date: click opens a small calendar popover; picking a date navigates to that day. `←` / `→` with focus on the title move a day; `Alt+T` returns to today.
- On any other node the title is an editable text node: click places the cursor, `Enter` moves focus to the first child.
- The summary counts are links: click "3 open tasks" opens a search for open `#task` nodes under this page; click "1 note references today" opens the Backlinks panel.

### 3.5 Outline Row (Node)

**Anatomy:** bullet (6 px dot) · optional checkbox · content · tag chips · optional field pills below · right metadata (ref count).

**States:** default, hover (`--hover` background and left-edge handle appears), focused (editing), selected (accent 1px outline, multi-select), dragging (60% opacity with accent drop line), completed (text 50% opacity, struck through only when the tag shows a checkbox), collapsed.

**Interaction:**

- **Click content:** places the cursor at the click point. The row becomes an editor (TipTap); other rows stay static.
- **Click bullet:** zooms into the node as the page root (breadcrumb extends). `Alt+click` or `Cmd/Ctrl+click` opens it in a side panel. Drag the bullet to move the node and its subtree.
- **Click ▸ / ▾ (appears on hover, left of the bullet):** collapses or expands children; `Cmd/Ctrl+↑/↓` does the same from the keyboard. A collapsed node shows "N hidden" at the right.
- **Checkbox:** shown only for nodes whose tag enables it (e.g. `#task`). Click or `Cmd/Ctrl+Enter` toggles `done_at`; it sets Status to Done if the tag has a Status field. Undo is offered via a toast for 5 seconds.
- **Keys:** `Enter` new sibling (if the node is empty and nested, outdent instead) · `Shift+Enter` line break · `Tab` / `Shift+Tab` indent / outdent · `Backspace` on empty deletes and focuses previous · `Alt+Shift+↑/↓` move · `↑/↓` at line edges move focus between rows · `Esc` leaves editing and selects the row · `Shift+↑/↓` extends the selection.
- **Hover handle (left edge):** drag grip; `⋯` opens the node menu (Apply tag, Add field, Run command, Duplicate, Copy as Tana Paste, Pin, Delete).
- **Right-click:** same node menu at the cursor.
- **Typing triggers:** `#` opens the tag picker; `[[` the node picker; `>` at the start of an empty child the field picker; `@` the date picker; `/` the slash menu (heading, checkbox, search node, view).
- **Ref count ("2 refs"):** click opens a popover listing referencing nodes; click an item to navigate.

### 3.6 Supertag Chip

**Anatomy:** colored pill, `#name`, 22 px tall, placed at the end of the node text.

**Interaction:**

- **Click:** opens a menu: Open definition · View all instances · Remove tag. `Cmd/Ctrl+click` jumps straight to the instances view.
- **Applying:** typing `#` and picking a tag, or Cmd+K → "Apply tag". On apply, the template's fields and default content are injected (REQ-3.2) with a 160 ms expand animation; the first injected empty field takes focus only if it is marked required.
- **Removing:** `Backspace` at the start of an empty chip position or menu → Remove. Hecate asks whether to also remove empty fields that came from the tag.
- **Creating:** typing a new name after `#` and pressing `Enter` shows "Create supertag #name" as the first option; confirming opens a small popover to pick a color.

### 3.7 Field Pill

**Anatomy:** 24 px pill with a muted name and a value (`Status  Inbox`). Empty fields render as dashed pills with `+ Name`. Pinned fields always show; unpinned fields show on expand (a "+N fields" pill).

**States:** default, hover (border brightens), editing (inline editor replaces the pill), invalid (red-orange outline `#e8856a` plus message), required-empty (warning dot).

**Interaction by type:**

- **Options:** click opens a dropdown with colored options and a search box; `Enter` selects; typing a new value offers "Create option".
- **Date:** click opens a popover with a calendar and a natural-language input ("fri", "in 2 weeks"); `Esc` cancels.
- **Node reference:** click opens an autocomplete limited to the field's target tag, with "Create new" at the bottom; selection renders as a reference chip.
- **Text / Number / URL:** click edits inline; `Enter` commits, `Esc` reverts. URL values render as links; `Cmd/Ctrl+click` opens them.
- **Boolean:** a single click toggles.
- **File:** click opens upload; images show a thumbnail on hover.
- **Empty dashed pill:** click starts editing that field immediately.
- **Right-click or `⋯`:** Clear value, Open field definition, Hide on this node.
- **Keyboard:** `Tab` moves between pills in a row, then to the next row.

### 3.8 Reference Chip (inline link)

**Anatomy:** text in `--accent` with a dashed `--ref-underline`; it always shows the target's current text.

**Interaction:**

- **Hover (300 ms delay):** preview card with the target's text, tags and first 5 children.
- **Click:** navigates to the target (breadcrumb updates, Back works). `Cmd/Ctrl+click` opens a side panel. `Alt+click` places the cursor inside the reference text instead.
- **Editing the target text anywhere** updates all references instantly.
- **Deleting a referenced node** shows a confirm dialog with the reference count; confirming converts references to plain text.
- **Typing `[[`:** opens the picker; `Enter` inserts; typing a name that does not exist offers "Create node".

### 3.9 Capture Bar

**Anatomy:** 48 px bar with a `+`, placeholder "Capture anything…", and four mono hints (`# tag`, `[[ link`, `> field`, `@ date`).

**Interaction:**

- **Focus:** click or `C` (when no editor is focused) or the global quick-capture shortcut (native: `Cmd/Ctrl+Shift+Space`).
- **Typing:** works like a node editor; all triggers work. A paste of Tana Paste or an indented list parses into nodes.
- **`Enter`:** appends the node to the end of the current page (today's note on the home screen) with a 160 ms drop-in, keeps focus in the bar for rapid capture. `Shift+Enter` adds a line break. `Esc` blurs.
- **Clicking a hint** inserts its trigger character (e.g. `#`) and opens the matching picker.
- On a non-Day page the placeholder changes to "Add to *Page title*…".

### 3.10 Buttons

| Variant | Look | Use |
| --- | --- | --- |
| Primary | `--accent` fill, dark text, 44 px | One per context (e.g. Start timer) |
| Secondary | `--surface`, `--border-strong`, 44 px | Done, Cancel |
| Ghost | No border, `--muted` text | Refresh, links like "What was sent?" |
| Icon | 32–44 px square, `aria-label` | Hover toolbars |

States: hover (brighten 6%), pressed (darken 4%), focus ring, disabled (50% opacity, no pointer events), loading (spinner replaces icon; label stays).

### 3.11 Status Bar

**Anatomy:** 32 px mono strip: save state · offline state · coach/AI mode.

**Interaction:** "Saved locally" turns to "Saving…" for writes over 300 ms and to "Not saved — retry" on a failed write (click retries). Clicking "Offline ready" opens the Data settings (backup, export). Clicking the coach mode opens AI settings. On native it also shows the last backup time.

### 3.12 Coach Rail

See section 5 for full behavior. Components inside: **Noticed block**, **Do-this-now card**, **Up-next list**, **Weekly strip**, **Transparency link**.

### 3.13 Checkbox

18 px, 5 px radius, 1.5 px border `#6f695f`. Checked: `--success` fill with dark tick. Click, `Space` or `Cmd/Ctrl+Enter` toggles. Hit area is padded to 32 px (44 px on touch).

### 3.14 Command Palette (Cmd+K)

**Anatomy:** centered 640 px layer, 56 px input, grouped results (Nodes, Commands, Tags, Navigation), footer with key hints.

**Interaction:**

- **Open:** `Cmd/Ctrl+K` or the sidebar button. **Close:** `Esc` or click the scrim.
- **Typing:** fuzzy search nodes (FTS5) and commands; results update every keystroke with a 50 ms debounce. Recents show when empty.
- **Navigation:** `↑/↓` move, `Enter` runs, `Cmd/Ctrl+Enter` opens in a side panel, `Tab` completes into a filter chip (e.g. `#task`, `in:today`).
- **Context commands:** if a node is focused or selected, commands act on it ("Delay one day", "Set date to today", "Apply tag…", "Change status to Done"). Commands that need a value open a second step inside the palette.
- **Create:** the last row is always "Create node …" and "Create search …".

### 3.15 Popovers, Menus, Toasts, Dialogs

- Popovers and menus: `--bg-side`, 1px `--border-strong`, 10 px radius, floating shadow. `Esc` or outside click closes; focus returns to the trigger.
- Toasts: bottom center, 4–5 s, with an Undo action for reversible operations. Never stack more than 2.
- Dialogs: only for destructive or irreversible actions (delete referenced node, delete all AI data). Primary action on the right; the destructive label is explicit ("Delete 3 references").

### 3.16 Table, Cards and Calendar Views

- **Table:** header cells sortable (click cycles asc, desc, none); drag header edges to resize; drag headers to reorder; `+` at the right adds a column (field picker). Cells edit inline using the field-pill editors. Row click opens the node in the side panel; the leading bullet zooms in.
- **Cards:** columns are the options of the group-by field. Drag a card across columns to change the field value (with an optimistic update and undo toast). `+ Add card` at the column bottom creates a node already tagged and set to that value.
- **Calendar:** month, week, day toggles. Drag an item to a date to set its date field; click an empty day to create a tagged node on that date; click an item to open it in the side panel.

## 4. Navigation Model

### 4.1 Information Architecture

```
Today (home)
Library
  ├─ Supertags → Tag definition (fields, default content, extends, instances)
  ├─ Fields
  └─ Commands
Reflections (summaries, task history, weekly stats)
Pinned nodes → Node page
Supertag list → Instances view
Trash
Settings (modal)
Node page (any node) → Backlinks panel → Side panels (up to 3)
```

### 4.2 Routing (hash-based so it works in web, PWA and Tauri)

| Route | Screen |
| --- | --- |
| `#today` | Today / current Day node |
| `#day-2026-11-03` | A specific day |
| `#node-<id>` | Node page (zoomed) |
| `#tag-<id>` | Tag instances view |
| `#tagdef-<id>` | Tag definition |
| `#library` | Library (tabs held in app state) |
| `#reflections` | Coach history and stats |
| `#trash` | Trash |

Browser Back and Forward follow zoom and page changes. Side-panel state and view mode are stored in app state, not in the hash. Native deep links `hecate://node/<id>` map to `#node-<id>`.

### 4.3 Global Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+K` | Command palette |
| `Alt+T` | Go to Today |
| `G` then `L` / `R` | Library / Reflections (when not editing) |
| `C` | Focus capture bar (when not editing) |
| `Cmd/Ctrl+\` | Toggle sidebar |
| `Cmd/Ctrl+Shift+\` | Toggle coach rail |
| `Cmd/Ctrl+[` / `]` | Back / Forward |
| `Cmd/Ctrl+Z` / `Shift+Z` | Undo / Redo |
| `Cmd/Ctrl+Alt+1…4` | List / Table / Cards / Calendar |
| `?` | Shortcut cheat sheet |

Shortcuts that are single letters only fire when no text field has focus.

### 4.4 Focus Order

Skip link → sidebar → top bar → page header → outline rows (arrow keys roam inside the outline; `Tab` leaves it) → capture bar → coach rail → status bar. `F6` cycles landmarks.

## 5. AI Coach Behavior

### 5.1 Noticed Block

- Shows the latest summary (max 2 sentences here; the full 120-word version lives on Reflections) and up to 3 topic pills.
- Click a topic pill: opens a search of nodes from the digest window tagged with that topic's keywords.
- When AI is off, the block is replaced by a single card "Turn on the Coach" with a primary button that opens the consent flow (REQ-AI-1).

### 5.2 Do-This-Now Card (featured task)

- The featured task is the highest-ranked pending task, shown with its duration and a rationale that contains a **reference chip** to the source note (click opens that note).
- **Start timer:** the button becomes "Pause" with a visible countdown; the ring fills linearly. The timer continues if the user navigates away (state lives in the app shell) and shows as a small pill in the status bar. At zero: a gentle sound toggle (off by default), a native notification on desktop/mobile, and the card flips to "Nice. Mark it done?" with Done and "+5 min".
- **Done:** the ring completes, the row is checked, the card collapses with a 240 ms animation, and the next queued task is promoted to featured. The weekly strip updates today's cell. The streak counts a day when at least one task is done.
- **Overflow `⋯` (appears on hover):** Snooze (later today, tomorrow, next week) · Save as node (creates a `#task` with Due and a reference back) · Not for me (opens a one-tap reason: "Not interested", "Too long", "Not now") · Why this?
- **Not for me** removes the task, shows an Undo toast, and records category feedback for the next generation (REQ-AI-7).

### 5.3 Up-Next List

- Each row has a checkbox, title, one-line rationale and a duration. Click the checkbox: completes it. Click the row: promotes it to featured (swapping places). Drag to reorder. The same `⋯` overflow appears on hover.
- Maximum 4 rows visible; "Show all" opens Reflections.

### 5.4 Weekly Strip

- Seven day cells, filled with `--success-bg` for days with a completed task. Hover a cell: tooltip with the number of completed tasks. Click a cell: opens that day on Reflections.
- The streak label is positive only ("4-day streak"); a broken streak shows nothing. There is no shame state.

### 5.5 Refresh and Transparency

- **Refresh:** regenerates the summary and tasks (limit 5/day, REQ-AI-8). While running, the rail shows skeleton cards; on failure an inline message with Retry (REQ-AI-9). The old tasks stay visible until new ones arrive.
- **"What was sent to the AI?"** opens a side sheet showing the exact digest, window, and provider, with Copy and "Delete all AI data" actions (REQ-AI-10).
- **Collapsing the rail** keeps timers running and shows a dot on the tab when a new suggestion is ready.

### 5.6 Reflections Page

List of weekly summaries (newest first), each expandable to its full text, topics, and the tasks it produced with outcomes; a stats header (completed this week, favorite categories, streak). Each summary has Pin as node and Delete.

## 6. Responsive and Platform Behavior

| Width | Layout |
| --- | --- |
| 1440+ | Full three columns as designed |
| 1100–1439 | Same, main column max 760 and centered |
| 760–1099 | Coach rail becomes a right slide-over opened by a top-bar button; sidebar stays |
| Under 760 (mobile) | Single column; bottom tab bar: Today · Search · Library · Coach; sidebar becomes a drawer from the logo |

**Mobile gestures:** swipe right on a row to indent, left to outdent; long-press selects; pull down on Today to refresh the coach; the capture bar docks above the keyboard with a toolbar of `#`, `[[`, `>`, `@` buttons. Targets are 44 px.

**Native (Tauri v2):** custom title bar area is draggable, with traffic-light inset on macOS; the tray menu offers Quick capture and Today; the quick-capture window reuses the Capture Bar component at 480 px wide and closes on `Enter` or `Esc`; timers fire native notifications.

## 7. States Catalog

| Situation | Presentation |
| --- | --- |
| Empty day | Page title, then a single dashed row "Start writing, or press `C` to capture" |
| Empty tag instances | Centered text "No #book yet" with a button "Create one" |
| Search with no results | "Nothing matches 'x'" with "Create node 'x'" |
| Loading | Skeleton rows at 60% opacity; never a full-page spinner |
| Write failure | Status bar turns `#e8856a`, toast with Retry; edits stay in memory |
| Offline AI | Inline note in the coach rail: "Coach needs a connection"; the rest of the app is unaffected |
| First run | 4-step tour (capture, reference, tag, search) with a removable sample workspace |

## 8. Implementation Notes for the Builder

1. Build tokens first as CSS variables (2.6), then the primitives (Button, Chip, FieldPill, Checkbox, Popover, Dialog, Toast), then composite components (OutlineRow, CaptureBar, CommandPalette, CoachRail), then screens.
2. Only the focused row mounts an editor; all others render static HTML from the stored content tokens.
3. Views, shortcuts and layout state live in a Zustand store; data always comes from the storage adapter, never component state.
4. Every component ships with a Storybook story covering each state in sections 3 and 7, and a Playwright test for the click paths described here.
5. Do not invent new colors, radii or font sizes; extend the tokens in this document first.
6. When a behavior here conflicts with the FRD, the FRD wins for data semantics and this README wins for presentation and interaction.
