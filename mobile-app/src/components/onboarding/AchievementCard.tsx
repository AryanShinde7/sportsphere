import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import VerificationStatusChip, { STATUS_CONFIG } from './VerificationStatusChip';
import type { Achievement } from '../../utils/athleteService';

const PRIMARY = '#E2550B';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

interface Props {
  achievement: Achievement;
  onEdit: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  onViewEvidence?: () => void;
  isSubmitting?: boolean;
}

export default function AchievementCard({
  achievement,
  onEdit,
  onDelete,
  onSubmit,
  isSubmitting = false,
}: Props) {
  const status = achievement.verificationStatus;
  const canSubmit = status === 'NOT_SUBMITTED' || status === 'NEEDS_CORRECTION';
  const canEdit = status !== 'VERIFIED';
  const hasEvidence = !!achievement.evidenceFileId;

  return (
    <View style={s.card}>
      {/* Top row: title + status */}
      <View style={s.topRow}>
        <View style={s.titleGroup}>
          <Text style={s.title} numberOfLines={2}>{achievement.title}</Text>
          {achievement.competition && (
            <Text style={s.competition} numberOfLines={1}>{achievement.competition}</Text>
          )}
        </View>
        <VerificationStatusChip status={status} size="sm" />
      </View>

      {/* Meta row */}
      <View style={s.metaRow}>
        {achievement.event && (
          <View style={s.metaPill}>
            <Text style={s.metaTxt}>🏃 {achievement.event}</Text>
          </View>
        )}
        {achievement.position && (
          <View style={s.metaPill}>
            <Text style={s.metaTxt}>🏆 {achievement.position}</Text>
          </View>
        )}
        {achievement.score && (
          <View style={s.metaPill}>
            <Text style={s.metaTxt}>⏱ {achievement.score}</Text>
          </View>
        )}
        {achievement.date && (
          <View style={s.metaPill}>
            <Text style={s.metaTxt}>📅 {achievement.date}</Text>
          </View>
        )}
      </View>

      {/* Evidence indicator */}
      <View style={s.evidenceRow}>
        {hasEvidence ? (
          <View style={s.evidenceBadge}>
            <Text style={s.evidenceBadgeTxt}>📎 Evidence attached</Text>
          </View>
        ) : (
          <View style={[s.evidenceBadge, s.evidenceMissing]}>
            <Text style={[s.evidenceBadgeTxt, { color: '#D97706' }]}>📎 No evidence uploaded</Text>
          </View>
        )}
      </View>

      {/* Admin correction note */}
      {status === 'NEEDS_CORRECTION' && achievement.reviewNotes && (
        <View style={s.noteBox}>
          <Text style={s.noteLabel}>Admin note:</Text>
          <Text style={s.noteText}>"{achievement.reviewNotes}"</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={s.actions}>
        {canEdit && (
          <TouchableOpacity style={s.editBtn} onPress={onEdit} activeOpacity={0.8}>
            <Text style={s.editBtnTxt}>Edit</Text>
          </TouchableOpacity>
        )}

        {canSubmit && (
          <TouchableOpacity
            style={[s.submitBtn, (!hasEvidence || isSubmitting) && { opacity: 0.5 }]}
            onPress={onSubmit}
            disabled={!hasEvidence || isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={s.submitBtnTxt}>
              {status === 'NEEDS_CORRECTION' ? 'Fix & Resubmit' : 'Submit for Verification'}
            </Text>
          </TouchableOpacity>
        )}

        {canEdit && status !== 'VERIFIED' && (
          <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
            <Text style={s.deleteBtnTxt}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Submit hint when no evidence */}
      {canSubmit && !hasEvidence && (
        <Text style={s.hint}>⚠ Upload evidence before submitting for verification.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleGroup: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  competition: { fontSize: 12, color: TEXT_DIM, marginTop: 2 },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaTxt: { fontSize: 11, color: TEXT_DIM, fontWeight: '600' },

  evidenceRow: {
    flexDirection: 'row',
  },
  evidenceBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  evidenceMissing: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  evidenceBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  noteBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  noteLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  noteText: {
    fontSize: 13,
    color: '#92400E',
    fontStyle: 'italic',
    lineHeight: 19,
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  editBtnTxt: { fontSize: 12, fontWeight: '700', color: TEXT_DIM },

  submitBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },

  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  deleteBtnTxt: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  hint: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
});
