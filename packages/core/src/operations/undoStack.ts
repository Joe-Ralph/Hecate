/**
 * Hecate Undo/Redo Operation Stack
 * Records atomic operations and supports 200+ step reversible history.
 */

export type Operation =
  | {
      type: 'updateContent';
      nodeId: string;
      before: string;
      after: string;
    }
  | {
      type: 'moveNode';
      nodeId: string;
      beforeParentId: string | null;
      afterParentId: string | null;
      beforePosition: string;
      afterPosition: string;
    }
  | {
      type: 'setDone';
      nodeId: string;
      before: number | null;
      after: number | null;
    }
  | {
      type: 'setCollapsed';
      nodeId: string;
      before: number;
      after: number;
    }
  | {
      type: 'addTag';
      nodeId: string;
      tagId: string;
    }
  | {
      type: 'removeTag';
      nodeId: string;
      tagId: string;
    }
  | {
      type: 'setFieldValue';
      fieldNodeId: string;
      fieldValueNodeId: string;
      before: string;
      after: string;
    }
  | {
      type: 'batch';
      operations: Operation[];
      description?: string;
    };

export class UndoStack {
  private undoStack: Operation[] = [];
  private redoStack: Operation[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 200) {
    this.maxDepth = maxDepth;
  }

  push(op: Operation): void {
    this.undoStack.push(op);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): Operation | null {
    const op = this.undoStack.pop();
    if (!op) return null;
    this.redoStack.push(op);
    // Return the original operation; callers apply its before-state to undo.
    return op;
  }

  redo(): Operation | null {
    const op = this.redoStack.pop();
    if (!op) return null;
    this.undoStack.push(op);
    return op;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get depth(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }

  invert(op: Operation): Operation {
    switch (op.type) {
      case 'updateContent':
        return {
          type: 'updateContent',
          nodeId: op.nodeId,
          before: op.after,
          after: op.before,
        };
      case 'moveNode':
        return {
          type: 'moveNode',
          nodeId: op.nodeId,
          beforeParentId: op.afterParentId,
          afterParentId: op.beforeParentId,
          beforePosition: op.afterPosition,
          afterPosition: op.beforePosition,
        };
      case 'setDone':
        return {
          type: 'setDone',
          nodeId: op.nodeId,
          before: op.after,
          after: op.before,
        };
      case 'setCollapsed':
        return {
          type: 'setCollapsed',
          nodeId: op.nodeId,
          before: op.after,
          after: op.before,
        };
      case 'addTag':
        return {
          type: 'removeTag',
          nodeId: op.nodeId,
          tagId: op.tagId,
        };
      case 'removeTag':
        return {
          type: 'addTag',
          nodeId: op.nodeId,
          tagId: op.tagId,
        };
      case 'setFieldValue':
        return {
          type: 'setFieldValue',
          fieldNodeId: op.fieldNodeId,
          fieldValueNodeId: op.fieldValueNodeId,
          before: op.after,
          after: op.before,
        };
      case 'batch':
        return {
          type: 'batch',
          operations: [...op.operations].reverse().map((o) => this.invert(o)),
          description: op.description,
        };
    }
  }
}
