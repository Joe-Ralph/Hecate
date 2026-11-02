  # One Chess — Master Design System

  > **Version:** 1.2  
  > **Scope:** All screens, components, and flows across the One Chess mobile app  
  > **Intent:** Any AI system or designer reading this file must be able to produce a new screen that is indistinguishable in style from any existing screen.

  ---

  ## 1. Design Philosophy

  ### Core Principle: Brutal Clarity
  Every element earns its place. If it does not communicate information or enable an action, it does not exist. No decoration, no softness, no ornamentation.

  ### Aesthetic Direction: Terminal Brutalism
  The visual language draws from Bloomberg terminals, high-end editorial print, and brutalist architecture. The UI feels like a precision instrument — cold, sharp, authoritative. Chess itself is a game of sharp logic, and the interface reflects that.

  ### Three Laws
  1. **Zero radius.** No rounded corners anywhere, ever. Every container, button, input, and card is sharp.
  2. **Monochrome only.** Black, white, and grays. No color for decoration — only for critical semantic states (errors, warnings).
  3. **Typography does the heavy lifting.** Hierarchy, spacing, weight, and letter-spacing replace color and decoration as design tools.

  ---

  ## 2. Color System

  ### Base Palette

  | Role | Value | Usage |
  |------|-------|-------|
  | App background | `#0a0a0a` | Every screen background |
  | Surface / section bg | `#111111` | Cards, strips, inset sections |
  | Border default | `#222222` | All container borders |
  | Border emphasis | `#333333` | Interactive element borders, dividers |
  | Text primary | `#ffffff` | Headings, values, active labels |
  | Text secondary | `#888888` | Descriptive subtext |
  | Text muted | `#555555` | Section labels, placeholders |
  | Text disabled | `#444444` | Empty states |
  | Inverted surface | `#ffffff` | Hero CTAs only — white background |
  | Inverted text | `#000000` | Text on inverted (white) surfaces |

  ### Semantic Color (Use Sparingly)
  Only for communicating status — never for decoration.

  | State | Border | Text | Background |
  |-------|--------|------|------------|
  | Error / loss | `#cc3333` | `#cc3333` | transparent |
  | Success / win | `#336633` | `#336633` | transparent |
  | Warning / caution | `#886622` | `#886622` | transparent |

  ### Rules
  - Never use blue, purple, amber, pink, or teal anywhere in the app.
  - Semantic colors appear as text or `1px` left-border accents only — never as filled backgrounds.
  - The only sanctioned white-filled surfaces are the Hero CTA card (§6.2), the chess clock cell (§6.2.1), and the evaluation bar's white segment (§6.2.2). No other white surface is permitted.

  ---

  ## 3. Typography

  ### Font Family
  ```
  font-family: system-ui, -apple-system, 'Helvetica Neue', sans-serif
  ```
  Use the native system font. No Google Fonts. No custom font loading.

  ### Weight Scale
  Only two weights exist in this system:

  | Weight | Value | Usage |
  |--------|-------|-------|
  | Regular | `400` | Body text, subtitles, descriptions |
  | Medium | `500` | Headings, values, button labels |

  **Never use `600`, `700`, `800`, or `900`.** Heavy weights break the refined tension of the design.

  ### Type Scale

  | Role | Size | Weight | Color | Letter-spacing | Transform |
  |------|------|--------|-------|----------------|-----------|
  | Screen heading | `20–22px` | 500 | `#fff` | `0` | none |
  | Section value (stats) | `18px` | 500 | `#fff` | `0` | none |
  | List item title | `13px` | 500 | `#fff` | `0` | none |
  | Body / description | `12–13px` | 400 | `#888` | `0` | none |
  | Section label | `10–11px` | 400 | `#555` | `2px` | uppercase |
  | Button label | `11–12px` | 500 | inherited | `1.5px` | uppercase |
  | Caption / meta | `10px` | 400 | `#444–#555` | `1px` | uppercase |
  | Empty state | `11px` | 400 | `#444` | `1px` | uppercase |

  ### Typography Rules
  - **Section labels are always uppercase with `letter-spacing: 2px`.** This is the primary visual rhythm device.
  - **Button labels are always uppercase with `letter-spacing: 1.5px`.**
  - **Headings use sentence case.** Only labels and buttons use uppercase.
  - Font size never goes below `10px`.
  - Line height for multi-line headings: `1.2`. For body text: `1.5`.

  ---

  ## 4. Spacing System

  ### Base Unit: 4px

  | Token | Value | Usage |
  |-------|-------|-------|
  | xs | `4px` | Icon gaps, tight inline spacing |
  | sm | `8px` | Internal component padding |
  | md | `12px` | Between sibling sections |
  | base | `16px` | Screen horizontal padding, component padding |
  | lg | `20px` | Large section padding |
  | xl | `24px` | Hero card padding, section top spacing |

  ### Screen Layout
  - **Horizontal screen padding:** `16px` on all sides, always
  - **Vertical gap between sections:** `12px`
  - **No full-bleed elements** except the status bar and bottom navigation

  ---

  ## 5. Border System

  ### Border Style
  All borders are `1px solid`. No `0.5px`. No `2px`. Always `1px`.

  | Context | Color |
  |---------|-------|
  | Container / card outer border | `#222` |
  | Internal dividers (rows, columns) | `#222` |
  | Interactive element border (buttons, inputs) | `#333` |
  | Emphasis / active border | `#fff` |
  | Section divider line decoration | `#333` |

  ### Border Radius
  **`border-radius: 0` everywhere.** No exceptions. This includes:
  - Buttons
  - Cards and containers
  - Input fields
  - Icon boxes
  - Avatar / profile images (use square crops)
  - Bottom sheets or modals if used

  ---

  ## 6. Component Library

  ### 6.1 Screen Header

  Every screen has a two-row top bar:

  ```
  [Small uppercase label in #555]     [28×28 square icon box, 1px #333 border]
  [Screen title, 18–20px, white, 500]
  ```

  - Padding: `16px 20px 12px`
  - The icon box contains a Lucide chess piece icon (`chess-king` by default) at `18px`, color `#888`
  - Separated from content by `border-bottom: 1px solid #222`

  ---

  ### 6.2 Hero CTA Card

  Used on the Home screen and any primary-action screen:

  - Background: `#ffffff` (the only white surface)
  - Padding: `24px 22px`
  - Margin: `0 16px`
  - No border radius
  - Optional: faint SVG grid lines (15px spacing, `opacity: 0.06`) absolutely positioned on the right half

  **Content stack:**
  1. Tag label — `11px`, `letter-spacing: 2px`, uppercase, `#999`, `margin-bottom: 10px`
  2. Heading — `22px`, weight `500`, `#000`, `line-height: 1.2`
  3. CTA button — black fill `#000`, white text, `12px`, `letter-spacing: 1.5px`, uppercase, padding `12px 22px`, zero radius

  ---

  ### 6.2.1 Sanctioned exception — clock cell

  The chess clock UI uses inverse-color cells (white side: `#ffffff` background with `#000000` digits; black side: `#0a0a0a` background with `#ffffff` digits). This is the only place in the app, besides the Hero CTA card, where a white-filled surface is permitted. Rationale: mirroring physical chess-clock convention is the strongest UX signal for "whose clock is running" without introducing a non-monochrome accent. Active state still uses a `1px solid #ffffff` outline; low-time state uses a `1px solid #cc3333` left-border accent and red text — never a red fill.

  This exception applies only to `ClockStrip` / `_ClockCell` and may not be reused for other surfaces.

  ---

  ### 6.2.2 Sanctioned exception — evaluation bar

  The evaluation bar (`EvaluationBar`, `lib/presentation/widgets/game/evaluation_bar.dart`)
  renders the white player's winning share as a `#ffffff` fill segment over a
  `#111111` track. This is a white-filled surface and is the **third** sanctioned
  exception, alongside the Hero CTA card (§6.2) and the clock cell (§6.2.1).

  Rationale: the bar maps the position's win probability (sigmoid of the
  white-POV engine score) to a white/black split — white's portion *is* white,
  black's *is* black. This mirrors the universal chess-clock / eval-bar
  convention (chess.com, Lichess) and is the strongest "who is winning" signal
  without introducing a non-monochrome accent. As with §6.2.1, the white fill
  encodes the white player and nothing else.

  Constraints:
  - White fill permitted **only** for the white-player segment of
    `EvaluationBar`. Not reusable for any other surface.
  - Track `#111111`, border `1px solid #333`, zero radius. Loading state
    `#222222`. No gradient, no shadow.
  - Advantage is never communicated with red/green fills — the §2 semantic-color
    rules still hold. The numeric label uses the §3 caption scale
    (`11px`, weight 500, muted grays).
  - Fill transitions animate (300 ms ease-out) to slide the value into place —
    functional motion communicating a continuously varying quantity, no
    spring/bounce (§8).

  ---

  ### 6.3 Stats Row

  Horizontal metric strip for summary numbers:

  - Outer border: `1px solid #222`
  - Margin: `0 16px`
  - Columns separated by `1px solid #222` vertical dividers
  - **Two or three columns only** — never four

  Each cell:
  ```
  [Metric value — 18px, weight 500, #fff]
  [Label — 10px, uppercase, letter-spacing 1px, #555]
  ```
  Padding per cell: `14px 12px`

  ---

  ### 6.4 Action List

  The primary navigation pattern for lists of actions:

  - Outer border: `1px solid #222`
  - Margin: `0 16px`
  - Each row: `border-bottom: 1px solid #222` (except last)
  - Row padding: `16px`
  - Row height: ~52px

  **Each row contains:**

  Left cluster (flex row, gap `12px`):
  - Icon box: `28×28px`, `1px solid #333` border, Lucide chess piece icon at `16px` color `#888`, centered
  - Text stack: title `13px` weight `500` white / subtitle `11px` color `#555`

  Right: `lucide:chevron-right` at `16×16px`, color `#555`

  **Hover state:** `border-color: #666`, text `#fff`

  ---

  ### 6.5 Outlined Strip

  For secondary actions or info rows (e.g. Daily Puzzle):

  - Outer: `1px solid #333`, margin `0 16px`, padding `16px`
  - Two-column flex, `space-between`, center aligned
  - Left: label stack (uppercase tag + title)
  - Right: outlined button — `1px solid #fff`, transparent bg, white text, uppercase, `letter-spacing: 1.5px`, padding `8px 16px`

  ---

  ### 6.6 Section Divider Header

  Replaces conventional section headings:

  ```
  [LEFT: uppercase label, 10px, #555, letter-spacing 2px]   [RIGHT: 40px × 1px line, #333]
  ```

  Flex row, `space-between`, padding `8px 16px 6px`.

  ---

  ### 6.7 Empty State

  Used when a list or section has no content:

  - Container: `1px solid #222`, padding `20px`, centered content
  - Text only: `11px`, `letter-spacing: 1px`, uppercase, `#444`
  - No icons, no illustrations, no placeholder images

  ---

  ### 6.8 Primary Button (Inverted)

  Used inside the Hero Card:

  ```
  background: #000
  color: #fff
  border: none
  padding: 12px 22px
  font-size: 12px
  letter-spacing: 1.5px
  text-transform: uppercase
  border-radius: 0
  ```

  ---

  ### 6.9 Secondary Button (Outlined)

  Used for secondary CTAs on dark backgrounds:

  ```
  background: transparent
  color: #fff
  border: 1px solid #fff
  padding: 8px 16px
  font-size: 11px
  letter-spacing: 1.5px
  text-transform: uppercase
  border-radius: 0
  ```

  ---

  ### 6.10 Ghost Button (Muted)

  Used for tertiary/navigation actions:

  ```
  background: transparent
  color: #aaa
  border: 1px solid #333
  padding: 8px 14px
  font-size: 11px
  letter-spacing: 1.5px
  text-transform: uppercase
  border-radius: 0
  ```

  Hover: `border-color: #666`, `color: #fff`

  ---

  ### 6.11 Input Field

  ```
  background: #111
  color: #fff
  border: 1px solid #333
  padding: 12px 14px
  font-size: 13px
  border-radius: 0
  ```

  Focus: `border-color: #fff`
  Placeholder: `color: #444`
  Label above input: `10px`, uppercase, `letter-spacing: 2px`, `#555`, `margin-bottom: 6px`

  ---

  ### 6.12 Textarea (PGN / FEN Input)

  Same as Input Field but:
  - `min-height: 100px`
  - `font-family: monospace`
  - `font-size: 12px`
  - `line-height: 1.6`
  - `resize: vertical`

  ---

  ### 6.13 Bottom Navigation Bar

  - `border-top: 1px solid #222`
  - Background: `#0a0a0a`
  - Padding: `16px 0 24px` (extra bottom for safe area)
  - Three equal-width tabs

  Each tab (flex column, center, gap `4px`):
  - Icon: SVG `18×18px`, fill `#fff`
  - Label: `9px`, `letter-spacing: 1.5px`, uppercase, `#fff`
  - Active: `opacity: 1`
  - Inactive: `opacity: 0.3`
  - No indicator bar, no background highlight — opacity is the only state signal

  **Tab icons — Lucide only:**
  - Home: `house`
  - Learn / Lessons: `book-open`
  - Profile: `user`

  ---

  ### 6.14 Chess Piece Icon Box

  Used as a visual identifier in lists, headers, and cards:

  ```
  width: 28px (list) or 36px (header)
  height: same
  border: 1px solid #333
  background: transparent
  display: flex
  align-items: center
  justify-content: center
  border-radius: 0
  ```

  Content: Lucide chess piece icon (see Section 9 Chess Piece Icon Map). Size `16px` for 28px box, `18px` for 36px box. Color `#888` on dark surfaces.

  ---

  ### 6.15 Chess Board

  When a board is rendered:

  - 8×8 grid, `border: 1px solid #333`
  - Light squares: `#e8e8e8`
  - Dark squares: `#444444`
  - Selected square: `outline: 2px solid #fff`, `outline-offset: -2px`
  - Last move highlight: from-square `#666`, to-square `#555`
  - Legal move hint: `#888`
  - File labels (a–h): `10px`, `#555`, centered below columns
  - Rank labels (1–8): `10px`, `#555`, to the left of rows
  - No border radius on any square

  ---

  ### 6.15.1 Board heuristic/analysis overlay — sanctioned color exception

  Heuristic/engine analysis marks drawn **on a chess board surface** may use a
  fixed semantic palette, applied **only** to board marks (chessground
  `Arrow`/`Circle`, or the equivalent CustomPaint layer). This applies to every
  board that renders analysis: live game, game review/evaluation, daily puzzle,
  lessons, deep analysis, and mistake review.

  | Role | Hex | Meaning |
  |------|-----|---------|
  | bestMove / hint | `#22c55e` | Engine best move / "play this" guidance |
  | threat | `#ef4444` | Danger / threat to you — material is being taken |
  | stuck | `#f97316` | Your piece is immobilised: no safe square, but nothing is capturing it this move |
  | caution | `#eab308` | King safety / weak square |
  | chance | `#3b82f6` | Positional / opportunity / pawn |
  | neutral | `#888888` | Generic highlight (monochrome) |

  **Geometry (Phase 1):** marks are slim and translucent — arrow shaft ≈ 15% of
  a square (chessground `scale` ≈ 0.62, vs the default 0.25-of-a-square), with
  the `bestMove` mark slightly larger so it leads the eye (Von Restorff). All
  arrows share the same ~0.60 alpha (`0x99`): no green arrow reads as solid; the
  green cue leads by shaft width, not opacity. A future Phase 2 adds arrowhead
  edge-trim (never occlude the target piece) and taper via a CustomPaint layer;
  the contract below is unchanged.

  **Single authority — merge-blocker rule:** screens must **not** construct raw
  chessground `Arrow()`/`Circle()`. All board marks go through `BoardMarks`
  (`BoardMark` + `BoardMarkRole`, `board_mark_renderer.dart`). This keeps color
  and geometry uniform across every board in the app.

  `threat` and `stuck` are a deliberate pair. They were the same red until a
  player read a trapped-but-safe rook as "this is attacked" (live report
  2026-08-11): red means the loss is happening, orange means the piece cannot
  move. A surface that renders one must render the other — collapsing them back
  into a single colour is the bug, not a simplification.

  **The one off-board use — the key swatch.** A surface that names a mark in
  words (the Replay cue cards, the cue filter popup's colour key, the live cue
  popup) may draw one 8×8px square of that mark's colour beside the label, so
  the word and the on-board mark can be matched by eye. That swatch is the only
  sanctioned appearance of these colours away from a board. Everything else
  holds: they never appear as fills, backgrounds, text, or borders, and never
  outside a board surface. Motif **type** is encoded by shape (arrow =
  move/relation, ring = piece/square state) and dash, not by extra colors. The
  legend and layer-toggle chips use the standard monochrome components (§6.10
  ghost-button geometry, §3 section-label type) — only the on-board marks carry
  color. Like the §6.2.1 clock-cell exception, this carve-out may not be reused
  for any non-board surface.

  ---

  ### 6.16 Loader / Progress Indicator

  The single sanctioned "working" indicator is `AppLoader`
  (`lib/presentation/widgets/feedback/app_loader.dart`). It has three modes.

  | Mode | Constructor | Use when | Motion |
  |------|-------------|----------|--------|
  | **A — Determinate** | `AppLoader.determinate(label, current, total)` | The total is known (engine analysis, counted export) | Bar fills by real progress; `n / total` shown |
  | **B — Terminal cursor** | `AppLoader.indeterminate(label, icon?)` | Duration unknown and layout has room | Label + blinking block cursor `█` |
  | **C — Pulse** | `AppLoader.pulse(child)` | Space-constrained / inline; must add no layout | Wrapped child breathes opacity `0.4 → 1.0`, ~625ms |

  **Selection rule:** A when the total is known. B is the universal fallback.
  C when space is constrained and the loader must add no layout.

  **Tokens:** surface `#111`, border `#222`, caption `10px` / `#555` /
  `letter-spacing 1.5` / uppercase, count `#888` tabular, track `2px` `#1d1d1d`,
  fill `#888`, cursor `█` `#888`. Zero radius, monochrome only.

  **Merge-blocker:** screens must **not** build `CircularProgressIndicator`, any
  spinner, or a bespoke loader. Every "working" state goes through `AppLoader`
  (or `DsStatusText` for plain, motionless centered status text). This mirrors
  the single-authority rule of §6.15.1.

  ---

  ## 7. Screen Layout Template

  Every screen follows this structure top to bottom:

  ```
  ┌─────────────────────────────────┐
  │  Status Bar (14px top padding)  │
  ├─────────────────────────────────┤
  │  Screen Header (title + icon)   │
  │  border-bottom: 1px solid #222  │
  ├─────────────────────────────────┤
  │  Primary content area           │
  │  (Hero Card, Board, Form, etc.) │
  │  margin: 0 16px                 │
  ├─────────────────────────────────┤
  │  Secondary content blocks       │
  │  (Stats Row, Action List, etc.) │
  │  margin: 12px 16px              │
  ├─────────────────────────────────┤
  │  Bottom Navigation Bar          │
  │  border-top: 1px solid #222     │
  └─────────────────────────────────┘
  ```

  ---

  ## 8. Motion & Interaction

  ### Philosophy
  Interactions are functional, not theatrical. No animations for aesthetics.

  ### Rules
  - **No page transition animations** — screens cut, not slide or fade
  - **No bouncing, elastic, or spring animations**
  - **Button press:** `transform: scale(0.98)`, `transition: 0.1s`
  - **Border hover:** `border-color` shifts `#333 → #666`, `transition: 0.15s`
  - **Text color hover:** `color: #aaa → #fff`, `transition: 0.15s`
  - **No ripple effects**
  - **No loading spinners** — use `AppLoader` (§6.16): determinate bar, terminal cursor, or pulse. Plain text states render in `#555` uppercase

  ---

  ## 9. Iconography

  ### Single Source of Truth: Lucide Icons

  **All icons across the entire app — UI icons and chess piece icons — come exclusively from Lucide.** No custom SVGs, no unicode chess characters, no emoji, no other icon libraries.

  Lucide is the single icon library for One Chess because:
  - Every icon shares identical `stroke-width: 2`, `stroke-linecap: round`, `stroke-linejoin: round` geometry
  - Chess piece icons (`chess-king`, `chess-queen`, etc.) exist natively and share the same stroke language as UI icons
  - Available on the approved CDN: `https://cdn.jsdelivr.net/npm/lucide@latest`

  ### CDN Import (Web / Flutter WebView)
  ```html
  <script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js"></script>
  ```
  Then instantiate: `lucide.createIcons()`  
  Usage: `<i data-lucide="chess-king"></i>`

  ### Flutter Import
  ```yaml
  # pubspec.yaml
  dependencies:
    lucide_icons: ^0.3.0
  ```
  Usage: `Icon(LucideIcons.chessKing)`

  ---

  ### Icon Size Scale

  | Context | Size | Color |
  |---------|------|-------|
  | Inline / list row | `16×16px` | `#555` |
  | Action list icon box | `16×16px` | `#888` |
  | Bottom nav bar | `20×20px` | `#fff` (active) / `#fff` at 30% opacity (inactive) |
  | Screen header icon box | `18×18px` | `#888` |
  | Decorative / hero | `24×24px` max | `#fff` or `#000` depending on surface |

  **Never scale an icon outside this table.** Consistency in sizing is as important as the icon source.

  ---

  ### Stroke Configuration

  All Lucide icons are rendered with:
  ```
  stroke-width: 2
  stroke-linecap: round
  stroke-linejoin: round
  color: (see size scale table above)
  fill: none
  ```

  Do not override `stroke-width`. Do not change to `fill` style. Lucide is an outline icon set — keep it that way throughout.

  ---

  ### UI Icon Map

  Every recurring UI action maps to a fixed Lucide icon. Never substitute a different icon for these:

  | Action / Concept | Lucide Icon Name |
  |-----------------|-----------------|
  | Navigate right / chevron | `chevron-right` |
  | Navigate left / back | `chevron-left` |
  | Home tab | `house` |
  | Lessons / Learn tab | `book-open` |
  | Profile tab | `user` |
  | Analyze / search | `search` |
  | Import / upload | `upload` |
  | Settings | `settings` |
  | Play / start | `play` |
  | Daily puzzle | `target` |
  | Win / success | `trophy` |
  | Clock / time | `clock` |
  | Move history | `list` |
  | Undo move | `undo-2` |
  | Redo move | `redo-2` |
  | Flip board | `flip-vertical-2` |
  | AI / coach hint | `cpu` |
  | Copy to clipboard | `copy` |
  | Share | `share-2` |
  | Close / dismiss | `x` |
  | Confirm / check | `check` |
  | Warning | `triangle-alert` |
  | Error | `circle-x` |
  | Info | `info` |

  ---

  ### Chess Piece Icon Map

  Every chess piece maps to a fixed Lucide icon. Used inside icon boxes, on the board piece selector, and in lesson content:

  | Piece | Lucide Icon Name |
  |-------|-----------------|
  | King | `chess-king` |
  | Queen | `chess-queen` |
  | Rook | `chess-rook` |
  | Bishop | `chess-bishop` |
  | Knight | `chess-knight` |
  | Pawn | `chess-pawn` |

  Chess piece icons render at `16px` inside a `28×28px` icon box and at `18px` inside a `36×36px` header icon box. Color is always `#888` on dark surfaces or `#333` on the white hero card.

  ---

  ### Icon Box Component (updated)

  The icon box that wraps chess piece icons in lists and headers:

  ```
  width: 28px (list) or 36px (header)
  height: same
  border: 1px solid #333
  background: transparent
  display: flex
  align-items: center
  justify-content: center
  border-radius: 0
  ```

  Content: Lucide chess piece icon at `16px` (list) or `18px` (header), color `#888`.

  No unicode characters. No emoji. Lucide only.

  ---

  ## 10. What to Never Do

  This list is as important as the rules above. Any violation breaks the design language.

  | Never | Because |
  |-------|---------|
  | `border-radius` > 0 | Softness contradicts the brutalist aesthetic |
  | Any non-gray color for decoration | Color is reserved for semantic meaning only |
  | `font-weight` 600+ | Creates visual heaviness inconsistent with the refined tension |
  | Gradient on any surface | Decoration without meaning |
  | Drop shadow or box shadow | Elevation is not a concept in this system |
  | Emoji in UI elements | Use Lucide icons only |
  | Any icon library other than Lucide | Breaks stroke-weight and geometry uniformity |
  | Custom hand-drawn SVG icons | Inconsistent with Lucide stroke system |
  | Unicode chess characters | Replaced by Lucide chess piece icons for uniformity |
  | Font size below `10px` | Legibility minimum |
  | Uppercase for body text | Only labels and buttons are uppercase |
  | Colored backgrounds on cards | Only `#0a0a0a`, `#111`, `#fff` (hero only) |
  | More than 3-column grids | Density limit at 380px mobile width |
  | Slide / fade screen transitions | Screens cut — no animation |
  | Background images or textures | Use SVG line grids sparingly (opacity < 0.08) |
  | Filled colored badges or pills | No rounded pill shapes and no color fills |
  | `CircularProgressIndicator` / any spinner | Use `AppLoader` (§6.16) — spinners violate §8 |

  ---

  ## 11. Voice & Copy Style

  - App name: **One Chess** (title case, always)
  - CTA labels: short, active, uppercase. e.g. `"Play now"`, `"Solve"`, `"Analyze"`, `"Import"`
  - Section labels: single noun, uppercase. e.g. `"Actions"`, `"Recent"`, `"Stats"`
  - Empty states: declarative, lowercase with uppercase transform applied by CSS. e.g. `"No games yet"`, `"No moves recorded"`
  - Error messages: factual, no apology. e.g. `"Invalid PGN format"`, `"Connection failed"`
  - Append `↗` to any button that triggers an external action or AI response

  ---

  ## 12. Checklist for New Screens

  Before completing any new screen design, verify:

  - [ ] All corners are `border-radius: 0`
  - [ ] Background is `#0a0a0a`
  - [ ] No color used outside semantic error/success states
  - [ ] All section labels are `10–11px`, uppercase, `letter-spacing: 2px`, color `#555`
  - [ ] Font weights are only `400` or `500`
  - [ ] All buttons are uppercase with `letter-spacing: 1.5px`
  - [ ] All borders are `1px solid` in `#222` or `#333`
  - [ ] Bottom navigation is present and consistent with 3 tabs
  - [ ] Screen header follows the two-row pattern with icon box
  - [ ] No gradients, shadows, or decorative effects
  - [ ] Empty states use text-only treatment
  - [ ] All icons are Lucide — no custom SVGs, no unicode chess characters, no emoji
  - [ ] Chess pieces use Lucide chess piece icons (`chess-king`, `chess-queen`, etc.)
  - [ ] All Lucide icons use `stroke-width: 2`, `fill: none`

  ---

  *This document is the single source of truth for One Chess UI/UX. Any screen designed outside these constraints is out of spec.*