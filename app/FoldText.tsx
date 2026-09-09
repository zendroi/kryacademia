'use client';

import React, { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export type SplitBy = 'char' | 'word' | 'line';
export type Hinge = 'top' | 'bottom' | 'left' | 'right';
export type Trigger = 'mount' | 'hover' | 'scroll' | 'loop';

export interface FoldTextProps {
  text?: string;
  splitBy?: SplitBy;
  hinge?: Hinge;
  duration?: number;
  stagger?: number;
  ease?: string;
  perspective?: number;
  creaseShading?: number;
  trigger?: Trigger;
  fontSize?: string | number;
  fontWeight?: string | number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

type HingeConfig = {
  origin: string;
  rotateX: number;
  rotateY: number;
};

const HINGE_CONFIG: Record<Hinge, HingeConfig> = {
  top: { origin: '50% 0%', rotateX: -92, rotateY: 0 },
  bottom: { origin: '50% 100%', rotateX: 92, rotateY: 0 },
  left: { origin: '0% 50%', rotateX: 0, rotateY: 92 },
  right: { origin: '100% 50%', rotateX: 0, rotateY: -92 }
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const FOLD_TEXT_STYLES = `
.fold-text {
  display: inline-block;
  color: var(--fold-text-color, currentColor);
  font-size: var(--fold-text-font-size, inherit);
  font-weight: var(--fold-text-font-weight, inherit);
  line-height: inherit;
  letter-spacing: inherit;
  white-space: pre-wrap;
  user-select: text;
}

.fold-text-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.fold-text-visual {
  display: inline;
}

.fold-text-word-wrap {
  display: inline-block;
  white-space: nowrap;
}

.fold-text-line {
  display: block;
}

.fold-text-whitespace {
  display: inline;
}

.fold-text-segment {
  display: inline-block;
  line-height: inherit;
  perspective: var(--fold-perspective, 700px);
  transform-style: preserve-3d;
  vertical-align: baseline;
}

.fold-text-segment[data-fold-split='line'] {
  display: block;
}

.fold-text-piece {
  position: relative;
  display: inline-block;
  color: inherit;
  line-height: inherit;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform, opacity;
}

.fold-text-piece::after {
  content: '';
  position: absolute;
  inset: -0.08em -0.02em;
  pointer-events: none;
  opacity: var(--fold-crease, 0);
  mix-blend-mode: multiply;
  border-radius: 0.08em;
}

.fold-text-piece[data-fold-hinge='top']::after {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.48) 0%, rgba(0, 0, 0, 0.18) 42%, rgba(255, 255, 255, 0.22) 100%);
}

.fold-text-piece[data-fold-hinge='bottom']::after {
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.48) 0%, rgba(0, 0, 0, 0.18) 42%, rgba(255, 255, 255, 0.22) 100%);
}

.fold-text-piece[data-fold-hinge='left']::after {
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.48) 0%, rgba(0, 0, 0, 0.18) 42%, rgba(255, 255, 255, 0.22) 100%);
}

.fold-text-piece[data-fold-hinge='right']::after {
  background: linear-gradient(270deg, rgba(0, 0, 0, 0.48) 0%, rgba(0, 0, 0, 0.18) 42%, rgba(255, 255, 255, 0.22) 100%);
}

@media (prefers-reduced-motion: reduce) {
  .fold-text-piece {
    transform: none !important;
  }

  .fold-text-piece::after {
    opacity: 0 !important;
  }
}
`;

export default function FoldText({
  text = 'Design unfolds',
  splitBy = 'char',
  hinge = 'top',
  duration = 0.65,
  stagger = 0.035,
  ease = 'power3.out',
  perspective = 700,
  creaseShading = 0.5,
  trigger = 'scroll',
  fontSize = 'inherit',
  fontWeight = 'inherit',
  color = 'inherit',
  className = '',
  style = {}
}: FoldTextProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const hingeConfig = HINGE_CONFIG[hinge] || HINGE_CONFIG.top;
  const safeCrease = clamp(creaseShading, 0, 1);
  const safePerspective = Math.max(120, perspective);

  const segments = useMemo(() => {
    const renderSegment = (content: string, key: string, split: SplitBy = splitBy): ReactNode => {
      return (
        <span
          className="fold-text-segment"
          data-fold-split={split}
          key={key}
          style={{ '--fold-perspective': `${safePerspective}px` } as CSSProperties}
        >
          <span
            className="fold-text-piece"
            data-fold-hinge={hinge}
            style={{ transformOrigin: hingeConfig.origin, '--fold-crease': 0 } as CSSProperties}
          >
            {content || '\u00A0'}
          </span>
        </span>
      );
    };

    if (splitBy === 'line') {
      return text.split('\n').map((line, index) => (
        <span className="fold-text-line" key={`line-${index}`}>
          {renderSegment(line || '\u00A0', `segment-line-${index}`, 'line')}
        </span>
      ));
    }

    if (splitBy === 'word') {
      return text.split(/(\s+)/).flatMap((part, index) => {
        if (!part) return [];
        if (/^\s+$/.test(part)) {
          return (
            <span className="fold-text-whitespace" key={`ws-${index}`}>
              {' '}
            </span>
          );
        }
        return renderSegment(part, `segment-word-${index}`);
      });
    }

    // Default 'char': Group words in nowrap containers so words wrap cleanly while characters fold
    const words = text.split(/(\s+)/);
    return words.flatMap((wordOrSpace, wIdx) => {
      if (!wordOrSpace) return [];
      if (/^\s+$/.test(wordOrSpace)) {
        return (
          <span className="fold-text-whitespace" key={`space-${wIdx}`}>
            {' '}
          </span>
        );
      }
      return (
        <span className="fold-text-word-wrap" key={`word-wrap-${wIdx}`}>
          {Array.from(wordOrSpace).map((char, cIdx) =>
            renderSegment(char, `char-${wIdx}-${cIdx}`, 'char')
          )}
        </span>
      );
    });
  }, [text, splitBy, hinge, hingeConfig.origin, safePerspective]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    gsap.registerPlugin(ScrollTrigger);

    const root = rootRef.current;
    if (!root) return undefined;

    const pieces = Array.from(root.querySelectorAll<HTMLElement>('.fold-text-piece'));
    if (!pieces.length) return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const activeDuration = reduceMotion ? Math.min(duration, 0.22) : duration;
    const activeStagger = reduceMotion ? Math.min(stagger, 0.02) : stagger;
    const fromVars = {
      opacity: 0,
      rotateX: reduceMotion ? 0 : hingeConfig.rotateX,
      rotateY: reduceMotion ? 0 : hingeConfig.rotateY,
      '--fold-crease': reduceMotion ? 0 : safeCrease,
      transformOrigin: hingeConfig.origin,
      force3D: true
    };
    const toVars = {
      opacity: 1,
      rotateX: 0,
      rotateY: 0,
      '--fold-crease': 0,
      duration: activeDuration,
      ease: reduceMotion ? 'power1.out' : ease,
      stagger: activeStagger,
      clearProps: 'willChange'
    };

    const killTimeline = () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      gsap.killTweensOf(pieces);
    };

    const play = (repeat: boolean): gsap.core.Timeline => {
      killTimeline();
      timelineRef.current = gsap.timeline({ repeat: repeat ? -1 : 0, repeatDelay: repeat ? 0.75 : 0 });
      timelineRef.current.fromTo(pieces, fromVars, toVars);
      return timelineRef.current;
    };

    let observer: IntersectionObserver | undefined;
    let hoverHandler: (() => void) | undefined;

    if (trigger === 'hover') {
      gsap.set(pieces, { opacity: 1, rotateX: 0, rotateY: 0, '--fold-crease': 0, transformOrigin: hingeConfig.origin });
      hoverHandler = () => play(false);
      root.addEventListener('mouseenter', hoverHandler);
    } else if (trigger === 'scroll') {
      gsap.set(pieces, fromVars);

      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry && entry.isIntersecting) {
            play(false);
          } else {
            killTimeline();
            gsap.set(pieces, fromVars);
          }
        },
        {
          threshold: 0.1,
          rootMargin: '0px 0px -20px 0px'
        }
      );

      observer.observe(root);

      hoverHandler = () => {
        if (!timelineRef.current?.isActive()) {
          play(false);
        }
      };
      root.addEventListener('mouseenter', hoverHandler);
    } else if (trigger === 'loop') {
      play(true);
    } else {
      play(false);
    }

    return () => {
      if (hoverHandler) root.removeEventListener('mouseenter', hoverHandler);
      observer?.disconnect();
      killTimeline();
    };
  }, [
    text,
    splitBy,
    hinge,
    duration,
    stagger,
    ease,
    perspective,
    safeCrease,
    trigger,
    hingeConfig.origin,
    hingeConfig.rotateX,
    hingeConfig.rotateY
  ]);

  const rootStyle: CSSProperties = {
    '--fold-text-font-size': typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
    '--fold-text-font-weight': fontWeight,
    '--fold-text-color': color,
    ...style
  } as CSSProperties;

  return (
    <>
      <style>{FOLD_TEXT_STYLES}</style>
      <span ref={rootRef} className={`fold-text ${className}`.trim()} style={rootStyle}>
        <span className="fold-text-sr-only">{text}</span>
        <span className="fold-text-visual" aria-hidden="true">
          {segments}
        </span>
      </span>
    </>
  );
}
