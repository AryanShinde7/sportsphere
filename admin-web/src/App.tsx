import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Activity, FileCheck, LogOut,
  CheckCircle, XCircle, Clock, ChevronRight, Zap, Briefcase
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
  type User,
} from './api';

const AVATAR_COLORS = [
  '#C2410C', '#0891B2', '#7C3AED', '#059669',
  '#DB2777', '#CA8A04', '#2563EB', '#0D9488',
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
    } catch {
      setError('Invalid credentials. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="login-screen animate-fade-in">
      {/* Ambient glows */}
      <div className="glow-tr" />
      <div className="glow-bl" />

      {/* Extra center glow behind the card */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(194,65,12,0.08), transparent)',
      }} />

      <div className="login-container animate-slide-up" style={{ animationDelay: '80ms' }}>

        {/* Brand */}
        <div className="login-brand">
          <div className="brand-name">
            <span className="brand-white">SPORT</span>
            <span className="brand-accent">SPHERE</span>
          </div>
        </div>
        <p className="login-tagline">Admin Portal · Verified Athlete Platform</p>

        {/* Card */}
        <div className="login-card">
          <p className="card-label">Sign in to your account</p>

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
                <><Shield size={16} /> Sign In</>
              )}
            </button>
          </form>
        </div>

        {/* Demo hint */}
        <p className="login-hint">Demo: admin@sportsphere.com · password123</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   STAT CARD
══════════════════════════════════════ */
function StatCard({ icon, label, value, color, delay = 0 }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  delay?: number;
}) {
  return (
    <div className="stat-card animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
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
   VERIFICATION ITEM
══════════════════════════════════════ */
function VerificationItem({
  item,
  onDecision,
  actionLoading,
}: {
  item: any;
  onDecision: (id: number, d: 'approve' | 'reject') => Promise<void>;
  actionLoading?: 'approve' | 'reject' | null;
}) {
  const name =
    item.athleteName ||
    item.athlete?.user?.name ||
    item.entity?.athlete?.user?.name ||
    item.entity?.user?.name ||
    'Unknown Athlete';
  const color = getAvatarColor(name);
  const sport =
    item.entity?.athlete?.discipline ||
    item.entity?.discipline ||
    item.athlete?.sport?.name ||
    item.category ||
    'Athlete';
  const title =
    item.title ||
    item.entity?.title ||
    item.entity?.description ||
    `${item.category || 'Item'} Verification`;

  const isRejecting = actionLoading === 'reject';
  const isApproving = actionLoading === 'approve';
  const isPendingAction = isRejecting || isApproving;

  return (
    <div className="list-item animate-fade-in">
      <div className="avatar" style={{ background: color }}>
        {getInitials(name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
          {name} · {sport}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
        <button
          id={`reject-btn-${item.id}`}
          className="btn btn-sm btn-danger"
          onClick={() => onDecision(item.id, 'reject')}
          disabled={isPendingAction}
          style={{
            fontStyle: 'normal',
            padding: '6px 12px',
            opacity: isPendingAction ? 0.6 : 1,
            cursor: isPendingAction ? 'not-allowed' : 'pointer',
          }}
        >
          {isRejecting ? (
            <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
          ) : (
            <XCircle size={13} />
          )}
          {isRejecting ? 'Rejecting...' : 'Reject'}
        </button>
        <button
          id={`approve-btn-${item.id}`}
          className="btn btn-sm btn-success"
          onClick={() => onDecision(item.id, 'approve')}
          disabled={isPendingAction}
          style={{
            fontStyle: 'normal',
            padding: '6px 14px',
            opacity: isPendingAction ? 0.6 : 1,
            cursor: isPendingAction ? 'not-allowed' : 'pointer',
          }}
        >
          {isApproving ? (
            <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
          ) : (
            <CheckCircle size={13} />
          )}
          {isApproving ? 'Approving...' : 'Approve'}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   ATHLETE ROW (recent)
══════════════════════════════════════ */
function AthleteRow({ athlete, index }: { athlete: any; index: number }) {
  const name = athlete.user?.name || 'Unknown';
  const color = getAvatarColor(name);
  const req = athlete.supportRequests?.[0];
  const rawPct = req && req.targetAmount > 0
    ? Math.round((req.amountSupported / req.targetAmount) * 100)
    : 0;
  const barFill = Math.min(Math.max(rawPct, req && req.amountSupported > 0 ? 3 : 0), 100);

  return (
    <div className="list-item" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="avatar" style={{ background: color, fontSize: '0.75rem' }}>
        {getInitials(name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>
          {name}
        </p>
        <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>
          {athlete.sport?.name} · {athlete.discipline}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {req ? (
          <>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
              {rawPct}% funded
            </p>
            <div className="progress-bar" style={{ width: 80 }}>
              <div className="progress-fill" style={{ width: `${barFill}%` }} />
            </div>
          </>
        ) : (
          <span className="badge badge-muted">No request</span>
        )}
      </div>
      <ChevronRight size={14} color="var(--muted-foreground)" style={{ marginLeft: 8, flexShrink: 0 }} />
    </div>
  );
}

/* ══════════════════════════════════════
   SPONSORSHIP PROPOSAL ROW
══════════════════════════════════════ */
function SponsorshipRow({
  item,
  onUpdateStatus,
  updating,
}: {
  item: any;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  updating: boolean;
}) {
  const sponsorName = item.sponsor?.organizationName || item.sponsor?.user?.name || 'Corporate Sponsor';
  const sponsorEmail = item.sponsor?.user?.email;
  const athleteName = item.athlete?.user?.name || 'Athlete';
  const sport = item.athlete?.sport?.name || 'Sport';
  const status = item.status || 'SUBMITTED';

  const getStatusBadge = () => {
    switch (status) {
      case 'ACCEPTED':
        return <span className="badge badge-success" style={{ padding: '3px 8px', fontSize: '0.6875rem' }}>Accepted</span>;
      case 'DECLINED':
        return <span className="badge badge-danger" style={{ padding: '3px 8px', fontSize: '0.6875rem' }}>Declined</span>;
      case 'REVIEWING':
        return <span className="badge badge-warning" style={{ padding: '3px 8px', fontSize: '0.6875rem' }}>Reviewing</span>;
      default:
        return <span className="badge badge-muted" style={{ padding: '3px 8px', fontSize: '0.6875rem' }}>Submitted</span>;
    }
  };

  return (
    <div className="list-item animate-fade-in" style={{ padding: '16px 20px', alignItems: 'flex-start' }}>
      <div className="avatar" style={{ background: '#0F172A', color: '#fff', fontSize: '0.75rem', marginTop: 2 }}>
        💼
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p style={{ fontWeight: 800, fontSize: '0.9375rem', margin: 0 }}>
            {sponsorName}
          </p>
          {getStatusBadge()}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: 6 }}>
          Target: <strong style={{ color: 'var(--foreground)' }}>{athleteName}</strong> ({sport})
          {sponsorEmail ? ` · Contact: ${sponsorEmail}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
            Type: {item.supportType || 'FINANCIAL'}
          </span>
          {item.proposedAmount && (
            <span style={{ fontWeight: 700 }}>
              Amount: {item.proposedAmount}
            </span>
          )}
          {item.duration && (
            <span style={{ color: 'var(--muted-foreground)' }}>
              Duration: {item.duration}
            </span>
          )}
        </div>
        {item.message && (
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6, margin: 0 }}>
            "{item.message}"
          </p>
        )}
      </div>

      {/* Action controls */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 4 }}>
        {status !== 'REVIEWING' && status !== 'ACCEPTED' && (
          <button
            id={`review-sponsor-btn-${item.id}`}
            className="btn btn-sm btn-secondary"
            onClick={() => onUpdateStatus(item.id, 'REVIEWING')}
            disabled={updating}
            style={{ fontSize: '0.6875rem', padding: '5px 10px' }}
          >
            Review
          </button>
        )}
        {status !== 'ACCEPTED' && (
          <button
            id={`accept-sponsor-btn-${item.id}`}
            className="btn btn-sm btn-success"
            onClick={() => onUpdateStatus(item.id, 'ACCEPTED')}
            disabled={updating}
            style={{ fontSize: '0.6875rem', padding: '5px 10px' }}
          >
            Accept
          </button>
        )}
        {status !== 'DECLINED' && (
          <button
            id={`decline-sponsor-btn-${item.id}`}
            className="btn btn-sm btn-danger"
            onClick={() => onUpdateStatus(item.id, 'DECLINED')}
            disabled={updating}
            style={{ fontSize: '0.6875rem', padding: '5px 10px' }}
          >
            Decline
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DASHBOARD HOME
══════════════════════════════════════ */
function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<Record<number, 'approve' | 'reject'>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, 'approve' | 'reject'>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [sponsorships, setSponsorships] = useState<any[]>([]);
  const [updatingSponsorId, setUpdatingSponsorId] = useState<number | null>(null);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [dashRes, athRes, sponRes] = await Promise.all([
        adminApi.getDashboard(),
        athletesApi.getAll(),
        adminApi.getSponsorshipInterests(),
      ]);
      setDashboard(dashRes);
      setAthletes(athRes.slice(0, 5));
      setSponsorships(sponRes || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handleUpdateSponsorshipStatus = async (id: number, newStatus: string) => {
    setUpdatingSponsorId(id);
    try {
      await adminApi.updateSponsorshipInterest(id, newStatus);
      const updatedList = await adminApi.getSponsorshipInterests();
      setSponsorships(updatedList);
    } catch (err) {
      console.error('Failed to update sponsorship status:', err);
    } finally {
      setUpdatingSponsorId(null);
    }
  };

  const handleDecision = async (id: number, decision: 'approve' | 'reject') => {
    setActionLoading(prev => ({ ...prev, [id]: decision }));
    setActionError(null);
    setActionSuccess(null);
    try {
      if (decision === 'approve') {
        await adminApi.approveVerification(id, 'Approved via admin dashboard');
      } else {
        await adminApi.rejectVerification(id, 'Rejected via admin dashboard');
      }

      setDecisions(d => ({ ...d, [id]: decision }));

      // Re-fetch dashboard data to refresh counts and list from DB
      const updatedDash = await adminApi.getDashboard();
      setDashboard(updatedDash);
      setActionSuccess(`Verification item #${id} has been ${decision === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (err: any) {
      console.error(`Verification ${decision} failed:`, err);
      const errMsg =
        err.response?.data?.error ||
        `Failed to ${decision} verification #${id}. Check server connection.`;
      setActionError(errMsg);
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const pendingItems = dashboard?.pendingVerifications?.filter((item: any) => !decisions[item.id]) || [];
  const pendingCount = pendingItems.length;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)' }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
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
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={18} color="var(--primary)" />
          <span style={{
            fontSize: '0.875rem', fontWeight: 900, letterSpacing: '0.1em',
            textTransform: 'uppercase', fontStyle: 'italic',
          }}>
            <span style={{ color: 'var(--foreground)' }}>SPORT</span>
            <span style={{ color: 'var(--primary)' }}>SPHERE</span>
          </span>
          <span style={{
            marginLeft: 8, padding: '2px 10px',
            background: 'var(--primary-subtle)', border: '1px solid rgba(194,65,12,0.3)',
            borderRadius: 999, fontSize: '0.5625rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)',
          }}>Admin</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="live-dot" />
            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</span>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: getAvatarColor(user?.name || 'Admin'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6875rem', fontWeight: 900, color: 'white', fontStyle: 'italic',
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

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 32px 80px' }}>

        {/* Page title */}
        <div className="page-header animate-fade-in">
          <h1 style={{ fontSize: '1.75rem' }}>Dashboard Overview</h1>
          <p style={{ marginTop: 6, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
            Welcome back, {user?.name}. Here's what needs your attention.
          </p>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="grid-4 stagger" style={{ marginBottom: 36 }}>
          <StatCard
            icon={<Users size={20} />}
            label="Total Athletes"
            value={dashboard?.totalAthletes ?? '—'}
            color="#C2410C"
            delay={0}
          />
          <StatCard
            icon={<Activity size={20} />}
            label="Active Requests"
            value={dashboard?.activeRequests ?? '—'}
            color="#10B981"
            delay={60}
          />
          <StatCard
            icon={<FileCheck size={20} />}
            label="Pending Verifications"
            value={pendingCount}
            color="#F59E0B"
            delay={120}
          />
          <StatCard
            icon={<Zap size={20} />}
            label="Total Users"
            value={dashboard?.totalUsers ?? '—'}
            color="#8B5CF6"
            delay={180}
          />
        </div>

        {/* ── BOTTOM GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* Pending Verifications */}
          <div className="glass-card animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
                  Pending Action Items
                </p>
                <p style={{ marginTop: 4, fontSize: '1.25rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em' }}>
                  {pendingCount} <span style={{ color: 'var(--muted-foreground)', fontStyle: 'normal', fontWeight: 500, fontSize: '0.75rem' }}>to review</span>
                </p>
              </div>
              {pendingCount > 0 && (
                <span className="badge badge-warning" style={{ padding: '4px 10px' }}>
                  <Clock size={10} />
                  Urgent
                </span>
              )}
            </div>

            {actionError && (
              <div
                style={{
                  margin: '12px 20px 0',
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--destructive)', fontWeight: 600 }}>
                  {actionError}
                </span>
                <button
                  onClick={() => setActionError(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 2 }}
                >
                  ✕
                </button>
              </div>
            )}

            {actionSuccess && (
              <div
                style={{
                  margin: '12px 20px 0',
                  padding: '10px 14px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                  {actionSuccess}
                </span>
                <button
                  onClick={() => setActionSuccess(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 2 }}
                >
                  ✕
                </button>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              {pendingCount > 0 ? (
                pendingItems.slice(0, 5).map((item: any) => (
                  <VerificationItem
                    key={item.id}
                    item={item}
                    onDecision={handleDecision}
                    actionLoading={actionLoading[item.id]}
                  />
                ))
              ) : (
                <div className="empty-state" style={{ padding: '40px 24px' }}>
                  <CheckCircle size={40} color="var(--success)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--success)', fontWeight: 700 }}>All caught up!</p>
                  <p style={{ marginTop: 4, fontSize: '0.75rem' }}>No items pending verification.</p>
                </div>
              )}
            </div>

            {/* Decisions made */}
            {Object.keys(decisions).length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16 }}>
                {Object.values(decisions).filter(d => d === 'approve').length > 0 && (
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--success)' }}>
                    <CheckCircle size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {Object.values(decisions).filter(d => d === 'approve').length} Approved
                  </span>
                )}
                {Object.values(decisions).filter(d => d === 'reject').length > 0 && (
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--destructive)' }}>
                    <XCircle size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {Object.values(decisions).filter(d => d === 'reject').length} Rejected
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Recent Athletes */}
          <div className="glass-card animate-slide-up" style={{ animationDelay: '260ms' }}>
            <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
                  Athlete Directory
                </p>
                <p style={{ marginTop: 4, fontSize: '1.25rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em' }}>
                  {athletes.length} <span style={{ color: 'var(--muted-foreground)', fontStyle: 'normal', fontWeight: 500, fontSize: '0.75rem' }}>recent</span>
                </p>
              </div>
              <span className="badge badge-primary">
                <Activity size={9} />
                Live
              </span>
            </div>

            <div style={{ marginTop: 12 }}>
              {athletes.length > 0 ? (
                athletes.map((a: any, i: number) => (
                  <AthleteRow key={a.id} athlete={a} index={i} />
                ))
              ) : (
                <div className="empty-state">
                  <Users size={40} style={{ margin: '0 auto 12px' }} />
                  <p>No athletes found.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── SPONSORSHIP PROPOSALS ── */}
        <div className="glass-card animate-slide-up" style={{ marginTop: 24, animationDelay: '300ms' }}>
          <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
                Sponsor Management
              </p>
              <p style={{ marginTop: 4, fontSize: '1.25rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em' }}>
                {sponsorships.length} <span style={{ color: 'var(--muted-foreground)', fontStyle: 'normal', fontWeight: 500, fontSize: '0.75rem' }}>proposals</span>
              </p>
            </div>
            <span className="badge badge-primary">
              <Briefcase size={10} />
              B2B Sponsors
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            {sponsorships.length > 0 ? (
              sponsorships.map((s: any) => (
                <SponsorshipRow
                  key={s.id}
                  item={s}
                  onUpdateStatus={handleUpdateSponsorshipStatus}
                  updating={updatingSponsorId === s.id}
                />
              ))
            ) : (
              <div className="empty-state" style={{ padding: '36px 20px' }}>
                <Briefcase size={36} color="var(--muted-foreground)" style={{ margin: '0 auto 10px' }} />
                <p>No corporate sponsorship proposals received yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ══════════════════════════════════════
   ROOT APP
══════════════════════════════════════ */
export default function App() {
  const [token, setToken] = useState<string>(getAdminToken() || '');
  const [user, setUser] = useState<User | null>(() => getAdminUser());

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
