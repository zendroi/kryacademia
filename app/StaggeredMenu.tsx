'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

export interface StaggeredMenuItem { label: string; ariaLabel?: string; link: string }
export interface StaggeredMenuSocialItem { label: string; link: string }

export default function StaggeredMenu({
  items = [], socialItems = [], accentColor = '#e8001b', className = '', onMenuOpen, onMenuClose,
}: {
  items?: StaggeredMenuItem[]; socialItems?: StaggeredMenuSocialItem[]; colors?: string[];
  accentColor?: string; className?: string; onMenuOpen?: () => void; onMenuClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);

  const close = useCallback(() => { setOpen(false); onMenuClose?.(); }, [onMenuClose]);
  const toggle = () => {
    setOpen(value => {
      if (value) onMenuClose?.(); else onMenuOpen?.();
      return !value;
    });
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const targets = panel.current?.querySelectorAll<HTMLElement>('a, button');
      if (!targets?.length) return;
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    <div className={`sm-container ${className}`.trim()} style={{ '--sm-accent': accentColor } as React.CSSProperties}>
      <button className="sm-burger-btn" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={toggle} type="button">
        {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>
      <button className={`sm-backdrop ${open ? 'open' : ''}`} aria-label="Close menu" tabIndex={open ? 0 : -1} onClick={close} />
      <aside ref={panel} className={`sm-drawer-panel ${open ? 'open' : ''}`} aria-hidden={!open} inert={!open} aria-label="Navigation menu">
        <header><strong>KRYAcademia</strong><button onClick={close} aria-label="Close menu"><X size={20} aria-hidden /></button></header>
        <nav>
          {items.map((item, index) => <a href={item.link} aria-label={item.ariaLabel || item.label} onClick={close} key={item.link} style={{ transitionDelay: `${index * 35}ms` }}>{item.label}<small>{String(index + 1).padStart(2, '0')}</small></a>)}
        </nav>
        <footer>
          <small>Explore & Connect</small>
          {socialItems.map(item => <a href={item.link} onClick={close} key={item.link}>{item.label}</a>)}
        </footer>
      </aside>
      <style jsx global>{`
        .sm-container { display: grid; place-items: center; }
        .sm-burger-btn, .sm-drawer-panel header button { width: 44px; height: 44px; border: 1px solid rgba(23,48,81,.14); border-radius: 50%; background: rgba(255,255,255,.72); color: var(--navy); display: grid; place-items: center; cursor: pointer; }
        .sm-backdrop { position: fixed; inset: 0; z-index: 9990; border: 0; background: rgba(11,25,44,.45); backdrop-filter: blur(8px); opacity: 0; pointer-events: none; transition: opacity .3s ease; }
        .sm-backdrop.open { opacity: 1; pointer-events: auto; }
        .sm-drawer-panel { position: fixed; inset: 0 0 0 auto; z-index: 9991; width: min(500px, 90vw); padding: 2.5rem; background: #faf9f5; box-shadow: -15px 0 50px rgba(11,25,44,.25); display: flex; flex-direction: column; overflow-y: auto; transform: translateX(100%); visibility: hidden; transition: transform .45s cubic-bezier(.16,1,.3,1), visibility 0s .45s; }
        .sm-drawer-panel.open { transform: none; visibility: visible; transition-delay: 0s; }
        .sm-drawer-panel header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(23,48,81,.1); }
        .sm-drawer-panel header strong { color: var(--navy); font-size: 13px; text-transform: uppercase; }
        .sm-drawer-panel nav { display: grid; gap: .4rem; padding: 1.5rem 0; }
        .sm-drawer-panel nav a { display: flex; justify-content: space-between; align-items: baseline; padding: .25rem 0; color: var(--navy); font-size: 28px; font-weight: 800; opacity: 0; transform: translateX(18px); transition: color .2s, transform .35s, opacity .35s; }
        .sm-drawer-panel.open nav a { opacity: 1; transform: none; }
        .sm-drawer-panel nav a:hover { color: var(--sm-accent); }
        .sm-drawer-panel nav small { color: var(--sm-accent); font-size: 13px; }
        .sm-drawer-panel footer { display: flex; flex-wrap: wrap; gap: .75rem 1.25rem; margin-top: auto; padding-top: 1.5rem; border-top: 1px solid rgba(23,48,81,.1); }
        .sm-drawer-panel footer small { flex-basis: 100%; color: var(--muted); font-weight: 700; text-transform: uppercase; }
        .sm-drawer-panel footer a { color: var(--navy); font-size: 14px; font-weight: 600; }
        @media (min-width: 1051px) { .sm-container { display: none; } }
        @media (prefers-reduced-motion: reduce) { .sm-drawer-panel, .sm-drawer-panel nav a, .sm-backdrop { transition: none; } }
      `}</style>
    </div>
  );
}
