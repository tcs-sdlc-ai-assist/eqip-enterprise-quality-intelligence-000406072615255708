import { useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Play,
  Paperclip,
  Rocket,
  Shield,
  Scale,
  Plug,
  BarChart3,
  Brain,
  FileBarChart,
  TrendingUp,
  Users,
  UserCog,
  ScrollText,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from '@/components/ui/Tooltip';

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Quality Management',
    items: [
      { label: 'Test Cases', path: '/test-cases', icon: FileText },
      { label: 'Test Suites', path: '/test-suites', icon: FolderOpen },
      { label: 'Test Executions', path: '/test-executions', icon: Play },
      { label: 'Evidence', path: '/evidence', icon: Paperclip },
    ],
  },
  {
    title: 'Release & Governance',
    items: [
      { label: 'Releases', path: '/releases', icon: Rocket },
      { label: 'Quality Gates', path: '/quality-gates', icon: Shield },
      { label: 'Governance', path: '/governance', icon: Scale },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Integrations', path: '/integrations', icon: Plug },
      { label: 'Metrics', path: '/metrics', icon: BarChart3 },
      { label: 'AI Insights', path: '/ai-insights', icon: Brain },
      { label: 'Reports', path: '/reports', icon: FileBarChart },
      { label: 'Adoption', path: '/adoption', icon: TrendingUp },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', path: '/users', icon: Users },
      { label: 'Roles', path: '/roles', icon: UserCog },
      { label: 'Audit Logs', path: '/audit-logs', icon: ScrollText },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isMobile: boolean;
}

function Sidebar({ isOpen, onToggle, isMobile }: SidebarProps) {
  const collapsed = !isMobile && !isOpen;

  const handleOverlayClick = useCallback(() => {
    if (isMobile) {
      onToggle();
    }
  }, [isMobile, onToggle]);

  const handleLinkClick = useCallback(() => {
    if (isMobile) {
      onToggle();
    }
  }, [isMobile, onToggle]);

  // ── Sidebar content ──
  const sidebarContent = (
    <nav
      className="flex h-full flex-col overflow-y-auto py-4"
      aria-label="Main navigation"
    >
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="mb-4">
          {/* Section header — hidden when collapsed */}
          {!collapsed && (
            <h3 className="mb-1 px-4 text-xs font-medium uppercase tracking-wider text-foreground-muted">
              {section.title}
            </h3>
          )}

          <ul className="space-y-0.5 px-2">
            {section.items.map((item) => {
              const Icon = item.icon;

              const link = (
                <NavLink
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors duration-fast',
                      isActive
                        ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                        : 'text-foreground-muted hover:bg-surface-raised hover:text-foreground',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <Icon
                    size={20}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );

              return (
                <li key={item.path}>
                  {collapsed ? (
                    <Tooltip content={item.label} position="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  // ── Mobile: off-canvas drawer with overlay ──
  if (isMobile) {
    return (
      <>
        {/* Overlay backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-30 bg-neutral-900/50 transition-opacity duration-150"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
        )}

        {/* Drawer */}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-surface pt-16 transition-transform duration-150',
            isOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Sidebar navigation"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-[1.125rem] rounded p-1 text-foreground-muted hover:bg-surface-raised hover:text-foreground transition-colors duration-fast"
            aria-label="Close sidebar"
          >
            <X size={20} aria-hidden="true" />
          </button>

          {sidebarContent}
        </aside>
      </>
    );
  }

  // ── Desktop: fixed sidebar ──
  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-20 border-r border-border bg-surface pt-16 transition-[width] duration-150',
        isOpen ? 'w-64' : 'w-16',
      )}
      aria-label="Sidebar navigation"
    >
      {sidebarContent}
    </aside>
  );
}

export { Sidebar };
