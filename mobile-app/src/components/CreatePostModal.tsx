import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi, resolveImageUrl } from '../utils/config';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newPost?: any) => void;
  athleteName?: string;
  sportName?: string;
  hasActiveCampaign?: boolean;
}

const PRIMARY = '#E2550B';
const CARD_BG = '#FFFFFF';
const BG = '#F9FAFB';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

const QUICK_TAGS = [
  '⏱️ Personal Best',
  '🏋️ Training Session',
  '🏆 Tournament Update',
  '💪 Recovery Day',
  '⚡ Road To Nationals',
  '🙏 Supporter Shoutout',
];

export default function CreatePostModal({
  visible,
  onClose,
  onSuccess,
  athleteName = 'Athlete',
  sportName = 'Sport',
  hasActiveCampaign = false,
}: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string | undefined>(undefined);
  const [selectedImageFileName, setSelectedImageFileName] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const resetState = () => {
    setContent('');
    setSelectedImageUri(null);
    setSelectedImageMime(undefined);
    setSelectedImageFileName(undefined);
    setErrorMessage('');
    setUploading(false);
  };

  const handleClose = () => {
    if (uploading) return;
    resetState();
    onClose();
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos to attach a picture to your post.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        setSelectedImageMime(asset.mimeType || undefined);
        setSelectedImageFileName(asset.fileName || undefined);
      }
    } catch (err: any) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'Could not open image library. Please try again.');
    }
  };

  const handleAddTag = (tag: string) => {
    setContent(prev => (prev ? `${prev} ${tag}` : tag));
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      setErrorMessage('Please write a caption or update for your post.');
      return;
    }

    setUploading(true);
    setErrorMessage('');

    try {
      let finalMediaUrl: string | undefined = undefined;

      // 1. If an image is selected from gallery, upload it
      if (selectedImageUri) {
        const uploadRes = await mobileApi.posts.uploadMedia(
          selectedImageUri,
          selectedImageMime,
          selectedImageFileName
        );
        finalMediaUrl = uploadRes.url;
      }

      // 2. Create the post in the database
      const newPost = await mobileApi.posts.create({
        content: content.trim(),
        mediaUrl: finalMediaUrl,
      });

      resetState();
      onSuccess(newPost);
      onClose();
    } catch (err: any) {
      console.error('Publish post error:', err);
      setErrorMessage(
        err.response?.data?.error || err.message || 'Failed to publish post. Please check your network.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={uploading} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={TEXT_MAIN} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Share Journey Update</Text>
            <Text style={styles.headerSubtitle}>
              {athleteName} · {sportName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handlePublish}
            disabled={uploading || !content.trim()}
            style={[styles.publishBtn, (!content.trim() || uploading) && styles.publishBtnDisabled]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.publishBtnText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Image Attachment Box */}
          {selectedImageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImageUri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setSelectedImageUri(null)}
                disabled={uploading}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.changeImageBtn}
                onPress={handlePickImage}
                disabled={uploading}
              >
                <Ionicons name="camera-reverse-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.changeImageText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.imagePickerTrigger}
              onPress={handlePickImage}
              activeOpacity={0.8}
              disabled={uploading}
            >
              <View style={styles.imagePickerIconCircle}>
                <Ionicons name="camera-outline" size={28} color={PRIMARY} />
              </View>
              <Text style={styles.imagePickerTitle}>Add a Photo to Your Update</Text>
              <Text style={styles.imagePickerSub}>
                Share your training session, competition photo, or podium celebration
              </Text>
            </TouchableOpacity>
          )}

          {/* Caption Input */}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="What milestone or update did you achieve today? Share your thoughts, training times, or shoutout your backers..."
              placeholderTextColor={TEXT_FAINT}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={1500}
              editable={!uploading}
              textAlignVertical="top"
            />
            <View style={styles.inputMetaRow}>
              <Text style={styles.charCount}>{content.length} / 1500</Text>
            </View>
          </View>

          {/* Quick Inspiration Tags */}
          <Text style={styles.sectionLabel}>Quick Tags</Text>
          <View style={styles.tagsContainer}>
            {QUICK_TAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => handleAddTag(tag)}
                disabled={uploading}
                activeOpacity={0.7}
              >
                <Text style={styles.tagChipText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Campaign Link Indicator */}
          {hasActiveCampaign ? (
            <View style={styles.campaignLinkNote}>
              <Ionicons name="flash" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.campaignLinkTitle}>Active Campaign Auto-Attached</Text>
                <Text style={styles.campaignLinkSub}>
                  Supporters can tap a &quot;Back Athlete&quot; button directly on this post to fund your active goal.
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 14,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TEXT_DIM,
    marginTop: 2,
  },
  publishBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  publishBtnDisabled: {
    backgroundColor: '#FDBA74',
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  imagePickerTrigger: {
    borderWidth: 2,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
  },
  imagePickerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imagePickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_MAIN,
    marginBottom: 4,
  },
  imagePickerSub: {
    fontSize: 12,
    color: TEXT_DIM,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    height: 260,
    marginBottom: 18,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrap: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    minHeight: 140,
    marginBottom: 16,
  },
  textInput: {
    fontSize: 15,
    color: TEXT_MAIN,
    minHeight: 100,
    lineHeight: 22,
  },
  inputMetaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  charCount: {
    fontSize: 11,
    color: TEXT_FAINT,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DIM,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  tagChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MAIN,
  },
  campaignLinkNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 14,
  },
  campaignLinkTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 2,
  },
  campaignLinkSub: {
    fontSize: 12,
    color: TEXT_DIM,
    lineHeight: 16,
  },
});
