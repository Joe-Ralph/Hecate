# Hecate — Master Design System (Terminal Brutalism for PKM)

> **Version:** 2.0  
> **Scope:** Web app, Tauri v2 desktop, and mobile layouts for Hecate Personal Knowledge Management  
> **Adopted from:** One Chess Master Design System (Terminal Brutalism)  
> **Intent:** Absolute visual and structural consistency across all screens, outliner nodes, views, command palettes, and AI coach interactions. Any component or view in Hecate must feel like a precision graph instrument — authoritative, fast, sharp, and distraction-free.

---

## 1. Design Philosophy

### Core Principle: Brutal Clarity for Knowledge Work
Knowledge management often suffers from decorative clutter: colorful pastel tags, soft shadows, rounded pills, and slow spring animations that distract from thinking. Hecate rejects decoration. Every element exists to represent data structure (nodes, supertags, fields, links, queries) or enable immediate keyboard-driven action.

### Aesthetic Direction: Terminal Brutalism
The visual language fuses Bloomberg terminal density, high-end Swiss editorial typography, and brutalist computing ergonomics. The interface feels like a high-performance console for your second brain.

### Three Inviolable Laws
1. **Zero radius.** `border-radius: 0` everywhere, always. No rounded corners on buttons, inputs, modals, tag chips, nodes, dropdowns, table cells, or cards.
2. **Monochrome foundation.** Deep obsidian (`#0a0a0a`), dark surface (`#111111`), precise structural borders (`#222222` and `#333333`), crisp white primary text (`#ffffff`), and calibrated grays (`#888888`, `#555555`). Color is strictly semantic or used as subtle 1px line / swatch cues.
3. **Typography does the heavy lifting.** Structural hierarchy, spatial rhythm, weight contrast (400 vs 500 only), and uppercase letter-spacing replace ornamental shapes and colored surfaces.

---

## 2. Color System

### Base Palette

| Role | Hex | Tailwind Token | Usage |
|------|-----|----------------|-------|
| App background | `#0a0a0a` | `bg-hecate-bg` | Main app background, sidebar bg, base canvas |
| Surface / Card bg | `#111111` | `bg-hecate-surface` | Outliner cards, hover rows, modal panels, table headers |
| Inset / Input bg | `#161616` | `bg-hecate-inset` | Text inputs, code blocks, active cell editors |
| Border default | `#222222` | `border-hecate-border` | All container borders, node tree lines, table grids |
| Border emphasis | `#333333` | `border-hecate-border-emp` | Interactive element borders, dividers, focus outlines |
| Text primary | `#ffffff` | `text-hecate-primary` | Node titles, headings, active labels, content text |
| Text secondary | `#888888` | `text-hecate-secondary` | Field values, backlink summaries, meta attributes |
| Text muted | `#555555` | `text-hecate-muted` | Field labels, breadcrumbs, shortcuts, placeholders |
| Text disabled | `#3a3a3a` | `text-hecate-disabled` | Empty states, inactive toggles, past breadcrumbs |
| Inverted surface | `#ffffff` | `bg-hecate-white` | Hero CTA cards, primary inverted action buttons |
| Inverted text | `#000000` | `text-hecate-black` | Text on inverted white surfaces |

### Semantic Status Colors
Used strictly for status indications (checkbox states, error badges, warnings, active timers). Never as solid fills or decorative badges.

| State | Hex | Usage |
|-------|-----|-------|
| Success / Done | `#338833` | Completed checkbox, successful sync, streak indicator |
| Error / Danger | `#cc3333` | Required field missing, cycle warning, delete confirmation |
| Warning / Caution | `#aa7722` | Snoozed mini-task, unsaved buffer, rate limit warning |
| Accent / Highlight | `#ffffff` | Active selection border, focused bullet outline |

### Supertag Color Scheme
In Hecate, supertags can have user-assigned colors (e.g., `#task`, `#book`, `#person`). In Terminal Brutalism:
- Tag chips **never** use bright solid filled pastel backgrounds.
- Tag chips are sharp zero-radius boxes (`border: 1px solid #333`, background `#111111`).
- The tag's color is expressed via a crisp `1px` left-border accent or a `6×6px` square color swatch beside the tag name.
- Standard default palette for supertags:
  - Slate: `#888888`
  - Emerald: `#22c55e`
  - Amber: `#eab308`
  - Crimson: `#ef4444`
  - Indigo / Blue: `#3b82f6`
  - Violet: `#a855f7`
  - Orange: `#f97316`

---

## 3. Typography & Hierarchy

### Font Family
```css
font-family: system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', sans-serif;
font-mono: 'SF Mono', 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
```
Native system font for UI and outliner content. Monospace for code marks, queries, formulas, and keyboard shortcuts.

### Weight Scale
Only two font weights exist in Hecate:
- **Regular (`400`)**: Body text, node content, descriptions, field values.
- **Medium (`500`)**: Headings, active values, button labels, tag names, key shortcuts.
- **Never use `600`, `700`, `800`, or `900`.**

### Type Scale

| Role | Size | Weight | Tracking / Letter-spacing | Transform | Color |
|------|------|--------|---------------------------|-----------|-------|
| Page / Root title | `20–22px` | 500 | `normal` (0) | None | `#ffffff` |
| View / Panel heading | `16–18px` | 500 | `normal` (0) | None | `#ffffff` |
| Node content (default) | `14px` | 400 | `normal` (0) | None | `#ffffff` |
| Field label | `11px` | 500 | `1.5px` | UPPERCASE | `#555555` |
| Field value | `13px` | 400 | `normal` (0) | None | `#888888` |
| Section / Group label | `10–11px` | 500 | `2px` | UPPERCASE | `#555555` |
| Button label | `11–12px` | 500 | `1.5px` | UPPERCASE | Inherited |
| Tag chip text | `11px` | 500 | `1px` | UPPERCASE | `#ffffff` |
| Reference token | `13px` | 500 | `normal` (0) | None | `#ffffff` |
| Monospace token / code | `12px` | 400 | `normal` (0) | None | `#888888` |
| Keyboard shortcut | `10px` | 500 | `1px` | UPPERCASE | `#555555` |

---

## 4. Spacing & Grid System

Base unit: `4px`.
- `xs`: `4px`
- `sm`: `8px`
- `md`: `12px`
- `base`: `16px`
- `lg`: `20px`
- `xl`: `24px`

### Layout Metrics
- **Left Sidebar:** `240px` fixed width (collapsible).
- **Outliner Node Indentation:** `24px` per hierarchy level.
- **Node Tree Guide Line:** `1px solid #222222` aligned at `12px` left offset of child container.
- **Panel Split:** Up to 3 side-by-side panels on desktop separated by a `1px solid #222222` vertical divider.

---

## 5. Border System

- All borders are strictly `1px solid`.
- **Zero radius:** `border-radius: 0 !important` on every element.
- Containers: `1px solid #222222`
- Interactive hover / focus: `1px solid #333333` shifting to `1px solid #ffffff` on active focus.

---

## 6. Component Library (Adapted for Hecate)

### 6.1 Outliner Node Row
The core unit of Hecate:
- **Bullet:** `16×16px` interactive touch target.
  - Dot: `5×5px` square (zero radius) `#888888` when empty; filled `#ffffff` when it has children.
  - Hover: border `1px solid #ffffff`.
  - Zoom trigger on click.
- **Chevron (Expand/Collapse):** `14×14px` square button with Lucide `chevron-right` (rotated 90deg when expanded). Hidden or dimmed when leaf node.
- **Checkbox (Optional/Done):** `14×14px` square box, `1px solid #333333`, background `transparent`. When checked: `1px solid #338833`, inner `6×6px` green square mark. Strikethrough node content with opacity `0.5`.
- **Content Editor:** Inline TipTap instance when focused; static zero-latency HTML when unfocused.
- **Hover Toolbar:** Appears on node hover:
  - Add child (`plus`)
  - Add field (`tag`)
  - Run command (`terminal`)
  - More options (`more-horizontal`)

### 6.2 Supertag Chip
```
┌─[#] TASK ──────────────────────┐
│ 1px left accent (#22c55e)      │
│ bg: #111111, border: 1px #333 │
│ 11px uppercase, font-weight 500│
└────────────────────────────────┘
```
- Clicking opens the tag options popover (Open Tag Definition, View Instances, Remove Tag).

### 6.3 Inline Universal References (`[[node:...]]`)
- Renders as a sharp inline chip:
  - `border: 1px solid #333333`
  - `background: #141414`
  - Lucide icon `link-2` at `11px` + target node title
  - Hover: `border-color: #ffffff`, reveals preview card showing target node's content and direct children.
  - Click: zoom into node. `Cmd+Click`: open in side panel.

### 6.4 Field Row (`Name:: value`)
- Appears indented beneath the parent node or in the pinned fields strip:
  - Left column (`120px` width): field label uppercase `10px`, letter-spacing `1.5px`, color `#555555`, separated by `::`.
  - Right column: inline editor, options dropdown, date picker, or node reference autocomplete.
  - All form controls zero-radius with `1px solid #333333` border.

### 6.5 Command Palette / Omnibar (`Cmd+K`)
- Center modal, max width `640px`.
- Sharp border `1px solid #333333`, background `#0a0a0a`.
- Top row: terminal prompt `>` with search input in `#ffffff`, `14px`.
- Section groups: `NODES`, `COMMANDS`, `TAGS`, `NAVIGATION` with `10px` uppercase headers and `letter-spacing: 2px`.
- Items have crisp keyboard shortcut tags: e.g. `[CMD+T]`, `[ENTER]`.

### 6.6 Views
Hecate renders nodes, searches, and tag instances in 4 primary views:
1. **List (Outliner):** Canonical infinite-nesting tree with bullets and chevrons.
2. **Table:** Precision data grid with `1px solid #222222` gridlines, `#111111` header row with sort indicators, inline-editable cells.
3. **Cards (Kanban):** Columns grouped by an Options field (e.g., Status: Inbox / Doing / Done). Zero-radius cards with `1px solid #222222` borders and drag-to-move status updates.
4. **Calendar:** Crisp monochrome month/week grid with day numbers in `#555555` and zero-radius event chips.

### 6.7 Hero Mini-Task Coach Card
Inspired by the One Chess Hero CTA Card:
- Surface: `#ffffff` inverted or obsidian `#111111` with `1px solid #333333` frame.
- Category tag: `10px` uppercase, `letter-spacing: 2px`, color `#888888`.
- Title: `18px`, medium `500`, `#ffffff` (or `#000000` if inverted).
- Rationale quote: `12px`, color `#888888`.
- Action buttons:
  - **Start Timer:** Countdown timer displaying `MM:SS` with a determinate progress track (`2px solid #333333`).
  - **Done:** Marks complete, emits success feedback.
  - **Snooze:** Delays until tomorrow.
  - **Save as #task:** Converts mini-task to an actual node in the workspace.

### 6.8 Terminal Loader & Progress (`AppLoader`)
- **Mode A (Determinate):** `2px` track `#222222`, fill `#ffffff`, tabular progress `n / total`.
- **Mode B (Terminal Cursor):** Monospace blinking block cursor `█` `#888888` next to status label.
- **Mode C (Pulse):** Element opacity breathes `0.4 → 1.0` (625ms).
- Strictly **no circular spinners**.

---

## 7. Motion & Interaction

- No spring, bounce, or decorative easing.
- Button press: `transform: scale(0.98)`, duration `0.1s`.
- Hover transitions: `0.15s ease-out` on border color and text color.
- View transitions: Instant cut. No slide, fade, or flip animations.

---

## 8. Lucide Icon Specification

- All icons are from Lucide (`lucide-react`).
- `stroke-width: 2`
- `stroke-linecap: round`, `stroke-linejoin: round`
- `fill: none`
- Standard sizes:
  - Inline / tree icons: `14×14px`
  - Action buttons / list icons: `16×16px`
  - Header / modal icons: `18×18px`

---

## 9. Non-Negotiable Checklist for Every Screen and Component

- [ ] Zero radius (`border-radius: 0`) on every container, button, input, popover, and badge.
- [ ] Background is `#0a0a0a` or `#111111`.
- [ ] No gradients or drop shadows.
- [ ] Borders are strictly `1px solid`.
- [ ] Section labels are `10–11px` uppercase with `letter-spacing: 2px`.
- [ ] Buttons are uppercase with `letter-spacing: 1.5px`.
- [ ] Font weights are strictly `400` (regular) or `500` (medium).
- [ ] All icons use Lucide with `stroke-width: 2`.
- [ ] No circular spinners — use `AppLoader` terminal cursor or determinate bar.
