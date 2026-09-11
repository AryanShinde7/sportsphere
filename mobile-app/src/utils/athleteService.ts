import api from './api';

export type VerificationStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'NEEDS_CORRECTION'
  | 'REJECTED';

export interface Sport {
  id: number;
  name: string;
  category?: string;
}

export interface Achievement {
  id: number;
  athleteId: number;
  title: string;
  competition?: string;
  event?: string;
  position?: string;
  score?: string;
  date?: string;
  evidenceFileId?: string;
  verificationStatus: VerificationStatus;
  reviewNotes?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AthleteProfile {
  id: number;
  userId: number;
  sportId?: number;
  sport?: Sport;
  discipline?: string;
  currentLevel?: string;
  ageGroup?: string;
  city?: string;
  state?: string;
  bio?: string;
  coachName?: string;
  academyName?: string;
  yearsActive?: number;
  currentGoal?: string;
  supportSummary?: string;
  publicVerificationSummary?: string;
  profileVerificationStatus?: VerificationStatus;
  profileReviewNotes?: string;
  achievements?: Achievement[];
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    name: string;
    email: string;
    profileImageUrl?: string;
    role: string;
  };
}

export interface ProfileDraft {
  // Step 1
  fullName?: string;
  // Step 2
  sportId?: number;
  sportName?: string;
  discipline?: string;
  currentLevel?: string;
  ageGroup?: string;
  // Step 3
  city?: string;
  state?: string;
  academyName?: string;
  coachName?: string;
  yearsActive?: string;
  // Step 4
  bio?: string;
  currentGoal?: string;
  supportSummary?: string;
  // Step 5
  profileImageUri?: string;
}

// ── Sports ──────────────────────────────────────────────────

export const fetchSports = async (): Promise<Sport[]> => {
  const res = await api.get('/sports');
  return res.data;
};

// ── Athlete Profile ──────────────────────────────────────────

export const fetchMyProfile = async (): Promise<AthleteProfile> => {
  const res = await api.get('/athletes/me');
  return res.data;
};

export const createAthleteProfile = async (data: {
  sportId?: number;
  discipline?: string;
  currentLevel?: string;
  ageGroup?: string;
  city?: string;
  state?: string;
  bio?: string;
  coachName?: string;
  academyName?: string;
  yearsActive?: number;
  currentGoal?: string;
  supportSummary?: string;
}): Promise<AthleteProfile> => {
  const res = await api.post('/athletes/profile', data);
  return res.data.profile;
};

export const updateAthleteProfile = async (data: Partial<{
  sportId?: number;
  discipline?: string;
  currentLevel?: string;
  ageGroup?: string;
  city?: string;
  state?: string;
  bio?: string;
  coachName?: string;
  academyName?: string;
  yearsActive?: number;
  currentGoal?: string;
  supportSummary?: string;
}>): Promise<AthleteProfile> => {
  const res = await api.put('/athletes/profile', data);
  return res.data.profile;
};

export const submitProfileForVerification = async (): Promise<void> => {
  await api.post('/athletes/profile/submit-verification');
};

export const updateProfileImage = async (profileImageUrl: string): Promise<string> => {
  const res = await api.put('/auth/profile-image', { profileImageUrl });
  return res.data.profileImageUrl;
};

// ── Achievements ─────────────────────────────────────────────

export const fetchMyAchievements = async (): Promise<Achievement[]> => {
  const res = await api.get('/achievements/me');
  return res.data;
};

export const fetchAthleteAchievements = async (athleteId: number): Promise<Achievement[]> => {
  const res = await api.get(`/athletes/${athleteId}/achievements`);
  return res.data;
};

export const createAchievement = async (data: {
  title: string;
  competition?: string;
  event?: string;
  position?: string;
  score?: string;
  date?: string;
}): Promise<Achievement> => {
  const res = await api.post('/achievements', data);
  return res.data.achievement;
};

export const updateAchievement = async (
  id: number,
  data: Partial<{
    title: string;
    competition: string;
    event: string;
    position: string;
    score: string;
    date: string;
    evidenceFileId: string;
  }>
): Promise<Achievement> => {
  const res = await api.put(`/achievements/${id}`, data);
  return res.data.achievement;
};

export const deleteAchievement = async (id: number): Promise<void> => {
  await api.delete(`/achievements/${id}`);
};

export const submitAchievementForVerification = async (id: number): Promise<Achievement> => {
  const res = await api.post(`/achievements/${id}/submit-verification`);
  return res.data.achievement;
};

export const uploadAchievementEvidence = async (
  id: number,
  data: { evidenceFileId: string; fileName?: string; fileType?: string }
): Promise<Achievement> => {
  const res = await api.post(`/achievements/${id}/evidence`, data);
  return res.data.achievement;
};

// ── Profile Completion ────────────────────────────────────────

export interface CompletionResult {
  percentage: number;
  completed: string[];
  missing: string[];
}

export const calculateProfileCompletion = (
  profile: Partial<AthleteProfile> | null,
  achievements: Achievement[],
  hasProfileImage: boolean
): CompletionResult => {
  const checks: { key: string; label: string; done: boolean }[] = [
    { key: 'sport', label: 'Sport selected', done: !!profile?.sportId },
    { key: 'discipline', label: 'Discipline / event', done: !!profile?.discipline },
    { key: 'location', label: 'City & state', done: !!(profile?.city && profile?.state) },
    { key: 'bio', label: 'Short biography', done: !!profile?.bio && (profile.bio?.length ?? 0) > 20 },
    { key: 'goal', label: 'Current objective', done: !!profile?.currentGoal },
    { key: 'photo', label: 'Profile photo', done: hasProfileImage },
    { key: 'affiliation', label: 'Coach or academy', done: !!(profile?.coachName || profile?.academyName) },
    { key: 'achievement', label: 'At least one achievement', done: achievements.length > 0 },
    {
      key: 'evidence',
      label: 'Achievement evidence uploaded',
      done: achievements.some((a) => !!a.evidenceFileId),
    },
  ];

  const completed = checks.filter((c) => c.done).map((c) => c.label);
  const missing = checks.filter((c) => !c.done).map((c) => c.label);
  const percentage = Math.round((completed.length / checks.length) * 100);

  return { percentage, completed, missing };
};
