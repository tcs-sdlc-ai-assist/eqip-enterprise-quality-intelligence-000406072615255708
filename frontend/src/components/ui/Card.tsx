import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Inner padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, padding = 'md', className, ...rest }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'border border-border rounded-md bg-surface',
        paddingMap[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  ),
);

Card.displayName = 'Card';

export { Card };
