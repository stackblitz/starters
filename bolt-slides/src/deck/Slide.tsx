import type { CSSProperties, ReactNode } from 'react';

export default function Slide({
  children,
  center,
  full,
  className = '',
  style,
}: {
  children: ReactNode;
  center?: boolean;
  full?: boolean;
  notes?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`slide${center ? ' center' : ''}${full ? ' full' : ''}${
        className ? ' ' + className : ''
      }`}
      style={style}
    >
      {full ? children : <div className="container">{children}</div>}
    </div>
  );
}
