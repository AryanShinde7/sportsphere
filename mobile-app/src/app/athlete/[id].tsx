import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, Image, TextInput,
  Dimensions, Modal, Alert
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi, Storage, resolveImageUrl } from '../../utils/config';
import SportSearchPicker from '../../components/SportSearchPicker';
import CreateFundingRequestModal from '../../components/CreateFundingRequestModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PRIMARY    = '#E2550B';
const BG         = '#F9FAFB';
const CARD_BG    = '#FFFFFF';
const BORDER     = '#E5E7EB';
const TEXT_MAIN  = '#111827';
const TEXT_DIM   = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const AVATAR_COLORS = [
  '#C2410C', '#0891B2', '#7C3AED', '#059669',
  '#DB2777', '#CA8A04', '#2563EB', '#0D9488',
];

function getInitials(name: string) {
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
}
function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const BANNER_HEIGHT = 210;
const AVATAR_SIZE   = 88;

export default function AthleteProfileScreen() {
  const { id } = useLocalSearchParams();
  const [athlete,       setAthlete]       = useState<any>(null);
  const [currentUser,   setCurrentUser]   = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [bannerFailed,  setBannerFailed]  = useState(false);
  const [avatarFailed,  setAvatarFailed]  = useState(false);

  // Edit Athlete Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSportId, setEditSportId] = useState<number | null>(null);
  const [editSportName, setEditSportName] = useState('');
  const [editDiscipline, setEditDiscipline] = useState('');
  const [editState, setEditState] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCoach, setEditCoach] = useState('');
  const [editAcademy, setEditAcademy] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Create Campaign Modal State
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);

  // Photo & Banner Uploading State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Sponsorship form state
  const [showSponsorForm,  setShowSponsorForm]  = useState(false);
  const [orgName,          setOrgName]          = useState('');
  const [contactPerson,    setContactPerson]    = useState('');
  const [supportType,      setSupportType]      = useState('FINANCIAL');
  const [proposedAmount,   setProposedAmount]   = useState('250000');
  const [duration,         setDuration]         = useState('12 Months');
  const [message,          setMessage]          = useState('');
  const [sponsorLoading,   setSponsorLoading]   = useState(false);
  const [sponsorError,     setSponsorError]     = useState<string | null>(null);
  const [sponsorSuccess,   setSponsorSuccess]   = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAthlete();
      loadCurrentUser();
    }, [id])
  );

  const loadCurrentUser = async () => {
    try {
      const data = await Storage.getItem('userData');
      if (data) setCurrentUser(JSON.parse(data));
    } catch (e) {
      console.warn('Failed to load current user:', e);
    }
  };

  const isOwner = currentUser?.athleteProfile?.id === athlete?.id || currentUser?.id === athlete?.userId;

  const openEditModal = () => {
    setEditName(athlete.user?.name || '');
    setEditPhone(athlete.user?.phone || '');
    setEditSportId(athlete.sportId || athlete.sport?.id || null);
    setEditSportName(athlete.sport?.name || '');
    setEditDiscipline(athlete.discipline || '');
    setEditState(athlete.state || '');
    setEditCity(athlete.city || '');
    setEditHeadline(athlete.headline || '');
    setEditGoal(athlete.currentGoal || '');
    setEditBio(athlete.bio || '');
    setEditCoach(athlete.coachName || '');
    setEditAcademy(athlete.academyName || '');
    setEditError('');
    setEditSuccess('');
    setIsEditModalOpen(true);
  };

  const handleSaveAthleteProfile = async () => {
    setEditError('');
    setEditSuccess('');
    if (!editName.trim()) {
      setEditError('Name is required');
      return;
    }
    setEditSaving(true);
    try {
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
        coachName: editCoach.trim(),
        academyName: editAcademy.trim(),
      });
      setAthlete(res.athlete);
      if (currentUser) {
        const updatedUser = { ...currentUser, name: editName.trim(), athleteProfile: res.athlete };
        setCurrentUser(updatedUser);
        await Storage.setItem('userData', JSON.stringify(updatedUser));
      }
      setEditSuccess('Profile updated successfully!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess('');
      }, 700);
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update athlete profile');
    } finally {
      setEditSaving(false);
    }
  };

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
        setUploadingAvatar(true);
        const asset = result.assets[0];
        const res = await mobileApi.user.uploadProfileImage(asset.uri, asset.mimeType || undefined, asset.fileName || undefined);
        if (res.user) {
          await Storage.setItem('userData', JSON.stringify(res.user));
        }
        await fetchAthlete();
        Alert.alert('Success', 'Profile photo updated successfully!');
      }
    } catch (err: any) {
      console.error('Upload avatar error:', err);
      Alert.alert('Upload Error', err.response?.data?.error || 'Failed to update profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePickBanner = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your gallery to update your banner.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingBanner(true);
        const asset = result.assets[0];
        const res = await mobileApi.user.uploadBannerImage(asset.uri, asset.mimeType || undefined, asset.fileName || undefined);
        if (res.user) {
          await Storage.setItem('userData', JSON.stringify(res.user));
        }
        await fetchAthlete();
        Alert.alert('Success', 'Banner updated successfully!');
      }
    } catch (err: any) {
      console.error('Upload banner error:', err);
      Alert.alert('Upload Error', err.response?.data?.error || 'Failed to update banner.');
    } finally {
      setUploadingBanner(false);
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

  const fetchAthlete = async () => {
    try {
      const data = await mobileApi.athletes.getById(id as string);
      setAthlete(data);
    } catch (err) {
      console.error('Athlete detail error:', err);
    }
    setLoading(false);
  };

  const handleSponsorSubmit = async () => {
    if (!orgName.trim() || !contactPerson.trim()) {
      setSponsorError('Please provide your organization name and contact person.');
      return;
    }
    setSponsorError(null);
    setSponsorLoading(true);
    try {
      await mobileApi.sponsorship.createInterest(athlete.id, {
        organizationName: orgName.trim(),
        contactPerson: contactPerson.trim(),
        supportType,
        proposedAmount: proposedAmount ? `₹${proposedAmount}` : undefined,
        duration: duration.trim(),
        message: message.trim() || undefined,
      });
      setSponsorSuccess(true);
    } catch (err: any) {
      console.error('Sponsor proposal error:', err);
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 403
          ? 'Only registered sponsor accounts can submit corporate proposals.'
          : 'Failed to submit proposal. Please check server connection.');
      setSponsorError(msg);
    } finally {
      setSponsorLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!athlete) {
    return <View style={styles.center}><Text style={styles.text}>Athlete not found.</Text></View>;
  }

  const activeRequest = athlete.supportRequests?.find((r: any) => r.lifecycleStatus === 'ACTIVE');

  // Media helpers
  const assets: any[]  = athlete.mediaAssets || [];
  const bannerAsset    = assets.find((a: any) => a.type === 'BANNER');
  const avatarAsset    = assets.find((a: any) => a.type === 'AVATAR');
  const galleryAssets  = assets.filter((a: any) => a.type === 'GALLERY');
  const bannerUrl      = resolveImageUrl(bannerAsset?.url || athlete.user?.bannerImageUrl);
  const avatarUrl      = resolveImageUrl(avatarAsset?.url || athlete.user?.profileImageUrl);

  const isVerified = athlete.verifications?.some(
    (v: any) => v.category === 'IDENTITY' && v.status === 'VERIFIED'
  );
  const isPending = athlete.verifications?.some(
    (v: any) => v.category === 'IDENTITY' && v.status === 'PENDING_REVIEW'
  );

  const color    = getColor(athlete.user?.name || 'Athlete');
  const initials = getInitials(athlete.user?.name || 'Athlete');

  const pct = activeRequest
    ? Math.min(Math.round((activeRequest.amountSupported / activeRequest.targetAmount) * 100), 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Banner ── */}
      <View style={styles.bannerWrap}>
        {bannerUrl && !bannerFailed ? (
          <Image
            source={{ uri: bannerUrl }}
            style={styles.banner}
            resizeMode="cover"
            onError={() => setBannerFailed(true)}
          />
        ) : (
          <View style={[styles.banner, styles.bannerFallback, { backgroundColor: color }]}>
            <Text style={styles.bannerFallbackText}>{initials}</Text>
          </View>
        )}
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>

        {/* Change Banner Button (for profile owner) */}
        {isOwner && (
          <TouchableOpacity
            style={styles.ownerChangeBannerBtn}
            onPress={handlePickBanner}
            disabled={uploadingBanner}
            activeOpacity={0.8}
          >
            {uploadingBanner ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="camera" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.ownerChangeBannerText}>Change Banner</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Identity card (overlapping banner) ── */}
      <View style={styles.identityCard}>
        {/* Circular avatar overlapping banner bottom */}
        <View style={styles.avatarFrame}>
          <TouchableOpacity
            onPress={isOwner ? handlePickAvatar : undefined}
            disabled={!isOwner || uploadingAvatar}
            activeOpacity={isOwner ? 0.85 : 1}
          >
            {avatarUrl && !avatarFailed ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                onError={() => setBannerFailed(true)}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: color, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}

            {uploadingAvatar && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          {isOwner && (
            <TouchableOpacity
              style={styles.avatarCameraBadge}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={11} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Name + headline + meta */}
        <View style={styles.identityBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{athlete.user.name}</Text>
            {isVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
              </View>
            ) : isPending ? (
              <View style={[styles.verifiedBadge, { backgroundColor: '#FEF3C7', paddingHorizontal: 6, width: 'auto', height: 20, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                <Ionicons name="time" size={11} color="#D97706" />
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#B45309' }}>IN REVIEW</Text>
              </View>
            ) : null}
          </View>

          {isOwner && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity style={styles.ownerEditBtn} onPress={openEditModal} activeOpacity={0.8}>
                <Ionicons name="create-outline" size={15} color={PRIMARY} style={{ marginRight: 5 }} />
                <Text style={styles.ownerEditBtnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ownerEditBtn, { borderColor: PRIMARY, backgroundColor: PRIMARY }]}
                onPress={() => setIsCreateCampaignOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="rocket-outline" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={[styles.ownerEditBtnText, { color: '#FFFFFF' }]}>+ Request Funding</Text>
              </TouchableOpacity>
            </View>
          )}

          {athlete.headline ? (
            <Text style={styles.headline}>{athlete.headline}</Text>
          ) : null}

          {isVerified && athlete.publicVerificationSummary ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
              <Ionicons name="shield-checkmark" size={12} color="#059669" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#059669' }}>{athlete.publicVerificationSummary}</Text>
            </View>
          ) : isPending ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
              <Ionicons name="time-outline" size={12} color="#D97706" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#B45309' }}>Identity Verification Pending Admin Review</Text>
            </View>
          ) : null}

          <Text style={styles.sportMeta}>
            {athlete.sport?.name}{athlete.discipline ? ` · ${athlete.discipline}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="location-outline" size={13} color={TEXT_DIM} style={{ marginRight: 3 }} />
            <Text style={styles.locationMeta}>{athlete.city || 'India'}, {athlete.state || ''}</Text>
          </View>
        </View>
      </View>

      {/* ── Gallery carousel ── */}
      {galleryAssets.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gallery</Text>
          <FlatList
            data={galleryAssets}
            keyExtractor={(item: any) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 20, paddingRight: 8, gap: 10 }}
            renderItem={({ item: asset }: { item: any }) => (
              <Image
                source={{ uri: asset.url }}
                style={styles.galleryThumb}
                resizeMode="cover"
              />
            )}
          />
        </View>
      )}

      <View style={styles.contentWrap}>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.text}>{athlete.bio}</Text>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verified Achievements</Text>
          {athlete.achievements?.map((ach: any) => (
            <View key={ach.id} style={styles.achievementCard}>
              <Text style={styles.achTitle}>{ach.title}</Text>
              <Text style={styles.achDetails}>{ach.competition} · {ach.position}</Text>
              <Text style={
                ach.verificationStatus === 'VERIFIED'
                  ? styles.achVerified
                  : styles.achPending
              }>
                {ach.verificationStatus === 'VERIFIED' ? '✓ Admin Verified' : '⏳ Pending Review'}
              </Text>
            </View>
          ))}
        </View>

        {/* Active Campaign */}
        {activeRequest ? (
          <View style={styles.campaignSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.campaignLabel}>ACTIVE CAMPAIGN</Text>
              {activeRequest.category && (
                <View style={styles.campaignCatBadge}>
                  <Text style={styles.campaignCatText}>{activeRequest.category}</Text>
                </View>
              )}
            </View>
            <Text style={styles.campaignTitle}>{activeRequest.title}</Text>
            <Text style={[styles.text, { marginTop: 4 }]}>{activeRequest.description}</Text>

            {/* Document proof badge if attached */}
            <View style={styles.proofBadge}>
              <Ionicons name="document-text-outline" size={14} color="#059669" />
              <Text style={styles.proofBadgeText}>
                {activeRequest.budgetItems?.some((b: any) => b.evidenceFileId)
                  ? 'Official Proof & Documentation Attached'
                  : 'Verified Community Campaign · Public Ledger'}
              </Text>
            </View>

            {/* Budget breakdown */}
            {activeRequest.budgetItems?.length > 0 && (
              <View style={styles.budgetList}>
                <Text style={styles.budgetHeaderTitle}>Itemized Budget Breakdown</Text>
                {activeRequest.budgetItems.map((item: any) => (
                  <View key={item.id} style={styles.budgetRow}>
                    <Text style={styles.budgetDesc}>{item.description}</Text>
                    <Text style={styles.budgetAmt}>₹{item.amount?.toLocaleString('en-IN')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Funding progress */}
            <View style={styles.progressWrap}>
              <View style={styles.progressMeta}>
                <Text style={styles.progressRaised}>{inr(activeRequest.amountSupported)} raised</Text>
                <Text style={styles.progressPct}>{pct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={styles.progressGoal}>Goal: {inr(activeRequest.targetAmount)}</Text>
                <Text style={styles.progressRemaining}>
                  {inr(Math.max(0, activeRequest.targetAmount - activeRequest.amountSupported))} needed
                </Text>
              </View>
            </View>

            {/* Backers wall (last 5) */}
            {activeRequest.supports?.length > 0 && (
              <View style={styles.backersWrap}>
                <Text style={styles.backersLabel}>Recent Backers ({activeRequest.supports.length})</Text>
                {activeRequest.supports.map((s: any, idx: number) => (
                  <View key={s.id ?? idx} style={styles.backerRow}>
                    <View style={[styles.backerAvatar, { backgroundColor: getColor(s.supporter?.name || '?') }]}>
                      <Text style={styles.backerInitials}>
                        {getInitials(s.supporter?.name || '?')}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.backerName}>{s.supporter?.name || 'Anonymous'}</Text>
                      <Text style={styles.backerAmt}>{inr(s.amount)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.supportBtn}
              onPress={() => router.push(`/support/${activeRequest.id}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.supportBtnText}>SUPPORT WITH RAZORPAY →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          isOwner && (
            <View style={styles.noCampaignCard}>
              <View style={styles.noCampaignIconWrap}>
                <Ionicons name="cash-outline" size={24} color={PRIMARY} />
              </View>
              <Text style={styles.noCampaignTitle}>No Active Funding Campaign</Text>
              <Text style={styles.noCampaignSub}>
                Start a funding campaign to raise verified backing for equipment, tournament travel, or training.
              </Text>
              <TouchableOpacity
                style={styles.noCampaignBtn}
                onPress={() => setIsCreateCampaignOpen(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.noCampaignBtnText}>+ START FUNDING CAMPAIGN</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Corporate Sponsorship */}
        <View style={styles.sponsorSection}>
          <Text style={styles.sponsorTitle}>Corporate Sponsorship</Text>
          <Text style={styles.sponsorSubtitle}>
            Back athlete training, equipment, or travel through verified brand sponsorship.
          </Text>

          {sponsorSuccess ? (
            <View style={styles.sponsorSuccessCard}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>🤝</Text>
              <Text style={styles.sponsorSuccessTitle}>Proposal Submitted!</Text>
              <Text style={styles.sponsorSuccessDesc}>
                Your proposal has been recorded and forwarded for administrative review.
              </Text>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => { setSponsorSuccess(false); setShowSponsorForm(false); }}
              >
                <Text style={styles.resetBtnText}>Submit Another Proposal</Text>
              </TouchableOpacity>
            </View>
          ) : !showSponsorForm ? (
            <TouchableOpacity
              style={styles.sponsorToggleBtn}
              onPress={() => setShowSponsorForm(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.sponsorToggleBtnText}>💼 SUBMIT SPONSORSHIP PROPOSAL →</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.sponsorForm}>
              {sponsorError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {sponsorError}</Text>
                </View>
              )}
              <Text style={styles.inputLabel}>ORGANIZATION / BRAND NAME</Text>
              <TextInput
                style={styles.formInput} value={orgName} onChangeText={setOrgName}
                placeholder="e.g. Tata Sports Trust, TechCorp" placeholderTextColor={TEXT_FAINT}
              />
              <Text style={styles.inputLabel}>CONTACT PERSON</Text>
              <TextInput
                style={styles.formInput} value={contactPerson} onChangeText={setContactPerson}
                placeholder="e.g. Vikram Malhotra" placeholderTextColor={TEXT_FAINT}
              />
              <Text style={styles.inputLabel}>SUPPORT TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['FINANCIAL', 'EQUIPMENT', 'TRAVEL'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, supportType === type && styles.typeChipActive]}
                    onPress={() => setSupportType(type)}
                  >
                    <Text style={[styles.typeChipText, supportType === type && styles.typeChipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
                  <TextInput
                    style={styles.formInput} value={proposedAmount} onChangeText={setProposedAmount}
                    placeholder="250000" keyboardType="numeric" placeholderTextColor={TEXT_FAINT}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>DURATION</Text>
                  <TextInput
                    style={styles.formInput} value={duration} onChangeText={setDuration}
                    placeholder="12 Months" placeholderTextColor={TEXT_FAINT}
                  />
                </View>
              </View>
              <Text style={styles.inputLabel}>PROPOSAL MESSAGE</Text>
              <TextInput
                style={[styles.formInput, { height: 72, textAlignVertical: 'top' }]}
                value={message} onChangeText={setMessage}
                placeholder="Details regarding your sponsorship offer and requirements..."
                placeholderTextColor={TEXT_FAINT} multiline
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowSponsorForm(false); setSponsorError(null); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitSponsorBtn, sponsorLoading && { opacity: 0.7 }]}
                  onPress={handleSponsorSubmit} disabled={sponsorLoading}
                >
                  {sponsorLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.submitSponsorBtnText}>SEND PROPOSAL →</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ─── OWNER LOGOUT BUTTON (Requirement 2) ─── */}
        {isOwner && (
          <View style={styles.logoutWrapper}>
            <TouchableOpacity style={styles.ownerLogoutBtn} onPress={handleLogout} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.ownerLogoutText}>LOG OUT OF SPORTSPHERE</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── EDIT ATHLETE PROFILE MODAL ─── */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Athlete Profile</Text>
                <Text style={styles.modalSubtitle}>Update your sport, story and goals</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={TEXT_DIM} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {editError ? (
                <View style={styles.modalErrorBox}>
                  <Text style={styles.modalErrorText}>⚠ {editError}</Text>
                </View>
              ) : null}

              {editSuccess ? (
                <View style={styles.modalSuccessBox}>
                  <Text style={styles.modalSuccessText}>✓ {editSuccess}</Text>
                </View>
              ) : null}

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>FULL NAME *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your full name"
                  placeholderTextColor={TEXT_FAINT}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>PHONE NUMBER</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="10-digit phone number"
                  placeholderTextColor={TEXT_FAINT}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Requirement 4: Searchable Sport Picker + Custom Sport Creation */}
              <View style={styles.modalField}>
                <SportSearchPicker
                  selectedSportId={editSportId}
                  selectedSportName={editSportName}
                  onSelectSport={(sport) => {
                    setEditSportId(sport.id);
                    setEditSportName(sport.name);
                  }}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>DISCIPLINE / EVENT *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDiscipline}
                  onChangeText={setEditDiscipline}
                  placeholder="e.g. 100m Sprint, Flyweight"
                  placeholderTextColor={TEXT_FAINT}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.modalField, { flex: 1 }]}>
                  <Text style={styles.modalLabel}>STATE</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editState}
                    onChangeText={setEditState}
                    placeholder="State"
                    placeholderTextColor={TEXT_FAINT}
                  />
                </View>
                <View style={[styles.modalField, { flex: 1 }]}>
                  <Text style={styles.modalLabel}>CITY</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="City"
                    placeholderTextColor={TEXT_FAINT}
                  />
                </View>
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>PROFILE HEADLINE</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editHeadline}
                  onChangeText={setEditHeadline}
                  placeholder="e.g. State Gold Medalist | Target: 2028 Olympics"
                  placeholderTextColor={TEXT_FAINT}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>CURRENT GOAL</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editGoal}
                  onChangeText={setEditGoal}
                  placeholder="e.g. Qualify for National Games 2026"
                  placeholderTextColor={TEXT_FAINT}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>ABOUT / STORY</Text>
                <TextInput
                  style={[styles.modalInput, { height: 75, textAlignVertical: 'top' }]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Tell supporters your story..."
                  placeholderTextColor={TEXT_FAINT}
                  multiline
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.modalField, { flex: 1 }]}>
                  <Text style={styles.modalLabel}>COACH NAME</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCoach}
                    onChangeText={setEditCoach}
                    placeholder="Coach name"
                    placeholderTextColor={TEXT_FAINT}
                  />
                </View>
                <View style={[styles.modalField, { flex: 1 }]}>
                  <Text style={styles.modalLabel}>ACADEMY</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editAcademy}
                    onChangeText={setEditAcademy}
                    placeholder="Academy / Club"
                    placeholderTextColor={TEXT_FAINT}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modalSaveBtn, editSaving && { opacity: 0.7 }]}
                onPress={handleSaveAthleteProfile}
                disabled={editSaving}
                activeOpacity={0.85}
              >
                {editSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>SAVE PROFILE CHANGES</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Funding Campaign Modal */}
      <CreateFundingRequestModal
        visible={isCreateCampaignOpen}
        onClose={() => setIsCreateCampaignOpen(false)}
        onSuccess={() => {
          setIsCreateCampaignOpen(false);
          fetchAthlete();
        }}
        athleteName={athlete?.user?.name || 'Athlete'}
        sportName={athlete?.sport?.name || 'Sport'}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: BG },
  center:     { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  contentWrap:{ paddingHorizontal: 20 },

  // ── Banner ──
  bannerWrap: { position: 'relative', width: '100%', height: BANNER_HEIGHT },
  banner: {
    width: '100%',
    height: BANNER_HEIGHT,
    backgroundColor: '#1F2937',
  },
  bannerFallback: { justifyContent: 'center', alignItems: 'center' },
  bannerFallbackText: { fontSize: 80, fontWeight: '900', color: 'rgba(255,255,255,0.2)' },
  backBtn: {
    position: 'absolute',
    top: 44,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ownerChangeBannerBtn: {
    position: 'absolute',
    top: 44,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ownerChangeBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
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

  // ── Identity card ──
  identityCard: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingBottom: 20,
    paddingHorizontal: 20,
    // Avatar overlaps banner by AVATAR_SIZE/2
    paddingTop: AVATAR_SIZE / 2 + 10,
    marginTop: -(AVATAR_SIZE / 2),
    zIndex: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 3,
  },
  avatarFrame: {
    position: 'absolute',
    top: -(AVATAR_SIZE / 2),
    left: 20,
    borderRadius: AVATAR_SIZE / 2 + 3,
    borderWidth: 4,
    borderColor: CARD_BG,
    zIndex: 10,
    overflow: 'hidden',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarInitials: { color: '#fff', fontSize: 28, fontWeight: '900' },

  identityBody: { paddingTop: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:    { fontSize: 24, fontWeight: '900', color: TEXT_MAIN, letterSpacing: -0.4 },
  verifiedBadge: {
    backgroundColor: '#059669',
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  verifiedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  headline:    { fontSize: 14, color: TEXT_DIM, lineHeight: 19, marginTop: 6, fontWeight: '500' },
  sportMeta:   { fontSize: 13.5, color: PRIMARY, fontWeight: '800', marginTop: 8 },
  locationMeta:{ fontSize: 12, color: TEXT_FAINT, marginTop: 3, fontWeight: '500' },

  // ── Gallery ──
  section:      { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: TEXT_MAIN, marginBottom: 10, paddingHorizontal: 20 },
  galleryThumb: {
    width: 160,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },

  text: { color: TEXT_DIM, lineHeight: 22, fontSize: 14, paddingHorizontal: 0 },

  // ── Achievements ──
  achievementCard: {
    backgroundColor: BG, padding: 14, borderRadius: 12,
    marginBottom: 10, borderWidth: 1, borderColor: BORDER, marginHorizontal: 20,
  },
  achTitle:    { color: TEXT_MAIN, fontWeight: '800', fontSize: 14 },
  achDetails:  { color: TEXT_DIM, marginTop: 3, fontSize: 12.5 },
  achVerified: { color: '#059669', fontSize: 11, fontWeight: '800', marginTop: 6 },
  achPending:  { color: '#D97706', fontSize: 11, fontWeight: '700', marginTop: 6 },

  // ── Campaign ──
  campaignSection: {
    marginTop: 20, marginHorizontal: 20,
    backgroundColor: '#FFF7ED', padding: 18,
    borderRadius: 16, borderWidth: 1, borderColor: '#FFEDD5',
  },
  campaignLabel: {
    color: PRIMARY, fontWeight: '900', textTransform: 'uppercase',
    letterSpacing: 1.2, fontSize: 10.5, marginBottom: 6,
  },
  campaignTitle:  { color: TEXT_MAIN, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  budgetList:     { marginTop: 14, backgroundColor: CARD_BG, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FFEDD5' },
  budgetRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  budgetDesc:     { color: TEXT_DIM, fontSize: 13 },
  budgetAmt:      { color: TEXT_MAIN, fontWeight: '800', fontSize: 13 },

  progressWrap:   { marginTop: 14 },
  progressMeta:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressRaised: { color: '#059669', fontWeight: '900', fontSize: 14 },
  progressPct:    { color: PRIMARY, fontWeight: '900', fontSize: 14 },
  progressTrack:  { height: 7, backgroundColor: '#FFEDD5', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressFill:   { height: '100%', backgroundColor: PRIMARY, borderRadius: 4 },
  progressGoal:   { color: TEXT_FAINT, fontSize: 12, fontWeight: '500' },

  backersWrap:    { marginTop: 14, backgroundColor: CARD_BG, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FFEDD5' },
  backersLabel:   { fontSize: 11, fontWeight: '800', color: TEXT_DIM, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  backerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  backerAvatar:   { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  backerInitials: { color: '#fff', fontSize: 12, fontWeight: '800' },
  backerName:     { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  backerAmt:      { fontSize: 11.5, color: TEXT_FAINT, fontWeight: '500' },

    supportBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: PRIMARY, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  supportBtnText: { color: '#fff', fontWeight: '900', fontSize: 13.5, letterSpacing: 0.8 },
  campaignCatBadge: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  campaignCatText: {
    color: '#E11D48',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  proofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  proofBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  budgetHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 6,
  },
  progressRemaining: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  noCampaignCard: {
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    textAlign: 'center',
  },
  noCampaignIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  noCampaignTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 4,
  },
  noCampaignSub: {
    fontSize: 12.5,
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    maxWidth: 280,
  },
  noCampaignBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  noCampaignBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // ── Sponsor ──
  sponsorSection: {
    marginTop: 20, marginHorizontal: 20, marginBottom: 10,
    backgroundColor: '#F8FAFC', padding: 18,
    borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0',
  },
  sponsorTitle:    { color: '#0F172A', fontWeight: '900', fontSize: 16, marginBottom: 4 },
  sponsorSubtitle: { color: TEXT_DIM, fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  sponsorToggleBtn:{ backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  sponsorToggleBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  sponsorForm: { marginTop: 4 },
  inputLabel:  { fontSize: 10.5, fontWeight: '800', color: TEXT_DIM, letterSpacing: 0.8, marginBottom: 6 },
  formInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: TEXT_MAIN, marginBottom: 12,
  },
  typeChip:         { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  typeChipActive:   { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  typeChipText:     { fontSize: 11, fontWeight: '700', color: TEXT_DIM },
  typeChipTextActive:{ color: '#FFFFFF' },
  cancelBtn:        { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#E2E8F0', alignItems: 'center' },
  cancelBtnText:    { color: TEXT_DIM, fontWeight: '700', fontSize: 13 },
  submitSponsorBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0F172A', alignItems: 'center' },
  submitSponsorBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  sponsorSuccessCard: {
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  sponsorSuccessTitle:{ fontSize: 16, fontWeight: '900', color: '#166534', marginBottom: 4 },
  sponsorSuccessDesc: { fontSize: 12.5, color: '#15803D', textAlign: 'center', lineHeight: 18 },
  resetBtn:           { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#DCFCE7' },
  resetBtnText:       { fontSize: 12, fontWeight: '700', color: '#166534' },
  errorBox:           { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#F87171', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText:          { color: '#DC2626', fontSize: 12, fontWeight: '600' },

  // Owner Actions
  ownerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 6,
  },
  ownerEditBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
  logoutWrapper: {
    marginTop: 24,
    marginBottom: 10,
  },
  ownerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 12,
  },
  ownerLogoutText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Edit Modal
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
    marginBottom: 12,
    gap: 4,
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
    color: '#DC2626',
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
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
});

