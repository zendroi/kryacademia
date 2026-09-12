'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Menu, X } from 'lucide-react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface StaggeredMenuItem {
  label: string;
  ariaLabel?: string;
  link: string;
}

export interface StaggeredMenuSocialItem {
  label: string;
  link: string;
}

export interface StaggeredMenuProps {
  position?: 'left' | 'right';
  colors?: string[];
  items?: StaggeredMenuItem[];
  socialItems?: StaggeredMenuSocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  className?: string;
  accentColor?: string;
  closeOnClickAway?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

export default function StaggeredMenu({
  position = 'right',
  colors = ['#0b192c', '#173051', '#e8001b'],
  items = [],
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = true,
  className = '',
  accentColor = '#e8001b',
  closeOnClickAway = true,
  onMenuOpen,
  onMenuClose
}: StaggeredMenuProps) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const preLayersRef = useRef<HTMLDivElement | null>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const busyRef = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      if (!panel) return;

      let preLayers: HTMLElement[] = [];
      if (preContainer) {
        preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer')) as HTMLElement[];
      }
      preLayerElsRef.current = preLayers;

      const offscreen = position === 'left' ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen, opacity: 1 });
      if (preContainer) {
        gsap.set(preContainer, { xPercent: 0, opacity: 1 });
      }
    });
    return () => ctx.revert();
  }, [position]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    if (closeTweenRef.current) {
      closeTweenRef.current.kill();
      closeTweenRef.current = null;
    }

    const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel')) as HTMLElement[];
    const numberEls = Array.from(
      panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item')
    ) as HTMLElement[];
    const socialTitle = panel.querySelector('.sm-socials-title') as HTMLElement | null;
    const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link')) as HTMLElement[];

    const offscreen = position === 'left' ? -100 : 100;
    const layerStates = layers.map(el => ({ el, start: offscreen }));
    const panelStart = offscreen;

    if (itemEls.length) gsap.set(itemEls, { yPercent: 120, rotate: 6, opacity: 0 });
    if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 20, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    layerStates.forEach((ls, i) => {
      tl.fromTo(ls.el, { xPercent: ls.start }, { xPercent: 0, duration: 0.45, ease: 'power4.out' }, i * 0.06);
    });

    const lastTime = layerStates.length ? (layerStates.length - 1) * 0.06 : 0;
    const panelInsertTime = lastTime + (layerStates.length ? 0.07 : 0);
    const panelDuration = 0.55;

    tl.fromTo(
      panel,
      { xPercent: panelStart },
      { xPercent: 0, duration: panelDuration, ease: 'power4.out' },
      panelInsertTime
    );

    if (itemEls.length) {
      const itemsStartRatio = 0.15;
      const itemsStart = panelInsertTime + panelDuration * itemsStartRatio;

      tl.to(
        itemEls,
        { yPercent: 0, rotate: 0, opacity: 1, duration: 0.7, ease: 'power4.out', stagger: { each: 0.06, from: 'start' } },
        itemsStart
      );

      if (numberEls.length) {
        tl.to(
          numberEls,
          { duration: 0.5, ease: 'power2.out', '--sm-num-opacity': 1, stagger: { each: 0.05, from: 'start' } },
          itemsStart + 0.08
        );
      }
    }

    if (socialTitle || socialLinks.length) {
      const socialsStart = panelInsertTime + panelDuration * 0.4;
      if (socialTitle) tl.to(socialTitle, { opacity: 1, duration: 0.4, ease: 'power2.out' }, socialsStart);
      if (socialLinks.length) {
        tl.to(
          socialLinks,
          {
            y: 0,
            opacity: 1,
            duration: 0.45,
            ease: 'power3.out',
            stagger: { each: 0.06, from: 'start' },
            onComplete: () => {
              gsap.set(socialLinks, { clearProps: 'opacity' });
            }
          },
          socialsStart + 0.04
        );
      }
    }

    openTlRef.current = tl;
    return tl;
  }, [position]);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback('onComplete', () => {
        busyRef.current = false;
      });
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) tl.progress(1);
      else tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;

    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;

    const all: HTMLElement[] = [...layers, panel];
    closeTweenRef.current?.kill();

    const offscreen = position === 'left' ? -100 : 100;

    closeTweenRef.current = gsap.to(all, {
      xPercent: offscreen,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.3,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel')) as HTMLElement[];
        if (itemEls.length) gsap.set(itemEls, { yPercent: 120, rotate: 6, opacity: 0 });

        const numberEls = Array.from(
          panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item')
        ) as HTMLElement[];
        if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });

        const socialTitle = panel.querySelector('.sm-socials-title') as HTMLElement | null;
        const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link')) as HTMLElement[];
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 20, opacity: 0 });

        busyRef.current = false;
      }
    });
  }, [position]);

  const toggleMenu = useCallback(() => {
    const target = !openRef.current;
    openRef.current = target;
    setOpen(target);

    if (target) {
      onMenuOpen?.();
      playOpen();
    } else {
      onMenuClose?.();
      playClose();
    }
  }, [playOpen, playClose, onMenuOpen, onMenuClose]);

  const closeMenu = useCallback(() => {
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      onMenuClose?.();
      playClose();
    }
  }, [playClose, onMenuClose]);

  useEffect(() => {
    if (!closeOnClickAway || !open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const desktop = window.matchMedia('(min-width: 1051px)');
    const onResize = () => { if (desktop.matches) closeMenu(); };
    desktop.addEventListener('change', onResize);

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !document.querySelector('.sm-burger-btn')?.contains(target)
      ) {
        closeMenu();
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
      if (event.key === 'Tab') {
        const targets = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button');
        if (!targets?.length) return;
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
      desktop.removeEventListener('change', onResize);
      document.body.style.overflow = previousOverflow;
      document.querySelector<HTMLButtonElement>('.sm-burger-btn')?.focus({ preventScroll: true });
    };
  }, [closeOnClickAway, open, closeMenu]);

  return (
    <div className={`sm-container relative ${className}`.trim()}>
      {/* 🌟 3-Line Hamburger Button (Garis Tiga) */}
      <button
        className={`sm-burger-btn ${open ? 'sm-open' : ''}`}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={toggleMenu}
        type="button"
        title={open ? 'Close menu' : 'Menu'}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>

      {/* 🌟 Full-Screen Backdrop when open */}
      <div
        className={`sm-backdrop ${open ? 'sm-backdrop-active' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* 🌟 Staggered Underlay Layers */}
      <div
        ref={preLayersRef}
        className="sm-prelayers-fixed"
        aria-hidden="true"
        data-position={position}
      >
        {colors.map((c, i) => (
          <div
            key={i}
            className="sm-prelayer"
            style={{ background: c }}
          />
        ))}
      </div>

      {/* 🌟 Main Staggered Drawer Panel */}
      <aside
        ref={panelRef}
        className="sm-drawer-panel"
        data-position={position}
        style={{ '--sm-accent': accentColor } as React.CSSProperties}
        inert={!open}
        aria-hidden={!open}
        aria-label="Navigation menu"
      >
        <div className="sm-panel-header">
          <span className="sm-panel-badge">KRYAcademia</span>
          <button
            className="sm-panel-close-btn"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="sm-panel-body">
          <ul
            className="sm-panel-list"
            data-numbering={displayItemNumbering || undefined}
          >
            {items.map((it, idx) => (
              <li className="sm-panel-item-wrap" key={it.label + idx}>
                <a
                  className="sm-panel-item"
                  href={it.link}
                  aria-label={it.ariaLabel || it.label}
                  onClick={() => {
                    closeMenu();
                  }}
                >
                  <span className="sm-panel-itemLabel">{it.label}</span>
                </a>
              </li>
            ))}
          </ul>

          {displaySocials && socialItems.length > 0 && (
            <div className="sm-panel-footer">
              <span className="sm-socials-title">Explore & Connect</span>
              <ul className="sm-socials-list">
                {socialItems.map((s, i) => (
                  <li key={s.label + i}>
                    <a
                      href={s.link}
                      className="sm-socials-link"
                      onClick={() => {
                        if (s.link.startsWith('#')) closeMenu();
                      }}
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      <style jsx global>{`
        /* 🌟 Garis Tiga (3-line Hamburger) Button */
        .sm-burger-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(23, 48, 81, 0.05);
          border: 1px solid rgba(23, 48, 81, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          color: var(--navy);
          padding: 0;
          outline: none;
        }

        .sm-burger-btn:hover {
          background: rgba(23, 48, 81, 0.1);
          border-color: rgba(23, 48, 81, 0.25);
          transform: scale(1.06);
        }

        .sm-burger-btn.sm-open {
          background: rgba(232, 0, 27, 0.1);
          border-color: rgba(232, 0, 27, 0.3);
          color: #e8001b;
        }

        .sm-burger-icon {
          position: relative;
          width: 18px;
          height: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
        }

        .sm-burger-line {
          display: block;
          width: 18px;
          height: 2px;
          background: currentColor;
          border-radius: 2px;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.2s ease,
                      background-color 0.3s ease;
          transform-origin: center;
        }

        /* Morphing lines into X when open */
        .sm-burger-btn.sm-open .sm-line-top {
          transform: translateY(5px) rotate(45deg);
        }

        .sm-burger-btn.sm-open .sm-line-mid {
          opacity: 0;
          transform: scaleX(0);
        }

        .sm-burger-btn.sm-open .sm-line-bot {
          transform: translateY(-5px) rotate(-45deg);
        }

        /* 🌟 Backdrop */
        .sm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(11, 25, 44, 0.45);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9990;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s ease;
        }

        .sm-backdrop.sm-backdrop-active {
          opacity: 1;
          pointer-events: auto;
        }

        /* 🌟 Staggered Layers */
        .sm-prelayers-fixed {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: clamp(320px, 42vw, 500px);
          pointer-events: none;
          z-index: 9995;
        }

        .sm-prelayers-fixed[data-position='left'] {
          right: auto;
          left: 0;
        }

        .sm-prelayer {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: 100%;
          will-change: transform;
        }

        /* 🌟 Main Drawer Panel */
        .sm-drawer-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: clamp(320px, 42vw, 500px);
          height: 100%;
          background: #faf9f5;
          box-shadow: -15px 0 50px rgba(11, 25, 44, 0.25);
          display: flex;
          flex-direction: column;
          padding: 2.5rem 2.5rem 2rem;
          overflow-y: auto;
          z-index: 9998;
          will-change: transform;
        }

        .sm-drawer-panel[data-position='left'] {
          right: auto;
          left: 0;
          box-shadow: 15px 0 50px rgba(11, 25, 44, 0.25);
        }

        .sm-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 2rem;
          border-bottom: 1px solid rgba(23, 48, 81, 0.08);
          margin-bottom: 1.5rem;
        }

        .sm-panel-badge {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--navy);
          background: rgba(23, 48, 81, 0.06);
          padding: 6px 14px;
          border-radius: 999px;
        }

        .sm-panel-close-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(23, 48, 81, 0.05);
          border: 1px solid rgba(23, 48, 81, 0.1);
          color: var(--navy);
          font-size: 24px;
          line-height: 1;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .sm-panel-close-btn:hover {
          background: #e8001b;
          border-color: #e8001b;
          color: white;
          transform: rotate(90deg);
        }

        .sm-panel-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 2rem;
        }

        .sm-panel-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .sm-panel-item-wrap {
          position: relative;
          overflow: hidden;
          line-height: 1.1;
        }

        .sm-panel-item {
          position: relative;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--navy);
          text-decoration: none;
          transition: color 0.2s ease, transform 0.2s ease;
          padding: 4px 0;
        }

        .sm-panel-itemLabel {
          display: inline-block;
          will-change: transform;
          transform-origin: 50% 100%;
        }

        .sm-panel-item:hover {
          color: var(--sm-accent, #e8001b);
          transform: translateX(6px);
        }

        .sm-panel-list[data-numbering] {
          counter-reset: smItem;
        }

        .sm-panel-list[data-numbering] .sm-panel-item::after {
          counter-increment: smItem;
          content: counter(smItem, decimal-leading-zero);
          font-size: 14px;
          font-weight: 600;
          color: var(--sm-accent, #e8001b);
          opacity: var(--sm-num-opacity, 0);
          letter-spacing: 0;
          transition: opacity 0.3s ease;
        }

        .sm-panel-footer {
          margin-top: auto;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(23, 48, 81, 0.08);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .sm-socials-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #5e6b7c);
        }

        .sm-socials-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
        }

        .sm-socials-link {
          font-size: 14px;
          font-weight: 600;
          color: var(--navy);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .sm-socials-link:hover {
          color: var(--sm-accent, #e8001b);
        }

        @media (max-width: 640px) {
          .sm-prelayers-fixed,
          .sm-drawer-panel {
            width: 100vw;
          }
          .sm-drawer-panel {
            padding: 2rem 1.5rem 1.5rem;
          }
          .sm-panel-item {
            font-size: 1.6rem;
          }
        }
      `}</style>
    </div>
  );
}
