import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const PRIMARY = '#E2550B';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

interface Props {
  steps: string[];
  currentStep: number; // 0-indexed
  onStepPress?: (index: number) => void;
}

export default function StepIndicator({ steps, currentStep, onStepPress }: Props) {
  return (
    <View style={s.container}>
      {/* Step dots row */}
      <View style={s.dotsRow}>
        {steps.map((_, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <React.Fragment key={i}>
              {/* Connector line */}
              {i > 0 && (
                <View style={[s.line, done && s.lineDone]} />
              )}
              {/* Dot */}
              <TouchableOpacity
                onPress={() => done && onStepPress?.(i)}
                activeOpacity={done ? 0.7 : 1}
                style={[
                  s.dot,
                  active && s.dotActive,
                  done && s.dotDone,
                ]}
              >
                {done ? (
                  <Text style={s.checkmark}>✓</Text>
                ) : (
                  <Text style={[s.dotNum, active && s.dotNumActive]}>
                    {i + 1}
                  </Text>
                )}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

      {/* Current step label */}
      <Text style={s.label}>
        Step {currentStep + 1} of {steps.length} — <Text style={s.labelBold}>{steps[currentStep]}</Text>
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    minWidth: 8,
    maxWidth: 28,
  },
  lineDone: {
    backgroundColor: PRIMARY,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  dotDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
  },
  dotNum: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_FAINT,
  },
  dotNumActive: {
    color: '#fff',
  },
  checkmark: {
    fontSize: 11,
    fontWeight: '900',
    color: '#059669',
  },
  label: {
    fontSize: 12,
    color: TEXT_DIM,
    fontWeight: '500',
  },
  labelBold: {
    fontWeight: '800',
    color: '#111827',
  },
});
