import React, { useState } from 'react';
import { FieldType, FieldOption } from '@hecate/core';

export interface FieldRowProps {
  name: string;
  type?: FieldType;
  value: string;
  options?: FieldOption[];
  onChange: (newValue: string) => void;
  className?: string;
}

export const FieldRow: React.FC<FieldRowProps> = ({
  name,
  type = 'text',
  value,
  options = [],
  onChange,
  className = '',
}) => {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);

  const handleBlur = () => {
    setEditing(false);
    if (tempVal !== value) {
      onChange(tempVal);
    }
  };

  return (
    <div className={`flex items-center text-[13px] py-1 border-b border-[#1a1a1a] last:border-b-0 ${className}`}>
      {/* Left Column (120px label) */}
      <div className="w-[120px] min-w-[120px] flex items-center justify-between pr-2 select-none">
        <span className="text-[10px] font-medium uppercase tracking-[1.5px] text-[#555555] truncate">
          {name}
        </span>
        <span className="text-[#3a3a3a] font-mono text-[11px]">::</span>
      </div>

      {/* Right Column (Control/Value) */}
      <div className="flex-1 min-w-0 pl-2">
        {type === 'options' && options.length > 0 ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 px-1.5 bg-[#161616] border border-[#333333] hover:border-[#888888] text-[#ffffff] text-[12px] font-mono focus:outline-none focus:border-[#ffffff] cursor-pointer"
          >
            <option value="" disabled>Select option...</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : type === 'boolean' ? (
          <button
            type="button"
            onClick={() => onChange(value === '1' ? '0' : '1')}
            className={`w-4 h-4 border flex items-center justify-center cursor-pointer ${
              value === '1' ? 'border-[#338833]' : 'border-[#333333]'
            }`}
          >
            {value === '1' && <div className="w-1.5 h-1.5 bg-[#338833]" />}
          </button>
        ) : type === 'date' ? (
          <input
            type="date"
            value={value.replace(/\[\[date:(\d{4}-\d{2}-\d{2})\]\]/, '$1')}
            onChange={(e) => onChange(e.target.value ? `[[date:${e.target.value}]]` : '')}
            className="h-6 px-1.5 bg-[#161616] border border-[#333333] hover:border-[#888888] text-[#ffffff] text-[12px] font-mono focus:outline-none focus:border-[#ffffff]"
          />
        ) : editing ? (
          <input
            autoFocus
            type={type === 'number' ? 'number' : 'text'}
            value={tempVal}
            onChange={(e) => setTempVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBlur();
              if (e.key === 'Escape') {
                setTempVal(value);
                setEditing(false);
              }
            }}
            className="w-full h-6 px-1.5 bg-[#161616] border border-[#333333] text-[#ffffff] text-[13px] focus:outline-none focus:border-[#ffffff]"
          />
        ) : (
          <span
            onClick={() => {
              setTempVal(value);
              setEditing(true);
            }}
            className="cursor-pointer text-[#888888] hover:text-[#ffffff] transition-colors duration-150 inline-block min-h-[20px] min-w-[50px]"
          >
            {value || <span className="text-[#3a3a3a] italic text-[11px]">Empty</span>}
          </span>
        )}
      </div>
    </div>
  );
};
