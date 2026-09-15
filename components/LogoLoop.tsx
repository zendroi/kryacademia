'use client';

/* eslint-disable @next/next/no-img-element */

import type { CSSProperties } from 'react';
import './LogoLoop.css';

export type LogoItem = { src: string; alt?: string };

export default function LogoLoop({
  logos, speed = 48, logoHeight = 144, gap = 48, pauseOnHover = false,
  fadeOut = false, scaleOnHover = false, ariaLabel = 'Partner logos', className = '',
}: {
  logos: LogoItem[]; speed?: number; logoHeight?: number; gap?: number; pauseOnHover?: boolean;
  fadeOut?: boolean; fadeOutColor?: string; scaleOnHover?: boolean; ariaLabel?: string; className?: string;
}) {
  const style = {
    '--logoloop-gap': `${gap}px`,
    '--logoloop-logo-height': `${logoHeight}px`,
    '--logoloop-duration': `${Math.max(12, logos.length * 200 / Math.max(speed, 1))}s`,
  } as CSSProperties;
  const classes = ['logoloop', pauseOnHover && 'pause-on-hover', fadeOut && 'fade', scaleOnHover && 'scale-on-hover', className]
    .filter(Boolean).join(' ');
  const list = (hidden: boolean) => (
    <ul className="logoloop-list" aria-hidden={hidden || undefined}>
      {logos.map((logo, index) => (
        <li key={`${logo.src}-${index}`}><img src={logo.src} alt={hidden ? '' : logo.alt || ''} loading="lazy" draggable={false} /></li>
      ))}
    </ul>
  );

  return <div className={classes} style={style} role="region" aria-label={ariaLabel}><div className="logoloop-track">{list(false)}{list(true)}</div></div>;
}
