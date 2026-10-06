'use client';

import Image from 'next/image';
import Link, { useLinkStatus } from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

// Words motion adapted from https://smoothui.dev/r/page-preloader.json.
const words = ['Inspiring', 'Creating', 'Dedicating'];
const PendingContext = createContext<(id: string, pending: boolean) => void>(() => {});

function Words() {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % words.length), 480);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  return <div className="page-preloader-words">
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={index} initial={reducedMotion ? false : { opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -100 }} transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0.1, duration: 0.25 }}>{words[index]}<b>.</b></motion.span>
    </AnimatePresence>
  </div>;
}

export default function PagePreloader({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotion();
  return <AnimatePresence>
    {active && <motion.div className="page-preloader" role="status" aria-live="polite" initial={false} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 1, y: '-100%' }} transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.645, 0.045, 0.355, 1] }}>
      <span className="sr-only">Loading KRYAcademia</span>
      <div className="page-preloader-visual" aria-hidden="true">
        <div className="page-preloader-brand"><Image src="/kryacademia-logo.png" alt="" width={38} height={42} priority /><strong>KRYAcademia</strong></div>
        <Words />
        <span className="page-preloader-accent" />
      </div>
    </motion.div>}
  </AnimatePresence>;
}

export function PagePreloaderProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(() => new Set(['initial']));
  const content = useRef<HTMLDivElement>(null);
  const active = pending.size > 0;
  const update = useCallback((id: string, loading: boolean) => {
    setPending((current) => {
      if (current.has(id) === loading) return current;
      const next = new Set(current);
      if (loading) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => update('initial', false));
    return () => cancelAnimationFrame(frame);
  }, [update]);
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    element.inert = active;
    return () => { element.inert = false; };
  }, [active]);

  return <PendingContext.Provider value={update}>
    <div className="page-render-content" ref={content} aria-busy={active}>{children}</div>
    <PagePreloader active={active} />
    <noscript><style>{'.page-preloader { display: none !important; }'}</style></noscript>
  </PendingContext.Provider>;
}

function usePagePending(pending: boolean) {
  const id = useId();
  const update = useContext(PendingContext);
  useEffect(() => {
    update(id, pending);
    return () => update(id, false);
  }, [id, pending, update]);
}

export function RoutePagePreloader() {
  usePagePending(true);
  return null;
}

export function FormPagePreloader() {
  const { pending } = useFormStatus();
  usePagePending(pending);
  return null;
}

function LinkPagePreloader() {
  const { pending } = useLinkStatus();
  usePagePending(pending);
  return null;
}

export function PageLoadingLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<LinkPagePreloader /></Link>;
}
