import React, { useState, useEffect } from 'react';
import { Settings, Shield, Download, Upload, Cpu } from 'lucide-react';
import { SettingsMap, serializeTanaPaste } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export const SettingsPage: React.FC = () => {
  const store = useWorkspaceStore();
  const [settings, setSettings] = useState<SettingsMap>({});

  useEffect(() => {
    if (!store.db) return;
    store.db.settings.getSettings().then(setSettings);
  }, [store.db]);

  const updateSetting = async (key: string, value: any) => {
    if (!store.db) return;
    const updated = await store.db.settings.updateSettings({ [key]: value });
    setSettings(updated);
  };

  const handleExportJson = async () => {
    if (!store.db) return;
    const nodes = await store.db.adapter.query('SELECT * FROM node');
    const tags = await store.db.adapter.query('SELECT * FROM node_tag');
    const refs = await store.db.adapter.query('SELECT * FROM ref');
    const dump = { nodes, tags, refs, exported_at: Date.now() };

    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hecate-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTana = async () => {
    if (!store.db) return;
    const allNodes = await store.db.adapter.query<any>(
      "SELECT * FROM node WHERE parent_id IS NULL AND kind = 'content' AND deleted_at IS NULL"
    );
    const tanaNodes = allNodes.map((n) => ({
      content: n.content,
      isDone: Boolean(n.done_at),
    }));
    const text = serializeTanaPaste(tanaNodes);
    navigator.clipboard.writeText(text);
    alert('Copied workspace to clipboard as Tana Paste!');
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto font-sans text-[#ffffff]">
      <div className="mb-8 pb-4 border-b border-[#222222]">
        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-1">
          CONFIGURATION & ENVIRONMENT
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-[#ffffff]">Settings</h1>
      </div>

      <div className="space-y-8">
        {/* Appearance Section */}
        <section className="p-5 bg-[#111111] border border-[#222222]">
          <h3 className="text-sm font-medium uppercase tracking-[1.5px] text-[#ffffff] mb-4">
            Appearance
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-[#ffffff]">Theme</div>
              <div className="text-[11px] text-[#888888]">
                Terminal Brutalism Obsidian (Strict 0-Radius, Monochrome)
              </div>
            </div>
            <select
              value={settings.theme || 'dark'}
              onChange={(e) => updateSetting('theme', e.target.value)}
              className="h-8 px-2 bg-[#161616] border border-[#333333] text-[#ffffff] text-[12px] font-mono focus:outline-none"
            >
              <option value="dark">Dark (Terminal Obsidian)</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
        </section>

        {/* AI Mini-Task Coach Configuration */}
        <section className="p-5 bg-[#111111] border border-[#222222]">
          <div className="flex items-center space-x-2 text-sm font-medium uppercase tracking-[1.5px] text-[#ffffff] mb-4">
            <Cpu className="w-4 h-4 text-[#eab308]" strokeWidth={2} />
            <span>AI Mini-Task Coach Settings</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-[#222222]">
              <div>
                <div className="text-[13px] font-medium text-[#ffffff]">Enable AI Coach</div>
                <div className="text-[11px] text-[#888888]">
                  Enables background knowledge digest synthesis and personalized action proposals
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateSetting('aiEnabled', !settings.aiEnabled)}
                className={`w-12 h-6 border flex items-center px-1 cursor-pointer transition-colors duration-100 ${
                  settings.aiEnabled
                    ? 'border-[#22c55e] bg-[#22c55e]/20 justify-end'
                    : 'border-[#333333] bg-[#161616] justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-[#ffffff]" />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#222222]">
              <div>
                <div className="text-[13px] font-medium text-[#ffffff]">Provider</div>
                <div className="text-[11px] text-[#888888]">Model execution engine</div>
              </div>
              <select
                value={settings.aiProvider || 'mock'}
                onChange={(e) => updateSetting('aiProvider', e.target.value)}
                className="h-8 px-2 bg-[#161616] border border-[#333333] text-[#ffffff] text-[12px] font-mono focus:outline-none"
              >
                <option value="mock">Local Mock (Zero setup)</option>
                <option value="ollama">Ollama (Local On-Device)</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai-compatible">OpenAI-Compatible</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#222222]">
              <div>
                <div className="text-[13px] font-medium text-[#ffffff]">Knowledge Digest Scope</div>
                <div className="text-[11px] text-[#888888]">
                  Controls which nodes feed the coach
                </div>
              </div>
              <select
                value={settings.aiScope || 'all'}
                onChange={(e) => updateSetting('aiScope', e.target.value)}
                className="h-8 px-2 bg-[#161616] border border-[#333333] text-[#ffffff] text-[12px] font-mono focus:outline-none"
              >
                <option value="all">All workspace nodes (within window)</option>
                <option value="dailyOnly">Daily notes only</option>
                <option value="taggedOnly">Only nodes with chosen tags</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-[13px] font-medium text-[#ffffff]">Analysis Window</div>
                <div className="text-[11px] text-[#888888]">How many days back the digest looks</div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.aiWindowDays || 7}
                  onChange={(e) => updateSetting('aiWindowDays', parseInt(e.target.value, 10))}
                  className="w-16 h-8 px-2 bg-[#161616] border border-[#333333] text-[#ffffff] text-[12px] font-mono text-center focus:outline-none"
                />
                <span className="text-[11px] font-mono text-[#555555]">DAYS</span>
              </div>
            </div>
          </div>
        </section>

        {/* Data Import / Export */}
        <section className="p-5 bg-[#111111] border border-[#222222]">
          <h3 className="text-sm font-medium uppercase tracking-[1.5px] text-[#ffffff] mb-4">
            Data Portability & Backup
          </h3>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportJson}
              className="h-8 px-3 flex items-center space-x-1.5 bg-[#161616] border border-[#333333] hover:border-[#ffffff] text-[#ffffff] text-[11px] font-mono uppercase tracking-[1px] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={2} />
              <span>EXPORT JSON (LOSSLESS)</span>
            </button>

            <button
              type="button"
              onClick={handleExportTana}
              className="h-8 px-3 flex items-center space-x-1.5 bg-[#161616] border border-[#333333] hover:border-[#ffffff] text-[#ffffff] text-[11px] font-mono uppercase tracking-[1px] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={2} />
              <span>COPY AS TANA PASTE</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
