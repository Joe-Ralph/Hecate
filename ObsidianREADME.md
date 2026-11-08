# Graph View, Reverse-Engineered — a Complete Implementation Guide

This document explains exactly how the **Obsidian 1.15.0 core "Graph view" plugin** works, piece by
piece, and gives you clean, dependency-light TypeScript code to implement the same thing — a
zoomable, force-directed, *fractal-feeling* knowledge graph with color groups, filters, a local
(ego-centric) graph, and a timelapse animation — in your own app.

> **Provenance / legalese.** Obsidian is closed-source commercial software. Everything below was
> derived from **static analysis of the shipped artifact** (`Obsidian-1.15.0.exe`, sha256
> `b0f60c75…e1da0`) using the REA (Reverse Engineer Anything) toolkit. Code samples in this
> document are *original re-implementations* of the observed algorithms and constants — not
> copies of Obsidian's source. Observed facts are cited with their location in the shipped files
> (`app.js` byte offsets, `sim.js`, `app.css`) so you can verify every claim.

---

## 1. How the analysis was done (and how to verify it)

1. `Obsidian-1.15.0.exe` is a 339 MB **NSIS installer** (PE32, Nullsoft self-extracting archive),
   not the app itself. Its 7z payload (offset `217722`, LZMA2) contains the standard
   electron-builder layout: the Electron runtime DLLs plus `resources/app.asar` (73 KB launcher)
   and `resources/obsidian.asar` (24.5 MB — the entire app).
2. `obsidian.asar` (sha256 `0e638330…7248`) contains 395 files. The interesting ones:
   | file | size | role |
   |---|---|---|
   | `app.js` | 3.37 MB | the whole renderer bundle, webpack-minified |
   | `sim.js` | 17.7 KB | the force-simulation **Web Worker** (unminified d3-force + WASM) |
   | `app.css` | 598 KB | theme + graph styles |
   | `main.js` | 212 KB | Electron main process |
   | `worker.js` | 250 KB | metadata-resolution worker |
3. The graph plugin lives in `app.js` between byte offsets **2126598 and ~2400000** (search for
   `ff=class` at `2133658`, `"graph"` plugin class at `2379442`, `MI=class` data engine at
   `2380711`, `oDe` graph builder at `2390120`, color groups `GV=class` at `2395803`).
4. The force simulation shipped as a **dedicated worker** (`new Worker("/sim.js", {name:"Graph
   Worker"})`) and is readable almost verbatim — see §6.

Everything in this document is either (a) a directly observed fact with a file/offset citation,
or (b) an original implementation sample. Observed values (defaults, formulas, thresholds) are
quoted exactly.

---

## 2. Architecture at a glance

```
┌────────────────────────────────────────────────────────────────────┐
│ Renderer process (app.js)                                          │
│                                                                    │
│  GraphPlugin ("graph", id=SI)                                      │
│   ├─ registerViewType("graph",     GraphView)      ── global graph │
│   ├─ registerViewType("localgraph", LocalGraphView) ─ ego graph    │
│   └─ commands: graph:open (Ctrl/Cmd+G), graph:open-local,          │
│                graph:animate (timelapse)                           │
│                                                                    │
│  GraphView / LocalGraphView  (PIXI host, pane lifecycle, state)    │
│        │ owns                                                        │
│        ▼                                                           │
│  GraphDataEngine (MI) ── pure logic, no drawing                    │
│   • options (filters / color groups / display / forces)            │
│   • setQuery / search matcher queue (qn + _b)                      │
│   • render() → graph data { nodes, numLinks }  via oDe()           │
│   • local graph transform oV() (BFS to depth 1–5)                  │
│   • orphan pruning ehe() • timelapse progression                   │
│        │ setData({nodes, weights})                                 │
│        ▼                                                           │
│  GraphRenderer (ff) ── PIXI.Application, all drawing               │
│   • camera: pan / zoom / fling / pinch / keyboard                  │
│   • Node (tV): PIXI circle + PIXI.Text label                      │
│   • Link (iV): 1px white sprite stretched + arrow                  │
│   • lazy graphics init (≤50 nearest unrendered/frame), culling,    │
│     60 idle frames → sleeps                                        │
│        │ Worker postMessage                                        │
│        ▼                                                           │
│  /sim.js  (d3-force + hand-written WASM fast path)                 │
└────────────────────────────────────────────────────────────────────┘
```

**Key design decisions observed** (these are what make it feel "fractal but explorable"):

1. **Simulation runs in a Web Worker** — the main thread never pays for O(n log n) force math.
2. **Positions travel back through a versioned `SharedArrayBuffer`** (with an ArrayBuffer
   transferable fallback), so the worker never allocates per tick.
3. **Camera and physics are decoupled** — zoom never re-runs the layout; the layout is computed
   once in world space.
4. **Detail is a function of zoom**: node radius shrinks as `√(1/zoom)` relative to the world,
   labels fade out as `clamp(log₂(zoom) + 1 − fade, 0, 1)`. You get an infinite-feeling canvas
   where information appears as you zoom in — the "fractal" effect.
5. **Everything visual is incremental**: nodes/links are diffed on update, graphics objects are
   created lazily nearest-first, and rendering sleeps after 60 idle frames.

---

## 3. Feature inventory (what you are cloning)

Global graph view (`type:"graph"`):

- Force-directed layout, draggable nodes, pan/zoom (wheel, pinch, drag, arrow keys, +/- keys).
- Node types with distinct colors: normal, **unresolved** (dangling link), **tag**, **attachment**.
- **Search filter** with the full vault search syntax (`path:`, `tag:`, `line:`, `content:`,
  `file:`, `section:`, `[property]:`, `match-case`, `ignore-case` …) plus the same for tags and
  attachment filenames.
- **Color groups**: an ordered list of `(search query, color)` pairs; the first matching group
  wins and tints the node. Rows are drag-reorderable; "New group" auto-generates a palette.
- **Display options**: show arrows on links, label fade (−3 … +3), node size (0.1–5×),
  link thickness (0.1–5×).
- **Force options**: center force (0–1, transformed), repel force (0–20, cubed), link force
  (0–1, transformed), link distance (30–500 px).
- Hover highlight: hovered node + its neighbors stay opaque; everything else fades to 20%.
- Hover popover preview of the note; click opens the note; right-click opens the file menu;
  click a tag → global tag search.
- Copy-to-clipboard PNG screenshot (transparent or white background).
- **Timelapse animation** ("graph:animate", wand icon): replays graph growth, revealing nodes in
  creation-time order at a speed derived from the link count.
- Orphan nodes hidden by default (toggle "Show orphans").
- Keyboard: arrows pan (Shift = 3×), `+`/`-` zoom toward viewport center.

Local (ego) graph view (`type:"localgraph"`, opens for the active note):

- Everything above, plus: depth **1–5 hops**, include/exclude **backlinks**, **forelinks**,
  links **between neighbors**; the focused file gets a ring and weight 30; all options are saved
  per-leaf in the workspace layout.

Persistence:

- Global graph settings → core-plugin data file (JSON, via `plugin.saveData`).
- Local graph settings → the leaf's `state.options` in workspace layout.
- `scale` (zoom) and `close` (collapsed controls) are persisted with both.

---

## 4. Data model

### 4.1 Graph data (what `render()` produces and `setData()` consumes)

Observed in `oDe` (app.js `2390120`) and `setData` (app.js `2133658`):

```ts
type NodeType = "" | "tag" | "attachment" | "unresolved" | "focused";

interface GraphNodeData {       // "lu" factory, app.js 2126750
  type: NodeType;
  links: Record<string, true>;  // ids of outgoing edges (dedup via Set-like object)
  color?: { a: number; rgb: number } | null;  // first-matching color group
}

interface GraphData {
  nodes: Record<string, GraphNodeData>;
  numLinks: number;             // used only to derive timelapse speed
  weights?: Record<string, number>; // optional per-node weight (local graph uses it)
}
```

The renderer wraps each `GraphNodeData` in a `Node` (class `tV`) with runtime state:

```ts
interface Node {
  id: string;
  type: NodeType;
  x, y: number | null;          // world-space position from worker
  vx, vy: number;
  fx, fy: number | null;        // drag pin (sent to worker)
  forward: Record<string, Link>; // outgoing edge objects
  reverse: Record<string, Link>; // incoming edge objects
  weight: number;                // drives size; default = degree
  color: {a, rgb} | null;
  // rendering: PIXI circle graphics, PIXI.Text, fadeAlpha, …
}
```

Edges (`iV`) are derived objects `{source: Node, target: Node}` — stored once in a renderer-wide
`links[]` and indexed from both endpoints (`forward`/`reverse` maps).

### 4.2 Options object (exact observed defaults)

Filter defaults (`nV`, app.js `2126598`):

```js
{
  showAttachments: false,
  hideUnresolved: false,
  showOrphans: true,
  showTags: false,
  localFile: null,        // path when in local-graph mode
  localJumps: 1,          // ego depth, slider 1..5
  localInterlinks: false, // links between neighbors
  localForelinks: true,
  localBacklinks: true,
}
```

Display defaults (`rDe`, app.js `2384509` area): `{showArrow:false, textFadeMultiplier:0,
nodeSizeMultiplier:1, lineSizeMultiplier:1}`.

Force defaults (`nDe`): `{centerStrength: Nhe(.1,.01), repelStrength: 10, linkStrength:
Nhe(1,.01), linkDistance: 250}` — see §8.4 for the slider↔engine transforms (`Bhe`/`Nhe`).

Color groups: `colorGroups: [{query: "tag:#proj", color: {a:1, rgb: 0xRRGGBB}}, …]` — ordered,
first match wins, `null` color entries are *filters* (not paint).

---

## 5. The data engine (`MI`)

`render()` (app.js `2380711`) does, in order:

1. Early-out for local graph with no file (`setData({nodes:{}})`).
2. Build base data with `buildGraphData(metadataCache, options, filterFn, progression)`.
3. If local mode: `oV()` BFS-trims to the ego neighborhood and supplies `weights`.
4. If `!showOrphans`: `pruneOrphans()` (two passes: collect nodes that *are linked-to*; delete
   nodes with no *existing* neighbors and no incoming references — observed in `ehe`).
5. Mark the focused node `type="focused"` (accent ring + priority color).
6. `renderer.setData(graphData)`.

### 5.1 Filter/color semantics (observed exactly)

For each candidate node id `h` of kind `u`:

- `u === ""` (file): if a filter query exists → `fileFilter[h] ?? !hasFilter`; the local file
  itself always passes.
- `u === "tag"`: passes iff **every** plain (uncolored) query matches it as a tag
  (`query.matchTag(h)`).
- `u === "attachment"`: passes iff every plain query matches its filename.
- If any **colored** query matches, the node gets that color (first match wins); uncolored
  queries restrict visibility without painting.

The search itself stays responsive on the main thread by cooperative yielding: `_b()`
(app.js `1331074`) consumes an async queue (`qn`, a pausable generator with a 100 ms `maxDelay`
budget) reading file contents via `cachedRead`, and re-renders at most every ~333 ms while
matching — so a vault-wide filter never blocks input.

### 5.2 `buildGraphData` — sample implementation

```ts
interface BuildOptions {
  showAttachments: boolean; hideUnresolved: boolean; showOrphans: boolean; showTags: boolean;
}

export function buildGraphData(
  cache: {                       // your metadata index
    resolvedLinks: Record<string, Record<string, number>>;
    unresolvedLinks: Record<string, Record<string, number>>;
    tags: Record<string, string>;               // lowercase -> canonical
    getCache: (path: string) => { frontmatter?: any; tags?: {tag: string}[] } | null;
    getCachedFiles: () => string[];
    isUserIgnored: (path: string) => boolean;
  },
  vault: { getAbstractFileByPath(p: string): { stat: { ctime: number; mtime: number } } | null },
  opts: BuildOptions,
  accept: (id: string, type: NodeType) => boolean | { a: number; rgb: number },
  progression?: number,          // timelapse step: only first N "link events" are shown
): GraphData {
  const nodes: Record<string, GraphNodeData> = {};
  let linkCount = 0, lastIncluded = "";
  const files = cache.getCachedFiles();

  // Timelapse: process files in creation order
  if (progression) {
    const age: Record<string, number> = {};
    for (const f of files) {
      const af = vault.getAbstractFileByPath(f);
      age[f] = af ? Math.min(af.stat.ctime, af.stat.mtime) : Infinity;
    }
    files.sort((a, b) => age[a] - age[b]);
  }

  for (const path of files) {
    const isAttachment = isAttachmentPath(path);          // §5.5
    if (!opts.showAttachments && isAttachment) continue;
    const verdict = accept(path, isAttachment ? "attachment" : "");
    if (!verdict || cache.isUserIgnored(path)) continue;

    const node = (nodes[path] ??= { type: isAttachment ? "attachment" : "", links: {} });
    if (typeof verdict !== "boolean") node.color = verdict;

    for (const dest of Object.keys(cache.resolvedLinks[path] ?? {})) {
      const dAtt = isAttachmentPath(dest);
      if (!opts.showAttachments && dAtt) continue;
      if (!accept(dest, dAtt ? "attachment" : "")) continue;
      if (progression && linkCount >= progression) { lastIncluded = path; break; }
      node.links[dest] = true; linkCount++;
    }
    if (!opts.hideUnresolved) {
      for (const dest of Object.keys(cache.unresolvedLinks[path] ?? {})) {
        if (!accept(dest, "unresolved")) continue;
        if (progression && linkCount >= progression) { lastIncluded = path; break; }
        node.links[dest] = true; linkCount++;
        nodes[dest] ??= { type: "unresolved", links: {} };
      }
    }
    if (opts.showTags) {
      const c = cache.getCache(path);
      for (const t of c ? extractTags(c) : []) {           // frontmatter tags + inline tags
        if (!accept(t, "tag")) continue;
        const canon = cache.tags[t.toLowerCase()] ?? t;
        if (progression && linkCount >= progression) { lastIncluded = path; break; }
        node.links[canon] = true; linkCount++;
        nodes[canon] ??= { type: "tag", links: {} };
      }
    }
  }

  // Timelapse: drop files that come after the file where the budget ran out
  if (progression && lastIncluded) {
    const from = files.indexOf(lastIncluded);
    for (let i = from + 1; i < files.length; i++) delete nodes[files[i]];
  }
  return { nodes, numLinks: linkCount };
}

function extractTags(c: { frontmatter?: any; tags?: { tag: string }[] }): string[] {
  const out: string[] = [];
  const fm = c.frontmatter?.tags;                       // string | string[] | csv
  if (fm) out.push(...(Array.isArray(fm) ? fm : String(fm).split(",")));
  for (const t of c.tags ?? []) out.push(t.tag);
  return out;
}
```

(Verified against `oDe` including the tag-canonicalization map `d[E.toLowerCase()] || E` and the
`showOrphans` counter, which counts *processed* files for the timelapse cut.)

### 5.3 Local (ego) graph — BFS with per-hop weights (observed `oV`)

```ts
export function egoFilter(data: GraphData, opts: {
  localFile: string; localJumps: number; localBacklinks: boolean;
  localForelinks: boolean; localInterlinks: boolean;
}): GraphData {
  const nodes: Record<string, GraphNodeData> = {};
  const weights: Record<string, number> = {};
  const center = opts.localFile;

  if (!data.nodes.hasOwnProperty(center)) {
    nodes[center] = { type: "", links: {} };
    return { nodes, weights: { [center]: 30 } };
  }
  nodes[center] = { type: data.nodes[center].type, links: {} };
  weights[center] = 30;
  const step = 30 / opts.localJumps;

  for (let hop = 0; hop < opts.localJumps; hop++) {
    const frontier: Record<string, GraphNodeData> = {};
    for (const f in data.nodes) {
      if (data.nodes[f].type === "tag") continue;      // tags never expand the neighborhood
      for (const b in data.nodes[f].links) {
        const srcIn = nodes.hasOwnProperty(f), dstIn = nodes.hasOwnProperty(b);
        if (opts.localForelinks && srcIn && !dstIn)
          (frontier[b] ??= cloneNode(data.nodes[b])).links[f] = true, nodes[f].links[b] = true;
        else if (opts.localBacklinks && dstIn && !srcIn)
          (frontier[f] ??= cloneNode(data.nodes[f])).links[b] = true;
      }
    }
    for (const f in frontier) { nodes[f] = frontier[f]; weights[f] = 30 - step * (hop + 1); }
  }

  if (opts.localInterlinks)                       // keep original edges between kept nodes
    for (const f in nodes)
      if (data.nodes.hasOwnProperty(f)) nodes[f] = cloneNode(data.nodes[f]);

  return { nodes, weights };
}
const cloneNode = (n: GraphNodeData): GraphNodeData => ({
  type: n.type, color: n.color, links: { ...n.links },
});
```

The center weight of **30** (vs. default weight = degree) makes the open note visually dominant;
hop weights `30 − (30/jumps)·(hop+1)` gently shrink outer rings.

### 5.4 Orphan pruning (observed `ehe`)

```ts
export function pruneOrphans(g: GraphData): void {
  const linkedTo: Record<string, true> = {};
  for (const id in g.nodes)
    for (const l in g.nodes[id].links) if (l !== id) linkedTo[l] = true;
  for (const id in g.nodes) {
    const links = g.nodes[id].links;
    const hasExistingNeighbor = Object.keys(links).some(l => g.nodes.hasOwnProperty(l) && l !== id);
    if (!hasExistingNeighbor && !linkedTo[id]) delete g.nodes[id];
  }
}
```

### 5.5 Attachment detection

`Ek(path)` = "extension is not markdown/canvas" — i.e. every non-`.md`/`.canvas` file is an
attachment node when `showAttachments` is on.

---

## 6. The force simulation worker (`sim.js`)

`sim.js` is shipped nearly readable. It is a **d3-force port** (quadtree `O(n log n)` Barnes-Hut,
link force, center force, collision) with a **hand-written WASM fast path** for `manyBody +
collide`; if WASM init fails it logs `"Using fallback d3 simulator"` and uses the JS forces.

### 6.1 Observed constants (verbatim from `sim.js`)

| constant | value | meaning |
|---|---|---|
| `q` (alpha) | `1`, decay `Ft = 1 − 0.001^(1/300)` | ~300 ticks to cool to 0.001 |
| `Et` (alphaMin) | `0.001` | stop threshold |
| `W` (velocityDecay) | `0.6` | `v *= 0.6` each tick |
| `J` (centerStrength) | `0.1` (default) | x/y pull to origin |
| `V` (linkStrength) | `1` (default) | spring strength |
| `$` (linkDistance) | `250` (default) | rest length, px |
| `K` (repelStrength) | `-1000` (default; `|r|<1 → −1`) | manyBody charge |
| collision radius | `60`, strength `vt = 0.5` | soft node separation |
| tick rate | `1000/60` ms | `setTimeout` loop while `alpha > alphaMin` |
| cooling | `alpha += (alphaTarget − alpha) * Ft` | target 0 when idle, 0.3 while dragging |

**Message protocol** (worker `onmessage`, observed):

```ts
// main → worker
{ nodes: { [id]: [x, y] | null },   // null entries = keep position; missing ids = remove
  links: [[srcId, dstId], ...],
  forceNode: { id, x, y },           // x/y null → unpin
  forces: { centerStrength?, linkStrength?, linkDistance?, repelStrength? },
  alpha?: number,                    // reheat: only if greater than current alpha
  alphaTarget?: number,
  run?: boolean }                    // (re)start the tick loop

// worker → main   (every tick)
{ id: string[], buffer: ArrayBuffer | SharedArrayBuffer, v?: number }
// buffer = Float32Array of interleaved x,y; v = version counter in the last Uint32 slot
```

### 6.2 Original TypeScript implementation of the worker (d3-force)

```ts
// graph-worker.ts  — bundle with esbuild/webpack to graph-worker.js, or use ?worker imports
import {
  forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide,
  Simulation, ForceLink
} from "d3-force";

interface WNode { id: string; index: number; x: number; y: number; vx: number; vy: number;
                  fx: number | null; fy: number | null; }
interface WEdge { source: WNode; target: WNode; }

let nodes: WNode[] = [];
let byId = new Map<string, WNode>();
let edges: WEdge[] = [];
let params = { centerStrength: 0.1, repelStrength: -1000, linkStrength: 1, linkDistance: 250 };
let sim: Simulation<WNode, WEdge> | null = null;

const ALPHA_DECAY_300 = 1 - Math.pow(0.001, 1 / 300);

function rebuild() {
  sim = forceSimulation(nodes)
    .alphaDecay(ALPHA_DECAY_300)          // Obsidian's cooling schedule, ~300 ticks
    .velocityDecay(0.6)
    .force("x", forceX<WNode>(0).strength(params.centerStrength))
    .force("y", forceY<WNode>(0).strength(params.centerStrength))
    .force("charge", forceManyBody<WNode>().strength(() => params.repelStrength).distanceMin(30))
    .force("link", forceLink<WNode, WEdge>(edges)
      .id(n => n.id)
      .distance(params.linkDistance)
      .strength(() => params.linkStrength))
    .force("collide", forceCollide<WNode>(() => 60).strength(0.5))
    .stop()
    .on("tick", publish);
}

let sab: SharedArrayBuffer | null = null;
function publish() {
  const n = nodes.length;
  const bytes = n * 2 * 4;
  let buf: ArrayBuffer | SharedArrayBuffer;
  let versioned = false;
  if (typeof SharedArrayBuffer !== "undefined") {
    if (!sab || sab.byteLength !== bytes + 4) sab = new SharedArrayBuffer(bytes + 4);
    buf = sab; versioned = true;
  } else buf = new ArrayBuffer(bytes);
  const f = new Float32Array(buf);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    ids.push(nodes[i].id);
    f[i * 2] = nodes[i].x; f[i * 2 + 1] = nodes[i].y;
  }
  if (versioned) {
    const v = new Uint32Array(buf, bytes, 1);
    const cur = v[0]; v[0]++;                      // bump before posting
    (self as any).postMessage({ id: ids, buffer: buf, v: cur });
  } else {
    (self as any).postMessage({ id: ids, buffer: buf }, [buf]);
  }
}

self.onmessage = (e: MessageEvent) => {
  const d = e.data;
  if (d.nodes) {
    const keep = new Set(Object.keys(d.nodes));
    nodes = nodes.filter(nd => keep.has(nd.id));
    byId = new Map(nodes.map(nd => [nd.id, nd]));
    for (const id in d.nodes) {
      const p = d.nodes[id];
      let nd = byId.get(id);
      if (!nd) { nd = { id, index: 0, x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null };
                 nodes.push(nd); byId.set(id, nd); }
      if (p) { nd.x = p[0]; nd.y = p[1]; }
    }
    nodes.forEach((nd, i) => nd.index = i);
    rebuild();
  }
  if (d.links) {
    edges = [];
    for (const [s, t] of d.links) {
      const sn = byId.get(s), tn = byId.get(t);
      if (sn && tn) edges.push({ source: sn, target: tn });
    }
    (sim!.force("link") as ForceLink<WNode, WEdge>).links(edges);
    sim!.alpha(1).restart();
  }
  if (d.forceNode) {
    const nd = byId.get(d.forceNode.id);
    if (nd) { nd.fx = d.forceNode.x; nd.fy = d.forceNode.y; }
  }
  if (d.forces) Object.assign(params, d.forces);
  if (typeof d.alpha === "number" && sim!.alpha() < d.alpha) sim!.alpha(d.alpha);
  if (typeof d.alphaTarget === "number") sim!.alphaTarget(d.alphaTarget);
  if (d.run) sim!.alpha(Math.max(sim!.alpha(), d.alpha ?? 0.3)).restart();
};
```

> **Why a worker matters:** with 5–10k nodes the manyBody+collide pass is ~1–2 ms in WASM and
> ~10–20 ms in JS. Off-thread, frame rate is unaffected; the render loop just reads the latest
> buffer. The version counter (`v`) lets the main thread detect a torn read if the worker wrote
> mid-copy — Obsidian checks the trailing `Uint32` before and after copying.

---

## 7. The renderer (`ff`) — where the "fractal" feel comes from

PIXI stage structure (observed `initGraphics`, app.js `2133658`):

```
PIXI.Application { view: <canvas>, antialias: true, backgroundAlpha: 0, autoStart: false }
 └─ stage
     ├─ u            invisible 10000×10000 hit-rect (pan surface, eventMode "static")
     ├─ hanger       PIXI.Container — the world. position = pan (px), scale = zoom
     │   ├─ Node.circle   Graphics: circle r=100 at pivot (100,100), tinted fill
     │   ├─ Node.text     PIXI.Text, anchor (.5, 0), resolution 2, zIndex 2
     │   └─ Node.highlight Graphics ring (only on hover), line width ~1px/screen
     ├─ Link.px      Container: Sprite(Texture.WHITE) stretched as the line
     └─ Link.arrow   Graphics arrowhead, child of hanger
```

Events are attached to a **separate transparent `<canvas>`** (`interactiveEl`) stacked above the
PIXI view: `renderer.events.setTargetElement(interactiveEl)`. This keeps hit-testing stable
while the PIXI view is swapped for screenshots/iframes.

### 7.1 Camera (observed exactly)

- Wheel zoom: `targetScale *= 1.5 ^ (−wheelDelta / 120)`; `deltaMode 1 → ×40`, `deltaMode 2 → ×800`
  (observed `uLe=1.5, pLe=40, fLe=800`). Zooming *in* anchors at the cursor; zooming out anchors
  at the viewport center (`zoomCenter = 0` sentinel).
- Scale is clamped to **`[1/128, 8]`** — 10 doublings in each direction.
- Smoothing: `scale = uo(scale, targetScale, 0.85)` with `uo(cur, tgt, k) = cur·k + tgt·(1−k)`
  every frame (observed `uo` at app.js `2133658`, `mLe=.9`).
- Panning: drag with fling — velocity `panv` is an EMA of frame deltas (`k=0.8,0.9`); after
  pointer-up, `pan += panv·(1000/60)` per frame, decaying toward 0 via `uo(…,0.9)`. Two-finger
  pinch rescales around the pinch midpoint. Arrow keys pan (Shift → 3× speed), `+`/`-` zoom
  toward the viewport center by `×1.03` (Shift `×1.1`) per frame.
- Resize: PIXI renderer resized to `clientWidth·devicePixelRatio`; pan is recentralized by half
  the pixel delta so the world stays put.

The critical invariant while zooming (keeps the anchor point stationary on screen):

```
worldAnchor = (zoomCenter − pan) / scale            // before
pan -= worldAnchor·newScale + pan − zoomCenter      // after (rearranged)
```

### 7.2 Detail-on-demand — the actual "fractal" formulas (observed verbatim)

```ts
// setScale(t) — called whenever scale changes
nodeScale = Math.sqrt(1 / scale);                              // nodes shrink sub-linearly
textAlpha = clamp(log2(scale) + 1 − textFadeMultiplier, 0, 1); // labels fade out when zooming out
```

- At `scale = 1` labels are fully visible (`textFadeMultiplier = 0`); each halving of zoom
  removes 1 unit of alpha, so labels disappear around `scale ≈ 0.5` and stay gone out to
  `1/128`. The slider shifts this curve by −3 … +3.
- `nodeScale = √(1/zoom)` means zooming **out** makes nodes smaller *in world space* but bigger
  *in screen space* than linear — the graph "breathes" and stays legible at macro scale.
- Arrowheads fade with zoom: `arrowAlpha = base · clamp((scale − 0.3) · 2, 0, 1)` — chevrons
  only appear once you zoom past ~0.65. (Edge lines themselves keep constant alpha.)
- Highlight state overrides fades: hovered node, its neighbors and their links go to alpha 1;
  everything else is multiplied by 0.2 (`uo` blend toward `g`).

### 7.3 Node & link drawing (observed `tV.render`, `iV.render`)

- Node size: `size = nodeSizeMult · max(8, min(√(weight+1)·3, 30))` world units — sqrt-scaled by
  degree, clamped, default weight = degree (or supplied `weights` map).
- Fill color priority: **drag/hover highlight → focused color → group color → tag/unresolved/
  attachment color → default fill**.
- Colors are read from CSS at runtime (§11) and *lerped per frame* toward the target with
  `Jde(c, t) = uo` per RGB channel (k=0.9) — smooth theme/color-group transitions for free.
- The circle is a single `Graphics` with a white circle of radius 100 at pivot (100,100); the
  frame just sets `tint`, `alpha`, `scale = size/100·nodeScale`. Mobile adds an invisible 5×
  radius hit-area circle.
- Label: `PIXI.Text` basename-without-extension, style
  `fontSize: 14 + size/4`, `wordWrapWidth: 300`, anchor `(0.5, 0)`; `resolution: 2` for crisp
  text; `scale = 1/scale` when focused so the open note's title stays screen-sized.
- Highlight ring: circle outline, line width `max(1, 1/(scale·nodeScale))` — constant *screen*
  width at any zoom.
- Links: a 1-px white `Sprite(Texture.WHITE)` stretched: `width = dist − srcSize − dstSize`,
  `height = lineSizeMult / scale`, rotated to the target; `tint` lerped like fills. Arrowheads
  are 8×4 px `Graphics` chevrons at the target rim, shown only past 0.3 zoom alpha and
  `dist > lineWidth`. Between mutual neighbors only one direction draws
  (`localeCompare` tie-break on ids).

### 7.4 Incremental rendering & LOD (observed `renderCallback`)

Every rAF tick (only while awake):

1. Pull worker buffer → assign `x,y` (honor `fx,fy` pins), version-check `SharedArrayBuffer`.
2. Apply fling/keyboard pan & zoom smoothing; recompute `updateZoom()`.
3. Compute world-space viewport rect for culling.
4. **Lazy init at most 50 nearest unrendered nodes** (`ke=50`, sorted by distance² to viewport
   center) — after big data changes graphics appear center-outward over successive frames.
5. `initGraphics()` for all *new* links; `render()` every node & link (each does its own culling
   and alpha math); `stage.sortChildren()` (z-order by zIndex); `app.render()`.
6. If the pointer left the hovered node's radius, clear highlight.
7. `idleFrames++`; after **60 idle frames** rendering sleeps entirely (`if (idleFrames > 60)
   return`) until `changed()` (input, worker data, or option change) wakes it. This is why the
   graph costs ~0 CPU when you walk away.

`setData(data)` diffs old vs new: removed nodes/links destroy graphics and free worker entries;
existing nodes update `color`/`type` in place; **new nodes are seeded near their neighbors'**
center-of-mass (or on an annulus around the existing mass if they have no placed neighbors) so
the layout doesn't explode on incremental updates; then `{nodes:{id:[x,y]}, links:[[a,b]],
alpha:0.3, run:true}` is posted. Node weights update from `data.weights` or recompute to degree.

### 7.5 Renderer core — sample implementation (TypeScript + PIXI v7)

```ts
import * as PIXI from "pixi.js";

const uo = (cur: number, tgt: number, k = 0.9) => cur * k + tgt * (1 - k);
const MIN_SCALE = 1 / 128, MAX_SCALE = 8;
const BASE_LINE_ALPHA = 0.2;
const DPR = () => window.devicePixelRatio || 1;

export class GraphCamera {
  scale = 1; targetScale = 1;
  panX = 0; panY = 0;
  zoomCenterX = 0; zoomCenterY = 0;      // 0,0 = viewport center

  onWheel(e: WheelEvent, w: number, h: number) {
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 40; else if (e.deltaMode === 2) d *= 800;
    this.targetScale *= Math.pow(1.5, -d / 120);
    if (this.targetScale < this.scale) this.zoomCenterX = this.zoomCenterY = 0;
    else { const r = DPR(); this.zoomCenterX = e.offsetX * r; this.zoomCenterY = e.offsetY * r; }
  }

  /** call every frame; returns true while animating */
  update(hanger: PIXI.Container, w: number, h: number): boolean {
    this.targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.targetScale));
    let { scale, panX, panY } = this;
    let animating = false;
    if (Math.abs(this.targetScale / scale - 1) >= 0.01 || Math.abs(scale / this.targetScale - 1) >= 0.01) {
      let zx = this.zoomCenterX, zy = this.zoomCenterY;
      if (zx === 0 && zy === 0) { const r = DPR(); zx = w / 2 * r; zy = h / 2 * r; }
      const anchorX = (zx - panX) / scale, anchorY = (zy - panY) / scale;
      scale = uo(scale, this.targetScale, 0.85);
      panX -= anchorX * scale + panX - zx;
      panY -= anchorY * scale + panY - zy;
      animating = true;
    }
    this.scale = hanger.scale.x = hanger.scale.y = scale;
    this.panX = hanger.x = panX; this.panY = hanger.y = panY;
    return animating;
  }

  nodeScale() { return Math.sqrt(1 / this.scale); }
  textAlpha(fade: number) { return Math.min(1, Math.max(0, Math.log2(this.scale) + 1 - fade)); }
}
```

```ts
export class GraphRenderer {
  private app: PIXI.Application;
  private hanger = new PIXI.Container();
  private camera = new GraphCamera();
  private nodes = new Map<string, GNode>();
  private links: GLink[] = [];
  private worker: Worker;
  private workerBuf: { ids: string[]; buf: ArrayBuffer; v?: number } | null = null;
  private renderTimer: number | null = null;
  private idleFrames = 0;
  private needsFullInit = false;

  colors: Record<string, { a: number; rgb: number }> = {};
  // options/state referenced by GNode/GLink
  nodeSizeMult = 1; lineSizeMult = 1; textFadeMult = 0; showArrows = false;
  highlight: GNode | null = null;
  dragNode: GNode | null = null;
  private downPos: { x: number; y: number } | null = null;
  private dragged = false;
  onNodeClick?: (id: string, type: string, e: any) => void;
  onNodeHover?: (id: string, type: string) => void;
  highlightNode(): GNode | null { return this.dragNode ?? this.highlight; }
  didDrag() { return this.dragged; }

  setRenderOptions(o: Partial<{ nodeSizeMultiplier: number; lineSizeMultiplier: number;
                                 textFadeMultiplier: number; showArrow: boolean }>) {
    if (o.nodeSizeMultiplier != null) this.nodeSizeMult = o.nodeSizeMultiplier;
    if (o.lineSizeMultiplier != null) this.lineSizeMult = o.lineSizeMultiplier;
    if (o.textFadeMultiplier != null) this.textFadeMult = o.textFadeMultiplier;
    if (o.showArrow != null) this.showArrows = o.showArrow;
    this.changed();
  }
  setForces(f: any) { this.worker.postMessage({ forces: f, alpha: 0.3, run: true }); }
  private addLink(a: GNode, b: GNode) {
    const l = new GLink(this, a, b);
    this.links.push(l); a.forward.set(b.id, l); b.reverse.set(a.id, l);
  }
  private removeLink(l: GLink) {
    l.dispose(); this.links.remove(l);
    l.source.forward.delete(l.target.id); l.target.reverse.delete(l.source.id);
  }
  private attachPanZoom(hit: HTMLCanvasElement) {
    let down: { x: number; y: number } | null = null;
    hit.addEventListener("pointerdown", e => {
      hit.setPointerCapture(e.pointerId);
      down = { x: e.clientX, y: e.clientY };
    });
    hit.addEventListener("pointermove", e => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = { x: e.clientX, y: e.clientY };
      this.camera.panX += dx * this.camera.scale; this.camera.panY += dy * this.camera.scale;
      this.changed();
    });
    hit.addEventListener("pointerup", () => down = null);
  }

  constructor(private container: HTMLElement, workerUrl: string) {
    const view = document.createElement("canvas");
    const hit = document.createElement("canvas");         // interactiveEl
    Object.assign(view.style, { position: "absolute", inset: "0" });
    Object.assign(hit.style, { position: "absolute", inset: "0" });
    container.append(view, hit);
    this.app = new PIXI.Application({ view, antialias: true, backgroundAlpha: 0, autoStart: false });
    this.app.renderer.events.setTargetElement(hit);
    this.hanger.eventMode = "static";
    this.app.stage.addChild(this.hanger);

    this.worker = new Worker(workerUrl, { name: "Graph Worker" });
    this.worker.onmessage = (e) => { if (!e.data.ignore) { this.workerBuf = e.data; this.changed(); } };

    hit.addEventListener("wheel", e => { e.preventDefault(); this.camera.onWheel(e, this.w, this.h); this.changed(); }, { passive: false });
    this.attachPanZoom(hit);
    this.readColors();
  }

  // --- colors from CSS (theme-aware) -------------------------------------
  readColors() {
    const map = {
      fill: "color-fill", fillFocused: "color-fill-focused", fillTag: "color-fill-tag",
      fillUnresolved: "color-fill-unresolved", fillAttachment: "color-fill-attachment",
      arrow: "color-arrow", circle: "color-circle", line: "color-line", text: "color-text",
      fillHighlight: "color-fill-highlight", lineHighlight: "color-line-highlight",
    };
    for (const [key, cls] of Object.entries(map)) {
      const el = document.body.createDiv?.() ?? Object.assign(document.createElement("div"), { className: "graph-view " + cls });
      if (!el.isConnected) document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const c = parseCssColor(cs.color);                    // -> {r,g,b,a}
      el.remove();
      this.colors[key] = { a: c.a * (parseFloat(cs.opacity) || 1), rgb: (c.r << 16) | (c.g << 8) | c.b };
    }
  }

  // --- data ---------------------------------------------------------------
  setData(data: { nodes: Record<string, { type: string; links: Record<string, true>; color?: any }>,
                  weights?: Record<string, number> }) {
    let changed = false;
    // remove stale
    for (const [id, n] of this.nodes) if (!data.nodes.hasOwnProperty(id)) { n.dispose(); this.nodes.delete(id); changed = true; }
    // add/update
    let maxR2 = 0;
    for (const n of this.nodes.values()) maxR2 = Math.max(maxR2, n.x * n.x + n.y * n.y);
    const maxR = Math.sqrt(maxR2);
    const fresh: GNode[] = [];
    for (const [id, nd] of Object.entries(data.nodes)) {
      let n = this.nodes.get(id);
      if (n) { n.color = nd.color ?? null; n.type = nd.type; }
      else {
        n = new GNode(this, id, nd.type); n.color = nd.color ?? null;
        this.nodes.set(id, n); fresh.push(n); changed = true;
      }
    }
    // edges (diff)
    for (const [id, nd] of Object.entries(data.nodes)) {
      const src = this.nodes.get(id)!;
      for (const dstId of Object.keys(nd.links)) {
        const dst = this.nodes.get(dstId);
        if (dst && !src.forward.has(dstId)) this.addLink(src, dst);
      }
    }
    for (const l of [...this.links])
      if (!data.nodes[l.source.id]?.links.hasOwnProperty(l.target.id)) this.removeLink(l);
    // seed positions for fresh nodes near neighbors, else on annulus
    if (fresh.length) {
      const area = fresh.length * 60 * 60, width = Math.sqrt(area / Math.PI + maxR * maxR) - maxR, jitter = Math.sqrt(area);
      const init: Record<string, [number, number]> = {};
      for (const n of fresh) {
        let sx = 0, sy = 0, cnt = 0;
        for (const r of n.related()) { const o = this.nodes.get(r); if (o && o.x !== null) { sx += o.x; sy += o.y; cnt++; } }
        if (cnt) { n.x = sx / cnt + (Math.random() - .5) * jitter; n.y = sy / cnt + (Math.random() - .5) * jitter; }
        else { const a = Math.random() * 2 * Math.PI, r = maxR + Math.sqrt(Math.random()) * width;
               n.x = r * Math.cos(a); n.y = r * Math.sin(a); }
        init[n.id] = [n.x, n.y];
      }
      this.worker.postMessage({ nodes: init, alpha: 0.3, run: true });
    }
    // weights
    for (const n of this.nodes.values()) {
      const w = data.weights ? (data.weights[n.id] ?? 0) : n.degree();
      if (w !== n.weight) { n.weight = w; changed = true; }
    }
    if (changed) {
      const links: [string, string][] = this.links.map(l => [l.source.id, l.target.id]);
      this.worker.postMessage({ links, alpha: 0.3, run: true });
    }
    this.changed();
  }

  // --- frame loop -----------------------------------------------------------
  private tick = () => {
    this.renderTimer = null;
    if (this.idleFrames > 60) return;                       // asleep
    const buf = this.workerBuf;
    if (buf) {
      let fresh = true;
      if (buf.buf instanceof SharedArrayBuffer) {
        const v = new Uint32Array(buf.buf, buf.buf.byteLength - 4, 1)[0];
        fresh = v !== buf.v; if (fresh) buf.v = v;
      } else this.workerBuf = null;
      if (fresh) {
        const f = new Float32Array(buf.buf);
        buf.ids.forEach((id, i) => {
          const n = this.nodes.get(id); if (!n) return;
          n.x = f[i * 2]; n.y = f[i * 2 + 1];
          if (n.fx != null) n.x = n.fx;
          if (n.fy != null) n.y = n.fy;
        });
      }
    }
    this.camera.update(this.hanger, this.w, this.h);
    const vp = this.viewport();

    // LOD: init ≤50 nearest unrendered nodes
    const pending = [...this.nodes.values()].filter(n => !n.rendered);
    pending.sort((a, b) => dist2(a, vp.cx, vp.cy) - dist2(b, vp.cx, vp.cy));
    for (const n of pending.slice(0, 50)) n.initGraphics(this.hanger);

    for (const l of this.links) l.render(vp);
    for (const n of this.nodes.values()) n.render(vp);
    this.hanger.sortChildren();
    this.app.render();
    this.idleFrames++;
    this.queue();
  };

  private viewport() {
    const z = this.camera.scale, w = this.w * DPR(), h = this.h * DPR();
    const left = -this.camera.panX / z, top = -this.camera.panY / z;
    return { left, top, right: left + w / z, bottom: top + h / z, cx: (left + left + w / z) / 2, cy: (top + top + h / z) / 2 };
  }

  changed() { this.idleFrames = 0; this.queue(); }
  private queue() {
    if (this.renderTimer == null) this.renderTimer = requestAnimationFrame(this.tick);
  }
  get w() { return this.container.clientWidth; }
  get h() { return this.container.clientHeight; }
}
```

The `GNode`/`GLink` draw classes map 1:1 to the observed `tV`/`iV`:

```ts
const BASE_RADIUS = 100; // graphics unit circle; scaled by size/100·nodeScale
class GNode {
  x: number | null = null; y: number | null = null;
  fx: number | null = null; fy: number | null = null;
  weight = 0; color: {a:number;rgb:number} | null = null;
  type = ""; rendered = false; fadeAlpha = 0;
  forward = new Map<string, GLink>(); reverse = new Map<string, GLink>();
  circle?: PIXI.Graphics; text?: PIXI.Text; highlight?: PIXI.Graphics;
  constructor(private r: GraphRenderer, public id: string, t: string) { this.type = t; }
  degree() { return this.forward.size + this.reverse.size; }
  related() { return [...this.forward.keys(), ...this.reverse.keys()]; }
  size() { return this.r.nodeSizeMult * Math.max(8, Math.min(Math.sqrt(this.weight + 1) * 3, 30)); }
  display() { return this.id.replace(/\.[^./\\]+$/, ""); }          // strip .md

  initGraphics(hanger: PIXI.Container) {
    if (this.rendered) return; this.rendered = true;
    const g = this.circle = new PIXI.Graphics();
    g.eventMode = "static";
    g.beginFill(0xffffff).drawCircle(BASE_RADIUS, BASE_RADIUS, BASE_RADIUS).endFill();
    g.pivot.set(BASE_RADIUS, BASE_RADIUS);
    g.cursor = "pointer"; g.zIndex = 1;
    g.on("pointerover", () => { this.r.highlight = this; this.r.changed(); this.r.onNodeHover?.(this.id, this.type); })
     .on("pointerout", () => { if (this.r.highlight === this) this.r.highlight = null; this.r.changed(); })
     .on("pointerdown", (e) => this.r.beginDrag(this, e))
     .on("click", (e) => { if (!this.r.didDrag()) this.r.onNodeClick?.(this.id, this.type, e); });
    const c = this.fillColor(); g.alpha = c.a; g.tint = c.rgb;
    hanger.addChild(g);
    const t = this.text = new PIXI.Text(this.display(), new PIXI.TextStyle({
      fontSize: 14 + this.size() / 4, fill: this.r.colors.text.rgb,
      fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
      wordWrap: true, wordWrapWidth: 300, align: "center",
    }));
    t.eventMode = "none"; t.resolution = 2; t.anchor.set(0.5, 0); t.zIndex = 2;
    hanger.addChild(t);
  }

  fillColor() {
    const c = this.r.colors;
    if (this.r.highlightNode() === this) return c.fillHighlight;
    if (this.type === "focused") { const f = c.fillFocused; if (f.a > 0) return f; }
    if (this.color) return this.color;
    if (this.type === "tag") return c.fillTag;
    if (this.type === "unresolved") return c.fillUnresolved;
    if (this.type === "attachment") return c.fillAttachment;
    return c.fill;
  }

  render(vp: Viewport) {
    if (!this.rendered || this.x === null) return;
    const r = this.r, hl = r.highlightNode() === this;
    // neighbor emphasis: everything not on the hover path fades to 20%
    let target = 1;
    const h = r.highlightNode();
    if (h && !hl && !this.forward.has(h.id) && !this.reverse.has(h.id)) target = 0.2;
    this.fadeAlpha = uo(this.fadeAlpha, target);

    const s = this.size(), f = r.camera.nodeScale();
    const col = this.fillColor();
    const g = this.circle!, t = this.text!;
    const cull = hl || !outside(vp, this.x - s * f - 1, this.y - s * f - 1, this.x + s * f + 1, this.y + s * f + 1);
    g.visible = cull;
    if (cull) {
      g.x = this.x; g.y = this.y; g.scale.set((s / BASE_RADIUS) * f);
      g.alpha = this.fadeAlpha * col.a;
      g.tint = lerpRgb(g.tint, col.rgb, 0.1);
    }
    let ta = this.fadeAlpha * r.camera.textAlpha(r.textFadeMult);
    if (hl) ta = 1;
    ta *= r.colors.text.a;
    const textCull = ta > 0.001 && !outside(vp, this.x - 300, this.y, this.x + 300, this.y + 200);
    t.visible = textCull;
    if (textCull) {
      t.x = this.x; t.y = this.y + (s + 5) * f;
      let ts = f; if (hl && r.camera.scale < 1) ts = 1 / r.camera.scale;
      t.scale.set(ts); t.alpha = ta;
    }
    if (hl) {
      if (!this.highlight) {
        this.highlight = new PIXI.Graphics();
        this.highlight.eventMode = "none"; this.highlight.zIndex = 1;
        this.r.hanger.addChild(this.highlight);
      }
      const ring = this.highlight;
      ring.clear();
      ring.alpha = r.colors.circle.a;
      ring.lineStyle(Math.max(1, 1 / r.camera.scale / f), r.colors.circle.rgb, 1);
      ring.drawCircle(0, 0, s + Math.max(1, 1 / r.camera.scale / f) / 2);
      ring.position.set(this.x, this.y); ring.scale.set(f);
    } else if (this.highlight) { this.highlight.destroy(); this.highlight = undefined; }
  }
  dispose() { this.circle?.destroy(); this.text?.destroy(); this.highlight?.destroy(); this.rendered = false; }
}
```

`GLink` renders a stretched white sprite (`width = dist − r1 − r2`, `height =
lineSizeMult/scale`, `tint` lerped) plus an 8×4 px chevron at the target rim — see §7.3 for the
exact formulas; mutual edges draw once (`id` order tie-break).

The remaining pieces — edge drawing (matches observed `iV`), viewport culling helpers, and the
small DOM/color utilities the samples use:

```ts
interface Viewport { left: number; top: number; right: number; bottom: number; cx: number; cy: number; }
const dist2 = (n: { x: number | null; y: number | null }, cx: number, cy: number) =>
  n.x === null ? Infinity : (n.x - cx) ** 2 + (n.y - cy) ** 2;
const outside = (vp: Viewport, l: number, t: number, r: number, b: number) =>
  r < vp.left || l > vp.right || b < vp.top || t > vp.bottom;

class GLink {
  px?: PIXI.Container; line?: PIXI.Sprite; arrow?: PIXI.Graphics; rendered = false;
  constructor(private r: GraphRenderer, public source: GNode, public target: GNode) {}
  render(vp: Viewport) {
    if (!this.rendered) {                       // lazy init, nearest-first like nodes
      if (!this.source.rendered || !this.target.rendered) return;
      this.rendered = true;
      const c = this.px = new PIXI.Container();
      const line = this.line = new PIXI.Sprite(PIXI.Texture.WHITE);
      line.eventMode = "none"; c.addChild(line);
      const col = this.r.colors.line;
      line.alpha = 0.2 * col.a; line.tint = col.rgb;
      const arrow = this.arrow = new PIXI.Graphics();
      arrow.eventMode = "none";
      arrow.alpha = 0.2; arrow.tint = this.r.colors.text.rgb;
      arrow.beginFill(0xffffff).moveTo(0, 0).lineTo(-4, -2).lineTo(-3, 0).lineTo(-4, 2).lineTo(0, 0).endFill();
      this.r.hanger.addChild(c, arrow);
    }
    const hl = this.r.highlightNode();
    const isHl = hl === this.source || hl === this.target;
    let target = 1;
    if (hl && !isHl) target = 0.2;
    const lw = this.r.lineSizeMult / this.r.camera.scale;
    const col = isHl ? this.r.colors.lineHighlight : this.r.colors.line;
    this.line!.alpha = uo(this.line!.alpha, target * col.a);
    this.line!.tint = lerpRgb(this.line!.tint, col.rgb, 0.1);
    this.arrow!.alpha = uo(this.arrow!.alpha,
      target * 0.2 * Math.min(1, Math.max(0, (this.r.camera.scale - 0.3) * 2)));
    // draw only one direction of mutual edges (id order tie-break, observed)
    const mutual = this.target.reverse.has(this.source.id);
    const draw = !mutual || this.source.id.localeCompare(this.target.id) < 0;
    const { source: s, target: t } = this;
    if (s.x === null || t.x === null) return;
    const dx = t.x - s.x, dy = t.y - s.y, len = Math.sqrt(dx * dx + dy * dy);
    const r1 = s.size() * this.r.camera.nodeScale(), r2 = t.size() * this.r.camera.nodeScale();
    const lineVisible = draw && len > r1 + r2;
    this.px!.visible = lineVisible;
    if (lineVisible) {
      this.px!.position.set(s.x + dx * r1 / len, s.y + dy * r1 / len);
      this.px!.pivot.set(0, 0);
      this.px!.rotation = Math.atan2(dy, dx);
      this.line!.position.set(0, -lw / 2);
      this.line!.width = Math.max(0, len - r1 - r2);
      this.line!.height = lw;
    }
    const showArrow = draw && this.r.showArrows && this.arrow!.alpha > 0.001 && len > lw;
    this.arrow!.visible = showArrow;
    if (showArrow) {
      const rr = r2 + 1;
      this.arrow!.position.set(t.x - dx * rr / len, t.y - dy * rr / len);
      this.arrow!.pivot.set(0, 0);
      this.arrow!.rotation = Math.atan2(dy, dx);
      const sc = 2 * Math.sqrt(this.r.lineSizeMult) / this.r.camera.scale;
      this.arrow!.scale.set(sc);
      this.arrow!.tint = this.r.colors.arrow.rgb;
    }
  }
  dispose() { this.px?.destroy(); this.arrow?.destroy(); this.rendered = false; }
}

// --- tiny utilities --------------------------------------------------------
function lerpRgb(a: number, b: number, k: number): number {
  const ch = (sh: number) => Math.round(a >> sh & 255) * k + (b >> sh & 255) * (1 - k);
  return (ch(16) << 16) + (ch(8) << 8) + (ch(0) | 0);
}
function parseCssColor(s: string): { r: number; g: number; b: number; a: number } {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return { r: 0x88, g: 0x88, b: 0x88, a: 1 };
  const [r, g, b, a] = m[1].split(",").map(Number);
  return { r, g, b, a: a ?? 1 };
}
function hslToRgbInt(h: number, s: number, l: number): number {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s / 100 * Math.min(l, 100 - l) / 100;
  const f = (n: number) => l / 100 - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}
// Obsidian-style DOM helpers used by the controls sample
declare global { interface HTMLElement { createDiv(cls?: string): HTMLDivElement; createEl(tag: string, o?: { cls?: string; text?: string }): any; } }
HTMLElement.prototype.createDiv = function (cls) {
  const d = document.createElement("div"); if (cls) d.className = cls; this.appendChild(d); return d;
};
HTMLElement.prototype.createEl = function (tag, o: any = {}) {
  const e: any = document.createElement(tag);
  if (o.cls) e.className = o.cls; if (o.text != null) e.textContent = o.text;
  this.appendChild(e); return e;
};
```

Drag physics bridging (observed `onPointerDown/Move/Up`):

```ts
beginDrag(node: GNode, e: PIXI.FederatedPointerEvent) {
  this.dragged = null; this.dragNode = node; this.downPos = e.getLocalPosition(this.app.stage);
}
// move: after >5 px it becomes a drag:
node.fx = p.x; node.fy = p.y;
this.worker.postMessage({ alpha: 0.3, alphaTarget: 0.3, run: true, forceNode: { id: node.id, x: p.x, y: p.y } });
// up: click if never dragged; then release the pin:
node.fx = node.fy = null;
this.worker.postMessage({ alphaTarget: 0, forceNode: { id: node.id, x: null, y: null } });
```

---

## 8. The controls UI

Four collapsible sections in a floating panel (`graph-controls`, top-right, 240 px), each an
instance of a shared `CollapsibleSection` (`ey`) that serializes its `collapsed` state into the
options object (`collapse-<name>` keys) — observed `ey.getOptions/setOptions`.

### 8.1 Observed widgets & ranges

| Section | Widget | Range / default |
|---|---|---|
| Filters | Search box | vault search syntax; Enter forces update, 250 ms debounce (`requestUpdateSearch`) |
| Filters (local only) | Depth slider | 1–5 step 1, default 1 |
| Filters (local only) | Toggles | backlinks ✓, forelinks ✓, interlinks ✗, tags ✗, attachments ✗, existing files only ✗ |
| Filters (global) | Toggle | show orphans ✓ |
| Groups | Rows of (query input, color picker, ✖) + "New group" | drag-reorder; see §9 |
| Display | Arrows toggle | ✗ |
| Display | Text fade slider | −3 … +3 step .1, default 0 |
| Display | Node size | .1 … 5, default 1 |
| Display | Link thickness | .1 … 5, default 1 |
| Forces | Center force | 0 … 1, default = slider-transform of 0.1 |
| Forces | Repel force | 0 … 20, default 10 → engine gets `10³ = 1000` |
| Forces | Link force | 0 … 1, default = transform of 1 |
| Forces | Link distance | 30 … 500 step 1, default 250 |

Header buttons: close (collapse panel to a single gear), open, **timelapse** (global graph only),
**restore defaults**.

### 8.2 The slider↔engine transforms (observed `Bhe`/`Nhe`)

Sliders are linear 0…1, but force params live on exponential-ish scales. Observed pair:

```ts
const Bhe = (o: number, t: number) => (Math.pow(t, 1 - o) - t) / (1 - t);   // slider -> engine
const Nhe = (o: number, t: number) => 1 - Math.log(o * (1 - t) + t) / Math.log(t); // engine -> slider
// centerStrength slider 0..1 maps through Bhe(x, .01)  -> (0.01^(1-x) - 0.01)/0.99 in [0,1]
// repel slider 0..20 maps through  r*r*r               -> [0, 8000]
```

Any option change → `renderer.setRenderOptions`/`setForces` (instant, no rebuild) +
`onOptionsChange()` debounced 100 ms → persist.

### 8.3 Minimal vanilla-JS controls skeleton

```ts
class Section {
  constructor(parent: HTMLElement, engine: GraphEngine, name: string, title: string) {
    this.el = parent.createDiv(`graph-control-section mod-${name}`);
    const head = this.el.createEl("header", { cls: "graph-control-section-header", text: title });
    head.onclick = () => { this.collapsed = !this.collapsed; this.el.toggleClass("is-collapsed", this.collapsed); engine.onOptionsChange(); };
    this.body = this.el.createDiv("graph-control-section-content");
  }
  addToggle(name: string, label: string, get: () => boolean, set: (v: boolean) => void) {
    const row = this.body.createDiv("setting-item");
    row.createDiv("setting-item-name", { text: label });
    const ctl = row.createDiv("setting-item-control");
    const input = ctl.createEl("input", { type: "checkbox" });
    input.checked = get();
    input.onchange = () => { set(input.checked); };
    // persist hook
    (this.listeners ??= {})[name] = (v?: boolean) => v === undefined ? get() : (set(v), undefined);
  }
  addSlider(name: string, label: string, min: number, max: number, step: number, get, set) { /* same pattern with <input type=range> */ }
  listeners: Record<string, (v?: any) => any> = {};
  getOptions(o: any) { for (const k in this.listeners) { const v = this.listeners[k](); if (v !== undefined) o[k] = v; } }
  setOptions(o: any) { for (const k in o) if (this.listeners[k]) this.listeners[k](o[k]); }
}
```

---

## 9. Color groups

Observed `GV=class` (app.js `2395803`).

- Model: ordered array; each row = `{query: string, color: {a: 1, rgb: int24}}`.
- **First match wins**: `setQuery` walks the array, a node is painted by the first query whose
  matcher hits; a query with `color: null` is a pure filter (restricts visibility).
- Row UI: text input (search autocomplete attached), Obsidian color-picker component, ✖ remove.
- **Drag to reorder** with pointer capture: after a 5 px threshold a `.drag-ghost` clone follows
  the cursor; the drop index is computed by pointer-Y vs. row midpoints; other rows are nudged by
  setting `style.top` to their own height (no FLIP library, just offsets).
- **"New group" palette generation** (observed exactly): `hue = rowCount · (360/9)` (i.e. 40°
  steps), `saturation = isDarkMode ? 70 : 60`, `lightness = 60` (HSL) → RGB int.

```ts
function nextGroupColor(index: number, dark: boolean): { a: 1; rgb: number } {
  const hsl = { h: index * 40, s: dark ? 70 : 60, l: 60 };       // iDe/tDe = 360/9
  return { a: 1, rgb: hslToRgbInt(hsl.h, hsl.s, hsl.l) };
}
```

- Persisted under the `colorGroups` key; restored via `setColorQueries(saved)`.
- Reordering/search edits call `engine.updateSearch()` which cancels the in-flight matching
  queue, recompiles matchers, and re-renders (nodes repaint without layout reset — colors are
  applied to existing nodes in `setData`'s update path).

---

## 10. Timelapse ("graph:animate")

Observed `renderProgression` + `oDe`'s progression branch:

```ts
async renderProgression() {
  this.progression = 1;
  const totalLinks = this.render();                     // rebuild with progression=1
  const linksPerSec = Math.min(100, Math.max(5, 0.5 * Math.sqrt(totalLinks)));
  const t0 = Date.now();
  for (; this.progression > 0;) {
    const prev = this.progression;
    await new Promise(r => setTimeout(r, 0));
    if (prev !== this.progression) break;               // cancelled by re-render
    const next = 1 + Math.floor(linksPerSec * (Date.now() - t0) / 1000);
    if (next !== this.progression) { this.progression = next; if (!this.render()) break; }
  }
}
```

Files sort by `min(ctime, mtime)`; a node exists once the budget covers the link-event that
introduces it; anything after the cut file is deleted — so the graph literally grows the way the
vault grew. Speed self-tunes: a 400-link vault replays in ~20 s (`0.5·√400 = 10` links/s), a
10k-link vault caps at 100 links/s.

---

## 11. Theme & CSS contract

The renderer never hard-codes colors. At startup (and on `css-change` events) it creates
`<div class="graph-view color-*">` probes, reads `getComputedStyle`, and stores
`{a, rgb}` (observed `testCSS`, plus CSS at `app.css` "graph-view" rules):

| Probe class | Theme variable | Used for |
|---|---|---|
| `color-fill` | `--graph-node` | normal nodes |
| `color-fill-focused` | `--graph-node-focused` | local-graph center + ring |
| `color-fill-tag` | `--graph-node-tag` (green) | tag nodes |
| `color-fill-attachment` | `--graph-node-attachment` (yellow) | attachment nodes |
| `color-fill-unresolved` | `--graph-node-unresolved`, `opacity:.5` | dangling links |
| `color-arrow` | `--text-normal`, `opacity:.5` | arrowheads |
| `color-circle` | `--graph-node-focused` | hover ring |
| `color-line` | `--graph-line` | edges |
| `color-text` | `--graph-text` | labels |
| `color-fill-highlight` / `color-line-highlight` | `--interactive-accent` | hover node + neighbor edges |

```css
/* minimal contract for the probes above */
.graph-view.color-fill            { color: var(--graph-node, #8a8a8a); }
.graph-view.color-fill-focused    { color: var(--graph-node-focused, var(--text-accent)); }
.graph-view.color-fill-tag        { color: var(--graph-node-tag, #4caf50); }
.graph-view.color-fill-attachment { color: var(--graph-node-attachment, #ffc832); }
.graph-view.color-fill-unresolved { color: var(--graph-node-unresolved, var(--text-faint)); opacity: .5; }
.graph-view.color-arrow           { color: var(--text-normal); opacity: .5; }
.graph-view.color-circle          { color: var(--graph-node-focused, var(--text-accent)); }
.graph-view.color-line            { color: var(--graph-line, rgba(120,120,120,.4)); }
.graph-view.color-text            { color: var(--graph-text, var(--text-normal)); }
.graph-view.color-fill-highlight,
.graph-view.color-line-highlight  { color: var(--interactive-accent, #a882ff); }

.graph-controls { position: absolute; inset-inline-end: 12px; top: 12px; width: 240px;
  background: var(--menu-background); border-radius: var(--menu-radius, 8px); }
.graph-controls.is-close { width: auto; }
.graph-controls.is-close > .graph-control-section { display: none; }
```

---

## 12. Performance playbook (observed techniques, in impact order)

1. **Worker-based simulation** — never block the UI thread with force math (§6).
2. **SharedArrayBuffer hand-off** — zero-copy, zero-allocation steady state; version counter
   avoids torn reads.
3. **Sleep after 60 idle frames** — the graph is free when untouched.
4. **Lazy graphics init, nearest-first, ≤50/frame** — after loading a 5k-node vault you see the
   center immediately instead of waiting for 5k `Graphics` builds.
5. **Per-node culling** — nodes/links outside the world-space viewport skip transform updates;
   labels additionally require `alpha > 0.001`.
6. **Incremental `setData` diffing** — updates don't rebuild the scene graph; new nodes seed
   near neighbors (no layout explosion); colors/types patch in place.
7. **Alpha fog (`N3=0.2`, zoom link fade)** — hides sub-pixel detail instead of drawing it.
8. **One white sprite stretched for every edge** — a single texture, no geometry per link.
9. **`uo()` smoothing everywhere** (k=0.8–0.9) — camera, fling, color transitions and label
   fades are all the same 1-pole filter; no easing library.
10. **Text at `resolution: 2`** — sharp labels without a full-retina stage.

Scaling notes from the constants: collide radius 60 and repel −1000 assume node visual sizes
8–30 units; link distance 250 world units is the main "spread" knob; the `√(weight+1)·3` size
law keeps hubs readable without dominating until ~200+ degree nodes (clamped at 30).

---

## 13. Making it *fractal*: extension ideas beyond Obsidian

Obsidian stops at zoom-clamped pan + fade. The same architecture extends naturally:

- **Cluster meta-nodes**: at `scale < threshold`, replace communities (Louvain/Leiden precomputed
  off-thread) with a single weighted node; expand on zoom-in. Your worker already supports
  dynamic node injection — send the cluster as a normal node with `weight = Σmembers`.
- **Semantic zoom layers**: swap `PIXI.Text` for stacked mini-previews (first heading, heat strip)
  using the same `textAlpha` gate; fade layers at `log2(scale)` bands.
- **Minimap + birds-eye**: the renderer's world-space viewport math (`§7.4`) is exactly what a
  second PIXI view needs for an overview rectangle.
- **GPU picking**: replace hit-rects with a color-id render pass if you outgrow PIXI's
  FederatedEvents (~20k+ nodes).
- **Edge bundling for macro view**: bundle inter-community edges at low zoom (standard
  force-directed edge bundling runs fine in the worker between ticks).

---

## 14. Evidence index (verifiability)

Primary artifact: `Obsidian-1.15.0.exe` sha256 `b0f60c75a12f96d54cb16b9fc32919966f2ebf029d9af75d67a19ba6555e1da0` (NSIS/7z, payload offset `217722`).
Extracted `resources/obsidian.asar` sha256 `0e6383301078a798f0f3bdb42bdb606d904ada77eab8c8fc89da533573979248` (395 files).

| Claim | Location |
|---|---|
| Plugin class, view registration, commands (`graph:open` etc.) | `app.js` offset `2379239` (`SI=class`) |
| Global view `Oc`, local view `v1` | `app.js` `2381089`, `2382369` |
| Data engine `MI` (options, setQuery, render, progression) | `app.js` `2383859` |
| Graph builder `oDe` (resolved/unresolved/tags/orphans/timelapse) | `app.js` `2400828` |
| Ego filter `oV` (BFS, weights 30/hop), orphan prune `ehe` | `app.js` `2147642`, `2148459` |
| Node / Link / Renderer classes `tV`, `iV`, `ff` | `app.js` `2127214`, `2130806`, `2133659` |
| Default options `nV`, `rDe`, `nDe`; transforms `Bhe`/`Nhe` | `app.js` `2126598`, `2398091`, `2399538`, `2383746`/`2383796` |
| Constants `uo`, `Jde`, `N3=.2`, `uLe=1.5`, wheel modes | `app.js` `var uLe=1.5,pLe=40,fLe=800,N3=.2,mLe=.9` at offset `2133662` |
| Color groups UI `GV` (drag reorder, palette 360/9) | `app.js` `2395310` |
| Search queue `qn`, matcher runner `_b` | `app.js` `1244570`, `1331074` |
| Force worker: d3 port + WASM, constants, protocol | `sim.js` (whole file; `self.onmessage` at end) |
| CSS color contract `.graph-view.color-*`, controls | `app.css` (`.graph-view.color-fill` … `.graph-controls`) |

Analysis tooling: REA (Reverse Engineer Anything) MCP — `inspect_artifact` (NSIS inventory),
`open_binary` + `extract_artifact` on the ASAR (extraction evidence `ev_0b761d40…`, 395
members), direct byte-offset reads of the shipped bundle. No code was executed.

**Limitations.** Obsidian's renderer bundle is minified; class/variable names above are the
shipped minified identifiers (kept so you can grep them). The search *matcher* internals
(`Sr=class`) were not exhaustively decompiled — the query language is the user-facing Obsidian
search syntax. i18n strings were skipped. Everything behavioral cited above is read directly
from shipped code; nothing was inferred from screenshots or docs.
