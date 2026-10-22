import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Users, Activity, FileCheck, LogOut,
  CheckCircle, Zap, RefreshCw, FileText, AlertTriangle
} from 'lucide-react';
import './index.css';
import {
  authApi,
  adminApi,
  athletesApi,
  getAdminToken,
  getAdminUser,
  setAdminAuth,
  clearAdminAuth,
  API_URL,
  type User,
} from './api';

const AVATAR_COLORS = [
  '#C2410C', '#0891B2', '#7C3AED', '#059669',
  '#DB2777', '#CA8A04', '#2563EB', '#0D9488',
];

function getInitials(name: string) {
  return (name || 'Admin').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/* ══════════════════════════════════════
   LOGIN SCREEN
══════════════════════════════════════ */
function LoginScreen({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [email, setEmail] = useState('admin@sportsphere.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      if (res.user.role !== 'ADMIN') {
        setError('Access denied. This portal is for administrators only.');
        setLoading(false);
        return;
      }
      setAdminAuth(res.token, res.user);
      onLogin(res.token, res.user);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Invalid credentials. Please verify backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen animate-fade-in">
      <div className="glow-tr" />
      <div className="glow-bl" />

      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(194,65,12,0.08), transparent)',
      }} />

      <div className="login-container animate-slide-up" style={{ animationDelay: '80ms' }}>
        <div className="login-brand">
          <div className="brand-name">
            <span className="brand-white">SPORT</span>
            <span className="brand-accent">SPHERE</span>
          </div>
        </div>
        <p className="login-tagline">Admin Portal · Sports Compliance & Review Queue</p>

        <div className="login-card">
          <p className="card-label">Sign in with Administrator Credentials</p>

          <form onSubmit={handleSubmit}>
            <input
              id="admin-email"
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <input
              id="admin-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="login-error animate-fade-in">{error}</div>
            )}

            <button
              id="admin-login-btn"
              type="submit"
              className="btn btn-primary btn-full login-btn"
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner" /> Authenticating...</>
              ) : (
                <><Shield size={16} /> Sign In to Admin Center</>
              )}
            </button>
          </form>
        </div>

        <p className="login-hint">Demo Admin: <strong>admin@sportsphere.com</strong> · password: <strong>password123</strong></p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   STAT CARD
══════════════════════════════════════ */
function StatCard({ icon, label, value, color, delay = 0, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  delay?: number;
  onClick?: () => void;
}) {
  return (
    <div
      className="stat-card animate-slide-up"
      style={{ animationDelay: `${delay}ms`, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color, flexShrink: 0,
        }}>
          {icon}
        </div>
        <p className="stat-label" style={{ margin: 0 }}>{label}</p>
      </div>
      <p className="stat-value" style={{ color: color }}>{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN DASHBOARD COMPONENT
══════════════════════════════════════ */
function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'verifications' | 'campaigns' | 'audit'>('overview');
  const [dashboard, setDashboard] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [allVerifications, setAllVerifications] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sponsorships, setSponsorships] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Verification filtering
  const [verifFilter, setVerifFilter] = useState<'ALL' | 'IDENTITY' | 'ACHIEVEMENT' | 'SUPPORT_NEED'>('ALL');
  const [verifSearch, setVerifSearch] = useState('');

  // Action status
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reject / Correction modal
  const [rejectionModalItem, setRejectionModalItem] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [correctionModalItem, setCorrectionModalItem] = useState<any | null>(null);
  const [correctionNotes, setCorrectionNotes] = useState('');

  // Evidence view modal
  const [evidenceModalItem, setEvidenceModalItem] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    setFetchError(null);
    try {
      const results = await Promise.allSettled([
        adminApi.getDashboard(),
        athletesApi.getAll(),
        adminApi.getSponsorshipInterests(),
        adminApi.getAllVerifications(),
        adminApi.getSupportRequests(),
        adminApi.getAuditLogs({ page: 1, limit: 30 })
      ]);

      const [dashRes, athRes, sponRes, verifRes, campRes, auditRes] = results;

      if (dashRes.status === 'fulfilled') {
        setDashboard(dashRes.value);
      } else {
        console.warn('Dashboard fetch rejected:', dashRes.reason);
      }

      if (athRes.status === 'fulfilled') {
        setAthletes(athRes.value || []);
      }

      if (sponRes.status === 'fulfilled') {
        setSponsorships(sponRes.value || []);
      }

      if (verifRes.status === 'fulfilled') {
        setAllVerifications(verifRes.value || []);
      }

      if (campRes.status === 'fulfilled') {
        setCampaigns(campRes.value || []);
      }

      if (auditRes.status === 'fulfilled') {
        setAuditLogs(auditRes.value?.logs || []);
      }

      if (dashRes.status === 'rejected') {
        const err = dashRes.reason;
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          clearAdminAuth();
          onLogout();
          return;
        }
        setFetchError('Failed to connect to backend API at http://localhost:5000/api. Check if backend is running.');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setFetchError(err.message || 'Network error fetching admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  // Decisions
  const handleApprove = async (id: number) => {
    setActionLoading(prev => ({ ...prev, [id]: 'approve' }));
    setActionError(null);
    setActionSuccess(null);
    try {
      await adminApi.approveVerification(id, 'Approved via admin compliance portal');
      setActionSuccess(`Verification item #${id} approved successfully!`);
      await fetchData();
    } catch (err: any) {
      console.error('Approve failed:', err);
      setActionError(err.response?.data?.error || `Failed to approve verification #${id}.`);
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionModalItem) return;
    const id = rejectionModalItem.id;
    if (!rejectionReason.trim()) {
      setActionError('A specific rejection reason is mandatory (Instruction 6.5).');
      return;
    }

    setActionLoading(prev => ({ ...prev, [id]: 'reject' }));
    setActionError(null);
    try {
      await adminApi.rejectVerification(id, rejectionReason.trim());
      setActionSuccess(`Verification item #${id} rejected with recorded reason.`);
      setRejectionModalItem(null);
      setRejectionReason('');
      await fetchData();
    } catch (err: any) {
      console.error('Reject failed:', err);
      setActionError(err.response?.data?.error || `Failed to reject verification #${id}.`);
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleConfirmCorrection = async () => {
    if (!correctionModalItem) return;
    const id = correctionModalItem.id;
    if (!correctionNotes.trim()) {
      setActionError('Instructions/notes are required when requesting correction.');
      return;
    }

    setActionLoading(prev => ({ ...prev, [id]: 'correction' }));
    setActionError(null);
    try {
      await adminApi.requestCorrection(id, correctionNotes.trim());
      setActionSuccess(`Correction requested for item #${id}. Returned to athlete.`);
      setCorrectionModalItem(null);
      setCorrectionNotes('');
      await fetchData();
    } catch (err: any) {
      console.error('Request correction failed:', err);
      setActionError(err.response?.data?.error || `Failed to request correction for #${id}.`);
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleApproveCampaign = async (campaignId: number) => {
    setActionLoading(prev => ({ ...prev, [`camp-${campaignId}`]: 'approve' }));
    try {
      await adminApi.approveSupportRequest(campaignId);
      setActionSuccess(`Funding Campaign #${campaignId} is now APPROVED and live for public contributions!`);
      await fetchData();
    } catch (err: any) {
      console.error('Approve campaign failed:', err);
      setActionError(err.response?.data?.error || `Failed to approve campaign #${campaignId}.`);
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[`camp-${campaignId}`];
        return next;
      });
    }
  };

  const handleUpdateSponsorshipStatus = async (id: number, newStatus: string) => {
    setActionLoading(prev => ({ ...prev, [`spon-${id}`]: 'updating' }));
    try {
      await adminApi.updateSponsorshipInterest(id, newStatus);
      setActionSuccess(`Sponsorship proposal #${id} updated to ${newStatus}.`);
      await fetchData();
    } catch (err) {
      console.error('Failed to update sponsorship status:', err);
      setActionError('Failed to update sponsorship proposal status.');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[`spon-${id}`];
        return next;
      });
    }
  };

  // Verifications pending
  const pendingItems = (allVerifications.length > 0 ? allVerifications : (dashboard?.pendingVerifications || []))
    .filter((item: any) => item.status === 'PENDING_REVIEW');

  const filteredVerifications = (allVerifications.length > 0 ? allVerifications : pendingItems)
    .filter((item: any) => {
      if (verifFilter !== 'ALL' && item.category !== verifFilter) return false;
      if (verifSearch.trim()) {
        const query = verifSearch.toLowerCase();
        const name = (item.athleteName || item.entity?.athlete?.user?.name || item.entity?.user?.name || '').toLowerCase();
        const title = (item.title || item.entity?.title || item.notes || '').toLowerCase();
        return name.includes(query) || title.includes(query);
      }
      return true;
    });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)' }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', position: 'relative' }}>
      <div className="glow-tr" />
      <div className="glow-bl" />

      {/* ── TOP NAV BAR ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 28px',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Shield size={20} color="var(--primary)" />
          <span style={{
            fontSize: '1rem', fontWeight: 900, letterSpacing: '0.1em',
            textTransform: 'uppercase', fontStyle: 'italic',
          }}>
            <span style={{ color: 'var(--foreground)' }}>SPORT</span>
            <span style={{ color: 'var(--primary)' }}>SPHERE</span>
          </span>
          <span style={{
            padding: '3px 10px',
            background: 'var(--primary-subtle)', border: '1px solid rgba(194,65,12,0.3)',
            borderRadius: 999, fontSize: '0.625rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)',
          }}>Compliance Admin</span>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: 6, marginLeft: 24 }}>
            <button
              onClick={() => setActiveTab('overview')}
              className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.75rem', fontStyle: 'normal' }}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('verifications')}
              className={`btn btn-sm ${activeTab === 'verifications' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.75rem', fontStyle: 'normal', position: 'relative' }}
            >
              Verification Queue
              {pendingItems.length > 0 && (
                <span style={{
                  marginLeft: 6, padding: '2px 6px', borderRadius: 99,
                  background: activeTab === 'verifications' ? '#fff' : 'var(--warning)',
                  color: activeTab === 'verifications' ? '#000' : '#000',
                  fontWeight: 900, fontSize: '0.65rem'
                }}>
                  {pendingItems.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`btn btn-sm ${activeTab === 'campaigns' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.75rem', fontStyle: 'normal' }}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.75rem', fontStyle: 'normal' }}
            >
              Audit Trail
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 12px', fontSize: '0.75rem', gap: 6 }}
            title="Sync live data with backend"
          >
            <RefreshCw size={13} className={refreshing ? 'spinner' : ''} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 20 }}>
            <div className="live-dot" />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted-foreground)' }}>Port 5000 Live</span>
          </div>

          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: getAvatarColor(user?.name || 'Admin'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6875rem', fontWeight: 900, color: 'white',
          }}>
            {getInitials(user?.name || 'Admin')}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onLogout}
            style={{ fontStyle: 'normal', gap: 6 }}
          >
            <LogOut size={13} />
            Logout
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main style={{ maxWidth: 1140, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Global Error Banner */}
        {fetchError && (
          <div style={{
            padding: '12px 18px', background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 10,
            marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} color="var(--destructive)" />
              <span style={{ fontSize: '0.8125rem', color: '#fca5a5', fontWeight: 600 }}>{fetchError}</span>
            </div>
            <button onClick={handleRefresh} className="btn btn-sm btn-primary" style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
              Retry Sync
            </button>
          </div>
        )}

        {/* Action Error / Success alerts */}
        {actionError && (
          <div style={{
            padding: '12px 18px', background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 10,
            marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--destructive)', fontWeight: 600 }}>{actionError}</span>
            <button onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {actionSuccess && (
          <div style={{
            padding: '12px 18px', background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: 10,
            marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color="var(--success)" />
              <span style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 600 }}>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB 1: OVERVIEW
        ══════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: '1.75rem' }}>Dashboard Overview</h1>
              <p style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                Real-time metrics, active athlete funding, and pending sports verifications.
              </p>
            </div>

            {/* Stat Cards */}
            <div className="grid-4 stagger" style={{ marginBottom: 32 }}>
              <StatCard
                icon={<Users size={20} />}
                label="Total Athletes"
                value={dashboard?.totalAthletes ?? athletes.length}
                color="#C2410C"
                delay={0}
                onClick={() => setActiveTab('verifications')}
              />
              <StatCard
                icon={<Activity size={20} />}
                label="Active Campaigns"
                value={dashboard?.activeRequests ?? campaigns.filter(c => c.lifecycleStatus === 'ACTIVE').length}
                color="#10B981"
                delay={60}
                onClick={() => setActiveTab('campaigns')}
              />
              <StatCard
                icon={<FileCheck size={20} />}
                label="Pending Verifications"
                value={pendingItems.length}
                color="#F59E0B"
                delay={120}
                onClick={() => setActiveTab('verifications')}
              />
              <StatCard
                icon={<Zap size={20} />}
                label="Total Platform Users"
                value={dashboard?.totalUsers ?? '30+'}
                color="#8B5CF6"
                delay={180}
              />
            </div>

            {/* Two column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24, alignItems: 'start' }}>
              {/* Left Column: Quick Verification Queue */}
              <div className="glass-card animate-slide-up">
                <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
                      Urgent Compliance Queue
                    </p>
                    <p style={{ marginTop: 4, fontSize: '1.25rem', fontWeight: 900, fontStyle: 'italic' }}>
                      {pendingItems.length} <span style={{ color: 'var(--muted-foreground)', fontStyle: 'normal', fontWeight: 500, fontSize: '0.75rem' }}>items awaiting review</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('verifications')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.6875rem', padding: '4px 10px' }}
                  >
                    View All Queue →
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  {pendingItems.length > 0 ? (
                    pendingItems.slice(0, 5).map((item: any) => {
                      const name = item.athleteName || item.entity?.athlete?.user?.name || item.entity?.user?.name || 'Athlete';
                      const title = item.notes || item.entity?.title || `${item.category} Verification`;
                      const isApproving = actionLoading[item.id] === 'approve';
                      const isRejecting = actionLoading[item.id] === 'reject';
                      return (
                        <div key={item.id} className="list-item" style={{ padding: '14px 18px' }}>
                          <div className="avatar" style={{ background: getAvatarColor(name) }}>
                            {getInitials(name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{name}</span>
                              <span className="badge badge-warning" style={{ fontSize: '0.625rem', padding: '2px 6px' }}>{item.category}</span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {title}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => setRejectionModalItem(item)}
                              disabled={isApproving || isRejecting}
                              style={{ padding: '5px 10px', fontSize: '0.6875rem' }}
                            >
                              Reject
                            </button>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleApprove(item.id)}
                              disabled={isApproving || isRejecting}
                              style={{ padding: '5px 12px', fontSize: '0.6875rem' }}
                            >
                              {isApproving ? 'Approving...' : 'Approve'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                      <CheckCircle size={36} color="var(--success)" style={{ margin: '0 auto 10px' }} />
                      <p style={{ color: 'var(--success)', fontWeight: 700 }}>All Caught Up!</p>
                      <p style={{ fontSize: '0.75rem', marginTop: 4 }}>No pending verification items in queue.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Recent Athletes & B2B Sponsorships */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Recent Athletes */}
                <div className="glass-card animate-slide-up">
                  <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Registered Athletes ({athletes.length})
                    </p>
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Talent Pool</span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {athletes.slice(0, 4).map((a) => (
                      <div key={a.id} className="list-item" style={{ padding: '12px 18px' }}>
                        <div className="avatar" style={{ background: getAvatarColor(a.user?.name || '') }}>
                          {getInitials(a.user?.name || 'Athlete')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{a.user?.name}</p>
                          <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{a.sport?.name} · {a.discipline || a.city || 'India'}</p>
                        </div>
                        <div>
                          {a.publicVerificationSummary ? (
                            <span className="badge badge-success" style={{ fontSize: '0.625rem' }}>Verified</span>
                          ) : (
                            <span className="badge badge-muted" style={{ fontSize: '0.625rem' }}>Unverified</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* B2B Sponsorships */}
                <div className="glass-card animate-slide-up">
                  <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Corporate Proposals ({sponsorships.length})
                    </p>
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>B2B Match</span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {sponsorships.slice(0, 3).map((s: any) => (
                      <div key={s.id} className="list-item" style={{ padding: '12px 18px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{s.sponsor?.organizationName || 'Sponsor'}</p>
                          <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>For {s.athlete?.user?.name} · {s.proposedAmount || s.supportType}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {s.status === 'ACCEPTED' ? (
                            <span className="badge badge-success" style={{ fontSize: '0.625rem' }}>Accepted</span>
                          ) : (
                            <button
                              onClick={() => handleUpdateSponsorshipStatus(s.id, 'ACCEPTED')}
                              className="btn btn-sm btn-success"
                              style={{ padding: '4px 8px', fontSize: '0.65rem' }}
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB 2: VERIFICATION CENTER
        ══════════════════════════════════════ */}
        {activeTab === 'verifications' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: '1.75rem' }}>Verification Queue</h1>
                <p style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                  Audit athlete identities, federation certificates, and crowdfunding campaigns before approval.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Search athlete or claim..."
                  value={verifSearch}
                  onChange={e => setVerifSearch(e.target.value)}
                  style={{
                    padding: '8px 14px', background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 8, color: '#fff', fontSize: '0.8125rem', width: 220
                  }}
                />
              </div>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['ALL', 'IDENTITY', 'ACHIEVEMENT', 'SUPPORT_NEED'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setVerifFilter(cat)}
                  className={`btn btn-sm ${verifFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '6px 14px' }}
                >
                  {cat === 'ALL' ? 'All Claims' : cat === 'IDENTITY' ? 'Identity & Profiles' : cat === 'ACHIEVEMENT' ? 'Achievements' : 'Campaigns'}
                  {cat === 'ALL' ? ` (${allVerifications.length})` : ` (${allVerifications.filter(v => v.category === cat).length})`}
                </button>
              ))}
            </div>

            {/* Verifications List */}
            <div className="glass-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                <span>Athlete & Claim Details</span>
                <span>Category</span>
                <span>Status</span>
                <span style={{ textAlign: 'right' }}>Actions</span>
              </div>

              {filteredVerifications.length > 0 ? (
                filteredVerifications.map((item: any) => {
                  const name = item.athleteName || item.entity?.athlete?.user?.name || item.entity?.user?.name || 'Athlete';
                  const title = item.notes || item.entity?.title || `${item.category} Verification Request`;
                  const isApproving = actionLoading[item.id] === 'approve';
                  const isPending = item.status === 'PENDING_REVIEW';
                  return (
                    <div key={item.id} className="list-item" style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="avatar" style={{ background: getAvatarColor(name) }}>
                          {getInitials(name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{title}</p>
                          {item.evidence && item.evidence.length > 0 && (
                            <button
                              onClick={() => setEvidenceModalItem(item)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.6875rem', fontWeight: 700, marginTop: 4, cursor: 'pointer' }}
                            >
                              <FileText size={12} /> {item.evidence.length} Evidence Attachment(s)
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="badge badge-primary" style={{ fontSize: '0.6875rem' }}>{item.category}</span>
                      </div>

                      <div>
                        {item.status === 'VERIFIED' && <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>✓ Verified</span>}
                        {item.status === 'PENDING_REVIEW' && <span className="badge badge-warning" style={{ fontSize: '0.6875rem' }}>⏳ In Review</span>}
                        {item.status === 'REJECTED' && <span className="badge badge-danger" style={{ fontSize: '0.6875rem' }}>✕ Rejected</span>}
                        {item.status === 'NEEDS_CORRECTION' && <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>⚠️ Correction</span>}
                        {item.status === 'NOT_SUBMITTED' && <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>Not Submitted</span>}
                      </div>

                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {isPending ? (
                          <>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setCorrectionModalItem(item)}
                              style={{ padding: '6px 10px', fontSize: '0.6875rem' }}
                            >
                              Correction
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => setRejectionModalItem(item)}
                              style={{ padding: '6px 12px', fontSize: '0.6875rem' }}
                            >
                              Reject
                            </button>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleApprove(item.id)}
                              disabled={isApproving}
                              style={{ padding: '6px 14px', fontSize: '0.6875rem' }}
                            >
                              {isApproving ? 'Approving...' : 'Approve'}
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Completed</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state" style={{ padding: '60px 20px' }}>
                  <FileCheck size={44} color="var(--muted-foreground)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: 700 }}>No verification requests found matching filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB 3: CAMPAIGNS
        ══════════════════════════════════════ */}
        {activeTab === 'campaigns' && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: '1.75rem' }}>Athlete Funding Campaigns</h1>
              <p style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                Review campaign budgets and unlock unapproved campaigns for public contributions.
              </p>
            </div>

            <div className="glass-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                <span>Campaign Title & Athlete</span>
                <span>Target & Raised</span>
                <span>Category</span>
                <span>Approval Status</span>
                <span style={{ textAlign: 'right' }}>Actions</span>
              </div>

              {campaigns.length > 0 ? (
                campaigns.map((camp: any) => {
                  const athleteName = camp.athlete?.user?.name || 'Athlete';
                  const isApproved = camp.approvalStatus === 'APPROVED';
                  const isCampLoading = actionLoading[`camp-${camp.id}`] === 'approve';
                  return (
                    <div key={camp.id} className="list-item" style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{camp.title}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>By {athleteName}</p>
                        {camp.budgetItems?.length > 0 && (
                          <p style={{ fontSize: '0.6875rem', color: 'var(--primary)', marginTop: 4 }}>
                            {camp.budgetItems.length} budget item(s) itemized
                          </p>
                        )}
                      </div>

                      <div>
                        <p style={{ fontWeight: 800, fontSize: '0.875rem' }}>{inr(camp.amountSupported || 0)}</p>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>Target: {inr(camp.targetAmount)}</p>
                      </div>

                      <div>
                        <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>{camp.category || 'EQUIPMENT'}</span>
                      </div>

                      <div>
                        {isApproved ? (
                          <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>✓ APPROVED</span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.6875rem' }}>⏳ {camp.approvalStatus || 'SUBMITTED'}</span>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {!isApproved ? (
                          <button
                            onClick={() => handleApproveCampaign(camp.id)}
                            disabled={isCampLoading}
                            className="btn btn-sm btn-success"
                            style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                          >
                            {isCampLoading ? 'Approving...' : 'Approve for Funding'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Active & Live</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state" style={{ padding: '60px 20px' }}>
                  <Activity size={44} color="var(--muted-foreground)" style={{ margin: '0 auto 12px' }} />
                  <p>No funding campaigns found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB 4: AUDIT TRAIL
        ══════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: '1.75rem' }}>Compliance Audit Trail</h1>
              <p style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                Immutable log of all administrative decisions, verifications, and financial operations.
              </p>
            </div>

            <div className="glass-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 2.5fr', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                <span>Timestamp</span>
                <span>Action</span>
                <span>Entity</span>
                <span>Details / Notes</span>
              </div>

              {auditLogs.length > 0 ? (
                auditLogs.map((log: any) => (
                  <div key={log.id} className="list-item" style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 2.5fr', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                      {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div>
                      <span className="badge badge-primary" style={{ fontSize: '0.6875rem' }}>{log.action}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {log.entityType} #{log.entityId}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.details || '—'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state" style={{ padding: '60px 20px' }}>
                  <Shield size={44} color="var(--muted-foreground)" style={{ margin: '0 auto 12px' }} />
                  <p>No audit log entries recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════
          MODAL: REJECT WITH MANDATORY REASON (Instruction 6.5)
      ══════════════════════════════════════ */}
      {rejectionModalItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="glass-card animate-slide-up" style={{ maxWidth: 480, width: '100%', padding: 24, background: '#171717', border: '1px solid var(--border-strong)' }}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: 6, color: 'var(--destructive)' }}>Reject Verification Claim</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: 16 }}>
              Instruction 6.5 mandates recording a clear rejection reason in the audit log for athlete: <strong>{rejectionModalItem.athleteName || 'Athlete'}</strong>.
            </p>

            <textarea
              placeholder="e.g. Uploaded government ID document has expired, or tournament certificate lacks official federation stamp."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={4}
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--background)',
                border: '1px solid var(--border)', borderRadius: 8, color: '#fff', fontSize: '0.8125rem',
                resize: 'none', marginBottom: 16
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setRejectionModalItem(null); setRejectionReason(''); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL: REQUEST CORRECTION
      ══════════════════════════════════════ */}
      {correctionModalItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="glass-card animate-slide-up" style={{ maxWidth: 480, width: '100%', padding: 24, background: '#171717', border: '1px solid var(--border-strong)' }}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: 6, color: 'var(--warning)' }}>Request Document Correction</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: 16 }}>
              Provide clear feedback for the athlete to upload corrected evidence (moves state to NEEDS_CORRECTION):
            </p>

            <textarea
              placeholder="e.g. Please upload front and back of national ID with higher resolution, or include federation receipt."
              value={correctionNotes}
              onChange={e => setCorrectionNotes(e.target.value)}
              rows={4}
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--background)',
                border: '1px solid var(--border)', borderRadius: 8, color: '#fff', fontSize: '0.8125rem',
                resize: 'none', marginBottom: 16
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setCorrectionModalItem(null); setCorrectionNotes(''); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning btn-sm"
                onClick={handleConfirmCorrection}
                disabled={!correctionNotes.trim()}
              >
                Send Correction Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL: EVIDENCE ATTACHMENT VIEWER
      ══════════════════════════════════════ */}
      {evidenceModalItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="glass-card animate-slide-up" style={{ maxWidth: 540, width: '100%', padding: 24, background: '#171717', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.125rem', margin: 0 }}>Submitted Verification Evidence</h3>
              <button onClick={() => setEvidenceModalItem(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: 16 }}>
              Claim for: <strong>{evidenceModalItem.athleteName || 'Athlete'}</strong> ({evidenceModalItem.category})
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
              {evidenceModalItem.evidence?.map((ev: any, idx: number) => {
                return (
                  <div key={idx} style={{ padding: '12px 14px', background: 'var(--background)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={18} color="var(--primary)" />
                      <div>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{ev.evidenceType || 'DOCUMENT'}</p>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{ev.originalFilename || ev.privateStorageKey || 'Document'}</p>
                      </div>
                    </div>
                    {ev.sourceUrl ? (
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.6875rem' }}
                      >
                        Open Link ↗
                      </a>
                    ) : ev.id ? (
                      <a
                        href={`${API_URL}/verifications/evidence/${ev.id}/file?token=${getAdminToken() || ''}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.6875rem' }}
                      >
                        View Vault File ↗
                      </a>
                    ) : ev.privateStorageKey ? (
                      <a
                        href={`${API_URL}/verifications/documents/${ev.privateStorageKey}?token=${getAdminToken() || ''}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.6875rem' }}
                      >
                        View Vault File ↗
                      </a>
                    ) : (
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Private Vault</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEvidenceModalItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   ROOT APP
══════════════════════════════════════ */
export default function App() {
  const [token, setToken] = useState<string>(getAdminToken() || '');
  const [user, setUser] = useState<User | null>(() => getAdminUser());

  useEffect(() => {
    const handleAdminLogout = () => {
      setToken('');
      setUser(null);
    };
    window.addEventListener('admin-logout', handleAdminLogout);
    return () => window.removeEventListener('admin-logout', handleAdminLogout);
  }, []);

  const handleLogin = (t: string, u: User) => {
    setToken(t);
    setUser(u);
  };

  const handleLogout = () => {
    clearAdminAuth();
    setToken('');
    setUser(null);
  };

  if (!token || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
