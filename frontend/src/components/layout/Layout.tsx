import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';

// ---------------------------------------------------------------------------
// Layout — app shell wrapping Header + Sidebar + content + Footer.
//
// Desktop (≥1024px): sidebar fixed left, 256px expanded / 64px collapsed.
// Mobile (<1024px): sidebar is an off-canvas drawer, content is full-width.
// ---------------------------------------------------------------------------

function Layout() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobile = !isDesktop;

  // Desktop: sidebar starts expanded. Mobile: starts closed.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed header */}
      <Header
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={handleSidebarToggle}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        isMobile={isMobile}
      />

      {/* Main content area */}
      <main
        className={clsx(
          'pt-16 transition-[margin-left] duration-150',
          isMobile
            ? 'ml-0'
            : sidebarOpen
              ? 'ml-64'
              : 'ml-16',
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>

        <Footer />
      </main>
    </div>
  );
}

export { Layout };
