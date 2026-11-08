import React, { useState, useEffect } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addDays,
  parseISO,
  isValid,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check } from 'lucide-react';

export interface DatePickerProps {
  value?: string; // YYYY-MM-DD or [[date:YYYY-MM-DD]]
  onChange: (isoDate: string) => void;
  onClose?: () => void;
  className?: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  onClose,
  className = '',
}) => {
  // Extract canonical YYYY-MM-DD
  const rawIso = value ? value.replace(/\[\[date:(\d{4}-\d{2}-\d{2})\]\]/, '$1').trim() : '';
  const parsedSelected = rawIso && isValid(parseISO(rawIso)) ? parseISO(rawIso) : null;

  // View date state (controls which month is currently visible)
  const [viewDate, setViewDate] = useState<Date>(parsedSelected || new Date());
  const [yearInput, setYearInput] = useState<string>(String((parsedSelected || new Date()).getFullYear()));
  const [manualInput, setManualInput] = useState<string>(rawIso);

  // Sync yearInput when viewDate year changes externally
  useEffect(() => {
    setYearInput(String(viewDate.getFullYear()));
  }, [viewDate]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Generate 120-year list (from current year + 15 down to 1920)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 125 }, (_, i) => currentYear + 15 - i);

  const handleDaySelect = (day: Date) => {
    const isoString = format(day, 'yyyy-MM-dd');
    onChange(isoString);
    onClose?.();
  };

  const handlePresetSelect = (offsetDays: number) => {
    const target = addDays(new Date(), offsetDays);
    const isoString = format(target, 'yyyy-MM-dd');
    onChange(isoString);
    onClose?.();
  };

  const handleClear = () => {
    onChange('');
    onClose?.();
  };

  const handleManualSubmit = (str: string) => {
    const trimmed = str.trim();
    if (!trimmed) {
      handleClear();
      return;
    }
    const parsed = parseISO(trimmed);
    if (isValid(parsed)) {
      const iso = format(parsed, 'yyyy-MM-dd');
      onChange(iso);
      onClose?.();
    }
  };

  const handleYearChange = (newYearNum: number) => {
    if (newYearNum >= 1900 && newYearNum <= 2100) {
      setYearInput(String(newYearNum));
      const d = new Date(viewDate);
      d.setFullYear(newYearNum);
      setViewDate(d);
    }
  };

  const handleMonthChange = (newMonthIdx: number) => {
    const d = new Date(viewDate);
    d.setMonth(newMonthIdx);
    setViewDate(d);
  };

  const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div
      className={`w-[280px] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] font-sans text-[var(--text-primary)] select-none z-50 animate-in fade-in zoom-in-95 duration-120 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Direct Date Input Bar for Rapid Typing (e.g. DOB) */}
      <div className="flex items-center bg-[var(--bg-raised)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)] rounded-[6px] px-2 py-1 mb-2 transition-colors">
        <CalendarIcon className="w-3.5 h-3.5 text-[var(--text-muted)] mr-1.5 shrink-0" />
        <input
          type="text"
          value={manualInput}
          onChange={(e) => {
            const val = e.target.value;
            setManualInput(val);
            // If user types valid date or year, preview it in viewDate
            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
              const p = parseISO(val);
              if (isValid(p)) setViewDate(p);
            } else if (/^\d{4}$/.test(val)) {
              const y = parseInt(val, 10);
              if (y >= 1900 && y <= 2100) handleYearChange(y);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleManualSubmit(manualInput);
            }
          }}
          placeholder="YYYY-MM-DD (e.g. 1995-04-12)"
          className="flex-1 bg-transparent text-[12px] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none font-mono"
        />
        {manualInput && (
          <button
            type="button"
            onClick={() => handleManualSubmit(manualInput)}
            className="p-1 text-[var(--accent)] hover:text-[var(--accent-hover)] cursor-pointer shrink-0 transition-colors"
            title="Apply typed date"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quick Presets Bar */}
      <div className="flex items-center space-x-1 mb-2.5 pb-2 border-b border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => handlePresetSelect(0)}
          className="flex-1 py-1 px-1.5 rounded-[4px] bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] text-[11px] text-[var(--text-primary)] font-medium text-center cursor-pointer transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => handlePresetSelect(1)}
          className="flex-1 py-1 px-1.5 rounded-[4px] bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] text-[11px] text-[var(--text-primary)] font-medium text-center cursor-pointer transition-colors"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => handlePresetSelect(7)}
          className="flex-1 py-1 px-1.5 rounded-[4px] bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] text-[11px] text-[var(--text-primary)] font-medium text-center cursor-pointer transition-colors"
        >
          +7 Days
        </button>
        {rawIso && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-[4px] bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] text-[var(--red)] text-center cursor-pointer transition-colors"
            title="Clear date"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Month & Fast Year Navigation Header */}
      <div className="flex items-center justify-between mb-2 px-0.5 space-x-1">
        <div className="flex items-center space-x-1.5">
          {/* Quick Month Select Dropdown */}
          <select
            value={viewDate.getMonth()}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className="bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] text-[var(--text-primary)] text-[12px] font-semibold py-1 px-1.5 rounded-[6px] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                {m.slice(0, 3)}
              </option>
            ))}
          </select>

          {/* Rapid Editable Year Input + Dropdown List */}
          <div className="inline-flex items-center space-x-0.5">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={yearInput}
              onChange={(e) => {
                const val = e.target.value;
                setYearInput(val);
                const y = parseInt(val, 10);
                if (y >= 1900 && y <= 2100) {
                  const d = new Date(viewDate);
                  d.setFullYear(y);
                  setViewDate(d);
                }
              }}
              onBlur={() => {
                const y = parseInt(yearInput, 10);
                if (!y || y < 1900 || y > 2100) {
                  setYearInput(String(viewDate.getFullYear()));
                }
              }}
              className="w-13 bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] text-[var(--text-primary)] text-[12px] font-mono font-semibold py-1 px-1 rounded-[6px] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--accent)] text-center"
              title="Type year directly (e.g. 1995)"
            />

            <select
              value={viewDate.getFullYear()}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[11px] py-1 px-1 rounded-[6px] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              title="Pick year from list"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Month Stepper Arrows */}
        <div className="flex items-center space-x-0.5">
          <button
            type="button"
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekdays.map((wd) => (
          <div key={wd} className="text-[11px] font-mono text-[var(--text-faint)] py-0.5">
            {wd}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = parsedSelected ? isSameDay(day, parsedSelected) : false;
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleDaySelect(day)}
              className={`h-7 w-7 rounded-[6px] text-[12px] flex items-center justify-center cursor-pointer transition-colors font-sans ${
                isSelected
                  ? 'bg-[var(--accent)] text-[var(--bg-app)] font-semibold shadow-xs'
                  : isCurrentDay
                  ? 'ring-1 ring-[var(--accent)]/50 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  : isCurrentMonth
                  ? 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  : 'text-[#5a544a] hover:bg-[var(--bg-hover)]/50 hover:text-[var(--text-muted)]'
              }`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Footer Info with Selected Date */}
      {parsedSelected && (
        <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)]">
          <span className="flex items-center space-x-1">
            <CalendarIcon className="w-3 h-3 text-[var(--accent)]" />
            <span>{format(parsedSelected, 'EEE, MMM d, yyyy')}</span>
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="text-[var(--red)] hover:underline cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
