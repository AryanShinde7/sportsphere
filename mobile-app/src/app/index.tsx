import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform,
  ScrollView, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL, Storage } from '../utils/config';

const PRIMARY = '#E2550B';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

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
        await Storage.setItem('userToken', res.data.token);
        await Storage.setItem('userData', JSON.stringify(res.data.user));
        router.replace('/dashboard');
      } else {
        await axios.post(`${API_URL}/auth/register`, { name, email, password, role: 'SUPPORTER' });
        setIsLogin(true);
        setError('');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err.response?.data?.error || (err.message?.includes('Network Error') 
        ? `Could not connect to server at ${API_URL}. Ensure your phone & PC are on the same Wi-Fi!`
        : 'Something went wrong. Please check your credentials.');
      setError(msg);
    }
    setLoading(false);
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
              <Text style={s.tagline}>VERIFIED ATHLETE SUPPORT · INDIA</Text>
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
                  style={[s.btn, loading && { opacity: 0.6 }]}
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

            {/* ─── DEMO CHIPS ─── */}
            {isLogin && (
              <View style={s.hintBlock}>
                <Text style={s.hintTitle}>QUICK LOGIN — TAP TO AUTOFILL</Text>
                <View style={s.hintRow}>
                  <TouchableOpacity
                    style={s.hintChip}
                    onPress={() => { setEmail('supporter@demo.com'); setPassword('password123'); }}
                    activeOpacity={0.8}
                  >
                    <Image 
                      source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80' }} 
                      style={s.hintImg} 
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.hintMain}>Supporter</Text>
                      <Text style={s.hintSub} numberOfLines={1}>supporter@demo.com</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={s.hintChip}
                    onPress={() => { setEmail('aarav@athlete.com'); setPassword('password123'); }}
                    activeOpacity={0.8}
                  >
                    <Image 
                      source={{ uri: 'https://images.unsplash.com/photo-1526550517342-e086f3837548?w=100&q=80' }} 
                      style={s.hintImg} 
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.hintMain}>Athlete</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  wrapper: {
    width: '100%',
    maxWidth: 440,
  },

  // Brand
  brandBlock: { alignItems: 'center', marginBottom: 28 },
  brandRow: { flexDirection: 'row', marginBottom: 6 },
  brandW: {
    fontSize: 40, fontWeight: '900', color: TEXT_MAIN,
    letterSpacing: -2, fontStyle: 'italic',
  },
  brandA: {
    fontSize: 40, fontWeight: '900', color: PRIMARY,
    letterSpacing: -2, fontStyle: 'italic',
  },
  tagline: {
    fontSize: 11, fontWeight: '700', color: TEXT_DIM,
    letterSpacing: 2, textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#F3F4F6',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabOn: { borderBottomWidth: 3, borderBottomColor: PRIMARY, backgroundColor: CARD_BG },
  tabTxt: {
    fontSize: 12, fontWeight: '800', letterSpacing: 2, color: TEXT_FAINT,
  },
  tabTxtOn: { color: PRIMARY },

  // Form
  form: { padding: 22, gap: 16 },
  field: { gap: 6 },
  label: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: TEXT_DIM,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: TEXT_MAIN, fontSize: 16, fontWeight: '500',
  },
  inputOn: {
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
  },

  // Error
  errBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FCA5A5',
    borderRadius: 12, padding: 12,
  },
  errTxt: { color: '#DC2626', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Button
  btn: {
    backgroundColor: PRIMARY,
    paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 4,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 6,
  },
  btnTxt: {
    color: '#fff', fontSize: 15, fontWeight: '900',
    letterSpacing: 1.5, fontStyle: 'italic',
  },

  // Hint
  hintBlock: { marginTop: 24, alignItems: 'center', width: '100%' },
  hintTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    color: TEXT_FAINT, marginBottom: 12,
  },
  hintRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 10 },
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
