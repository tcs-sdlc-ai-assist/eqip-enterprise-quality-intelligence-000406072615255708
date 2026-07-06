import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// ---------------------------------------------------------------------------
// LandingPage — entry redirect.
//
// Authenticated users are sent to /dashboard; everyone else to /login.
// While the auth state is bootstrapping a centered spinner is shown.
// ---------------------------------------------------------------------------

function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default LandingPage;
