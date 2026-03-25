import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { AppRole } from '../config/constants';
import { Box, CircularProgress, Typography } from '@mui/material';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh" gap={2}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
