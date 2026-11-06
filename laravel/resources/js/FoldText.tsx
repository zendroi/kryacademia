'use client';

import { useEffect, useRef, useState } from 'react';

export default function FoldText({ text = '', className = '' }: { text?: string; trigger?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.1,
      rootMargin: '0px 0px -20px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className={`fold-text ${visible ? 'is-visible' : ''} ${className}`.trim()}>
      {text.split(/(\s+)/).map((part, index) =>
        /^\s+$/.test(part) ? part : (
          <span className="fold-text-word" key={`${part}-${index}`}>
            {Array.from(part).map((character, characterIndex) => (
              <span className="fold-text-character" style={{ transitionDelay: `${characterIndex * 22}ms` }} key={characterIndex}>
                {character}
              </span>
            ))}
          </span>
        )
      )}
    </span>
  );
}
