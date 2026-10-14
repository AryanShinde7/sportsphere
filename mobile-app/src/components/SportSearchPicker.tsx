import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileApi } from '../utils/config';

const PRIMARY = '#E2550B';
const PRIMARY_LIGHT = '#FFF7ED';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_DIM = '#4B5563';
const TEXT_FAINT = '#9CA3AF';

const SPORT_ICONS: Record<string, string> = {
  Athletics: '🏃', Swimming: '🏊', Badminton: '🏸', Wrestling: '🤼',
  Boxing: '🥊', Shooting: '🎯', Weightlifting: '🏋️', Archery: '🏹',
  'Table Tennis': '🏓', Kabaddi: '⚡', Cricket: '🏏', Football: '⚽',
  Hockey: '🏑', Tennis: '🎾', Judo: '🥋', Kalaripayattu: '⚔️',
};

interface Sport {
  id: number;
  name: string;
  category?: string;
}

interface Props {
  selectedSportId: number | null;
  selectedSportName?: string;
  onSelectSport: (sport: Sport) => void;
  label?: string;
}

export default function SportSearchPicker({
  selectedSportId,
  selectedSportName,
  onSelectSport,
  label = 'PRIMARY SPORT'
}: Props) {
  const [sports, setSports] = useState<Sport[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    loadSports();
  }, []);

  const loadSports = async () => {
    setLoading(true);
    try {
      const data = await mobileApi.sports.getAll();
      setSports(data);
    } catch (err) {
      console.warn('Failed to load sports list:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedSport = useMemo(() => {
    if (selectedSportId) {
      return sports.find(s => s.id === selectedSportId) || (selectedSportName ? { id: selectedSportId, name: selectedSportName } : null);
    }
    if (selectedSportName) {
      return sports.find(s => s.name.toLowerCase() === selectedSportName.toLowerCase()) || { id: -1, name: selectedSportName };
    }
    return null;
  }, [selectedSportId, selectedSportName, sports]);

  const filteredSports = useMemo(() => {
    if (!query.trim()) return sports.slice(0, 8);
    const q = query.trim().toLowerCase();
    return sports.filter(s => s.name.toLowerCase().includes(q));
  }, [sports, query]);

  const exactMatchExists = useMemo(() => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return sports.some(s => s.name.toLowerCase() === q);
  }, [sports, query]);

  const handleCreateCustomSport = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const newSport = await mobileApi.sports.create(trimmed, 'Custom Sport');
      setSports(prev => {
        if (prev.some(s => s.id === newSport.id)) return prev;
        return [...prev, newSport];
      });
      onSelectSport(newSport);
      setQuery('');
      setIsFocused(false);
    } catch (err) {
      console.error('Failed to create custom sport:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label} *</Text>
        {selectedSport && (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark-circle" size={13} color={PRIMARY} />
            <Text style={styles.selectedBadgeText} numberOfLines={1}>
              {SPORT_ICONS[selectedSport.name] || '🏅'} {selectedSport.name}
            </Text>
          </View>
        )}
      </View>

      {/* Search Input Box */}
      <View style={[styles.searchBox, isFocused && styles.searchBoxActive]}>
        <Ionicons name="search-outline" size={18} color={isFocused ? PRIMARY : TEXT_FAINT} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          placeholder="Type to search your sport (e.g. Cricket, Javelin, Kabaddi...)"
          placeholderTextColor={TEXT_FAINT}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsFocused(true)}
          autoCapitalize="words"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={18} color={TEXT_FAINT} />
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions and Custom Add Option */}
      {(isFocused || query.length > 0) && (
        <View style={styles.dropdownContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={PRIMARY} style={{ padding: 12 }} />
          ) : (
            <ScrollView
              style={styles.resultsScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {filteredSports.map(sport => {
                const isSelected = selectedSportId === sport.id;
                const icon = SPORT_ICONS[sport.name] || '🏅';
                return (
                  <TouchableOpacity
                    key={sport.id}
                    style={[styles.resultItem, isSelected && styles.resultItemActive]}
                    onPress={() => {
                      onSelectSport(sport);
                      setQuery('');
                      setIsFocused(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultItemLeft}>
                      <Text style={styles.sportEmoji}>{icon}</Text>
                      <View>
                        <Text style={[styles.resultItemName, isSelected && styles.resultItemNameActive]}>
                          {sport.name}
                        </Text>
                        {sport.category && (
                          <Text style={styles.resultItemCategory}>{sport.category}</Text>
                        )}
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Custom Sport Option if not an exact match */}
              {query.trim().length > 1 && !exactMatchExists && (
                <TouchableOpacity
                  style={styles.customAddButton}
                  onPress={handleCreateCustomSport}
                  disabled={creating}
                  activeOpacity={0.8}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : (
                    <>
                      <View style={styles.customAddIconWrap}>
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customAddTitle}>
                          Add "{query.trim()}" as custom sport
                        </Text>
                        <Text style={styles.customAddSubtitle}>
                          Not found in list. Tap to create and assign to profile.
                        </Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {filteredSports.length === 0 && !query.trim() && (
                <Text style={styles.emptyText}>Start typing to search or create any sport</Text>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Selected Pill if collapsed */}
      {!isFocused && query.length === 0 && selectedSport && (
        <View style={styles.activePillContainer}>
          <View style={styles.activePill}>
            <Text style={styles.activePillIcon}>{SPORT_ICONS[selectedSport.name] || '🏅'}</Text>
            <Text style={styles.activePillText}>{selectedSport.name}</Text>
            <TouchableOpacity
              onPress={() => setIsFocused(true)}
              style={styles.changeBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: TEXT_DIM,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
    maxWidth: 160,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchBoxActive: {
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    color: TEXT_MAIN,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    marginTop: 4,
    maxHeight: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  resultsScroll: {
    padding: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resultItemActive: {
    backgroundColor: PRIMARY_LIGHT,
  },
  resultItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sportEmoji: {
    fontSize: 18,
  },
  resultItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_MAIN,
  },
  resultItemNameActive: {
    color: PRIMARY,
    fontWeight: '800',
  },
  resultItemCategory: {
    fontSize: 11,
    color: TEXT_FAINT,
  },
  customAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 4,
  },
  customAddIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customAddTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
  },
  customAddSubtitle: {
    fontSize: 11,
    color: TEXT_DIM,
    marginTop: 1,
  },
  emptyText: {
    fontSize: 12,
    color: TEXT_FAINT,
    textAlign: 'center',
    padding: 16,
  },
  activePillContainer: {
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  activePillIcon: {
    fontSize: 16,
  },
  activePillText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
  },
  changeBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY,
  },
});
