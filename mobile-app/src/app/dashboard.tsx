import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView, RefreshControl,
  StatusBar, Image
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const PRIMARY = '#E2550B';
const BG = '#F9FAFB';
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

/* ── Athlete Card (LinkedIn Post Style) ── */
function AthleteCard({ item }: { item: any }) {
  const req = item.supportRequests?.[0];
  const icon = SPORT_ICONS[item.sport?.name] || '🏅';
  const color = getColor(item.user.name);
  const initials = getInitials(item.user.name);
  const pct = req ? Math.min(Math.round((req.amountSupported / req.targetAmount) * 100), 100) : 0;
  const verified = item.achievements?.filter((a: any) => a.verificationStatus === 'VERIFIED').length || 0;
  const imageUrl = item.user.profileImageUrl;

  return (
    <View style={styles.card}>
      {/* Post Header (Avatar, Name, Tagline) */}
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
            <Text style={styles.athleteName}>{item.user.name}</Text>
            {verified > 0 && <Text style={styles.verifiedIcon}>✓</Text>}
          </View>
          <Text style={styles.athleteSub}>
            {icon} {item.sport?.name} {item.discipline ? `• ${item.discipline}` : ''}
          </Text>
          <Text style={styles.athleteLocation}>{item.city}, {item.state}</Text>
        </View>
      </TouchableOpacity>

      {/* Post Body (Bio/Caption) */}
      {item.bio ? (
        <View style={styles.cardBody}>
          <Text style={styles.bio} numberOfLines={3}>{item.bio}</Text>
        </View>
      ) : null}

      {/* Post Media (Edge-to-Edge Hero Image) */}
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={() => router.push(`/athlete/${item.id}`)}
      >
        <Image 
          source={{ uri: imageUrl || 'https://images.unsplash.com/photo-1552667466-07770ae110d0?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80' }} 
          style={styles.postImage} 
        />
      </TouchableOpacity>

      {/* Post Footer (Stats & Support) */}
      <View style={styles.cardFooter}>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            <Text style={styles.statBold}>{item.achievements?.length || 0}</Text> Achievements
          </Text>
          <Text style={styles.statText}>•</Text>
          <Text style={styles.statText}>
            <Text style={styles.statBold}>{verified}</Text> Verified
          </Text>
        </View>

        {req && (
          <View style={styles.needBox}>
            <View style={styles.needHeader}>
              <Text style={styles.needTitle} numberOfLines={1}>{req.title}</Text>
              <Text style={styles.needPct}>{pct}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
            </View>
            <Text style={styles.needMeta}>
              {inr(req.amountSupported)} raised of {inr(req.targetAmount)} goal
            </Text>
          </View>
        )}

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => req ? router.push(`/support/${req.id}`) : alert('No active request')}
          >
            <Text style={styles.actionBtnTextPrimary}>❤️ Support</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => alert('Sponsorship flow coming soon!')}
          >
            <Text style={styles.actionBtnTextSecondary}>🤝 Sponsor</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ── Main Screen ── */
export default function DashboardScreen() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeSport, setActiveSport] = useState('All');
  const [sports, setSports] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchAthletes();
    try {
      const u = JSON.parse(window.localStorage.getItem('userData') || 'null');
      setCurrentUser(u);
    } catch {}
  }, []);

  useEffect(() => {
    let result = athletes;
    if (activeSport !== 'All') result = result.filter(a => a.sport?.name === activeSport);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.user.name.toLowerCase().includes(q) ||
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
    } catch (err) { console.error(err); }
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
      alert('Profile view for non-athletes coming soon!');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('userToken');
      window.localStorage.removeItem('userData');
    }
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading athletes...</Text>
      </View>
    );
  }

  // The Search and Filters will scroll with the list
  const renderListHeader = () => (
    <View style={styles.listHeaderWrapper}>
      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.searchInput, searchFocused && styles.searchFocused]}
          placeholder="Search athletes, sports, cities…"
          placeholderTextColor={TEXT_FAINT}
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 60, minHeight: 60 }}
        contentContainerStyle={styles.pillsRow}
      >
        {['All', ...sports].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.pill, activeSport === s && styles.pillActive]}
            onPress={() => setActiveSport(s)}
            activeOpacity={0.75}
          >
            <Text style={[styles.pillText, activeSport === s && styles.pillTextActive]}>
              {s !== 'All' && SPORT_ICONS[s] ? `${SPORT_ICONS[s]}  ` : ''}{s.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.count}>
        {filtered.length} athlete{filtered.length !== 1 ? 's' : ''} actively seeking support
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── STICKY BRAND HEADER ── */}
      <View style={styles.stickyHeader}>
        <View style={styles.stickyHeaderContent}>
          <View>
            <Text style={styles.logo}>
              <Text style={{ color: TEXT_MAIN }}>SPORT</Text>
              <Text style={{ color: PRIMARY }}>SPHERE</Text>
            </Text>
            <Text style={styles.headerSub}>Verified athlete support</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>LOG OUT</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contentWrapper}>
        {/* ── SCROLLING FEED ── */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => <AthleteCard item={item} />}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={styles.listContainer}
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
              <Text style={styles.emptyText}>No athletes match these filters.</Text>
            </View>
          }
        />
      </View>

      {/* ── BOTTOM NAV ── */}
      <View style={styles.bottomNav}>
        <View style={styles.navContainer}>
          <TouchableOpacity style={styles.navItem} onPress={() => {}}>
            <View style={styles.navDotActive} />
            <Text style={[styles.navLabel, { color: PRIMARY }]}>DISCOVER</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => alert('Verify features coming soon')}>
            <View style={styles.navDotInactive} />
            <Text style={styles.navLabel}>VERIFY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleProfilePress}>
            {currentUser?.profileImageUrl ? (
              <Image source={{ uri: currentUser.profileImageUrl }} style={styles.navAvatar} />
            ) : (
              <View style={styles.navDotInactive} />
            )}
            <Text style={styles.navLabel}>PROFILE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', gap: 12 },
  contentWrapper: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }, // Narrower max-width for social feed feel

  // Sticky Header
  stickyHeader: {
    backgroundColor: CARD_BG,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    paddingTop: 54, paddingBottom: 16,
    zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  stickyHeaderContent: {
    width: '100%', maxWidth: 680, alignSelf: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  logo: { fontSize: 22, fontWeight: '900', letterSpacing: -1, fontStyle: 'italic' },
  headerSub: { fontSize: 10, fontWeight: '700', color: TEXT_FAINT, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  logoutBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  logoutText: { fontSize: 10, fontWeight: '800', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: 1.5 },
  loadingText: { color: TEXT_DIM, fontSize: 14, fontWeight: '600' },

  // List Header (Search/Filters)
  listHeaderWrapper: { paddingTop: 10, paddingBottom: 10 },
  searchWrap: { paddingHorizontal: 20, paddingVertical: 12 },
  searchInput: {
    backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: TEXT_MAIN, fontSize: 15, fontWeight: '500',
  },
  searchFocused: { borderColor: PRIMARY },

  pillsRow: { gap: 8, paddingHorizontal: 20, alignItems: 'center' },
  pill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER,
  },
  pillActive: { backgroundColor: TEXT_MAIN, borderColor: TEXT_MAIN },
  pillText: { fontSize: 12, fontWeight: '700', color: TEXT_DIM },
  pillTextActive: { color: '#fff' },

  count: { paddingHorizontal: 20, paddingVertical: 12, fontSize: 13, fontWeight: '500', color: TEXT_FAINT },

  listContainer: { paddingBottom: 120 },

  // LinkedIn-Style Card
  card: {
    backgroundColor: CARD_BG,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER,
    marginBottom: 16,
    paddingTop: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerTextWrap: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  athleteName: { fontSize: 16, fontWeight: '700', color: TEXT_MAIN },
  verifiedIcon: { backgroundColor: '#10B981', color: '#fff', fontSize: 9, fontWeight: '900', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  athleteSub: { fontSize: 13, color: TEXT_DIM, marginTop: 2 },
  athleteLocation: { fontSize: 12, color: TEXT_FAINT, marginTop: 2 },

  cardBody: { paddingHorizontal: 16, paddingBottom: 12 },
  bio: { fontSize: 14, color: TEXT_MAIN, lineHeight: 20 },

  postImage: { width: '100%', height: 320, backgroundColor: '#F3F4F6', resizeMode: 'cover' },

  cardFooter: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 12 },
  statText: { fontSize: 13, color: TEXT_DIM },
  statBold: { fontWeight: '700', color: TEXT_MAIN },

  needBox: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  needHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  needTitle: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN, flex: 1 },
  needPct: { fontSize: 14, fontWeight: '800', color: PRIMARY },
  progressBar: { height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 3 },
  needMeta: { fontSize: 12, color: TEXT_DIM, fontWeight: '500' },

  actionBar: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  actionBtnPrimary: { backgroundColor: PRIMARY },
  actionBtnSecondary: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: BORDER },
  actionBtnTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionBtnTextSecondary: { color: TEXT_MAIN, fontWeight: '700', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingBottom: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { color: TEXT_DIM, fontSize: 16, fontWeight: '600' },

  // Bottom Nav
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: CARD_BG,
    borderTopWidth: 1, borderTopColor: BORDER, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 10,
  },
  navContainer: { width: '100%', maxWidth: 800, height: 90, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 16 },
  navItem: { alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12 },
  navDotActive: { width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY },
  navDotInactive: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER },
  navAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: BORDER },
  navLabel: { fontSize: 10, fontWeight: '800', color: TEXT_FAINT, letterSpacing: 1, textTransform: 'uppercase' },
});
