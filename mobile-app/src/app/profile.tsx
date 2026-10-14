import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image, Modal, Alert, RefreshControl
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileApi, Storage } from '../utils/config';
import SportSearchPicker from '../components/SportSearchPicker';

const PRIMARY = '#E2550B';
const PRIMARY_LIGHT = '#FFF7ED';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';
const ERROR_RED = '#DC2626';
const SUCCESS_GREEN = '#059669';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function getInitials(name: string) {
  return (name || 'User').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Contributions stats for Contributor/Supporter
  const [contributions, setContributions] = useState<any[]>([]);
  const [totalContributed, setTotalContributed] = useState(0);
  const [athletesSupportedCount, setAthletesSupportedCount] = useState(0);

  // Edit Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  // Athlete edit fields
  const [editSportId, setEditSportId] = useState<number | null>(null);
  const [editSportName, setEditSportName] = useState('');
  const [editDiscipline, setEditDiscipline] = useState('');
  const [editState, setEditState] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editBio, setEditBio] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

  const loadProfileData = async () => {
    try {
      // Load cached user data
      const cached = await Storage.getItem('userData');
      if (cached) {
        const parsed = JSON.parse(cached);
        setUser(parsed);
        populateEditFields(parsed);
      }

      // Fetch fresh profile from server
      const freshUser = await mobileApi.auth.getMe();
      setUser(freshUser);
      populateEditFields(freshUser);
      await Storage.setItem('userData', JSON.stringify(freshUser));

      // If supporter/contributor, load their contributions ledger
      if (freshUser.role !== 'ATHLETE') {
        const contribData = await mobileApi.user.getContributions();
        setContributions(contribData.supports || []);
        setTotalContributed(contribData.totalContributed || 0);
        setAthletesSupportedCount(contribData.athletesSupportedCount || 0);
      }
    } catch (err) {
      console.warn('Profile load warning:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const populateEditFields = (userData: any) => {
    setEditName(userData?.name || '');
    setEditPhone(userData?.phone || '');
    if (userData?.athleteProfile) {
      const ap = userData.athleteProfile;
      setEditSportId(ap.sportId || null);
      setEditSportName(ap.sport?.name || '');
      setEditDiscipline(ap.discipline || '');
      setEditState(ap.state || '');
      setEditCity(ap.city || '');
      setEditHeadline(ap.headline || '');
      setEditGoal(ap.currentGoal || '');
      setEditBio(ap.bio || '');
    }
  };

  const handleSaveProfile = async () => {
    setSaveError('');
    setSaveSuccess('');
    if (!editName.trim()) {
      setSaveError('Name is required');
      return;
    }

    setSaving(true);
    try {
      if (user?.role === 'ATHLETE') {
        const res = await mobileApi.athletes.updateProfile({
          name: editName.trim(),
          phone: editPhone.trim() || undefined,
          sportId: editSportId || undefined,
          sportName: editSportName || undefined,
          discipline: editDiscipline.trim(),
          state: editState.trim(),
          city: editCity.trim(),
          headline: editHeadline.trim(),
          currentGoal: editGoal.trim(),
          bio: editBio.trim(),
        });

        // Merge updated user data
        const updatedUser = {
          ...user,
          name: editName.trim(),
          phone: editPhone.trim(),
          athleteProfile: res.athlete,
        };
        setUser(updatedUser);
        await Storage.setItem('userData', JSON.stringify(updatedUser));
      } else {
        const res = await mobileApi.user.updateProfile({
          name: editName.trim(),
          phone: editPhone.trim() || undefined,
        });
        setUser(res.user);
        await Storage.setItem('userData', JSON.stringify(res.user));
      }

      setSaveSuccess('Profile updated successfully!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSaveSuccess('');
      }, 700);
    } catch (err: any) {
      setSaveError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of SportSphere?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await Storage.removeItem('userToken');
            await Storage.removeItem('userData');
            router.replace('/');
          },
        },
      ]
    );
  };

  if (loading && !user) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={s.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  const isAthlete = user?.role === 'ATHLETE';
  const roleLabel = isAthlete ? 'Athlete' : (user?.role === 'SPONSOR' ? 'Corporate Sponsor' : 'Contributor / Supporter');
  const roleIcon = isAthlete ? 'fitness-outline' : (user?.role === 'SPONSOR' ? 'briefcase-outline' : 'heart-outline');

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfileData(); }} tintColor={PRIMARY} />
      }
    >
      {/* ─── USER HEADER CARD ─── */}
      <View style={s.headerCard}>
        <View style={s.avatarRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{getInitials(user?.name)}</Text>
          </View>

          <View style={s.profileDetails}>
            <Text style={s.userName}>{user?.name || 'SportSphere User'}</Text>
            <View style={s.roleBadge}>
              <Ionicons name={roleIcon as any} size={14} color={PRIMARY} style={{ marginRight: 4 }} />
              <Text style={s.roleBadgeText}>{roleLabel}</Text>
            </View>
            <Text style={s.userEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        {/* Contact info pills */}
        <View style={s.contactRow}>
          {user?.phone ? (
            <View style={s.contactPill}>
              <Ionicons name="call-outline" size={13} color={TEXT_DIM} />
              <Text style={s.contactText}>+91 {user.phone}</Text>
            </View>
          ) : null}
          <View style={s.contactPill}>
            <Ionicons name="calendar-outline" size={13} color={TEXT_DIM} />
            <Text style={s.contactText}>Joined {new Date(user?.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* Edit Profile Action Button */}
        <TouchableOpacity
          style={s.editProfileBtn}
          onPress={() => {
            populateEditFields(user);
            setIsEditModalOpen(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={16} color={PRIMARY} style={{ marginRight: 6 }} />
          <Text style={s.editProfileBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ─── ATHLETE SPECIFIC ACTIONS ─── */}
      {isAthlete && user?.athleteProfile && (
        <View style={s.athleteHighlightCard}>
          <View style={s.athleteHeader}>
            <Ionicons name="trophy-outline" size={20} color={PRIMARY} />
            <Text style={s.athleteHeaderTitle}>Athletic Journey</Text>
          </View>

          <View style={s.athleteInfoGrid}>
            <View style={s.athleteInfoItem}>
              <Text style={s.athleteInfoLabel}>Sport</Text>
              <Text style={s.athleteInfoVal}>{user.athleteProfile.sport?.name || 'Athletics'}</Text>
            </View>
            <View style={s.athleteInfoItem}>
              <Text style={s.athleteInfoLabel}>Discipline</Text>
              <Text style={s.athleteInfoVal}>{user.athleteProfile.discipline || 'Unspecified'}</Text>
            </View>
            <View style={s.athleteInfoItem}>
              <Text style={s.athleteInfoLabel}>Location</Text>
              <Text style={s.athleteInfoVal}>{user.athleteProfile.city ? `${user.athleteProfile.city}, ${user.athleteProfile.state}` : 'India'}</Text>
            </View>
          </View>

          {user.athleteProfile.headline ? (
            <Text style={s.headlineText}>"{user.athleteProfile.headline}"</Text>
          ) : null}

          <TouchableOpacity
            style={s.viewPublicProfileBtn}
            onPress={() => router.push(`/athlete/${user.athleteProfile.id}`)}
            activeOpacity={0.85}
          >
            <Ionicons name="person-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={s.viewPublicProfileText}>View Public Profile Page</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── CONTRIBUTOR STATS & IMPACT (Non-Athlete) ─── */}
      {!isAthlete && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>MY IMPACT OVERVIEW</Text>

          <View style={s.statsGrid}>
            <View style={s.statCard}>
              <Ionicons name="cash-outline" size={22} color={PRIMARY} />
              <Text style={s.statVal}>{inr(totalContributed)}</Text>
              <Text style={s.statLabel}>Total Funded</Text>
            </View>

            <View style={s.statCard}>
              <Ionicons name="people-outline" size={22} color="#0891B2" />
              <Text style={s.statVal}>{athletesSupportedCount}</Text>
              <Text style={s.statLabel}>Athletes Backed</Text>
            </View>

            <View style={s.statCard}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#059669" />
              <Text style={s.statVal}>100%</Text>
              <Text style={s.statLabel}>Verified Direct</Text>
            </View>
          </View>

          {/* Contributions List */}
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>ATHLETES I BACKED</Text>
          {contributions.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="heart-dislike-outline" size={32} color={TEXT_FAINT} />
              <Text style={s.emptyTitle}>No contributions yet</Text>
              <Text style={s.emptySub}>Browse athletes in need of gear, travel, and training support to start backing Indian champions.</Text>
              <TouchableOpacity
                style={s.browseBtn}
                onPress={() => router.replace('/dashboard')}
                activeOpacity={0.85}
              >
                <Text style={s.browseBtnText}>Explore Athletes →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.contributionsList}>
              {contributions.map((item, idx) => {
                const sr = item.supportRequest;
                const athlete = sr?.athlete;
                const athleteName = athlete?.user?.name || 'Athlete';
                return (
                  <TouchableOpacity
                    key={item.id || idx}
                    style={s.contribItem}
                    onPress={() => athlete?.id && router.push(`/athlete/${athlete.id}`)}
                    activeOpacity={0.8}
                  >
                    <View style={s.contribLeft}>
                      <View style={s.contribAvatar}>
                        <Text style={s.contribAvatarText}>{getInitials(athleteName)}</Text>
                      </View>
                      <View>
                        <Text style={s.contribAthleteName}>{athleteName}</Text>
                        <Text style={s.contribCause}>{sr?.title || 'Athlete Support Campaign'}</Text>
                        <Text style={s.contribDate}>
                          {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                    <View style={s.contribRight}>
                      <Text style={s.contribAmount}>+{inr(item.amount)}</Text>
                      <View style={s.capturedBadge}>
                        <Text style={s.capturedText}>Backed</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ─── LOGOUT BUTTON (Moved to Profile Page) ─── */}
      <View style={s.logoutSection}>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={ERROR_RED} style={{ marginRight: 8 }} />
          <Text style={s.logoutText}>LOG OUT OF SPORTSPHERE</Text>
        </TouchableOpacity>
        <Text style={s.versionText}>SportSphere v3.0 · Verified Athlete Support India</Text>
      </View>

      {/* ─── EDIT PROFILE MODAL ─── */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Edit Profile</Text>
                <Text style={s.modalSubtitle}>{isAthlete ? 'Update your athletic portfolio' : 'Update your personal details'}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={TEXT_DIM} />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {saveError ? (
                <View style={s.modalErrorBox}>
                  <Text style={s.modalErrorText}>⚠ {saveError}</Text>
                </View>
              ) : null}

              {saveSuccess ? (
                <View style={s.modalSuccessBox}>
                  <Text style={s.modalSuccessText}>✓ {saveSuccess}</Text>
                </View>
              ) : null}

              {/* Name */}
              <View style={s.modalField}>
                <Text style={s.modalLabel}>FULL NAME *</Text>
                <TextInput
                  style={s.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your full name"
                  placeholderTextColor={TEXT_FAINT}
                />
              </View>

              {/* Phone */}
              <View style={s.modalField}>
                <Text style={s.modalLabel}>PHONE NUMBER</Text>
                <TextInput
                  style={s.modalInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={TEXT_FAINT}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Athlete-Only Fields */}
              {isAthlete && (
                <>
                  <View style={s.modalDivider} />
                  <Text style={s.modalSectionTitle}>ATHLETIC DETAILS</Text>

                  {/* Sport Search Picker (Requirement 4) */}
                  <View style={s.modalField}>
                    <SportSearchPicker
                      selectedSportId={editSportId}
                      selectedSportName={editSportName}
                      onSelectSport={(sport) => {
                        setEditSportId(sport.id);
                        setEditSportName(sport.name);
                      }}
                    />
                  </View>

                  {/* Discipline */}
                  <View style={s.modalField}>
                    <Text style={s.modalLabel}>DISCIPLINE / EVENT</Text>
                    <TextInput
                      style={s.modalInput}
                      value={editDiscipline}
                      onChangeText={setEditDiscipline}
                      placeholder="e.g. 100m / 200m Sprint, Flyweight"
                      placeholderTextColor={TEXT_FAINT}
                    />
                  </View>

                  {/* State & City */}
                  <View style={s.modalTwoCol}>
                    <View style={[s.modalField, { flex: 1 }]}>
                      <Text style={s.modalLabel}>STATE</Text>
                      <TextInput
                        style={s.modalInput}
                        value={editState}
                        onChangeText={setEditState}
                        placeholder="State"
                        placeholderTextColor={TEXT_FAINT}
                      />
                    </View>
                    <View style={[s.modalField, { flex: 1 }]}>
                      <Text style={s.modalLabel}>CITY</Text>
                      <TextInput
                        style={s.modalInput}
                        value={editCity}
                        onChangeText={setEditCity}
                        placeholder="City"
                        placeholderTextColor={TEXT_FAINT}
                      />
                    </View>
                  </View>

                  {/* Headline */}
                  <View style={s.modalField}>
                    <Text style={s.modalLabel}>HEADLINE</Text>
                    <TextInput
                      style={s.modalInput}
                      value={editHeadline}
                      onChangeText={setEditHeadline}
                      placeholder="e.g. National Medalist | Target: 2028 Olympics"
                      placeholderTextColor={TEXT_FAINT}
                    />
                  </View>

                  {/* Career Goal */}
                  <View style={s.modalField}>
                    <Text style={s.modalLabel}>CURRENT GOAL</Text>
                    <TextInput
                      style={s.modalInput}
                      value={editGoal}
                      onChangeText={setEditGoal}
                      placeholder="e.g. Qualify for Asian Games 2026"
                      placeholderTextColor={TEXT_FAINT}
                    />
                  </View>

                  {/* Bio */}
                  <View style={s.modalField}>
                    <Text style={s.modalLabel}>BIO / STORY</Text>
                    <TextInput
                      style={[s.modalInput, { height: 75, textAlignVertical: 'top' }]}
                      value={editBio}
                      onChangeText={setEditBio}
                      placeholder="Tell supporters your story and journey..."
                      placeholderTextColor={TEXT_FAINT}
                      multiline
                    />
                  </View>
                </>
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={[s.modalSaveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.modalSaveBtnText}>SAVE CHANGES</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: TEXT_DIM,
    fontSize: 14,
    fontWeight: '600',
  },

  // Header Card
  headerCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  profileDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: TEXT_MAIN,
    marginBottom: 3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_LIGHT,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
  },
  userEmail: {
    fontSize: 12.5,
    color: TEXT_DIM,
    fontWeight: '500',
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  contactText: {
    fontSize: 12,
    color: TEXT_DIM,
    fontWeight: '600',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 10,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
  },

  // Athlete Highlight Card
  athleteHighlightCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  athleteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  athleteHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT_MAIN,
  },
  athleteInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  athleteInfoItem: {
    alignItems: 'center',
  },
  athleteInfoLabel: {
    fontSize: 11,
    color: TEXT_FAINT,
    fontWeight: '700',
    marginBottom: 2,
  },
  athleteInfoVal: {
    fontSize: 13,
    color: TEXT_MAIN,
    fontWeight: '800',
  },
  headlineText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: TEXT_DIM,
    textAlign: 'center',
    marginBottom: 14,
  },
  viewPublicProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
  },
  viewPublicProfileText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Stats Grid
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: TEXT_DIM,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '900',
    color: TEXT_MAIN,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_FAINT,
  },

  // Contributions List
  contributionsList: {
    gap: 10,
  },
  contribItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
  },
  contribLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  contribAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0891B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contribAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  contribAthleteName: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  contribCause: {
    fontSize: 11.5,
    color: TEXT_DIM,
    maxWidth: 180,
  },
  contribDate: {
    fontSize: 10,
    color: TEXT_FAINT,
    marginTop: 2,
  },
  contribRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  contribAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: SUCCESS_GREEN,
  },
  capturedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  capturedText: {
    fontSize: 10,
    fontWeight: '800',
    color: SUCCESS_GREEN,
  },
  emptyBox: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 17,
  },
  browseBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },

  // Logout Section
  logoutSection: {
    marginTop: 10,
    alignItems: 'center',
    gap: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    width: '100%',
    paddingVertical: 14,
  },
  logoutText: {
    color: ERROR_RED,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  versionText: {
    fontSize: 11,
    color: TEXT_FAINT,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_MAIN,
  },
  modalSubtitle: {
    fontSize: 12,
    color: TEXT_DIM,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  modalField: {
    marginBottom: 14,
    gap: 5,
  },
  modalLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: TEXT_DIM,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_MAIN,
    fontWeight: '500',
  },
  modalTwoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  modalDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 14,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  modalSaveBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  modalErrorText: {
    color: ERROR_RED,
    fontSize: 12,
    fontWeight: '700',
  },
  modalSuccessBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  modalSuccessText: {
    color: SUCCESS_GREEN,
    fontSize: 12,
    fontWeight: '700',
  },
});
