import { DEFAULT_GRAPH_FILTERS, GraphFilterOptions } from './layout';
import { DEFAULT_GRAPH_FORCES, GraphForceSettings } from './physics';
import { DEFAULT_GRAPH_DISPLAY, GraphDisplaySettings } from './renderer';

export interface GraphSettings {
  filters: GraphFilterOptions;
  display: GraphDisplaySettings;
  forces: GraphForceSettings;
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  filters: { ...DEFAULT_GRAPH_FILTERS },
  display: { ...DEFAULT_GRAPH_DISPLAY },
  forces: { ...DEFAULT_GRAPH_FORCES },
};

export function normalizeGraphSettings(value: unknown): GraphSettings {
  const saved = value && typeof value === 'object' ? value as Partial<GraphSettings> : {};
  return {
    filters: { ...DEFAULT_GRAPH_FILTERS, ...(saved.filters || {}) },
    display: { ...DEFAULT_GRAPH_DISPLAY, ...(saved.display || {}) },
    forces: { ...DEFAULT_GRAPH_FORCES, ...(saved.forces || {}) },
  };
}
