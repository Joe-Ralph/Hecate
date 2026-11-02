/**
 * Hecate Live Search Query Types
 */

export type QueryOp = 'AND' | 'OR' | 'NOT';

export type FieldCmp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'lt'
  | 'gt'
  | 'between'
  | 'in'
  | 'empty'
  | 'notEmpty';

export interface HasTagClause {
  type: 'hasTag';
  tagId: string;
  includeDescendants?: boolean;
}

export interface FieldClause {
  type: 'field';
  fieldDefId: string;
  cmp: FieldCmp;
  value?: any;
}

export interface DateClause {
  type: 'date';
  on: 'created_at' | 'updated_at' | 'done_at' | string;
  range: string; // 'today' | 'thisWeek' | 'lastNDays:7' | 'custom:start,end'
}

export interface ReferencesClause {
  type: 'references';
  nodeId: string; // May be "$thisNode"
}

export interface ChildOfClause {
  type: 'childOf';
  nodeId: string; // May be "$thisNode"
  deep?: boolean;
}

export interface TextClause {
  type: 'text';
  q: string;
}

export interface DoneClause {
  type: 'done';
  value: boolean;
}

export interface NestedGroupClause {
  op: QueryOp;
  clauses: QueryClause[];
}

export type QueryClause =
  | HasTagClause
  | FieldClause
  | DateClause
  | ReferencesClause
  | ChildOfClause
  | TextClause
  | DoneClause
  | NestedGroupClause;

export interface QuerySort {
  by: 'field' | 'created_at' | 'updated_at' | 'manual' | 'position';
  fieldDefId?: string;
  dir: 'asc' | 'desc';
}

export interface QueryGroup {
  by: string; // fieldDefId or 'tag'
}

export interface SearchQuery {
  op?: QueryOp;
  clauses: QueryClause[];
  sort?: QuerySort[];
  group?: QueryGroup;
  limit?: number;
}
