import type { AlertStatus } from '../config/constants';

export interface Alert {
  id: string;
  alert_id: string;
  alert_timestamp: string | null;
  status: AlertStatus;
  error_code: string | null;
  target_market: string;
  alert_message: string | null;
  gtin: string | null;
  expiry_date: string | null;
  serial_number: string | null;
  batch_name: string | null;
  message_guid: string | null;
  root_cause: string | null;
  assigned_user: string | null;
  created_on: string;
  changed_on: string;
}

export interface AlertFilters {
  status?: AlertStatus | '';
  target_market?: string;
  gtin?: string;
  batch_name?: string;
  date_from?: string;
  date_to?: string;
  month?: number;
  year?: number;
}

export interface BulkOperation {
  id: string;
  requested_by: string;
  operation_type: 'close' | 'respond_nmvs';
  alert_ids: string[];
  status: 'PendingApproval' | 'Approved' | 'Rejected';
  reviewed_by: string | null;
  comments: string | null;
  created_at: string;
  reviewed_at: string | null;
}
