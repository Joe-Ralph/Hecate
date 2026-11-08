import React from 'react';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  className = '',
  disabled = false,
  ariaLabel = 'Toggle completion',
}) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) {
            onChange(!checked);
          }
        }
      }}
      className={`min-w-[32px] min-h-[32px] flex items-center justify-center p-1 cursor-pointer select-none group transition-opacity ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${className}`}
    >
      <div
        className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-colors duration-120 ${
          checked
            ? 'bg-[var(--green)] border border-[var(--green)]'
            : 'border-[1.5px] border-[#6f695f] hover:border-[var(--green)] bg-transparent'
        }`}
      >
        {checked && (
          <svg
            className="w-3 h-3 text-[var(--bg-app)]"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 7.5L5.5 10.5L11.5 3.5" />
          </svg>
        )}
      </div>
    </button>
  );
};
