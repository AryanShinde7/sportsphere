import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileApi, resolveImageUrl } from '../utils/config';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PRIMARY = '#E2550B';
const CARD_BG = '#FFFFFF';
const BG = '#F9FAFB';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

const AVATAR_COLORS = [
  '#C2410C', '#0891B2', '#7C3AED', '#059669',
  '#DB2777', '#CA8A04', '#2563EB', '#0D9488',
];

const QUICK_ENCOURAGEMENTS = [
  '💪 Keep grinding!',
  '🔥 Proud of you!',
  '🇮🇳 Jai Hind!',
  '🏆 Podium bound!',
  '⚡ Unstoppable!',
];

function getInitials(name: string) {
  return (name || 'User')
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

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return past.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: number;
  postContent?: string;
  athleteName?: string;
  postAthleteUserId?: number;
  currentUserId?: number;
  currentUserRole?: string;
  currentUserAvatar?: string;
  onCommentCountChange?: (postId: number, newCount: number) => void;
}

export default function CommentsModal({
  visible,
  onClose,
  postId,
  postContent,
  athleteName = 'Athlete',
  postAthleteUserId,
  currentUserId,
  currentUserRole,
  currentUserAvatar,
  onCommentCountChange,
}: CommentsModalProps) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const [error, setError] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && postId) {
      loadComments();
    } else {
      setComments([]);
      setInputContent('');
      setError('');
    }
  }, [visible, postId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await mobileApi.posts.getComments(postId);
      setComments(data || []);
      if (onCommentCountChange) {
        onCommentCountChange(postId, (data || []).length);
      }
    } catch (err: any) {
      console.error('Fetch comments error:', err);
      setError('Could not load comments. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async (textToSend?: string) => {
    const text = (textToSend || inputContent).trim();
    if (!text) return;

    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please log in to leave comments and cheer for athletes.');
      return;
    }

    setSubmitting(true);
    setError('');

    // Optimistic comment creation
    const tempId = Date.now();
    const optimisticComment = {
      id: tempId,
      postId,
      userId: currentUserId,
      content: text,
      createdAt: new Date().toISOString(),
      user: {
        id: currentUserId,
        name: 'You',
        profileImageUrl: currentUserAvatar,
        role: currentUserRole || 'SUPPORTER',
      },
    };

    setComments(prev => [...prev, optimisticComment]);
    setInputContent('');

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const res = await mobileApi.posts.addComment(postId, text);
      if (res && res.comment) {
        setComments(prev => prev.map(c => (c.id === tempId ? res.comment : c)));
        if (onCommentCountChange && typeof res.commentCount === 'number') {
          onCommentCountChange(postId, res.commentCount);
        }
      }
    } catch (err: any) {
      console.error('Post comment error:', err);
      // Rollback optimistic comment
      setComments(prev => prev.filter(c => c.id !== tempId));
      setInputContent(text);
      setError(err.response?.data?.error || 'Failed to post comment. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const previous = [...comments];
            const updated = comments.filter(c => c.id !== commentId);
            setComments(updated);

            if (onCommentCountChange) {
              onCommentCountChange(postId, updated.length);
            }

            try {
              await mobileApi.posts.deleteComment(commentId);
            } catch (err: any) {
              console.error('Delete comment error:', err);
              setComments(previous);
              if (onCommentCountChange) {
                onCommentCountChange(postId, previous.length);
              }
              Alert.alert('Error', 'Failed to delete comment. Please retry.');
            }
          },
        },
      ]
    );
  };

  const renderCommentItem = ({ item }: { item: any }) => {
    const commenter = item.user;
    const commenterName = commenter?.name || 'Community Member';
    const commenterRole = commenter?.role || 'SUPPORTER';
    const isCommentAuthor = commenter?.id === currentUserId;
    const isPostAuthor = commenter?.id === postAthleteUserId;
    const canDelete =
      isCommentAuthor ||
      currentUserId === postAthleteUserId ||
      currentUserRole === 'ADMIN';

    const avatarUrl = resolveImageUrl(commenter?.profileImageUrl);
    const color = getColor(commenterName);

    return (
      <View style={styles.commentRow}>
        {/* Avatar */}
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.commentAvatar} />
        ) : (
          <View style={[styles.commentAvatar, { backgroundColor: color }]}>
            <Text style={styles.avatarInitialsText}>{getInitials(commenterName)}</Text>
          </View>
        )}

        {/* Content bubble */}
        <View style={styles.commentBubble}>
          <View style={styles.commentHeaderRow}>
            <View style={styles.nameBadgeWrap}>
              <Text style={styles.commentAuthorName} numberOfLines={1}>
                {commenterName}
              </Text>

              {/* Badges */}
              {isPostAuthor && (
                <View style={styles.authorBadge}>
                  <Text style={styles.authorBadgeText}>AUTHOR</Text>
                </View>
              )}

              {commenterRole === 'ATHLETE' && !isPostAuthor && (
                <View style={styles.athleteBadge}>
                  <Text style={styles.athleteBadgeText}>ATHLETE</Text>
                </View>
              )}

              {commenterRole === 'SPONSOR' && (
                <View style={styles.sponsorBadge}>
                  <Text style={styles.sponsorBadgeText}>SPONSOR</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
              {canDelete && (
                <TouchableOpacity
                  onPress={() => handleDeleteComment(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 2 }}
                >
                  <Ionicons name="trash-outline" size={13} color={TEXT_FAINT} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.commentText}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalSheet}
        >
          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
            <View style={styles.headerTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="chatbubbles-outline" size={18} color={PRIMARY} />
                <Text style={styles.headerTitle}>Comments</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{comments.length}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={TEXT_MAIN} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Post snippet context */}
          {postContent ? (
            <View style={styles.postSnippet}>
              <Text style={styles.postSnippetAuthor}>Update by {athleteName}:</Text>
              <Text style={styles.postSnippetText} numberOfLines={2}>
                "{postContent}"
              </Text>
            </View>
          ) : null}

          {/* Error notice */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={15} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Comments List */}
          {loading && comments.length === 0 ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={PRIMARY} />
              <Text style={styles.loaderText}>Loading comments...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={comments}
              keyExtractor={item => item.id.toString()}
              renderItem={renderCommentItem}
              contentContainerStyle={[
                styles.listContent,
                comments.length === 0 && { flex: 1, justifyContent: 'center' },
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="chatbubble-ellipses-outline" size={32} color={PRIMARY} />
                  </View>
                  <Text style={styles.emptyTitle}>No comments yet</Text>
                  <Text style={styles.emptySub}>
                    Be the first to encourage {athleteName} on their athletic journey!
                  </Text>
                </View>
              }
            />
          )}

          {/* Quick Encouragements Row */}
          <View style={styles.quickTagsWrap}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={QUICK_ENCOURAGEMENTS}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={styles.quickTagsContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.quickTagChip}
                  onPress={() => handleSendComment(item)}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickTagText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Sticky Input Bar at Bottom */}
          <View
            style={[
              styles.inputContainer,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={styles.inputInnerRow}>
              <TextInput
                style={styles.textInput}
                placeholder={`Leave encouragement for ${athleteName.split(' ')[0]}...`}
                placeholderTextColor={TEXT_FAINT}
                value={inputContent}
                onChangeText={setInputContent}
                multiline
                maxLength={1000}
                editable={!submitting}
              />

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!inputContent.trim() || submitting) && styles.sendBtnDisabled,
                ]}
                onPress={() => handleSendComment()}
                disabled={!inputContent.trim() || submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-up" size={17} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    minHeight: SCREEN_HEIGHT * 0.55,
    overflow: 'hidden',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: TEXT_MAIN,
  },
  countBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  postSnippet: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  postSnippetAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 2,
  },
  postSnippetText: {
    fontSize: 12,
    color: TEXT_DIM,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loaderText: {
    fontSize: 12.5,
    color: TEXT_DIM,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  nameBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  commentAuthorName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: TEXT_MAIN,
    maxWidth: 130,
  },
  authorBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  authorBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#B45309',
  },
  athleteBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  athleteBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#059669',
  },
  sponsorBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  sponsorBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#0369A1',
  },
  commentTime: {
    fontSize: 10.5,
    color: TEXT_FAINT,
    fontWeight: '500',
  },
  commentText: {
    fontSize: 12.5,
    color: TEXT_DIM,
    lineHeight: 17,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: TEXT_FAINT,
    textAlign: 'center',
    lineHeight: 16,
  },
  quickTagsWrap: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
  },
  quickTagsContent: {
    paddingHorizontal: 14,
    gap: 6,
  },
  quickTagChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickTagText: {
    fontSize: 11,
    color: TEXT_DIM,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  inputInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: TEXT_MAIN,
    maxHeight: 70,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
});
