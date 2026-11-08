import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { SearchQuery, QueryClause, FieldCmp } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface QueryBuilderProps {
  query: SearchQuery;
  onChange: (query: SearchQuery) => void;
}

const CLAUSE_TYPES = [
  { id: 'hasTag', label: 'Has tag' },
  { id: 'field', label: 'Field' },
  { id: 'text', label: 'Text contains' },
  { id: 'date', label: 'Date' },
  { id: 'done', label: 'Done state' },
  { id: 'references', label: 'References node' },
  { id: 'childOf', label: 'Child of' },
];

const FIELD_CMPS: FieldCmp[] = [
  'eq',
  'neq',
  'contains',
  'lt',
  'gt',
  'between',
  'in',
  'empty',
  'notEmpty',
];

const inputClass =
  'h-7 px-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[6px] text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';
const selectClass = inputClass + ' cursor-pointer';

export const QueryBuilder: React.FC<QueryBuilderProps> = ({ query, onChange }) => {
  const store = useWorkspaceStore();
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);
  const [fieldDefs, setFieldDefs] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!store.db) return;
    store.db.tags.getAllTags().then((t) => setTags(t.map((x) => ({ id: x.id, name: x.content }))));
    store.db.tags
      .getAllFieldDefs()
      .then((f) => setFieldDefs(f.map((x) => ({ id: x.id, name: x.content }))));
  }, [store.db, store.version]);

  const updateClauses = (clauses: QueryClause[]) => onChange({ ...query, clauses });

  const updateClause = (idx: number, clause: QueryClause) => {
    const next = [...query.clauses];
    next[idx] = clause;
    updateClauses(next);
  };

  const removeClause = (idx: number) => {
    updateClauses(query.clauses.filter((_, i) => i !== idx));
  };

  const newClause = (type: string): QueryClause => {
    switch (type) {
      case 'hasTag':
        return { type: 'hasTag', tagId: tags[0]?.id || '', includeDescendants: true };
      case 'field':
        return { type: 'field', fieldDefId: fieldDefs[0]?.id || '', cmp: 'eq', value: '' };
      case 'text':
        return { type: 'text', q: '' };
      case 'date':
        return { type: 'date', on: 'created_at', range: 'thisWeek' };
      case 'done':
        return { type: 'done', value: false };
      case 'references':
        return { type: 'references', nodeId: '$thisNode' };
      case 'childOf':
        return { type: 'childOf', nodeId: '$thisNode', deep: true };
      default:
        return { type: 'text', q: '' };
    }
  };

  const renderClause = (clause: QueryClause, idx: number, onUpdate: (c: QueryClause) => void, onRemove: () => void) => {
    const clauseType = 'type' in clause ? clause.type : 'group';

    return (
      <div key={idx} className="flex items-center space-x-2 flex-wrap gap-y-1.5">
        <select
          value={clauseType}
          onChange={(e) => onUpdate(newClause(e.target.value))}
          className={selectClass}
        >
          {CLAUSE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        {clauseType === 'hasTag' && 'tagId' in clause && (
          <>
            <select
              value={clause.tagId}
              onChange={(e) => onUpdate({ ...clause, tagId: e.target.value })}
              className={selectClass}
            >
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.name}
                </option>
              ))}
            </select>
            <label className="flex items-center space-x-1 text-[11px] text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={clause.includeDescendants ?? true}
                onChange={(e) => onUpdate({ ...clause, includeDescendants: e.target.checked })}
              />
              <span>incl. subtags</span>
            </label>
          </>
        )}

        {clauseType === 'field' && 'fieldDefId' in clause && (
          <>
            <select
              value={clause.fieldDefId}
              onChange={(e) => onUpdate({ ...clause, fieldDefId: e.target.value })}
              className={selectClass}
            >
              {fieldDefs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={clause.cmp}
              onChange={(e) => onUpdate({ ...clause, cmp: e.target.value as FieldCmp })}
              className={selectClass}
            >
              {FIELD_CMPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {!['empty', 'notEmpty'].includes(clause.cmp) && (
              <input
                type="text"
                value={clause.value ?? ''}
                onChange={(e) => onUpdate({ ...clause, value: e.target.value })}
                placeholder="value"
                className={inputClass + ' w-28'}
              />
            )}
          </>
        )}

        {clauseType === 'text' && 'q' in clause && (
          <input
            type="text"
            value={clause.q}
            onChange={(e) => onUpdate({ ...clause, q: e.target.value })}
            placeholder="search text"
            className={inputClass + ' w-40'}
          />
        )}

        {clauseType === 'date' && 'on' in clause && (
          <>
            <select
              value={clause.on}
              onChange={(e) => onUpdate({ ...clause, on: e.target.value })}
              className={selectClass}
            >
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="done_at">Done</option>
            </select>
            <select
              value={clause.range}
              onChange={(e) => onUpdate({ ...clause, range: e.target.value })}
              className={selectClass}
            >
              <option value="today">Today</option>
              <option value="thisWeek">This week</option>
              <option value="lastNDays:7">Last 7 days</option>
              <option value="lastNDays:30">Last 30 days</option>
            </select>
          </>
        )}

        {clauseType === 'done' && 'value' in clause && (
          <select
            value={String(clause.value)}
            onChange={(e) => onUpdate({ ...clause, value: e.target.value === 'true' })}
            className={selectClass}
          >
            <option value="false">Not done</option>
            <option value="true">Done</option>
          </select>
        )}

        {(clauseType === 'references' || clauseType === 'childOf') && 'nodeId' in clause && (
          <>
            <input
              type="text"
              value={clause.nodeId}
              onChange={(e) => onUpdate({ ...clause, nodeId: e.target.value })}
              placeholder="node id or $thisNode"
              className={inputClass + ' w-44 font-mono'}
            />
            <button
              type="button"
              onClick={() => onUpdate({ ...clause, nodeId: '$thisNode' })}
              className="text-[11px] font-mono text-[var(--accent)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Resolve to the node this search lives on"
            >
              $thisNode
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove clause"
          className="p-1 rounded-[4px] text-[var(--text-faint)] hover:text-[var(--red)] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          Query
        </div>
        <select
          value={query.op || 'AND'}
          onChange={(e) => onChange({ ...query, op: e.target.value as any })}
          className={selectClass}
        >
          <option value="AND">Match all (AND)</option>
          <option value="OR">Match any (OR)</option>
        </select>
      </div>

      <div className="space-y-2">
        {query.clauses.map((clause, idx) =>
          'clauses' in clause ? (
            <div key={idx} className="pl-3 border-l-2 border-[var(--border-accent)] space-y-2">
              <div className="flex items-center space-x-2">
                <select
                  value={clause.op}
                  onChange={(e) =>
                    updateClause(idx, { ...clause, op: e.target.value as any })
                  }
                  className={selectClass}
                >
                  <option value="AND">Group: AND</option>
                  <option value="OR">Group: OR</option>
                  <option value="NOT">Group: NOT</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    updateClause(idx, {
                      ...clause,
                      clauses: [...clause.clauses, { type: 'text', q: '' }],
                    })
                  }
                  className="text-[11px] font-mono text-[var(--accent)] cursor-pointer hover:text-[var(--text-primary)]"
                >
                  + clause
                </button>
                <button
                  type="button"
                  onClick={() => removeClause(idx)}
                  aria-label="Remove group"
                  className="p-1 rounded-[4px] text-[var(--text-faint)] hover:text-[var(--red)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {clause.clauses.map((sub, subIdx) =>
                renderClause(
                  sub,
                  subIdx,
                  (c) => {
                    const nextSubs = [...clause.clauses];
                    nextSubs[subIdx] = c;
                    updateClause(idx, { ...clause, clauses: nextSubs });
                  },
                  () =>
                    updateClause(idx, {
                      ...clause,
                      clauses: clause.clauses.filter((_, i) => i !== subIdx),
                    })
                )
              )}
            </div>
          ) : (
            renderClause(clause, idx, (c) => updateClause(idx, c), () => removeClause(idx))
          )
        )}
      </div>

      <div className="flex items-center space-x-3 pt-1">
        <button
          type="button"
          onClick={() => updateClauses([...query.clauses, newClause('text')])}
          className="flex items-center space-x-1 text-[12px] text-[var(--accent)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add clause</span>
        </button>
        <button
          type="button"
          onClick={() =>
            updateClauses([...query.clauses, { op: 'OR', clauses: [{ type: 'text', q: '' }] }])
          }
          className="flex items-center space-x-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add group</span>
        </button>
      </div>

      <div className="flex items-center space-x-3 pt-2 border-t border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)]">
        <label className="flex items-center space-x-1.5">
          <span>Sort</span>
          <select
            value={query.sort?.[0]?.by || ''}
            onChange={(e) => {
              const by = e.target.value;
              onChange({
                ...query,
                sort: by ? [{ by: by as any, dir: query.sort?.[0]?.dir || 'desc' }] : [],
              });
            }}
            className={selectClass}
          >
            <option value="">Default</option>
            <option value="created_at">Created</option>
            <option value="updated_at">Updated</option>
          </select>
        </label>
        <label className="flex items-center space-x-1.5">
          <span>Limit</span>
          <input
            type="number"
            value={query.limit ?? 500}
            onChange={(e) => onChange({ ...query, limit: Number(e.target.value) || 500 })}
            className={inputClass + ' w-20'}
          />
        </label>
      </div>
    </div>
  );
};
