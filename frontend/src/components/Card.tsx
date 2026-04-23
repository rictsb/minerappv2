import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  as?: 'div' | 'section' | 'article';
}

const padMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/** Standard elevated surface. White paper on the warm canvas, hairline border. */
export default function Card({
  children,
  className = '',
  padding = 'md',
  as: Tag = 'div',
}: CardProps) {
  return (
    <Tag
      className={`bg-elevated border border-hairline rounded-md shadow-xs ${padMap[padding]} ${className}`}
    >
      {children}
    </Tag>
  );
}
