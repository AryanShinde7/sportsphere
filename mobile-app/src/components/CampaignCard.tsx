import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { resolveImageUrl } from '../utils/config';

interface CampaignCardProps {
  campaign: any;
}

const PRIMARY = '#E2550B';
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

function getInitials(name: string) {
  return (name || 'Athlete')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function CampaignCard({ campaign }: CampaignCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const athlete = campaign.athlete;
  const user = athlete?.user;
  const athleteName = user?.name || 'Athlete';
  const sportName = athlete?.sport?.name || 'Sport';
  const sportIcon = SPORT_ICONS[sportName] || '🏅';

  const rawAvatar = athlete?.mediaAssets?.find((m: any) => m.type === 'AVATAR')?.url || user?.profileImageUrl;
  const avatarUrl = resolveImageUrl(rawAvatar);

  const pct = campaign.targetAmount > 0
    ? Math.min(Math.round((campaign.amountSupported / campaign.targetAmount) * 100), 100)
    : 0;

  const backersCount = campaign.supports?.length || 0;
  const budgetItems: any[] = campaign.budgetItems || [];

  return (
    <View style={styles.card}>
      {/* Header with Athlete Avatar + Category Badge */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.athleteRow}
          onPress={() => router.push(`/athlete/${athlete?.id}`)}
          activeOpacity={0.8}
        >
          {avatarUrl && !avatarFailed ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImage}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <View style={[styles.avatarImage, { backgroundColor: getColor(athleteName), justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.avatarInitials}>{getInitials(athleteName)}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.athleteName} numberOfLines={1}>{athleteName}</Text>
              <View style={styles.sportChip}>
                <Text style={styles.sportChipText}>{sportIcon} {sportName}</Text>
              </View>
            </View>
            <Text style={styles.athleteDiscipline} numberOfLines={1}>
              {athlete?.discipline || athlete?.headline || 'Athlete'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.categoryChip}>
          <Text style={styles.categoryText}>{campaign.category || 'EQUIPMENT'}</Text>
        </View>
      </View>

      {/* Campaign Title & Description */}
      <View style={styles.contentWrap}>
        <Text style={styles.campaignTitle}>{campaign.title}</Text>
        {campaign.description ? (
          <Text style={styles.campaignDesc} numberOfLines={3}>
            {campaign.description}
          </Text>
        ) : null}

        {/* Itemized Budget Preview */}
        {budgetItems.length > 0 ? (
          <View style={styles.budgetBox}>
            <Text style={styles.budgetHeader}>ITEMIZED EXPENSE BREAKDOWN</Text>
            {budgetItems.slice(0, 3).map((item, idx) => (
              <View key={item.id || idx} style={styles.budgetItemRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.budgetItemDesc} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.budgetItemAmount}>{inr(item.amount)}</Text>
              </View>
            ))}
            {budgetItems.length > 3 ? (
              <Text style={styles.moreItemsText}>
                +{budgetItems.length - 3} more item{budgetItems.length - 3 !== 1 ? 's' : ''} in budget
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Live Funding Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressMeta}>
            <View>
              <Text style={styles.raisedAmount}>{inr(campaign.amountSupported)}</Text>
              <Text style={styles.goalSub}>raised of {inr(campaign.targetAmount)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pctText}>{pct}%</Text>
              <Text style={styles.backersSub}>
                {backersCount} backer{backersCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(pct, 2)}%` as any }]} />
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push(`/support/${campaign.id}`)}
          activeOpacity={0.88}
        >
          <Ionicons name="card-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.backBtnText}>Back with Razorpay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  athleteName: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  sportChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sportChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_DIM,
  },
  athleteDiscipline: {
    fontSize: 11,
    color: TEXT_FAINT,
    marginTop: 2,
  },
  categoryChip: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  contentWrap: {
    padding: 14,
  },
  campaignTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_MAIN,
    lineHeight: 22,
    marginBottom: 6,
  },
  campaignDesc: {
    fontSize: 13,
    color: TEXT_DIM,
    lineHeight: 18,
    marginBottom: 12,
  },
  budgetBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  budgetHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_FAINT,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  budgetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY,
    marginRight: 6,
  },
  budgetItemDesc: {
    fontSize: 12,
    color: TEXT_MAIN,
    flex: 1,
  },
  budgetItemAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MAIN,
    marginLeft: 8,
  },
  moreItemsText: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: '600',
    marginTop: 4,
  },
  progressSection: {
    marginBottom: 14,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  raisedAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: PRIMARY,
  },
  goalSub: {
    fontSize: 11,
    color: TEXT_FAINT,
  },
  pctText: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  backersSub: {
    fontSize: 11,
    color: TEXT_FAINT,
  },
  track: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },
  backBtn: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
