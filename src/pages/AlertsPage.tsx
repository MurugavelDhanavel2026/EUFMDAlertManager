import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
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
  Paper,
  LinearProgress,
  Divider,
  Menu,
  Popover,
  ListItemText,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Send as SendIcon,
  CloudDownload as FetchIcon,
  Save as SaveIcon,
  Sync as SyncIcon,
  PlayArrow as TriggerIcon,
  History as HistoryIcon,
  AddCircleOutline as CreatedIcon,
  SwapHoriz as StatusChangeIcon,
  EditNote as RootCauseEditIcon,
  PersonAdd as AssignIcon,
  MailOutline as MailSentIcon,
  BoltOutlined as TriggeredIcon,
  ViewColumn as ColumnsIcon,
  FilterList as FilterIcon,
  FilterAlt as FilterActiveIcon,
  InfoOutlined as DetailsIcon,
  Replay as RetriggerIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { ALERT_STATUSES, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '../config/constants';
import type { Alert, AlertHistoryEvent, AlertHistoryEventType } from '../types/alert';
import type { User } from '../types/user';
import type { UserPreferences } from '../types/preferences';
import dayjs from 'dayjs';

// How a column can be filtered. 'none' => no funnel shown for that column.
type ColumnFilterKind = 'text' | 'status' | 'user' | 'date' | 'market' | 'none';

interface AlertColumnDef {
  key: string;
  // Translation namespace for the column label: 'alerts' uses t(), 'common' uses tc().
  ns: 'alerts' | 'common';
  labelKey: string;
  filter: ColumnFilterKind;
  // Supabase column used for server-side filtering (omitted for non-filterable columns).
  dbColumn?: string;
}

// The full, ordered list of configurable Alerts-table columns. The selection
// checkbox (first) and the Actions column (last) are fixed and intentionally
// NOT part of this list.
const ALERT_COLUMNS: AlertColumnDef[] = [
  { key: 'alert_id', ns: 'alerts', labelKey: 'columns.alertId', filter: 'text', dbColumn: 'alert_id' },
  { key: 'alert_timestamp', ns: 'alerts', labelKey: 'columns.alertTimestamp', filter: 'date', dbColumn: 'alert_timestamp' },
  { key: 'status', ns: 'alerts', labelKey: 'columns.status', filter: 'status', dbColumn: 'status' },
  { key: 'error_code', ns: 'alerts', labelKey: 'columns.errorCode', filter: 'text', dbColumn: 'error_code' },
  { key: 'target_market', ns: 'alerts', labelKey: 'columns.targetMarket', filter: 'market', dbColumn: 'target_market' },
  { key: 'alert_message', ns: 'alerts', labelKey: 'columns.alertMessage', filter: 'text', dbColumn: 'alert_message' },
  { key: 'gtin', ns: 'alerts', labelKey: 'columns.gtin', filter: 'text', dbColumn: 'gtin' },
  { key: 'batch_name', ns: 'alerts', labelKey: 'columns.batchName', filter: 'text', dbColumn: 'batch_name' },
  { key: 'serial_number', ns: 'alerts', labelKey: 'columns.serialNumber', filter: 'text', dbColumn: 'serial_number' },
  { key: 'expiry_date', ns: 'alerts', labelKey: 'columns.expiryDate', filter: 'date', dbColumn: 'expiry_date' },
  { key: 'root_cause', ns: 'alerts', labelKey: 'columns.rootCause', filter: 'text', dbColumn: 'root_cause' },
  { key: 'assigned_user', ns: 'alerts', labelKey: 'columns.assignedUser', filter: 'user', dbColumn: 'assigned_user' },
  { key: 'created_on', ns: 'common', labelKey: 'createdOn', filter: 'date', dbColumn: 'created_on' },
  { key: 'changed_on', ns: 'common', labelKey: 'changedOn', filter: 'date', dbColumn: 'changed_on' },
  { key: 'details', ns: 'alerts', labelKey: 'columns.details', filter: 'none' },
];

// By default every column is visible (in canonical order above).
const DEFAULT_VISIBLE_COLUMNS = ALERT_COLUMNS.map((c) => c.key);

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
  const [markets, setMarkets] = useState<{ market_code: string; market_name: string }[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // Per-column server-side filters, keyed by column key.
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Funnel popover state: which column's filter editor is open + its draft value.
  const [filterPopover, setFilterPopover] = useState<{ key: string; anchor: HTMLElement } | null>(null);
  const [filterDraft, setFilterDraft] = useState('');

  // Column visibility (per-user, persisted in the user_preferences table).
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState<HTMLElement | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Inline editing
  const [editingRootCause, setEditingRootCause] = useState<Record<string, string>>({});

  // Action Dialog (validation status + NMVS response)
  const [actionDialog, setActionDialog] = useState<{ open: boolean; alert: Alert | null }>({
    open: false,
    alert: null,
  });
  const [nmvsEmail, setNmvsEmail] = useState('');
  const [emailTemplate, setEmailTemplate] = useState<{ subject: string; body: string }>({ subject: '', body: '' });
  const [graphConfig, setGraphConfig] = useState<{ tenant_id: string; app_id: string; client_secret: string; sender_email: string } | null>(null);
  const [uipathFetchConfig, setUipathFetchConfig] = useState<{ invoke_url: string; personal_access_token: string; enabled: boolean } | null>(null);
  const [uipathMasterDataConfig, setUipathMasterDataConfig] = useState<{ invoke_url: string; personal_access_token: string; enabled: boolean } | null>(null);
  const [uipathMaestroConfig, setUipathMaestroConfig] = useState<{ invoke_url: string; personal_access_token: string; enabled: boolean } | null>(null);
  const [retriggeringValidations, setRetriggeringValidations] = useState<Set<string>>(new Set());
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [triggeredRows, setTriggeredRows] = useState<Set<number>>(new Set());
  const [triggeringRow, setTriggeringRow] = useState<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Details Dialog (all field values + history timeline)
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; alert: Alert | null }>({
    open: false,
    alert: null,
  });
  const [historyEvents, setHistoryEvents] = useState<AlertHistoryEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyUserMap, setHistoryUserMap] = useState<Record<string, string>>({});

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

      // Fetch email settings and UiPath config
      const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['email_template', 'graph_api_config', 'uipath_fetch_alerts', 'uipath_master_data_reporting', 'uipath_maestro_validations']);
      if (settings) {
        for (const row of settings) {
          if (row.key === 'email_template') setEmailTemplate(row.value as { subject: string; body: string });
          if (row.key === 'graph_api_config') setGraphConfig(row.value as { tenant_id: string; app_id: string; client_secret: string; sender_email: string });
          if (row.key === 'uipath_fetch_alerts') setUipathFetchConfig(row.value as { invoke_url: string; personal_access_token: string; enabled: boolean });
          if (row.key === 'uipath_master_data_reporting') setUipathMasterDataConfig(row.value as { invoke_url: string; personal_access_token: string; enabled: boolean });
          if (row.key === 'uipath_maestro_validations') setUipathMaestroConfig(row.value as { invoke_url: string; personal_access_token: string; enabled: boolean });
        }
      }

      // Load this user's saved column visibility preference. Keep only keys
      // that still exist, re-order them canonically (matching ALERT_COLUMNS),
      // and auto-show any column introduced AFTER the user last saved (i.e. not
      // in their "known columns") so new features like the Details column don't
      // stay hidden. Columns they deliberately hid (present in known, absent in
      // visible) remain hidden.
      if (user?.id) {
        const { data: prefRow } = await supabase
          .from('user_preferences')
          .select('preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        const prefs = prefRow?.preferences as UserPreferences | null;
        const saved = prefs?.alertsColumns;
        if (Array.isArray(saved) && saved.length > 0) {
          // Legacy prefs have no alertsKnownColumns — treat the saved visible
          // list as the known set so columns added since then are surfaced.
          const known = new Set(
            Array.isArray(prefs?.alertsKnownColumns) && prefs.alertsKnownColumns.length > 0
              ? prefs.alertsKnownColumns
              : saved
          );
          const visibleSet = new Set(saved);
          const next = ALERT_COLUMNS.filter(
            (c) => visibleSet.has(c.key) || !known.has(c.key)
          ).map((c) => c.key);
          if (next.length > 0) {
            setVisibleColumns(next);
            // Self-heal: if new columns were merged in, persist the reconciled
            // selection (with an up-to-date known set) so it sticks.
            if (next.length !== saved.length) void persistVisibleColumns(next);
          }
        }
      }
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

      // Per-column filters applied server-side so they span all pages.
      for (const col of ALERT_COLUMNS) {
        if (!col.dbColumn) continue;
        const value = (columnFilters[col.key] ?? '').trim();
        if (!value) continue;
        switch (col.filter) {
          case 'text':
            query = query.ilike(col.dbColumn, `%${value}%`);
            break;
          case 'status':
          case 'user':
          case 'market':
            query = query.eq(col.dbColumn, value);
            break;
          case 'date': {
            // Match the whole calendar day, works for both date and timestamptz columns.
            const start = value;
            const end = dayjs(value).add(1, 'day').format('YYYY-MM-DD');
            query = query.gte(col.dbColumn, start).lt(col.dbColumn, end);
            break;
          }
        }
      }

      const { data, count, error } = await query;
      if (error) throw error;

      setAlerts(data || []);
      setTotalCount(count || 0);
    } catch {
      enqueueSnackbar(t('fetchError'), { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, columnFilters, enqueueSnackbar, t]);

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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Handlers
  const handleFetchAlerts = async () => {
    if (!uipathFetchConfig?.enabled || !uipathFetchConfig?.invoke_url) {
      enqueueSnackbar(t('uipathNotConfigured'), { variant: 'warning' });
      return;
    }

    setIsFetching(true);
    enqueueSnackbar(t('jobStarting'), { variant: 'info' });

    try {
      // Step 1: Start the UiPath process via API Trigger
      const startRes = await fetch('/api/uipath-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          invoke_url: uipathFetchConfig.invoke_url,
          personal_access_token: uipathFetchConfig.personal_access_token,
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || 'Failed to start UiPath process');

      // If job completed immediately (synchronous response)
      if (startData.completed) {
        setIsFetching(false);
        enqueueSnackbar(t('fetchSuccess'), { variant: 'success' });
        fetchAlerts();
        return;
      }

      // Step 2: Job is running — poll the status URL until completed
      const pollUrl = startData.pollUrl;
      if (!pollUrl) throw new Error('No poll URL returned from UiPath API Trigger');

      enqueueSnackbar(t('jobStarted'), { variant: 'info' });
      let currentPollUrl = pollUrl;

      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/uipath-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'poll',
              poll_url: currentPollUrl,
              personal_access_token: uipathFetchConfig.personal_access_token,
            }),
          });

          const pollData = await pollRes.json();
          if (!pollRes.ok) throw new Error(pollData.error || 'Failed to check job status');

          if (pollData.completed) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setIsFetching(false);
            enqueueSnackbar(t('fetchSuccess'), { variant: 'success' });
            fetchAlerts();
          } else {
            // Update poll URL if it changed
            if (pollData.pollUrl) currentPollUrl = pollData.pollUrl;
          }
        } catch (pollErr) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsFetching(false);
          const msg = pollErr instanceof Error ? pollErr.message : 'Polling error';
          enqueueSnackbar(msg, { variant: 'error' });
        }
      }, 5000); // Poll every 5 seconds
    } catch (err) {
      setIsFetching(false);
      const message = err instanceof Error ? err.message : t('fetchError');
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleStatusChange = async (alertId: string, newStatus: string) => {
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus as Alert['status'] } : a))
    );
    try {
      const { error, data } = await supabase
        .from('alerts')
        .update({ status: newStatus })
        .eq('id', alertId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        enqueueSnackbar('Update blocked by permissions. Check your role/market assignment.', { variant: 'warning' });
        fetchAlerts();
        return;
      }
      enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
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
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, assigned_user: userId || null } : a))
    );
    try {
      const { error, data } = await supabase
        .from('alerts')
        .update({ assigned_user: userId || null })
        .eq('id', alertId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        enqueueSnackbar('Update blocked by permissions. Check your role/market assignment.', { variant: 'warning' });
        fetchAlerts(); // Revert optimistic update
        return;
      }
      enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
    } catch (err) {
      console.error('Assign user error:', err);
      enqueueSnackbar(t('updateError'), { variant: 'error' });
      fetchAlerts(); // Revert optimistic update
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

  const replacePlaceholders = (template: string, alert: Alert): string => {
    let result = template;
    const fields: Record<string, string> = {
      alert_id: alert.alert_id,
      alert_timestamp: alert.alert_timestamp ? dayjs(alert.alert_timestamp).format('YYYY-MM-DD HH:mm') : 'N/A',
      status: alert.status,
      error_code: alert.error_code || 'N/A',
      target_market: alert.target_market,
      alert_message: alert.alert_message || 'N/A',
      gtin: alert.gtin || 'N/A',
      expiry_date: alert.expiry_date ? dayjs(alert.expiry_date).format('YYYY-MM-DD') : 'N/A',
      serial_number: alert.serial_number || 'N/A',
      batch_name: alert.batch_name || 'N/A',
      message_guid: alert.message_guid || 'N/A',
      root_cause: alert.root_cause || 'N/A',
      created_on: alert.created_on ? dayjs(alert.created_on).format('YYYY-MM-DD HH:mm') : 'N/A',
      changed_on: alert.changed_on ? dayjs(alert.changed_on).format('YYYY-MM-DD HH:mm') : 'N/A',
    };
    for (const [key, value] of Object.entries(fields)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  };

  const getEmailSubject = (alert: Alert): string => {
    if (emailTemplate.subject) return replacePlaceholders(emailTemplate.subject, alert);
    return `NMVS Response - Alert ${alert.alert_id} - ${alert.target_market}`;
  };

  const getEmailBody = (alert: Alert): string => {
    if (emailTemplate.body) return replacePlaceholders(emailTemplate.body, alert);
    return `<h3>Alert Response</h3>
      <p><strong>Alert ID:</strong> ${alert.alert_id}</p>
      <p><strong>GTIN:</strong> ${alert.gtin || 'N/A'}</p>
      <p><strong>Serial Number:</strong> ${alert.serial_number || 'N/A'}</p>
      <p><strong>Batch:</strong> ${alert.batch_name || 'N/A'}</p>
      <p><strong>Root Cause:</strong> ${alert.root_cause || 'N/A'}</p>
      <p><strong>Market:</strong> ${alert.target_market}</p>`;
  };

  const handleRespondNMVS = async () => {
    if (!actionDialog.alert) return;
    setIsSendingEmail(true);
    try {
      const alert = actionDialog.alert;
      const subject = getEmailSubject(alert);
      const body = getEmailBody(alert);

      if (!graphConfig?.tenant_id || !graphConfig?.app_id || !graphConfig?.client_secret || !graphConfig?.sender_email) {
        enqueueSnackbar('Graph API not configured. Please set up in Admin > Microsoft Graph API settings.', { variant: 'warning' });
        setIsSendingEmail(false);
        return;
      }

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: nmvsEmail,
          subject,
          body,
          graphConfig,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send email');

      void logHistoryEvent(alert.id, 'nmvs_response_sent', {
        recipient: nmvsEmail,
        subject,
      });

      enqueueSnackbar(t('nmvsDialog.success'), { variant: 'success' });
      closeActionDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('nmvsDialog.error');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const logHistoryEvent = async (
    alertId: string,
    eventType: AlertHistoryEventType,
    eventData: Record<string, unknown>
  ) => {
    try {
      await supabase.from('alert_history').insert({
        alert_id: alertId,
        event_type: eventType,
        event_data: eventData,
        performed_by: user?.id ?? null,
      });
    } catch (err) {
      console.error('Failed to log history event:', err);
    }
  };

  // Validation status parsing — rows separated by ';', key/value separated by first '='
  interface ValidationRow {
    step: string;
    statusText: string;
  }

  const parseValidationStatus = (raw: string | null | undefined): ValidationRow[] => {
    if (!raw) return [];
    return raw
      .split(';')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .map((segment) => {
        const eqIdx = segment.indexOf('=');
        if (eqIdx === -1) return { step: segment, statusText: '' };
        return {
          step: segment.slice(0, eqIdx).trim(),
          statusText: segment.slice(eqIdx + 1).trim(),
        };
      });
  };

  const getValidationStatusColor = (statusText: string): 'success' | 'error' | 'warning' | 'default' => {
    const lower = statusText.toLowerCase();
    if (lower.includes('fail')) return 'error';
    if (lower.includes('success') || lower.includes('complete')) return 'success';
    if (needsMasterDataTrigger(statusText)) return 'warning';
    return 'default';
  };

  const needsMasterDataTrigger = (statusText: string): boolean => {
    const lower = statusText.toLowerCase();
    return (
      lower.includes('not reported') ||
      lower.includes('retrigger') ||
      lower.includes('trigger reporting') ||
      lower.includes('needs to trigger')
    );
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, alert: null });
    setNmvsEmail('');
    setTriggeredRows(new Set());
    setTriggeringRow(null);
  };

  const handleTriggerMasterDataReporting = async (rowIndex: number) => {
    if (!uipathMasterDataConfig?.enabled || !uipathMasterDataConfig?.invoke_url) {
      enqueueSnackbar(t('masterDataNotConfigured'), { variant: 'warning' });
      return;
    }
    const alert = actionDialog.alert;
    if (!alert) return;

    setTriggeringRow(rowIndex);
    try {
      const res = await fetch('/api/uipath-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          invoke_url: uipathMasterDataConfig.invoke_url,
          personal_access_token: uipathMasterDataConfig.personal_access_token,
          inputs: {
            alert_id: alert.alert_id,
            in_GTIN: alert.gtin ?? '',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger UiPath automation');

      setTriggeredRows((prev) => {
        const next = new Set(prev);
        next.add(rowIndex);
        return next;
      });

      void logHistoryEvent(alert.id, 'master_data_triggered', {
        alert_id: alert.alert_id,
        gtin: alert.gtin,
      });

      enqueueSnackbar(t('masterDataTriggered'), { variant: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('masterDataTriggerError');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setTriggeringRow(null);
    }
  };

  // Retrigger all validations by starting the UiPath Maestro workflow. The
  // workflow expects: epcIdURIValue = (01)<GTIN>(21)<Serial Number>,
  // strGTIN = <GTIN>, TargetMarket = <target market>, alertid = <Alert ID>.
  const handleRetriggerValidations = async (alert: Alert) => {
    if (!uipathMaestroConfig?.enabled || !uipathMaestroConfig?.invoke_url) {
      enqueueSnackbar(t('retriggerValidations.notConfigured'), { variant: 'warning' });
      return;
    }

    const epcIdURIValue = `(01)${alert.gtin ?? ''}(21)${alert.serial_number ?? ''}`;
    setRetriggeringValidations((prev) => new Set(prev).add(alert.id));
    try {
      const res = await fetch('/api/uipath-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          invoke_url: uipathMaestroConfig.invoke_url,
          personal_access_token: uipathMaestroConfig.personal_access_token,
          inputs: {
            epcIdURIValue,
            strGTIN: alert.gtin ?? '',
            TargetMarket: alert.target_market,
            alertid: alert.alert_id,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retrigger validations');

      void logHistoryEvent(alert.id, 'validations_retriggered', {
        epcIdURIValue,
        strGTIN: alert.gtin ?? '',
        TargetMarket: alert.target_market,
        alertid: alert.alert_id,
      });

      enqueueSnackbar(t('retriggerValidations.success'), { variant: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('retriggerValidations.error');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setRetriggeringValidations((prev) => {
        const next = new Set(prev);
        next.delete(alert.id);
        return next;
      });
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

  const openDetailsDialog = async (alert: Alert) => {
    setDetailsDialog({ open: true, alert });
    setHistoryEvents([]);
    setHistoryUserMap({});
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('alert_history')
        .select('*')
        .eq('alert_id', alert.id)
        .order('performed_at', { ascending: false });
      if (error) throw error;
      const events = (data as AlertHistoryEvent[]) || [];
      setHistoryEvents(events);

      // Collect every distinct user UUID referenced in this alert's history
      // (performed_by + any user_assigned to/from values) and resolve them
      // via the SECURITY DEFINER RPC so we can show display names instead
      // of UUIDs even for actors the viewer can't normally read via RLS.
      const ids = new Set<string>();
      for (const ev of events) {
        if (ev.performed_by) ids.add(ev.performed_by);
        if (ev.event_type === 'user_assigned') {
          const d = ev.event_data || {};
          if (d.from) ids.add(String(d.from));
          if (d.to) ids.add(String(d.to));
        }
      }
      if (ids.size > 0) {
        const { data: users, error: usersErr } = await supabase.rpc('get_user_display_map', {
          p_user_ids: Array.from(ids),
        });
        if (usersErr) {
          console.error('Failed to resolve history user names:', usersErr);
        } else if (users) {
          const map: Record<string, string> = {};
          for (const u of users as Array<{ id: string; username: string | null; display_name: string | null }>) {
            map[u.id] = u.display_name || u.username || u.id.slice(0, 8);
          }
          setHistoryUserMap(map);
        }
      }
    } catch (err) {
      console.error('Failed to load alert history:', err);
      enqueueSnackbar(t('history.loadError'), { variant: 'error' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const closeDetailsDialog = () => {
    setDetailsDialog({ open: false, alert: null });
    setHistoryEvents([]);
    setHistoryUserMap({});
  };

  const getEventIcon = (eventType: AlertHistoryEventType) => {
    switch (eventType) {
      case 'created': return <CreatedIcon fontSize="small" />;
      case 'status_changed': return <StatusChangeIcon fontSize="small" />;
      case 'root_cause_updated': return <RootCauseEditIcon fontSize="small" />;
      case 'user_assigned': return <AssignIcon fontSize="small" />;
      case 'nmvs_response_sent': return <MailSentIcon fontSize="small" />;
      case 'master_data_triggered': return <TriggeredIcon fontSize="small" />;
      case 'validations_retriggered': return <RetriggerIcon fontSize="small" />;
      default: return <HistoryIcon fontSize="small" />;
    }
  };

  const getEventColor = (eventType: AlertHistoryEventType): 'primary' | 'info' | 'success' | 'warning' | 'secondary' | 'default' => {
    switch (eventType) {
      case 'created': return 'primary';
      case 'status_changed': return 'info';
      case 'root_cause_updated': return 'secondary';
      case 'user_assigned': return 'secondary';
      case 'nmvs_response_sent': return 'success';
      case 'master_data_triggered': return 'warning';
      case 'validations_retriggered': return 'info';
      default: return 'default';
    }
  };

  const resolveUserName = (userId: string | null): string => {
    if (!userId) return t('history.system');
    if (historyUserMap[userId]) return historyUserMap[userId];
    const u = availableUsers.find((au) => au.id === userId);
    if (u) return u.display_name || u.username;
    return t('history.unknownUser');
  };

  const describeEvent = (event: AlertHistoryEvent): string => {
    const d = event.event_data || {};
    switch (event.event_type) {
      case 'created':
        return t('history.descriptions.created', { status: String(d.status ?? '') });
      case 'status_changed':
        return t('history.descriptions.statusChanged', {
          from: String(d.from ?? ''),
          to: String(d.to ?? ''),
        });
      case 'root_cause_updated': {
        const newVal = d.to ? String(d.to) : t('history.empty');
        return t('history.descriptions.rootCauseUpdated', { value: newVal });
      }
      case 'user_assigned': {
        const toName = d.to ? resolveUserName(String(d.to)) : t('history.unassigned');
        return t('history.descriptions.userAssigned', { user: toName });
      }
      case 'nmvs_response_sent':
        return t('history.descriptions.nmvsSent', { recipient: String(d.recipient ?? '') });
      case 'master_data_triggered':
        return t('history.descriptions.masterDataTriggered', {
          gtin: d.gtin ? String(d.gtin) : '—',
        });
      case 'validations_retriggered':
        return t('history.descriptions.validationsRetriggered', {
          epc: d.epcIdURIValue ? String(d.epcIdURIValue) : '—',
        });
      default:
        return event.event_type;
    }
  };

  // ---- Column visibility (Task 1) ----
  const columnLabel = (col: AlertColumnDef): string =>
    col.ns === 'common' ? tc(col.labelKey) : t(col.labelKey);

  const visibleColumnDefs = ALERT_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  const persistVisibleColumns = async (cols: string[]) => {
    if (!user?.id) return;
    try {
      await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          // Record the full set of columns that exist now, so a later release
          // that adds a column can detect it as new and surface it by default.
          preferences: {
            alertsColumns: cols,
            alertsKnownColumns: DEFAULT_VISIBLE_COLUMNS,
          } satisfies UserPreferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      console.error('Failed to save column preferences:', err);
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : ALERT_COLUMNS.filter((c) => prev.includes(c.key) || c.key === key).map((c) => c.key);
      void persistVisibleColumns(next);
      return next;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    void persistVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    setColumnsMenuAnchor(null);
  };

  // ---- Per-column filters (Task 3) ----
  const openFilter = (key: string, anchor: HTMLElement) => {
    setFilterDraft(columnFilters[key] ?? '');
    setFilterPopover({ key, anchor });
  };

  const closeFilter = () => setFilterPopover(null);

  const commitFilter = (key: string, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (value.trim()) next[key] = value.trim();
      else delete next[key];
      return next;
    });
    setPage(0);
  };

  const applyFilter = () => {
    if (!filterPopover) return;
    commitFilter(filterPopover.key, filterDraft);
    closeFilter();
  };

  const clearFilter = (key: string) => {
    commitFilter(key, '');
    setFilterDraft('');
    closeFilter();
  };

  // Renders the body cell for a given column. Keeps the original per-column
  // markup/styling so behaviour is unchanged; only ordering/visibility is
  // now driven by the column config.
  const renderCell = (col: AlertColumnDef, alert: Alert) => {
    switch (col.key) {
      case 'alert_id':
        return (
          <TableCell key={col.key} sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {alert.alert_id}
          </TableCell>
        );
      case 'alert_timestamp':
        return (
          <TableCell key={col.key} sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {alert.alert_timestamp ? dayjs(alert.alert_timestamp).format('YYYY-MM-DD HH:mm') : '-'}
          </TableCell>
        );
      case 'status':
        return (
          <TableCell key={col.key}>
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
        );
      case 'error_code':
        return <TableCell key={col.key}>{alert.error_code || '-'}</TableCell>;
      case 'target_market':
        return (
          <TableCell key={col.key}>
            <Chip label={alert.target_market} size="small" variant="outlined" />
          </TableCell>
        );
      case 'alert_message':
        return (
          <TableCell key={col.key} sx={{ fontSize: '0.8rem', maxWidth: 180 }}>
            <Tooltip title={alert.alert_message || ''} placement="top-start">
              <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {alert.alert_message || '-'}
              </Box>
            </Tooltip>
          </TableCell>
        );
      case 'gtin':
        return (
          <TableCell key={col.key} sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {alert.gtin || '-'}
          </TableCell>
        );
      case 'batch_name':
        return <TableCell key={col.key}>{alert.batch_name || '-'}</TableCell>;
      case 'serial_number':
        return <TableCell key={col.key} sx={{ fontSize: '0.8rem' }}>{alert.serial_number || '-'}</TableCell>;
      case 'expiry_date':
        return (
          <TableCell key={col.key} sx={{ fontSize: '0.8rem' }}>
            {alert.expiry_date ? dayjs(alert.expiry_date).format('YYYY-MM-DD') : '-'}
          </TableCell>
        );
      case 'root_cause':
        return (
          <TableCell key={col.key}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <TextField
                size="small"
                multiline
                maxRows={2}
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
                sx={{ minWidth: 150, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
              />
              {editingRootCause[alert.id] !== undefined && (
                <Tooltip title={tc('save')}>
                  <IconButton size="small" color="primary" onClick={() => handleRootCauseSave(alert.id)}>
                    <SaveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </TableCell>
        );
      case 'assigned_user':
        return (
          <TableCell key={col.key}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={alert.assigned_user || ''}
                displayEmpty
                onChange={(e) => handleAssignedUserChange(alert.id, e.target.value)}
                sx={{ fontSize: '0.8rem' }}
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
        );
      case 'created_on':
        return (
          <TableCell key={col.key} sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {alert.created_on ? dayjs(alert.created_on).format('YYYY-MM-DD HH:mm') : '-'}
          </TableCell>
        );
      case 'changed_on':
        return (
          <TableCell key={col.key} sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {alert.changed_on ? dayjs(alert.changed_on).format('YYYY-MM-DD HH:mm') : '-'}
          </TableCell>
        );
      case 'details':
        return (
          <TableCell key={col.key}>
            <Tooltip title={t('details.viewDetails')}>
              <IconButton size="small" color="primary" onClick={() => openDetailsDialog(alert)}>
                <DetailsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </TableCell>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
        <Typography variant="h5">{t('title')}</Typography>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Button
            variant="contained"
            size="small"
            startIcon={
              isFetching ? (
                <SyncIcon
                  fontSize="small"
                  sx={{
                    animation: 'spin 1s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              ) : (
                <FetchIcon fontSize="small" />
              )
            }
            onClick={handleFetchAlerts}
            disabled={isFetching}
          >
            {isFetching ? t('fetchingAlerts') : t('fetchAlerts')}
          </Button>
          <Tooltip title={t('columnsConfig.tooltip')}>
            <IconButton size="small" onClick={(e) => setColumnsMenuAnchor(e.currentTarget)} color="primary">
              <ColumnsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={tc('refresh')}>
            <IconButton size="small" onClick={fetchAlerts} color="primary">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

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
        <TableContainer sx={{ maxHeight: 'calc(100vh - 240px)' }}>
          <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.size > 0 && selected.size < alerts.length}
                    checked={alerts.length > 0 && selected.size === alerts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                {visibleColumnDefs.map((col) => {
                  const hasFilter = Boolean(columnFilters[col.key]);
                  return (
                    <TableCell key={col.key} sx={col.key === 'root_cause' ? { minWidth: 160 } : undefined}>
                      <Box display="flex" alignItems="center" gap={0.5} sx={{ whiteSpace: 'nowrap' }}>
                        <span>{columnLabel(col)}</span>
                        {col.filter !== 'none' && (
                          <Tooltip title={hasFilter ? t('filter.active') : t('filter.tooltip')}>
                            <IconButton
                              size="small"
                              color={hasFilter ? 'primary' : 'default'}
                              onClick={(e) => openFilter(col.key, e.currentTarget)}
                            >
                              {hasFilter ? <FilterActiveIcon fontSize="inherit" /> : <FilterIcon fontSize="inherit" />}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  );
                })}
                <TableCell>{tc('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnDefs.length + 2} align="center" sx={{ py: 4 }}>
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
                    {visibleColumnDefs.map((col) => renderCell(col, alert))}
                    <TableCell>
                      <Box display="flex" alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title={t('retriggerValidations.tooltip')}>
                          <span>
                            <IconButton
                              size="small"
                              color="secondary"
                              disabled={retriggeringValidations.has(alert.id)}
                              onClick={() => handleRetriggerValidations(alert)}
                            >
                              {retriggeringValidations.has(alert.id) ? (
                                <SyncIcon
                                  fontSize="small"
                                  sx={{
                                    animation: 'spin 1s linear infinite',
                                    '@keyframes spin': {
                                      '0%': { transform: 'rotate(0deg)' },
                                      '100%': { transform: 'rotate(360deg)' },
                                    },
                                  }}
                                />
                              ) : (
                                <RetriggerIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('actionDialog.title')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setActionDialog({ open: true, alert })}
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
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

      {/* Action Dialog: validation status + NMVS response */}
      <Dialog
        open={actionDialog.open}
        onClose={closeActionDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('actionDialog.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Alert ID: {actionDialog.alert?.alert_id} | Status: {actionDialog.alert ? tc(`statuses.${actionDialog.alert.status}`) : ''} | Market: {actionDialog.alert?.target_market}
          </Typography>

          {/* Validation Status Section */}
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            {t('actionDialog.validationStatus')}
          </Typography>
          {(() => {
            if (!actionDialog.alert) return null;
            const isInProgress = actionDialog.alert.status === 'InProgress';
            const rows = isInProgress ? parseValidationStatus(actionDialog.alert.ValidationStatus) : [];

            if (!isInProgress) {
              return (
                <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('actionDialog.notInProgress')}
                  </Typography>
                </Box>
              );
            }

            if (rows.length === 0) {
              return (
                <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('actionDialog.noValidationData')}
                  </Typography>
                </Box>
              );
            }

            return (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('actionDialog.columns.step')}</TableCell>
                      <TableCell>{t('actionDialog.columns.status')}</TableCell>
                      <TableCell align="right">{tc('actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, idx) => {
                      const color = getValidationStatusColor(row.statusText);
                      const showTrigger = needsMasterDataTrigger(row.statusText);
                      const alreadyTriggered = triggeredRows.has(idx);
                      const isTriggeringThis = triggeringRow === idx;
                      return (
                        <TableRow key={idx}>
                          <TableCell>{row.step}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.statusText || '-'}
                              size="small"
                              color={color}
                              variant={color === 'default' ? 'outlined' : 'filled'}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {showTrigger && (
                              <Button
                                size="small"
                                variant="contained"
                                color="warning"
                                startIcon={<TriggerIcon />}
                                disabled={alreadyTriggered || isTriggeringThis}
                                onClick={() => handleTriggerMasterDataReporting(idx)}
                              >
                                {alreadyTriggered
                                  ? t('actionDialog.triggered')
                                  : isTriggeringThis
                                    ? t('actionDialog.triggering')
                                    : t('actionDialog.triggerReporting')}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })()}

          {/* NMVS Response Section */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            {t('nmvsDialog.title')}
          </Typography>

          {!graphConfig?.tenant_id && (
            <Box sx={{ bgcolor: 'warning.light', color: 'warning.dark', p: 1.5, borderRadius: 1, mb: 2, fontSize: '0.85rem' }}>
              Graph API not configured. Go to Admin &gt; Microsoft Graph API to set up email sending.
            </Box>
          )}

          <TextField
            fullWidth
            label={t('nmvsDialog.emailTo')}
            type="email"
            value={nmvsEmail}
            onChange={(e) => setNmvsEmail(e.target.value)}
            placeholder="recipient@example.com"
            helperText="Separate multiple emails with commas"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label={t('nmvsDialog.subject')}
            value={actionDialog.alert ? getEmailSubject(actionDialog.alert) : ''}
            slotProps={{ input: { readOnly: true } }}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" color="text.secondary" mb={0.5}>
            Email Body Preview:
          </Typography>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              maxHeight: 300,
              overflow: 'auto',
              bgcolor: 'grey.50',
              mb: 1,
            }}
            dangerouslySetInnerHTML={{
              __html: actionDialog.alert ? getEmailBody(actionDialog.alert) : '',
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActionDialog}>{tc('cancel')}</Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleRespondNMVS}
            disabled={!nmvsEmail || isSendingEmail || !graphConfig?.tenant_id}
          >
            {isSendingEmail ? 'Sending...' : t('nmvsDialog.send')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog: all field values + timeline of audit events */}
      <Dialog
        open={detailsDialog.open}
        onClose={closeDetailsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {t('details.dialogTitle')}
          {detailsDialog.alert && (
            <Typography variant="body2" color="text.secondary" component="div">
              {detailsDialog.alert.alert_id}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {detailsDialog.alert && (
            <>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>
                {t('details.fieldsTitle')}
              </Typography>
              <Box sx={{ mb: 2 }}>
                {[
                  { label: t('columns.alertId'), value: detailsDialog.alert.alert_id },
                  { label: t('columns.alertTimestamp'), value: detailsDialog.alert.alert_timestamp ? dayjs(detailsDialog.alert.alert_timestamp).format('YYYY-MM-DD HH:mm') : '-' },
                  { label: t('columns.status'), value: tc(`statuses.${detailsDialog.alert.status}`) },
                  { label: t('columns.errorCode'), value: detailsDialog.alert.error_code || '-' },
                  { label: t('columns.targetMarket'), value: detailsDialog.alert.target_market },
                  { label: t('columns.alertMessage'), value: detailsDialog.alert.alert_message || '-' },
                  { label: t('columns.gtin'), value: detailsDialog.alert.gtin || '-' },
                  { label: t('columns.batchName'), value: detailsDialog.alert.batch_name || '-' },
                  { label: t('columns.serialNumber'), value: detailsDialog.alert.serial_number || '-' },
                  { label: t('columns.expiryDate'), value: detailsDialog.alert.expiry_date ? dayjs(detailsDialog.alert.expiry_date).format('YYYY-MM-DD') : '-' },
                  { label: t('columns.messageGUID'), value: detailsDialog.alert.message_guid || '-' },
                  { label: t('actionDialog.validationStatus'), value: detailsDialog.alert.ValidationStatus || '-' },
                  { label: t('columns.rootCause'), value: detailsDialog.alert.root_cause || '-' },
                  { label: t('columns.assignedUser'), value: detailsDialog.alert.assigned_user ? resolveUserName(detailsDialog.alert.assigned_user) : t('history.unassigned') },
                  { label: tc('createdOn'), value: detailsDialog.alert.created_on ? dayjs(detailsDialog.alert.created_on).format('YYYY-MM-DD HH:mm') : '-' },
                  { label: tc('changedOn'), value: detailsDialog.alert.changed_on ? dayjs(detailsDialog.alert.changed_on).format('YYYY-MM-DD HH:mm') : '-' },
                ].map((f) => (
                  <Box
                    key={f.label}
                    sx={{ display: 'flex', gap: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150, flexShrink: 0, pt: '2px' }}>
                      {f.label}
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                      {f.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>
                {t('details.historyTitle')}
              </Typography>
            </>
          )}
          {isLoadingHistory ? (
            <Box sx={{ py: 3 }}>
              <LinearProgress />
            </Box>
          ) : historyEvents.length === 0 ? (
            <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('history.empty')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ position: 'relative', pl: 4 }}>
              {/* vertical connector line */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 15,
                  top: 12,
                  bottom: 12,
                  width: '2px',
                  bgcolor: 'divider',
                }}
              />
              {historyEvents.map((event) => {
                const color = getEventColor(event.event_type);
                return (
                  <Box key={event.id} sx={{ position: 'relative', mb: 2.5 }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -25,
                        top: 0,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: color === 'default' ? 'grey.400' : `${color}.main`,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getEventIcon(event.event_type)}
                    </Box>
                    <Box sx={{ ml: 1.5 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {t(`history.events.${event.event_type}`)}
                      </Typography>
                      <Typography variant="body2" color="text.primary">
                        {describeEvent(event)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(event.performed_at).format('YYYY-MM-DD HH:mm:ss')} • {resolveUserName(event.performed_by)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetailsDialog}>{tc('close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Column visibility menu (Task 1) */}
      <Menu
        anchorEl={columnsMenuAnchor}
        open={Boolean(columnsMenuAnchor)}
        onClose={() => setColumnsMenuAnchor(null)}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1 }}>
          {t('columnsConfig.title')}
        </Typography>
        <Divider />
        {ALERT_COLUMNS.map((col) => (
          <MenuItem key={col.key} dense onClick={() => toggleColumn(col.key)}>
            <Checkbox
              edge="start"
              size="small"
              checked={visibleColumns.includes(col.key)}
              tabIndex={-1}
              disableRipple
            />
            <ListItemText primary={columnLabel(col)} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem dense onClick={resetColumns}>
          {t('columnsConfig.reset')}
        </MenuItem>
      </Menu>

      {/* Per-column filter popover (Task 3) */}
      <Popover
        open={Boolean(filterPopover)}
        anchorEl={filterPopover?.anchor ?? null}
        onClose={closeFilter}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {filterPopover && (() => {
          const col = ALERT_COLUMNS.find((c) => c.key === filterPopover.key);
          if (!col) return null;
          const hasActiveFilter = Boolean(columnFilters[col.key]);
          return (
            <Box sx={{ p: 2, width: 260 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('filter.title', { field: columnLabel(col) })}
              </Typography>

              {col.filter === 'status' && (
                <FormControl fullWidth size="small">
                  <Select
                    value={filterDraft}
                    displayEmpty
                    onChange={(e) => setFilterDraft(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>{t('filter.all')}</em>
                    </MenuItem>
                    {ALERT_STATUSES.map((s) => (
                      <MenuItem key={s} value={s}>
                        {tc(`statuses.${s}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {col.filter === 'user' && (
                <FormControl fullWidth size="small">
                  <Select
                    value={filterDraft}
                    displayEmpty
                    onChange={(e) => setFilterDraft(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>{t('filter.all')}</em>
                    </MenuItem>
                    {availableUsers.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.display_name || u.username}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {col.filter === 'market' && (
                <FormControl fullWidth size="small">
                  <Select
                    value={filterDraft}
                    displayEmpty
                    onChange={(e) => setFilterDraft(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>{t('filter.all')}</em>
                    </MenuItem>
                    {markets.map((m) => (
                      <MenuItem key={m.market_code} value={m.market_code}>
                        {m.market_name} ({m.market_code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {col.filter === 'date' && (
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={filterDraft}
                  onChange={(e) => setFilterDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyFilter(); }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}

              {col.filter === 'text' && (
                <TextField
                  fullWidth
                  size="small"
                  autoFocus
                  value={filterDraft}
                  placeholder={t('filter.contains')}
                  onChange={(e) => setFilterDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyFilter(); }}
                />
              )}

              <Box display="flex" justifyContent="space-between" mt={2}>
                <Button
                  size="small"
                  onClick={() => clearFilter(col.key)}
                  disabled={!hasActiveFilter && !filterDraft}
                >
                  {t('filter.clear')}
                </Button>
                <Button size="small" variant="contained" onClick={applyFilter}>
                  {t('filter.apply')}
                </Button>
              </Box>
            </Box>
          );
        })()}
      </Popover>
    </Box>
  );
}
