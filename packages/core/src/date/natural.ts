/**
 * Natural language date parsing helper for Hecate
 * Converts "today", "tomorrow", "yesterday", "next monday", etc. into YYYY-MM-DD
 */

export function parseNaturalDate(input: string, referenceDate: Date = new Date()): string | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();

  // Direct ISO date check: YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return clean;
  }

  const d = new Date(referenceDate);

  if (clean === 'today') {
    return formatDate(d);
  }

  if (clean === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }

  if (clean === 'yesterday') {
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }

  // Days of week: monday, tuesday, etc.
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIdx = days.indexOf(clean.replace(/^next\s+/, ''));
  if (dayIdx !== -1) {
    const currentDay = d.getDay();
    let diff = dayIdx - currentDay;
    if (diff <= 0 || clean.startsWith('next ')) {
      diff += 7;
    }
    d.setDate(d.getDate() + diff);
    return formatDate(d);
  }

  // in X days / +X d
  const inDaysMatch = clean.match(/^(?:in\s+)?(\d+)\s*(?:d|day|days)?$/);
  if (inDaysMatch && !clean.includes('-')) {
    const daysToAdd = parseInt(inDaysMatch[1], 10);
    d.setDate(d.getDate() + daysToAdd);
    return formatDate(d);
  }

  return null;
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
