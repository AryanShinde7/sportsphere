export interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'ATHLETE' | 'SUPPORTER' | 'SPONSOR';
  avatarUrl?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sport {
  id: number;
  name: string;
  category: string;
}

export interface Achievement {
  id: number;
  title: string;
  year: number;
  level: string;
  description?: string;
}

export interface BudgetItem {
  id: number;
  category: string;
  description: string;
  amount: number;
  isFunded: boolean;
}

export interface SupportRequest {
  id: number;
  athleteId: number;
  title: string;
  description: string;
  targetAmount: number;
  amountSupported: number;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED';
  budgetItems?: BudgetItem[];
  athlete?: Athlete;
  createdAt?: string;
  updatedAt?: string;
}

export interface VerificationItem {
  id: number;
  athleteId: number;
  type: string;
  title: string;
  documentUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED';
  notes?: string;
  athlete?: Athlete;
  createdAt?: string;
  updatedAt?: string;
}

export interface SponsorshipInterest {
  id: number;
  athleteId: number;
  sponsorName: string;
  sponsorEmail: string;
  company?: string;
  message: string;
  proposalAmount?: number;
  status: 'PENDING' | 'REVIEWING' | 'ACCEPTED' | 'DECLINED';
  notes?: string;
  athlete?: Athlete;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: number;
  adminId: number;
  action: string;
  targetType: string;
  targetId: number;
  details?: string;
  createdAt: string;
  admin?: {
    name: string;
    email: string;
  };
}

export interface Athlete {
  id: number;
  userId: number;
  sportId: number;
  discipline: string;
  bio?: string;
  state?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  user?: User;
  sport?: Sport;
  achievements?: Achievement[];
  supportRequests?: SupportRequest[];
  verifications?: VerificationItem[];
}

export interface DashboardStats {
  totalAthletes: number;
  verifiedAthletes: number;
  pendingVerificationsCount: number;
  totalFunded: number;
  pendingVerifications: VerificationItem[];
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
