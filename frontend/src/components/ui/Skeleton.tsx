import { forwardRef } from 'react';
import clsx from 'clsx';

/* ── Rounded map ── */
const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  full: 'rounded-full',
} as const;

/* ── Base Skeleton ── */
export interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'full';
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, width, height, rounded = 'md' }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'animate-pulse bg-neutral-200 dark:bg-neutral-700',
        roundedMap[rounded],
        className,
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  ),
);

Skeleton.displayName = 'Skeleton';

/* ── SkeletonText: multiple lines ── */
export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

const SkeletonText = forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ lines = 3, className }, ref) => (
    <div ref={ref} className={clsx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'h-3 animate-pulse rounded-sm bg-neutral-200 dark:bg-neutral-700',
            i === lines - 1 && 'w-3/4',
          )}
        />
      ))}
    </div>
  ),
);

SkeletonText.displayName = 'SkeletonText';

/* ── SkeletonCircle ── */
export interface SkeletonCircleProps {
  size?: string;
  className?: string;
}

const SkeletonCircle = forwardRef<HTMLDivElement, SkeletonCircleProps>(
  ({ size = '40px', className }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  ),
);

SkeletonCircle.displayName = 'SkeletonCircle';

/* ── SkeletonCard ── */
export interface SkeletonCardProps {
  className?: string;
}

const SkeletonCard = forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ className }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'border border-border rounded-md bg-surface p-6 space-y-4',
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton height="16px" width="40%" rounded="sm" />
      <SkeletonText lines={3} />
      <Skeleton height="32px" width="30%" rounded="md" />
    </div>
  ),
);

SkeletonCard.displayName = 'SkeletonCard';

export { Skeleton, SkeletonText, SkeletonCircle, SkeletonCard };
