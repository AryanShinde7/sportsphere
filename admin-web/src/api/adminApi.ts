import { apiClient } from './client';
import type {
  User,
  Athlete,
  VerificationItem,
  DashboardStats,
  SupportRequest,
  SponsorshipInterest,
  AuditLogsResponse,
  LoginResponse,
} from './types';

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    return res.data;
  },
  getMe: async (): Promise<{ user: User }> => {
    const res = await apiClient.get<{ user: User }>('/auth/me');
    return res.data;
  },
};

export const athletesApi = {
  getAll: async (params?: { sportId?: number; verificationStatus?: string }): Promise<Athlete[]> => {
    const res = await apiClient.get<Athlete[]>('/athletes', { params });
    return res.data;
  },
  getById: async (id: number | string): Promise<Athlete> => {
    const res = await apiClient.get<Athlete>(`/athletes/${id}`);
    return res.data;
  },
};

export const adminApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const res = await apiClient.get<DashboardStats>('/admin/dashboard');
    return res.data;
  },

  getPendingVerifications: async (): Promise<VerificationItem[]> => {
    const res = await apiClient.get<VerificationItem[]>('/admin/verifications/pending');
    return res.data;
  },

  getAllVerifications: async (status?: string): Promise<VerificationItem[]> => {
    const res = await apiClient.get<VerificationItem[]>('/admin/verifications', {
      params: status ? { status } : undefined,
    });
    return res.data;
  },

  approveVerification: async (id: number | string, notes?: string): Promise<{ message: string; verification: VerificationItem }> => {
    const res = await apiClient.post<{ message: string; verification: VerificationItem }>(
      `/admin/verifications/${id}/approve`,
      { notes }
    );
    return res.data;
  },

  rejectVerification: async (id: number | string, reason?: string): Promise<{ message: string; verification: VerificationItem }> => {
    const res = await apiClient.post<{ message: string; verification: VerificationItem }>(
      `/admin/verifications/${id}/reject`,
      { reason }
    );
    return res.data;
  },

  requestCorrection: async (id: number | string, notes?: string): Promise<{ message: string; verification: VerificationItem }> => {
    const res = await apiClient.post<{ message: string; verification: VerificationItem }>(
      `/admin/verifications/${id}/request-correction`,
      { notes }
    );
    return res.data;
  },

  getSupportRequests: async (status?: string): Promise<SupportRequest[]> => {
    const res = await apiClient.get<SupportRequest[]>('/admin/support-requests', {
      params: status ? { status } : undefined,
    });
    return res.data;
  },

  approveSupportRequest: async (id: number | string): Promise<{ message: string; request: SupportRequest }> => {
    const res = await apiClient.put<{ message: string; request: SupportRequest }>(
      `/admin/support-requests/${id}/approve`
    );
    return res.data;
  },

  getSponsorshipInterests: async (status?: string): Promise<SponsorshipInterest[]> => {
    const res = await apiClient.get<SponsorshipInterest[]>('/admin/sponsorship-interests', {
      params: status ? { status } : undefined,
    });
    return res.data;
  },

  updateSponsorshipInterest: async (
    id: number | string,
    status: string,
    notes?: string
  ): Promise<{ message: string; interest: SponsorshipInterest }> => {
    const res = await apiClient.put<{ message: string; interest: SponsorshipInterest }>(
      `/admin/sponsorship-interests/${id}`,
      { status, notes }
    );
    return res.data;
  },

  getAuditLogs: async (params?: { page?: number; limit?: number }): Promise<AuditLogsResponse> => {
    const res = await apiClient.get<AuditLogsResponse>('/admin/audit-logs', { params });
    return res.data;
  },
};
