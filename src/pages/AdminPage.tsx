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
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Info as InfoIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';

interface GraphApiConfig {
  tenant_id: string;
  app_id: string;
  client_secret: string;
  sender_email: string;
}

interface EmailTemplate {
  subject: string;
  body: string;
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

// Available placeholders from the alerts table
const ALERT_PLACEHOLDERS = [
  { key: '{{alert_id}}', label: 'Alert ID' },
  { key: '{{alert_timestamp}}', label: 'Timestamp' },
  { key: '{{status}}', label: 'Status' },
  { key: '{{error_code}}', label: 'Error Code' },
  { key: '{{target_market}}', label: 'Target Market' },
  { key: '{{alert_message}}', label: 'Alert Message' },
  { key: '{{gtin}}', label: 'GTIN' },
  { key: '{{expiry_date}}', label: 'Expiry Date' },
  { key: '{{serial_number}}', label: 'Serial Number' },
  { key: '{{batch_name}}', label: 'Batch Name' },
  { key: '{{message_guid}}', label: 'Message GUID' },
  { key: '{{root_cause}}', label: 'Root Cause' },
  { key: '{{created_on}}', label: 'Created On' },
  { key: '{{changed_on}}', label: 'Changed On' },
];

// Sample alert data for preview
const SAMPLE_ALERT = {
  alert_id: 'ALT-2026-00001',
  alert_timestamp: '2026-03-26 10:30',
  status: 'Open',
  error_code: 'A001',
  target_market: 'EU',
  alert_message: 'Product not found in national system',
  gtin: '04012345678901',
  expiry_date: '2027-06-01',
  serial_number: 'SN1A2B3C4D',
  batch_name: 'BATCH-2026-001',
  message_guid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  root_cause: 'Delayed reporting from distributor',
  created_on: '2026-03-25 08:00',
  changed_on: '2026-03-26 10:30',
};

function replacePlaceholders(template: string, alert: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(alert)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || 'N/A');
  }
  return result;
}

export default function AdminPage() {
  const { t } = useTranslation('admin');
  const { enqueueSnackbar } = useSnackbar();

  const [graphConfig, setGraphConfig] = useState<GraphApiConfig>({
    tenant_id: '',
    app_id: '',
    client_secret: '',
    sender_email: '',
  });

  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>({
    subject: '',
    body: '',
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

  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      if (data) {
        for (const row of data) {
          switch (row.key) {
            case 'graph_api_config':
              setGraphConfig(row.value as GraphApiConfig);
              break;
            case 'email_template':
              setEmailTemplate(row.value as EmailTemplate);
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

  const insertPlaceholder = (field: 'subject' | 'body', placeholder: string) => {
    setEmailTemplate((prev) => ({
      ...prev,
      [field]: prev[field] + placeholder,
    }));
  };

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        {t('title')}
      </Typography>

      <Grid container spacing={3}>

        {/* Microsoft Graph API Configuration */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="Microsoft Graph API (Email)"
              subheader="Configure Azure AD app for sending emails via Graph API"
            />
            <Divider />
            <CardContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                Register an app in Azure AD with <strong>Mail.Send</strong> application permission.
              </Alert>
              <TextField
                fullWidth
                size="small"
                label="Tenant ID"
                value={graphConfig.tenant_id}
                onChange={(e) => setGraphConfig((p) => ({ ...p, tenant_id: e.target.value }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label="Application (Client) ID"
                value={graphConfig.app_id}
                onChange={(e) => setGraphConfig((p) => ({ ...p, app_id: e.target.value }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label="Client Secret"
                type="password"
                value={graphConfig.client_secret}
                onChange={(e) => setGraphConfig((p) => ({ ...p, client_secret: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label="Sender Email Address"
                type="email"
                value={graphConfig.sender_email}
                onChange={(e) => setGraphConfig((p) => ({ ...p, sender_email: e.target.value }))}
                placeholder="noreply@yourdomain.com"
                helperText="Must be a valid mailbox in your Azure tenant"
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() =>
                  saveSetting('graph_api_config', graphConfig, 'Graph API configuration saved', 'Failed to save Graph API configuration')
                }
              >
                Save Graph API Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Email Template Configuration */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="NMVS Email Template"
              subheader="Configure the email template for NMVS responses"
              action={
                <Tooltip title="Preview with sample data">
                  <Button
                    size="small"
                    startIcon={<PreviewIcon />}
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? 'Edit' : 'Preview'}
                  </Button>
                </Tooltip>
              }
            />
            <Divider />
            <CardContent>
              {!showPreview ? (
                <>
                  <Box mb={2}>
                    <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5} mb={1}>
                      <InfoIcon fontSize="small" />
                      Click placeholders to insert into Subject or Body. Use HTML in Body.
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {ALERT_PLACEHOLDERS.map((p) => (
                        <Tooltip key={p.key} title={`Insert ${p.label}`}>
                          <Chip
                            label={p.key}
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={() => insertPlaceholder('body', p.key)}
                            sx={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.75rem' }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Email Subject Template"
                    value={emailTemplate.subject}
                    onChange={(e) => setEmailTemplate((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="NMVS Response - Alert {{alert_id}} - {{target_market}}"
                    helperText="Use {{placeholder}} syntax to insert alert values"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Email Body Template (HTML)"
                    value={emailTemplate.body}
                    onChange={(e) => setEmailTemplate((p) => ({ ...p, body: e.target.value }))}
                    multiline
                    rows={12}
                    placeholder="<h2>NMVS Response</h2><p>Alert ID: {{alert_id}}</p>..."
                    helperText="Use HTML formatting. Placeholders will be replaced with actual alert values."
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() =>
                      saveSetting('email_template', emailTemplate, 'Email template saved', 'Failed to save email template')
                    }
                  >
                    Save Email Template
                  </Button>
                </>
              ) : (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" mb={1}>
                    Subject Preview:
                  </Typography>
                  <Typography variant="body1" fontWeight={600} mb={2} sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                    {replacePlaceholders(emailTemplate.subject, SAMPLE_ALERT)}
                  </Typography>
                  <Typography variant="subtitle2" color="text.secondary" mb={1}>
                    Body Preview:
                  </Typography>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                      maxHeight: 350,
                      overflow: 'auto',
                      bgcolor: 'white',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: replacePlaceholders(emailTemplate.body, SAMPLE_ALERT),
                    }}
                  />
                </Box>
              )}
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
