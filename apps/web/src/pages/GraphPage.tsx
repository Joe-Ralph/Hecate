import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { AppLoader } from '@hecate/ui';
import { buildGraphData, neighborhood, GraphData, GraphNode } from '../components/graph/layout';
import { detectCommunities, CommunityMap } from '../components/graph/communities';
import { ForceEngine, nodeRadius } from '../components/graph/physics';
import { drawGraph, RenderState, Transform } from '../components/graph/renderer';

export const GraphPage: React.FC = () => {
  const store = useWorkspaceStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [hovered, setHovered] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sampleState, setSampleState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [sampleXLState, setSampleXLState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [reinitCount, setReinitCount] = useState(0);
  const [initializing, setInitializing] = useState(true);

  const engineRef = useRef<ForceEngine | null>(null);
  const communitiesRef = useRef<CommunityMap | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    nodeId: string | null;
  } | null>(null);
  const stardustRef = useRef<RenderState['stardust']>([]);

  // Decorative star dust, generated once (not data)
  useEffect(() => {
    let seed = 987654321;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    stardustRef.current = Array.from({ length: 160 }, () => ({
      x: (rand() - 0.5) * 4000,
      y: (rand() - 0.5) * 4000,
      r: rand() * 1.1 + 0.3,
      alpha: rand() * 0.16 + 0.03,
    }));
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const engine = engineRef.current;
    const communities = communitiesRef.current;
    if (!canvas || !container || !engine || !communities || !data) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(document.documentElement);
    drawGraph(ctx, {
      data,
      positions: engine.positions,
      communities,
      transform,
      hoveredId: hovered?.node.id || null,
      selectedId,
      focusSet: focusMode && selectedId && data ? neighborhood(data, selectedId, 2) : null,
      activeTag,
      searchMatches: search.trim()
        ? new Set(
            data.nodes
              .filter((n) => n.title.toLowerCase().includes(search.trim().toLowerCase()))
              .map((n) => n.id)
          )
        : new Set(),
      stardust: stardustRef.current,
      width: w,
      height: h,
      accent: css.getPropertyValue('--accent').trim() || '#c4b2ff',
      textColor: css.getPropertyValue('--text-secondary').trim() || '#d8d2c8',
    });
  }, [data, transform, hovered, selectedId, focusMode, activeTag, search]);

  // Assemble graph data, then run the simulation live until it settles
  useEffect(() => {
    if (!store.db) return;
    let cancelled = false;
    let raf = 0;
    setInitializing(true);

    buildGraphData(store.db).then((d) => {
      if (cancelled) return;
      setData(d);

      const communities = detectCommunities(d);
      communitiesRef.current = communities;
      // Fresh engine: chaos → stable animation replays on every (re)initialization
      const engine = new ForceEngine(d, communities);
      engineRef.current = engine;

      // Chunked warm-up: a few ticks per frame so the browser keeps painting
      // (no multi-second main-thread block on large graphs)
      let warmTicks = 0;
      const warmup = () => {
        if (cancelled) return;
        for (let i = 0; i < 8 && warmTicks < 120; i++) {
          engine.tick();
          warmTicks++;
        }
        if (warmTicks < 120) {
          raf = requestAnimationFrame(warmup);
          return;
        }

        // Fit once bounds are near-final: no zoom-in-then-out jump
        fitToView();
        setInitializing(false);

        const loop = () => {
          if (cancelled) return;
          // Several ticks per frame: settles ~4x faster at the same frame rate
          let hot = true;
          for (let i = 0; i < 4 && hot; i++) hot = engine.tick();
          draw();
          if (hot) {
            raf = requestAnimationFrame(loop);
          } else {
            fitToView();
          }
        };
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(warmup);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [store.db, store.version, reinitCount]);

  // Redraw on interaction-state changes (no simulation restart)
  useEffect(() => {
    draw();
  }, [transform, hovered, selectedId, focusMode, activeTag, search, draw]);

  const fitToView = useCallback(() => {
    const engine = engineRef.current;
    const container = containerRef.current;
    if (!engine || !container) return;
    const { minX, maxX, minY, maxY } = engine.bounds();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const k = Math.min(w / (bw + 120), h / (bh + 120), 1.2);
    setTransform({
      k,
      x: w / 2 - ((minX + maxX) / 2) * k,
      y: h / 2 - ((minY + maxY) / 2) * k,
    });
  }, []);

  const findNodeAt = (clientX: number, clientY: number): GraphNode | null => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine || !data) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - transform.x) / transform.k;
    const y = (clientY - rect.top - transform.y) / transform.k;
    let best: GraphNode | null = null;
    let bestDist = 12 / transform.k + 4;
    for (const n of data.nodes) {
      const p = engine.positions.get(n.id);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  };

  const topTags = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const n of data.nodes) {
      for (const t of n.tagNames) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [data]);

  const zoomLabel = transform.k < 0.6 ? 'UNIVERSE' : transform.k < 1.5 ? 'COMMUNITY' : 'DETAILS';

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] font-sans overflow-hidden">
      {/* Top bar */}
      <div className="h-14 px-6 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2 text-[13px]">
          <span className="text-[var(--text-muted)]">Workspace</span>
          <span className="text-[var(--text-faint)]">/</span>
          <span className="font-medium text-[var(--text-primary)]">Graph</span>
          <span className="text-[11px] font-mono text-[var(--text-faint)] ml-3">
            {data?.nodes.length || 0} nodes · {data?.links.length || 0} links · {zoomLabel}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={async () => {
              setSampleState('loading');
              await store.loadSampleGraphData();
              setSampleState('done');
            }}
            disabled={sampleState !== 'idle'}
            title="Loads a large demo cluster under 'Sample Workspace' (delete that node to remove it)"
            className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-accent-soft)] text-[var(--accent)] border border-[var(--border-accent)] hover:opacity-85 cursor-pointer disabled:opacity-50"
          >
            {sampleState === 'idle' ? 'SAMPLE DATA' : sampleState === 'loading' ? 'LOADING…' : 'SAMPLE LOADED'}
          </button>
          <button
            type="button"
            onClick={async () => {
              setSampleXLState('loading');
              await store.loadSampleGraphData('xl');
              setSampleXLState('done');
            }}
            disabled={sampleXLState !== 'idle'}
            title="Loads ~2,000 nodes and ~1,500 links under 'Sample Workspace XL' (delete that node to remove it)"
            className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-strong)] hover:text-[var(--accent)] hover:border-[var(--border-accent)] cursor-pointer disabled:opacity-50"
          >
            {sampleXLState === 'idle' ? 'SAMPLE XL' : sampleXLState === 'loading' ? 'LOADING…' : 'XL LOADED'}
          </button>
          <button
            type="button"
            onClick={() => selectedId && setFocusMode(!focusMode)}
            disabled={!selectedId}
            className={`h-7 px-2.5 rounded-[6px] text-[11px] font-mono border cursor-pointer transition-colors ${
              focusMode
                ? 'bg-[var(--bg-accent-soft)] text-[var(--accent)] border-[var(--border-accent)]'
                : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border-strong)] hover:text-[var(--text-primary)]'
            } disabled:opacity-40`}
          >
            {focusMode ? 'FOCUS ON' : 'FOCUS'}
          </button>
          <button
            type="button"
            onClick={() => setReinitCount((c) => c + 1)}
            title="Reinitialize the layout: replays the chaos-to-stable simulation from scratch"
            className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-strong)] hover:text-[var(--accent)] hover:border-[var(--border-accent)] cursor-pointer"
          >
            REINITIALIZE
          </button>
          <button
            type="button"
            onClick={fitToView}
            className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-strong)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            FIT VIEW
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="h-7 px-2.5 w-44 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[6px] text-[12px] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {initializing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#100F12]">
            <AppLoader mode="cursor" label="PREPARING GRAPH" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="cursor-grab active:cursor-grabbing"
          onWheel={(e) => {
            e.preventDefault();
            const rect = canvasRef.current!.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const factor = Math.exp(-e.deltaY * 0.0012);
            const newK = Math.min(6, Math.max(0.1, transform.k * factor));
            const scale = newK / transform.k;
            setTransform({
              k: newK,
              x: mx - (mx - transform.x) * scale,
              y: my - (my - transform.y) * scale,
            });
          }}
          onMouseDown={(e) => {
            const n = findNodeAt(e.clientX, e.clientY);
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              moved: false,
              nodeId: n?.id || null,
            };
          }}
          onMouseMove={(e) => {
            const drag = dragRef.current;
            const engine = engineRef.current;
            if (drag) {
              const dx = e.clientX - drag.startX;
              const dy = e.clientY - drag.startY;
              if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
              if (!drag.moved) return;

              if (drag.nodeId && engine) {
                // Drag a node: pin it and gently reheat the simulation
                const rect = canvasRef.current!.getBoundingClientRect();
                const x = (e.clientX - rect.left - transform.x) / transform.k;
                const y = (e.clientY - rect.top - transform.y) / transform.k;
                engine.setFixed(drag.nodeId, x, y);
                engine.reheat(0.12);
                engine.tick();
                draw();
              } else {
                setTransform((t) => ({ ...t, x: t.x + e.movementX, y: t.y + e.movementY }));
              }
              return;
            }
            const n = findNodeAt(e.clientX, e.clientY);
            setHovered(n ? { node: n, x: e.clientX, y: e.clientY } : null);
          }}
          onMouseUp={(e) => {
            const drag = dragRef.current;
            dragRef.current = null;
            const engine = engineRef.current;
            if (drag?.nodeId && engine) {
              engine.clearFixed(drag.nodeId);
            }
            if (drag?.moved) return;
            const n = findNodeAt(e.clientX, e.clientY);
            if (n) {
              setSelectedId(n.id);
              store.openNode(n.id, e.metaKey || e.ctrlKey);
            } else {
              setSelectedId(null);
              setFocusMode(false);
            }
          }}
          onMouseLeave={() => {
            setHovered(null);
            if (dragRef.current?.nodeId) {
              engineRef.current?.clearFixed(dragRef.current.nodeId);
            }
            dragRef.current = null;
          }}
        />

        {/* Hover preview card */}
        {hovered && (
          <div
            className="absolute z-40 pointer-events-none w-64 p-3 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-2xl"
            style={{
              left: Math.min(
                hovered.x - (containerRef.current?.getBoundingClientRect().left || 0) + 14,
                (containerRef.current?.clientWidth || 800) - 270
              ),
              top: hovered.y - (containerRef.current?.getBoundingClientRect().top || 0) + 14,
            }}
          >
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] border-b border-[var(--border-subtle)] pb-1 mb-1.5">
              {hovered.node.kind}
            </div>
            <div className="text-[14px] font-medium text-[var(--text-primary)] leading-snug">
              {hovered.node.title}
            </div>
            {hovered.node.tagNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {hovered.node.tagNames.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-accent-soft)] text-[var(--accent)]"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <div className="text-[11px] font-mono text-[var(--text-faint)] mt-2">
              {hovered.node.degree} links · click to open
            </div>
          </div>
        )}

        {/* Legend / filter chips */}
        <div className="absolute left-4 bottom-4 p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] select-none">
          <div className="flex items-center space-x-3">
            {topTags.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setActiveTag(activeTag === name ? null : name);
                  engineRef.current?.reheat(0.15);
                }}
                className={`flex items-center space-x-1.5 text-[11px] cursor-pointer transition-opacity ${
                  activeTag && activeTag !== name ? 'opacity-40' : ''
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      { task: '#8fd18b', book: '#e8b86a', person: '#8cc4f0', meeting: '#e8856a' }[
                        name
                      ] || '#c4b2ff',
                  }}
                />
                <span className="text-[var(--text-secondary)]">
                  #{name} <span className="text-[var(--text-faint)]">{count}</span>
                </span>
              </button>
            ))}
            <span className="flex items-center space-x-1.5 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#9a948a' }} />
              <span className="text-[var(--text-secondary)]">other</span>
            </span>
          </div>
          <div className="text-[9.5px] font-mono text-[var(--text-faint)] mt-2">
            NEBULA · COMMUNITIES FROM RELATIONSHIPS · SETTLES AT REST
          </div>
        </div>

        <div className="absolute right-4 bottom-4 text-[10px] font-mono text-[var(--text-faint)] select-none">
          drag pan · scroll zoom · drag node to rearrange · click opens
        </div>
      </div>
    </div>
  );
};
