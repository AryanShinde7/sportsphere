import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform,
  Dimensions, Image,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const PRIMARY = '#E2550B';
const BG = '#F9FAFB'; // Light gray background
const CARD_BG = '#FFFFFF'; // White card
const BORDER = '#E5E7EB'; // Light gray border
const TEXT_MAIN = '#111827'; // Dark gray/black text
const TEXT_DIM = '#4B5563'; // Medium gray text
const TEXT_FAINT = '#9CA3AF'; // Light gray text for placeholders

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('supporter@demo.com');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusField, setFocusField] = useState('');

  const handleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const res = await axios.post(`${API_URL}/auth/login`, { email, password });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('userToken', res.data.token);
          window.localStorage.setItem('userData', JSON.stringify(res.data.user));
        }
        router.replace('/dashboard');
      } else {
        await axios.post(`${API_URL}/auth/register`, { name, email, password, role: 'SUPPORTER' });
        setIsLogin(true);
        setEmail(email);
        setError('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" />

      {/* Background blobs for visual interest in light mode */}
      <View style={s.glow1} />
      <View style={s.glow2} />
      <View style={s.glow3} />

      <View style={s.center}>
        <View style={s.wrapper}>

          {/* ─── BRAND ─── */}
          <View style={s.brandBlock}>
            <View style={s.brandRow}>
              <Text style={s.brandW}>SPORT</Text>
              <Text style={s.brandA}>SPHERE</Text>
            </View>
            <Text style={s.tagline}>VERIFIED ATHLETE SUPPORT & SPONSORSHIP · INDIA</Text>
          </View>

          {/* ─── CARD ─── */}
          <View style={s.card}>

            {/* Tabs */}
            <View style={s.tabs}>
              <TouchableOpacity
                style={[s.tab, isLogin && s.tabOn]}
                onPress={() => { setIsLogin(true); setError(''); }}
                activeOpacity={0.7}
              >
                <Text style={[s.tabTxt, isLogin && s.tabTxtOn]}>SIGN IN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tab, !isLogin && s.tabOn]}
                onPress={() => { setIsLogin(false); setError(''); }}
                activeOpacity={0.7}
              >
                <Text style={[s.tabTxt, !isLogin && s.tabTxtOn]}>REGISTER</Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={s.form}>
              {!isLogin && (
                <View style={s.field}>
                  <Text style={s.label}>FULL NAME</Text>
                  <TextInput
                    style={[s.input, focusField === 'name' && s.inputOn]}
                    placeholder="Enter your full name"
                    placeholderTextColor={TEXT_FAINT}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusField('name')}
                    onBlur={() => setFocusField('')}
                  />
                </View>
              )}

              <View style={s.field}>
                <Text style={s.label}>EMAIL ADDRESS</Text>
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

              <View style={s.field}>
                <Text style={s.label}>PASSWORD</Text>
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

              {error ? (
                <View style={s.errBox}>
                  <Text style={s.errTxt}>⚠  {error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[s.btn, loading && { opacity: 0.5 }]}
                onPress={handleAuth}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnTxt}>{isLogin ? 'SIGN IN →' : 'CREATE ACCOUNT →'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── DEMO HINT ─── */}
          {isLogin && (
            <View style={s.hintBlock}>
              <Text style={s.hintTitle}>QUICK LOGIN — TAP TO FILL</Text>
              <View style={s.hintRow}>
                <TouchableOpacity
                  style={s.hintChip}
                  onPress={() => { setEmail('supporter@demo.com'); setPassword('password123'); }}
                >
                  <Image source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80' }} style={s.hintImg} />
                  <View>
                    <Text style={s.hintMain}>Supporter</Text>
                    <Text style={s.hintSub}>supporter@demo.com</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.hintChip}
                  onPress={() => { setEmail('aarav@athlete.com'); setPassword('password123'); }}
                >
                  <Image source={{ uri: 'https://images.unsplash.com/photo-1526550517342-e086f3837548?w=100&q=80' }} style={s.hintImg} />
                  <View>
                    <Text style={s.hintMain}>Athlete</Text>
                    <Text style={s.hintSub}>aarav@athlete.com</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <Text style={s.hintPw}>All demo accounts use password: password123</Text>
            </View>
          )}

        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  wrapper: {
    width: '100%',
    maxWidth: 480,
    zIndex: 10,
  },

  // Glows (subtle in light mode)
  glow1: {
    position: 'absolute', top: -120, right: -120,
    width: 600, height: 600, borderRadius: 300,
    backgroundColor: 'rgba(226,85,11,0.06)',
    zIndex: 0,
  },
  glow2: {
    position: 'absolute', bottom: -120, left: -120,
    width: 600, height: 600, borderRadius: 300,
    backgroundColor: 'rgba(226,85,11,0.04)',
    zIndex: 0,
  },
  glow3: {
    position: 'absolute', top: '35%', left: '30%',
    width: 400, height: 400, borderRadius: 200,
    backgroundColor: 'rgba(226,85,11,0.03)',
    zIndex: 0,
  },

  // Brand
  brandBlock: { alignItems: 'center', marginBottom: 44 },
  brandRow: { flexDirection: 'row', marginBottom: 10 },
  brandW: {
    fontSize: 52, fontWeight: '900', color: TEXT_MAIN,
    letterSpacing: -3, fontStyle: 'italic',
  },
  brandA: {
    fontSize: 52, fontWeight: '900', color: PRIMARY,
    letterSpacing: -3, fontStyle: 'italic',
  },
  tagline: {
    fontSize: 12, fontWeight: '700', color: TEXT_DIM,
    letterSpacing: 3, textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 32,
    elevation: 8,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#F3F4F6', // Slightly darker than card for contrast
  },
  tab: { flex: 1, paddingVertical: 18, alignItems: 'center' },
  tabOn: { borderBottomWidth: 3, borderBottomColor: PRIMARY, backgroundColor: CARD_BG },
  tabTxt: {
    fontSize: 13, fontWeight: '800', letterSpacing: 3, color: TEXT_FAINT,
  },
  tabTxtOn: { color: PRIMARY },

  // Form
  form: { padding: 32, gap: 20 },
  field: { gap: 8 },
  label: {
    fontSize: 12, fontWeight: '800', letterSpacing: 2.5, color: TEXT_DIM,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 18,
    color: TEXT_MAIN, fontSize: 17, fontWeight: '500',
  },
  inputOn: {
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  // Error
  errBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FCA5A5',
    borderRadius: 12, padding: 16,
  },
  errTxt: { color: '#DC2626', fontSize: 15, fontWeight: '600', textAlign: 'center' },

  // Button
  btn: {
    backgroundColor: PRIMARY,
    paddingVertical: 20, borderRadius: 18,
    alignItems: 'center', marginTop: 4,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16,
    elevation: 8,
  },
  btnTxt: {
    color: '#fff', fontSize: 16, fontWeight: '900',
    letterSpacing: 2, fontStyle: 'italic',
  },

  // Hint
  hintBlock: { marginTop: 36, alignItems: 'center' },
  hintTitle: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2.5,
    color: TEXT_FAINT, marginBottom: 16,
  },
  hintRow: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
  hintChip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
  },
  hintImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: BORDER },
  hintMain: { color: TEXT_MAIN, fontSize: 14, fontWeight: '700' },
  hintSub: { color: TEXT_DIM, fontSize: 12, fontWeight: '500', marginTop: 2 },
  hintPw: { color: TEXT_FAINT, fontSize: 12, fontWeight: '600' },
});
