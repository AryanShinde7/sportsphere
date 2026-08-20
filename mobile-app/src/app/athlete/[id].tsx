import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, SafeAreaView } from 'react-native';
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

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function AthleteProfileScreen() {
  const { id } = useLocalSearchParams();
  const [athlete, setAthlete] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAthlete();
  }, [id]);

  const fetchAthlete = async () => {
    try {
      const res = await axios.get(`${API_URL}/athletes/${id}`);
      setAthlete(res.data);
    } catch (err) {
      console.error('Athlete detail error:', err);
    }
    setLoading(false);
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
  supportBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1, fontStyle: 'italic' }
});
