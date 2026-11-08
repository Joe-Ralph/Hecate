import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { NodeRecord } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export const TrashPage: React.FC = () => {
  const store = useWorkspaceStore();
  const [trashNodes, setTrashNodes] = useState<NodeRecord[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

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

  const handlePermanentDelete = async (id: string) => {
    if (!store.db) return;
    await store.permanentlyDeleteNode(id);
    const updated = await store.db.nodes.getTrash();
    setTrashNodes(updated);
    setConfirmDeleteId(null);
  };

  const handleEmptyTrash = async () => {
    if (!store.db) return;
    await store.emptyTrash();
    const updated = await store.db.nodes.getTrash();
    setTrashNodes(updated);
    setConfirmEmptyTrash(false);
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 font-sans text-[var(--text-primary)]">
      <div className="max-w-[760px] mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-[var(--border-subtle)] flex items-end justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1 font-medium">
              Recycle Bin
            </div>
            <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-0.01em] text-[var(--text-primary)]">
              Trash
            </h1>
          </div>

          {trashNodes.length > 0 && (
            <div>
              {confirmEmptyTrash ? (
                <div className="flex items-center space-x-2">
                  <span className="text-[12px] text-[var(--red)]">Empty all trash?</span>
                  <button
                    type="button"
                    onClick={handleEmptyTrash}
                    className="h-8 px-3 bg-[var(--red)] text-[var(--bg-app)] rounded-[8px] text-[12px] font-medium hover:bg-[#d67257] cursor-pointer transition-colors"
                  >
                    Yes, delete forever
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmEmptyTrash(false)}
                    className="h-8 px-2.5 bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-[8px] text-[12px] hover:border-[var(--text-muted)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmEmptyTrash(true)}
                  className="h-8 px-3 flex items-center space-x-1.5 bg-[var(--bg-raised)] border border-[var(--red)]/30 hover:border-[var(--red)] text-[var(--red)] rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Empty trash</span>
                </button>
              )}
            </div>
          )}
        </div>

        {trashNodes.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
            Trash is empty.
          </div>
        ) : (
          <div className="space-y-2">
            {trashNodes.map((n) => (
              <div
                key={n.id}
                className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] flex items-center justify-between text-[13px]"
              >
                <div className="min-w-0 flex-1 mr-4">
                  <div className="font-medium text-[var(--text-muted)] line-through truncate">
                    {n.content || 'Untitled'}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-faint)] mt-0.5">
                    Deleted {n.deleted_at ? new Date(n.deleted_at).toLocaleString() : ''}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {confirmDeleteId === n.id ? (
                    <div className="flex items-center space-x-1.5 animate-in fade-in duration-100">
                      <span className="text-[11px] text-[var(--red)] hidden sm:inline">Delete forever?</span>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(n.id)}
                        className="h-7 px-2.5 bg-[var(--red)] text-[var(--bg-app)] rounded-[6px] text-[11px] font-medium hover:bg-[#d67257] cursor-pointer transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="h-7 px-2 bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-[6px] text-[11px] hover:border-[var(--text-muted)] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRestore(n.id)}
                        className="h-8 px-3 flex items-center space-x-1.5 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--green)] text-[var(--text-primary)] hover:text-[var(--green)] rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors"
                        title="Restore this node"
                      >
                        <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(n.id)}
                        className="h-8 px-3 flex items-center space-x-1.5 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--red)] text-[var(--text-muted)] hover:text-[var(--red)] rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors"
                        title="Permanently delete from database"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>Delete forever</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
