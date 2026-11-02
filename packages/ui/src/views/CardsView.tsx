import React, { useState } from 'react';
import { NodeRecord } from '@hecate/core';
import { Plus } from 'lucide-react';

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
}

export interface CardsViewProps {
  columns: KanbanColumn[];
  nodes: NodeRecord[];
  getNodeColumnId: (node: NodeRecord) => string;
  onMoveNode: (nodeId: string, newColumnId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  onAddCard?: (columnId: string) => void;
  className?: string;
}

export const CardsView: React.FC<CardsViewProps> = ({
  columns,
  nodes,
  getNodeColumnId,
  onMoveNode,
  onNodeClick,
  onAddCard,
  className = '',
}) => {
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  return (
    <div className={`flex space-x-3 overflow-x-auto pb-4 items-start ${className}`}>
      {columns.map((col) => {
        const columnNodes = nodes.filter((n) => getNodeColumnId(n) === col.id);

        return (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedNodeId) {
                onMoveNode(draggedNodeId, col.id);
                setDraggedNodeId(null);
              }
            }}
            className="w-72 min-w-[288px] bg-[#111111] border border-[#222222] flex flex-col font-sans"
          >
            {/* Column Header */}
            <div className="p-3 border-b border-[#222222] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {col.color && (
                  <div
                    className="w-2 h-2"
                    style={{ backgroundColor: col.color }}
                  />
                )}
                <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-[#ffffff]">
                  {col.title}
                </span>
                <span className="text-[10px] font-mono text-[#555555]">
                  ({columnNodes.length})
                </span>
              </div>

              {onAddCard && (
                <button
                  type="button"
                  onClick={() => onAddCard(col.id)}
                  className="text-[#555555] hover:text-[#ffffff] cursor-pointer"
                  title="Add card to column"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Cards Column Body */}
            <div className="p-2 space-y-2 min-h-[200px]">
              {columnNodes.length === 0 ? (
                <div className="py-8 text-center text-[#3a3a3a] text-[11px] font-mono uppercase tracking-[1px]">
                  Empty
                </div>
              ) : (
                columnNodes.map((node) => (
                  <div
                    key={node.id}
                    draggable
                    onDragStart={() => setDraggedNodeId(node.id)}
                    onClick={() => onNodeClick?.(node.id)}
                    className="p-3 bg-[#0a0a0a] border border-[#222222] hover:border-[#555555] cursor-pointer active:scale-98 transition-all duration-100 group select-none"
                  >
                    <div className="text-[13px] font-medium text-[#ffffff] mb-1 leading-snug">
                      {node.content || <span className="italic text-[#555555]">Untitled</span>}
                    </div>

                    {node.done_at && (
                      <div className="text-[10px] font-mono text-[#338833] mt-2">
                        COMPLETED
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
