import type { ImgHTMLAttributes } from 'react';
type Props = ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean; priority?: boolean; fill?: boolean };
export default function Image({ unoptimized, priority, fill, style, ...props }: Props) {
  return <img {...props} loading={priority ? 'eager' : props.loading || 'lazy'} style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style} />;
}
