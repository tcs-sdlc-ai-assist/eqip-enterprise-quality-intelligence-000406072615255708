import clsx from 'clsx';
import type React from 'react';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div
      role="tablist"
      className="flex border-b border-border gap-0"
      aria-label="Tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'px-4 py-2.5 text-sm transition-colors duration-fast -mb-px whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t',
              isActive
                ? 'border-b-2 border-primary-600 text-foreground font-medium'
                : 'text-foreground-muted hover:text-foreground border-b-2 border-transparent',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export { Tabs };
export type { TabsProps, Tab };
