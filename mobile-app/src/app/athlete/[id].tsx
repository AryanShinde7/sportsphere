import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { mobileApi } from '../../utils/config';

const PRIMARY = '#E2550B';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function AthleteProfileScreen() {
  const { id } = useLocalSearchParams();
  const [athlete, setAthlete] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Sponsorship proposal state
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [supportType, setSupportType] = useState('FINANCIAL');
  const [proposedAmount, setProposedAmount] = useState('250000');
  const [duration, setDuration] = useState('12 Months');
  const [message, setMessage] = useState('');
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [sponsorSuccess, setSponsorSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAthlete();
    }, [id])
  );

  const fetchAthlete = async () => {
    try {
      const data = await mobileApi.athletes.getById(id as string);
      setAthlete(data);
    } catch (err) {
      console.error('Athlete detail error:', err);
    }
    setLoading(false);
  };

  const handleSponsorSubmit = async () => {
    if (!orgName.trim() || !contactPerson.trim()) {
      setSponsorError('Please provide your organization name and contact person.');
      return;
    }
    setSponsorError(null);
    setSponsorLoading(true);
    try {
      await mobileApi.sponsorship.createInterest(athlete.id, {
        organizationName: orgName.trim(),
        contactPerson: contactPerson.trim(),
        supportType,
        proposedAmount: proposedAmount ? `₹${proposedAmount}` : undefined,
        duration: duration.trim(),
        message: message.trim() || undefined,
      });
      setSponsorSuccess(true);
    } catch (err: any) {
      console.error('Sponsor proposal error:', err);
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 403
          ? 'Only registered sponsor accounts can submit corporate proposals. Log in with a sponsor account (e.g. sponsor@techcorp.com).'
          : 'Failed to submit proposal. Please check server connection.');
      setSponsorError(msg);
    } finally {
      setSponsorLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!athlete) {
    return <View style={styles.center}><Text style={styles.text}>Athlete not found.</Text></View>;
  }

  const activeRequest = athlete.supportRequests?.find((r: any) => r.lifecycleStatus === 'ACTIVE');
  const imageUrl = athlete.user?.profileImageUrl || 'https://images.unsplash.com/photo-1552667466-07770ae110d0?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      
      {/* Cover/Profile Image */}
      <Image source={{ uri: imageUrl }} style={styles.coverImage} />
      
      <View style={styles.contentWrapper}>
        <View style={styles.content}>
          <Text style={styles.name}>{athlete.user.name}</Text>
          <Text style={styles.sport}>{athlete.sport?.name} • {athlete.discipline}</Text>
          <Text style={styles.location}>{athlete.city}, {athlete.state}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.text}>{athlete.bio}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verified Achievements</Text>
            {athlete.achievements?.map((ach: any) => (
              <View key={ach.id} style={styles.achievementCard}>
                <Text style={styles.achTitle}>{ach.title}</Text>
                <Text style={styles.achDetails}>{ach.competition} • {ach.position}</Text>
                <Text style={styles.verifiedText}>✓ Admin Verified</Text>
              </View>
            ))}
          </View>

          {activeRequest && (
            <View style={styles.supportSection}>
              <Text style={styles.supportTitle}>Current Support Request</Text>
              <Text style={styles.supportGoal}>{activeRequest.title}</Text>
              <Text style={styles.text}>{activeRequest.description}</Text>
              
              <View style={styles.budgetList}>
                {activeRequest.budgetItems?.map((item: any) => (
                  <View key={item.id} style={styles.budgetItemRow}>
                    <Text style={styles.budgetItemDesc}>{item.description}</Text>
                    <Text style={styles.budgetItemAmt}>₹{item.amount}</Text>
                  </View>
                ))}
              </View>
              
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  Raised: ₹{activeRequest.amountSupported} of ₹{activeRequest.targetAmount}
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.supportBtn}
                onPress={() => router.push(`/support/${activeRequest.id}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.supportBtnText}>SUPPORT THIS ATHLETE</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Corporate Sponsorship Section */}
          <View style={styles.sponsorSection}>
            <Text style={styles.sponsorTitle}>Corporate Sponsorship</Text>
            <Text style={styles.sponsorSubtitle}>
              Back athlete training, equipment, or travel through verified brand sponsorship.
            </Text>

            {sponsorSuccess ? (
              <View style={styles.sponsorSuccessCard}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>🤝</Text>
                <Text style={styles.sponsorSuccessTitle}>Proposal Submitted!</Text>
                <Text style={styles.sponsorSuccessDesc}>
                  Your sponsorship proposal has been recorded in the SportSphere portal and forwarded for administrative review.
                </Text>
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => {
                    setSponsorSuccess(false);
                    setShowSponsorForm(false);
                  }}
                >
                  <Text style={styles.resetBtnText}>Submit Another Proposal</Text>
                </TouchableOpacity>
              </View>
            ) : !showSponsorForm ? (
              <TouchableOpacity
                style={styles.sponsorToggleBtn}
                onPress={() => setShowSponsorForm(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.sponsorToggleBtnText}>💼 SUBMIT SPONSORSHIP PROPOSAL →</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.sponsorForm}>
                {sponsorError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {sponsorError}</Text>
                  </View>
                )}

                <Text style={styles.inputLabel}>ORGANIZATION / BRAND NAME</Text>
                <TextInput
                  style={styles.formInput}
                  value={orgName}
                  onChangeText={setOrgName}
                  placeholder="e.g. Tata Sports Trust, TechCorp"
                  placeholderTextColor={TEXT_FAINT}
                />

                <Text style={styles.inputLabel}>CONTACT PERSON</Text>
                <TextInput
                  style={styles.formInput}
                  value={contactPerson}
                  onChangeText={setContactPerson}
                  placeholder="e.g. Vikram Malhotra"
                  placeholderTextColor={TEXT_FAINT}
                />

                <Text style={styles.inputLabel}>SUPPORT TYPE</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {['FINANCIAL', 'EQUIPMENT', 'TRAVEL'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeChip, supportType === type && styles.typeChipActive]}
                      onPress={() => setSupportType(type)}
                    >
                      <Text style={[styles.typeChipText, supportType === type && styles.typeChipTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={proposedAmount}
                      onChangeText={setProposedAmount}
                      placeholder="250000"
                      keyboardType="numeric"
                      placeholderTextColor={TEXT_FAINT}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>DURATION</Text>
                    <TextInput
                      style={styles.formInput}
                      value={duration}
                      onChangeText={setDuration}
                      placeholder="12 Months"
                      placeholderTextColor={TEXT_FAINT}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>PROPOSAL MESSAGE</Text>
                <TextInput
                  style={[styles.formInput, { height: 72, textAlignVertical: 'top' }]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Details regarding your sponsorship offer and requirements..."
                  placeholderTextColor={TEXT_FAINT}
                  multiline
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setShowSponsorForm(false);
                      setSponsorError(null);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitSponsorBtn, sponsorLoading && { opacity: 0.7 }]}
                    onPress={handleSponsorSubmit}
                    disabled={sponsorLoading}
                  >
                    {sponsorLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.submitSponsorBtnText}>SEND PROPOSAL →</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  contentWrapper: { flex: 1, width: '100%', maxWidth: 540, alignSelf: 'center' },
  
  coverImage: { width: '100%', height: 280, backgroundColor: '#E5E7EB' },
  
  content: {
    padding: 20,
    marginTop: -24,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4,
  },
  
  name: { fontSize: 26, fontWeight: '900', color: TEXT_MAIN, letterSpacing: -0.5 },
  sport: { fontSize: 16, color: PRIMARY, fontWeight: '800', marginTop: 4 },
  location: { fontSize: 13, color: TEXT_FAINT, marginTop: 2, fontWeight: '500' },
  
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: TEXT_MAIN, marginBottom: 10 },
  text: { color: TEXT_DIM, lineHeight: 22, fontSize: 14.5 },
  
  achievementCard: {
    backgroundColor: BG,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  achTitle: { color: TEXT_MAIN, fontWeight: '800', fontSize: 14.5 },
  achDetails: { color: TEXT_DIM, marginTop: 3, fontSize: 13 },
  verifiedText: { color: '#059669', fontSize: 11, fontWeight: '800', marginTop: 6 },
  
  supportSection: {
    marginTop: 28,
    backgroundColor: '#FFF7ED',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  supportTitle: { color: PRIMARY, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 11, marginBottom: 8 },
  supportGoal: { color: TEXT_MAIN, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  
  budgetList: {
    marginTop: 14,
    backgroundColor: CARD_BG,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1, borderColor: '#FFEDD5',
  },
  budgetItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  budgetItemDesc: { color: TEXT_DIM, fontSize: 13 },
  budgetItemAmt: { color: TEXT_MAIN, fontWeight: '800', fontSize: 13 },
  
  progressRow: { marginTop: 16, alignItems: 'center' },
  progressText: { color: '#059669', fontWeight: '900', fontSize: 15 },
  
  supportBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  supportBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1, fontStyle: 'italic' },

  sponsorSection: {
    marginTop: 24,
    backgroundColor: '#F8FAFC',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sponsorTitle: { color: '#0F172A', fontWeight: '900', fontSize: 16, marginBottom: 4 },
  sponsorSubtitle: { color: TEXT_DIM, fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  sponsorToggleBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sponsorToggleBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  sponsorForm: { marginTop: 4 },
  inputLabel: { fontSize: 10.5, fontWeight: '800', color: TEXT_DIM, letterSpacing: 0.8, marginBottom: 6 },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: TEXT_MAIN,
    marginBottom: 12,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  typeChipText: { fontSize: 11, fontWeight: '700', color: TEXT_DIM },
  typeChipTextActive: { color: '#FFFFFF' },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelBtnText: { color: TEXT_DIM, fontWeight: '700', fontSize: 13 },
  submitSponsorBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
  },
  submitSponsorBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  sponsorSuccessCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  sponsorSuccessTitle: { fontSize: 16, fontWeight: '900', color: '#166534', marginBottom: 4 },
  sponsorSuccessDesc: { fontSize: 12.5, color: '#15803D', textAlign: 'center', lineHeight: 18 },
  resetBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#DCFCE7' },
  resetBtnText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
});

