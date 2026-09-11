import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { Achievement } from '../../utils/athleteService';

const PRIMARY = '#E2550B';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

interface FormData {
  title: string;
  competition: string;
  event: string;
  position: string;
  score: string;
  date: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initialData?: Partial<Achievement>;
  mode: 'add' | 'edit';
}

export default function AchievementFormModal({ visible, onClose, onSave, initialData, mode }: Props) {
  const [form, setForm] = useState<FormData>({
    title: initialData?.title || '',
    competition: initialData?.competition || '',
    event: initialData?.event || '',
    position: initialData?.position || '',
    score: initialData?.score || '',
    date: initialData?.date || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [focusField, setFocusField] = useState('');

  const set = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Achievement title is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save achievement. Please try again.');
    }
    setSaving(false);
  };

  const inputStyle = (field: string) => [
    s.input,
    focusField === field && s.inputFocused,
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={s.header}>
              <View>
                <Text style={s.title}>
                  {mode === 'add' ? 'Add Achievement' : 'Edit Achievement'}
                </Text>
                <Text style={s.subtitle}>
                  {mode === 'add'
                    ? 'Enter the details of your achievement.'
                    : 'Update the achievement details.'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
                <Text style={s.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.form}>
              {/* Required: Title */}
              <View style={s.field}>
                <Text style={s.label}>ACHIEVEMENT TITLE <Text style={s.req}>*</Text></Text>
                <TextInput
                  style={inputStyle('title')}
                  placeholder="e.g. State Championship 400m"
                  placeholderTextColor={TEXT_FAINT}
                  value={form.title}
                  onChangeText={v => set('title', v)}
                  onFocus={() => setFocusField('title')}
                  onBlur={() => setFocusField('')}
                />
              </View>

              {/* Competition */}
              <View style={s.field}>
                <Text style={s.label}>COMPETITION / EVENT NAME</Text>
                <TextInput
                  style={inputStyle('competition')}
                  placeholder="e.g. Maharashtra State Athletics Championship"
                  placeholderTextColor={TEXT_FAINT}
                  value={form.competition}
                  onChangeText={v => set('competition', v)}
                  onFocus={() => setFocusField('competition')}
                  onBlur={() => setFocusField('')}
                />
              </View>

              {/* Event / Discipline */}
              <View style={s.field}>
                <Text style={s.label}>EVENT / DISCIPLINE</Text>
                <TextInput
                  style={inputStyle('event')}
                  placeholder="e.g. 400m Sprint"
                  placeholderTextColor={TEXT_FAINT}
                  value={form.event}
                  onChangeText={v => set('event', v)}
                  onFocus={() => setFocusField('event')}
                  onBlur={() => setFocusField('')}
                />
              </View>

              {/* Position */}
              <View style={s.row}>
                <View style={[s.field, { flex: 1 }]}>
                  <Text style={s.label}>POSITION / RANK</Text>
                  <TextInput
                    style={inputStyle('position')}
                    placeholder="e.g. 2nd Place"
                    placeholderTextColor={TEXT_FAINT}
                    value={form.position}
                    onChangeText={v => set('position', v)}
                    onFocus={() => setFocusField('position')}
                    onBlur={() => setFocusField('')}
                  />
                </View>

                {/* Score */}
                <View style={[s.field, { flex: 1 }]}>
                  <Text style={s.label}>SCORE / TIME</Text>
                  <TextInput
                    style={inputStyle('score')}
                    placeholder="e.g. 48.2s"
                    placeholderTextColor={TEXT_FAINT}
                    value={form.score}
                    onChangeText={v => set('score', v)}
                    onFocus={() => setFocusField('score')}
                    onBlur={() => setFocusField('')}
                  />
                </View>
              </View>

              {/* Date */}
              <View style={s.field}>
                <Text style={s.label}>DATE / YEAR</Text>
                <TextInput
                  style={inputStyle('date')}
                  placeholder="e.g. 2026 or March 2026"
                  placeholderTextColor={TEXT_FAINT}
                  value={form.date}
                  onChangeText={v => set('date', v)}
                  onFocus={() => setFocusField('date')}
                  onBlur={() => setFocusField('')}
                />
              </View>

              {/* Error */}
              {!!error && (
                <View style={s.errBox}>
                  <Text style={s.errTxt}>⚠  {error}</Text>
                </View>
              )}

              {/* Actions */}
              <TouchableOpacity
                style={[s.btn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnTxt}>{mode === 'add' ? 'ADD ACHIEVEMENT' : 'SAVE CHANGES'}</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: TEXT_MAIN,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_DIM,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeTxt: {
    fontSize: 16,
    color: TEXT_FAINT,
    fontWeight: '700',
  },
  form: {
    paddingHorizontal: 22,
    paddingTop: 8,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    gap: 5,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    color: TEXT_DIM,
    letterSpacing: 1,
  },
  req: {
    color: PRIMARY,
  },
  input: {
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT_MAIN,
    fontSize: 14.5,
    fontWeight: '500',
  },
  inputFocused: {
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
  },
  errBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
  },
  errTxt: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  btn: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  btnTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelTxt: {
    color: TEXT_DIM,
    fontSize: 14,
    fontWeight: '600',
  },
});
