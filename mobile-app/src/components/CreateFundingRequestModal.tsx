import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Alert,
  Platform
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileApi, Storage } from '../utils/config';

const PRIMARY = '#E2550B';
const PRIMARY_LIGHT = '#FFF7ED';
const BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';
const SUCCESS_GREEN = '#059669';

export const FUNDING_CATEGORIES = [
  { id: 'EQUIPMENT', label: 'Equipment & Gear', icon: 'shield-outline', defaultItem: 'Competition Gear / Equipment' },
  { id: 'TRAINING', label: 'Coaching & Academy', icon: 'fitness-outline', defaultItem: 'Elite Coaching & Academy Fees' },
  { id: 'TRAVEL', label: 'Tournaments & Travel', icon: 'airplane-outline', defaultItem: 'Travel & Accommodation for Nationals' },
  { id: 'COMPETITION', label: 'Entry & Registration', icon: 'trophy-outline', defaultItem: 'Championship Registration Fees' },
  { id: 'MEDICAL', label: 'Physio & Medical', icon: 'medkit-outline', defaultItem: 'Physiotherapy & Injury Rehab' },
  { id: 'NUTRITION', label: 'Diet & Supplements', icon: 'restaurant-outline', defaultItem: 'High-Performance Diet & Nutrition' },
];

const PRESETS = [
  { label: '+ Equipment', category: 'EQUIPMENT', desc: 'Competition Equipment / Kit', amount: '25000' },
  { label: '+ Travel / Flight', category: 'TRAVEL', desc: 'Travel & Hotel for Championship', amount: '20000' },
  { label: '+ Coaching', category: 'TRAINING', desc: 'Specialized Coaching (3 Months)', amount: '30000' },
  { label: '+ Entry Fee', category: 'COMPETITION', desc: 'Tournament Registration Fee', amount: '5000' },
  { label: '+ Nutrition', category: 'NUTRITION', desc: 'Sports Supplements & Diet Plan', amount: '12000' },
  { label: '+ Physio', category: 'MEDICAL', desc: 'Sports Physiotherapy & Recovery', amount: '15000' },
];

const DURATION_OPTIONS = [
  { days: 15, label: '15 Days' },
  { days: 30, label: '30 Days (Recommended)' },
  { days: 60, label: '60 Days' },
  { days: 90, label: '90 Days' },
];

export interface BudgetItemInput {
  id: string;
  description: string;
  amount: string;
  category?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newCampaign: any) => void;
  athleteName?: string;
  sportName?: string;
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function CreateFundingRequestModal({
  visible,
  onClose,
  onSuccess,
  athleteName = 'Athlete',
  sportName = 'Sport'
}: Props) {
  const [activeTab, setActiveTab] = useState<'FORM' | 'PREVIEW'>('FORM');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('EQUIPMENT');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [durationDays, setDurationDays] = useState(30);

  // Itemized Budget Line Items with dynamic calculation
  const [budgetItems, setBudgetItems] = useState<BudgetItemInput[]>([
    { id: '1', description: 'Competition Gear / Equipment', amount: '35000', category: 'EQUIPMENT' },
    { id: '2', description: 'Travel & Accommodation', amount: '15000', category: 'TRAVEL' },
  ]);

  // Manual total override toggle (if athlete wants to manually override calculated total)
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [manualTargetAmount, setManualTargetAmount] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Automatically calculate sum from budget items
  const calculatedSum = useMemo(() => {
    return budgetItems.reduce((acc, item) => {
      const val = parseFloat(item.amount);
      return acc + (isNaN(val) || val < 0 ? 0 : val);
    }, 0);
  }, [budgetItems]);

  // Effective target funding amount
  const targetAmount = useMemo(() => {
    if (isManualOverride && manualTargetAmount.trim()) {
      const val = parseFloat(manualTargetAmount);
      return isNaN(val) ? 0 : val;
    }
    return calculatedSum;
  }, [isManualOverride, manualTargetAmount, calculatedSum]);

  // Calculated deadline date
  const calculatedDeadline = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + durationDays);
    return d;
  }, [durationDays]);

  const handleAddBudgetItem = (presetDesc?: string, presetAmt?: string, presetCat?: string) => {
    const newItem: BudgetItemInput = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      description: presetDesc || '',
      amount: presetAmt || '',
      category: presetCat || category,
    };
    setBudgetItems(prev => [...prev, newItem]);
    if (isManualOverride) {
      setIsManualOverride(false);
    }
  };

  const handleRemoveBudgetItem = (id: string) => {
    if (budgetItems.length <= 1) {
      Alert.alert('Minimum 1 Item', 'At least one budget line item is required for verified transparency.');
      return;
    }
    setBudgetItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateBudgetItem = (id: string, field: 'description' | 'amount', value: string) => {
    setBudgetItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async () => {
    setError('');

    if (!title.trim()) {
      setError('Please provide a campaign title / primary reason for funding.');
      setActiveTab('FORM');
      return;
    }

    if (targetAmount <= 0) {
      setError('Please enter at least one budget item with a valid amount greater than ₹0.');
      setActiveTab('FORM');
      return;
    }

    if (!description.trim()) {
      setError('Please provide details explaining why you need these funds and your upcoming athletic goals.');
      setActiveTab('FORM');
      return;
    }

    // Filter valid budget items
    const validBudget = budgetItems
      .filter(item => item.description.trim() && parseFloat(item.amount) > 0)
      .map(item => ({
        description: item.description.trim(),
        amount: parseFloat(item.amount),
        evidenceFileId: evidenceUrl.trim() || undefined,
      }));

    if (validBudget.length === 0) {
      setError('Please provide at least one valid itemized budget expense.');
      setActiveTab('FORM');
      return;
    }

    setLoading(true);

    try {
      const created = await mobileApi.support.createSupportRequest({
        title: title.trim(),
        category,
        targetAmount: Math.round(targetAmount),
        description: description.trim(),
        deadline: calculatedDeadline.toISOString(),
        evidenceUrl: evidenceUrl.trim() || undefined,
        budgetItems: validBudget,
      });

      Alert.alert(
        '📋 Campaign Submitted for Review!',
        `Your funding request of ${inr(targetAmount)} has been submitted to the admin verification queue. Once approved by a compliance reviewer, it will go live on the Home Feed for contributions.`,
        [
          {
            text: 'View Status',
            onPress: () => {
              onSuccess(created);
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Create support request error:', err);
      setError(
        err.response?.data?.error ||
          'Failed to publish campaign. Please verify your connection and details.'
      );
      setActiveTab('FORM');
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
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.headerTitle}>Start a Funding Campaign</Text>
                <View style={styles.verifiedHeaderBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#059669" />
                  <Text style={styles.verifiedHeaderText}>VERIFIED</Text>
                </View>
              </View>
              <Text style={styles.headerSub}>
                Transparent itemized funding for athletic milestones
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={TEXT_MAIN} />
            </TouchableOpacity>
          </View>

          {/* Tab Selector: Edit vs Donor Preview */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'FORM' && styles.tabBtnActive]}
              onPress={() => setActiveTab('FORM')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color={activeTab === 'FORM' ? PRIMARY : TEXT_DIM}
              />
              <Text
                style={[styles.tabBtnText, activeTab === 'FORM' && styles.tabBtnTextActive]}
              >
                1. Budget & Story
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'PREVIEW' && styles.tabBtnActive]}
              onPress={() => setActiveTab('PREVIEW')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="eye-outline"
                size={15}
                color={activeTab === 'PREVIEW' ? PRIMARY : TEXT_DIM}
              />
              <Text
                style={[styles.tabBtnText, activeTab === 'PREVIEW' && styles.tabBtnTextActive]}
              >
                2. Live Donor Preview
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Error banner */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {activeTab === 'FORM' ? (
              <>
                {/* 1. Campaign Title / Primary Reason */}
                <View style={styles.field}>
                  <Text style={styles.label}>CAMPAIGN TITLE / PRIMARY REASON *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Olympic Training Camp & International Javelin Set"
                    placeholderTextColor={TEXT_FAINT}
                    value={title}
                    onChangeText={setTitle}
                  />
                  <Text style={styles.helperText}>
                    Be clear and specific (e.g. state what tournament, equipment, or training you need).
                  </Text>
                </View>

                {/* 2. Category Selector */}
                <View style={styles.field}>
                  <Text style={styles.label}>PRIMARY FUNDING CATEGORY *</Text>
                  <View style={styles.categoryGrid}>
                    {FUNDING_CATEGORIES.map(cat => {
                      const isSelected = category === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryCard,
                            isSelected && styles.categoryCardSelected,
                          ]}
                          onPress={() => setCategory(cat.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={cat.icon as any}
                            size={16}
                            color={isSelected ? PRIMARY : TEXT_DIM}
                          />
                          <Text
                            style={[
                              styles.categoryText,
                              isSelected && styles.categoryTextSelected,
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 3. Dynamic Fund Calculation & Itemized Budget */}
                <View style={styles.field}>
                  <View style={styles.budgetHeader}>
                    <View>
                      <Text style={styles.label}>ITEMIZED BUDGET CALCULATOR *</Text>
                      <Text style={styles.calculatorSub}>
                        Total funding goal is auto-calculated from your expenses below
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleAddBudgetItem()}
                      style={styles.addBudgetBtn}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add" size={14} color={PRIMARY} />
                      <Text style={styles.addBudgetText}>+ Add Row</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Preset Buttons */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetsRow}
                  >
                    <Text style={styles.presetsLabel}>Quick Presets:</Text>
                    {PRESETS.map((p, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.presetChip}
                        onPress={() => handleAddBudgetItem(p.desc, p.amount, p.category)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.presetChipText}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Budget Line Items */}
                  {budgetItems.map((item, idx) => (
                    <View key={item.id} style={styles.budgetRow}>
                      <View style={styles.budgetRowIndex}>
                        <Text style={styles.budgetRowIndexText}>{idx + 1}</Text>
                      </View>
                      <TextInput
                        style={[styles.input, { flex: 2 }]}
                        placeholder="Expense description (e.g. Competition Spikes)"
                        placeholderTextColor={TEXT_FAINT}
                        value={item.description}
                        onChangeText={val => handleUpdateBudgetItem(item.id, 'description', val)}
                      />
                      <View style={[styles.amountInputWrap, { flex: 1.1 }]}>
                        <Text style={styles.amountPrefix}>₹</Text>
                        <TextInput
                          style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 4 }]}
                          placeholder="Amount"
                          placeholderTextColor={TEXT_FAINT}
                          keyboardType="numeric"
                          value={item.amount}
                          onChangeText={val => handleUpdateBudgetItem(item.id, 'amount', val)}
                        />
                      </View>
                      {budgetItems.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleRemoveBudgetItem(item.id)}
                          style={styles.deleteBudgetBtn}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={17} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  {/* Financial Summary Card with Live Calculation */}
                  <View style={styles.financialCard}>
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Itemized Subtotal ({budgetItems.length} items)</Text>
                      <Text style={styles.financialVal}>{inr(calculatedSum)}</Text>
                    </View>

                    <View style={styles.financialRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.financialLabel}>SportSphere Platform Fee</Text>
                        <View style={styles.zeroFeeBadge}>
                          <Text style={styles.zeroFeeText}>0% FEE</Text>
                        </View>
                      </View>
                      <Text style={[styles.financialVal, { color: SUCCESS_GREEN }]}>₹0</Text>
                    </View>

                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Net Community Funds Received</Text>
                      <Text style={[styles.financialVal, { color: SUCCESS_GREEN, fontWeight: '800' }]}>
                        100%
                      </Text>
                    </View>

                    <View style={styles.financialDivider} />

                    <View style={styles.financialTotalRow}>
                      <View>
                        <Text style={styles.financialTotalLabel}>TOTAL FUNDING GOAL</Text>
                        <Text style={styles.financialTotalSub}>
                          Amount required to fulfill this campaign
                        </Text>
                      </View>
                      <Text style={styles.financialTotalVal}>{inr(targetAmount)}</Text>
                    </View>
                  </View>
                </View>

                {/* 4. Campaign Duration Selector */}
                <View style={styles.field}>
                  <Text style={styles.label}>CAMPAIGN TIMELINE *</Text>
                  <View style={styles.durationRow}>
                    {DURATION_OPTIONS.map(opt => {
                      const isSelected = durationDays === opt.days;
                      return (
                        <TouchableOpacity
                          key={opt.days}
                          style={[
                            styles.durationChip,
                            isSelected && styles.durationChipSelected,
                          ]}
                          onPress={() => setDurationDays(opt.days)}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.durationText,
                              isSelected && styles.durationTextSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.helperText}>
                    Campaign will run until {calculatedDeadline.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}.
                  </Text>
                </View>

                {/* 5. Detailed Reason / Story */}
                <View style={styles.field}>
                  <Text style={styles.label}>DETAILED STORY & REASON FOR NEEDING FUNDS *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe your training roadmap, why you need this support right now, and how it will help you achieve podium success. Contributors love hearing your passion and commitment."
                    placeholderTextColor={TEXT_FAINT}
                    multiline
                    numberOfLines={4}
                    value={description}
                    onChangeText={setDescription}
                  />
                  <Text style={styles.helperText}>
                    Mention your coaches, academies, upcoming state/national dates, and past achievements.
                  </Text>
                </View>

                {/* 6. Supporting Documents & Proof URL */}
                <View style={styles.field}>
                  <Text style={styles.label}>SUPPORTING DOCUMENT / EVIDENCE URL (RECOMMENDED)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Google Drive link to quotation, coach selection letter, tournament invoice"
                    placeholderTextColor={TEXT_FAINT}
                    value={evidenceUrl}
                    onChangeText={setEvidenceUrl}
                    autoCapitalize="none"
                  />
                  <View style={styles.proofTipBox}>
                    <Ionicons name="shield-checkmark" size={16} color={SUCCESS_GREEN} />
                    <Text style={styles.proofTipText}>
                      Campaigns with attached quotations and tournament letters receive 4x more community donations!
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              /* LIVE DONOR PREVIEW TAB */
              <View style={styles.previewContainer}>
                <View style={styles.previewNotice}>
                  <Ionicons name="information-circle-outline" size={18} color={PRIMARY} />
                  <Text style={styles.previewNoticeText}>
                    This is how your verified funding request will appear on the Home Feed to all supporters and sponsors:
                  </Text>
                </View>

                {/* Mock Card Preview */}
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <View style={styles.previewBadgeRow}>
                      <View style={styles.previewCatChip}>
                        <Ionicons
                          name={
                            (FUNDING_CATEGORIES.find(c => c.id === category)?.icon as any) ||
                            'trophy-outline'
                          }
                          size={12}
                          color="#FFFFFF"
                        />
                        <Text style={styles.previewCatText}>{category}</Text>
                      </View>
                      <View style={styles.previewVerifiedChip}>
                        <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                        <Text style={styles.previewVerifiedText}>VERIFIED ATHLETE</Text>
                      </View>
                    </View>
                    <Text style={styles.previewDaysLeft}>
                      ⏳ {durationDays} days left
                    </Text>
                  </View>

                  <Text style={styles.previewTitle}>
                    {title.trim() || 'Olympic Training Camp & International Javelin Set'}
                  </Text>
                  <Text style={styles.previewAthleteMeta}>
                    By {athleteName} · {sportName}
                  </Text>

                  <Text style={styles.previewDesc} numberOfLines={3}>
                    {description.trim() ||
                      'Raising funds to cover essential equipment and national camp travel to qualify for the upcoming Asian Championships.'}
                  </Text>

                  {/* Itemized Budget Pills */}
                  <View style={styles.previewBudgetWrap}>
                    <Text style={styles.previewBudgetTitle}>Itemized Budget Breakdown:</Text>
                    {budgetItems
                      .filter(b => b.description.trim() && parseFloat(b.amount) > 0)
                      .map((b, i) => (
                        <View key={i} style={styles.previewBudgetRow}>
                          <Text style={styles.previewBudgetDesc} numberOfLines={1}>
                            • {b.description}
                          </Text>
                          <Text style={styles.previewBudgetAmt}>{inr(parseFloat(b.amount))}</Text>
                        </View>
                      ))}
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.previewProgressWrap}>
                    <View style={styles.previewProgressMeta}>
                      <Text style={styles.previewRaised}>₹0 raised (0%)</Text>
                      <Text style={styles.previewGoal}>Goal: {inr(targetAmount)}</Text>
                    </View>
                    <View style={styles.previewTrack}>
                      <View style={[styles.previewFill, { width: '4%' }]} />
                    </View>
                  </View>

                  {/* Fake Support CTA */}
                  <View style={styles.previewCtaBtn}>
                    <Text style={styles.previewCtaBtnText}>❤️ Support with Razorpay (Preview)</Text>
                  </View>
                </View>
              </View>
            )}

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
              style={[styles.submitBtn, (loading || targetAmount <= 0) && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading || targetAmount <= 0}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  Publish Campaign ({inr(targetAmount)}) →
                </Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: TEXT_MAIN,
    letterSpacing: -0.3,
  },
  verifiedHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedHeaderText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.4,
  },
  headerSub: {
    fontSize: 11.5,
    color: TEXT_DIM,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#F9FAFB',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: PRIMARY,
    backgroundColor: '#FFFFFF',
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  tabBtnTextActive: {
    color: PRIMARY,
    fontWeight: '900',
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
    letterSpacing: 0.8,
    color: TEXT_DIM,
    marginBottom: 6,
  },
  calculatorSub: {
    fontSize: 11,
    color: TEXT_FAINT,
    marginTop: -2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: TEXT_MAIN,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  amountPrefix: {
    fontSize: 15,
    fontWeight: '800',
    color: PRIMARY,
    marginRight: 2,
  },
  textArea: {
    minHeight: 85,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  categoryCardSelected: {
    backgroundColor: PRIMARY_LIGHT,
    borderColor: PRIMARY,
  },
  categoryText: {
    fontSize: 11.5,
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
    lineHeight: 15,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  addBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: PRIMARY,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addBudgetText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 6,
  },
  presetsLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: TEXT_FAINT,
    marginRight: 2,
  },
  presetChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: BORDER,
  },
  presetChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  budgetRowIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetRowIndexText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: TEXT_DIM,
  },
  deleteBudgetBtn: {
    padding: 6,
  },
  financialCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 6,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  financialLabel: {
    fontSize: 12,
    color: TEXT_DIM,
    fontWeight: '500',
  },
  financialVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: TEXT_MAIN,
  },
  zeroFeeBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  zeroFeeText: {
    fontSize: 9,
    fontWeight: '900',
    color: SUCCESS_GREEN,
  },
  financialDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  financialTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialTotalLabel: {
    fontSize: 11.5,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  financialTotalSub: {
    fontSize: 10,
    color: TEXT_FAINT,
  },
  financialTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: PRIMARY,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  durationChipSelected: {
    backgroundColor: PRIMARY_LIGHT,
    borderColor: PRIMARY,
  },
  durationText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  durationTextSelected: {
    color: PRIMARY,
    fontWeight: '800',
  },
  proofTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 9,
    marginTop: 6,
  },
  proofTipText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
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
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  previewContainer: {
    paddingBottom: 10,
  },
  previewNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY_LIGHT,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  previewNoticeText: {
    fontSize: 11.5,
    color: PRIMARY,
    fontWeight: '600',
    flex: 1,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  previewCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TEXT_MAIN,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  previewCatText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  previewVerifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: SUCCESS_GREEN,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
  },
  previewVerifiedText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  previewDaysLeft: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_FAINT,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT_MAIN,
    marginBottom: 2,
  },
  previewAthleteMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TEXT_DIM,
    marginBottom: 8,
  },
  previewDesc: {
    fontSize: 12,
    color: TEXT_DIM,
    lineHeight: 16,
    marginBottom: 10,
  },
  previewBudgetWrap: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  previewBudgetTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 4,
  },
  previewBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  previewBudgetDesc: {
    fontSize: 11,
    color: TEXT_DIM,
    flex: 1,
  },
  previewBudgetAmt: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_MAIN,
  },
  previewProgressWrap: {
    marginBottom: 12,
  },
  previewProgressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewRaised: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
  previewGoal: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TEXT_DIM,
  },
  previewTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  previewFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },
  previewCtaBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TEXT_DIM,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: PRIMARY,
  },
  submitBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
