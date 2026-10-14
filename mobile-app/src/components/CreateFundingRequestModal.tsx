import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileApi } from '../utils/config';

const PRIMARY = '#E2550B';
const PRIMARY_LIGHT = '#FFF7ED';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';
const SUCCESS_GREEN = '#059669';

const CATEGORIES = [
  { id: 'EQUIPMENT', label: 'Equipment & Gear', icon: 'shield-outline' },
  { id: 'TRAINING', label: 'Coaching & Academy', icon: 'fitness-outline' },
  { id: 'TRAVEL', label: 'Tournaments & Travel', icon: 'airplane-outline' },
  { id: 'COMPETITION', label: 'Entry & Registration', icon: 'trophy-outline' },
  { id: 'MEDICAL', label: 'Physio & Medical', icon: 'medkit-outline' },
  { id: 'NUTRITION', label: 'Diet & Supplements', icon: 'restaurant-outline' },
];

interface BudgetItemInput {
  description: string;
  amount: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newCampaign: any) => void;
}

export default function CreateFundingRequestModal({ visible, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('EQUIPMENT');
  const [targetAmount, setTargetAmount] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [budgetItems, setBudgetItems] = useState<BudgetItemInput[]>([
    { description: '', amount: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddBudgetItem = () => {
    setBudgetItems([...budgetItems, { description: '', amount: '' }]);
  };

  const handleRemoveBudgetItem = (index: number) => {
    if (budgetItems.length <= 1) return;
    setBudgetItems(budgetItems.filter((_, idx) => idx !== index));
  };

  const handleUpdateBudgetItem = (index: number, field: 'description' | 'amount', value: string) => {
    const updated = [...budgetItems];
    updated[index][field] = value;
    setBudgetItems(updated);
  };

  const handleSubmit = async () => {
    setError('');

    if (!title.trim()) {
      setError('Please provide a campaign title / primary reason for funding.');
      return;
    }

    const numAmount = parseFloat(targetAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid target funding amount greater than ₹0.');
      return;
    }

    if (!description.trim()) {
      setError('Please explain why you need funding and how it will elevate your athletic career.');
      return;
    }

    // Filter valid budget items
    const validBudget = budgetItems
      .filter(item => item.description.trim() && parseFloat(item.amount) > 0)
      .map(item => ({
        description: item.description.trim(),
        amount: parseFloat(item.amount)
      }));

    setLoading(true);

    try {
      const created = await mobileApi.support.createSupportRequest({
        title: title.trim(),
        category,
        targetAmount: numAmount,
        description: description.trim(),
        evidenceUrl: evidenceUrl.trim() || undefined,
        budgetItems: validBudget.length > 0 ? validBudget : undefined,
      });

      Alert.alert(
        'Campaign Published!',
        'Your funding request is now active and visible to all supporters and contributors on SportSphere.',
        [{ text: 'Great!', onPress: () => onSuccess(created) }]
      );
    } catch (err: any) {
      console.error('Create support request error:', err);
      setError(err.response?.data?.error || 'Failed to publish campaign. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Start a Funding Campaign</Text>
              <Text style={styles.headerSub}>Raise verified community funds for your athletic goals</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={TEXT_MAIN} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Error banner */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Campaign Title / Reason */}
            <View style={styles.field}>
              <Text style={styles.label}>CAMPAIGN TITLE / PRIMARY REASON *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Olympic Training Camp & International Javelin Set"
                placeholderTextColor={TEXT_FAINT}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Target Amount */}
            <View style={styles.field}>
              <Text style={styles.label}>TARGET FUNDING AMOUNT (INR) *</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.amountPrefix}>₹</Text>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 6 }]}
                  placeholder="e.g. 75000"
                  placeholderTextColor={TEXT_FAINT}
                  keyboardType="numeric"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                />
              </View>
            </View>

            {/* Category Selector */}
            <View style={styles.field}>
              <Text style={styles.label}>FUNDING CATEGORY *</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                      onPress={() => setCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={18}
                        color={isSelected ? PRIMARY : TEXT_DIM}
                      />
                      <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Detailed Reason / Story */}
            <View style={styles.field}>
              <Text style={styles.label}>DETAILED STORY & REASON FOR NEEDING FUNDS *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your training roadmap, why you need this support right now, and how it will help you achieve podium success."
                placeholderTextColor={TEXT_FAINT}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Supporting Documents & Proof */}
            <View style={styles.field}>
              <Text style={styles.label}>SUPPORTING DOCUMENT / EVIDENCE URL (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Link to tournament selection letter, quotation, coach certificate"
                placeholderTextColor={TEXT_FAINT}
                value={evidenceUrl}
                onChangeText={setEvidenceUrl}
                autoCapitalize="none"
              />
              <Text style={styles.helperText}>
                Adding proof (selection letters, gear quotes, invoices) boosts verification trust and donor conversion.
              </Text>
            </View>

            {/* Itemized Budget Breakdown */}
            <View style={styles.field}>
              <View style={styles.budgetHeader}>
                <Text style={styles.label}>BUDGET BREAKDOWN (OPTIONAL)</Text>
                <TouchableOpacity onPress={handleAddBudgetItem} style={styles.addBudgetBtn}>
                  <Ionicons name="add" size={14} color={PRIMARY} />
                  <Text style={styles.addBudgetText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {budgetItems.map((item, idx) => (
                <View key={idx} style={styles.budgetRow}>
                  <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder={`Item ${idx + 1} (e.g. Competition Javelin)`}
                    placeholderTextColor={TEXT_FAINT}
                    value={item.description}
                    onChangeText={(val) => handleUpdateBudgetItem(idx, 'description', val)}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="₹ Amount"
                    placeholderTextColor={TEXT_FAINT}
                    keyboardType="numeric"
                    value={item.amount}
                    onChangeText={(val) => handleUpdateBudgetItem(idx, 'amount', val)}
                  />
                  {budgetItems.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveBudgetItem(idx)}
                      style={styles.deleteBudgetBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Footer Submit */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Publish Campaign →</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_MAIN,
  },
  headerSub: {
    fontSize: 12,
    color: TEXT_DIM,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: TEXT_DIM,
    marginBottom: 6,
  },
  input: {
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: TEXT_MAIN,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  amountPrefix: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY,
    marginRight: 4,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  categoryCardSelected: {
    backgroundColor: PRIMARY_LIGHT,
    borderColor: PRIMARY,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  categoryTextSelected: {
    color: PRIMARY,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 11,
    color: TEXT_FAINT,
    marginTop: 4,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addBudgetText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  deleteBudgetBtn: {
    padding: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: PRIMARY,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
