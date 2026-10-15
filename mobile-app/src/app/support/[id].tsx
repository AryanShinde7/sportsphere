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
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileApi, API_URL } from '../../utils/config';

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
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requestDetails, setRequestDetails] = useState<any>(null);

  // Razorpay Checkout Modal
  const [isRazorpayModalVisible, setIsRazorpayModalVisible] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const loadDetails = () => {
      mobileApi.support
        .getSupportRequest(id as string)
        .then((data) => setRequestDetails(data))
        .catch((err) => console.log('Could not fetch request details:', err));
    };
    loadDetails();
    const interval = setInterval(loadDetails, 3500);
    return () => clearInterval(interval);
  }, [id]);

  const handleInitiatePayment = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid contribution amount greater than ₹0.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const order = await mobileApi.support.createRazorpayOrder(id as string, numAmount);
      setRazorpayOrder(order);
      setIsRazorpayModalVisible(true);
    } catch (err: any) {
      console.error('Support payment error:', err);
      const msg =
        err.response?.data?.error ||
        (err.message?.includes('Network Error')
          ? 'Network error: Unable to reach backend server. Please verify your connection.'
          : 'Failed to initiate Razorpay checkout. Please try again.');
      setError(msg);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutMessage = async (msgData: string) => {
    try {
      const parsed = JSON.parse(msgData);
      if (parsed.event === 'SUCCESS') {
        setIsRazorpayModalVisible(false);
        setVerifying(true);

        await mobileApi.support.verifyPayment({
          razorpay_order_id: parsed.razorpay_order_id,
          razorpay_payment_id: parsed.razorpay_payment_id,
          razorpay_signature: parsed.razorpay_signature,
          supportId: razorpayOrder?.supportId,
        });

        // Re-fetch request details to show updated amount
        const updated = await mobileApi.support.getSupportRequest(id as string);
        setRequestDetails(updated);
        setSuccess(true);
      } else if (parsed.event === 'CANCELLED') {
        setIsRazorpayModalVisible(false);
      } else if (parsed.event === 'FAILED') {
        setIsRazorpayModalVisible(false);
        setError(parsed.error || 'Payment was not completed. Please try again.');
      }
    } catch (e: any) {
      console.warn('Checkout postMessage error:', e);
      setError(e.response?.data?.error || 'Payment verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleInstantSandboxVerify = async () => {
    if (!razorpayOrder) return;
    setIsRazorpayModalVisible(false);
    setVerifying(true);

    try {
      await mobileApi.support.verifyPayment({
        razorpay_order_id: razorpayOrder.orderId,
        razorpay_payment_id: `pay_sim_${Date.now()}`,
        razorpay_signature: 'sandbox_verified_signature',
        supportId: razorpayOrder.supportId,
      });

      const updated = await mobileApi.support.getSupportRequest(id as string);
      setRequestDetails(updated);
      setSuccess(true);
    } catch (e: any) {
      console.error('Instant verify error:', e);
      setError('Verification error. Please retry.');
    } finally {
      setVerifying(false);
    }
  };

  if (success) {
    const athleteName = requestDetails?.athlete?.user?.name;
    const athleteId = requestDetails?.athlete?.id;

    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={56} color="#059669" />
        </View>
        <Text style={styles.successTitle}>Support Confirmed!</Text>
        <Text style={styles.text}>
          Thank you for backing {athleteName ? `${athleteName}` : 'an Indian athlete'} with ₹{amount}.
        </Text>
        <Text style={[styles.text, { fontSize: 12.5, color: '#059669', marginBottom: 24, fontWeight: '600' }]}>
          ✓ Razorpay payment captured & verified on SportSphere ledger.
        </Text>

        <View style={{ width: '100%', maxWidth: 360, gap: 12 }}>
          {athleteId && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#111827' }]}
              onPress={() => router.replace(`/athlete/${athleteId}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>View Athlete Profile & Updated Goal →</Text>
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
            <View style={styles.rzpHeaderRow}>
              <View>
                <Text style={styles.title}>Direct Athlete Contribution</Text>
                <Text style={styles.subTitle}>
                  100% of your verified support goes towards athlete training & equipment.
                </Text>
              </View>
              <View style={styles.rzpBadge}>
                <Text style={styles.rzpBadgeText}>Razorpay Secure</Text>
              </View>
            </View>

            {requestDetails && (() => {
              const target = requestDetails.targetAmount || 1;
              const raised = requestDetails.amountSupported || 0;
              const rawPct = Math.round((raised / target) * 100);
              const barFill = Math.min(Math.max(rawPct, raised > 0 ? 3 : 0), 100);

              return (
                <View style={styles.targetBanner}>
                  <Text style={styles.targetAthlete}>
                    Athlete: {requestDetails.athlete?.user?.name || 'Verified Athlete'}
                  </Text>
                  <Text style={styles.targetGoal}>{requestDetails.title}</Text>
                  <View style={styles.targetProgressRow}>
                    <Text style={styles.targetRaised}>
                      Raised: ₹{raised.toLocaleString('en-IN')} of ₹{target.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.targetProgressPct}>{rawPct}%</Text>
                  </View>
                  <View style={styles.targetProgressTrack}>
                    <View style={[styles.targetProgressFill, { width: `${barFill}%` as any }]} />
                  </View>
                </View>
              );
            })()}

            {/* Itemized Budget Breakdown Card */}
            {requestDetails?.budgetItems && requestDetails.budgetItems.length > 0 && (
              <View style={styles.budgetCard}>
                <View style={styles.budgetCardHeader}>
                  <Ionicons name="calculator-outline" size={14} color={PRIMARY} />
                  <Text style={styles.budgetCardTitle}>Itemized Budget Breakdown</Text>
                </View>
                {requestDetails.budgetItems.map((item: any) => (
                  <View key={item.id} style={styles.budgetItemRow}>
                    <Text style={styles.budgetItemDesc} numberOfLines={1}>• {item.description}</Text>
                    <Text style={styles.budgetItemAmt}>₹{item.amount?.toLocaleString('en-IN')}</Text>
                  </View>
                ))}
                <View style={styles.budgetZeroFeeRow}>
                  <Ionicons name="shield-checkmark" size={13} color="#059669" />
                  <Text style={styles.budgetZeroFeeText}>
                    100% of your contribution goes directly to the athlete (0% platform fee)
                  </Text>
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
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
              <Ionicons name="shield-checkmark" size={18} color={PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sandboxText}>Powered by Razorpay Payments</Text>
                <Text style={styles.sandboxSub}>
                  UPI (GPay / PhonePe), Credit/Debit Cards, NetBanking, and Wallets supported.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.payBtn, (loading || verifying) && { opacity: 0.7 }]}
              onPress={handleInitiatePayment}
              disabled={loading || verifying}
              activeOpacity={0.85}
            >
              {loading || verifying ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.payBtnText}>{verifying ? 'VERIFYING PAYMENT...' : 'INITIATING RAZORPAY...'}</Text>
                </View>
              ) : (
                <Text style={styles.payBtnText}>PROCEED WITH RAZORPAY (₹{amount}) →</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Razorpay WebView Checkout Modal */}
      {isRazorpayModalVisible && razorpayOrder && (
        <Modal visible={isRazorpayModalVisible} animationType="slide" onRequestClose={() => setIsRazorpayModalVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="lock-closed" size={16} color="#E2550B" />
                <Text style={styles.modalHeaderTitle}>Razorpay Secure Checkout</Text>
              </View>
              <TouchableOpacity onPress={() => setIsRazorpayModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSubHeader}>
              <Text style={styles.modalSubText}>
                Order: {razorpayOrder.orderId} · Amount: ₹{(razorpayOrder.amount / 100).toLocaleString('en-IN')}
              </Text>
              <TouchableOpacity onPress={handleInstantSandboxVerify} style={styles.quickSimBtn}>
                <Text style={styles.quickSimText}>⚡ Quick Verify (Test Mode)</Text>
              </TouchableOpacity>
            </View>

            <WebView
              source={{
                uri: `${API_URL}/payments/razorpay/checkout-page?orderId=${razorpayOrder.orderId}&amount=${razorpayOrder.amount}&keyId=${razorpayOrder.keyId}&title=${encodeURIComponent(requestDetails?.title || 'Athlete Funding')}`,
              }}
              onMessage={(event) => handleCheckoutMessage(event.nativeEvent.data)}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator size="large" color={PRIMARY} />
                  <Text style={{ color: '#94A3B8', marginTop: 10 }}>Loading Razorpay Gateway...</Text>
                </View>
              )}
              style={{ flex: 1 }}
            />
          </SafeAreaView>
        </Modal>
      )}
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
  rzpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  rzpBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rzpBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
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
  },
  targetBanner: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginVertical: 14,
    gap: 3,
  },
  targetAthlete: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  targetGoal: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_MAIN,
  },
  targetRaised: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_DIM,
  },
  targetProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  targetProgressPct: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
  targetProgressTrack: {
    height: 7,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 2,
  },
  targetProgressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },
  budgetCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  budgetCardTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  budgetItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  budgetItemDesc: {
    fontSize: 12,
    color: TEXT_DIM,
    flex: 1,
  },
  budgetItemAmt: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  budgetZeroFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
  },
  budgetZeroFeeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: ERROR_RED,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: TEXT_DIM,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_MAIN,
    paddingVertical: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: PRIMARY,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  chipTextActive: {
    color: PRIMARY,
    fontWeight: '800',
  },
  sandboxNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  sandboxText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
  sandboxSub: {
    fontSize: 11,
    color: TEXT_DIM,
    marginTop: 1,
  },
  payBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: TEXT_MAIN,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: TEXT_DIM,
    textAlign: 'center',
    marginBottom: 6,
    maxWidth: 320,
  },
  btn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  modalSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
  },
  modalSubText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  quickSimBtn: {
    backgroundColor: '#E2550B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickSimText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
