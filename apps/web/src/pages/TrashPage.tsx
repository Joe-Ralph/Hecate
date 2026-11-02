import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { NodeRecord } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export const TrashPage: React.FC = () => {
  const store = useWorkspaceStore();
  const [trashNodes, setTrashNodes] = useState<NodeRecord[]>([]);

  useEffect(() => {
    if (!store.db) return;
    store.db.nodes.getTrash().then(setTrashNodes);
  }, [store.version, store.db]);

  const handleRestore = async (id: string) => {
    if (!store.db) return;
    await store.db.nodes.restoreNode(id);
    const updated = await store.db.nodes.getTrash();
    setTrashNodes(updated);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto font-sans text-[#ffffff]">
      <div className="mb-8 pb-4 border-b border-[#222222]">
        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-1">
          RECYCLE BIN
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-[#ffffff]">Trash</h1>
      </div>

      {trashNodes.length === 0 ? (
        <div className="p-12 text-center text-[#555555] font-mono text-[12px] uppercase tracking-[1px] bg-[#111111] border border-[#222222]">
          Trash is empty.
        </div>
      ) : (
        <div className="space-y-1.5">
          {trashNodes.map((n) => (
            <div
              key={n.id}
              className="p-3 bg-[#111111] border border-[#222222] flex items-center justify-between text-[13px]"
            >
              <div>
                <div className="font-medium text-[#888888] line-through">
                  {n.content || 'Untitled'}
                </div>
                <div className="text-[10px] font-mono text-[#555555]">
                  Deleted {n.deleted_at ? new Date(n.deleted_at).toLocaleString() : ''}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRestore(n.id)}
                className="h-7 px-2.5 flex items-center space-x-1.5 bg-[#161616] border border-[#333333] hover:border-[#ffffff] text-[#ffffff] text-[10px] font-mono uppercase tracking-[1px] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" strokeWidth={2} />
                <span>RESTORE</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
