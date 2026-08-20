import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView, RefreshControl,
  StatusBar, Image, Platform, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL, Storage } from '../utils/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PRIMARY = '#E2550B';
const BG = '#F3F4F6';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
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

/* ── Mobile Feed Post Card ── */
function AthleteCard({ item }: { item: any }) {
  const req = item.supportRequests?.[0];
  const icon = SPORT_ICONS[item.sport?.name] || '🏅';
  const color = getColor(item.user?.name || 'Athlete');
  const initials = getInitials(item.user?.name || 'Athlete');
  const pct = req ? Math.min(Math.round((req.amountSupported / req.targetAmount) * 100), 100) : 0;
  const verified = item.achievements?.filter((a: any) => a.verificationStatus === 'VERIFIED').length || 0;
  const imageUrl = item.user?.profileImageUrl;

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity 
        style={styles.cardHeader} 
        onPress={() => router.push(`/athlete/${item.id}`)}
        activeOpacity={0.8}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={styles.headerTextWrap}>
          <View style={styles.nameRow}>
            <Text style={styles.athleteName} numberOfLines={1}>{item.user?.name}</Text>
            {verified > 0 && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIconText}>✓ VERIFIED</Text>
              </View>
            )}
          </View>
          <Text style={styles.athleteSub} numberOfLines={1}>
            {icon} {item.sport?.name} {item.discipline ? `• ${item.discipline}` : ''}
          </Text>
          <Text style={styles.athleteLocation} numberOfLines={1}>{item.city}, {item.state}</Text>
        </View>
      </TouchableOpacity>

      {/* Caption/Bio */}
      {item.bio ? (
        <View style={styles.cardBody}>
          <Text style={styles.bio} numberOfLines={3}>{item.bio}</Text>
        </View>
      ) : null}

      {/* Hero Image */}
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={() => router.push(`/athlete/${item.id}`)}
        style={styles.imageContainer}
      >
        <Image 
          source={{ uri: imageUrl || 'https://images.unsplash.com/photo-1552667466-07770ae110d0?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80' }} 
          style={styles.postImage} 
        />
      </TouchableOpacity>

      {/* Footer / Stats */}
      <View style={styles.cardFooter}>
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statPillText}>🏆 {item.achievements?.length || 0} Achievements</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.statPillText, { color: '#059669' }]}>✓ {verified} Verified</Text>
          </View>
        </View>

        {/* Support Need Box */}
        {req && (
          <View style={styles.needBox}>
            <View style={styles.needHeader}>
              <Text style={styles.needTitle} numberOfLines={1}>{req.title}</Text>
              <Text style={styles.needPct}>{pct}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
            </View>
            <View style={styles.needMetaRow}>
              <Text style={styles.needMeta}>{inr(req.amountSupported)} raised</Text>
              <Text style={styles.needGoal}>Goal: {inr(req.targetAmount)}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => req ? router.push(`/support/${req.id}`) : router.push(`/athlete/${item.id}`)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnTextPrimary}>❤️ Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => router.push(`/athlete/${item.id}`)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnTextSecondary}>🤝 Sponsor</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ── Main Dashboard ── */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [athletes, setAthletes] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeSport, setActiveSport] = useState('All');
  const [sports, setSports] = useState<string[]>([]);
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
      const res = await axios.get(`${API_URL}/athletes`);
      setAthletes(res.data);
      setFiltered(res.data);
      const unique = [...new Set(res.data.map((a: any) => a.sport?.name).filter(Boolean))] as string[];
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
        <Text style={styles.loadingText}>Loading Sportsphere Feed...</Text>
      </View>
    );
  }

  const renderListHeader = () => (
    <View style={styles.listHeaderWrapper}>
      {/* Search Input */}
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

      {/* ── TOP STICKY APP BAR ── */}
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

      {/* ── SCROLLING FEED ── */}
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

      {/* ── NATIVE BOTTOM TAB BAR ── */}
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
  container: { 
    flex: 1, 
    backgroundColor: BG 
  },
  center: { 
    flex: 1, 
    backgroundColor: BG, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 12 
  },

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
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoW: { fontSize: 20, fontWeight: '900', color: TEXT_MAIN, letterSpacing: -0.8, fontStyle: 'italic' },
  logoA: { fontSize: 20, fontWeight: '900', color: PRIMARY, letterSpacing: -0.8, fontStyle: 'italic' },
  headerSub: { fontSize: 9.5, fontWeight: '700', color: TEXT_FAINT, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 1 },
  logoutBtn: { 
    backgroundColor: '#F3F4F6', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: BORDER 
  },
  logoutText: { fontSize: 10, fontWeight: '800', color: TEXT_DIM, letterSpacing: 0.8 },
  loadingText: { color: TEXT_DIM, fontSize: 14, fontWeight: '600' },

  // List Header / Search
  listHeaderWrapper: { 
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingTop: 10, 
    paddingBottom: 4 
  },
  searchWrap: { paddingHorizontal: 14, marginBottom: 8 },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: { fontSize: 13, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: TEXT_MAIN,
    fontSize: 13.5,
    fontWeight: '500',
    padding: 0,
  },
  clearBtn: { padding: 4 },
  searchFocused: { borderColor: PRIMARY },

  pillsRow: { 
    gap: 6, 
    paddingHorizontal: 14, 
    paddingVertical: 4, 
    alignItems: 'center' 
  },
  pill: {
    paddingHorizontal: 12, 
    paddingVertical: 7, 
    borderRadius: 16,
    backgroundColor: CARD_BG, 
    borderWidth: 1, 
    borderColor: BORDER,
  },
  pillActive: { 
    backgroundColor: TEXT_MAIN, 
    borderColor: TEXT_MAIN 
  },
  pillText: { fontSize: 11.5, fontWeight: '700', color: TEXT_DIM },
  pillTextActive: { color: '#fff' },

  count: { 
    paddingHorizontal: 16, 
    paddingTop: 8, 
    paddingBottom: 4, 
    fontSize: 11.5, 
    fontWeight: '600', 
    color: TEXT_FAINT 
  },

  listContainer: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },

  // Social Feed Card
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    marginHorizontal: 12,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12 
  },
  avatar: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#F3F4F6' 
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  headerTextWrap: { flex: 1, marginLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  athleteName: { fontSize: 14.5, fontWeight: '800', color: TEXT_MAIN },
  verifiedBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 0.8,
    borderColor: '#A7F3D0',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  verifiedIconText: { color: '#059669', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  athleteSub: { fontSize: 12, color: TEXT_DIM, marginTop: 1, fontWeight: '500' },
  athleteLocation: { fontSize: 11, color: TEXT_FAINT, marginTop: 1 },

  cardBody: { 
    paddingHorizontal: 12, 
    paddingBottom: 10 
  },
  bio: { fontSize: 13, color: '#374151', lineHeight: 18.5 },

  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: '#F3F4F6',
  },
  postImage: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },

  cardFooter: { padding: 12 },
  statsRow: { 
    flexDirection: 'row', 
    gap: 6, 
    marginBottom: 10 
  },
  statPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statPillText: { fontSize: 11, fontWeight: '700', color: TEXT_DIM },

  needBox: { 
    backgroundColor: '#F9FAFB', 
    padding: 10, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: BORDER, 
    marginBottom: 10 
  },
  needHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  needTitle: { fontSize: 12, fontWeight: '700', color: TEXT_MAIN, flex: 1 },
  needPct: { fontSize: 12, fontWeight: '800', color: PRIMARY },
  progressBar: { height: 5, backgroundColor: BORDER, borderRadius: 2.5, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 2.5 },
  needMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  needMeta: { fontSize: 10.5, color: TEXT_MAIN, fontWeight: '700' },
  needGoal: { fontSize: 10.5, color: TEXT_FAINT, fontWeight: '500' },

  actionBar: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: { 
    flex: 1, 
    paddingVertical: 9, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  actionBtnPrimary: { backgroundColor: PRIMARY },
  actionBtnSecondary: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: BORDER },
  actionBtnTextPrimary: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  actionBtnTextSecondary: { color: TEXT_MAIN, fontWeight: '800', fontSize: 12.5 },

  emptyState: { alignItems: 'center', paddingTop: 40, paddingBottom: 30 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  emptySub: { fontSize: 12, color: TEXT_DIM, marginTop: 2 },

  // Bottom Nav Bar
  bottomNav: {
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: CARD_BG,
    borderTopWidth: 1, 
    borderTopColor: BORDER, 
    alignItems: 'center',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -2 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 4, 
    elevation: 8,
  },
  navContainer: { 
    width: '100%', 
    maxWidth: 500, 
    height: 52, 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center' 
  },
  navItem: { 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingHorizontal: 16, 
    paddingVertical: 4 
  },
  navIcon: { fontSize: 16, marginBottom: 1 },
  navAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, marginBottom: 1 },
  navLabel: { fontSize: 9.5, fontWeight: '600', color: TEXT_FAINT },
});
