import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from_email: string;
}

interface UiPathConfig {
  endpoint: string;
  api_key: string;
  enabled: boolean;
}

interface DbConfig {
  supabase_url: string;
  supabase_anon_key: string;
}

export default function AdminPage() {
  const { t } = useTranslation('admin');
  const { t: _tc } = useTranslation('common');
  const { enqueueSnackbar } = useSnackbar();

  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    host: '',
    port: 587,
    user: '',
    password: '',
    from_email: '',
  });

  const [uipathFetch, setUipathFetch] = useState<UiPathConfig>({
    endpoint: '',
    api_key: '',
    enabled: false,
  });

  const [uipathRootCause, setUipathRootCause] = useState<UiPathConfig>({
    endpoint: '',
    api_key: '',
    enabled: false,
  });

  const [dbConfig, setDbConfig] = useState<DbConfig>({
    supabase_url: '',
    supabase_anon_key: '',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      if (data) {
        for (const row of data) {
          switch (row.key) {
            case 'smtp_config':
              setSmtpConfig(row.value as SmtpConfig);
              break;
            case 'uipath_fetch_alerts':
              setUipathFetch(row.value as UiPathConfig);
              break;
            case 'uipath_root_cause':
              setUipathRootCause(row.value as UiPathConfig);
              break;
            case 'db_config':
              setDbConfig(row.value as DbConfig);
              break;
          }
        }
      }
    };
    fetchSettings();
  }, []);

  const saveSetting = async (key: string, value: unknown, successMsg: string, errorMsg: string) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
      enqueueSnackbar(successMsg, { variant: 'success' });
    } catch {
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        {t('title')}
      </Typography>

      <Grid container spacing={3}>
        {/* SMTP Configuration */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title={t('smtpConfig.title')} />
            <Divider />
            <CardContent>
              <TextField
                fullWidth
                size="small"
                label={t('smtpConfig.host')}
                value={smtpConfig.host}
                onChange={(e) => setSmtpConfig((p) => ({ ...p, host: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('smtpConfig.port')}
                type="number"
                value={smtpConfig.port}
                onChange={(e) => setSmtpConfig((p) => ({ ...p, port: parseInt(e.target.value) || 587 }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('smtpConfig.user')}
                value={smtpConfig.user}
                onChange={(e) => setSmtpConfig((p) => ({ ...p, user: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('smtpConfig.password')}
                type="password"
                value={smtpConfig.password}
                onChange={(e) => setSmtpConfig((p) => ({ ...p, password: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('smtpConfig.fromEmail')}
                type="email"
                value={smtpConfig.from_email}
                onChange={(e) => setSmtpConfig((p) => ({ ...p, from_email: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() =>
                  saveSetting('smtp_config', smtpConfig, t('smtpConfig.success'), t('smtpConfig.error'))
                }
              >
                {t('smtpConfig.save')}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Database Configuration */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title={t('dbConfig.title')} />
            <Divider />
            <CardContent>
              <TextField
                fullWidth
                size="small"
                label={t('dbConfig.supabaseUrl')}
                value={dbConfig.supabase_url}
                onChange={(e) => setDbConfig((p) => ({ ...p, supabase_url: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('dbConfig.supabaseKey')}
                type="password"
                value={dbConfig.supabase_anon_key}
                onChange={(e) => setDbConfig((p) => ({ ...p, supabase_anon_key: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() =>
                  saveSetting('db_config', dbConfig, t('dbConfig.success'), t('dbConfig.error'))
                }
              >
                {t('dbConfig.save')}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* UiPath Fetch Alerts */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title={`${t('uipathConfig.title')} - Fetch Alerts`} />
            <Divider />
            <CardContent>
              <TextField
                fullWidth
                size="small"
                label={t('uipathConfig.fetchEndpoint')}
                value={uipathFetch.endpoint}
                onChange={(e) => setUipathFetch((p) => ({ ...p, endpoint: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('uipathConfig.apiKey')}
                type="password"
                value={uipathFetch.api_key}
                onChange={(e) => setUipathFetch((p) => ({ ...p, api_key: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={uipathFetch.enabled}
                    onChange={(e) => setUipathFetch((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                }
                label={t('uipathConfig.enabled')}
                sx={{ mb: 2 }}
              />
              <Box>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() =>
                    saveSetting(
                      'uipath_fetch_alerts',
                      uipathFetch,
                      t('uipathConfig.success'),
                      t('uipathConfig.error')
                    )
                  }
                >
                  {t('uipathConfig.save')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* UiPath Root Cause */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title={`${t('uipathConfig.title')} - Root Cause Analysis`} />
            <Divider />
            <CardContent>
              <TextField
                fullWidth
                size="small"
                label={t('uipathConfig.rootCauseEndpoint')}
                value={uipathRootCause.endpoint}
                onChange={(e) => setUipathRootCause((p) => ({ ...p, endpoint: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('uipathConfig.apiKey')}
                type="password"
                value={uipathRootCause.api_key}
                onChange={(e) => setUipathRootCause((p) => ({ ...p, api_key: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={uipathRootCause.enabled}
                    onChange={(e) =>
                      setUipathRootCause((p) => ({ ...p, enabled: e.target.checked }))
                    }
                  />
                }
                label={t('uipathConfig.enabled')}
                sx={{ mb: 2 }}
              />
              <Box>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() =>
                    saveSetting(
                      'uipath_root_cause',
                      uipathRootCause,
                      t('uipathConfig.success'),
                      t('uipathConfig.error')
                    )
                  }
                >
                  {t('uipathConfig.save')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
