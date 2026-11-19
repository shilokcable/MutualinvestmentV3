import type { DashboardData, KycData, NoticeItem, StatementData } from './types';

async function request<T>(url: string, options: RequestInit = {}, token = ''): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({ ok: false, message: 'Server response invalid.' }));
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface SheetSyncResult {
  ok: true;
  webhookUrl?: string;
  spreadsheetUrl?: string;
  title?: string;
  lastSync?: string;
  rowsSynced?: number;
  sheetSynced?: boolean;
  sheetError?: string;
}

export const api = {
  getNotices: () =>
    fetch('/api/notices')
      .then((r) => r.json() as Promise<{ ok: boolean; notices: NoticeItem[] }>)
      .catch(() => ({ ok: false, notices: [] as NoticeItem[] })),

  createNotice: (token: string, payload: { title: string; body: string; priority: string }) =>
    request<{ ok: true; id: string; notices: NoticeItem[]; sheetSynced?: boolean; sheetError?: string }>(
      '/api/notices',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  deleteNotice: (token: string, id: string) =>
    request<{ ok: true; notices: NoticeItem[]; sheetSynced?: boolean; sheetError?: string }>(
      `/api/notices/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      token
    ),

  connectGoogleSheet: (token: string, webhookUrl: string) =>
    request<SheetSyncResult>(
      '/api/sheets/connect',
      { method: 'POST', body: JSON.stringify({ webhookUrl }) },
      token
    ),

  syncGoogleSheet: (token: string) =>
    request<SheetSyncResult>('/api/sheets/sync', { method: 'POST' }, token),

  disconnectGoogleSheet: (token: string) =>
    request<{ ok: true }>('/api/sheets/disconnect', { method: 'POST' }, token),

  memberLogin: (memberId: string, password: string) =>
    fetch('/api/auth/member-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, password }),
    }).then((r) => r.json() as Promise<{ ok: boolean; token?: string; memberId?: string; message?: string }>),

  adminLogin: (pin: string) =>
    fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    }).then((r) => r.json() as Promise<{ ok: boolean; token?: string; message?: string }>),

  logout: (token: string) =>
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null),

  getDashboard: (token: string) => request<DashboardData>('/api/dashboard', {}, token),

  saveTransaction: (
    token: string,
    payload: { date: string; memberId: string; amount: number; type: string; note: string }
  ) =>
    request<{ ok: true; id: string; sheetSynced?: boolean; sheetError?: string }>(
      '/api/transactions',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  saveFdr: (
    token: string,
    payload: { date: string; amount: number; tenure: number; bank: string; fdrNo: string; ref: string; note?: string }
  ) =>
    request<{ ok: true; id: string; sheetSynced?: boolean; sheetError?: string }>(
      '/api/fdr',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  returnFdr: (
    token: string,
    payload: { fdrId: string; returnDate: string; returnedAmount: number; ref: string; note?: string }
  ) =>
    request<{ ok: true; sheetSynced?: boolean; sheetError?: string }>(
      '/api/fdr/return',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  saveBankEntry: (
    token: string,
    payload: { date: string; type: string; amount: number; ref: string; note: string }
  ) =>
    request<{ ok: true; id: string; sheetSynced?: boolean; sheetError?: string }>(
      '/api/bank',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  addMember: (
    token: string,
    payload: { memberId: string; name: string; mobile: string; status: string; password: string }
  ) =>
    request<{ ok: true; id: string; sheetSynced?: boolean; sheetError?: string }>(
      '/api/members',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  updateMember: (
    token: string,
    memberId: string,
    payload: { name: string; mobile: string; status: string; password: string }
  ) =>
    request<{ ok: true; sheetSynced?: boolean; sheetError?: string }>(
      `/api/members/${encodeURIComponent(memberId)}`,
      { method: 'PUT', body: JSON.stringify(payload) },
      token
    ),

  updateSettings: (token: string, payload: { openingBalance?: number; newPin?: string }) =>
    request<{ ok: true; sheetSynced?: boolean; sheetError?: string }>(
      '/api/settings',
      { method: 'PUT', body: JSON.stringify(payload) },
      token
    ),

  getKyc: (token: string, includeMedia = true, memberId?: string) => {
    const qs = new URLSearchParams({ includeMedia: String(includeMedia) });
    if (memberId) qs.set('memberId', memberId);
    return request<{ ok: true; kyc: KycData }>(`/api/kyc?${qs.toString()}`, {}, token);
  },

  saveKyc: (token: string, payload: Record<string, string>) =>
    request<{ ok: true; kyc: KycData; sheetSynced?: boolean; sheetError?: string }>(
      '/api/kyc',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  changeProfilePhoto: (token: string, photoData: string) =>
    request<{ ok: true; photoData: string }>(
      '/api/kyc/photo',
      { method: 'POST', body: JSON.stringify({ photoData }) },
      token
    ),

  submitKycRequest: (token: string, requestText: string) =>
    request<{ ok: true; id: string; sheetSynced?: boolean; sheetError?: string }>(
      '/api/kyc/request',
      { method: 'POST', body: JSON.stringify({ requestText }) },
      token
    ),

  reviewKycRequest: (token: string, id: string, status: 'Approved' | 'Rejected', adminNote: string) =>
    request<{ ok: true; sheetSynced?: boolean; sheetError?: string }>(
      `/api/kyc/requests/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ status, adminNote }) },
      token
    ),

  getStatement: (token: string, memberId?: string) => {
    const qs = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
    return request<StatementData>(`/api/statement${qs}`, {}, token);
  },
};
