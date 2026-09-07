import type { ThreeElement } from '@react-three/fiber';

declare module '@react-three/fiber' {
  namespace ReactThreeFiber {
    type Object3DNode<T, C> = ThreeElement<C extends new (...args: never[]) => T ? C : new () => T>;
  }
}
