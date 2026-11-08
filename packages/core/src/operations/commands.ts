/**
 * Node command executor (REQ-6.2).
 * Pure orchestration over caller-provided context; all side effects go through
 * the context so callers can route them through the undo stack.
 */

import { CommandStep } from '../types';
import { formatDate } from '../date/natural';

export interface CommandContext {
  getFieldValue: (nodeId: string, fieldDefId: string) => Promise<string | null>;
  setField: (nodeId: string, fieldDefId: string, value: string) => Promise<void>;
  addTag: (nodeId: string, tagId: string) => Promise<void>;
  removeTag: (nodeId: string, tagId: string) => Promise<void>;
  setDone: (nodeId: string, done: boolean) => Promise<void>;
  moveTo: (nodeId: string, targetParentId: string) => Promise<void>;
}

export async function runCommand(
  nodeId: string,
  steps: CommandStep[],
  ctx: CommandContext
): Promise<void> {
  for (const step of steps) {
    switch (step.type) {
      case 'setField':
        await ctx.setField(nodeId, step.fieldDefId, String(step.value ?? ''));
        break;

      case 'addTag':
        await ctx.addTag(nodeId, step.tagId);
        break;

      case 'removeTag':
        await ctx.removeTag(nodeId, step.tagId);
        break;

      case 'setDone':
        await ctx.setDone(nodeId, step.done);
        break;

      case 'shiftDate': {
        const current = await ctx.getFieldValue(nodeId, step.fieldDefId);
        const isoMatch = current?.match(/(\d{4}-\d{2}-\d{2})/);
        const baseIso = isoMatch ? isoMatch[1] : formatDate(new Date());
        const d = new Date(`${baseIso}T00:00:00`);
        d.setDate(d.getDate() + step.days);
        await ctx.setField(nodeId, step.fieldDefId, `[[date:${formatDate(d)}]]`);
        break;
      }

      case 'moveTo':
        await ctx.moveTo(nodeId, step.targetParentId);
        break;
    }
  }
}

export interface BuiltinCommand {
  id: string;
  name: string;
  description: string;
}

export const BUILTIN_COMMANDS: BuiltinCommand[] = [
  { id: 'set-due-today', name: 'Set date to today', description: 'Sets the Due field to today' },
  { id: 'delay-one-day', name: 'Delay one day', description: 'Shifts the Due date by +1 day' },
  { id: 'delay-one-week', name: 'Delay one week', description: 'Shifts the Due date by +7 days' },
  { id: 'status-done', name: 'Change status to Done', description: 'Sets Status to Done' },
  { id: 'toggle-done', name: 'Toggle done', description: 'Toggles the completion checkbox' },
  { id: 'duplicate', name: 'Duplicate', description: 'Deep-copies this node as a sibling' },
  { id: 'move-to', name: 'Move to…', description: 'Moves this node under another node' },
  { id: 'copy-tana-paste', name: 'Copy as Tana Paste', description: 'Copies the subtree to clipboard' },
];
