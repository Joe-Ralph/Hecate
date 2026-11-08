import React, { useState } from 'react';
import { X, Shield, Cpu, Key } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({ isOpen, onClose }) => {
  const store = useWorkspaceStore();
  const [provider, setProvider] = useState<'mock' | 'anthropic' | 'openai-compatible' | 'ollama'>('mock');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');

  if (!isOpen) return null;

  const handleEnable = async () => {
    if (!store.db) return;
    await store.db.settings.updateSettings({
      aiEnabled: true,
      aiProvider: provider,
      aiApiKey: apiKey || undefined,
      aiEndpoint: endpoint || undefined,
    });
    onClose();
    // Trigger first coaching run
    store.runAiCoaching();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-[var(--text-primary)] font-sans p-6 relative animate-in fade-in duration-140"
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

        <div className="flex items-center space-x-2 text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] mb-2 font-medium">
          <Shield className="w-3.5 h-3.5 text-[var(--green)]" strokeWidth={2} />
          <span>Privacy & AI Coach Consent</span>
        </div>

        <h3 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">
          Enable AI Mini-Task Coach
        </h3>

        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
          Hecate’s Mini-Task coach analyzes a compact, anonymized summary of what you captured in the last 7 days to suggest tiny, concrete personal growth actions (5–30 min).
        </p>

        {/* Invariant rules */}
        <div className="bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[8px] p-3 text-[12px] text-[var(--text-muted)] space-y-1.5 mb-5">
          <div className="text-[var(--text-primary)] font-medium font-mono text-[11px] uppercase tracking-wider mb-1">
            What Hecate Guarantees:
          </div>
          <div>• Strictly NO node IDs, emails, phone numbers, or attached files are sent.</div>
          <div>• Nodes tagged <span className="text-[var(--accent)]">#private</span> or flagged AI: exclude are never sent.</div>
          <div>• You can inspect the exact payload anytime via "What was sent?".</div>
        </div>

        {/* Provider selection */}
        <div className="space-y-3 mb-6">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Choose Provider
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {[
              { id: 'mock', label: 'Local Mock (Zero setup)' },
              { id: 'ollama', label: 'Ollama (On-Device)' },
              { id: 'anthropic', label: 'Anthropic Claude' },
              { id: 'openai-compatible', label: 'OpenAI-Compatible' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id as any)}
                className={`p-2.5 text-left rounded-[8px] border cursor-pointer transition-colors duration-120 ${
                  provider === p.id
                    ? 'border-[var(--accent)] bg-[var(--bg-accent-dim)] text-[var(--accent)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-raised)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 bg-[var(--bg-raised)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-[8px] text-[13px] font-medium hover:border-[var(--text-muted)] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEnable}
            className="h-9 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors"
          >
            I Agree, Enable Coach
          </button>
        </div>
      </div>
    </div>
  );
};
