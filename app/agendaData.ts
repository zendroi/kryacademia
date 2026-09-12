import { events } from './mockData';

export type AgendaEvent = { id: string; date: string; title: string; kind: string; mode: string; time: string };

// These are existing prototype entries, not a published schedule.
export const agendaEvents: AgendaEvent[] = events.map(([day, title, kind, mode, time], index) => ({
  id: `sample-${index}`, date: `2026-09-${day}`, title, kind, mode, time,
}));

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDate(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function monthCells(month: string) {
  const first = parseDate(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= total ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
}

export function eventsOnDate(items: readonly AgendaEvent[], date: string) {
  return items.filter((event) => event.date === date);
}
