import React from 'react';
import { X } from 'lucide-react';

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { section: 'NAVIGATION & PANELS', items: [
      { key: 'Cmd/Ctrl + K', desc: 'Open Command Omnibar' },
      { key: 'Cmd/Ctrl + Alt + T', desc: "Jump to Today's Note" },
      { key: 'Cmd/Ctrl + Click', desc: 'Open node reference in side panel' },
      { key: '?', desc: 'Show this keyboard shortcuts sheet' },
    ]},
    { section: 'OUTLINER EDITING', items: [
      { key: 'Tab', desc: 'Indent node (nest as child)' },
      { key: 'Shift + Tab', desc: 'Outdent node' },
      { key: 'Enter', desc: 'Create new sibling node' },
      { key: 'Shift + Enter', desc: 'Insert line break inside node' },
      { key: 'Backspace (empty)', desc: 'Delete node and focus previous' },
      { key: 'Cmd/Ctrl + Enter', desc: 'Toggle checkbox / mark Done' },
      { key: 'Alt + Shift + ↑ / ↓', desc: 'Move node up / down among siblings' },
      { key: 'Cmd/Ctrl + ↑ / ↓', desc: 'Collapse / expand children' },
    ]},
    { section: 'INLINE CAPTURE', items: [
      { key: '[[', desc: 'Insert universal node reference' },
      { key: '#', desc: 'Attach supertag' },
      { key: '@', desc: 'Insert date reference (natural language)' },
      { key: '>', desc: 'Attach field (Name:: value)' },
    ]},
    { section: 'HISTORY & WORKFLOW', items: [
      { key: 'Cmd/Ctrl + Z', desc: 'Undo' },
      { key: 'Cmd/Ctrl + Shift + Z', desc: 'Redo' },
      { key: 'Cmd/Ctrl + Shift + Space', desc: 'Global Quick-Capture window (Native)' },
    ]},
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-2xl bg-[#0a0a0a] border border-[#333333] shadow-2xl text-[#ffffff] font-sans p-6 relative max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-[#888888] hover:text-[#ffffff] cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#888888] mb-1">
          PRECISION KEYBOARD CONTROL
        </div>
        <h3 className="text-xl font-medium mb-6 text-[#ffffff]">Shortcuts Reference</h3>

        <div className="space-y-6">
          {shortcuts.map((sec) => (
            <div key={sec.section}>
              <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] border-b border-[#222222] pb-1.5 mb-2.5">
                {sec.section}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sec.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2 bg-[#111111] border border-[#222222]"
                  >
                    <span className="text-[12px] text-[#888888]">{item.desc}</span>
                    <kbd className="text-[10px] font-mono text-[#ffffff] bg-[#161616] border border-[#333333] px-1.5 py-0.5 whitespace-nowrap ml-2">
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
