'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { agendaEvents, dateKey, eventsOnDate, monthCells, parseDate } from './agendaData';

const formatDay = (key: string) => parseDate(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AgendaCalendar() {
  const [month, setMonth] = useState('2026-09');
  const [selected, setSelected] = useState('2026-09-08');
  const [today, setToday] = useState('');
  const [tab, setTab] = useState('All');
  const days = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setToday(dateKey(new Date()));
    update();
    const timer = window.setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);

  const cells = monthCells(month);
  const selectedIndex = cells.indexOf(selected);
  const matching = eventsOnDate(agendaEvents, selected);
  const visibleEvents = agendaEvents.filter((event) => event.date.startsWith(month) && (
    tab === 'All' || (tab === 'Upcoming' && event.date > today) ||
    (tab === 'Today' && event.date === today) || (tab === 'Past' && event.date < today)
  ));

  function select(date: string) {
    setSelected(date);
    setMonth(date.slice(0, 7));
    setTab('All');
  }

  function moveMonth(delta: number) {
    const next = parseDate(`${month}-01`);
    next.setMonth(next.getMonth() + delta);
    setMonth(dateKey(next).slice(0, 7));
  }

  function onDayKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offset: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in offset)) return;
    event.preventDefault();
    const next = parseDate(date);
    next.setDate(next.getDate() + offset[event.key]);
    const key = dateKey(next);
    select(key);
    requestAnimationFrame(() => days.current?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)?.focus());
  }

  return (
    <div className="agenda-calendar">
      <div className="agenda-month">
        <header>
          <div><small>Sample agenda</small><h3>{parseDate(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3></div>
          <div className="month-controls">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" title="Previous month"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" title="Next month"><ChevronRight size={18} /></button>
          </div>
        </header>
        <div className="agenda-week" aria-hidden="true">{['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="agenda-days" ref={days} role="group" aria-label="Choose a date">
          <span className="selected-day-disc" aria-hidden="true" style={{
            opacity: selectedIndex < 0 ? 0 : 1,
            left: `calc(${((Math.max(0, selectedIndex) % 7) + 0.5) * 100 / 7}% - 17px)`,
            top: `${Math.floor(Math.max(0, selectedIndex) / 7) * 44 + 5}px`,
          }} />
          {cells.map((date, index) => date ? (
            <button type="button" key={date} data-date={date} onClick={() => select(date)} onKeyDown={(event) => onDayKey(event, date)}
              aria-label={`${formatDay(date)}${eventsOnDate(agendaEvents, date).length ? ', has events' : ''}`}
              aria-pressed={selected === date} aria-current={today === date ? 'date' : undefined}
              className={`${selected === date ? 'selected' : ''} ${today === date ? 'is-today' : ''} ${eventsOnDate(agendaEvents, date).length ? 'has-events' : ''}`}>
              <span>{Number(date.slice(-2))}</span>
            </button>
          ) : <span key={`empty-${index}`} aria-hidden="true" />)}
        </div>
        <footer>
          <span className="today-legend"><i aria-hidden="true" />Today</span>
          <button type="button" disabled={!today} onClick={() => select(today)}>Today</button>
        </footer>
      </div>
      <div className="agenda-events">
        <div className="agenda-filter" role="group" aria-label="Filter agenda">
          {['All', 'Upcoming', 'Today', 'Past'].map((name) => <button type="button" key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}
        </div>
        <p className="agenda-selection" role="status"><strong>{formatDay(selected)}</strong><span>{matching.length ? `${matching.length} sample event${matching.length > 1 ? 's' : ''}` : 'No events scheduled for this date.'}</span></p>
        <div className="agenda-event-rows">
          {visibleEvents.map((event) => (
            <button type="button" key={event.id} className={`agenda-event ${event.date === selected ? 'is-selected' : ''}`} aria-pressed={event.date === selected} onClick={() => select(event.date)}>
              <span className="event-date"><strong>{Number(event.date.slice(-2))}</strong><small>{parseDate(event.date).toLocaleDateString('en-GB', { month: 'short' })}</small></span>
              <span className="event-details"><small>{event.kind} · {event.mode}</small><strong>{event.title}</strong><span>{event.time}</span></span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          ))}
          {visibleEvents.length === 0 && <p className="agenda-empty">No {tab === 'All' ? '' : tab.toLowerCase() + ' '}events in this month.</p>}
        </div>
      </div>
    </div>
  );
}
