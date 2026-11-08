import { MaturityRung } from '../types';

export interface NodeStructureInfo {
  id: string;
  content: string;
  done_at: number | null;
  meta?: any;
  hasTrackedTag: boolean;
  fieldCount: number;
  filledFieldCount: number;
  statusFieldValue?: string;
  children: {
    id: string;
    content: string;
    isActionable: boolean;
    isDone: boolean;
  }[];
}

/**
 * S1 Maturity Rung (Section 5)
 */
export function computeMaturityRung(info: NodeStructureInfo): MaturityRung | null {
  if (!info.hasTrackedTag) {
    return null;
  }

  // Done check
  if (info.done_at !== null || info.statusFieldValue?.toLowerCase() === 'done') {
    return 'done';
  }

  // Active check: >= 1 actionable child done, or Status field = Doing
  const actionableChildren = info.children.filter((c) => c.isActionable);
  const doneActionableChildren = actionableChildren.filter((c) => c.isDone);

  if (
    doneActionableChildren.length > 0 ||
    info.statusFieldValue?.toLowerCase() === 'doing' ||
    info.statusFieldValue?.toLowerCase() === 'in progress'
  ) {
    return 'active';
  }

  // Planned check: >= 1 actionable child, none done
  if (actionableChildren.length > 0) {
    return 'planned';
  }

  // Explored check: has children (non-field children or notes) but none actionable
  if (info.children.length > 0 || info.filledFieldCount > 0) {
    return 'explored';
  }

  // Seed check: no children, no filled fields, content <= 120 chars
  if ((info.content || '').length <= 120) {
    return 'seed';
  }

  return 'explored';
}
