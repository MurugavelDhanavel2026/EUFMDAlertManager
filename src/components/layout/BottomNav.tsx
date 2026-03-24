import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Notifications as NotificationsIcon,
  Public as PublicIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { routeConfig } from '../../router/routeConfig';

const iconMap: Record<string, React.ReactNode> = {
  Dashboard: <DashboardIcon />,
  Notifications: <NotificationsIcon />,
  Public: <PublicIcon />,
  People: <PeopleIcon />,
  Settings: <SettingsIcon />,
};

export default function BottomNav() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleRoutes = routeConfig.filter(
    (route) => route.showInNav && user && route.roles.includes(user.role)
  );

  return (
    <Paper
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }}
      elevation={3}
    >
      <BottomNavigation
        value={location.pathname}
        onChange={(_, newValue) => navigate(newValue)}
        showLabels
      >
        {visibleRoutes.map((route) => (
          <BottomNavigationAction
            key={route.path}
            label={t(route.label)}
            value={route.path}
            icon={iconMap[route.icon]}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
