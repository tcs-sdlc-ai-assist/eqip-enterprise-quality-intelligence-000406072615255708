import clsx from 'clsx';

export interface AvatarProps {
  /** Full name — used for alt text and initials fallback */
  name: string;
  /** Image source URL */
  src?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

function Avatar({ name, src, size = 'md' }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx(
          'inline-block rounded-full object-cover',
          sizeMap[size],
        )}
      />
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-medium',
        'dark:bg-primary-900 dark:text-primary-300',
        sizeMap[size],
      )}
      aria-label={name}
    >
      {getInitials(name)}
    </span>
  );
}

export { Avatar };
