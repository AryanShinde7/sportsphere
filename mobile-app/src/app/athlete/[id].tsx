import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
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
      console.error(err);
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
  const imageUrl = athlete.user.profileImageUrl || 'https://images.unsplash.com/photo-1552667466-07770ae110d0?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      
      {/* Hero Image */}
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
  contentWrapper: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  
  coverImage: { width: '100%', height: 350 },
  
  content: {
    padding: 32,
    marginTop: -40,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5,
  },
  
  name: { fontSize: 36, fontWeight: '900', color: TEXT_MAIN, letterSpacing: -1 },
  sport: { fontSize: 18, color: PRIMARY, fontWeight: '800', marginTop: 8 },
  location: { fontSize: 15, color: TEXT_FAINT, marginTop: 4, fontWeight: '500' },
  
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: TEXT_MAIN, marginBottom: 16 },
  text: { color: TEXT_DIM, lineHeight: 26, fontSize: 16 },
  
  achievementCard: {
    backgroundColor: BG,
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  achTitle: { color: TEXT_MAIN, fontWeight: '800', fontSize: 16 },
  achDetails: { color: TEXT_DIM, marginTop: 4, fontSize: 14 },
  verifiedText: { color: '#059669', fontSize: 12, fontWeight: '800', marginTop: 10 },
  
  supportSection: {
    marginTop: 40,
    backgroundColor: '#FFF7ED', // very light orange
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  supportTitle: { color: PRIMARY, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 12, marginBottom: 12 },
  supportGoal: { color: TEXT_MAIN, fontSize: 24, fontWeight: '900', marginBottom: 12 },
  
  budgetList: {
    marginTop: 20,
    backgroundColor: CARD_BG,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1, borderColor: '#FFEDD5',
  },
  budgetItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  budgetItemDesc: { color: TEXT_DIM, fontSize: 14 },
  budgetItemAmt: { color: TEXT_MAIN, fontWeight: '800', fontSize: 14 },
  
  progressRow: { marginTop: 24, alignItems: 'center' },
  progressText: { color: '#059669', fontWeight: '900', fontSize: 18 },
  
  supportBtn: {
    backgroundColor: PRIMARY,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  supportBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1, fontStyle: 'italic' }
});
