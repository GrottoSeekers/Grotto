import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SortBy } from '@/store/discovery-store';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

// ─── Config ───────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'newest',      label: 'Newest first' },
  { key: 'start_date',  label: 'By start date' },
];

const PET_OPTIONS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all',        label: 'All pets',   icon: 'paw-outline' },
  { key: 'no_pets',    label: 'No pets',    icon: 'close-circle-outline' },
  { key: 'dog',        label: 'Dogs',       icon: 'paw-outline' },
  { key: 'cat',        label: 'Cats',       icon: 'paw-outline' },
  { key: 'bird',       label: 'Birds',      icon: 'happy-outline' },
  { key: 'fish',       label: 'Fish',       icon: 'water-outline' },
  { key: 'rabbit',     label: 'Rabbits',    icon: 'ellipse-outline' },
  { key: 'reptile',    label: 'Reptiles',   icon: 'leaf-outline' },
  { key: 'horse',      label: 'Horses',     icon: 'paw-outline' },
  { key: 'small pet',  label: 'Small pets', icon: 'paw-outline' },
];

const DURATION_OPTIONS: { key: number; label: string }[] = [
  { key: 0,  label: 'Any' },
  { key: 1,  label: '1+ nights' },
  { key: 3,  label: '3+ nights' },
  { key: 7,  label: '1+ weeks' },
  { key: 14, label: '2+ weeks' },
];

const AMENITY_OPTIONS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'wifi',      label: 'Wifi',       icon: 'wifi-outline' },
  { key: 'pool',      label: 'Pool',       icon: 'water-outline' },
  { key: 'garden',    label: 'Garden',     icon: 'leaf-outline' },
  { key: 'parking',   label: 'Parking',    icon: 'car-outline' },
  { key: 'workspace', label: 'Workspace',  icon: 'desktop-outline' },
  { key: 'gym',       label: 'Gym',        icon: 'barbell-outline' },
  { key: 'tv',        label: 'TV',         icon: 'tv-outline' },
  { key: 'washer',    label: 'Washer',     icon: 'shirt-outline' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterState {
  sortBy: SortBy;
  petFilters: string[];
  minNights: number;
  amenityFilters: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initialFilters: FilterState;
  resultCount: number;
  onApply: (filters: FilterState) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterSheet({ visible, onClose, initialFilters, resultCount, onApply }: Props) {
  const [sortBy, setSortBy]               = useState<SortBy>(initialFilters.sortBy);
  const [petFilters, setPetFilters]       = useState<string[]>(initialFilters.petFilters);
  const [minNights, setMinNights]         = useState<number>(initialFilters.minNights);
  const [amenityFilters, setAmenityFilters] = useState<string[]>(initialFilters.amenityFilters);

  // Sync state when sheet (re)opens
  useEffect(() => {
    if (visible) {
      setSortBy(initialFilters.sortBy);
      setPetFilters(initialFilters.petFilters);
      setMinNights(initialFilters.minNights);
      setAmenityFilters(initialFilters.amenityFilters);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleApply() {
    onApply({ sortBy, petFilters, minNights, amenityFilters });
    onClose();
  }

  function handleClearAll() {
    setSortBy('recommended');
    setPetFilters([]);
    setMinNights(0);
    setAmenityFilters([]);
  }

  function togglePet(key: string) {
    if (key === 'all') { setPetFilters([]); return; }
    setPetFilters(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev.filter(k => k !== 'all'), key]
    );
  }

  function toggleAmenity(key: string) {
    setAmenityFilters(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  const isPetActive = (key: string) =>
    key === 'all' ? petFilters.length === 0 : petFilters.includes(key);

  const activeCount = [
    sortBy !== 'recommended',
    petFilters.length > 0,
    minNights > 0,
    amenityFilters.length > 0,
  ].filter(Boolean).length;

  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* Backdrop */}
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filters</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={GrottoTokens.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ── Sort by ── */}
            <Text style={styles.sectionTitle}>Sort by</Text>
            <View style={styles.sortList}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.sortRow, active && styles.sortRowActive]}
                    onPress={() => setSortBy(opt.key)}
                  >
                    <Text style={[styles.sortLabel, active && styles.sortLabelActive]}>
                      {opt.label}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark" size={18} color={GrottoTokens.gold} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* ── Pets ── */}
            <Text style={styles.sectionTitle}>Pets</Text>
            <View style={styles.petGrid}>
              {PET_OPTIONS.map((opt) => {
                const active = isPetActive(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.petOption, active && styles.petOptionActive]}
                    onPress={() => togglePet(opt.key)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={15}
                      color={active ? GrottoTokens.gold : GrottoTokens.textSecondary}
                    />
                    <Text style={[styles.petLabel, active && styles.petLabelActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* ── Sit duration ── */}
            <Text style={styles.sectionTitle}>Sit duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationRow}>
              {DURATION_OPTIONS.map((opt) => {
                const active = minNights === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.durationPill, active && styles.durationPillActive]}
                    onPress={() => setMinNights(opt.key)}
                  >
                    <Text style={[styles.durationText, active && styles.durationTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.divider} />

            {/* ── Amenities ── */}
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenityGrid}>
              {AMENITY_OPTIONS.map((opt) => {
                const active = amenityFilters.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.amenityChip, active && styles.amenityChipActive]}
                    onPress={() => toggleAmenity(opt.key)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? GrottoTokens.white : GrottoTokens.textSecondary}
                    />
                    <Text style={[styles.amenityLabel, active && styles.amenityLabelActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ height: Layout.spacing.md }} />
          </ScrollView>

          {/* ── Bottom bar ── */}
          <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
            <Pressable onPress={handleClearAll} hitSlop={10}>
              <Text style={styles.clearAllText}>
                Clear all{activeCount > 0 ? ` (${activeCount})` : ''}
              </Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyText}>
                Show {resultCount} sit{resultCount !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: GrottoTokens.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: GrottoTokens.borderSubtle,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  closeBtn: {
    position: 'absolute',
    right: Layout.spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
    marginBottom: Layout.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: GrottoTokens.borderSubtle,
    marginVertical: Layout.spacing.lg,
  },

  // ── Sort
  sortList: {
    gap: Layout.spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Layout.spacing.md,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  sortRowActive: {
    borderColor: GrottoTokens.gold,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  sortLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  sortLabelActive: {
    color: GrottoTokens.textPrimary,
    fontFamily: FontFamily.sansSemiBold,
  },

  // ── Pets
  petGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
  petOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Layout.radius.md,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
    // ~2 per row
    width: '47%',
  },
  petOptionActive: {
    borderColor: GrottoTokens.gold,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  petLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  petLabelActive: {
    color: GrottoTokens.gold,
    fontFamily: FontFamily.sansSemiBold,
  },

  // ── Duration
  durationRow: {
    gap: Layout.spacing.sm,
    paddingBottom: Layout.spacing.xs,
  },
  durationPill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  durationPillActive: {
    borderColor: GrottoTokens.gold,
    backgroundColor: GrottoTokens.gold,
  },
  durationText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  durationTextActive: {
    color: GrottoTokens.white,
    fontFamily: FontFamily.sansSemiBold,
  },

  // ── Amenities
  amenityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  amenityChipActive: {
    borderColor: GrottoTokens.gold,
    backgroundColor: GrottoTokens.gold,
  },
  amenityLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  amenityLabelActive: {
    color: GrottoTokens.white,
    fontFamily: FontFamily.sansSemiBold,
  },

  // ── Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  clearAllText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    textDecorationLine: 'underline',
  },
  applyBtn: {
    backgroundColor: GrottoTokens.textPrimary,
    borderRadius: Layout.radius.full,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  applyText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },
});
