import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView, RefreshControl,
  StatusBar, Image, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { mobileApi, Storage } from '../utils/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PRIMARY   = '#E2550B';
const BG        = '#F3F4F6';
const CARD_BG   = '#FFFFFF';
const BORDER    = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM  = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

const SPORT_ICONS: Record<string, string> = {
  Athletics: '🏃', Swimming: '🏊', Badminton: '🏸', Wrestling: '🤼',
  Boxing: '🥊', Shooting: '🎯', Weightlifting: '🏋️', Archery: '🏹',
  'Table Tennis': '🏓', Kabaddi: '⚡',
};

const AVATAR_COLORS = [
  '#C2410C', '#0891B2', '#7C3AED', '#059669',
  '#DB2777', '#CA8A04', '#2563EB', '#0D9488',
];

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function getInitials(name: string) {
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getHeroUrl(item: any): string | null {
  const assets: any[] = item.mediaAssets || [];
  const gallery = assets.find((a: any) => a.type === 'GALLERY');
  const avatar  = assets.find((a: any) => a.type === 'AVATAR');
  return (gallery || avatar)?.url || null;
}

function getAvatarUrl(item: any): string | null {
  const assets: any[] = item.mediaAssets || [];
  return assets.find((a: any) => a.type === 'AVATAR')?.url || null;
}

/* ─────────────────────────────────────────
   Hero Feed Card  (Phase 7C)
───────────────────────────────────────── */
function AthleteCard({ item }: { item: any }) {
  const req      = item.supportRequests?.[0];
  const icon     = SPORT_ICONS[item.sport?.name] || '🏅';
  const color    = getColor(item.user?.name || 'Athlete');
  const initials = getInitials(item.user?.name || 'Athlete');
  const pct      = req ? Math.min(Math.round((req.amountSupported / req.targetAmount) * 100), 100) : 0;

  const isVerified = item.verifications?.some(
    (v: any) => v.category === 'IDENTITY' && v.status === 'VERIFIED'
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

        {/* Scrim gradient over bottom half */}
        <View style={styles.heroScrim} pointerEvents="none" />

        {/* Top-right sport + verified chips */}
        <View style={styles.heroBadgeRow}>
          <View style={styles.sportChip}>
            <Text style={styles.sportChipText}>{icon}  {item.sport?.name}</Text>
          </View>
          {isVerified && (
            <View style={styles.verifiedChip}>
              <Text style={styles.verifiedChipText}>✓ VERIFIED</Text>
            </View>
          )}
        </View>

        {/* Bottom overlay — circular avatar + name + headline */}
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
              {item.headline || `${item.sport?.name}${item.discipline ? ` · ${item.discipline}` : ''} · ${item.city}, ${item.state}`}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Compact funding bar ── */}
      {req && (
        <View style={styles.fundingBar}>
          <View style={styles.fundingMeta}>
            <Text style={styles.fundingRaised}>{inr(req.amountSupported)} raised</Text>
            <Text style={styles.fundingPct}>{pct}%</Text>
          </View>
          <View style={styles.fundingTrack}>
            <View style={[styles.fundingFill, { width: `${pct}%` as any }]} />
          </View>
          <View style={styles.fundingFooter}>
            <Text style={styles.fundingGoal}>Goal: {inr(req.targetAmount)}</Text>
            <TouchableOpacity
              style={styles.miniSupportBtn}
              onPress={() => router.push(`/support/${req.id}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.miniSupportBtnText}>❤️ Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────
   Main Dashboard
───────────────────────────────────────── */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [athletes,    setAthletes]    = useState<any[]>([]);
  const [filtered,    setFiltered]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [activeSport, setActiveSport] = useState('All');
  const [sports,      setSports]      = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const loadUserData = async () => {
    try {
      const stored = await Storage.getItem('userData');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch (e) {
      console.warn('Failed to parse userData:', e);
    }
  };

  useEffect(() => {
    fetchAthletes();
    loadUserData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAthletes();
    }, [])
  );

  useEffect(() => {
    let result = athletes;
    if (activeSport !== 'All') result = result.filter(a => a.sport?.name === activeSport);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.user?.name?.toLowerCase().includes(q) ||
        a.sport?.name?.toLowerCase().includes(q) ||
        a.discipline?.toLowerCase().includes(q) ||
        a.state?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, activeSport, athletes]);

  const fetchAthletes = async () => {
    try {
      const data = await mobileApi.athletes.getAll();
      setAthletes(data);
      setFiltered(data);
      const unique = [...new Set(data.map((a: any) => a.sport?.name).filter(Boolean))] as string[];
      setSports(unique);
    } catch (err) {
      console.error('Fetch athletes error:', err);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAthletes();
  }, []);

  const handleProfilePress = () => {
    if (currentUser?.role === 'ATHLETE' && currentUser?.athleteProfile?.id) {
      router.push(`/athlete/${currentUser.athleteProfile.id}`);
    } else {
      alert(`User: ${currentUser?.name || 'Supporter'}\nRole: ${currentUser?.role || 'SUPPORTER'}`);
    }
  };

  const handleLogout = async () => {
    await Storage.removeItem('userToken');
    await Storage.removeItem('userData');
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading SportSphere Feed…</Text>
      </View>
    );
  }

  const renderListHeader = () => (
    <View style={styles.listHeaderWrapper}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBarContainer, searchFocused && styles.searchFocused]}>
          <Text style={styles.searchIcon}>🔍</Text>
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

      {/* Sport filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsRow}
        style={{ marginBottom: 4 }}
      >
        {['All', ...sports].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.pill, activeSport === s && styles.pillActive]}
            onPress={() => setActiveSport(s)}
            activeOpacity={0.75}
          >
            <Text style={[styles.pillText, activeSport === s && styles.pillTextActive]}>
              {s !== 'All' && SPORT_ICONS[s] ? `${SPORT_ICONS[s]}  ` : ''}{s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.count}>
        {filtered.length} {filtered.length === 1 ? 'athlete' : 'athletes'} in community
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Sticky App Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.topBarContent}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.logoW}>SPORT</Text>
              <Text style={styles.logoA}>SPHERE</Text>
            </View>
            <Text style={styles.headerSub}>Verified Athlete Community</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
            <Text style={styles.logoutText}>LOG OUT</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => <AthleteCard item={item} />}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={[styles.listContainer, { paddingBottom: 80 + Math.max(insets.bottom, 16) }]}
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
            <Text style={styles.emptySub}>Try searching for a different sport or state.</Text>
          </View>
        }
      />

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.navContainer}>
          <TouchableOpacity style={styles.navItem} onPress={() => {}} activeOpacity={0.7}>
            <Text style={styles.navIcon}>⚡</Text>
            <Text style={[styles.navLabel, { color: PRIMARY, fontWeight: '800' }]}>Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => alert('Verification badge system is live!')} activeOpacity={0.7}>
            <Text style={styles.navIcon}>🛡️</Text>
            <Text style={styles.navLabel}>Verify</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleProfilePress} activeOpacity={0.7}>
            {currentUser?.profileImageUrl ? (
              <Image source={{ uri: currentUser.profileImageUrl }} style={styles.navAvatar} />
            ) : (
              <Text style={styles.navIcon}>👤</Text>
            )}
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    width: '100%', maxWidth: 500, alignSelf: 'center',
    paddingHorizontal: 16, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  logoW:     { fontSize: 20, fontWeight: '900', color: TEXT_MAIN, letterSpacing: -0.8, fontStyle: 'italic' },
  logoA:     { fontSize: 20, fontWeight: '900', color: PRIMARY,   letterSpacing: -0.8, fontStyle: 'italic' },
  headerSub: { fontSize: 9.5, fontWeight: '700', color: TEXT_FAINT, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 1 },
  logoutBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  logoutText:{ fontSize: 10, fontWeight: '800', color: TEXT_DIM, letterSpacing: 0.8 },

  // Search + pills
  listHeaderWrapper:  { width: '100%', maxWidth: 500, alignSelf: 'center', paddingTop: 10, paddingBottom: 4 },
  searchWrap:         { paddingHorizontal: 14, marginBottom: 8 },
  searchBarContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02, shadowRadius: 2, elevation: 1,
  },
  searchIcon:    { fontSize: 13, marginRight: 8 },
  searchInput:   { flex: 1, color: TEXT_MAIN, fontSize: 13.5, fontWeight: '500', padding: 0 },
  clearBtn:      { padding: 4 },
  searchFocused: { borderColor: PRIMARY },
  pillsRow:      { gap: 6, paddingHorizontal: 14, paddingVertical: 4, alignItems: 'center' },
  pill:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
  pillActive:    { backgroundColor: TEXT_MAIN, borderColor: TEXT_MAIN },
  pillText:      { fontSize: 11.5, fontWeight: '700', color: TEXT_DIM },
  pillTextActive:{ color: '#fff' },
  count:         { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, fontSize: 11.5, fontWeight: '600', color: TEXT_FAINT },
  listContainer: { width: '100%', maxWidth: 500, alignSelf: 'center' },

  // ── Hero Card ──
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginHorizontal: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  heroContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#1F2937',
    position: 'relative',
    overflow: 'hidden',
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
    fontSize: 64,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.35)',
  },

  // Dark scrim — gradient effect using two overlapping semi-transparent views
  heroScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    backgroundColor: 'transparent',
    // React Native doesn't support CSS gradients in StyleSheet.
    // We fake a gradient with a solid-to-transparent black overlay.
    // The View has a very dark bottom half only.
  },

  heroBadgeRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  sportChip: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  sportChipText:  { color: '#fff', fontSize: 11, fontWeight: '800' },
  verifiedChip: {
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 20,
  },
  verifiedChipText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },

  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  heroAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    marginRight: 10,
    backgroundColor: '#374151',
  },
  heroAvatarInitials: { color: '#fff', fontSize: 16, fontWeight: '900' },
  heroName:           { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  heroHeadline:       { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, fontWeight: '500', marginTop: 2, lineHeight: 15 },

  // ── Compact funding bar ──
  fundingBar: {
    padding: 12,
    paddingTop: 10,
    backgroundColor: CARD_BG,
  },
  fundingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  fundingRaised: { fontSize: 12, fontWeight: '800', color: TEXT_MAIN },
  fundingPct:    { fontSize: 12, fontWeight: '900', color: PRIMARY },
  fundingTrack: {
    height: 5,
    backgroundColor: '#F3F4F6',
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
  fundingGoal:    { fontSize: 11, color: TEXT_FAINT, fontWeight: '500' },
  miniSupportBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  miniSupportBtnText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 40, paddingBottom: 30 },
  emptyIcon:  { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  emptySub:   { fontSize: 12, color: TEXT_DIM, marginTop: 2 },

  // Bottom Nav
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: BORDER, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 8,
  },
  navContainer: { width: '100%', maxWidth: 500, height: 52, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navItem:      { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 4 },
  navIcon:      { fontSize: 16, marginBottom: 1 },
  navAvatar:    { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, marginBottom: 1 },
  navLabel:     { fontSize: 9.5, fontWeight: '600', color: TEXT_FAINT },
});
