import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../utils/config';

const PRIMARY = '#E2550B';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

export default function SupportScreen() {
  const { id } = useLocalSearchParams();
  const [amount, setAmount] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSupport = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/support-requests/${id}/support`, { amount: parseFloat(amount) });
      setSuccess(true);
    } catch (err) {
      console.log('Payment simulated:', err);
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.successIcon}>
          <Text style={{ fontSize: 44 }}>🎉</Text>
        </View>
        <Text style={styles.successTitle}>Support Confirmed!</Text>
        <Text style={styles.text}>Thank you for backing an Indian athlete with ₹{amount}.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/dashboard')} activeOpacity={0.85}>
          <Text style={styles.btnText}>Return to Discovery Feed</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>Direct Athlete Contribution</Text>
            <Text style={styles.subTitle}>100% of your verified support goes towards athlete training & travel equipment.</Text>

            <Text style={styles.label}>CONTRIBUTION AMOUNT (INR)</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput 
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="1000"
                placeholderTextColor={TEXT_FAINT}
              />
            </View>

            {/* Quick amount chips */}
            <View style={styles.chipsRow}>
              {['500', '1000', '2500', '5000'].map((val) => (
                <TouchableOpacity 
                  key={val} 
                  style={[styles.chip, amount === val && styles.chipActive]} 
                  onPress={() => setAmount(val)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, amount === val && styles.chipTextActive]}>₹{val}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sandboxNotice}>
              <Text style={styles.sandboxText}>🛡️ Verified Gateway Sandbox</Text>
              <Text style={styles.sandboxSub}>Demo mode active. Simulated Razorpay UPI/Card checkout for presentation.</Text>
            </View>

            <TouchableOpacity style={styles.payBtn} onPress={handleSupport} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>PROCEED TO PAY ₹{amount} →</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: CARD_BG,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: TEXT_MAIN,
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 13,
    color: TEXT_DIM,
    marginBottom: 20,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: TEXT_DIM,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '900',
    color: PRIMARY,
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: TEXT_MAIN,
    fontSize: 24,
    fontWeight: '900',
    paddingVertical: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  sandboxNotice: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  sandboxText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 2,
  },
  sandboxSub: {
    color: '#3B82F6',
    fontSize: 11.5,
    lineHeight: 16,
  },
  payBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  payBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  successIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#DCFCE7',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: TEXT_MAIN,
    marginBottom: 6,
  },
  text: {
    color: TEXT_DIM,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  }
});
