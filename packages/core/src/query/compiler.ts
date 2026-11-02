/**
 * Hecate Live Query Compiler
 * Compiles a SearchQuery JSON into SQL with parameterized values.
 * Resolves $thisNode contextual token and supports live queries.
 */

import { SearchQuery, QueryClause, QueryOp } from './types';

export interface CompiledQuery {
  sql: string;
  params: any[];
}

export interface CompilerOptions {
  contextNodeId?: string | null;
  getTagDescendants?: (tagId: string) => string[];
  now?: number;
}

export function compileQueryToSql(
  query: SearchQuery,
  options: CompilerOptions = {}
): CompiledQuery {
  const params: any[] = [];
  const now = options.now || Date.now();
  const contextNodeId = options.contextNodeId || null;

  function resolveNodeId(id: string): string {
    if (id === '$thisNode') {
      if (!contextNodeId) {
        throw new Error('Query contains $thisNode token but no contextNodeId was provided');
      }
      return contextNodeId;
    }
    return id;
  }

  function compileClause(clause: QueryClause): string {
    if ('op' in clause && Array.isArray((clause as any).clauses)) {
      const groupOp = (clause as any).op as QueryOp;
      const subClauses = (clause as any).clauses as QueryClause[];
      if (subClauses.length === 0) return '1=1';

      if (groupOp === 'NOT') {
        const compiled = subClauses.map((c) => compileClause(c)).join(' AND ');
        return `NOT (${compiled})`;
      }

      const sqlOp = groupOp === 'OR' ? ' OR ' : ' AND ';
      const compiled = subClauses.map((c) => `(${compileClause(c)})`).join(sqlOp);
      return compiled;
    }

    switch (clause.type) {
      case 'hasTag': {
        const tagId = clause.tagId;
        const allTags = [tagId];
        if (clause.includeDescendants && options.getTagDescendants) {
          allTags.push(...options.getTagDescendants(tagId));
        }

        if (allTags.length === 1) {
          params.push(allTags[0]);
          return `node.id IN (SELECT node_id FROM node_tag WHERE tag_def_id = ?)`;
        } else {
          const placeholders = allTags.map(() => '?').join(', ');
          params.push(...allTags);
          return `node.id IN (SELECT node_id FROM node_tag WHERE tag_def_id IN (${placeholders}))`;
        }
      }

      case 'field': {
        const fieldDefId = clause.fieldDefId;
        const cmp = clause.cmp;
        const val = clause.value;

        if (cmp === 'empty') {
          params.push(fieldDefId);
          return `node.id NOT IN (
            SELECT f.parent_id FROM node f
            JOIN node v ON v.parent_id = f.id
            WHERE f.kind = 'field' AND json_extract(f.meta, '$.fieldDefId') = ? AND v.content IS NOT NULL AND v.content != ''
          )`;
        }

        if (cmp === 'notEmpty') {
          params.push(fieldDefId);
          return `node.id IN (
            SELECT f.parent_id FROM node f
            JOIN node v ON v.parent_id = f.id
            WHERE f.kind = 'field' AND json_extract(f.meta, '$.fieldDefId') = ? AND v.content IS NOT NULL AND v.content != ''
          )`;
        }

        let valueCondition = '';
        if (cmp === 'eq') {
          valueCondition = 'v.content = ?';
          params.push(String(val));
        } else if (cmp === 'neq') {
          valueCondition = 'v.content != ?';
          params.push(String(val));
        } else if (cmp === 'contains') {
          valueCondition = `v.content LIKE '%' || ? || '%'`;
          params.push(String(val));
        } else if (cmp === 'lt') {
          valueCondition = 'CAST(v.content AS REAL) < ?';
          params.push(Number(val));
        } else if (cmp === 'gt') {
          valueCondition = 'CAST(v.content AS REAL) > ?';
          params.push(Number(val));
        } else if (cmp === 'in') {
          const list = Array.isArray(val) ? val : [val];
          const placeholders = list.map(() => '?').join(', ');
          valueCondition = `v.content IN (${placeholders})`;
          params.push(...list.map(String));
        } else {
          valueCondition = 'v.content = ?';
          params.push(String(val));
        }

        params.unshift(fieldDefId);
        return `node.id IN (
          SELECT f.parent_id FROM node f
          JOIN node v ON v.parent_id = f.id
          WHERE f.kind = 'field' AND json_extract(f.meta, '$.fieldDefId') = ? AND ${valueCondition}
        )`;
      }

      case 'references': {
        const targetId = resolveNodeId(clause.nodeId);
        params.push(targetId);
        return `node.id IN (SELECT source_node_id FROM ref WHERE target_node_id = ?)`;
      }

      case 'childOf': {
        const parentId = resolveNodeId(clause.nodeId);
        if (clause.deep) {
          params.push(parentId);
          return `node.id IN (
            WITH RECURSIVE tree AS (
              SELECT id FROM node WHERE parent_id = ?
              UNION ALL
              SELECT n.id FROM node n JOIN tree t ON n.parent_id = t.id
            )
            SELECT id FROM tree
          )`;
        }
        params.push(parentId);
        return `node.parent_id = ?`;
      }

      case 'text': {
        const q = clause.q.trim();
        params.push(`%${q}%`);
        return `node.content LIKE ?`;
      }

      case 'done': {
        return clause.value ? `node.done_at IS NOT NULL` : `node.done_at IS NULL`;
      }

      case 'date': {
        const col =
          clause.on === 'created_at' || clause.on === 'updated_at' || clause.on === 'done_at'
            ? `node.${clause.on}`
            : null;

        let startMs = 0;
        let endMs = Infinity;

        if (clause.range === 'today') {
          const d = new Date(now);
          d.setHours(0, 0, 0, 0);
          startMs = d.getTime();
          d.setHours(23, 59, 59, 999);
          endMs = d.getTime();
        } else if (clause.range === 'thisWeek') {
          const d = new Date(now);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
          d.setDate(diff);
          d.setHours(0, 0, 0, 0);
          startMs = d.getTime();
          endMs = startMs + 7 * 24 * 60 * 60 * 1000 - 1;
        } else if (clause.range.startsWith('lastNDays:')) {
          const days = parseInt(clause.range.split(':')[1], 10) || 7;
          startMs = now - days * 24 * 60 * 60 * 1000;
          endMs = now;
        } else if (clause.range.startsWith('custom:')) {
          const parts = clause.range.slice(7).split(',');
          startMs = parseInt(parts[0], 10) || 0;
          endMs = parseInt(parts[1], 10) || Infinity;
        }

        if (col) {
          params.push(startMs, endMs);
          return `(${col} >= ? AND ${col} <= ?)`;
        } else {
          // Date is on a field
          const fieldDefId = clause.on;
          params.push(fieldDefId, String(startMs), String(endMs));
          return `node.id IN (
            SELECT f.parent_id FROM node f
            JOIN node v ON v.parent_id = f.id
            WHERE f.kind = 'field' AND json_extract(f.meta, '$.fieldDefId') = ? AND v.content >= ? AND v.content <= ?
          )`;
        }
      }

      default:
        return '1=1';
    }
  }

  // Base WHERE clause
  const whereClauses: string[] = ['node.deleted_at IS NULL'];

  // Root op
  const rootOp = query.op || 'AND';
  if (query.clauses && query.clauses.length > 0) {
    if (rootOp === 'NOT') {
      const compiled = query.clauses.map((c) => compileClause(c)).join(' AND ');
      whereClauses.push(`NOT (${compiled})`);
    } else {
      const sqlOp = rootOp === 'OR' ? ' OR ' : ' AND ';
      const compiled = query.clauses.map((c) => `(${compileClause(c)})`).join(sqlOp);
      whereClauses.push(`(${compiled})`);
    }
  }

  // Sorting
  let orderBy = 'node.position ASC';
  if (query.sort && query.sort.length > 0) {
    const sortParts: string[] = [];
    for (const s of query.sort) {
      const dir = s.dir === 'desc' ? 'DESC' : 'ASC';
      if (s.by === 'created_at') sortParts.push(`node.created_at ${dir}`);
      else if (s.by === 'updated_at') sortParts.push(`node.updated_at ${dir}`);
      else if (s.by === 'position' || s.by === 'manual') sortParts.push(`node.position ${dir}`);
    }
    if (sortParts.length > 0) {
      orderBy = sortParts.join(', ');
    }
  }

  const limit = query.limit && query.limit > 0 ? query.limit : 500;
  params.push(limit);

  const sql = `
    SELECT node.*
    FROM node
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ?
  `.trim();

  return { sql, params };
}
