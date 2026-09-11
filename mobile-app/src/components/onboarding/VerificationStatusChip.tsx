import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { VerificationStatus } from '../../utils/athleteService';

const STATUS_CONFIG: Record<
  VerificationStatus,
  { icon: string; label: string; bg: string; border: string; color: string; description: string }
> = {
  NOT_SUBMITTED: {
    icon: '○',
    label: 'Not submitted',
    bg: '#F9FAFB',
    border: '#E5E7EB',
    color: '#6B7280',
    description: 'Not yet submitted for review.',
  },
  PENDING_REVIEW: {
    icon: '◷',
    label: 'Pending review',
    bg: '#FFFBEB',
    border: '#FDE68A',
    color: '#D97706',
    description: 'Submitted and awaiting admin review.',
  },
  VERIFIED: {
    icon: '✓',
    label: 'Verified',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    color: '#059669',
    description: 'Verified by SportSphere admin.',
  },
  NEEDS_CORRECTION: {
    icon: '⚠',
    label: 'Needs correction',
    bg: '#FFF7ED',
    border: '#FDBA74',
    color: '#EA580C',
    description: 'Admin has requested a correction.',
  },
  REJECTED: {
    icon: '✕',
    label: 'Rejected',
    bg: '#FEF2F2',
    border: '#FCA5A5',
    color: '#DC2626',
    description: 'This item was rejected after review.',
  },
};

interface Props {
  status: VerificationStatus;
  size?: 'sm' | 'md';
  showDescription?: boolean;
}

export default function VerificationStatusChip({
  status,
  size = 'md',
  showDescription = false,
}: Props) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOT_SUBMITTED;
  const isSmall = size === 'sm';

  return (
    <View>
      <View
        style={[
          s.chip,
          {
            backgroundColor: cfg.bg,
            borderColor: cfg.border,
            paddingHorizontal: isSmall ? 6 : 9,
            paddingVertical: isSmall ? 2 : 4,
          },
        ]}
      >
        <Text style={[s.icon, { color: cfg.color, fontSize: isSmall ? 9 : 11 }]}>
          {cfg.icon}
        </Text>
        <Text style={[s.label, { color: cfg.color, fontSize: isSmall ? 9.5 : 11 }]}>
          {cfg.label}
        </Text>
      </View>
      {showDescription && (
        <Text style={[s.desc, { color: cfg.color }]}>{cfg.description}</Text>
      )}
    </View>
  );
}

export { STATUS_CONFIG };

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    fontWeight: '900',
  },
  label: {
    fontWeight: '700',
  },
  desc: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
});
