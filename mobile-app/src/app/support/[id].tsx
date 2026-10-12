import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { mobileApi } from '../../utils/config';

const PRIMARY = '#E2550B';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';
const ERROR_RED = '#DC2626';

export default function SupportScreen() {
  const { id } = useLocalSearchParams();
  const [amount, setAmount] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requestDetails, setRequestDetails] = useState<any>(null);

  useEffect(() => {
    if (id) {
      mobileApi.support
        .getSupportRequest(id as string)
        .then((data) => setRequestDetails(data))
        .catch((err) => console.log('Could not fetch request details:', err));
    }
  }, [id]);

  const handleSupport = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid contribution amount greater than ₹0.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await mobileApi.support.supportDirect(id as string, numAmount);
      setSuccess(true);
    } catch (err: any) {
      console.error('Support payment error:', err);
      const msg =
        err.response?.data?.error ||
        (err.message?.includes('Network Error')
          ? 'Network error: Unable to reach backend server. Please verify your connection.'
          : 'Payment contribution could not be processed. Please try again.');
      setError(msg);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const athleteName = requestDetails?.athlete?.user?.name;
    const athleteId = requestDetails?.athlete?.id;

    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.successIcon}>
          <Text style={{ fontSize: 44 }}>🎉</Text>
        </View>
        <Text style={styles.successTitle}>Support Confirmed!</Text>
        <Text style={styles.text}>
          Thank you for backing {athleteName ? `${athleteName}` : 'an Indian athlete'} with ₹{amount}.
        </Text>
        <Text style={[styles.text, { fontSize: 12.5, color: '#059669', marginBottom: 24, fontWeight: '600' }]}>
          ✓ Contribution recorded and verified in public ledger.
        </Text>

        <View style={{ width: '100%', maxWidth: 360, gap: 12 }}>
          {athleteId && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#111827' }]}
              onPress={() => router.replace(`/athlete/${athleteId}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>View Athlete Profile →</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace('/dashboard')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Return to Discovery Feed</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.subTitle}>
              100% of your verified support goes towards athlete training & equipment.
            </Text>

            {requestDetails && (
              <View style={styles.targetBanner}>
                <Text style={styles.targetAthlete}>
                  Athlete: {requestDetails.athlete?.user?.name || 'Verified Athlete'}
                </Text>
                <Text style={styles.targetGoal}>{requestDetails.title}</Text>
                <Text style={styles.targetRaised}>
                  Currently Raised: ₹{requestDetails.amountSupported} of ₹{requestDetails.targetAmount}
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            <Text style={styles.label}>CONTRIBUTION AMOUNT (INR)</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={(val) => {
                  setAmount(val);
                  if (error) setError(null);
                }}
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
                  onPress={() => {
                    setAmount(val);
                    if (error) setError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, amount === val && styles.chipTextActive]}>₹{val}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sandboxNotice}>
              <Text style={styles.sandboxText}>🛡️ Verified Gateway Sandbox</Text>
              <Text style={styles.sandboxSub}>
                Simulated Razorpay transaction for instant verification and ledger persistence.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.payBtn, loading && { opacity: 0.7 }]}
              onPress={handleSupport}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payBtnText}>PROCEED TO PAY ₹{amount} →</Text>
              )}
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
    marginBottom: 16,
    lineHeight: 18,
  },
  targetBanner: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },
  targetAthlete: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 2,
  },
  targetGoal: {
    fontSize: 12,
    color: TEXT_DIM,
    marginBottom: 4,
  },
  targetRaised: {
    fontSize: 11.5,
    fontWeight: '700',
    color: PRIMARY,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: ERROR_RED,
    fontSize: 12.5,
    fontWeight: '700',
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
    marginBottom: 8,
  },
  btn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
