import { useState, useEffect } from 'react';
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
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tooltip,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';
import type { Market } from '../types/market';
import type { User } from '../types/user';

export default function MarketConfigPage() {
  const { t } = useTranslation('markets');
  const { t: tc } = useTranslation('common');
  const { enqueueSnackbar } = useSnackbar();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [assigningMarket, setAssigningMarket] = useState<Market | null>(null);
  const [formData, setFormData] = useState({ market_name: '', market_code: '' });
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [marketUsers, setMarketUsers] = useState<Record<string, User[]>>({});

  const fetchMarkets = async () => {
    const { data } = await supabase.from('markets').select('*').order('market_name');
    if (data) setMarkets(data);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, role, created_at');
    if (data) setUsers(data);
  };

  const fetchMarketUsers = async () => {
    const { data } = await supabase
      .from('user_markets')
      .select('market_id, user_id, user_profiles(id, username, display_name, role, created_at)');
    if (data) {
      const map: Record<string, User[]> = {};
      for (const row of data) {
        const profile = (row as Record<string, unknown>).user_profiles as User | null;
        if (!profile) continue;
        if (!map[row.market_id]) map[row.market_id] = [];
        map[row.market_id].push(profile);
      }
      setMarketUsers(map);
    }
  };

  useEffect(() => {
    fetchMarkets();
    fetchUsers();
    fetchMarketUsers();
  }, []);

  const handleSave = async () => {
    try {
      if (editingMarket) {
        const { error } = await supabase
          .from('markets')
          .update(formData)
          .eq('id', editingMarket.id);
        if (error) throw error;
        enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
      } else {
        const { error } = await supabase.from('markets').insert(formData);
        if (error) throw error;
        enqueueSnackbar(t('createSuccess'), { variant: 'success' });
      }
      setFormOpen(false);
      setEditingMarket(null);
      setFormData({ market_name: '', market_code: '' });
      fetchMarkets();
    } catch {
      enqueueSnackbar(t('error'), { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const { error } = await supabase.from('markets').delete().eq('id', id);
      if (error) throw error;
      enqueueSnackbar(t('deleteSuccess'), { variant: 'success' });
      fetchMarkets();
    } catch {
      enqueueSnackbar(t('error'), { variant: 'error' });
    }
  };

  const handleAssignSave = async () => {
    if (!assigningMarket) return;
    try {
      // Remove existing assignments
      await supabase.from('user_markets').delete().eq('market_id', assigningMarket.id);

      // Insert new assignments
      if (assignedUserIds.length > 0) {
        const rows = assignedUserIds.map((uid) => ({
          user_id: uid,
          market_id: assigningMarket.id,
        }));
        const { error } = await supabase.from('user_markets').insert(rows);
        if (error) throw error;
      }

      enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
      setAssignOpen(false);
      setAssigningMarket(null);
      fetchMarketUsers();
    } catch {
      enqueueSnackbar(t('error'), { variant: 'error' });
    }
  };

  const openAssign = (market: Market) => {
    setAssigningMarket(market);
    setAssignedUserIds((marketUsers[market.id] || []).map((u) => u.id));
    setAssignOpen(true);
  };

  const openEdit = (market: Market) => {
    setEditingMarket(market);
    setFormData({ market_name: market.market_name, market_code: market.market_code });
    setFormOpen(true);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{t('title')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingMarket(null);
            setFormData({ market_name: '', market_code: '' });
            setFormOpen(true);
          }}
        >
          {t('addMarket')}
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('marketName')}</TableCell>
                <TableCell>{t('marketCode')}</TableCell>
                <TableCell>{t('assignedUsers')}</TableCell>
                <TableCell>{tc('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {markets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">{t('noMarkets')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                markets.map((market) => (
                  <TableRow key={market.id} hover>
                    <TableCell>{market.market_name}</TableCell>
                    <TableCell>
                      <Chip label={market.market_code} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {(marketUsers[market.id] || []).map((u) => (
                        <Chip
                          key={u.id}
                          label={u.display_name || u.username}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={t('assignUsers')}>
                        <IconButton size="small" onClick={() => openAssign(market)}>
                          <PeopleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={tc('edit')}>
                        <IconButton size="small" onClick={() => openEdit(market)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={tc('delete')}>
                        <IconButton size="small" color="error" onClick={() => handleDelete(market.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add/Edit Market Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMarket ? t('editMarket') : t('addMarket')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={t('marketName')}
            value={formData.market_name}
            onChange={(e) => setFormData((p) => ({ ...p, market_name: e.target.value }))}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label={t('marketCode')}
            value={formData.market_code}
            onChange={(e) => setFormData((p) => ({ ...p, market_code: e.target.value.toUpperCase() }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formData.market_name || !formData.market_code}
          >
            {tc('save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Users Dialog */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('assignUsers')} - {assigningMarket?.market_name}
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            options={users}
            getOptionLabel={(u) => `${u.display_name || u.username} (${u.role})`}
            value={users.filter((u) => assignedUserIds.includes(u.id))}
            onChange={(_, newVal) => setAssignedUserIds(newVal.map((u) => u.id))}
            renderInput={(params) => (
              <TextField {...params} label={t('assignUsers')} sx={{ mt: 1 }} />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...rest } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={option.display_name || option.username}
                    size="small"
                    {...rest}
                  />
                );
              })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>{tc('cancel')}</Button>
          <Button variant="contained" onClick={handleAssignSave}>
            {tc('save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
