import React from 'react';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  className = '',
  disabled = false,
}) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`w-[14px] h-[14px] min-w-[14px] min-h-[14px] flex items-center justify-center border transition-colors duration-100 select-none ${
        checked
          ? 'border-[#338833] bg-transparent'
          : 'border-[#333333] hover:border-[#888888] bg-transparent'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {checked && <div className="w-[6px] h-[6px] bg-[#338833]" />}
    </button>
  );
};
