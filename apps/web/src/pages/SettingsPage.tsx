import React, { useState, useEffect, useRef } from 'react';
import { Settings, Shield, Download, Upload, Cpu, Check } from 'lucide-react';
import { SettingsMap, parseTanaPaste } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export const SettingsPage: React.FC = () => {
  const store = useWorkspaceStore();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [tanaCopied, setTanaCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const outlineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!store.db) return;
    store.db.settings.getSettings().then(setSettings);
  }, [store.db]);

  const updateSetting = async (key: string, value: any) => {
    if (!store.db) return;
    const updated = await store.db.settings.updateSettings({ [key]: value });
    setSettings(updated);
  };

  const downloadText = (text: string, filename: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = async () => {
    if (!store.db) return;
    const nodes = await store.db.adapter.query('SELECT * FROM node');
    const tags = await store.db.adapter.query('SELECT * FROM node_tag');
    const refs = await store.db.adapter.query('SELECT * FROM ref');
    const commands = await store.db.adapter.query('SELECT * FROM command');
    const dump = { nodes, tags, refs, commands, exported_at: Date.now() };
    downloadText(
      JSON.stringify(dump, null, 2),
      `hecate-backup-${Date.now()}.json`,
      'application/json'
    );
  };

  const handleExportTana = async () => {
    // Recursive export of every root subtree (content, fields, tags, refs)
    const text = await store.exportAllAsTanaPaste();
    await navigator.clipboard.writeText(text);
    setTanaCopied(true);
    setTimeout(() => setTanaCopied(false), 3000);
  };

  const handleExportMarkdown = async () => {
    const text = await store.exportAllAsMarkdown();
    downloadText(text, `hecate-export-${Date.now()}.md`, 'text/markdown');
  };

  const handleImportJsonFile = async (file: File) => {
    try {
      const dump = JSON.parse(await file.text());
      await store.importWorkspaceDump(dump);
      setImportStatus({ ok: true, message: `Imported ${dump.nodes.length} nodes from ${file.name}.` });
    } catch (err: any) {
      setImportStatus({ ok: false, message: `Import failed: ${err?.message || String(err)}` });
    }
  };

  const handleImportOutlineFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseTanaPaste(text);
      if (parsed.length === 0) throw new Error('No outline bullets found in file');
      await store.insertParsedNodes(parsed, null);
      setImportStatus({ ok: true, message: `Imported ${parsed.length} root nodes from ${file.name}.` });
    } catch (err: any) {
      setImportStatus({ ok: false, message: `Import failed: ${err?.message || String(err)}` });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 font-sans text-[var(--text-primary)]">
      <div className="max-w-[760px] mx-auto space-y-6">
        <div className="pb-4 border-b border-[var(--border-subtle)]">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1 font-medium">
            Configuration & Preferences
          </div>
          <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-0.01em] text-[var(--text-primary)]">
            Settings
          </h1>
        </div>

        <div className="space-y-6">
          {/* Appearance Section */}
          <section className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
            <h3 className="text-[13px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Appearance
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)]">Theme</div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  Quiet, warm, dark (Inter typography, violet accents, warm greys)
                </div>
              </div>
              <select
                value={settings.theme || 'dark'}
                onChange={(e) => updateSetting('theme', e.target.value)}
                className="h-8 px-3 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[8px] text-[var(--text-primary)] text-[13px] focus:outline-none cursor-pointer"
              >
                <option value="dark">Warm Dark (Default)</option>
                <option value="light">Warm Light</option>
                <option value="system">System</option>
              </select>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)]">
                  Accent Color
                </div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  Used for tags, links, and primary actions
                </div>
              </div>
              <input
                type="color"
                value={settings.accentColor || '#c4b2ff'}
                onChange={(e) => updateSetting('accentColor', e.target.value)}
                className="w-10 h-8 rounded-[6px] border border-[var(--border-strong)] bg-transparent cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)]">Font Size</div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  Base UI scale (default 16px)
                </div>
              </div>
              <input
                type="number"
                min={12}
                max={22}
                value={settings.fontSize || 16}
                onChange={(e) =>
                  updateSetting('fontSize', Math.min(22, Math.max(12, Number(e.target.value))))
                }
                className="w-20 h-8 px-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[8px] text-[var(--text-primary)] text-[13px] focus:outline-none"
              />
            </div>
          </section>

          {/* AI Coach Configuration */}
          <section className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
            <div className="flex items-center space-x-2 text-[13px] font-mono uppercase tracking-wider text-[var(--accent)] mb-4">
              <Cpu className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
              <span>AI Coach Configuration</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-[14px] font-medium text-[var(--text-primary)]">Enable AI Coach</div>
                  <div className="text-[12px] text-[var(--text-muted)]">
                    Enables background knowledge digest synthesis and personalized action proposals
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('aiEnabled', !settings.aiEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors duration-150 p-1 flex items-center cursor-pointer ${
                    settings.aiEnabled ? 'bg-[var(--accent)] justify-end' : 'bg-[var(--border-subtle)] justify-start'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${settings.aiEnabled ? 'bg-[var(--bg-app)]' : 'bg-[var(--text-muted)]'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-[14px] font-medium text-[var(--text-primary)]">AI Provider Mode</div>
                  <div className="text-[12px] text-[var(--text-muted)]">
                    Select local mock synthesis or external LLM provider
                  </div>
                </div>
                <select
                  value={settings.aiProvider || 'mock'}
                  onChange={(e) => updateSetting('aiProvider', e.target.value)}
                  className="h-8 px-3 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[8px] text-[var(--text-primary)] text-[13px] focus:outline-none cursor-pointer"
                >
                  <option value="mock">Local Deterministic Mock (Offline)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai-compatible">OpenAI-compatible endpoint</option>
                  <option value="ollama">Ollama (local, on-device)</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-[14px] font-medium text-[var(--text-primary)]">
                    Daily Mini-Task Notification
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)]">
                    Local notification time while the app is open (empty = off)
                  </div>
                </div>
                <input
                  type="time"
                  value={settings.aiNotificationTime || ''}
                  onChange={(e) => updateSetting('aiNotificationTime', e.target.value || null)}
                  className="h-8 px-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[8px] text-[var(--text-primary)] text-[13px] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Data & Backup Section */}
          <section className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
            <h3 className="text-[13px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Local Storage & Export
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportJson}
                className="h-9 px-4 flex items-center space-x-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--text-primary)] rounded-[8px] text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
                <span>Export SQLite Dump (.json)</span>
              </button>

              <button
                type="button"
                onClick={handleExportTana}
                className="h-9 px-4 flex items-center space-x-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--text-primary)] rounded-[8px] text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-colors"
              >
                {tanaCopied ? (
                  <>
                    <Check className="w-4 h-4 text-[var(--green)]" strokeWidth={2} />
                    <span className="text-[var(--green)]">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
                    <span>Copy as Tana Paste</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="h-9 px-4 flex items-center space-x-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--text-primary)] rounded-[8px] text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
                <span>Export Markdown (.md)</span>
              </button>

              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="h-9 px-4 flex items-center space-x-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--text-primary)] rounded-[8px] text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
                <span>Import JSON</span>
              </button>

              <button
                type="button"
                onClick={() => outlineInputRef.current?.click()}
                className="h-9 px-4 flex items-center space-x-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--text-primary)] rounded-[8px] text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
                <span>Import Markdown / Tana Paste</span>
              </button>

              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportJsonFile(file);
                  e.target.value = '';
                }}
              />
              <input
                ref={outlineInputRef}
                type="file"
                accept=".md,.txt,.markdown,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportOutlineFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {importStatus && (
              <div
                className={`mt-3 p-3 rounded-[8px] border text-[12px] font-mono ${
                  importStatus.ok
                    ? 'bg-[var(--green-dim)] border-[var(--green)]/40 text-[var(--green)]'
                    : 'bg-[var(--red-dim)] border-[var(--red)]/40 text-[var(--red)]'
                }`}
              >
                {importStatus.message}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
