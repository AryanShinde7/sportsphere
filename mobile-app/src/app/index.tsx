import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform,
  ScrollView, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL, Storage, mobileApi } from '../utils/config';
import SportSearchPicker from '../components/SportSearchPicker';

const PRIMARY = '#E2550B';
const PRIMARY_LIGHT = '#FFF7ED';
const PRIMARY_BORDER = '#FDBA74';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';
const SUCCESS_BG = '#ECFDF5';
const SUCCESS_BORDER = '#A7F3D0';
const SUCCESS_TXT = '#065F46';

const SPORT_ICONS: Record<string, string> = {
  Athletics: '🏃', Swimming: '🏊', Badminton: '🏸', Wrestling: '🤼',
  Boxing: '🥊', Shooting: '🎯', Weightlifting: '🏋️', Archery: '🏹',
  'Table Tennis': '🏓', Kabaddi: '⚡',
};

type RoleType = 'ATHLETE' | 'SUPPORTER';

interface SportItem {
  id: number;
  name: string;
  category: string;
}

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<RoleType>('ATHLETE');

  // Common credentials
  const [email, setEmail] = useState('supporter@demo.com');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Athlete specific fields
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null);
  const [selectedSportName, setSelectedSportName] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [headline, setHeadline] = useState('');
  const [currentGoal, setCurrentGoal] = useState('');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [focusField, setFocusField] = useState('');

  // Initialize default sport if empty
  useEffect(() => {
    async function initDefaultSport() {
      try {
        const list = await mobileApi.sports.getAll();
        if (list.length > 0 && !selectedSportId) {
          setSelectedSportId(list[0].id);
          setSelectedSportName(list[0].name);
        }
      } catch (e) {
        console.warn('Could not load default sport:', e);
      }
    }
    initDefaultSport();
  }, []);

  const handleAuth = async () => {
    setError('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setError('Please provide your email and password.');
      return;
    }

    if (!isLogin && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!isLogin && role === 'ATHLETE') {
      if (!selectedSportId && !selectedSportName.trim()) {
        setError('Please select or search your primary sport.');
        return;
      }
      if (!discipline.trim()) {
        setError('Please enter your athletic discipline or event (e.g. 100m Sprint, Flyweight).');
        return;
      }
      if (!state.trim() || !city.trim()) {
        setError('Please provide your state and city.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const res = await axios.post(`${API_URL}/auth/login`, {
          email: email.trim(),
          password
        });

        await Storage.setItem('userToken', res.data.token);
        await Storage.setItem('userData', JSON.stringify(res.data.user));

        if (res.data.user?.role === 'ATHLETE' && res.data.user?.athleteProfile?.id) {
          router.replace('/dashboard');
        } else {
          router.replace('/dashboard');
        }
      } else {
        const registerPayload: any = {
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
          role,
        };

        if (role === 'ATHLETE') {
          if (selectedSportId && selectedSportId > 0) {
            registerPayload.sportId = selectedSportId;
          }
          if (selectedSportName) {
            registerPayload.sportName = selectedSportName.trim();
          }
          registerPayload.discipline = discipline.trim();
          registerPayload.state = state.trim();
          registerPayload.city = city.trim();
          registerPayload.headline = headline.trim() || `${name.trim()} · ${discipline.trim()} Athlete`;
          registerPayload.currentGoal = currentGoal.trim() || undefined;
          registerPayload.bio = bio.trim() || undefined;
        }

        const res = await axios.post(`${API_URL}/auth/register`, registerPayload);

        await Storage.setItem('userToken', res.data.token);
        await Storage.setItem('userData', JSON.stringify(res.data.user));

        setSuccessMsg(`Welcome to SportSphere, ${res.data.user?.name}!`);
        setTimeout(() => {
          router.replace('/dashboard');
        }, 600);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const serverMsg = err.response?.data?.error;
      const networkMsg = err.message?.includes('Network Error')
        ? `Could not reach backend at ${API_URL}. Check network connection.`
        : null;
      setError(serverMsg || networkMsg || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  const autofillDemo = (type: 'supporter' | 'athlete') => {
    setIsLogin(true);
    setError('');
    setSuccessMsg('');
    if (type === 'supporter') {
      setEmail('supporter@demo.com');
      setPassword('password123');
    } else {
      setEmail('aarav@athlete.com');
      setPassword('password123');
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.wrapper}>

            {/* ─── BRAND ─── */}
            <View style={s.brandBlock}>
              <View style={s.brandRow}>
                <Text style={s.brandW}>SPORT</Text>
                <Text style={s.brandA}>SPHERE</Text>
              </View>
              <Text style={s.tagline}>VERIFIED ATHLETE CROWDFUNDING · INDIA</Text>
            </View>

            {/* ─── MAIN CARD ─── */}
            <View style={s.card}>

              {/* Top Navigation Tabs */}
              <View style={s.tabs}>
                <TouchableOpacity
                  style={[s.tab, isLogin && s.tabOn]}
                  onPress={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabTxt, isLogin && s.tabTxtOn]}>SIGN IN</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.tab, !isLogin && s.tabOn]}
                  onPress={() => {
                    setIsLogin(false);
                    setError('');
                    setSuccessMsg('');
                    setEmail('');
                    setPassword('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabTxt, !isLogin && s.tabTxtOn]}>OPEN ACCOUNT</Text>
                </TouchableOpacity>
              </View>

              {/* Form Body */}
              <View style={s.form}>

                {/* ─── ROLE SELECTOR (Register mode only) ─── */}
                {!isLogin && (
                  <View style={s.roleSection}>
                    <Text style={s.sectionHeader}>SELECT YOUR ACCOUNT TYPE</Text>
                    <View style={s.roleRow}>
                      <TouchableOpacity
                        style={[s.roleCard, role === 'ATHLETE' && s.roleCardOn]}
                        onPress={() => setRole('ATHLETE')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="fitness"
                          size={24}
                          color={role === 'ATHLETE' ? PRIMARY : TEXT_DIM}
                        />
                        <Text style={[s.roleTitle, role === 'ATHLETE' && s.roleTitleOn]}>Athlete</Text>
                        <Text style={s.roleSubtitle}>Raise funds & get verified</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.roleCard, role === 'SUPPORTER' && s.roleCardOn]}
                        onPress={() => setRole('SUPPORTER')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="people"
                          size={24}
                          color={role === 'SUPPORTER' ? PRIMARY : TEXT_DIM}
                        />
                        <Text style={[s.roleTitle, role === 'SUPPORTER' && s.roleTitleOn]}>Contributor</Text>
                        <Text style={s.roleSubtitle}>Back athletes & track results</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Full Name (Register mode) */}
                {!isLogin && (
                  <View style={s.field}>
                    <Text style={s.label}>FULL NAME *</Text>
                    <TextInput
                      style={[s.input, focusField === 'name' && s.inputOn]}
                      placeholder={role === 'ATHLETE' ? 'e.g. Neeraj Chopra' : 'e.g. Rajesh Kumar'}
                      placeholderTextColor={TEXT_FAINT}
                      value={name}
                      onChangeText={setName}
                      onFocus={() => setFocusField('name')}
                      onBlur={() => setFocusField('')}
                    />
                  </View>
                )}

                {/* Email Address */}
                <View style={s.field}>
                  <Text style={s.label}>EMAIL ADDRESS *</Text>
                  <TextInput
                    style={[s.input, focusField === 'email' && s.inputOn]}
                    placeholder="your@email.com"
                    placeholderTextColor={TEXT_FAINT}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onFocus={() => setFocusField('email')}
                    onBlur={() => setFocusField('')}
                  />
                </View>

                {/* Password */}
                <View style={s.field}>
                  <Text style={s.label}>PASSWORD *</Text>
                  <TextInput
                    style={[s.input, focusField === 'pass' && s.inputOn]}
                    placeholder="••••••••"
                    placeholderTextColor={TEXT_FAINT}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    onFocus={() => setFocusField('pass')}
                    onBlur={() => setFocusField('')}
                  />
                </View>

                {/* Phone (Register mode) */}
                {!isLogin && (
                  <View style={s.field}>
                    <Text style={s.label}>PHONE NUMBER (OPTIONAL)</Text>
                    <TextInput
                      style={[s.input, focusField === 'phone' && s.inputOn]}
                      placeholder="e.g. 9876543210"
                      placeholderTextColor={TEXT_FAINT}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      onFocus={() => setFocusField('phone')}
                      onBlur={() => setFocusField('')}
                    />
                  </View>
                )}

                {/* ─── ATHLETE SPECIFIC ONBOARDING FIELDS ─── */}
                {!isLogin && role === 'ATHLETE' && (
                  <View style={s.athleteBox}>
                    <Text style={s.sectionHeader}>ATHLETIC PROFILE</Text>

                    {/* Primary Sport Search Picker */}
                    <SportSearchPicker
                      selectedSportId={selectedSportId}
                      selectedSportName={selectedSportName}
                      onSelectSport={(sport) => {
                        setSelectedSportId(sport.id);
                        setSelectedSportName(sport.name);
                      }}
                    />

                    {/* Discipline */}
                    <View style={s.field}>
                      <Text style={s.label}>DISCIPLINE / CATEGORY *</Text>
                      <TextInput
                        style={[s.input, focusField === 'discipline' && s.inputOn]}
                        placeholder="e.g. Javelin Throw, 100m, Flyweight 51kg"
                        placeholderTextColor={TEXT_FAINT}
                        value={discipline}
                        onChangeText={setDiscipline}
                        onFocus={() => setFocusField('discipline')}
                        onBlur={() => setFocusField('')}
                      />
                    </View>

                    {/* Location: State & City */}
                    <View style={s.twoCol}>
                      <View style={[s.field, { flex: 1 }]}>
                        <Text style={s.label}>STATE *</Text>
                        <TextInput
                          style={[s.input, focusField === 'state' && s.inputOn]}
                          placeholder="e.g. Haryana"
                          placeholderTextColor={TEXT_FAINT}
                          value={state}
                          onChangeText={setState}
                          onFocus={() => setFocusField('state')}
                          onBlur={() => setFocusField('')}
                        />
                      </View>

                      <View style={[s.field, { flex: 1 }]}>
                        <Text style={s.label}>CITY *</Text>
                        <TextInput
                          style={[s.input, focusField === 'city' && s.inputOn]}
                          placeholder="e.g. Panipat"
                          placeholderTextColor={TEXT_FAINT}
                          value={city}
                          onChangeText={setCity}
                          onFocus={() => setFocusField('city')}
                          onBlur={() => setFocusField('')}
                        />
                      </View>
                    </View>

                    {/* Headline */}
                    <View style={s.field}>
                      <Text style={s.label}>PROFILE HEADLINE</Text>
                      <TextInput
                        style={[s.input, focusField === 'headline' && s.inputOn]}
                        placeholder="e.g. State Gold Medalist | Target: 2028 Olympics"
                        placeholderTextColor={TEXT_FAINT}
                        value={headline}
                        onChangeText={setHeadline}
                        onFocus={() => setFocusField('headline')}
                        onBlur={() => setFocusField('')}
                      />
                    </View>

                    {/* Career Goal */}
                    <View style={s.field}>
                      <Text style={s.label}>CURRENT GOAL</Text>
                      <TextInput
                        style={[s.input, focusField === 'goal' && s.inputOn]}
                        placeholder="e.g. Qualify for National Games 2026"
                        placeholderTextColor={TEXT_FAINT}
                        value={currentGoal}
                        onChangeText={setCurrentGoal}
                        onFocus={() => setFocusField('goal')}
                        onBlur={() => setFocusField('')}
                      />
                    </View>
                  </View>
                )}

                {/* Error Banner */}
                {error ? (
                  <View style={s.errBox}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={s.errTxt}>{error}</Text>
                  </View>
                ) : null}

                {/* Success Banner */}
                {successMsg ? (
                  <View style={s.successBox}>
                    <Ionicons name="checkmark-circle" size={18} color={SUCCESS_TXT} />
                    <Text style={s.successTxt}>{successMsg}</Text>
                  </View>
                ) : null}

                {/* Action Submit Button */}
                <TouchableOpacity
                  style={[s.btn, loading && { opacity: 0.6 }]}
                  onPress={handleAuth}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.btnTxt}>
                      {isLogin
                        ? 'SIGN IN →'
                        : (role === 'ATHLETE' ? 'REGISTER AS ATHLETE →' : 'REGISTER AS CONTRIBUTOR →')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── QUICK DEMO AUTOFILL (Sign in mode) ─── */}
            {isLogin && (
              <View style={s.hintBlock}>
                <Text style={s.hintTitle}>DEVELOPER QUICK DEMO LOGIN</Text>
                <View style={s.hintRow}>
                  <TouchableOpacity
                    style={s.hintChip}
                    onPress={() => autofillDemo('supporter')}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80' }}
                      style={s.hintImg}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.hintMain}>Demo Supporter</Text>
                      <Text style={s.hintSub} numberOfLines={1}>supporter@demo.com</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.hintChip}
                    onPress={() => autofillDemo('athlete')}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1526550517342-e086f3837548?w=100&q=80' }}
                      style={s.hintImg}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.hintMain}>Demo Athlete</Text>
                      <Text style={s.hintSub} numberOfLines={1}>aarav@athlete.com</Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <Text style={s.hintPw}>Password: password123</Text>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  wrapper: {
    width: '100%',
    maxWidth: 460,
  },

  // Brand Header
  brandBlock: { alignItems: 'center', marginBottom: 20 },
  brandRow: { flexDirection: 'row', marginBottom: 4 },
  brandW: {
    fontSize: 38, fontWeight: '900', color: TEXT_MAIN,
    letterSpacing: -1.5, fontStyle: 'italic',
  },
  brandA: {
    fontSize: 38, fontWeight: '900', color: PRIMARY,
    letterSpacing: -1.5, fontStyle: 'italic',
  },
  tagline: {
    fontSize: 10.5, fontWeight: '800', color: TEXT_DIM,
    letterSpacing: 2, textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },

  // Top Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#F3F4F6',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabOn: { borderBottomWidth: 3, borderBottomColor: PRIMARY, backgroundColor: CARD_BG },
  tabTxt: {
    fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: TEXT_FAINT,
  },
  tabTxtOn: { color: PRIMARY },

  // Form Section
  form: { padding: 20, gap: 14 },
  field: { gap: 5 },
  label: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: TEXT_DIM,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12,
    color: TEXT_MAIN, fontSize: 15, fontWeight: '500',
  },
  inputOn: {
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },

  // Role Selector
  roleSection: {
    marginBottom: 6,
    gap: 8,
  },
  sectionHeader: {
    fontSize: 11, fontWeight: '900', letterSpacing: 1.2,
    color: PRIMARY, marginVertical: 2,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 3,
  },
  roleCardOn: {
    backgroundColor: PRIMARY_LIGHT,
    borderColor: PRIMARY,
  },
  roleIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  roleTitleOn: {
    color: PRIMARY,
  },
  roleSubtitle: {
    fontSize: 10,
    color: TEXT_DIM,
    textAlign: 'center',
  },

  // Athlete Specific Box
  athleteBox: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  sportPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sportPillOn: {
    backgroundColor: PRIMARY_LIGHT,
    borderColor: PRIMARY,
  },
  sportPillIcon: {
    fontSize: 14,
  },
  sportPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  sportPillTextOn: {
    color: PRIMARY,
    fontWeight: '800',
  },

  // Banners
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FCA5A5',
    borderRadius: 12, padding: 12,
  },
  errTxt: { color: '#DC2626', fontSize: 13, fontWeight: '600', flex: 1 },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SUCCESS_BG,
    borderWidth: 1, borderColor: SUCCESS_BORDER,
    borderRadius: 12, padding: 12,
  },
  successTxt: { color: SUCCESS_TXT, fontSize: 13, fontWeight: '700', flex: 1 },

  // Submit Button
  btn: {
    backgroundColor: PRIMARY,
    paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', marginTop: 6,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 5,
  },
  btnTxt: {
    color: '#fff', fontSize: 14, fontWeight: '900',
    letterSpacing: 1.2, fontStyle: 'italic',
  },

  // Quick autofill hints
  hintBlock: { marginTop: 20, alignItems: 'center', width: '100%' },
  hintTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    color: TEXT_FAINT, marginBottom: 10,
  },
  hintRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 8 },
  hintChip: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  hintImg: { width: 34, height: 34, borderRadius: 17, backgroundColor: BORDER },
  hintMain: { color: TEXT_MAIN, fontSize: 13, fontWeight: '700' },
  hintSub: { color: TEXT_DIM, fontSize: 11, fontWeight: '500' },
  hintPw: { color: TEXT_FAINT, fontSize: 11, fontWeight: '600' },
});
