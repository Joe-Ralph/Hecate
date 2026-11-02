import { describe, it, expect } from 'vitest';
import { UndoStack, Operation } from '../src/operations/undoStack';

describe('Undo / Redo Stack', () => {
  it('records operations and inverts them on undo', () => {
    const stack = new UndoStack(200);

    const op1: Operation = {
      type: 'updateContent',
      nodeId: 'node_1',
      before: 'Hello',
      after: 'Hello World',
    };

    stack.push(op1);
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);

    const inverted = stack.undo();
    expect(inverted).toBeDefined();
    expect(inverted?.type).toBe('updateContent');
    if (inverted?.type === 'updateContent') {
      expect(inverted.before).toBe('Hello World');
      expect(inverted.after).toBe('Hello');
    }

    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(true);

    const redone = stack.redo();
    expect(redone).toEqual(op1);
  });

  it('respects max depth constraint of 200', () => {
    const stack = new UndoStack(5);
    for (let i = 0; i < 10; i++) {
      stack.push({
        type: 'updateContent',
        nodeId: `node_${i}`,
        before: `${i}`,
        after: `${i + 1}`,
      });
    }

    expect(stack.depth.undo).toBe(5);
  });
});
