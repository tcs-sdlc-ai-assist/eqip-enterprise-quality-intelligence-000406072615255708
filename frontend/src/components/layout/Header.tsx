import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  User as UserIcon,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/ui/Avatar';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu';

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export interface HeaderProps {
  isMobile: boolean;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
}

function Header({ isMobile, sidebarOpen, onSidebarToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      // Logout clears local state regardless — navigate anyway
      navigate('/login');
    }
  }, [logout, navigate]);

  const userMenuItems: DropdownMenuItem[] = [
    {
      label: 'Profile',
      icon: UserIcon,
      onClick: () => navigate('/profile'),
    },
    {
      label: 'Settings',
      icon: Settings,
      onClick: () => navigate('/settings'),
    },
    {
      label: 'Logout',
      icon: LogOut,
      onClick: handleLogout,
      danger: true,
    },
  ];

  // Sidebar toggle icon — mobile gets a hamburger, desktop gets a panel toggle
  const ToggleIcon = isMobile
    ? Menu
    : sidebarOpen
      ? PanelLeftClose
      : PanelLeftOpen;

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-4">
      {/* ── Left: toggle + logo ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSidebarToggle}
          className="rounded p-1.5 text-foreground-muted hover:bg-surface-raised hover:text-foreground transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <ToggleIcon size={20} aria-hidden="true" />
        </button>

        <span className="text-lg font-bold text-primary-600 select-none">
          EQIP
        </span>
      </div>

      {/* ── Right: theme toggle + user menu ── */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded p-1.5 text-foreground-muted hover:bg-surface-raised hover:text-foreground transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <Moon size={20} aria-hidden="true" />
          ) : (
            <Sun size={20} aria-hidden="true" />
          )}
        </button>

        {/* User avatar + dropdown */}
        {user && (
          <DropdownMenu
            trigger={
              <button
                type="button"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Avatar
                  name={`${user.first_name} ${user.last_name}`}
                  size="sm"
                />
              </button>
            }
            items={userMenuItems}
            align="right"
          />
        )}
      </div>
    </header>
  );
}

export { Header };
