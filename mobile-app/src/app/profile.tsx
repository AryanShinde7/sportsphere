import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image, Modal, Alert, RefreshControl,
  Platform, Dimensions
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi, Storage, resolveImageUrl } from '../utils/config';
import SportSearchPicker from '../components/SportSearchPicker';
import CreateFundingRequestModal from '../components/CreateFundingRequestModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  // Photo & Banner Uploading State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Contributions stats for Contributor/Supporter
  const [contributions, setContributions] = useState<any[]>([]);
  const [totalContributed, setTotalContributed] = useState(0);
  const [athletesSupportedCount, setAthletesSupportedCount] = useState(0);

  // Athlete Campaign Creation Modal
  const [isFundingModalVisible, setIsFundingModalVisible] = useState(false);

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

  // Verification Modal & Submission State
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationCategory, setVerificationCategory] = useState<'IDENTITY' | 'ATHLETE_AFFILIATION' | 'ACHIEVEMENT'>('IDENTITY');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verificationSourceUrl, setVerificationSourceUrl] = useState('');
  const [verificationDocFile, setVerificationDocFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [verificationsList, setVerificationsList] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

  const loadProfileData = async () => {
    try {
      // Load cached user data first
      const cached = await Storage.getItem('userData');
      if (cached) {
        const parsed = JSON.parse(cached);
        setUser(parsed);
        populateEditFields(parsed);
      }

      // Fetch fresh profile from server
      const freshUser = await mobileApi.auth.getMe();
      if (freshUser) {
        setUser(freshUser);
        populateEditFields(freshUser);
        await Storage.setItem('userData', JSON.stringify(freshUser));
      }

      // If athlete, fetch their verifications
      if (freshUser?.role === 'ATHLETE') {
        try {
          const vData = await mobileApi.verification.getMyVerifications();
          setVerificationsList(Array.isArray(vData) ? vData : (vData?.verifications || []));
        } catch (vErr) {
          console.warn('Could not load verifications list', vErr);
        }
      }

      // If supporter/contributor, load their contributions ledger
      if (freshUser?.role !== 'ATHLETE') {
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

  const handlePickDocument = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your gallery to upload verification documents.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setVerificationDocFile({
          uri: asset.uri,
          name: asset.fileName || `doc_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err: any) {
      console.error('Pick document error:', err);
      Alert.alert('Error', 'Could not open document picker');
    }
  };

  const handleSubmitVerification = async () => {
    setVerificationError('');
    if (!verificationNotes.trim() && !verificationDocFile && !verificationSourceUrl.trim()) {
      setVerificationError('Please provide document details, a file, or an official link.');
      return;
    }

    if (!user?.athleteProfile?.id) {
      setVerificationError('Athlete profile not found.');
      return;
    }

    setSubmittingVerification(true);
    try {
      const claimRes = await mobileApi.verification.submitClaim({
        entityType: 'AthleteProfile',
        entityId: user.athleteProfile.id,
        category: verificationCategory,
        notes: verificationNotes.trim() || undefined,
      });

      const verificationId = claimRes?.verification?.id;

      if (verificationId && verificationDocFile) {
        await mobileApi.verification.uploadEvidenceFile(
          verificationId,
          verificationDocFile.uri,
          verificationDocFile.mimeType,
          verificationDocFile.name
        );
      }

      Alert.alert(
        'Verification Submitted!',
        'Your credentials have been securely transmitted to the SportSphere Admin Review Queue. Your status is now "IN REVIEW". An admin will verify your claim shortly.',
        [{
          text: 'OK',
          onPress: () => {
            setIsVerificationModalOpen(false);
            setVerificationNotes('');
            setVerificationDocFile(null);
            setVerificationSourceUrl('');
            loadProfileData();
          }
        }]
      );
    } catch (err: any) {
      console.error('Submit verification error:', err);
      setVerificationError(err.response?.data?.error || err.message || 'Failed to submit verification');
    } finally {
      setSubmittingVerification(false);
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

  // ─── PHOTO UPLOAD HANDLERS ───
  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your gallery to update your profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploadingAvatar(true);
        const res = await mobileApi.user.uploadProfileImage(asset.uri, asset.mimeType || undefined, asset.fileName || undefined);
        if (res.user) {
          setUser(res.user);
          await Storage.setItem('userData', JSON.stringify(res.user));
          Alert.alert('Success', 'Profile photo updated successfully!');
        }
      }
    } catch (err: any) {
      console.error('Pick avatar error:', err);
      Alert.alert('Upload Failed', err.response?.data?.error || err.message || 'Could not upload photo. Please check your network.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePickBanner = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your gallery to update your banner image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploadingBanner(true);
        const res = await mobileApi.user.uploadBannerImage(asset.uri, asset.mimeType || undefined, asset.fileName || undefined);
        if (res.user) {
          setUser(res.user);
          await Storage.setItem('userData', JSON.stringify(res.user));
          Alert.alert('Success', 'Banner image updated successfully!');
        }
      }
    } catch (err: any) {
      console.error('Pick banner error:', err);
      Alert.alert('Upload Failed', err.response?.data?.error || err.message || 'Could not upload banner. Please check your network.');
    } finally {
      setUploadingBanner(false);
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

  // Resolve media URLs
  const athleteAvatar = user?.athleteProfile?.mediaAssets?.find((m: any) => m.type === 'AVATAR')?.url;
  const athleteBanner = user?.athleteProfile?.mediaAssets?.find((m: any) => m.type === 'BANNER')?.url;

  const avatarUrl = resolveImageUrl(user?.profileImageUrl || athleteAvatar);
  const bannerUrl = resolveImageUrl(user?.bannerImageUrl || athleteBanner);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadProfileData();
          }}
          tintColor={PRIMARY}
        />
      }
    >
      {/* ─── BANNER HEADER ─── */}
      <View style={s.bannerWrap}>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={s.bannerImage} resizeMode="cover" />
        ) : (
          <View style={[s.bannerImage, s.bannerFallback]}>
            <Text style={s.bannerFallbackIcon}>{isAthlete ? '⚡' : '🏅'}</Text>
          </View>
        )}

        {/* Scrim Overlay */}
        <View style={s.bannerScrim} pointerEvents="none" />

        {/* Change Banner Button */}
        <TouchableOpacity
          style={s.changeBannerBtn}
          onPress={handlePickBanner}
          disabled={uploadingBanner}
          activeOpacity={0.8}
        >
          {uploadingBanner ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="camera" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={s.changeBannerBtnText}>{bannerUrl ? 'Change Banner' : 'Add Banner'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── USER PROFILE HEADER CARD (Overlapping Banner) ─── */}
      <View style={s.headerCard}>
        <View style={s.avatarOverlapRow}>
          {/* Circular Avatar with Camera Badge */}
          <View style={s.avatarContainer}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.85}
              style={s.avatarFrame}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarText}>{getInitials(user?.name)}</Text>
                </View>
              )}

              {uploadingAvatar && (
                <View style={s.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Camera Overlay Badge */}
            <TouchableOpacity
              style={s.cameraBadge}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* User Details */}
          <View style={s.profileDetails}>
            <Text style={s.userName} numberOfLines={1}>{user?.name || 'SportSphere User'}</Text>
            <View style={s.roleBadge}>
              <Ionicons name={roleIcon as any} size={13} color={PRIMARY} style={{ marginRight: 4 }} />
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
            <Text style={s.contactText}>
              Joined {new Date(user?.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Action Buttons: Edit Profile + Change Photos */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.editProfileBtn, { flex: 1 }]}
            onPress={() => {
              populateEditFields(user);
              setIsEditModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={15} color={PRIMARY} style={{ marginRight: 5 }} />
            <Text style={s.editProfileBtnText}>Edit Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.editProfileBtn, { backgroundColor: '#F3F4F6', borderColor: BORDER }]}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
          >
            <Ionicons name="image-outline" size={15} color={TEXT_MAIN} style={{ marginRight: 5 }} />
            <Text style={[s.editProfileBtnText, { color: TEXT_MAIN }]}>Change Photo</Text>
          </TouchableOpacity>
        </View>
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
              <Text style={s.athleteInfoVal}>
                {user.athleteProfile.city ? `${user.athleteProfile.city}, ${user.athleteProfile.state}` : 'India'}
              </Text>
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
              <Text style={s.emptySub}>
                Browse athletes in need of gear, travel, and training support to start backing Indian champions.
              </Text>
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
                      <View style={{ flex: 1 }}>
                        <Text style={s.contribAthleteName}>{athleteName}</Text>
                        <Text style={s.contribCause} numberOfLines={1}>
                          {sr?.title || 'Athlete Support Campaign'}
                        </Text>
                        <Text style={s.contribDate}>
                          {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
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

      {/* ─── LOGOUT BUTTON ─── */}
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
                <Text style={s.modalSubtitle}>
                  {isAthlete ? 'Update your athletic portfolio & photos' : 'Update your personal details & photos'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={TEXT_DIM} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
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

              {/* Photos Quick Upload Row */}
              <View style={s.modalField}>
                <Text style={s.modalLabel}>PROFILE & BANNER PHOTOS</Text>
                <View style={s.photoPickerRow}>
                  {/* Avatar Picker Card */}
                  <TouchableOpacity
                    style={s.photoPickerCard}
                    onPress={handlePickAvatar}
                    activeOpacity={0.75}
                  >
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={s.photoPickerThumb} />
                    ) : (
                      <View style={[s.photoPickerThumb, { backgroundColor: PRIMARY_LIGHT }]}>
                        <Ionicons name="person" size={24} color={PRIMARY} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.photoPickerTitle}>Profile Photo</Text>
                      <Text style={s.photoPickerSub}>Tap to upload avatar</Text>
                    </View>
                    <Ionicons name="camera-outline" size={18} color={PRIMARY} />
                  </TouchableOpacity>

                  {/* Banner Picker Card */}
                  <TouchableOpacity
                    style={s.photoPickerCard}
                    onPress={handlePickBanner}
                    activeOpacity={0.75}
                  >
                    {bannerUrl ? (
                      <Image source={{ uri: bannerUrl }} style={s.photoPickerThumbBanner} resizeMode="cover" />
                    ) : (
                      <View style={[s.photoPickerThumbBanner, { backgroundColor: '#F3F4F6' }]}>
                        <Ionicons name="image" size={20} color={TEXT_FAINT} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.photoPickerTitle}>Banner Cover</Text>
                      <Text style={s.photoPickerSub}>Tap to upload banner</Text>
                    </View>
                    <Ionicons name="camera-outline" size={18} color={PRIMARY} />
                  </TouchableOpacity>
                </View>
              </View>

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

                  {/* Sport Search Picker */}
                  <View style={s.modalField}>
                    <SportSearchPicker
                      selectedSportId={editSportId}
                      selectedSportName={editSportName}
                      onSelectSport={sport => {
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
              <View style={{ height: 24 }} />
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

  // ── Banner Header ──
  bannerWrap: {
    width: '100%',
    height: 155,
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerFallbackIcon: {
    fontSize: 48,
    opacity: 0.25,
  },
  bannerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  changeBannerBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  changeBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Overlapping Header Card ──
  headerCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: -38,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarOverlapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    width: 74,
    height: 74,
  },
  avatarFrame: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: PRIMARY,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  profileDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_MAIN,
    marginBottom: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_LIGHT,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 3,
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: PRIMARY,
  },
  userEmail: {
    fontSize: 12,
    color: TEXT_DIM,
    fontWeight: '500',
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contactText: {
    fontSize: 11,
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
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  editProfileBtnText: {
    color: PRIMARY,
    fontSize: 12.5,
    fontWeight: '800',
  },

  // ── Athlete Section ──
  athleteHighlightCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  athleteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  athleteHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  athleteInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  athleteInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  athleteInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_FAINT,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  athleteInfoVal: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MAIN,
    textAlign: 'center',
  },
  headlineText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: TEXT_DIM,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  viewPublicProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 10,
  },
  viewPublicProfileText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── Contributor Section ──
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: TEXT_FAINT,
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
  },
  statVal: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT_MAIN,
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: TEXT_FAINT,
    textAlign: 'center',
  },
  emptyBox: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11.5,
    color: TEXT_DIM,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    marginBottom: 14,
  },
  browseBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  contributionsList: {
    gap: 8,
  },
  contribItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
  },
  contribLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  contribAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contribAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  contribAthleteName: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  contribCause: {
    fontSize: 11,
    color: TEXT_DIM,
    marginTop: 1,
  },
  contribDate: {
    fontSize: 10,
    color: TEXT_FAINT,
    marginTop: 2,
  },
  contribRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  contribAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: SUCCESS_GREEN,
    marginBottom: 3,
  },
  capturedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  capturedText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: SUCCESS_GREEN,
  },

  // Logout
  logoutSection: {
    marginHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
  },
  logoutText: {
    color: ERROR_RED,
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  versionText: {
    fontSize: 10.5,
    color: TEXT_FAINT,
    marginTop: 12,
  },

  // ── Modal ──
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
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: TEXT_MAIN,
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: TEXT_DIM,
    marginTop: 2,
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  modalField: {
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: TEXT_DIM,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoPickerCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 10,
  },
  photoPickerThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPickerThumbBanner: {
    width: 44,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPickerTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  photoPickerSub: {
    fontSize: 9.5,
    color: TEXT_FAINT,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: TEXT_MAIN,
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: PRIMARY,
    marginBottom: 12,
  },
  modalSaveBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    color: ERROR_RED,
    fontSize: 12,
    fontWeight: '600',
  },
  modalSuccessBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalSuccessText: {
    color: SUCCESS_GREEN,
    fontSize: 12,
    fontWeight: '600',
  },
});
