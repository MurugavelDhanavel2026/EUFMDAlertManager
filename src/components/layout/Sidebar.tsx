import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
} from '@mui/material';
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
import { SIDEBAR_WIDTH } from '../../config/constants';

const iconMap: Record<string, React.ReactNode> = {
  Dashboard: <DashboardIcon />,
  Notifications: <NotificationsIcon />,
  Public: <PublicIcon />,
  People: <PeopleIcon />,
  Settings: <SettingsIcon />,
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant: 'permanent' | 'temporary';
}

export default function Sidebar({ open, onClose, variant }: SidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleRoutes = routeConfig.filter(
    (route) => route.showInNav && user && route.roles.includes(user.role)
  );

  const handleNavigate = (path: string) => {
    navigate(path);
    if (variant === 'temporary') onClose();
  };

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto', mt: 1 }}>
        <List>
          {visibleRoutes.map((route) => (
            <ListItemButton
              key={route.path}
              selected={location.pathname === route.path}
              onClick={() => handleNavigate(route.path)}
              sx={{
                mx: 1,
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '& .MuiListItemIcon-root': { color: 'white' },
                  '&:hover': { backgroundColor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {iconMap[route.icon]}
              </ListItemIcon>
              <ListItemText primary={t(route.label)} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}
