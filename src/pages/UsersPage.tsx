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
  MenuItem,
  Chip,
  Tooltip,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  LockReset as ResetIcon,
  Public as MarketIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { getCreatableRoles } from '../utils/rolePermissions';
import type { User } from '../types/user';
import type { Market } from '../types/market';
import type { AppRole } from '../config/constants';

export default function UsersPage() {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { user: currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [users, setUsers] = useState<User[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userMarketsMap, setUserMarketsMap] = useState<Record<string, Market[]>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [marketDialogOpen, setMarketDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [marketUser, setMarketUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    display_name: '',
    role: 'AlertHandler' as AppRole,
  });
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>([]);

  const creatableRoles = currentUser ? getCreatableRoles(currentUser.role) : [];

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, role, created_at')
      .order('created_at', { ascending: false });
    if (data) setUsers(data);
  };

  const fetchMarkets = async () => {
    const { data } = await supabase.from('markets').select('*');
    if (data) setMarkets(data);
  };

  const fetchUserMarkets = async () => {
    const { data } = await supabase
      .from('user_markets')
      .select('user_id, market_id, markets(id, market_name, market_code, created_at)');
    if (data) {
      const map: Record<string, Market[]> = {};
      for (const row of data) {
        const market = (row as Record<string, unknown>).markets as Market | null;
        if (!market) continue;
        if (!map[row.user_id]) map[row.user_id] = [];
        map[row.user_id].push(market);
      }
      setUserMarketsMap(map);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMarkets();
    fetchUserMarkets();
  }, []);

  const handleCreate = async () => {
    try {
      // Create auth user via Supabase Auth admin (requires service role or Edge Function)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      // Create profile
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: authData.user.id,
        username: formData.email,
        display_name: formData.display_name,
        role: formData.role,
      });
      if (profileError) throw profileError;

      enqueueSnackbar(t('createSuccess'), { variant: 'success' });
      setFormOpen(false);
      setFormData({ email: '', password: '', display_name: '', role: 'AlertHandler' });
      fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error');
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const { error } = await supabase.from('user_profiles').delete().eq('id', userId);
      if (error) throw error;
      enqueueSnackbar(t('deleteSuccess'), { variant: 'success' });
      fetchUsers();
    } catch {
      enqueueSnackbar(t('error'), { variant: 'error' });
    }
  };

  const handleMarketAssign = async () => {
    if (!marketUser) return;
    try {
      await supabase.from('user_markets').delete().eq('user_id', marketUser.id);
      if (selectedMarketIds.length > 0) {
        const rows = selectedMarketIds.map((mid) => ({
          user_id: marketUser.id,
          market_id: mid,
        }));
        const { error } = await supabase.from('user_markets').insert(rows);
        if (error) throw error;
      }
      enqueueSnackbar(t('updateSuccess'), { variant: 'success' });
      setMarketDialogOpen(false);
      fetchUserMarkets();
    } catch {
      enqueueSnackbar(t('error'), { variant: 'error' });
    }
  };

  const openMarketDialog = (u: User) => {
    setMarketUser(u);
    setSelectedMarketIds((userMarketsMap[u.id] || []).map((m) => m.id));
    setMarketDialogOpen(true);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'AlertHandler_supervisor': return 'warning';
      default: return 'primary';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{t('title')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingUser(null);
            setFormData({ email: '', password: '', display_name: '', role: 'AlertHandler' });
            setFormOpen(true);
          }}
        >
          {t('addUser')}
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{tc('username')}</TableCell>
                <TableCell>{t('displayName')}</TableCell>
                <TableCell>{tc('role')}</TableCell>
                <TableCell>{tc('market')}</TableCell>
                <TableCell>{tc('createdOn')}</TableCell>
                <TableCell>{tc('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">{t('noUsers')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>{u.display_name || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={tc(`roles.${u.role}`)}
                        size="small"
                        color={getRoleColor(u.role) as 'error' | 'warning' | 'primary'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {(userMarketsMap[u.id] || []).map((m) => (
                        <Chip key={m.id} label={m.market_code} size="small" sx={{ mr: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={t('assignMarkets')}>
                        <IconButton size="small" onClick={() => openMarketDialog(u)}>
                          <MarketIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('resetPassword')}>
                        <IconButton
                          size="small"
                          onClick={async () => {
                            try {
                              await supabase.auth.resetPasswordForEmail(u.username);
                              enqueueSnackbar(t('resetSuccess'), { variant: 'success' });
                            } catch {
                              enqueueSnackbar(t('error'), { variant: 'error' });
                            }
                          }}
                        >
                          <ResetIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={tc('delete')}>
                        <IconButton size="small" color="error" onClick={() => handleDelete(u.id)}>
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

      {/* Create User Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? t('editUser') : t('addUser')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={tc('email')}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label={tc('password')}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label={t('displayName')}
            value={formData.display_name}
            onChange={(e) => setFormData((p) => ({ ...p, display_name: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            fullWidth
            label={t('assignRole')}
            value={formData.role}
            onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value as AppRole }))}
          >
            {creatableRoles.map((role) => (
              <MenuItem key={role} value={role}>
                {tc(`roles.${role}`)}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!formData.email || !formData.password}
          >
            {tc('save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Markets Dialog */}
      <Dialog open={marketDialogOpen} onClose={() => setMarketDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('assignMarkets')} - {marketUser?.display_name || marketUser?.username}
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            options={markets}
            getOptionLabel={(m) => `${m.market_name} (${m.market_code})`}
            value={markets.filter((m) => selectedMarketIds.includes(m.id))}
            onChange={(_, newVal) => setSelectedMarketIds(newVal.map((m) => m.id))}
            renderInput={(params) => (
              <TextField {...params} label={t('assignMarkets')} sx={{ mt: 1 }} />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...rest } = getTagProps({ index });
                return (
                  <Chip key={key} label={option.market_code} size="small" {...rest} />
                );
              })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarketDialogOpen(false)}>{tc('cancel')}</Button>
          <Button variant="contained" onClick={handleMarketAssign}>
            {tc('save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
