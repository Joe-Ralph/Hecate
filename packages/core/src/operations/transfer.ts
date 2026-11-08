/**
 * Workspace import/export helpers (REQ-7.3).
 * Pure functions: validation, id remapping, and Markdown rendering.
 */

import { ExportableNode } from '../paste/serializer';

export interface WorkspaceDump {
  nodes: any[];
  tags: any[];
  refs: any[];
  commands?: any[];
  exported_at?: number;
}

/** Returns an error message when the dump is invalid, otherwise null. */
export function validateWorkspaceDump(dump: any): string | null {
  if (!dump || typeof dump !== 'object') return 'Not a JSON object';
  if (!Array.isArray(dump.nodes)) return 'Missing "nodes" array';
  if (!Array.isArray(dump.tags)) return 'Missing "tags" array';
  if (!Array.isArray(dump.refs)) return 'Missing "refs" array';
  for (const n of dump.nodes) {
    if (!n || typeof n.id !== 'string' || typeof n.content !== 'string') {
      return 'Every node must have string "id" and "content"';
    }
  }
  return null;
}

/**
 * Remaps every node id (and every reference to it) to a fresh id so an import
 * never collides with or overwrites existing workspace data.
 */
export function remapWorkspaceDumpIds(
  dump: WorkspaceDump,
  genId: () => string
): WorkspaceDump {
  const idMap = new Map<string, string>();
  for (const n of dump.nodes) {
    idMap.set(n.id, genId());
  }
  const remap = (id: any) => (typeof id === 'string' && idMap.has(id) ? idMap.get(id)! : id);
  const remapMeta = (meta: any): any => {
    if (!meta) return meta;
    let text = typeof meta === 'string' ? meta : JSON.stringify(meta);
    for (const [oldId, newId] of idMap) {
      text = text.split(oldId).join(newId);
    }
    return text;
  };

  return {
    exported_at: dump.exported_at,
    nodes: dump.nodes.map((n) => ({
      ...n,
      id: remap(n.id),
      parent_id: n.parent_id ? remap(n.parent_id) : null,
      meta: remapMeta(n.meta),
    })),
    tags: dump.tags.map((t) => ({
      ...t,
      node_id: remap(t.node_id),
      tag_def_id: remap(t.tag_def_id),
    })),
    refs: dump.refs.map((r) => ({
      ...r,
      source_node_id: remap(r.source_node_id),
      target_node_id: remap(r.target_node_id),
    })),
    commands: dump.commands,
  };
}

/** Renders ExportableNodes as a Markdown outline (bullets, fields, checkboxes). */
export function exportableToMarkdown(nodes: ExportableNode[]): string {
  const lines: string[] = [];

  function render(node: ExportableNode, depth: number) {
    const indent = '  '.repeat(depth);
    const checkbox = node.isDone === true ? '[x] ' : node.isDone === false ? '[ ] ' : '';
    const tags = (node.tags || []).map((t) => `#${t}`).join(' ');
    lines.push(`${indent}- ${checkbox}${node.content}${tags ? ` ${tags}` : ''}`);

    for (const f of node.fields || []) {
      lines.push(`${'  '.repeat(depth + 1)}- ${f.name}:: ${f.value}`);
    }
    for (const c of node.children || []) {
      render(c, depth + 1);
    }
  }

  for (const n of nodes) render(n, 0);
  return lines.join('\n') + '\n';
}
