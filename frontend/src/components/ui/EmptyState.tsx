import type { LucideIcon } from 'lucide-react';
import type React from 'react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <Icon
          className="h-12 w-12 text-foreground-muted mb-4"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      )}
      <h3 className="text-base font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-foreground-muted max-w-sm mb-6">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

export { EmptyState };
export type { EmptyStateProps };
