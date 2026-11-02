/**
 * Tana Paste Parser
 * Pure implementation of Tana Paste specification.
 */

export interface ParsedField {
  name: string;
  value: string;
}

export interface ParsedTanaNode {
  raw: string;
  content: string;
  tags: string[]; // Tag names (e.g. 'book', 'my tag')
  fields: ParsedField[];
  children: ParsedTanaNode[];
  isDone?: boolean;
}

const FIELD_REGEX = /^([^:\n]+)::\s*(.*)$/;
const TAG_REGEX = /#\[\[([^\]]+)\]\]|#([a-zA-Z0-9_\-\/]+)/g;

export function isTanaPaste(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.startsWith('%%tana%%')) return true;
  // Also check if text looks like an indented bullet outline with tags or fields
  const lines = trimmed.split('\n');
  const bulletLines = lines.filter((l) => /^\s*[-*]\s+/.test(l));
  return bulletLines.length >= 1 && (text.includes('::') || text.includes('#') || text.includes('[[')) || bulletLines.length >= 2;
}

interface RawLine {
  indent: number;
  line: string;
}

export function parseTanaPaste(text: string): ParsedTanaNode[] {
  if (!text) return [];

  const lines = text.split('\n');
  const rawLines: RawLine[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim() === '%%tana%%') continue;
    if (line.trim().length === 0) continue;

    // Count indentation (2 spaces = 1 level, 4 spaces = 2 levels, tab = 1 level)
    const matchIndent = line.match(/^(\s*)/);
    const whitespace = matchIndent ? matchIndent[1] : '';
    let indent = 0;
    for (let i = 0; i < whitespace.length; i++) {
      if (whitespace[i] === '\t') indent += 1;
      else if (whitespace[i] === ' ' && whitespace[i + 1] === ' ') {
        indent += 1;
        i++;
      }
    }

    const stripped = line.trim();
    // Strip leading bullet "- " or "* " if present
    const bulletStripped = stripped.replace(/^[-*]\s+/, '');

    rawLines.push({
      indent,
      line: bulletStripped,
    });
  }

  // Parse lines into hierarchy
  const roots: ParsedTanaNode[] = [];
  const stack: { node: ParsedTanaNode; indent: number }[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const { indent, line } = rawLines[i];

    // Check if this line is a field attached to parent: Name:: value
    const fieldMatch = line.match(FIELD_REGEX);
    if (fieldMatch && stack.length > 0 && indent > stack[stack.length - 1].indent) {
      // It's a field for the current parent node
      const parent = stack[stack.length - 1].node;
      parent.fields.push({
        name: fieldMatch[1].trim(),
        value: fieldMatch[2].trim(),
      });
      continue;
    }

    // Extract checkbox state
    let content = line;
    let isDone: boolean | undefined = undefined;
    if (content.startsWith('[ ] ')) {
      isDone = false;
      content = content.slice(4);
    } else if (content.startsWith('[x] ') || content.startsWith('[X] ')) {
      isDone = true;
      content = content.slice(4);
    }

    // Extract tags
    const tags: string[] = [];
    const tagMatches = content.matchAll(TAG_REGEX);
    for (const m of tagMatches) {
      const tagName = m[1] || m[2];
      if (tagName) {
        tags.push(tagName.trim());
      }
    }

    // Clean tags from main content string for display if desired, or retain tokens
    // In Tana, tags are usually kept or separated. We keep content clean with inline references preserved.
    const cleanContent = content.replace(TAG_REGEX, '').trim();

    const node: ParsedTanaNode = {
      raw: line,
      content: cleanContent,
      tags,
      fields: [],
      children: [],
      isDone,
    };

    // Find parent in stack
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, indent });
  }

  return roots;
}
