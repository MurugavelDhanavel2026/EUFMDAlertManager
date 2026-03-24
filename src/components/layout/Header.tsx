import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Chip,
  Button,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { APP_NAME } from '../../config/constants';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [langAnchor, setLangAnchor] = useState<null | HTMLElement>(null);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    setLangAnchor(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: '#fff',
        color: 'text.primary',
      }}
    >
      <Toolbar>
        {isMobile && (
          <IconButton edge="start" onClick={onMenuToggle} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
        )}

        <Box
          component="img"
          src="/novatio-logo.jpg"
          alt="Novatio"
          sx={{ height: 36, mr: 1.5 }}
        />

        <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>
          {isMobile ? 'AlertManager' : APP_NAME}
        </Typography>

        {user && (
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {user.display_name || user.username}
              </Typography>
              <Chip
                label={t(`roles.${user.role}`)}
                size="small"
                color={
                  user.role === 'admin'
                    ? 'error'
                    : user.role === 'AlertHandler_supervisor'
                    ? 'warning'
                    : 'primary'
                }
                variant="outlined"
              />
            </Box>

            <IconButton onClick={(e) => setLangAnchor(e.currentTarget)} size="small">
              <LanguageIcon />
            </IconButton>
            <Menu
              anchorEl={langAnchor}
              open={Boolean(langAnchor)}
              onClose={() => setLangAnchor(null)}
            >
              <MenuItem
                onClick={() => handleLanguageChange('en')}
                selected={i18n.language === 'en'}
              >
                English
              </MenuItem>
              <MenuItem
                onClick={() => handleLanguageChange('de')}
                selected={i18n.language === 'de'}
              >
                Deutsch
              </MenuItem>
            </Menu>

            <Button
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              size="small"
              color="inherit"
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              {t('logout')}
            </Button>
            <IconButton
              onClick={handleLogout}
              size="small"
              color="inherit"
              sx={{ display: { xs: 'flex', sm: 'none' } }}
            >
              <LogoutIcon />
            </IconButton>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
