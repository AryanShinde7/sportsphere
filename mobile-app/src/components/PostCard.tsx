import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { resolveImageUrl } from '../utils/config';

interface PostCardProps {
  post: any;
  currentUserId?: number;
  onCheerToggle: (postId: number) => void;
  onDelete?: (postId: number) => void;
}

const PRIMARY = '#E2550B';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';
const HEART_ACTIVE = '#EF4444';

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

function timeAgo(dateString: string): string {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return past.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function PostCard({
  post,
  currentUserId,
  onCheerToggle,
  onDelete,
}: PostCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [cheerAnimating, setCheerAnimating] = useState(false);

  const athlete = post.athlete;
  const user = athlete?.user;
  const athleteName = user?.name || 'Athlete';
  const sportName = athlete?.sport?.name || 'Sports';
  const sportIcon = SPORT_ICONS[sportName] || '🏅';
  const isOwner = user?.id === currentUserId;

  const rawAvatar = athlete?.mediaAssets?.find((m: any) => m.type === 'AVATAR')?.url || user?.profileImageUrl;
  const avatarUrl = resolveImageUrl(rawAvatar);
  const mediaUrl = resolveImageUrl(post.mediaUrl);

  const activeCampaign = athlete?.supportRequests?.[0];
  const campaignPct = activeCampaign && activeCampaign.targetAmount > 0
    ? Math.min(Math.round((activeCampaign.amountSupported / activeCampaign.targetAmount) * 100), 100)
    : 0;

  const handleCheerPress = () => {
    setCheerAnimating(true);
    setTimeout(() => setCheerAnimating(false), 300);
    onCheerToggle(post.id);
  };

  const handleDeletePress = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to remove this journey update?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete && onDelete(post.id),
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      {/* ── 1. POST HEADER (Instagram style) ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerAuthorRow}
          onPress={() => router.push(`/athlete/${athlete?.id || post.athleteId}`)}
          activeOpacity={0.8}
        >
          {/* Avatar with gradient-like border */}
          <View style={styles.avatarBorderRing}>
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
          </View>

          {/* Name, Sport Badge & Time */}
          <View style={styles.authorInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.authorName} numberOfLines={1}>{athleteName}</Text>
              <View style={styles.sportBadge}>
                <Text style={styles.sportBadgeText}>{sportIcon} {sportName}</Text>
              </View>
            </View>
            <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        {/* Delete option for post owner */}
        {isOwner && onDelete ? (
          <TouchableOpacity onPress={handleDeletePress} style={styles.optionsBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={18} color={TEXT_FAINT} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── 2. POST HERO PHOTO (Instagram feed image) ── */}
      {mediaUrl && !imageFailed ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: mediaUrl }}
            style={styles.postImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        </View>
      ) : null}

      {/* ── 3. ACTION BAR (Heart / Cheer button + Back Campaign CTA) ── */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          <TouchableOpacity
            style={[styles.cheerBtn, cheerAnimating && styles.cheerBtnPulse]}
            onPress={handleCheerPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={post.isCheered ? 'heart' : 'heart-outline'}
              size={24}
              color={post.isCheered ? HEART_ACTIVE : TEXT_MAIN}
            />
            <Text style={[styles.cheerCountText, post.isCheered && styles.cheerCountTextActive]}>
              {post.cheerCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push(`/athlete/${athlete?.id || post.athleteId}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={21} color={TEXT_MAIN} />
          </TouchableOpacity>
        </View>

        {/* Quick Back Campaign button attached to post */}
        {activeCampaign ? (
          <TouchableOpacity
            style={styles.backCampaignChip}
            onPress={() => router.push(`/support/${activeCampaign.id}`)}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.backCampaignChipText}>Back Goal</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── 4. POST CAPTION / STORY ── */}
      <View style={styles.captionContainer}>
        <Text style={styles.captionText}>
          <Text
            style={styles.captionAuthor}
            onPress={() => router.push(`/athlete/${athlete?.id || post.athleteId}`)}
          >
            {athleteName}{' '}
          </Text>
          {post.content}
        </Text>
      </View>

      {/* ── 5. ATTACHED CAMPAIGN CARD (Connects social journey directly to funding!) ── */}
      {activeCampaign ? (
        <TouchableOpacity
          style={styles.campaignCard}
          onPress={() => router.push(`/support/${activeCampaign.id}`)}
          activeOpacity={0.88}
        >
          <View style={styles.campaignCardHeader}>
            <View style={styles.campaignDot} />
            <Text style={styles.campaignCardBadge}>ACTIVE CAMPAIGN</Text>
            <Text style={styles.campaignCategoryTag}>{activeCampaign.category || 'EQUIPMENT'}</Text>
          </View>

          <Text style={styles.campaignCardTitle} numberOfLines={1}>
            {activeCampaign.title}
          </Text>

          {/* Progress bar */}
          <View style={styles.campaignProgressMeta}>
            <Text style={styles.campaignRaisedText}>{inr(activeCampaign.amountSupported)} raised</Text>
            <Text style={styles.campaignPctText}>{campaignPct}% of {inr(activeCampaign.targetAmount)}</Text>
          </View>
          <View style={styles.campaignTrack}>
            <View style={[styles.campaignFill, { width: `${Math.max(campaignPct, 4)}%` as any }]} />
          </View>
        </TouchableOpacity>
      ) : null}
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarBorderRing: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    marginRight: 10,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  authorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_MAIN,
  },
  sportBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_DIM,
  },
  postTime: {
    fontSize: 11,
    color: TEXT_FAINT,
    marginTop: 2,
  },
  optionsBtn: {
    padding: 6,
  },
  imageContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#0F172A',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cheerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cheerBtnPulse: {
    transform: [{ scale: 1.15 }],
  },
  cheerCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_MAIN,
  },
  cheerCountTextActive: {
    color: HEART_ACTIVE,
  },
  iconBtn: {
    padding: 2,
  },
  backCampaignChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backCampaignChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  captionContainer: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MAIN,
  },
  captionAuthor: {
    fontWeight: '700',
    color: TEXT_MAIN,
  },
  campaignCard: {
    marginHorizontal: 14,
    marginBottom: 14,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 12,
  },
  campaignCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  campaignDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  campaignCardBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  campaignCategoryTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  campaignCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_MAIN,
    marginBottom: 8,
  },
  campaignProgressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  campaignRaisedText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
  campaignPctText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_DIM,
  },
  campaignTrack: {
    height: 6,
    backgroundColor: '#FED7AA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  campaignFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },
});
