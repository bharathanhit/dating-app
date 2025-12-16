import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';

export const ProtectedOnboardingRoute = ({ children }) => {
  const { isAuthenticated, isProfileComplete, loading } = useAuth();
  const location = useLocation();

  console.log('ProtectedOnboardingRoute: Authenticated:', isAuthenticated, 'Profile Complete:', isProfileComplete, 'Loading:', loading); // Debugging log

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Special case: Allow access to /onboarding even without complete profile
  // This prevents circular redirects when users are trying to complete their profile
  if (location.pathname === '/onboarding') {
    return children;
  }

  if (!isProfileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  console.log('ProtectedOnboardingRoute: Rendering children. Authenticated:', isAuthenticated, 'Profile Complete:', isProfileComplete, 'Loading:', loading);

  return children;
};
