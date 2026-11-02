import React from 'react';
import { X, Trash2, ShieldCheck } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface DigestInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DigestInspectModal: React.FC<DigestInspectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const store = useWorkspaceStore();
  if (!isOpen) return null;

  const payload = store.lastDigestPayload || {
    message: 'No digest sent yet today or coaching has not run.',
  };

  const handleDeleteAllAiData = async () => {
    if (!store.db) return;
    await store.db.adapter.execute('DELETE FROM mini_task');
    await store.db.adapter.execute('DELETE FROM ai_summary');
    await store.db.settings.updateSettings({ aiEnabled: false });
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-2xl bg-[#0a0a0a] border border-[#333333] shadow-2xl text-[#ffffff] font-sans p-6 relative max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-[#888888] hover:text-[#ffffff] cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-[2px] text-[#888888] mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e]" strokeWidth={2} />
          <span>TRANSPARENCY INSPECTOR</span>
        </div>
        <h3 className="text-xl font-medium mb-3 text-[#ffffff]">
          What was sent to the AI?
        </h3>

        <p className="text-[12px] text-[#888888] mb-4">
          The exact payload below was synthesized from your recent workspace notes. Notice all emails, phone numbers, file URLs, and database IDs are stripped.
        </p>

        {/* JSON Viewer */}
        <div className="flex-1 overflow-y-auto bg-[#111111] border border-[#222222] p-3 font-mono text-[11px] text-[#888888] mb-5">
          <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#222222]">
          <button
            type="button"
            onClick={handleDeleteAllAiData}
            className="h-8 px-3 flex items-center space-x-1.5 text-[#cc3333] hover:bg-[#cc3333]/10 border border-[#cc3333]/40 text-[10px] font-mono uppercase tracking-[1px] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            <span>DELETE ALL AI DATA</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 bg-[#ffffff] text-[#000000] text-[11px] font-medium uppercase tracking-[1.5px] hover:bg-[#e0e0e0] cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
