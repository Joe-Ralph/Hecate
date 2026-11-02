/**
 * Tana Paste Serializer
 * Converts node structures to Tana Paste format for clipboard and export.
 */

export interface ExportableNode {
  content: string;
  isDone?: boolean | null;
  tags?: string[];
  fields?: Array<{ name: string; value: string }>;
  children?: ExportableNode[];
}

export function serializeTanaPaste(nodes: ExportableNode[]): string {
  const lines: string[] = ['%%tana%%'];

  function serializeNode(node: ExportableNode, depth: number) {
    const indent = '  '.repeat(depth);
    let line = `${indent}- `;

    if (node.isDone === true) {
      line += '[x] ';
    } else if (node.isDone === false) {
      line += '[ ] ';
    }

    line += node.content;

    if (node.tags && node.tags.length > 0) {
      for (const tag of node.tags) {
        if (tag.includes(' ')) {
          line += ` #[[${tag}]]`;
        } else {
          line += ` #${tag}`;
        }
      }
    }

    lines.push(line);

    // Serialize attached fields
    if (node.fields && node.fields.length > 0) {
      const fieldIndent = '  '.repeat(depth + 1);
      for (const field of node.fields) {
        lines.push(`${fieldIndent}- ${field.name}:: ${field.value}`);
      }
    }

    // Serialize children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        serializeNode(child, depth + 1);
      }
    }
  }

  for (const root of nodes) {
    serializeNode(root, 0);
  }

  return lines.join('\n');
}
