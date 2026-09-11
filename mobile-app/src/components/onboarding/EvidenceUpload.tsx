import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Achievement } from '../../utils/athleteService';

const PRIMARY = '#E2550B';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

interface EvidenceInfo {
  uri: string;
  fileName?: string;
  fileType?: string;
  uploadedAt?: string;
}

function parseEvidenceFileId(raw?: string | null): EvidenceInfo | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed as EvidenceInfo;
  } catch {
    // Legacy: raw string is the URI directly
    return { uri: raw };
  }
}

interface Props {
  achievement: Achievement;
  onEvidenceUploaded: (uri: string, fileName: string, fileType: string) => Promise<void>;
  onEvidenceRemoved?: () => void;
  disabled?: boolean;
}

export default function EvidenceUpload({
  achievement,
  onEvidenceUploaded,
  onEvidenceRemoved,
  disabled = false,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const evidence = parseEvidenceFileId(achievement.evidenceFileId);
  const hasEvidence = !!evidence;

  const pickEvidence = async () => {
    setError('');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission denied. Please allow access to your photo library in Settings.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      const fileName = asset.fileName || `evidence_${Date.now()}.jpg`;
      const fileType = asset.mimeType || 'image/jpeg';

      setUploading(true);
      await onEvidenceUploaded(uri, fileName, fileType);
    } catch (e: any) {
      setError(e.message || 'Unable to upload evidence. Please check your connection and try again.');
    }
    setUploading(false);
  };

  const confirmRemove = () => {
    Alert.alert(
      'Remove Evidence',
      'Are you sure you want to remove this evidence? The achievement will need to be resubmitted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onEvidenceRemoved },
      ]
    );
  };

  return (
    <View style={s.container}>
      {hasEvidence ? (
        /* ── Evidence present ── */
        <View style={s.evidenceCard}>
          <View style={s.evidenceRow}>
            <View style={s.fileIcon}>
              <Text style={s.fileIconText}>📄</Text>
            </View>
            <View style={s.fileInfo}>
              <Text style={s.fileName} numberOfLines={1}>
                {evidence.fileName || 'Evidence document'}
              </Text>
              <Text style={s.fileMeta}>
                {evidence.fileType || 'Image'} · Uploaded{evidence.uploadedAt
                  ? ` ${new Date(evidence.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                  : ''}
              </Text>
            </View>
            <View style={s.uploadedBadge}>
              <Text style={s.uploadedText}>✓ Saved</Text>
            </View>
          </View>

          {!disabled && (
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, { borderColor: PRIMARY }]}
                onPress={pickEvidence}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {uploading
                  ? <ActivityIndicator size="small" color={PRIMARY} />
                  : <Text style={[s.actionBtnTxt, { color: PRIMARY }]}>Replace</Text>
                }
              </TouchableOpacity>

              {onEvidenceRemoved && (
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: '#FCA5A5' }]}
                  onPress={confirmRemove}
                  activeOpacity={0.8}
                >
                  <Text style={[s.actionBtnTxt, { color: '#DC2626' }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ) : (
        /* ── No evidence yet ── */
        <TouchableOpacity
          style={[s.uploadZone, disabled && { opacity: 0.5 }]}
          onPress={disabled ? undefined : pickEvidence}
          disabled={disabled || uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <View style={s.uploadingState}>
              <ActivityIndicator color={PRIMARY} size="small" />
              <Text style={s.uploadingText}>Uploading evidence…</Text>
            </View>
          ) : (
            <>
              <View style={s.uploadIcon}>
                <Text style={s.uploadIconText}>📎</Text>
              </View>
              <Text style={s.uploadTitle}>Upload evidence</Text>
              <Text style={s.uploadHint}>
                Certificate, result sheet, or photo
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {!!error && (
        <View style={s.errBox}>
          <Text style={s.errTxt}>⚠  {error}</Text>
          <TouchableOpacity onPress={() => setError('')} style={s.retryBtn}>
            <Text style={s.retryTxt}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 8,
  },
  evidenceCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIconText: { fontSize: 18 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13.5, fontWeight: '700', color: TEXT_MAIN },
  fileMeta: { fontSize: 11, color: TEXT_DIM, marginTop: 1 },
  uploadedBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  uploadedText: { fontSize: 10, fontWeight: '800', color: '#059669' },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  actionBtnTxt: { fontSize: 12, fontWeight: '700' },

  uploadZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: BORDER,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  uploadIconText: { fontSize: 22 },
  uploadTitle: { fontSize: 14, fontWeight: '800', color: TEXT_MAIN },
  uploadHint: { fontSize: 12, color: TEXT_FAINT, textAlign: 'center' },

  uploadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  uploadingText: { fontSize: 13, color: TEXT_DIM, fontWeight: '600' },

  errBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  errTxt: { flex: 1, color: '#DC2626', fontSize: 12, fontWeight: '600' },
  retryBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  retryTxt: { fontSize: 11, color: '#DC2626', fontWeight: '700' },
});
