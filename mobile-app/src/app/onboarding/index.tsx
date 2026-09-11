import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Storage } from '../../utils/config';
import {
  fetchSports,
  fetchMyProfile,
  createAthleteProfile,
  updateAthleteProfile,
  updateProfileImage,
  fetchMyAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  submitAchievementForVerification,
  uploadAchievementEvidence,
  submitProfileForVerification,
  calculateProfileCompletion,
  type Sport,
  type Achievement,
  type AthleteProfile,
  type ProfileDraft,
} from '../../utils/athleteService';
import StepIndicator from '../../components/onboarding/StepIndicator';
import AchievementCard from '../../components/onboarding/AchievementCard';
import AchievementFormModal from '../../components/onboarding/AchievementFormModal';
import EvidenceUpload from '../../components/onboarding/EvidenceUpload';
import VerificationStatusChip from '../../components/onboarding/VerificationStatusChip';

const PRIMARY = '#E2550B';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

const STEP_LABELS = [
  'Basic Info',
  'Sport',
  'Affiliation',
  'Your Story',
  'Photo',
  'Achievements',
  'Evidence',
  'Review',
];

const CURRENT_LEVELS = ['District', 'State', 'National', 'International'];
const AGE_GROUPS = ['Under-14', 'Under-17', 'Under-20', 'Senior'];
const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Jammu & Kashmir', 'Ladakh',
];

const DRAFT_KEY = 'athlete_profile_draft';

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [focusField, setFocusField] = useState('');

  // Existing profile (editing mode)
  const [existingProfile, setExistingProfile] = useState<AthleteProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Step data
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Form state
  const [draft, setDraft] = useState<ProfileDraft>({});
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);

  // Achievement modal
  const [achievementModalMode, setAchievementModalMode] = useState<'add' | 'edit'>('add');
  const [achievementModalVisible, setAchievementModalVisible] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [submittingAchievementId, setSubmittingAchievementId] = useState<number | null>(null);

  // Submission state
  const [submitted, setSubmitted] = useState(false);

  // ─── Init ─────────────────────────────────────────────────

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    try {
      const [userData, draftsaved, sportsData] = await Promise.all([
        Storage.getItem('userData'),
        Storage.getItem(DRAFT_KEY),
        fetchSports().catch(() => []),
      ]);

      if (userData) setCurrentUser(JSON.parse(userData));
      if (sportsData.length) setSports(sportsData);

      // Try to load existing profile
      try {
        const profile = await fetchMyProfile();
        setExistingProfile(profile);
        setIsEditing(true);
        // Pre-fill draft from existing profile
        setDraft({
          sportId: profile.sportId,
          sportName: profile.sport?.name,
          discipline: profile.discipline || '',
          currentLevel: profile.currentLevel || '',
          ageGroup: profile.ageGroup || '',
          city: profile.city || '',
          state: profile.state || '',
          academyName: profile.academyName || '',
          coachName: profile.coachName || '',
          yearsActive: profile.yearsActive?.toString() || '',
          bio: profile.bio || '',
          currentGoal: profile.currentGoal || '',
          supportSummary: profile.supportSummary || '',
        });
        if (profile.user?.profileImageUrl) {
          setProfileImageUri(profile.user.profileImageUrl);
        }
        // Fetch achievements
        const ach = await fetchMyAchievements().catch(() => []);
        setAchievements(ach);
      } catch {
        // No profile yet — check for saved draft
        if (draftsaved) {
          const d = JSON.parse(draftsaved);
          setDraft(d);
        }
      }
    } catch (e) {
      console.warn('Init error:', e);
    }
    setLoading(false);
  };

  const setField = (key: keyof ProfileDraft, val: any) => {
    setDraft(d => {
      const updated = { ...d, [key]: val };
      Storage.setItem(DRAFT_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // ─── Navigation ───────────────────────────────────────────

  const goNext = () => { setError(''); setStep(s => Math.min(s + 1, STEP_LABELS.length - 1)); };
  const goPrev = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  const validateStep = (): boolean => {
    switch (step) {
      case 0:
        if (!currentUser?.name?.trim()) { setError('Your name is required.'); return false; }
        return true;
      case 1:
        if (!draft.sportId) { setError('Please select a sport.'); return false; }
        if (!draft.discipline?.trim()) { setError('Please enter your discipline or event.'); return false; }
        return true;
      case 2:
        if (!draft.city?.trim()) { setError('Please enter your city.'); return false; }
        if (!draft.state?.trim()) { setError('Please select your state.'); return false; }
        return true;
      case 3:
        if (!draft.bio || draft.bio.length < 20) { setError('Please write a short biography (at least 20 characters).'); return false; }
        return true;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    setError('');
    if (!validateStep()) return;

    // Save after each step
    if (step < 5) {
      await saveProfile();
    }
    goNext();
  };

  // ─── Save Profile ─────────────────────────────────────────

  const saveProfile = async () => {
    const data = {
      sportId: draft.sportId,
      discipline: draft.discipline,
      currentLevel: draft.currentLevel,
      ageGroup: draft.ageGroup,
      city: draft.city,
      state: draft.state,
      bio: draft.bio,
      coachName: draft.coachName,
      academyName: draft.academyName,
      yearsActive: draft.yearsActive ? parseInt(draft.yearsActive) : undefined,
      currentGoal: draft.currentGoal,
      supportSummary: draft.supportSummary,
    };
    try {
      if (isEditing) {
        await updateAthleteProfile(data);
      } else {
        await createAthleteProfile(data);
        setIsEditing(true);
        // Reload achievements
        const ach = await fetchMyAchievements().catch(() => []);
        setAchievements(ach);
      }
      // Clear draft from storage after successful save
      await Storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e: any) {
      throw new Error(e.message || 'Failed to save profile. Please try again.');
    }
  };

  // ─── Profile Photo ────────────────────────────────────────

  const pickProfilePhoto = async () => {
    setError('');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission denied. Please allow access to your photo library in Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;

      setSaving(true);
      await updateProfileImage(uri);
      setProfileImageUri(uri);
      // Update local storage
      const ud = await Storage.getItem('userData');
      if (ud) {
        const userObj = JSON.parse(ud);
        userObj.profileImageUrl = uri;
        await Storage.setItem('userData', JSON.stringify(userObj));
      }
    } catch (e: any) {
      setError(e.message || 'Unable to upload photo. Please try again.');
    }
    setSaving(false);
  };

  // ─── Achievement Handlers ─────────────────────────────────

  const handleAddAchievement = () => {
    setEditingAchievement(null);
    setAchievementModalMode('add');
    setAchievementModalVisible(true);
  };

  const handleEditAchievement = (ach: Achievement) => {
    setEditingAchievement(ach);
    setAchievementModalMode('edit');
    setAchievementModalVisible(true);
  };

  const handleSaveAchievement = async (formData: any) => {
    if (achievementModalMode === 'add') {
      const newAch = await createAchievement(formData);
      setAchievements(prev => [newAch, ...prev]);
    } else if (editingAchievement) {
      const updated = await updateAchievement(editingAchievement.id, formData);
      setAchievements(prev => prev.map(a => a.id === updated.id ? updated : a));
    }
  };

  const handleDeleteAchievement = (ach: Achievement) => {
    Alert.alert(
      'Delete Achievement',
      `Are you sure you want to delete "${ach.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAchievement(ach.id);
              setAchievements(prev => prev.filter(a => a.id !== ach.id));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleSubmitAchievement = async (ach: Achievement) => {
    setSubmittingAchievementId(ach.id);
    try {
      const updated = await submitAchievementForVerification(ach.id);
      setAchievements(prev => prev.map(a => a.id === updated.id ? updated : a));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSubmittingAchievementId(null);
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

  // ─── Final Submit ─────────────────────────────────────────

  const handleFinalSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await saveProfile();
      await submitProfileForVerification();
      await Storage.setItem(DRAFT_KEY, '{}');
      // Update user data
      const ud = await Storage.getItem('userData');
      if (ud) {
        const userObj = JSON.parse(ud);
        if (existingProfile) {
          userObj.athleteProfile = { ...existingProfile, profileVerificationStatus: 'PENDING_REVIEW' };
        }
        await Storage.setItem('userData', JSON.stringify(userObj));
      }
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || 'Failed to submit. Please try again.');
    }
    setSaving(false);
  };

  // ─── Completion ───────────────────────────────────────────

  const completion = calculateProfileCompletion(
    existingProfile || {
      sportId: draft.sportId,
      discipline: draft.discipline,
      city: draft.city,
      state: draft.state,
      bio: draft.bio,
      currentGoal: draft.currentGoal,
      coachName: draft.coachName,
      academyName: draft.academyName,
    },
    achievements,
    !!profileImageUri
  );

  // ─── Render helpers ───────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingTxt}>Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return <SubmittedScreen onContinue={() => router.replace('/dashboard')} />;
  }

  const inputStyle = (field: string) => [
    styles.input,
    focusField === field && styles.inputFocused,
  ];

  const renderStep = () => {
    switch (step) {

      // ── STEP 0: Basic Identity ──────────────────────────
      case 0:
        return (
          <View style={styles.stepContent}>
            <SectionHeader icon="👤" title="Basic Identity" />
            <PrivacyNotice
              pubNote="Your name and sport will appear on your public profile."
              privNote="Your contact details are private and only used for verification."
            />
            <View style={styles.field}>
              <Text style={styles.label}>FULL NAME</Text>
              <View style={[styles.inputReadonly]}>
                <Text style={styles.inputReadonlyTxt}>{currentUser?.name || '—'}</Text>
              </View>
              <Text style={styles.hint}>
                Pre-filled from your account. To change, update your account settings.
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL ADDRESS (PRIVATE)</Text>
              <View style={[styles.inputReadonly]}>
                <Text style={[styles.inputReadonlyTxt, { color: TEXT_FAINT }]}>
                  {currentUser?.email || '—'}
                </Text>
              </View>
              <Text style={styles.hint}>Your email is private and never shown publicly.</Text>
            </View>
          </View>
        );

      // ── STEP 1: Sport Information ───────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            <SectionHeader icon="🏅" title="Sport Information" />
            <View style={styles.field}>
              <Text style={styles.label}>SPORT <Text style={styles.req}>*</Text></Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {sports.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.optionChip, draft.sportId === s.id && styles.optionChipActive]}
                    onPress={() => { setField('sportId', s.id); setField('sportName', s.name); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionChipTxt, draft.sportId === s.id && styles.optionChipTxtActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>DISCIPLINE / EVENT <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={inputStyle('discipline')}
                placeholder="e.g. 400m Sprint, 100m Freestyle, Featherweight"
                placeholderTextColor={TEXT_FAINT}
                value={draft.discipline || ''}
                onChangeText={v => setField('discipline', v)}
                onFocus={() => setFocusField('discipline')}
                onBlur={() => setFocusField('')}
              />
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>CURRENT LEVEL</Text>
                <View style={styles.chipsWrap}>
                  {CURRENT_LEVELS.map(l => (
                    <TouchableOpacity
                      key={l}
                      style={[styles.optionChip, draft.currentLevel === l && styles.optionChipActive]}
                      onPress={() => setField('currentLevel', l)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.optionChipTxt, draft.currentLevel === l && styles.optionChipTxtActive]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>AGE GROUP</Text>
              <View style={styles.chipsWrap}>
                {AGE_GROUPS.map(ag => (
                  <TouchableOpacity
                    key={ag}
                    style={[styles.optionChip, draft.ageGroup === ag && styles.optionChipActive]}
                    onPress={() => setField('ageGroup', ag)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionChipTxt, draft.ageGroup === ag && styles.optionChipTxtActive]}>{ag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );

      // ── STEP 2: Location & Affiliation ──────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            <SectionHeader icon="📍" title="Location & Affiliation" />
            <PrivacyNotice
              pubNote="City and state will appear on your public profile."
              privNote="Your exact address is never shown publicly."
            />
            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>CITY <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={inputStyle('city')}
                  placeholder="e.g. Mumbai"
                  placeholderTextColor={TEXT_FAINT}
                  value={draft.city || ''}
                  onChangeText={v => setField('city', v)}
                  onFocus={() => setFocusField('city')}
                  onBlur={() => setFocusField('')}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>YEARS ACTIVE</Text>
                <TextInput
                  style={inputStyle('yearsActive')}
                  placeholder="e.g. 4"
                  placeholderTextColor={TEXT_FAINT}
                  value={draft.yearsActive || ''}
                  onChangeText={v => setField('yearsActive', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  onFocus={() => setFocusField('yearsActive')}
                  onBlur={() => setFocusField('')}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>STATE / REGION <Text style={styles.req}>*</Text></Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {INDIA_STATES.map(state => (
                  <TouchableOpacity
                    key={state}
                    style={[styles.optionChip, draft.state === state && styles.optionChipActive]}
                    onPress={() => setField('state', state)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionChipTxt, draft.state === state && styles.optionChipTxtActive]}>
                      {state}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                ℹ Affiliation information may require additional verification. The coach listed here is NOT a separate login role.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>TRAINING ACADEMY / ORGANIZATION</Text>
              <TextInput
                style={inputStyle('academyName')}
                placeholder="e.g. Mumbai Athletics Academy"
                placeholderTextColor={TEXT_FAINT}
                value={draft.academyName || ''}
                onChangeText={v => setField('academyName', v)}
                onFocus={() => setFocusField('academyName')}
                onBlur={() => setFocusField('')}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>COACH NAME</Text>
              <TextInput
                style={inputStyle('coachName')}
                placeholder="e.g. Coach Rajesh Yadav"
                placeholderTextColor={TEXT_FAINT}
                value={draft.coachName || ''}
                onChangeText={v => setField('coachName', v)}
                onFocus={() => setFocusField('coachName')}
                onBlur={() => setFocusField('')}
              />
            </View>
          </View>
        );

      // ── STEP 3: Athlete Story ───────────────────────────
      case 3:
        return (
          <View style={styles.stepContent}>
            <SectionHeader icon="✍️" title="Your Athlete Story" />
            <PrivacyNotice
              pubNote="Your biography and goal will appear on your public profile."
              privNote="Support requirements are shared with verified sponsors only."
            />
            <View style={styles.field}>
              <Text style={styles.label}>SHORT BIOGRAPHY <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={[inputStyle('bio'), { height: 100, textAlignVertical: 'top' }]}
                placeholder="Describe your athletic journey, training routine, and key achievements…"
                placeholderTextColor={TEXT_FAINT}
                value={draft.bio || ''}
                onChangeText={v => setField('bio', v)}
                multiline
                onFocus={() => setFocusField('bio')}
                onBlur={() => setFocusField('')}
              />
              <Text style={[styles.hint, { color: draft.bio && draft.bio.length >= 20 ? '#059669' : TEXT_FAINT }]}>
                {draft.bio?.length || 0} characters (minimum 20)
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CURRENT OBJECTIVE / GOAL</Text>
              <TextInput
                style={[inputStyle('currentGoal'), { height: 70, textAlignVertical: 'top' }]}
                placeholder="e.g. Qualify for National Junior Athletics Championship 2026"
                placeholderTextColor={TEXT_FAINT}
                value={draft.currentGoal || ''}
                onChangeText={v => setField('currentGoal', v)}
                multiline
                onFocus={() => setFocusField('currentGoal')}
                onBlur={() => setFocusField('')}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CURRENT SUPPORT REQUIREMENT SUMMARY</Text>
              <TextInput
                style={[inputStyle('supportSummary'), { height: 70, textAlignVertical: 'top' }]}
                placeholder="e.g. Seeking support for competition travel and equipment"
                placeholderTextColor={TEXT_FAINT}
                value={draft.supportSummary || ''}
                onChangeText={v => setField('supportSummary', v)}
                multiline
                onFocus={() => setFocusField('supportSummary')}
                onBlur={() => setFocusField('')}
              />
            </View>
          </View>
        );

      // ── STEP 4: Profile Photo ───────────────────────────
      case 4:
        return (
          <View style={styles.stepContent}>
            <SectionHeader icon="📸" title="Profile Photo" />
            <View style={styles.photoSection}>
              {profileImageUri ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: profileImageUri }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.photoChangeBadge}
                    onPress={pickProfilePhoto}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.photoChangeTxt}>Change Photo</Text>
                    }
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoPlaceholder}
                  onPress={pickProfilePhoto}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="large" color={PRIMARY} />
                  ) : (
                    <>
                      <Text style={styles.photoPlaceholderIcon}>📸</Text>
                      <Text style={styles.photoPlaceholderTitle}>Upload Profile Photo</Text>
                      <Text style={styles.photoPlaceholderHint}>
                        A clear, professional headshot is recommended.
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.photoSkipNote}>
              A profile photo is optional but recommended — it builds trust with supporters.
            </Text>
          </View>
        );

      // ── STEP 5: Achievements ────────────────────────────
      case 5:
        return (
          <View style={styles.stepContent}>
            <SectionHeader icon="🏆" title="Achievements" />
            <Text style={styles.stepDesc}>
              Add your competition results, medals, and rankings. Each achievement can be individually verified.
            </Text>

            {achievements.length === 0 ? (
              <View style={styles.emptyAch}>
                <Text style={styles.emptyAchIcon}>🏅</Text>
                <Text style={styles.emptyAchTitle}>No achievements yet</Text>
                <Text style={styles.emptyAchSub}>
                  Add your first achievement to get started.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {achievements.map(ach => (
                  <View key={ach.id}>
                    <AchievementCard
                      achievement={ach}
                      onEdit={() => handleEditAchievement(ach)}
                      onDelete={() => handleDeleteAchievement(ach)}
                      onSubmit={() => handleSubmitAchievement(ach)}
                      isSubmitting={submittingAchievementId === ach.id}
                    />
                    {/* Evidence upload inline */}
                    <View style={{ marginTop: 8 }}>
                      <EvidenceUpload
                        achievement={ach}
                        disabled={ach.verificationStatus === 'VERIFIED'}
                        onEvidenceUploaded={(uri, fileName, fileType) =>
                          handleEvidenceUpload(ach, uri, fileName, fileType)
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.addAchBtn}
              onPress={handleAddAchievement}
              activeOpacity={0.85}
            >
              <Text style={styles.addAchBtnTxt}>+ Add Achievement</Text>
            </TouchableOpacity>
          </View>
        );

      // ── STEP 6: Evidence & Verification Status ──────────
      case 6:
        return (
          <View style={styles.stepContent}>
            <SectionHeader icon="🛡️" title="Verification Status" />
            <Text style={styles.stepDesc}>
              Review what you've submitted for verification. Evidence must be uploaded before submitting each achievement.
            </Text>

            {/* Verification lifecycle info */}
            <View style={styles.lifecycleBox}>
              <Text style={styles.lifecycleTitle}>HOW VERIFICATION WORKS</Text>
              <View style={{ gap: 6 }}>
                <Text style={styles.lifecycleTxt}>○ Not submitted → Submit with evidence</Text>
                <Text style={styles.lifecycleTxt}>◷ Pending review → Admin reviews</Text>
                <Text style={styles.lifecycleTxt}>✓ Verified → Appears on public profile</Text>
                <Text style={styles.lifecycleTxt}>⚠ Needs correction → Fix and resubmit</Text>
                <Text style={styles.lifecycleTxt}>✕ Rejected → Cannot be resubmitted</Text>
              </View>
            </View>

            {achievements.length === 0 ? (
              <View style={styles.emptyAch}>
                <Text style={styles.emptyAchIcon}>📋</Text>
                <Text style={styles.emptyAchTitle}>No achievements added</Text>
                <Text style={styles.emptyAchSub}>Go back to Step 6 to add achievements.</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {achievements.map(ach => (
                  <View key={ach.id} style={styles.verifyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyAchTitle} numberOfLines={1}>{ach.title}</Text>
                      {ach.competition && (
                        <Text style={styles.verifyAchMeta}>{ach.competition}</Text>
                      )}
                    </View>
                    <VerificationStatusChip status={ach.verificationStatus} size="sm" />
                  </View>
                ))}
              </View>
            )}

            {/* Needs correction detail */}
            {achievements.filter(a => a.verificationStatus === 'NEEDS_CORRECTION').map(ach => (
              <View key={ach.id} style={styles.correctionBlock}>
                <Text style={styles.correctionTitle}>⚠ Correction Required: {ach.title}</Text>
                {ach.reviewNotes && (
                  <Text style={styles.correctionNote}>Admin note: "{ach.reviewNotes}"</Text>
                )}
                <Text style={styles.correctionHint}>
                  Go to Step 6 to update this achievement and resubmit.
                </Text>
              </View>
            ))}
          </View>
        );

      // ── STEP 7: Review & Submit ─────────────────────────
      case 7:
        const profile = existingProfile;
        const pct = completion.percentage;
        return (
          <View style={styles.stepContent}>
            <SectionHeader icon="📋" title="Review & Submit" />

            {/* Completion bar */}
            <View style={styles.completionCard}>
              <View style={styles.completionHeader}>
                <Text style={styles.completionLabel}>PROFILE COMPLETION</Text>
                <Text style={styles.completionPct}>{pct}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
              </View>
              {completion.missing.length > 0 && (
                <View style={{ marginTop: 8, gap: 3 }}>
                  <Text style={styles.missingLabel}>Missing:</Text>
                  {completion.missing.map(m => (
                    <Text key={m} style={styles.missingItem}>• {m}</Text>
                  ))}
                </View>
              )}
            </View>

            {/* Profile summary */}
            <ReviewSection title="PROFILE">
              <ReviewRow label="Name" value={currentUser?.name} />
              <ReviewRow label="Sport" value={draft.sportName} />
              <ReviewRow label="Discipline" value={draft.discipline} />
              <ReviewRow label="Level" value={draft.currentLevel} />
              <ReviewRow label="Age Group" value={draft.ageGroup} />
              <ReviewRow label="Location" value={draft.city && draft.state ? `${draft.city}, ${draft.state}` : undefined} />
              <ReviewRow label="Academy" value={draft.academyName} />
              <ReviewRow label="Coach" value={draft.coachName} />
              <ReviewRow label="Years active" value={draft.yearsActive} />
              <ReviewRow label="Bio" value={draft.bio} multiline />
              <ReviewRow label="Goal" value={draft.currentGoal} multiline />
            </ReviewSection>

            {/* Achievements summary */}
            <ReviewSection title="ACHIEVEMENTS">
              {achievements.length === 0 ? (
                <Text style={styles.reviewEmpty}>No achievements added.</Text>
              ) : (
                achievements.map(ach => (
                  <View key={ach.id} style={styles.reviewAchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewAchTitle}>{ach.title}</Text>
                      {ach.position && <Text style={styles.reviewAchMeta}>{ach.position}{ach.date ? ` · ${ach.date}` : ''}</Text>}
                    </View>
                    <VerificationStatusChip status={ach.verificationStatus} size="sm" />
                  </View>
                ))
              )}
            </ReviewSection>

            {/* Warnings */}
            {completion.missing.length > 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>⚠ Profile is not complete</Text>
                <Text style={styles.warningTxt}>
                  {completion.missing.length} item{completion.missing.length > 1 ? 's need' : ' needs'} attention. You can still submit, but a complete profile gets faster review.
                </Text>
              </View>
            )}

            {/* Submit CTA */}
            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleFinalSubmit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnTxt}>SUBMIT FOR VERIFICATION →</Text>
              }
            </TouchableOpacity>

            <Text style={styles.submitNote}>
              You can continue editing items that have not been locked for review.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>
            <Text style={{ color: TEXT_MAIN }}>SPORT</Text>
            <Text style={{ color: PRIMARY }}>SPHERE</Text>
          </Text>
          <Text style={styles.topBarSub}>
            {isEditing ? 'Edit Profile' : 'Create Profile'}
          </Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* Step indicator */}
      <StepIndicator
        steps={STEP_LABELS}
        currentStep={step}
        onStepPress={setStep}
      />

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}

          {/* Error */}
          {!!error && (
            <View style={styles.errBox}>
              <Text style={styles.errTxt}>⚠  {error}</Text>
            </View>
          )}

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {step > 0 && (
              <TouchableOpacity style={styles.prevBtn} onPress={goPrev} activeOpacity={0.8}>
                <Text style={styles.prevBtnTxt}>← Back</Text>
              </TouchableOpacity>
            )}

            {step < STEP_LABELS.length - 1 && (
              <TouchableOpacity
                style={[styles.nextBtn, saving && { opacity: 0.6 }]}
                onPress={handleNext}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.nextBtnTxt}>
                      {step === 0 ? 'Start →' : step === STEP_LABELS.length - 2 ? 'Review →' : 'Next →'}
                    </Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Achievement Modal */}
      <AchievementFormModal
        visible={achievementModalVisible}
        onClose={() => setAchievementModalVisible(false)}
        onSave={handleSaveAchievement}
        initialData={editingAchievement || {}}
        mode={achievementModalMode}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function PrivacyNotice({ pubNote, privNote }: { pubNote: string; privNote: string }) {
  return (
    <View style={styles.privacyRow}>
      <View style={styles.privacyHalf}>
        <Text style={styles.privacyPubLabel}>🌐 PUBLIC</Text>
        <Text style={styles.privacyTxt}>{pubNote}</Text>
      </View>
      <View style={[styles.privacyHalf, styles.privacyPrivHalf]}>
        <Text style={styles.privacyPrivLabel}>🔒 PRIVATE</Text>
        <Text style={styles.privacyTxt}>{privNote}</Text>
      </View>
    </View>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.reviewSection}>
      <Text style={styles.reviewSectionTitle}>{title}</Text>
      <View style={styles.reviewSectionContent}>
        {children}
      </View>
    </View>
  );
}

function ReviewRow({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, multiline && { flex: 1 }]} numberOfLines={multiline ? 3 : 1}>
        {value || <Text style={{ color: TEXT_FAINT }}>Not filled</Text>}
      </Text>
    </View>
  );
}

function SubmittedScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <SafeAreaView style={[styles.center, { backgroundColor: '#F0FDF4' }]}>
      <View style={styles.submittedCard}>
        <Text style={styles.submittedIcon}>🎉</Text>
        <Text style={styles.submittedTitle}>Profile Submitted!</Text>
        <Text style={styles.submittedSub}>
          Your profile has been submitted for review. Our admin team will verify your information and evidence.
        </Text>
        <View style={styles.submittedInfo}>
          <Text style={styles.submittedInfoTxt}>
            ✓ You can continue editing items not yet locked for review.{'\n'}
            ✓ You'll be able to see your verification status in the dashboard.{'\n'}
            ✓ If corrections are needed, you'll see admin notes on each item.
          </Text>
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={onContinue} activeOpacity={0.85}>
          <Text style={styles.submitBtnTxt}>GO TO DASHBOARD →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingTxt: { color: TEXT_DIM, marginTop: 12, fontSize: 14, fontWeight: '600' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backTxt: { fontSize: 14, fontWeight: '700', color: TEXT_DIM, width: 50 },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5, fontStyle: 'italic' },
  topBarSub: { fontSize: 10, color: TEXT_FAINT, fontWeight: '600', letterSpacing: 0.5, marginTop: 1 },

  // Scroll
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 40,
    gap: 16,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },

  stepContent: { gap: 16 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  sectionIcon: { fontSize: 22 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: TEXT_MAIN, letterSpacing: -0.5 },

  // Privacy notice
  privacyRow: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  privacyHalf: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  privacyPrivHalf: { backgroundColor: '#F0FDF4' },
  privacyPubLabel: { fontSize: 9, fontWeight: '900', color: '#1D4ED8', letterSpacing: 1 },
  privacyPrivLabel: { fontSize: 9, fontWeight: '900', color: '#059669', letterSpacing: 1 },
  privacyTxt: { fontSize: 11.5, color: TEXT_DIM, lineHeight: 16 },

  // Form fields
  field: { gap: 5 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 10.5, fontWeight: '800', color: TEXT_DIM, letterSpacing: 1 },
  req: { color: PRIMARY },
  hint: { fontSize: 11, color: TEXT_FAINT, fontWeight: '500' },
  input: {
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: TEXT_MAIN,
    fontSize: 15,
    fontWeight: '500',
  },
  inputFocused: { borderColor: PRIMARY, backgroundColor: '#FFFFFF' },
  inputReadonly: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputReadonlyTxt: { color: TEXT_MAIN, fontSize: 15, fontWeight: '600' },

  // Chips
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  optionChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  optionChipTxt: { fontSize: 13, fontWeight: '700', color: TEXT_DIM },
  optionChipTxtActive: { color: '#fff' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Info box
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoBoxText: { fontSize: 12, color: '#1D4ED8', lineHeight: 17 },

  // Photo
  photoSection: { alignItems: 'center', paddingVertical: 8 },
  photoPreviewWrap: { alignItems: 'center', gap: 12 },
  photoPreview: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: PRIMARY,
    backgroundColor: '#F3F4F6',
  },
  photoChangeBadge: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  photoChangeTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  photoPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: BORDER,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  photoPlaceholderIcon: { fontSize: 32 },
  photoPlaceholderTitle: { fontSize: 14, fontWeight: '800', color: TEXT_MAIN, textAlign: 'center' },
  photoPlaceholderHint: { fontSize: 11, color: TEXT_FAINT, textAlign: 'center', paddingHorizontal: 12 },
  photoSkipNote: { fontSize: 12, color: TEXT_FAINT, textAlign: 'center' },

  stepDesc: { fontSize: 13.5, color: TEXT_DIM, lineHeight: 19 },

  // Empty achievement state
  emptyAch: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: BORDER,
    gap: 6,
  },
  emptyAchIcon: { fontSize: 32 },
  emptyAchTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  emptyAchSub: { fontSize: 12, color: TEXT_FAINT },

  addAchBtn: {
    borderWidth: 2,
    borderColor: PRIMARY,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addAchBtnTxt: { color: PRIMARY, fontSize: 14, fontWeight: '800' },

  // Verification step
  lifecycleBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 8,
  },
  lifecycleTitle: { fontSize: 10.5, fontWeight: '900', color: '#0369A1', letterSpacing: 1 },
  lifecycleTxt: { fontSize: 12.5, color: '#0369A1' },

  verifyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  verifyAchTitle: { fontSize: 13.5, fontWeight: '700', color: TEXT_MAIN },
  verifyAchMeta: { fontSize: 11, color: TEXT_DIM, marginTop: 2 },

  correctionBlock: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  correctionTitle: { fontSize: 13, fontWeight: '800', color: '#EA580C' },
  correctionNote: { fontSize: 12.5, color: '#92400E', fontStyle: 'italic' },
  correctionHint: { fontSize: 11, color: '#D97706', fontWeight: '600' },

  // Review step
  completionCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  completionLabel: { fontSize: 10.5, fontWeight: '800', color: TEXT_DIM, letterSpacing: 1 },
  completionPct: { fontSize: 20, fontWeight: '900', color: PRIMARY },
  progressBar: { height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 3 },
  missingLabel: { fontSize: 11, fontWeight: '700', color: TEXT_DIM },
  missingItem: { fontSize: 11.5, color: TEXT_FAINT },

  reviewSection: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    overflow: 'hidden',
  },
  reviewSectionTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: TEXT_DIM,
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  reviewSectionContent: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  reviewRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexWrap: 'wrap',
  },
  reviewLabel: { fontSize: 12, fontWeight: '700', color: TEXT_DIM, minWidth: 90 },
  reviewValue: { fontSize: 12.5, color: TEXT_MAIN, flex: 1 },
  reviewEmpty: { fontSize: 13, color: TEXT_FAINT, paddingVertical: 8 },
  reviewAchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  reviewAchTitle: { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  reviewAchMeta: { fontSize: 11, color: TEXT_DIM },

  warningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  warningTitle: { fontSize: 13, fontWeight: '800', color: '#D97706' },
  warningTxt: { fontSize: 12.5, color: '#92400E' },

  // Submit
  submitBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontStyle: 'italic',
  },
  submitNote: { fontSize: 12, color: TEXT_FAINT, textAlign: 'center' },

  // Bottom nav
  navRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  prevBtn: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
  },
  prevBtnTxt: { color: TEXT_DIM, fontSize: 14, fontWeight: '700' },
  nextBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  // Error
  errBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
  },
  errTxt: { color: '#DC2626', fontSize: 13, fontWeight: '600' },

  // Submitted screen
  submittedCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    maxWidth: 380,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  submittedIcon: { fontSize: 52 },
  submittedTitle: { fontSize: 26, fontWeight: '900', color: TEXT_MAIN, letterSpacing: -0.5 },
  submittedSub: { fontSize: 14, color: TEXT_DIM, textAlign: 'center', lineHeight: 21 },
  submittedInfo: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  submittedInfoTxt: { fontSize: 13, color: '#15803D', lineHeight: 20 },
});
