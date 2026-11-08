import React, { useState } from 'react';
import { X, Trash2, ShieldCheck, Copy, Check } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const payload = store.lastDigestPayload || {
    message: 'No digest sent yet today or coaching has not run.',
  };

  const handleDeleteAllAiData = async () => {
    if (!store.db) return;
    if (confirm('Are you sure you want to delete all AI summaries and mini-tasks?')) {
      await store.db.adapter.execute('DELETE FROM mini_task');
      await store.db.adapter.execute('DELETE FROM ai_summary');
      await store.db.settings.updateSettings({ aiEnabled: false });
      onClose();
      window.location.reload();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-[var(--text-primary)] font-sans p-6 relative max-h-[85vh] flex flex-col animate-in fade-in duration-140"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="flex items-center space-x-2 text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] mb-1 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--green)]" strokeWidth={2} />
          <span>Transparency Inspector</span>
        </div>
        <h3 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">
          What was sent to the AI?
        </h3>

        <p className="text-[13px] text-[var(--text-secondary)] mb-4">
          The exact payload below was synthesized from your recent workspace notes. Notice all emails, phone numbers, file URLs, and database IDs are stripped.
        </p>

        {/* JSON Viewer */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[8px] p-3 font-mono text-[11px] text-[var(--text-tertiary)] mb-5 max-h-64 select-text">
          <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={handleDeleteAllAiData}
            className="h-8 px-3 flex items-center space-x-1.5 text-[var(--red)] hover:bg-[var(--red)]/10 border border-[var(--red)]/40 rounded-[6px] text-[12px] font-medium cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Delete all AI data</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              className="h-8 px-3 flex items-center space-x-1.5 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--text-primary)] rounded-[8px] text-[var(--text-primary)] text-[12px] font-medium cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--green)]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
