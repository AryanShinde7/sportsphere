import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  fetchMyProfile,
  fetchMyAchievements,
  submitAchievementForVerification,
  uploadAchievementEvidence,
  type AthleteProfile,
  type Achievement,
  type VerificationStatus,
} from '../../utils/athleteService';
import VerificationStatusChip, { STATUS_CONFIG } from '../../components/onboarding/VerificationStatusChip';
import EvidenceUpload from '../../components/onboarding/EvidenceUpload';

const PRIMARY = '#E2550B';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

type VerificationCategory = {
  key: string;
  label: string;
  icon: string;
  status: VerificationStatus;
  description: string;
};

export default function VerificationCenterScreen() {
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [p, a] = await Promise.all([
        fetchMyProfile(),
        fetchMyAchievements(),
      ]);
      setProfile(p);
      setAchievements(a);
    } catch (e: any) {
      console.warn('Verification center load error:', e.message);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const handleSubmitAchievement = async (ach: Achievement) => {
    if (!ach.evidenceFileId) {
      Alert.alert('Upload Evidence First', 'You must upload evidence before submitting for verification.');
      return;
    }
    setSubmittingId(ach.id);
    try {
      const updated = await submitAchievementForVerification(ach.id);
      setAchievements(prev => prev.map(a => a.id === updated.id ? updated : a));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSubmittingId(null);
  };

  const handleEvidenceUpload = async (
    ach: Achievement,
    uri: string,
    fileName: string,
    fileType: string
  ) => {
    const updated = await uploadAchievementEvidence(ach.id, { evidenceFileId: uri, fileName, fileType });
    setAchievements(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={s.loadingTxt}>Loading verification status...</Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.noProfileIcon}>🛡️</Text>
        <Text style={s.noProfileTitle}>No Profile Found</Text>
        <Text style={s.noProfileSub}>Complete your athlete profile first.</Text>
        <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/onboarding')} activeOpacity={0.85}>
          <Text style={s.ctaBtnTxt}>Create Profile →</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const profileStatus = (profile.profileVerificationStatus || 'NOT_SUBMITTED') as VerificationStatus;
  const affiliationStatus: VerificationStatus =
    (profile.coachName || profile.academyName) && profileStatus === 'VERIFIED'
      ? 'VERIFIED'
      : profileStatus === 'PENDING_REVIEW'
      ? 'PENDING_REVIEW'
      : 'NOT_SUBMITTED';

  const categories: VerificationCategory[] = [
    {
      key: 'identity',
      label: 'Identity',
      icon: '👤',
      status: profileStatus,
      description: STATUS_CONFIG[profileStatus]?.description || '',
    },
    {
      key: 'affiliation',
      label: 'Athlete Affiliation',
      icon: '🏫',
      status: affiliationStatus,
      description: STATUS_CONFIG[affiliationStatus]?.description || '',
    },
  ];

  const verifiedCount = achievements.filter(a => a.verificationStatus === 'VERIFIED').length;
  const pendingCount = achievements.filter(a => a.verificationStatus === 'PENDING_REVIEW').length;
  const correctionCount = achievements.filter(a => a.verificationStatus === 'NEEDS_CORRECTION').length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Verification Center</Text>
          <Text style={s.headerSub}>
            {verifiedCount} verified · {pendingCount} pending · {correctionCount} need correction
          </Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} colors={[PRIMARY]} />
        }
      >
        {/* Edit profile CTA */}
        <TouchableOpacity
          style={s.editProfileBtn}
          onPress={() => router.push('/onboarding')}
          activeOpacity={0.85}
        >
          <Text style={s.editProfileBtnTxt}>✏️ Edit Profile & Achievements</Text>
        </TouchableOpacity>

        {/* ── Profile Verification Categories ── */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>PROFILE VERIFICATION</Text>
          {categories.map(cat => (
            <View key={cat.key} style={s.categoryRow}>
              <View style={s.categoryLeft}>
                <Text style={s.categoryIcon}>{cat.icon}</Text>
                <View style={s.categoryText}>
                  <Text style={s.categoryLabel}>{cat.label}</Text>
                  <Text style={s.categoryDesc}>{cat.description}</Text>
                </View>
              </View>
              <VerificationStatusChip status={cat.status} size="sm" />
            </View>
          ))}

          {/* Correction note for profile */}
          {profileStatus === 'NEEDS_CORRECTION' && profile.profileReviewNotes && (
            <CorrectionNote note={profile.profileReviewNotes} />
          )}
        </View>

        {/* ── Achievement Verifications ── */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>ACHIEVEMENT VERIFICATION</Text>

          {achievements.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>🏆</Text>
              <Text style={s.emptyTitle}>No achievements added</Text>
              <Text style={s.emptySub}>Add achievements in your profile to submit for verification.</Text>
              <TouchableOpacity
                style={[s.ctaBtn, { marginTop: 12 }]}
                onPress={() => router.push('/onboarding')}
                activeOpacity={0.85}
              >
                <Text style={s.ctaBtnTxt}>Add Achievement →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {achievements.map(ach => (
                <AchievementVerificationItem
                  key={ach.id}
                  achievement={ach}
                  isSubmitting={submittingId === ach.id}
                  onSubmit={() => handleSubmitAchievement(ach)}
                  onEvidenceUpload={(uri, fn, ft) => handleEvidenceUpload(ach, uri, fn, ft)}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Verification Summary ── */}
        <View style={s.summaryCard}>
          <Text style={s.sectionTitle}>HOW VERIFICATION WORKS</Text>
          <Text style={s.summaryTxt}>
            SportSphere performs manual admin review of submitted evidence. We verify achievements, affiliations, and identity through official documents and result sheets.
          </Text>
          <Text style={s.summaryTxt}>
            Verification decisions are made by the SportSphere team and cannot be self-approved.
          </Text>
          <View style={s.statesList}>
            {(Object.keys(STATUS_CONFIG) as VerificationStatus[]).map(status => {
              const cfg = STATUS_CONFIG[status];
              return (
                <View key={status} style={s.stateRow}>
                  <Text style={[s.stateIcon, { color: cfg.color }]}>{cfg.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.stateLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    <Text style={s.stateDesc}>{cfg.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Achievement verification item ───────────────────────────

function AchievementVerificationItem({
  achievement,
  isSubmitting,
  onSubmit,
  onEvidenceUpload,
}: {
  achievement: Achievement;
  isSubmitting: boolean;
  onSubmit: () => void;
  onEvidenceUpload: (uri: string, fileName: string, fileType: string) => Promise<void>;
}) {
  const status = achievement.verificationStatus;
  const canSubmit = status === 'NOT_SUBMITTED' || status === 'NEEDS_CORRECTION';

  return (
    <View style={s.achItem}>
      {/* Header */}
      <View style={s.achItemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.achItemTitle} numberOfLines={2}>{achievement.title}</Text>
          {achievement.competition && (
            <Text style={s.achItemMeta}>{achievement.competition}</Text>
          )}
          {achievement.date && (
            <Text style={s.achItemMeta}>{achievement.date}</Text>
          )}
        </View>
        <VerificationStatusChip status={status} />
      </View>

      {/* Correction note */}
      {status === 'NEEDS_CORRECTION' && achievement.reviewNotes && (
        <CorrectionNote note={achievement.reviewNotes} />
      )}

      {/* Status description */}
      <View style={s.achStatusDesc}>
        <VerificationStatusChip status={status} showDescription size="sm" />
      </View>

      {/* Evidence upload */}
      {status !== 'VERIFIED' && status !== 'REJECTED' && (
        <View style={s.evidenceSection}>
          <Text style={s.evidenceLabel}>EVIDENCE</Text>
          <EvidenceUpload
            achievement={achievement}
            disabled={status === 'PENDING_REVIEW'}
            onEvidenceUploaded={onEvidenceUpload}
          />
        </View>
      )}

      {/* Submit / Resubmit button */}
      {canSubmit && (
        <TouchableOpacity
          style={[
            s.submitAchBtn,
            (!achievement.evidenceFileId || isSubmitting) && { opacity: 0.5 }
          ]}
          onPress={onSubmit}
          disabled={!achievement.evidenceFileId || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.submitAchBtnTxt}>
              {status === 'NEEDS_CORRECTION' ? '↑ Fix & Resubmit' : '↑ Submit for Verification'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {!achievement.evidenceFileId && canSubmit && (
        <Text style={s.evidenceWarning}>⚠ Upload evidence before submitting.</Text>
      )}
    </View>
  );
}

function CorrectionNote({ note }: { note: string }) {
  return (
    <View style={s.correctionNote}>
      <Text style={s.correctionNoteLabel}>⚠ Admin note:</Text>
      <Text style={s.correctionNoteText}>"{note}"</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingTxt: { color: TEXT_DIM, fontSize: 14, fontWeight: '600' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  backTxt: { fontSize: 14, fontWeight: '700', color: TEXT_DIM, width: 50 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: TEXT_MAIN },
  headerSub: { fontSize: 11, color: TEXT_FAINT, fontWeight: '500', marginTop: 1 },

  content: {
    padding: 16,
    gap: 14,
    maxWidth: 540,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },

  editProfileBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editProfileBtnTxt: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: TEXT_DIM,
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  // Profile categories
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  categoryLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  categoryIcon: { fontSize: 20, marginTop: 1 },
  categoryText: { flex: 1 },
  categoryLabel: { fontSize: 14, fontWeight: '800', color: TEXT_MAIN },
  categoryDesc: { fontSize: 12, color: TEXT_DIM, marginTop: 2 },

  correctionNote: {
    margin: 14,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  correctionNoteLabel: { fontSize: 11, fontWeight: '900', color: '#EA580C', letterSpacing: 0.5 },
  correctionNoteText: { fontSize: 13, color: '#92400E', fontStyle: 'italic', lineHeight: 19 },

  // Achievement items
  achItem: {
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  achItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  achItemTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  achItemMeta: { fontSize: 12, color: TEXT_DIM, marginTop: 2 },

  achStatusDesc: { marginTop: 2 },

  evidenceSection: { gap: 6 },
  evidenceLabel: { fontSize: 10.5, fontWeight: '800', color: TEXT_DIM, letterSpacing: 1 },

  submitAchBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitAchBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  evidenceWarning: { fontSize: 11, color: '#D97706', fontWeight: '600' },

  // Summary
  summaryCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  summaryTxt: { fontSize: 13, color: '#0369A1', lineHeight: 19 },
  statesList: { gap: 10, marginTop: 4 },
  stateRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stateIcon: { fontSize: 14, fontWeight: '900', width: 20, textAlign: 'center' },
  stateLabel: { fontSize: 12.5, fontWeight: '800' },
  stateDesc: { fontSize: 11.5, color: TEXT_DIM },

  // Empty state
  emptyState: { alignItems: 'center', padding: 20, gap: 6 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  emptySub: { fontSize: 12.5, color: TEXT_FAINT, textAlign: 'center' },

  // No profile
  noProfileIcon: { fontSize: 48, marginBottom: 4 },
  noProfileTitle: { fontSize: 20, fontWeight: '900', color: TEXT_MAIN },
  noProfileSub: { fontSize: 13.5, color: TEXT_DIM, textAlign: 'center' },

  ctaBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
