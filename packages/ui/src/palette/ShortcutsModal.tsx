import React from 'react';
import { X } from 'lucide-react';

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      section: 'GLOBAL NAVIGATION',
      items: [
        { key: 'Cmd/Ctrl + K', desc: 'Open Command Palette' },
        { key: 'Alt + T', desc: "Go to Today's Note" },
        { key: 'G then L / C / G / R', desc: 'Library / Calendar / Graph / Reflections' },
        { key: 'Alt + ←', desc: 'Zoom out one level (breadcrumbs)' },
        { key: 'C', desc: 'Focus capture bar' },
        { key: 'Cmd/Ctrl + \\', desc: 'Toggle sidebar' },
        { key: 'Cmd/Ctrl + Shift + \\', desc: 'Toggle coach rail' },
        { key: 'Cmd/Ctrl + Alt + 1…4', desc: 'List / Table / Cards / Calendar' },
        { key: '?', desc: 'Shortcut cheat sheet' },
      ],
    },
    {
      section: 'OUTLINER EDITING',
      items: [
        { key: 'Tab / Shift + Tab', desc: 'Indent / Outdent node' },
        { key: 'Enter', desc: 'New sibling node' },
        { key: 'Shift + Enter', desc: 'Line break inside node' },
        { key: 'Backspace (empty)', desc: 'Delete node and focus previous' },
        { key: 'Cmd/Ctrl + Enter', desc: 'Toggle checkbox / mark Done' },
        { key: 'Alt + Shift + ↑ / ↓', desc: 'Move node up / down' },
        { key: 'Cmd/Ctrl + ↑ / ↓', desc: 'Collapse / expand children' },
        { key: 'Cmd/Ctrl + Click', desc: 'Open reference in side panel' },
      ],
    },
    {
      section: 'TYPING TRIGGERS',
      items: [
        { key: '#', desc: 'Tag picker (#task, #book, ...)' },
        { key: '[[', desc: 'Universal node reference picker' },
        { key: '>', desc: 'Field picker (> Status, > Due)' },
        { key: '@', desc: 'Date picker' },
        { key: '/', desc: 'Slash menu' },
      ],
    },
    {
      section: 'SYSTEM & HISTORY',
      items: [
        { key: 'Cmd/Ctrl + Z', desc: 'Undo last action' },
        { key: 'Cmd/Ctrl + Shift + Z', desc: 'Redo' },
        { key: 'Cmd/Ctrl + Shift + Space', desc: 'Quick capture window' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-[var(--text-primary)] font-sans p-6 relative max-h-[85vh] overflow-y-auto animate-in fade-in duration-140"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close shortcuts modal"
          className="absolute top-5 right-5 p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Precision Keyboard Control
        </div>
        <h3 className="text-xl font-semibold mb-6 text-[var(--text-primary)]">
          Shortcuts Cheat Sheet
        </h3>

        <div className="space-y-6">
          {shortcuts.map((sec) => (
            <div key={sec.section}>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] pb-1.5 mb-2.5">
                {sec.section}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sec.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2.5 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[8px]"
                  >
                    <span className="text-[13px] text-[var(--text-secondary)]">{item.desc}</span>
                    <kbd className="text-[11px] font-mono text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-strong)] px-2 py-0.5 rounded-[4px] whitespace-nowrap ml-2">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
