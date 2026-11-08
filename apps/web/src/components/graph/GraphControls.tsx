import React, { useState } from 'react';
import { GraphSettings, DEFAULT_GRAPH_SETTINGS } from './options';

interface Props {
  settings: GraphSettings;
  selectedNodeId: string | null;
  onChange: (settings: GraphSettings) => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-[var(--border-subtle)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-mono tracking-wider text-[var(--text-secondary)] cursor-pointer"
      >
        <span>{title}</span><span>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
    </section>
  );
};

const Toggle: React.FC<{ label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }> = ({ label, checked, disabled, onChange }) => (
  <label className={`flex items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)] ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
    <span>{label}</span>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="accent-[var(--accent)]" />
  </label>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step: number; format?: (value: number) => string; onChange: (value: number) => void }> = ({ label, value, min, max, step, format, onChange }) => (
  <label className="block text-[11px] text-[var(--text-secondary)]">
    <span className="flex justify-between gap-2 mb-1"><span>{label}</span><span className="font-mono text-[var(--text-faint)]">{format ? format(value) : value}</span></span>
    <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="w-full h-1 accent-[var(--accent)] cursor-pointer" />
  </label>
);

export const GraphControls: React.FC<Props> = ({ settings, selectedNodeId, onChange }) => {
  const [closed, setClosed] = useState(false);
  const filters = settings.filters;
  const display = settings.display;
  const forces = settings.forces;
  const updateFilters = (patch: Partial<typeof filters>) => onChange({ ...settings, filters: { ...filters, ...patch } });
  const updateDisplay = (patch: Partial<typeof display>) => onChange({ ...settings, display: { ...display, ...patch } });
  const updateForces = (patch: Partial<typeof forces>) => onChange({ ...settings, forces: { ...forces, ...patch } });

  if (closed) {
    return <button type="button" onClick={() => setClosed(false)} className="absolute right-4 top-4 z-30 h-8 px-3 rounded-[7px] bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-secondary)] cursor-pointer">CONTROLS</button>;
  }

  return (
    <aside className="absolute right-4 top-4 z-30 w-64 max-h-[calc(100%-2rem)] overflow-y-auto rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl select-none">
      <header className="h-9 px-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
        <span className="text-[10px] font-mono tracking-wider text-[var(--text-primary)]">GRAPH CONTROLS</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange({ ...DEFAULT_GRAPH_SETTINGS, filters: { ...DEFAULT_GRAPH_SETTINGS.filters } })} className="text-[9px] font-mono text-[var(--text-faint)] hover:text-[var(--accent)] cursor-pointer">RESET</button>
          <button type="button" onClick={() => setClosed(true)} aria-label="Close graph controls" className="text-[var(--text-faint)] hover:text-[var(--text-primary)] cursor-pointer">×</button>
        </div>
      </header>
      <Section title="FILTERS">
        <label className="block text-[11px] text-[var(--text-secondary)]">
          <span className="block mb-1">Search titles</span>
          <input value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Filter nodes…" className="w-full h-7 px-2 rounded-[5px] bg-[var(--bg-raised)] border border-[var(--border-strong)] text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
        </label>
        <Toggle label="Show orphans" checked={filters.showOrphans} onChange={(showOrphans) => updateFilters({ showOrphans })} />
        <Toggle label="Hierarchy links" checked={filters.showHierarchy} onChange={(showHierarchy) => updateFilters({ showHierarchy })} />
        <Toggle label="Focus selected node" checked={filters.localNodeId !== null} disabled={!selectedNodeId && !filters.localNodeId} onChange={(enabled) => updateFilters({ localNodeId: enabled ? selectedNodeId : null })} />
        {filters.localNodeId && <>
          <Slider label="Local depth" value={filters.localDepth} min={1} max={5} step={1} onChange={(localDepth) => updateFilters({ localDepth })} />
          <Toggle label="Backlinks" checked={filters.localBacklinks} onChange={(localBacklinks) => updateFilters({ localBacklinks })} />
          <Toggle label="Forelinks" checked={filters.localForelinks} onChange={(localForelinks) => updateFilters({ localForelinks })} />
          <Toggle label="Links between neighbors" checked={filters.localInterlinks} onChange={(localInterlinks) => updateFilters({ localInterlinks })} />
        </>}
      </Section>
      <Section title="DISPLAY">
        <Toggle label="Reference arrows" checked={display.showArrows} onChange={(showArrows) => updateDisplay({ showArrows })} />
        <Slider label="Label fade" value={display.textFade} min={-3} max={3} step={0.1} format={(value) => value.toFixed(1)} onChange={(textFade) => updateDisplay({ textFade })} />
        <Slider label="Node size" value={display.nodeSize} min={0.1} max={5} step={0.1} format={(value) => `${value.toFixed(1)}×`} onChange={(nodeSize) => updateDisplay({ nodeSize })} />
        <Slider label="Link thickness" value={display.lineSize} min={0.1} max={5} step={0.1} format={(value) => `${value.toFixed(1)}×`} onChange={(lineSize) => updateDisplay({ lineSize })} />
      </Section>
      <Section title="FORCES">
        <Slider label="Center force" value={forces.centerGravity} min={0} max={0.05} step={0.001} format={(value) => value.toFixed(3)} onChange={(centerGravity) => updateForces({ centerGravity })} />
        <Slider label="Repel force" value={-forces.repulsion} min={0} max={200} step={1} onChange={(value) => updateForces({ repulsion: -value })} />
        <Slider label="Link force" value={forces.linkStrength} min={0} max={0.5} step={0.01} format={(value) => value.toFixed(2)} onChange={(linkStrength) => updateForces({ linkStrength })} />
        <Slider label="Link distance" value={forces.linkDistance} min={30} max={250} step={1} onChange={(linkDistance) => updateForces({ linkDistance })} />
        <Slider label="Community pull" value={forces.communityAttraction} min={0} max={0.1} step={0.005} format={(value) => value.toFixed(3)} onChange={(communityAttraction) => updateForces({ communityAttraction })} />
        <Slider label="Community separation" value={forces.communitySeparation} min={0} max={0.2} step={0.005} format={(value) => value.toFixed(3)} onChange={(communitySeparation) => updateForces({ communitySeparation })} />
      </Section>
    </aside>
  );
};
