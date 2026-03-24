import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  MenuItem,
  TextField,
  Button,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Notifications as AlertIcon,
  CheckCircle as ClosedIcon,
  ErrorOutline as OpenIcon,
  QrCode as GtinIcon,
  FileDownload as ExportIcon,
  Share as ShareIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { ALERT_STATUSES } from '../config/constants';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';

interface DashboardMetrics {
  totalAlerts: number;
  openAlerts: number;
  closedAlerts: number;
  uniqueGTINs: number;
}

interface DashboardFilters {
  status: string;
  market: string;
  dateFrom: string;
  dateTo: string;
  month: string;
  year: string;
  batch: string;
}

const currentYear = dayjs().year();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => i + 1);

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation('common');
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalAlerts: 0,
    openAlerts: 0,
    closedAlerts: 0,
    uniqueGTINs: 0,
  });
  const [filters, setFilters] = useState<DashboardFilters>({
    status: '',
    market: '',
    dateFrom: '',
    dateTo: '',
    month: '',
    year: '',
    batch: '',
  });
  const [markets, setMarkets] = useState<{ market_code: string; market_name: string }[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [_isLoading, setIsLoading] = useState(true);

  const isAlertHandler = user?.role === 'AlertHandler';

  useEffect(() => {
    const fetchMarkets = async () => {
      if (isAlertHandler) {
        const { data } = await supabase
          .from('user_markets')
          .select('market_id, markets(market_code, market_name)')
          .eq('user_id', user?.id);
        if (data) {
          const mkts = data
            .map((d: Record<string, unknown>) => d.markets as { market_code: string; market_name: string } | null)
            .filter((m): m is { market_code: string; market_name: string } => m !== null);
          setMarkets(mkts);
        }
      } else {
        const { data } = await supabase.from('markets').select('market_code, market_name');
        if (data) setMarkets(data);
      }
    };

    const fetchBatches = async () => {
      const { data } = await supabase.from('alerts').select('batch_name').not('batch_name', 'is', null);
      if (data) {
        const unique = [...new Set(data.map((d) => d.batch_name).filter(Boolean))] as string[];
        setBatches(unique);
      }
    };

    fetchMarkets();
    fetchBatches();
  }, [user, isAlertHandler]);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('alerts').select('id, status, gtin', { count: 'exact' });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.market) query = query.eq('target_market', filters.market);
      if (filters.dateFrom) query = query.gte('created_on', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_on', filters.dateTo + 'T23:59:59');
      if (filters.batch) query = query.eq('batch_name', filters.batch);
      if (filters.year) {
        const yearStart = `${filters.year}-01-01`;
        const yearEnd = `${filters.year}-12-31T23:59:59`;
        query = query.gte('created_on', yearStart).lte('created_on', yearEnd);
      }
      if (filters.month && filters.year) {
        const monthStart = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
        const monthEnd = dayjs(monthStart).endOf('month').format('YYYY-MM-DDTHH:mm:ss');
        query = query.gte('created_on', monthStart).lte('created_on', monthEnd);
      }

      const { data, count } = await query;

      if (data) {
        const total = count || data.length;
        const open = data.filter((a) => a.status === 'Open' || a.status === 'InProgress').length;
        const closed = data.filter((a) => a.status === 'Closed').length;
        const uniqueGtins = new Set(data.map((a) => a.gtin).filter(Boolean)).size;

        setMetrics({ totalAlerts: total, openAlerts: open, closedAlerts: closed, uniqueGTINs: uniqueGtins });
      }
    } catch {
      enqueueSnackbar(tc('error'), { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [filters, enqueueSnackbar, tc]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleFilterChange = (field: keyof DashboardFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleExportCSV = async () => {
    setExportAnchor(null);
    try {
      const { default: Papa } = await import('papaparse');
      let query = supabase.from('alerts').select('*');
      if (filters.market) query = query.eq('target_market', filters.market);
      if (filters.status) query = query.eq('status', filters.status);
      const { data } = await query;
      if (data) {
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alerts_report_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        enqueueSnackbar(tc('success'), { variant: 'success' });
      }
    } catch {
      enqueueSnackbar(tc('error'), { variant: 'error' });
    }
  };

  const handleExportPDF = async () => {
    setExportAnchor(null);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.text('Novatio EU FMD Alert Manager - Dashboard Report', 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm')}`, 14, 22);

      autoTable(doc, {
        startY: 30,
        head: [['Metric', 'Value']],
        body: [
          [t('totalAlerts'), String(metrics.totalAlerts)],
          [t('openAlerts'), String(metrics.openAlerts)],
          [t('closedAlerts'), String(metrics.closedAlerts)],
          [t('uniqueGTINs'), String(metrics.uniqueGTINs)],
        ],
      });

      doc.save(`dashboard_report_${dayjs().format('YYYY-MM-DD')}.pdf`);
      enqueueSnackbar(tc('success'), { variant: 'success' });
    } catch {
      enqueueSnackbar(tc('error'), { variant: 'error' });
    }
  };

  const handleShare = async () => {
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: shareEmail,
          subject: 'Novatio EU FMD Alert Manager - Dashboard Report',
          html: `<h2>Dashboard Summary</h2>
            <p>Total Alerts: ${metrics.totalAlerts}</p>
            <p>Open Alerts: ${metrics.openAlerts}</p>
            <p>Closed Alerts: ${metrics.closedAlerts}</p>
            <p>Unique GTINs: ${metrics.uniqueGTINs}</p>
            <p>Report generated on ${dayjs().format('YYYY-MM-DD HH:mm')}</p>`,
        },
      });
      enqueueSnackbar(t('shareDialog.success'), { variant: 'success' });
      setShareOpen(false);
      setShareEmail('');
    } catch {
      enqueueSnackbar(t('shareDialog.error'), { variant: 'error' });
    }
  };

  const metricCards = [
    { label: t('totalAlerts'), value: metrics.totalAlerts, icon: <AlertIcon />, color: '#2196F3' },
    { label: t('openAlerts'), value: metrics.openAlerts, icon: <OpenIcon />, color: '#FF9800' },
    { label: t('closedAlerts'), value: metrics.closedAlerts, icon: <ClosedIcon />, color: '#4CAF50' },
    { label: t('uniqueGTINs'), value: metrics.uniqueGTINs, icon: <GtinIcon />, color: '#9C27B0' },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{t('title')}</Typography>
        <Box display="flex" gap={1}>
          <Button
            startIcon={<ExportIcon />}
            variant="outlined"
            onClick={(e) => setExportAnchor(e.currentTarget)}
          >
            {tc('export')}
          </Button>
          <Menu
            anchorEl={exportAnchor}
            open={Boolean(exportAnchor)}
            onClose={() => setExportAnchor(null)}
          >
            <MenuItem onClick={handleExportCSV}>{t('export.csv')}</MenuItem>
            <MenuItem onClick={handleExportPDF}>{t('export.pdf')}</MenuItem>
          </Menu>
          <IconButton color="primary" onClick={() => setShareOpen(true)}>
            <ShareIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {!isAlertHandler && (
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t('filters.market')}
                  value={filters.market}
                  onChange={(e) => handleFilterChange('market', e.target.value)}
                >
                  <MenuItem value="">{t('filters.allMarkets')}</MenuItem>
                  {markets.map((m) => (
                    <MenuItem key={m.market_code} value={m.market_code}>
                      {m.market_name} ({m.market_code})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t('filters.status')}
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="">{t('filters.allStatuses')}</MenuItem>
                {ALERT_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {tc(`statuses.${s}`)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t('filters.year')}
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {years.map((y) => (
                  <MenuItem key={y} value={String(y)}>
                    {y}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t('filters.month')}
                value={filters.month}
                onChange={(e) => handleFilterChange('month', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {months.map((m) => (
                  <MenuItem key={m} value={String(m)}>
                    {dayjs().month(m - 1).format('MMMM')}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t('filters.batch')}
                value={filters.batch}
                onChange={(e) => handleFilterChange('batch', e.target.value)}
              >
                <MenuItem value="">{t('filters.allBatches')}</MenuItem>
                {batches.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                type="date"
                fullWidth
                size="small"
                label={t('filters.from')}
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                type="date"
                fullWidth
                size="small"
                label={t('filters.to')}
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
          </Grid>
          {Object.values(filters).some(Boolean) && (
            <Box mt={1}>
              {Object.entries(filters)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <Chip
                    key={k}
                    label={`${k}: ${v}`}
                    size="small"
                    onDelete={() => handleFilterChange(k as keyof DashboardFilters, '')}
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <Grid container spacing={3} mb={3}>
        {metricCards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
            <Card
              sx={{
                borderLeft: `4px solid ${card.color}`,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-2px)' },
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {card.label}
                    </Typography>
                    <Typography variant="h3" fontWeight={700} sx={{ color: card.color }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: card.color, opacity: 0.3, fontSize: 48 }}>{card.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Share Dialog */}
      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('shareDialog.title')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={t('shareDialog.emailLabel')}
            placeholder={t('shareDialog.emailPlaceholder')}
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareOpen(false)}>{tc('cancel')}</Button>
          <Button variant="contained" onClick={handleShare} disabled={!shareEmail} startIcon={<PdfIcon />}>
            {t('shareDialog.send')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
