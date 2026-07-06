import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// ---------------------------------------------------------------------------
// ProtectedRoute — guards child routes behind authentication.
//
// While the auth state is bootstrapping (isLoading) a centered spinner is
// shown. Once resolved, unauthenticated users are redirected to /login;
// authenticated users see the children (or <Outlet /> when used as a layout
// route).
// ---------------------------------------------------------------------------

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export { ProtectedRoute };
