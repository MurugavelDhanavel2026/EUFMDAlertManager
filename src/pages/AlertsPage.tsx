import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Send as SendIcon,
  CloudDownload as FetchIcon,
  Psychology as RootCauseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { ALERT_STATUSES, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '../config/constants';
import type { Alert } from '../types/alert';
import type { User } from '../types/user';
import dayjs from 'dayjs';

export default function AlertsPage() {
  const { t } = useTranslation('alerts');
  const { t: tc } = useTranslation('common');
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMarket, setFilterMarket] = useState('');
  const [markets, setMarkets] = useState<{ market_code: string; market_name: string }[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Inline editing
  const [editingRootCause, setEditingRootCause] = useState<Record<string, string>>({});

  // NMVS Dialog
  const [nmvsDialog, setNmvsDialog] = useState<{ open: boolean; alert: Alert | null }>({
    open: false,
    alert: null,
  });
  const [nmvsEmail, setNmvsEmail] = useState('');

  const isAlertHandler = user?.role === 'AlertHandler';

  // Fetch markets
  useEffect(() => {
    const load = async () => {
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

      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, role, created_at')
        .in('role', ['AlertHandler', 'AlertHandler_supervisor']);
      if (users) setAvailableUsers(users);
    };
    load();
  }, [user, isAlertHandler]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('alerts')
        .select('*', { count: 'exact' })
        .order('created_on', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filterStatus) query = query.eq('status', filterStatus);
      if (filterMarket) query = query.eq('target_market', filterMarket);

      const { data, count, error } = await query;
      if (error) throw error;

      setAlerts(data || []);
      setTotalCount(count || 0);
    } catch {
      enqueueSnackbar(t('fetchError'), { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, filterStatus, filterMarket, enqueueSnackbar, t]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  // Handlers
  const handleFetchAlerts = async () => {
    setIsFetching(true);
    try {
      await supabase.functions.invoke('trigger-uipath', {
        body: { action: 'fetch_alerts' },
      });
      enqueueSnackbar(t('fetchSuccess'), { variant: 'success' });

      // Trigger root cause analysis
      await supabase.functions.invoke('trigger-uipath', {
        body: { action: 'root_cause_analysis' },
      });
      enqueueSnackbar(t('rootCauseSuccess'), { variant: 'info' });
    } catch {
      enqueueSnackbar(t('fetchError'), { variant: 'error' });
    } finally {
      setIsFetching(false);
      fetchAlerts();
    }
  };

  const handleStatusChange = async (alertId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status: newStatus })
        .eq('id', alertId);
      if (error) throw error;
      enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
      fetchAlerts();
    } catch {
      enqueueSnackbar(t('updateError'), { variant: 'error' });
    }
  };

  const handleRootCauseSave = async (alertId: string) => {
    const value = editingRootCause[alertId];
    if (value === undefined) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .update({ root_cause: value })
        .eq('id', alertId);
      if (error) throw error;
      enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
      setEditingRootCause((prev) => {
        const next = { ...prev };
        delete next[alertId];
        return next;
      });
      fetchAlerts();
    } catch {
      enqueueSnackbar(t('updateError'), { variant: 'error' });
    }
  };

  const handleAssignedUserChange = async (alertId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ assigned_user: userId || null })
        .eq('id', alertId);
      if (error) throw error;
      enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
      fetchAlerts();
    } catch {
      enqueueSnackbar(t('updateError'), { variant: 'error' });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(alerts.map((a) => a.id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const handleBulkClose = async () => {
    try {
      if (isAlertHandler && user?.role === 'AlertHandler') {
        // Create bulk operation for supervisor approval
        const { error } = await supabase.from('bulk_operations').insert({
          requested_by: user.id,
          operation_type: 'close',
          alert_ids: Array.from(selected),
          status: 'PendingApproval',
        });
        if (error) throw error;
        enqueueSnackbar(t('bulk.pendingApproval'), { variant: 'info' });
      } else {
        // Supervisor/admin can close directly
        const { error } = await supabase
          .from('alerts')
          .update({ status: 'Closed' })
          .in('id', Array.from(selected));
        if (error) throw error;
        enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
      }
      setSelected(new Set());
      fetchAlerts();
    } catch {
      enqueueSnackbar(t('updateError'), { variant: 'error' });
    }
  };

  const handleRespondNMVS = async () => {
    if (!nmvsDialog.alert) return;
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: nmvsEmail,
          subject: `Response for Alert ID- ${nmvsDialog.alert.alert_id}`,
          html: `<h3>Alert Response</h3>
            <p><strong>Alert ID:</strong> ${nmvsDialog.alert.alert_id}</p>
            <p><strong>GTIN:</strong> ${nmvsDialog.alert.gtin || 'N/A'}</p>
            <p><strong>Serial Number:</strong> ${nmvsDialog.alert.serial_number || 'N/A'}</p>
            <p><strong>Batch:</strong> ${nmvsDialog.alert.batch_name || 'N/A'}</p>
            <p><strong>Root Cause:</strong> ${nmvsDialog.alert.root_cause || 'N/A'}</p>
            <p><strong>Market:</strong> ${nmvsDialog.alert.target_market}</p>`,
        },
      });
      enqueueSnackbar(t('nmvsDialog.success'), { variant: 'success' });
      setNmvsDialog({ open: false, alert: null });
      setNmvsEmail('');
    } catch {
      enqueueSnackbar(t('nmvsDialog.error'), { variant: 'error' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'warning';
      case 'InProgress': return 'info';
      case 'Closed': return 'success';
      case 'OnHold': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={1}>
        <Typography variant="h4">{t('title')}</Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            startIcon={<FetchIcon />}
            onClick={handleFetchAlerts}
            disabled={isFetching}
          >
            {isFetching ? t('fetchingAlerts') : t('fetchAlerts')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RootCauseIcon />}
            onClick={async () => {
              try {
                await supabase.functions.invoke('trigger-uipath', {
                  body: { action: 'root_cause_analysis' },
                });
                enqueueSnackbar(t('rootCauseSuccess'), { variant: 'info' });
              } catch {
                enqueueSnackbar(t('rootCauseError'), { variant: 'error' });
              }
            }}
          >
            {t('rootCauseAnalysis')}
          </Button>
          <IconButton onClick={fetchAlerts} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Grid container spacing={2} alignItems="center">
            {!isAlertHandler && (
              <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t('columns.targetMarket')}
                  value={filterMarket}
                  onChange={(e) => { setFilterMarket(e.target.value); setPage(0); }}
                >
                  <MenuItem value="">All Markets</MenuItem>
                  {markets.map((m) => (
                    <MenuItem key={m.market_code} value={m.market_code}>
                      {m.market_name} ({m.market_code})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t('columns.status')}
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                {ALERT_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {tc(`statuses.${s}`)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <Paper
          sx={{
            p: 1.5,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            position: 'sticky',
            top: 64,
            zIndex: 10,
            backgroundColor: 'primary.50',
          }}
          elevation={2}
        >
          <Typography variant="body2" fontWeight={600}>
            {t('bulk.selected', { count: selected.size })}
          </Typography>
          <Button size="small" variant="contained" color="error" onClick={handleBulkClose}>
            {t('bulk.closeSelected')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SendIcon />}
            onClick={() => {
              // Bulk NMVS response would be implemented similarly
              enqueueSnackbar('Bulk NMVS response - select individual alerts', { variant: 'info' });
            }}
          >
            {t('bulk.sendResponse')}
          </Button>
        </Paper>
      )}

      {/* Alerts Table */}
      <Card>
        {(isLoading || isFetching) && <LinearProgress />}
        <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.size > 0 && selected.size < alerts.length}
                    checked={alerts.length > 0 && selected.size === alerts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>{t('columns.alertId')}</TableCell>
                <TableCell>{t('columns.alertTimestamp')}</TableCell>
                <TableCell>{t('columns.status')}</TableCell>
                <TableCell>{t('columns.errorCode')}</TableCell>
                <TableCell>{t('columns.targetMarket')}</TableCell>
                <TableCell>{t('columns.gtin')}</TableCell>
                <TableCell>{t('columns.batchName')}</TableCell>
                <TableCell>{t('columns.serialNumber')}</TableCell>
                <TableCell>{t('columns.expiryDate')}</TableCell>
                <TableCell sx={{ minWidth: 250 }}>{t('columns.rootCause')}</TableCell>
                <TableCell>{t('columns.assignedUser')}</TableCell>
                <TableCell>{tc('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">{tc('noData')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alert) => (
                  <TableRow key={alert.id} hover selected={selected.has(alert.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.has(alert.id)}
                        onChange={(e) => handleSelect(alert.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {alert.alert_id}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {alert.alert_timestamp
                        ? dayjs(alert.alert_timestamp).format('YYYY-MM-DD HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={alert.status}
                          onChange={(e) => handleStatusChange(alert.id, e.target.value)}
                          renderValue={(val) => (
                            <Chip
                              label={tc(`statuses.${val}`)}
                              size="small"
                              color={getStatusColor(val as string) as 'warning' | 'info' | 'success' | 'default'}
                            />
                          )}
                        >
                          {ALERT_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>
                              {tc(`statuses.${s}`)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>{alert.error_code || '-'}</TableCell>
                    <TableCell>
                      <Chip label={alert.target_market} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {alert.gtin || '-'}
                    </TableCell>
                    <TableCell>{alert.batch_name || '-'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{alert.serial_number || '-'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      {alert.expiry_date ? dayjs(alert.expiry_date).format('YYYY-MM-DD') : '-'}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <TextField
                          size="small"
                          multiline
                          maxRows={3}
                          value={
                            editingRootCause[alert.id] !== undefined
                              ? editingRootCause[alert.id]
                              : alert.root_cause || ''
                          }
                          onChange={(e) =>
                            setEditingRootCause((prev) => ({
                              ...prev,
                              [alert.id]: e.target.value,
                            }))
                          }
                          placeholder={t('columns.rootCause')}
                          sx={{ minWidth: 200 }}
                        />
                        {editingRootCause[alert.id] !== undefined && (
                          <Tooltip title={tc('save')}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleRootCauseSave(alert.id)}
                            >
                              <SaveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel>{t('columns.assignedUser')}</InputLabel>
                        <Select
                          value={alert.assigned_user || ''}
                          label={t('columns.assignedUser')}
                          onChange={(e) => handleAssignedUserChange(alert.id, e.target.value)}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {availableUsers.map((u) => (
                            <MenuItem key={u.id} value={u.id}>
                              {u.display_name || u.username}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={t('respondNMVS')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() =>
                            setNmvsDialog({ open: true, alert })
                          }
                        >
                          <SendIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            setPageSize(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
          labelRowsPerPage={tc('itemsPerPage')}
        />
      </Card>

      {/* NMVS Response Dialog */}
      <Dialog
        open={nmvsDialog.open}
        onClose={() => setNmvsDialog({ open: false, alert: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('nmvsDialog.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Alert ID: {nmvsDialog.alert?.alert_id}
          </Typography>
          <TextField
            fullWidth
            label={t('nmvsDialog.emailTo')}
            type="email"
            value={nmvsEmail}
            onChange={(e) => setNmvsEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label={t('nmvsDialog.subject')}
            value={`Response for Alert ID- ${nmvsDialog.alert?.alert_id || ''}`}
            slotProps={{ input: { readOnly: true } }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label={t('nmvsDialog.body')}
            multiline
            rows={4}
            value={nmvsDialog.alert?.root_cause || 'No root cause determined yet.'}
            slotProps={{ input: { readOnly: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNmvsDialog({ open: false, alert: null })}>{tc('cancel')}</Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleRespondNMVS}
            disabled={!nmvsEmail}
          >
            {t('nmvsDialog.send')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
