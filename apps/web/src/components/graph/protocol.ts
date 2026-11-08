import { CommunityMap } from './communities';
import { GraphData } from './layout';
import { GraphForceSettings } from './physics';

export type GraphWorkerRequest =
  | { type: 'set-data'; revision: number; data: GraphData; communities: CommunityMap; forces: GraphForceSettings; reset: boolean }
  | { type: 'set-forces'; revision: number; data: GraphData; communities: CommunityMap; forces: GraphForceSettings }
  | { type: 'pin'; id: string; x: number; y: number }
  | { type: 'unpin'; id: string }
  | { type: 'reheat'; alpha: number }
  | { type: 'dispose' };

export interface GraphPositionsMessage {
  type: 'positions';
  revision: number;
  ids: string[];
  buffer: ArrayBuffer;
  alpha: number;
  settled: boolean;
}

export function isCurrentGraphRevision(incoming: number, current: number): boolean {
  return incoming === current;
}
