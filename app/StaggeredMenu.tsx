'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

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
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  accentColor?: string;
  changeMenuColorOnOpen?: boolean;
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
  menuButtonColor = 'var(--navy)',
  openMenuButtonColor = '#0b192c',
  changeMenuColorOnOpen = true,
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

  const plusHRef = useRef<HTMLSpanElement | null>(null);
  const plusVRef = useRef<HTMLSpanElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);

  const textInnerRef = useRef<HTMLSpanElement | null>(null);
  const [textLines, setTextLines] = useState<string[]>(['Menu', 'Close']);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Timeline | null>(null);
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
  const colorTweenRef = useRef<gsap.core.Tween | null>(null);

  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef(false);

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;

      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;

      if (!panel || !plusH || !plusV || !icon || !textInner) return;

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

      gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
      gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
      gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });

      gsap.set(textInner, { yPercent: 0 });

      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { color: menuButtonColor });
    });
    return () => ctx.revert();
  }, [menuButtonColor, position]);

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
    if (numberEls.length) gsap.set(numberEls, { ['--sm-num-opacity' as any]: 0 });
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
          { duration: 0.5, ease: 'power2.out', ['--sm-num-opacity' as any]: 1, stagger: { each: 0.05, from: 'start' } },
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
      tl.play(0);
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
      duration: 0.3,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel')) as HTMLElement[];
        if (itemEls.length) gsap.set(itemEls, { yPercent: 120, rotate: 6, opacity: 0 });

        const numberEls = Array.from(
          panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item')
        ) as HTMLElement[];
        if (numberEls.length) gsap.set(numberEls, { ['--sm-num-opacity' as any]: 0 });

        const socialTitle = panel.querySelector('.sm-socials-title') as HTMLElement | null;
        const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link')) as HTMLElement[];
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 20, opacity: 0 });

        busyRef.current = false;
      }
    });
  }, [position]);

  const animateIcon = useCallback((opening: boolean) => {
    const icon = iconRef.current;
    const h = plusHRef.current;
    const v = plusVRef.current;
    if (!icon || !h || !v) return;

    spinTweenRef.current?.kill();

    if (opening) {
      gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
      spinTweenRef.current = gsap
        .timeline({ defaults: { ease: 'power4.out' } })
        .to(h, { rotate: 45, duration: 0.45 }, 0)
        .to(v, { rotate: -45, duration: 0.45 }, 0);
    } else {
      spinTweenRef.current = gsap
        .timeline({ defaults: { ease: 'power3.inOut' } })
        .to(h, { rotate: 0, duration: 0.3 }, 0)
        .to(v, { rotate: 90, duration: 0.3 }, 0)
        .to(icon, { rotate: 0, duration: 0.001 }, 0);
    }
  }, []);

  const animateColor = useCallback(
    (opening: boolean) => {
      const btn = toggleBtnRef.current;
      if (!btn) return;
      colorTweenRef.current?.kill();
      if (changeMenuColorOnOpen) {
        const targetColor = opening ? openMenuButtonColor : menuButtonColor;
        colorTweenRef.current = gsap.to(btn, { color: targetColor, delay: 0.15, duration: 0.25, ease: 'power2.out' });
      } else {
        gsap.set(btn, { color: menuButtonColor });
      }
    },
    [openMenuButtonColor, menuButtonColor, changeMenuColorOnOpen]
  );

  useEffect(() => {
    if (toggleBtnRef.current) {
      if (changeMenuColorOnOpen) {
        const targetColor = openRef.current ? openMenuButtonColor : menuButtonColor;
        gsap.set(toggleBtnRef.current, { color: targetColor });
      } else {
        gsap.set(toggleBtnRef.current, { color: menuButtonColor });
      }
    }
  }, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor]);

  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current;
    if (!inner) return;

    textCycleAnimRef.current?.kill();

    const currentLabel = opening ? 'Menu' : 'Close';
    const targetLabel = opening ? 'Close' : 'Menu';
    const seq: string[] = [currentLabel, opening ? 'Open' : 'Back', targetLabel];

    setTextLines(seq);
    gsap.set(inner, { yPercent: 0 });

    const lineCount = seq.length;
    const finalShift = ((lineCount - 1) / lineCount) * 100;

    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.45,
      ease: 'power4.out'
    });
  }, []);

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

    animateIcon(target);
    animateColor(target);
    animateText(target);
  }, [playOpen, playClose, animateIcon, animateColor, animateText, onMenuOpen, onMenuClose]);

  const closeMenu = useCallback(() => {
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      onMenuClose?.();
      playClose();
      animateIcon(false);
      animateColor(false);
      animateText(false);
    }
  }, [playClose, animateIcon, animateColor, animateText, onMenuClose]);

  useEffect(() => {
    if (!closeOnClickAway || !open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [closeOnClickAway, open, closeMenu]);

  return (
    <div className={`sm-container relative ${className}`.trim()}>
      {/* 🌟 Staggered Menu Toggle Button (Sits in navbar next to login) */}
      <button
        ref={toggleBtnRef}
        className="sm-toggle-btn group"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={toggleMenu}
        type="button"
        title={open ? 'Close menu' : 'Menu'}
      >
        <span className="sm-toggle-text-wrap" aria-hidden="true">
          <span ref={textInnerRef} className="sm-toggle-text-inner">
            {textLines.map((l, idx) => (
              <span className="sm-toggle-line" key={idx}>
                {l}
              </span>
            ))}
          </span>
        </span>

        <span ref={iconRef} className="sm-toggle-icon" aria-hidden="true">
          <span ref={plusHRef} className="sm-toggle-icon-h" />
          <span ref={plusVRef} className="sm-toggle-icon-v" />
        </span>
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
        style={{ ['--sm-accent' as any]: accentColor }}
        aria-label="Navigation menu"
      >
        <div className="sm-panel-header">
          <span className="sm-panel-badge">KRYAcademia</span>
          <button
            className="sm-panel-close-btn"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            ×
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
        .sm-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          padding: 0 16px;
          background: rgba(23, 48, 81, 0.05);
          border: 1px solid rgba(23, 48, 81, 0.12);
          border-radius: 999px;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.02em;
          color: var(--navy);
          cursor: pointer;
          transition: all 0.3s ease;
          user-select: none;
        }

        .sm-toggle-btn:hover {
          background: rgba(23, 48, 81, 0.1);
          border-color: rgba(23, 48, 81, 0.25);
          transform: translateY(-1px);
        }

        .sm-toggle-text-wrap {
          display: inline-block;
          height: 14px;
          overflow: hidden;
          line-height: 14px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .sm-toggle-text-inner {
          display: flex;
          flex-direction: column;
        }

        .sm-toggle-line {
          display: block;
          height: 14px;
          line-height: 14px;
        }

        .sm-toggle-icon {
          position: relative;
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .sm-toggle-icon-h,
        .sm-toggle-icon-v {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 16px;
          height: 2px;
          background: currentColor;
          border-radius: 2px;
          transform: translate(-50%, -50%);
          will-change: transform;
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
          font-size: clamp(1.6rem, 2.8vw, 2.2rem);
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
