import React, { useState } from 'react';
import { NodeRecord } from '@hecate/core';
import { ArrowUpDown, Check } from 'lucide-react';

export interface TableColumn {
  id: string;
  name: string;
  fieldDefId?: string;
}

export interface TableViewProps {
  nodes: NodeRecord[];
  columns: TableColumn[];
  onNodeClick?: (nodeId: string) => void;
  onCellEdit?: (nodeId: string, columnId: string, newValue: string) => void;
  className?: string;
}

export const TableView: React.FC<TableViewProps> = ({
  nodes,
  columns,
  onNodeClick,
  onCellEdit,
  className = '',
}) => {
  const [editingCell, setEditingCell] = useState<{ nodeId: string; colId: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  return (
    <div className={`w-full overflow-x-auto border border-[#222222] ${className}`}>
      <table className="w-full text-left border-collapse font-sans text-[13px]">
        {/* Table Header */}
        <thead>
          <tr className="bg-[#111111] border-b border-[#222222] text-[10px] font-mono uppercase tracking-[1.5px] text-[#555555]">
            <th className="py-2.5 px-3 border-r border-[#222222] w-12 text-center">#</th>
            <th className="py-2.5 px-4 border-r border-[#222222] min-w-[240px]">
              <div className="flex items-center justify-between">
                <span>TITLE</span>
                <ArrowUpDown className="w-3 h-3 text-[#555555]" strokeWidth={2} />
              </div>
            </th>
            {columns.map((col) => (
              <th
                key={col.id}
                className="py-2.5 px-4 border-r border-[#222222] last:border-r-0 min-w-[140px]"
              >
                <div className="flex items-center justify-between">
                  <span>{col.name}</span>
                  <ArrowUpDown className="w-3 h-3 text-[#555555]" strokeWidth={2} />
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {nodes.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 2}
                className="py-12 text-center text-[#555555] font-mono text-[12px] uppercase tracking-[1.5px]"
              >
                No items in this view
              </td>
            </tr>
          ) : (
            nodes.map((node, idx) => (
              <tr
                key={node.id}
                className="border-b border-[#222222] hover:bg-[#111111] transition-colors duration-100 group"
              >
                {/* Index / Status Column */}
                <td className="py-2 px-3 border-r border-[#222222] text-center text-[#555555] font-mono text-[11px]">
                  {node.done_at ? (
                    <span className="text-[#338833]">✓</span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </td>

                {/* Primary Content Column */}
                <td className="py-2 px-4 border-r border-[#222222]">
                  <span
                    onClick={() => onNodeClick?.(node.id)}
                    className="cursor-pointer font-medium text-[#ffffff] hover:underline"
                  >
                    {node.content || <span className="italic text-[#555555]">Untitled</span>}
                  </span>
                </td>

                {/* Dynamic Field Columns */}
                {columns.map((col) => {
                  const isEditing =
                    editingCell?.nodeId === node.id && editingCell?.colId === col.id;
                  const cellVal = (node.meta && node.meta[col.id]) || '';

                  return (
                    <td
                      key={col.id}
                      className="py-2 px-4 border-r border-[#222222] last:border-r-0 text-[#888888]"
                      onClick={() => {
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
                          className="w-full h-6 px-1.5 bg-[#161616] border border-[#ffffff] text-[#ffffff] text-[12px] focus:outline-none"
                        />
                      ) : (
                        <div className="cursor-pointer min-h-[18px]">
                          {cellVal || <span className="text-[#3a3a3a]">—</span>}
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
  );
};
