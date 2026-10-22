import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  RefreshControl,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileApi, Storage, resolveImageUrl } from '../utils/config';
import CreateFundingRequestModal from '../components/CreateFundingRequestModal';
import CreatePostModal from '../components/CreatePostModal';
import PostCard from '../components/PostCard';
import CampaignCard from '../components/CampaignCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PRIMARY       = '#E2550B';
const PRIMARY_LIGHT = '#FFF7ED';
const BG            = '#F3F4F6';
const CARD_BG       = '#FFFFFF';
const BORDER        = '#E5E7EB';
const TEXT_MAIN     = '#111827';
const TEXT_DIM      = '#4B5563';
const TEXT_FAINT    = '#9CA3AF';

const SPORT_ICONS: Record<string, string> = {
  Athletics: '🏃', Swimming: '🏊', Badminton: '🏸', Wrestling: '🤼',
  Boxing: '🥊', Shooting: '🎯', Weightlifting: '🏋️', Archery: '🏹',
  'Table Tennis': '🏓', Kabaddi: '⚡',
};

const AVATAR_COLORS = [
  '#C2410C', '#0891B2', '#7C3AED', '#059669',
  '#DB2777', '#CA8A04', '#2563EB', '#0D9488',
];

const CAMPAIGN_CATEGORIES = ['All', 'EQUIPMENT', 'COACHING', 'TRAVEL', 'NUTRITION', 'MEDICAL'];

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function getInitials(name: string) {
  return (name || 'Athlete')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getHeroUrl(item: any): string | null {
  const assets: any[] = item.mediaAssets || [];
  const banner  = assets.find((a: any) => a.type === 'BANNER');
  const gallery = assets.find((a: any) => a.type === 'GALLERY');
  const avatar  = assets.find((a: any) => a.type === 'AVATAR');
  const raw = (banner || gallery || avatar)?.url || item.user?.bannerImageUrl || null;
  return resolveImageUrl(raw);
}

function getAvatarUrl(item: any): string | null {
  const assets: any[] = item.mediaAssets || [];
  const raw = assets.find((a: any) => a.type === 'AVATAR')?.url || item.user?.profileImageUrl || null;
  return resolveImageUrl(raw);
}

/* ─────────────────────────────────────────
   Athlete Discovery Card
───────────────────────────────────────── */
function AthleteCard({ item }: { item: any }) {
  const req      = item.supportRequests?.[0];
  const icon     = SPORT_ICONS[item.sport?.name] || '🏅';
  const color    = getColor(item.user?.name || 'Athlete');
  const initials = getInitials(item.user?.name || 'Athlete');
  const rawPct   = req && req.targetAmount > 0
    ? Math.round((req.amountSupported / req.targetAmount) * 100)
    : 0;
  const barFill  = Math.min(Math.max(rawPct, req && req.amountSupported > 0 ? 3 : 0), 100);

  const isVerified = item.verifications?.some(
    (v: any) => v.category === 'IDENTITY' && v.status === 'VERIFIED'
  );
  const isPending = item.verifications?.some(
    (v: any) => v.category === 'IDENTITY' && v.status === 'PENDING_REVIEW'
  );

  const heroUrl   = getHeroUrl(item);
  const avatarUrl = getAvatarUrl(item);

  const [heroFailed,   setHeroFailed]   = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/athlete/${item.id}`)}
      activeOpacity={0.92}
    >
      {/* ── Hero photo ── */}
      <View style={styles.heroContainer}>
        {heroUrl && !heroFailed ? (
          <Image
            source={{ uri: heroUrl }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setHeroFailed(true)}
          />
        ) : (
          <View style={[styles.heroImage, styles.heroFallback, { backgroundColor: color }]}>
            <Text style={styles.heroFallbackInitials}>{initials}</Text>
          </View>
        )}

        <View style={styles.heroScrim} pointerEvents="none" />

        <View style={styles.heroBadgeRow}>
          {req && (
            <View style={styles.liveCampaignBadge}>
              <Text style={styles.liveCampaignText}>⚡ LIVE FUNDING</Text>
            </View>
          )}
          <View style={styles.sportChip}>
            <Text style={styles.sportChipText}>{icon}  {item.sport?.name}</Text>
          </View>
          {isVerified ? (
            <View style={styles.verifiedChip}>
              <Ionicons name="checkmark-circle" size={12} color="#059669" style={{ marginRight: 3 }} />
              <Text style={styles.verifiedChipText}>VERIFIED</Text>
            </View>
          ) : isPending ? (
            <View style={[styles.verifiedChip, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
              <Ionicons name="time-outline" size={12} color="#D97706" style={{ marginRight: 3 }} />
              <Text style={[styles.verifiedChipText, { color: '#B45309' }]}>IN REVIEW</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroOverlay}>
          {avatarUrl && !avatarFailed ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.heroAvatar}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <View style={[styles.heroAvatar, { backgroundColor: color, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.heroAvatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.heroName} numberOfLines={1}>{item.user?.name}</Text>
            <Text style={styles.heroHeadline} numberOfLines={2}>
              {item.headline || `${item.sport?.name}${item.discipline ? ` · ${item.discipline}` : ''} · ${item.city || 'India'}, ${item.state || ''}`}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Active funding bar ── */}
      {req ? (
        <View style={styles.fundingBar}>
          <View style={styles.campaignHeaderRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{req.category || 'EQUIPMENT'}</Text>
            </View>
            <Text style={styles.campaignCardTitle} numberOfLines={1}>
              {req.title}
            </Text>
          </View>

          <View style={styles.fundingMeta}>
            <Text style={styles.fundingRaised}>{inr(req.amountSupported)} raised</Text>
            <Text style={styles.fundingPct}>{rawPct}% funded</Text>
          </View>

          <View style={styles.fundingTrack}>
            <View style={[styles.fundingFill, { width: `${barFill}%` as any }]} />
          </View>

          <View style={styles.fundingFooter}>
            <Text style={styles.fundingGoal}>
              Goal: {inr(req.targetAmount)}
              {req.supports?.length > 0 ? ` · ${req.supports.length} backer${req.supports.length > 1 ? 's' : ''}` : ''}
            </Text>
            <TouchableOpacity
              style={styles.miniSupportBtn}
              onPress={() => router.push(`/support/${req.id}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.miniSupportBtnText}>❤️ Support with Razorpay</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────
   Main Dashboard Screen
───────────────────────────────────────── */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();

  // Primary Tab state: 'posts' | 'campaigns' | 'athletes'
  const [activeTab, setActiveTab] = useState<'posts' | 'campaigns' | 'athletes'>('posts');

  // Posts State
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedAthleteFilter, setSelectedAthleteFilter] = useState<number | null>(null);

  // Campaigns State
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignCategory, setCampaignCategory] = useState('All');

  // Athletes State
  const [athletes, setAthletes] = useState<any[]>([]);
  const [filteredAthletes, setFilteredAthletes] = useState<any[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [activeSport, setActiveSport] = useState('All');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Common State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modals
  const [isFundingModalVisible, setIsFundingModalVisible] = useState(false);
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);

  const loadUserData = async () => {
    try {
      const stored = await Storage.getItem('userData');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
      const fresh = await mobileApi.auth.getMe();
      if (fresh) {
        setCurrentUser(fresh);
        await Storage.setItem('userData', JSON.stringify(fresh));
      }
    } catch (e) {
      console.warn('Failed to load user data:', e);
    }
  };

  const fetchPosts = async () => {
    try {
      setPostsLoading(true);
      const data = await mobileApi.posts.getAll();
      setPosts(data);
    } catch (err) {
      console.error('Fetch posts error:', err);
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchCampaigns = async (silent = false) => {
    try {
      if (!silent) setCampaignsLoading(true);
      const data = await mobileApi.support.getAllSupportRequests();
      setCampaigns(data);
    } catch (err) {
      console.error('Fetch campaigns error:', err);
    } finally {
      if (!silent) setCampaignsLoading(false);
    }
  };

  const fetchAthletes = async () => {
    try {
      const data = await mobileApi.athletes.getAll();
      setAthletes(data);
      setFilteredAthletes(data);
      const unique = [...new Set(data.map((a: any) => a.sport?.name).filter(Boolean))] as string[];
      setSports(unique);
    } catch (err) {
      console.error('Fetch athletes error:', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchPosts(),
      fetchCampaigns(),
      fetchAthletes(),
      loadUserData(),
    ]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
      fetchCampaigns(true);
      fetchAthletes();
      loadUserData();

      // Real-time polling for live progress bar & campaigns across all users
      const interval = setInterval(() => {
        fetchCampaigns(true);
        fetchAthletes();
      }, 3500);

      return () => clearInterval(interval);
    }, [])
  );

  // Filter athletes
  useEffect(() => {
    let result = athletes;
    if (activeSport === '⚡ Needs Funding') {
      result = result.filter(a => a.supportRequests && a.supportRequests.length > 0);
    } else if (activeSport !== 'All') {
      result = result.filter(a => a.sport?.name === activeSport);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.user?.name?.toLowerCase().includes(q) ||
        a.sport?.name?.toLowerCase().includes(q) ||
        a.discipline?.toLowerCase().includes(q) ||
        a.state?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q) ||
        a.supportRequests?.[0]?.title?.toLowerCase().includes(q)
      );
    }
    setFilteredAthletes(result);
  }, [search, activeSport, athletes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, []);

  // Cheer toggle handler with optimistic update
  const handleCheerToggle = async (postId: number) => {
    // 1. Optimistic UI update
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const willCheer = !p.isCheered;
          return {
            ...p,
            isCheered: willCheer,
            cheerCount: willCheer ? p.cheerCount + 1 : Math.max(p.cheerCount - 1, 0),
          };
        }
        return p;
      })
    );

    // 2. Network call
    try {
      const res = await mobileApi.posts.toggleCheer(postId);
      if (res && res.success) {
        setPosts(prev =>
          prev.map(p => (p.id === postId ? { ...p, cheerCount: res.cheerCount, isCheered: res.cheered } : p))
        );
      }
    } catch (err) {
      console.error('Toggle cheer failed:', err);
      // Re-fetch to sync
      fetchPosts();
    }
  };

  // Delete post handler
  const handleDeletePost = async (postId: number) => {
    try {
      await mobileApi.posts.delete(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      console.error('Delete post error:', err);
    }
  };

  // Athlete Detection & Active Campaign resolution
  const isAthlete = currentUser?.role === 'ATHLETE';
  const myAthleteProfile = currentUser?.athleteProfile;
  const myAthleteId = myAthleteProfile?.id;

  const matchingAthleteCard = athletes.find(a => a.id === myAthleteId || a.userId === currentUser?.id);
  const myActiveCampaign =
    matchingAthleteCard?.supportRequests?.[0] ||
    myAthleteProfile?.supportRequests?.find((sr: any) => sr.lifecycleStatus === 'ACTIVE') ||
    campaigns.find(c => c.athleteId === myAthleteId);

  const myCampaignPct = myActiveCampaign && myActiveCampaign.targetAmount > 0
    ? Math.min(Math.round((myActiveCampaign.amountSupported / myActiveCampaign.targetAmount) * 100), 100)
    : 0;

  // Filter posts if an athlete circle was tapped in Stories bar
  const displayedPosts = selectedAthleteFilter
    ? posts.filter(p => p.athleteId === selectedAthleteFilter)
    : posts;

  // Filter campaigns by category
  const displayedCampaigns = campaignCategory === 'All'
    ? campaigns
    : campaigns.filter(c => c.category?.toUpperCase() === campaignCategory.toUpperCase());

  // Distinct athletes with posts for Stories Bar
  const athletesWithStories = athletes.filter(a => a.id && a.user?.name);

  if (loading && posts.length === 0 && athletes.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading SportSphere…</Text>
      </View>
    );
  }

  /* ─────────────────────────────────────────
     Top Stories Bar for Posts Tab
  ───────────────────────────────────────── */
  const renderStoriesBar = () => (
    <View style={styles.storiesContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContent}
      >
        {/* If Athlete: "Your Update" / Create Post button */}
        {isAthlete && (
          <TouchableOpacity
            style={styles.storyItem}
            onPress={() => setIsPostModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.myStoryAvatarWrap}>
              {currentUser?.profileImageUrl ? (
                <Image
                  source={{ uri: resolveImageUrl(currentUser.profileImageUrl)! }}
                  style={styles.storyAvatar}
                />
              ) : (
                <View style={[styles.storyAvatar, { backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={styles.storyInitials}>{getInitials(currentUser?.name || 'Athlete')}</Text>
                </View>
              )}
              <View style={styles.storyPlusBadge}>
                <Ionicons name="add" size={14} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>Your Update</Text>
          </TouchableOpacity>
        )}

        {/* If Athlete: "Raise Support" / Start Campaign chip */}
        {isAthlete && (
          <TouchableOpacity
            style={styles.storyItem}
            onPress={() => setIsFundingModalVisible(true)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.myStoryAvatarWrap,
                {
                  borderColor: '#059669',
                  backgroundColor: '#ECFDF5',
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <Ionicons name="rocket-outline" size={22} color="#059669" />
            </View>
            <Text style={[styles.storyName, { color: '#059669', fontWeight: '800' }]} numberOfLines={1}>
              + Fund Goal
            </Text>
          </TouchableOpacity>
        )}

        {/* "All" updates chip */}
        <TouchableOpacity
          style={styles.storyItem}
          onPress={() => setSelectedAthleteFilter(null)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.storyAvatarWrap,
              selectedAthleteFilter === null && styles.storyAvatarWrapActive,
              { backgroundColor: selectedAthleteFilter === null ? PRIMARY : '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={20}
              color={selectedAthleteFilter === null ? '#FFFFFF' : TEXT_DIM}
            />
          </View>
          <Text style={[styles.storyName, selectedAthleteFilter === null && styles.storyNameActive]} numberOfLines={1}>
            All
          </Text>
        </TouchableOpacity>

        {/* Athletes with stories */}
        {athletesWithStories.slice(0, 10).map(a => {
          const isSelected = selectedAthleteFilter === a.id;
          const aAvatar = a.mediaAssets?.find((m: any) => m.type === 'AVATAR')?.url || a.user?.profileImageUrl;
          const resolvedAvatar = resolveImageUrl(aAvatar);
          const icon = SPORT_ICONS[a.sport?.name] || '🏅';

          return (
            <TouchableOpacity
              key={a.id}
              style={styles.storyItem}
              onPress={() => setSelectedAthleteFilter(isSelected ? null : a.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.storyAvatarWrap, isSelected && styles.storyAvatarWrapActive]}>
                {resolvedAvatar ? (
                  <Image source={{ uri: resolvedAvatar }} style={styles.storyAvatar} />
                ) : (
                  <View style={[styles.storyAvatar, { backgroundColor: getColor(a.user?.name), justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={styles.storyInitials}>{getInitials(a.user?.name)}</Text>
                  </View>
                )}
                <View style={styles.storySportBadge}>
                  <Text style={{ fontSize: 10 }}>{icon}</Text>
                </View>
              </View>
              <Text style={[styles.storyName, isSelected && styles.storyNameActive]} numberOfLines={1}>
                {a.user?.name?.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected Filter Banner */}
      {selectedAthleteFilter && (
        <View style={styles.filterBanner}>
          <Text style={styles.filterBannerText}>
            Showing posts by {athletes.find(a => a.id === selectedAthleteFilter)?.user?.name || 'Athlete'}
          </Text>
          <TouchableOpacity onPress={() => setSelectedAthleteFilter(null)} style={styles.clearFilterBtn}>
            <Text style={styles.clearFilterText}>Show All ✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  /* ─────────────────────────────────────────
     Athlete Live Campaign Hub (for Fund Tab)
  ───────────────────────────────────────── */
  const renderAthleteHub = () => {
    if (!isAthlete) return null;

    return (
      <View style={styles.athleteHubContainer}>
        {myActiveCampaign ? (
          <View style={styles.liveHubCard}>
            <View style={styles.liveHubHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveHubBadge}>YOUR LIVE CAMPAIGN</Text>
                <View style={styles.liveCategoryChip}>
                  <Text style={styles.liveCategoryText}>{myActiveCampaign.category || 'EQUIPMENT'}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/athlete/${myAthleteId}`)}
                style={styles.viewCampaignBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.viewCampaignBtnText}>View →</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.liveHubTitle} numberOfLines={1}>
              {myActiveCampaign.title}
            </Text>

            <View style={styles.liveProgressMeta}>
              <Text style={styles.liveRaisedText}>{inr(myActiveCampaign.amountSupported)} raised</Text>
              <Text style={styles.livePctText}>{myCampaignPct}% of {inr(myActiveCampaign.targetAmount)}</Text>
            </View>
            <View style={styles.liveTrack}>
              <View style={[styles.liveFill, { width: `${Math.max(myCampaignPct, 3)}%` as any }]} />
            </View>

            <View style={styles.liveHubFooter}>
              <Text style={styles.liveBackerCount}>
                {myActiveCampaign.supports?.length || 0} community backer{(myActiveCampaign.supports?.length || 0) !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                style={styles.liveNewBtn}
                onPress={() => setIsFundingModalVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={13} color={PRIMARY} />
                <Text style={styles.liveNewBtnText}>New Campaign</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.startFundingCard}>
            <View style={styles.startFundingContent}>
              <View style={styles.startFundingIconWrap}>
                <Text style={{ fontSize: 24 }}>🚀</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.startFundingTitle}>Need Funds for Your Sport?</Text>
                <Text style={styles.startFundingSub}>
                  Calculate your itemized equipment, coaching, or travel budget and raise funds from verified donors.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.startFundingActionBtn}
              onPress={() => setIsFundingModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="rocket-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.startFundingActionText}>+ Start Funding Request</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  /* ─────────────────────────────────────────
     Header component for Athletes Tab
  ───────────────────────────────────────── */
  const renderAthletesHeader = () => (
    <View style={styles.athletesHeaderWrap}>
      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBarContainer, searchFocused && styles.searchFocused]}>
          <Ionicons
            name="search-outline"
            size={16}
            color={searchFocused ? PRIMARY : TEXT_FAINT}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search athletes, sports, cities…"
            placeholderTextColor={TEXT_FAINT}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
              <Text style={{ fontSize: 12, color: TEXT_FAINT }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsRow}
        style={{ marginBottom: 4 }}
      >
        {['All', '⚡ Needs Funding', ...sports].map(s => {
          const isActive = activeSport === s;
          const isFundingTab = s === '⚡ Needs Funding';
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.pill,
                isActive && styles.pillActive,
                isFundingTab && !isActive && styles.pillFundingHighlight,
              ]}
              onPress={() => setActiveSport(s)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.pillText,
                  isActive && styles.pillTextActive,
                  isFundingTab && !isActive && styles.pillFundingText,
                ]}
              >
                {s !== 'All' && s !== '⚡ Needs Funding' && SPORT_ICONS[s]
                  ? `${SPORT_ICONS[s]}  `
                  : ''}
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.count}>
        {filteredAthletes.length} {filteredAthletes.length === 1 ? 'athlete' : 'athletes'}
        {activeSport === '⚡ Needs Funding' ? ' actively raising funds' : ' in community'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Sticky Top App Bar ── */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.topBarContent}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.logoW}>SPORT</Text>
              <Text style={styles.logoA}>SPHERE</Text>
            </View>
            <Text style={styles.headerSub}>
              {activeTab === 'posts' && 'Athlete Journey & Updates'}
              {activeTab === 'campaigns' && 'Active Funding Campaigns'}
              {activeTab === 'athletes' && 'Verified Athlete Community'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Action button in header for athletes */}
            {isAthlete && (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => setIsFundingModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="rocket-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.quickActionBtnText}>
                  {activeTab === 'campaigns' ? 'New Campaign' : '+ Raise Support'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Profile Avatar Icon */}
            <TouchableOpacity
              style={styles.profileHeaderBtn}
              onPress={() => router.push('/profile' as any)}
              activeOpacity={0.8}
            >
              {currentUser?.profileImageUrl ? (
                <Image
                  source={{ uri: resolveImageUrl(currentUser.profileImageUrl)! }}
                  style={styles.profileAvatarMini}
                />
              ) : (
                <View style={styles.profileAvatarMini}>
                  <Text style={styles.profileAvatarMiniText}>
                    {getInitials(currentUser?.name || 'User')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── MAIN CONTENT (Switchable Tab Views) ── */}

      {/* TAB 1: POSTS (Instagram-Style Athlete Journey) */}
      {activeTab === 'posts' && (
        <FlatList
          data={displayedPosts}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={currentUser?.id}
              currentUserRole={currentUser?.role}
              currentUserAvatar={currentUser?.profileImageUrl}
              onCheerToggle={handleCheerToggle}
              onDelete={handleDeletePost}
              onCommentCountChange={(pId, count) => {
                setPosts(prev => prev.map(p => (p.id === pId ? { ...p, commentCount: count } : p)));
              }}
            />
          )}
          ListHeaderComponent={renderStoriesBar}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 90 + Math.max(insets.bottom, 16) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📸</Text>
              <Text style={styles.emptyTitle}>No journey updates yet</Text>
              <Text style={styles.emptySub}>
                {selectedAthleteFilter
                  ? 'This athlete has not posted any updates yet.'
                  : 'Be the first athlete to share your training journey with the community!'}
              </Text>
              {isAthlete && (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => setIsPostModalVisible(true)}
                >
                  <Text style={styles.emptyActionBtnText}>+ Share First Update</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* TAB 2: CAMPAIGNS (Fund & Razorpay Backing) */}
      {activeTab === 'campaigns' && (
        <FlatList
          data={displayedCampaigns}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => <CampaignCard campaign={item} />}
          ListHeaderComponent={
            <View>
              {renderAthleteHub()}

              {/* Category Filter Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
                style={{ marginBottom: 12 }}
              >
                {CAMPAIGN_CATEGORIES.map(cat => {
                  const isActive = campaignCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setCampaignCategory(cat)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {cat === 'All' ? '🌟 All Causes' : cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.count}>
                {displayedCampaigns.length} active funding campaign{displayedCampaigns.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 90 + Math.max(insets.bottom, 16) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚀</Text>
              <Text style={styles.emptyTitle}>No active campaigns found</Text>
              <Text style={styles.emptySub}>
                No campaigns match this category. Check back soon or start your own!
              </Text>
            </View>
          }
        />
      )}

      {/* TAB 3: ATHLETES (Verified Athlete Directory) */}
      {activeTab === 'athletes' && (
        <FlatList
          data={filteredAthletes}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => <AthleteCard item={item} />}
          ListHeaderComponent={renderAthletesHeader}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 90 + Math.max(insets.bottom, 16) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏅</Text>
              <Text style={styles.emptyTitle}>No athletes found</Text>
              <Text style={styles.emptySub}>
                Try searching for a different sport, athlete name, or city.
              </Text>
            </View>
          }
        />
      )}

      {/* ── Floating Action Button for Athletes on Posts Tab ── */}
      {isAthlete && activeTab === 'posts' && (
        <TouchableOpacity
          style={[styles.floatingActionBtn, { bottom: 85 + Math.max(insets.bottom, 10) }]}
          onPress={() => setIsPostModalVisible(true)}
          activeOpacity={0.88}
        >
          <Ionicons name="camera" size={20} color="#FFFFFF" />
          <Text style={styles.floatingActionBtnText}>Share Update</Text>
        </TouchableOpacity>
      )}

      {/* ── Bottom Navigation Bar ── */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.navContainer}>
          {/* 1. Posts Tab */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('posts')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'posts' ? 'images' : 'images-outline'}
              size={22}
              color={activeTab === 'posts' ? PRIMARY : TEXT_DIM}
            />
            <Text style={[styles.navLabel, activeTab === 'posts' && styles.navLabelActive]}>
              Posts
            </Text>
          </TouchableOpacity>

          {/* 2. Campaigns (Fund) Tab */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('campaigns')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'campaigns' ? 'rocket' : 'rocket-outline'}
              size={22}
              color={activeTab === 'campaigns' ? PRIMARY : TEXT_DIM}
            />
            <Text style={[styles.navLabel, activeTab === 'campaigns' && styles.navLabelActive]}>
              Fund
            </Text>
          </TouchableOpacity>

          {/* 3. Athletes Tab */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('athletes')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'athletes' ? 'people' : 'people-outline'}
              size={22}
              color={activeTab === 'athletes' ? PRIMARY : TEXT_DIM}
            />
            <Text style={[styles.navLabel, activeTab === 'athletes' && styles.navLabelActive]}>
              Athletes
            </Text>
          </TouchableOpacity>

          {/* 4. Profile Tab */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/profile' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={24} color={TEXT_DIM} />
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Modals ── */}

      {/* Post Creation Modal */}
      <CreatePostModal
        visible={isPostModalVisible}
        onClose={() => setIsPostModalVisible(false)}
        onSuccess={newPost => {
          if (newPost) {
            setPosts(prev => [newPost, ...prev]);
          } else {
            fetchPosts();
          }
        }}
        athleteName={currentUser?.name || 'Athlete'}
        sportName={currentUser?.athleteProfile?.sport?.name || 'Sport'}
        hasActiveCampaign={!!myActiveCampaign}
      />

      {/* Funding Request Modal */}
      <CreateFundingRequestModal
        visible={isFundingModalVisible}
        onClose={() => setIsFundingModalVisible(false)}
        onSuccess={() => {
          fetchCampaigns();
          fetchAthletes();
          loadUserData();
        }}
        athleteName={currentUser?.name || 'Athlete'}
        sportName={currentUser?.athleteProfile?.sport?.name || 'Sport'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  center:      { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: TEXT_DIM, fontSize: 14, fontWeight: '600' },

  // Sticky Top Bar
  topBar: {
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  logoW: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  logoA: {
    fontSize: 20,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_FAINT,
    marginTop: 1,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  quickActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  profileHeaderBtn: {
    padding: 2,
  },
  profileAvatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
  },
  profileAvatarMiniText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },

  // Stories Bar in Posts Tab
  storiesContainer: {
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 12,
    paddingVertical: 12,
  },
  storiesContent: {
    paddingHorizontal: 14,
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
    width: 68,
  },
  myStoryAvatarWrap: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  storyAvatarWrap: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  storyAvatarWrapActive: {
    borderColor: PRIMARY,
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  storyInitials: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  storyPlusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storySportBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  storyName: {
    fontSize: 11,
    color: TEXT_DIM,
    marginTop: 4,
    textAlign: 'center',
  },
  storyNameActive: {
    color: PRIMARY,
    fontWeight: '700',
  },
  filterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PRIMARY_LIGHT,
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterBannerText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '700',
  },
  clearFilterBtn: {
    padding: 2,
  },
  clearFilterText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '800',
  },

  // Athlete Personal Hub in Campaigns Tab
  athleteHubContainer: {
    marginBottom: 12,
  },
  liveHubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  liveHubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  liveHubBadge: {
    fontSize: 11,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  liveCategoryChip: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
  },
  viewCampaignBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  viewCampaignBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  },
  liveHubTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 10,
  },
  liveProgressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  liveRaisedText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
  },
  livePctText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  liveTrack: {
    height: 8,
    backgroundColor: '#FED7AA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  liveFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },
  liveHubFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBackerCount: {
    fontSize: 12,
    color: TEXT_DIM,
    fontWeight: '600',
  },
  liveNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 3,
  },
  liveNewBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
  },
  startFundingCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
  startFundingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  startFundingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  startFundingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 2,
  },
  startFundingSub: {
    fontSize: 12,
    color: TEXT_DIM,
    lineHeight: 16,
  },
  startFundingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    borderRadius: 12,
  },
  startFundingActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Athletes Directory Header
  athletesHeaderWrap: {
    marginBottom: 8,
  },
  searchWrap: {
    marginBottom: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchFocused: {
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_MAIN,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  pillsRow: {
    gap: 8,
    paddingBottom: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  pillFundingHighlight: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  pillFundingText: {
    color: PRIMARY,
    fontWeight: '700',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_DIM,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  count: {
    fontSize: 12,
    color: TEXT_FAINT,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },

  // Athlete Feed Card styles
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  heroContainer: {
    height: 190,
    width: '100%',
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroFallbackInitials: {
    fontSize: 48,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
  },
  heroScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroBadgeRow: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveCampaignBadge: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveCampaignText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sportChip: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sportChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  verifiedChipText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '900',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroAvatarInitials: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  heroHeadline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  fundingBar: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  campaignHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  categoryBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: '#C2410C',
    fontSize: 9,
    fontWeight: '800',
  },
  campaignCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MAIN,
    flex: 1,
  },
  fundingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fundingRaised: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
  fundingPct: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  fundingTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fundingFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },
  fundingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fundingGoal: {
    fontSize: 11,
    color: TEXT_FAINT,
  },
  miniSupportBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniSupportBtnText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '700',
  },

  // Floating Action Button
  floatingActionBtn: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    gap: 8,
  },
  floatingActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 8,
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_DIM,
    marginTop: 3,
  },
  navLabelActive: {
    color: PRIMARY,
    fontWeight: '800',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
