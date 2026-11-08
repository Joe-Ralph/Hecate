import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { AppLoader } from '@hecate/ui';
import { buildGraphData, GraphData } from '../components/graph/layout';
import { GraphController, GraphHover } from '../components/graph/controller';
import { GraphControls } from '../components/graph/GraphControls';
import { DEFAULT_GRAPH_SETTINGS, GraphSettings, normalizeGraphSettings } from '../components/graph/options';

export const GraphPage: React.FC = () => {
  const store = useWorkspaceStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GraphController | null>(null);
  const lastReinitRef = useRef(0);
  const [data, setData] = useState<GraphData | null>(null);
  const [hovered, setHovered] = useState<GraphHover | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedCommunityId, setFocusedCommunityId] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState('COMMUNITY');
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sampleState, setSampleState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [sampleXLState, setSampleXLState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [reinitCount, setReinitCount] = useState(0);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const controller = new GraphController(canvasRef.current, containerRef.current, {
      onHover: setHovered,
      onOpenNode: (node, sidePanel) => useWorkspaceStore.getState().openNode(node.id, sidePanel),
      onSelect: setSelectedId,
      onCommunityFocus: setFocusedCommunityId,
      onZoomLevel: (level) => setZoomLabel(level.toUpperCase()),
      onReady: () => setInitializing(false),
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!store.db) return;
    let cancelled = false;
    setSettingsLoaded(false);
    store.db.settings.getSettings().then((saved) => {
      if (cancelled) return;
      setSettings(normalizeGraphSettings(saved.graph));
      setSettingsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [store.db]);

  useEffect(() => {
    if (!store.db || !controllerRef.current) return;
    let cancelled = false;
    const reset = lastReinitRef.current !== reinitCount;
    lastReinitRef.current = reinitCount;
    if (reset) setInitializing(true);
    buildGraphData(store.db).then((nextData) => {
      if (cancelled || !controllerRef.current) return;
      setData(nextData);
      controllerRef.current.setData(nextData, reset);
    });
    return () => { cancelled = true; };
  }, [store.db, store.version, reinitCount]);

  useEffect(() => {
    const timer = setTimeout(() => controllerRef.current?.setFilters(settings.filters), 250);
    return () => clearTimeout(timer);
  }, [settings.filters]);

  useEffect(() => {
    controllerRef.current?.setDisplay(settings.display);
  }, [settings.display]);

  useEffect(() => {
    const timer = setTimeout(() => controllerRef.current?.setForces(settings.forces), 100);
    return () => clearTimeout(timer);
  }, [settings.forces]);

  useEffect(() => {
    controllerRef.current?.setSelected(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!store.db || !settingsLoaded) return;
    const timer = setTimeout(() => {
      store.db?.settings.updateSettings({
        graph: { ...settings, filters: { ...settings.filters, localNodeId: null } },
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [store.db, settings, settingsLoaded]);

  const topTags = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const node of data.nodes) {
      for (const tag of node.tagNames) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data]);

  const updateSearch = (search: string) => {
    setSettings((current) => ({ ...current, filters: { ...current.filters, search } }));
  };

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] font-sans overflow-hidden">
      <div className="h-14 px-6 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2 text-[13px] min-w-0">
          <span className="text-[var(--text-muted)]">Workspace</span>
          <span className="text-[var(--text-faint)]">/</span>
          <span className="font-medium text-[var(--text-primary)]">Graph</span>
          <span className="text-[11px] font-mono text-[var(--text-faint)] ml-3 whitespace-nowrap">
            {data?.nodes.length || 0} nodes · {data?.links.length || 0} links · {zoomLabel}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button type="button" onClick={async () => {
            setSampleState('loading');
            await store.loadSampleGraphData();
            setSampleState('done');
          }} disabled={sampleState !== 'idle'} title="Loads a large demo cluster under 'Sample Workspace'" className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-accent-soft)] text-[var(--accent)] border border-[var(--border-accent)] hover:opacity-85 cursor-pointer disabled:opacity-50">
            {sampleState === 'idle' ? 'SAMPLE DATA' : sampleState === 'loading' ? 'LOADING…' : 'SAMPLE LOADED'}
          </button>
          <button type="button" onClick={async () => {
            setSampleXLState('loading');
            await store.loadSampleGraphData('xl');
            setSampleXLState('done');
          }} disabled={sampleXLState !== 'idle'} title="Loads ~2,000 nodes under 'Sample Workspace XL'" className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-strong)] hover:text-[var(--accent)] hover:border-[var(--border-accent)] cursor-pointer disabled:opacity-50">
            {sampleXLState === 'idle' ? 'SAMPLE XL' : sampleXLState === 'loading' ? 'LOADING…' : 'XL LOADED'}
          </button>
          <button type="button" onClick={() => setSettings((current) => ({
            ...current,
            filters: { ...current.filters, localNodeId: current.filters.localNodeId ? null : selectedId },
          }))} disabled={!selectedId && !settings.filters.localNodeId} className={`h-7 px-2.5 rounded-[6px] text-[11px] font-mono border cursor-pointer ${settings.filters.localNodeId ? 'bg-[var(--bg-accent-soft)] text-[var(--accent)] border-[var(--border-accent)]' : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border-strong)]'} disabled:opacity-40`}>
            {settings.filters.localNodeId ? 'LOCAL ON' : 'FOCUS'}
          </button>
          {focusedCommunityId && <button type="button" onClick={() => controllerRef.current?.fitToView()} className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-accent-soft)] text-[var(--accent)] border border-[var(--border-accent)] cursor-pointer">GLOBAL GRAPH</button>}
          <button type="button" onClick={() => setReinitCount((count) => count + 1)} title="Reinitialize all positions" className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-strong)] hover:text-[var(--accent)] cursor-pointer">REINITIALIZE</button>
          <button type="button" onClick={() => controllerRef.current?.fitToView()} className="h-7 px-2.5 rounded-[6px] text-[11px] font-mono bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-strong)] hover:text-[var(--text-primary)] cursor-pointer">FIT VIEW</button>
          <input type="text" value={settings.filters.search} onChange={(event) => updateSearch(event.target.value)} placeholder="Filter nodes…" className="h-7 px-2.5 w-40 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[6px] text-[12px] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {initializing && <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#100F12]"><AppLoader mode="cursor" label="PREPARING GRAPH" /></div>}
        <canvas ref={canvasRef} aria-label="Knowledge graph. Drag to pan, scroll to zoom, arrow keys to pan, plus and minus to zoom." className="cursor-grab active:cursor-grabbing outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]" />
        <GraphControls settings={settings} selectedNodeId={selectedId} onChange={setSettings} />

        {hovered && <div className="absolute z-40 pointer-events-none w-64 p-3 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-2xl" style={{
          left: Math.max(8, Math.min(hovered.x - (containerRef.current?.getBoundingClientRect().left || 0) + 14, (containerRef.current?.clientWidth || 800) - 270)),
          top: Math.max(8, Math.min(hovered.y - (containerRef.current?.getBoundingClientRect().top || 0) + 14, (containerRef.current?.clientHeight || 600) - 150)),
        }}>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] border-b border-[var(--border-subtle)] pb-1 mb-1.5">{hovered.node.kind}</div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] leading-snug">{hovered.node.title}</div>
          {hovered.node.tagNames.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{hovered.node.tagNames.map((tag) => <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-accent-soft)] text-[var(--accent)]">#{tag}</span>)}</div>}
          <div className="text-[11px] font-mono text-[var(--text-faint)] mt-2">{hovered.node.degree} links · click to open</div>
        </div>}

        <div className="absolute left-4 bottom-4 max-w-[calc(100%-2rem)] p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] select-none">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {topTags.map(([name, count]) => <button key={name} type="button" onClick={() => setSettings((current) => ({
              ...current,
              filters: { ...current.filters, activeTag: current.filters.activeTag === name ? null : name },
            }))} className={`flex items-center space-x-1.5 text-[11px] cursor-pointer transition-opacity ${settings.filters.activeTag && settings.filters.activeTag !== name ? 'opacity-40' : ''}`}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: { task: '#8fd18b', book: '#e8b86a', person: '#8cc4f0', meeting: '#e8856a' }[name] || '#c4b2ff' }} />
              <span className="text-[var(--text-secondary)]">#{name} <span className="text-[var(--text-faint)]">{count}</span></span>
            </button>)}
            <span className="flex items-center space-x-1.5 text-[11px]"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#9a948a' }} /><span className="text-[var(--text-secondary)]">other</span></span>
          </div>
          <div className="text-[9.5px] font-mono text-[var(--text-faint)] mt-2">NEBULA · ZOOM FROM COMMUNITIES TO NOTES · SETTLES AT REST</div>
        </div>
        <div className="absolute right-4 bottom-4 text-[10px] font-mono text-[var(--text-faint)] select-none pointer-events-none">drag pan · scroll/pinch zoom · arrows +/− · click opens</div>
      </div>
    </div>
  );
};
