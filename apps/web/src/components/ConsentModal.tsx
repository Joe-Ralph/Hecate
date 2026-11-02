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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-lg bg-[#0a0a0a] border border-[#333333] shadow-2xl text-[#ffffff] font-sans p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-[#888888] hover:text-[#ffffff] cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-[2px] text-[#888888] mb-2">
          <Shield className="w-3.5 h-3.5 text-[#22c55e]" strokeWidth={2} />
          <span>PRIVACY & AI COACH CONSENT</span>
        </div>

        <h3 className="text-xl font-medium mb-3 text-[#ffffff]">
          Enable AI Mini-Task Coach
        </h3>

        <p className="text-[12px] text-[#888888] leading-relaxed mb-4">
          Hecate’s Mini-Task coach analyzes a compact, anonymized summary of what you captured in the last 7 days to suggest tiny, concrete personal growth actions (5–30 min).
        </p>

        {/* Invariant rules */}
        <div className="bg-[#111111] border border-[#222222] p-3 text-[11px] font-mono text-[#888888] space-y-1.5 mb-5">
          <div className="text-[#ffffff] font-medium uppercase tracking-[1px] mb-1">
            WHAT HECATE GUARANTEES:
          </div>
          <div>• Strictly NO node IDs, emails, phone numbers, or attached files are sent.</div>
          <div>• Nodes tagged <span className="text-[#ffffff]">#private</span> or flagged AI: exclude are never sent.</div>
          <div>• You can inspect the exact payload anytime via "What was sent?".</div>
        </div>

        {/* Provider selection */}
        <div className="space-y-3 mb-6">
          <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-[#555555]">
            CHOOSE PROVIDER
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] font-mono">
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
                className={`p-2.5 text-left border cursor-pointer transition-colors duration-100 ${
                  provider === p.id
                    ? 'border-[#ffffff] bg-[#161616] text-[#ffffff]'
                    : 'border-[#222222] bg-[#111111] text-[#888888] hover:border-[#333333]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {(provider === 'anthropic' || provider === 'openai-compatible') && (
            <div className="space-y-2 pt-2">
              <label className="block text-[10px] font-mono uppercase tracking-[1.5px] text-[#555555]">
                API KEY
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full h-8 px-2.5 bg-[#161616] border border-[#333333] text-[#ffffff] text-[12px] font-mono focus:outline-none focus:border-[#ffffff]"
              />
            </div>
          )}

          {provider === 'ollama' && (
            <div className="space-y-2 pt-2">
              <label className="block text-[10px] font-mono uppercase tracking-[1.5px] text-[#555555]">
                OLLAMA ENDPOINT
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:11434/api/generate"
                className="w-full h-8 px-2.5 bg-[#161616] border border-[#333333] text-[#ffffff] text-[12px] font-mono focus:outline-none focus:border-[#ffffff]"
              />
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#222222]">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 text-[#888888] hover:text-[#ffffff] text-[11px] font-mono uppercase tracking-[1.5px] cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleEnable}
            className="h-8 px-4 bg-[#ffffff] text-[#000000] text-[11px] font-medium uppercase tracking-[1.5px] hover:bg-[#e0e0e0] active:scale-98 cursor-pointer transition-transform duration-100"
          >
            I CONSENT & ENABLE
          </button>
        </div>
      </div>
    </div>
  );
};
