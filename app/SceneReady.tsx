'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function SceneReady({ onReady }: { onReady: (ready: boolean) => void }) {
  const rendered = useRef(false);
  useFrame(() => {
    if (!rendered.current) {
      rendered.current = true;
      onReady(true);
    }
  });
  return null;
}
