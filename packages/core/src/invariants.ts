/**
 * Hecate Core Invariants & Graph Integrity Checks
 */

/**
 * Checks if moving nodeId to become a child of targetParentId would cause a cycle.
 * Traverses up the ancestor tree of targetParentId. If nodeId is encountered, it's a cycle.
 */
export function wouldCauseCycle(
  nodeId: string,
  targetParentId: string | null,
  getParentId: (id: string) => string | null | undefined
): boolean {
  if (!targetParentId) return false;
  if (nodeId === targetParentId) return true;

  let current: string | null | undefined = targetParentId;
  const visited = new Set<string>();

  while (current) {
    if (current === nodeId) {
      return true;
    }
    if (visited.has(current)) {
      // Loop already present in existing tree
      return true;
    }
    visited.add(current);
    current = getParentId(current);
  }

  return false;
}

/**
 * Checks if extending parentTagIds would introduce a circular inheritance chain for tagId.
 */
export function wouldCauseTagCycle(
  tagId: string,
  candidateExtends: string[],
  getTagExtends: (id: string) => string[]
): boolean {
  if (candidateExtends.includes(tagId)) return true;

  const queue = [...candidateExtends];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === tagId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const parents = getTagExtends(current) || [];
    for (const p of parents) {
      if (p === tagId) return true;
      if (!visited.has(p)) {
        queue.push(p);
      }
    }
  }

  return false;
}

/**
 * Regex for inline tokens
 */
export const NODE_REF_REGEX = /\[\[node:([A-Za-z0-9_-]+)\]\]/g;
export const TAG_CHIP_REGEX = /#\[\[tag:([A-Za-z0-9_-]+)\]\]/g;
export const DATE_TOKEN_REGEX = /\[\[date:(\d{4}-\d{2}-\d{2})\]\]/g;
export const PLAIN_TAG_REGEX = /(?:^|\s)#([a-zA-Z0-9_\-]+|\[\[([^\]]+)\]\])/g;

/**
 * Extracts all referenced node IDs from a text string.
 */
export function extractReferencedNodeIds(text: string): string[] {
  if (!text) return [];
  const matches: string[] = [];
  const regex = new RegExp(NODE_REF_REGEX.source, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return Array.from(new Set(matches));
}

/**
 * Extracts all tag IDs from inline markup in content.
 */
export function extractTagDefIds(text: string): string[] {
  if (!text) return [];
  const matches: string[] = [];
  const regex = new RegExp(TAG_CHIP_REGEX.source, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return Array.from(new Set(matches));
}

/**
 * Extracts all date tokens from content.
 */
export function extractDateTokens(text: string): string[] {
  if (!text) return [];
  const matches: string[] = [];
  const regex = new RegExp(DATE_TOKEN_REGEX.source, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return Array.from(new Set(matches));
}

/**
 * Converts references [[node:<id>]] to plain text snapshot when target is deleted.
 */
export function convertReferencesToSnapshot(
  text: string,
  deletedNodeId: string,
  snapshotText: string
): string {
  const token = `[[node:${deletedNodeId}]]`;
  return text.replaceAll(token, snapshotText || '[Deleted node]');
}

/**
 * Checks if a node entry is untitled with no content.
 * Returns true if content is empty string, whitespace only, or standard "untitled" strings.
 */
export function isUntitledOrEmpty(content?: string | null): boolean {
  if (!content) return true;
  const trimmed = content.trim();
  if (trimmed === '') return true;
  const lower = trimmed.toLowerCase();
  return lower === 'untitled' || lower === 'untitled node';
}

