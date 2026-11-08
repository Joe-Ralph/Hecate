import React, { useState } from 'react';
import { NodeRecord } from '@hecate/core';
import { ArrowUp, ArrowDown, ArrowUpDown, EyeOff, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';

export interface TableColumn {
  id: string;
  name: string;
  fieldDefId?: string;
}

export interface TableViewProps {
  nodes?: NodeRecord[];
  columns?: TableColumn[];
  // nodeId -> columnId -> display value (real field values supplied by the caller)
  cellValues?: Record<string, Record<string, string>>;
  onNodeClick?: (nodeId: string) => void;
  onCellEdit?: (nodeId: string, columnId: string, newValue: string) => void;
  className?: string;
}

export const TableView: React.FC<TableViewProps> = ({
  nodes = [],
  columns = [],
  cellValues = {},
  onNodeClick,
  onCellEdit,
  className = '',
}) => {
  const [editingCell, setEditingCell] = useState<{ nodeId: string; colId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sort, setSort] = useState<{ colId: string; dir: 'asc' | 'desc' } | null>(null);
  const [hiddenColIds, setHiddenColIds] = useState<string[]>([]);
  const [colOrder, setColOrder] = useState<string[]>([]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const orderedColumns = (columns || [])
    .slice()
    .sort((a, b) => {
      const ia = colOrder.indexOf(a.id);
      const ib = colOrder.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  const visibleColumns = orderedColumns.filter((c) => !hiddenColIds.includes(c.id));
  const safeNodes = nodes || [];

  const getCellValue = (node: NodeRecord, colId: string): string => {
    return cellValues[node.id]?.[colId] ?? '';
  };

  const toggleSort = (colId: string) => {
    setSort((prev) =>
      prev?.colId === colId
        ? prev.dir === 'asc'
          ? { colId, dir: 'desc' }
          : null
        : { colId, dir: 'asc' }
    );
  };

  const sortedNodes = [...safeNodes].sort((a, b) => {
    if (!sort) return 0;
    const av = sort.colId === 'title' ? a.content : getCellValue(a, sort.colId);
    const bv = sort.colId === 'title' ? b.content : getCellValue(b, sort.colId);
    const an = Number(av);
    const bn = Number(bv);
    let cmp: number;
    if (av.trim() !== '' && bv.trim() !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
      cmp = an - bn;
    } else {
      cmp = av.localeCompare(bv);
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const moveColumn = (colId: string, dir: -1 | 1) => {
    const ids = orderedColumns.map((c) => c.id);
    const idx = ids.indexOf(colId);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[idx], next[target]] = [next[target], next[idx]];
    setColOrder(next);
  };

  const headerCell = (colId: string, label: string, extraClass = '') => (
    <th className={`py-2.5 px-4 border-r border-[var(--border-subtle)] last:border-r-0 ${extraClass}`}>
      <div className="flex items-center justify-between space-x-1 group/col">
        <button
          type="button"
          onClick={() => toggleSort(colId)}
          className="flex items-center space-x-1.5 cursor-pointer hover:text-[var(--text-primary)]"
        >
          <span>{label}</span>
          {sort?.colId === colId ? (
            sort.dir === 'asc' ? (
              <ArrowUp className="w-3 h-3" strokeWidth={2} />
            ) : (
              <ArrowDown className="w-3 h-3" strokeWidth={2} />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-[var(--text-faint)]" strokeWidth={2} />
          )}
        </button>
        {colId !== 'title' && colId !== '#' && (
          <span className="opacity-0 group-hover/col:opacity-100 flex items-center transition-opacity">
            <button
              type="button"
              onClick={() => moveColumn(colId, -1)}
              aria-label={`Move ${label} left`}
              className="p-0.5 hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => moveColumn(colId, 1)}
              aria-label={`Move ${label} right`}
              className="p-0.5 hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setHiddenColIds([...hiddenColIds, colId])}
              aria-label={`Hide ${label}`}
              className="p-0.5 hover:text-[var(--text-primary)] cursor-pointer"
            >
              <EyeOff className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className={`w-full ${className}`}>
      {/* Column visibility menu */}
      <div className="relative flex justify-end mb-1.5">
        <button
          type="button"
          onClick={() => setShowColumnMenu(!showColumnMenu)}
          className="flex items-center space-x-1 text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <Settings2 className="w-3 h-3" />
          <span>Columns ({visibleColumns.length + 1})</span>
        </button>
        {showColumnMenu && (
          <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-[var(--bg-raised)] border border-[var(--border-strong)] p-1.5 space-y-0.5">
            {orderedColumns.map((c) => (
              <label
                key={c.id}
                className="flex items-center space-x-2 px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!hiddenColIds.includes(c.id)}
                  onChange={() =>
                    setHiddenColIds(
                      hiddenColIds.includes(c.id)
                        ? hiddenColIds.filter((id) => id !== c.id)
                        : [...hiddenColIds, c.id]
                    )
                  }
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto border border-[var(--border-subtle)]">
        <table className="w-full text-left border-collapse font-sans text-[13px]">
          <thead>
            <tr className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase tracking-[1.5px] text-[var(--text-faint)]">
              <th className="py-2.5 px-3 border-r border-[var(--border-subtle)] w-12 text-center">#</th>
              {headerCell('title', 'TITLE', 'min-w-[240px]')}
              {visibleColumns.map((col) => headerCell(col.id, col.name, 'min-w-[140px]'))}
            </tr>
          </thead>

          <tbody>
            {sortedNodes.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + 2}
                  className="py-12 text-center text-[var(--text-faint)] font-mono text-[12px] uppercase tracking-[1.5px]"
                >
                  No items in this view
                </td>
              </tr>
            ) : (
              sortedNodes.map((node, idx) => (
                <tr
                  key={node.id}
                  className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors duration-100 group"
                >
                  <td className="py-2 px-3 border-r border-[var(--border-subtle)] text-center text-[var(--text-faint)] font-mono text-[11px]">
                    {node.done_at ? <span className="text-[var(--green)]">✓</span> : <span>{idx + 1}</span>}
                  </td>

                  <td className="py-2 px-4 border-r border-[var(--border-subtle)]">
                    <span
                      onClick={() => onNodeClick?.(node.id)}
                      className="cursor-pointer font-medium text-[var(--text-primary)] hover:underline"
                    >
                      {node.content || <span className="italic text-[var(--text-faint)]">Untitled</span>}
                    </span>
                  </td>

                  {visibleColumns.map((col) => {
                    const isEditing =
                      editingCell?.nodeId === node.id && editingCell?.colId === col.id;
                    const cellVal = getCellValue(node, col.id);
                    const editable = Boolean(col.fieldDefId) || col.id.startsWith('field:');

                    return (
                      <td
                        key={col.id}
                        className="py-2 px-4 border-r border-[var(--border-subtle)] last:border-r-0 text-[var(--text-muted)]"
                        onClick={() => {
                          if (!editable) return;
                          setEditingCell({ nodeId: node.id, colId: col.id });
                          setEditValue(cellVal);
                        }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => {
                              setEditingCell(null);
                              onCellEdit?.(node.id, col.id, editValue);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingCell(null);
                                onCellEdit?.(node.id, col.id, editValue);
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            className="w-full h-6 px-1.5 bg-[var(--bg-raised)] border border-[var(--text-primary)] text-[var(--text-primary)] text-[12px] focus:outline-none"
                          />
                        ) : (
                          <div className={`min-h-[18px] ${editable ? 'cursor-pointer' : ''}`}>
                            {cellVal || <span className="text-[var(--text-faint)]">—</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
