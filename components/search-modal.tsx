import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['M','T','W','T','F','S','S'];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function calendarCells(year: number, month: number): (Date|null)[] {
  const first = new Date(year, month, 1);
  const count = new Date(year, month+1, 0).getDate();
  // Mon-start: Sun=0 → offset 6, Mon=1 → offset 0, etc.
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const cells: (Date|null)[] = Array(offset).fill(null);
  for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d));
  return cells;
}

function dayState(
  date: Date,
  todayStart: Date,
  start: Date | null,
  end: Date | null,
): 'past'|'start'|'end'|'range'|'today'|'normal' {
  if (date < todayStart) return 'past';
  if (start && sameDay(date, start)) return 'start';
  if (end   && sameDay(date, end))   return 'end';
  if (start && end && date > start && date < end) return 'range';
  if (sameDay(date, todayStart)) return 'today';
  return 'normal';
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LocationSuggestion {
  label: string;
  sublabel: string;
  type: 'city' | 'country';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initialLocation: string;
  initialDateFrom: string | null;
  initialDateTo: string | null;
  suggestions: LocationSuggestion[];
  onSearch: (location: string, dateFrom: string|null, dateTo: string|null) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchModal({
  visible,
  onClose,
  initialLocation,
  initialDateFrom,
  initialDateTo,
  suggestions,
  onSearch,
}: Props) {
  const todayStart = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const [location, setLocation] = useState(initialLocation);
  const [dateStart, setDateStart] = useState<Date|null>(
    initialDateFrom ? new Date(initialDateFrom + 'T00:00:00') : null,
  );
  const [dateEnd, setDateEnd] = useState<Date|null>(
    initialDateTo ? new Date(initialDateTo + 'T00:00:00') : null,
  );
  const [viewYear, setViewYear]   = useState(todayStart.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayStart.getMonth());

  // Sync with parent when modal (re)opens
  useEffect(() => {
    if (visible) {
      setLocation(initialLocation);
      setDateStart(initialDateFrom ? new Date(initialDateFrom + 'T00:00:00') : null);
      setDateEnd(initialDateTo   ? new Date(initialDateTo   + 'T00:00:00') : null);
      setViewYear(todayStart.getFullYear());
      setViewMonth(todayStart.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cells = calendarCells(viewYear, viewMonth);

  const [inputFocused, setInputFocused] = useState(false);

  const filteredSuggestions = useMemo(() => {
    const q = location.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    const results = suggestions.filter(s =>
      s.label.toLowerCase().includes(q) || s.sublabel.toLowerCase().includes(q)
    );
    // Sort: exact start-of-word matches first
    results.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts;
    });
    return results.slice(0, 8);
  }, [suggestions, location]);

  function handleDayPress(date: Date) {
    if (date < todayStart) return;
    if (!dateStart || (dateStart && dateEnd)) {
      setDateStart(date); setDateEnd(null);
    } else {
      if (sameDay(date, dateStart)) { setDateStart(null); }
      else if (date > dateStart)    { setDateEnd(date); }
      else                          { setDateStart(date); setDateEnd(null); }
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); }
    else setViewMonth(m => m-1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); }
    else setViewMonth(m => m+1);
  }

  const canGoPrev = viewYear > todayStart.getFullYear() ||
    (viewYear === todayStart.getFullYear() && viewMonth > todayStart.getMonth());

  function handleSearch() {
    onSearch(
      location.trim(),
      dateStart ? toISO(dateStart) : null,
      dateEnd   ? toISO(dateEnd)   : null,
    );
    onClose();
  }

  function handleClear() {
    setLocation('');
    setDateStart(null);
    setDateEnd(null);
  }

  function formatSelected(d: Date): string {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.root} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable style={styles.headerClose} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={GrottoTokens.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Find a sit</Text>
          <Pressable onPress={handleClear} hitSlop={10}>
            <Text style={styles.headerClear}>Clear</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Where section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Where?</Text>
            <View style={[styles.locationInputRow, inputFocused && styles.locationInputRowFocused]}>
              <Ionicons name="search" size={18} color={inputFocused ? GrottoTokens.gold : GrottoTokens.textMuted} />
              <TextInput
                style={styles.locationInput}
                placeholder="Search destinations..."
                placeholderTextColor={GrottoTokens.textMuted}
                value={location}
                onChangeText={setLocation}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              {location.length > 0 && (
                <Pressable onPress={() => setLocation('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={GrottoTokens.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Location suggestions dropdown */}
            {(inputFocused || location.length > 0) && filteredSuggestions.length > 0 && (
              <View style={styles.suggestionsDropdown}>
                {!location.trim() && (
                  <Text style={styles.suggestionsHeader}>Suggested destinations</Text>
                )}
                {filteredSuggestions.map((s, i) => {
                  const active = location === s.label;
                  const isLast = i === filteredSuggestions.length - 1;
                  return (
                    <Pressable
                      key={`${s.type}-${s.label}`}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        !isLast && styles.suggestionRowBorder,
                        active && styles.suggestionRowActive,
                        pressed && styles.suggestionRowPressed,
                      ]}
                      onPress={() => {
                        // Immediately search and close — no need to press the Search button
                        onSearch(
                          s.label,
                          dateStart ? toISO(dateStart) : null,
                          dateEnd   ? toISO(dateEnd)   : null,
                        );
                        onClose();
                      }}
                    >
                      <View style={[styles.suggestionIcon, active && styles.suggestionIconActive]}>
                        <Ionicons
                          name={s.type === 'country' ? 'globe-outline' : 'location-outline'}
                          size={16}
                          color={active ? GrottoTokens.white : GrottoTokens.textSecondary}
                        />
                      </View>
                      <View style={styles.suggestionTextWrap}>
                        <Text style={[styles.suggestionLabel, active && styles.suggestionLabelActive]}>
                          {s.label}
                        </Text>
                        {s.sublabel ? (
                          <Text style={[styles.suggestionSublabel, active && styles.suggestionSublabelActive]}>
                            {s.sublabel}
                          </Text>
                        ) : null}
                      </View>
                      {active && (
                        <Ionicons name="checkmark" size={16} color={GrottoTokens.gold} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* ── When section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When?</Text>

            {/* Selected range display */}
            <View style={styles.dateRangeRow}>
              <View style={[styles.dateRangeBox, dateStart && styles.dateRangeBoxActive]}>
                <Text style={styles.dateRangeLabel}>From</Text>
                <Text style={[styles.dateRangeValue, !dateStart && styles.dateRangeValueEmpty]}>
                  {dateStart ? formatSelected(dateStart) : 'Add date'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color={GrottoTokens.textMuted} style={{ marginHorizontal: 4 }} />
              <View style={[styles.dateRangeBox, dateEnd && styles.dateRangeBoxActive]}>
                <Text style={styles.dateRangeLabel}>To</Text>
                <Text style={[styles.dateRangeValue, !dateEnd && styles.dateRangeValueEmpty]}>
                  {dateEnd ? formatSelected(dateEnd) : 'Add date'}
                </Text>
              </View>
            </View>

            {/* Month navigation */}
            <View style={styles.monthNav}>
              <Pressable
                style={[styles.monthNavBtn, !canGoPrev && styles.monthNavBtnDisabled]}
                onPress={canGoPrev ? prevMonth : undefined}
                hitSlop={10}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={canGoPrev ? GrottoTokens.textPrimary : GrottoTokens.borderSubtle}
                />
              </Pressable>
              <Text style={styles.monthName}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <Pressable style={styles.monthNavBtn} onPress={nextMonth} hitSlop={10}>
                <Ionicons name="chevron-forward" size={18} color={GrottoTokens.textPrimary} />
              </Pressable>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaderRow}>
              {DAY_LABELS.map((d, i) => (
                <Text key={i} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {cells.map((date, i) => {
                if (!date) {
                  return <View key={i} style={styles.dayCell} />;
                }
                const state = dayState(date, todayStart, dateStart, dateEnd);
                const isPast = state === 'past';
                const isSelected = state === 'start' || state === 'end';
                const isRange = state === 'range';
                const isToday = state === 'today';

                // Range strip: fill full cell width for middle days
                // For start/end: still show strip on the inner side
                const showRangeLeft  = state === 'end' && dateStart !== null;
                const showRangeRight = state === 'start' && dateEnd !== null;

                return (
                  <Pressable
                    key={i}
                    style={[styles.dayCell]}
                    onPress={() => handleDayPress(date)}
                    disabled={isPast}
                  >
                    {/* Range background strip */}
                    {(isRange || showRangeLeft || showRangeRight) && (
                      <View
                        style={[
                          styles.rangeStrip,
                          isRange      && styles.rangeStripFull,
                          showRangeLeft  && styles.rangeStripLeft,
                          showRangeRight && styles.rangeStripRight,
                        ]}
                      />
                    )}
                    {/* Day circle */}
                    <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                      <Text style={[
                        styles.dayText,
                        isPast     && styles.dayTextPast,
                        isSelected && styles.dayTextSelected,
                        isToday    && !isSelected && styles.dayTextToday,
                        isRange    && styles.dayTextRange,
                      ]}>
                        {date.getDate()}
                      </Text>
                    </View>
                    {/* Today dot */}
                    {isToday && !isSelected && <View style={styles.todayDot} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Spacer for bottom bar */}
          <View style={{ height: 90 }} />
        </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Bottom actions ── */}
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <Pressable onPress={handleClear} hitSlop={10}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <Pressable style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={16} color={GrottoTokens.white} />
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const DAY_CELL_SIZE = Math.floor((SCREEN_WIDTH - Layout.spacing.md * 2) / 7);
const CIRCLE_SIZE = Math.min(DAY_CELL_SIZE - 4, 38);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GrottoTokens.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  headerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  headerClear: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    textDecorationLine: 'underline',
  },

  scrollContent: {
    paddingBottom: 0,
  },
  section: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 20,
    color: GrottoTokens.textPrimary,
    marginBottom: Layout.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: GrottoTokens.borderSubtle,
    marginHorizontal: Layout.spacing.md,
  },

  // ── Location input
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GrottoTokens.surface,
    borderRadius: Layout.radius.xl,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 14,
    gap: Layout.spacing.sm,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
  },
  locationInputRowFocused: {
    borderColor: GrottoTokens.gold,
    backgroundColor: GrottoTokens.white,
  },
  locationInput: {
    flex: 1,
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    padding: 0,
    margin: 0,
  },

  // ── Suggestions dropdown
  suggestionsDropdown: {
    marginTop: Layout.spacing.sm,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  suggestionsHeader: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 11,
    color: GrottoTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: 12,
    paddingBottom: 6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 13,
    gap: Layout.spacing.md,
  },
  suggestionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  suggestionRowActive: {
    backgroundColor: GrottoTokens.offWhite,
  },
  suggestionRowPressed: {
    backgroundColor: GrottoTokens.surface,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  suggestionIconActive: {
    backgroundColor: GrottoTokens.gold,
    borderColor: GrottoTokens.gold,
  },
  suggestionTextWrap: {
    flex: 1,
    gap: 1,
  },
  suggestionLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  suggestionLabelActive: {
    fontFamily: FontFamily.sansSemiBold,
  },
  suggestionSublabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  suggestionSublabelActive: {
    color: GrottoTokens.textSecondary,
  },

  // ── Date range display
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  dateRangeBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 10,
  },
  dateRangeBoxActive: {
    borderColor: GrottoTokens.gold,
  },
  dateRangeLabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: GrottoTokens.textMuted,
    marginBottom: 2,
  },
  dateRangeValue: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  dateRangeValueEmpty: {
    color: GrottoTokens.textMuted,
    fontFamily: FontFamily.sansRegular,
  },

  // ── Month navigation
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.md,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: {
    opacity: 0.4,
  },
  monthName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },

  // ── Day headers
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeader: {
    width: DAY_CELL_SIZE,
    textAlign: 'center',
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    paddingVertical: 4,
  },

  // ── Calendar grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rangeStrip: {
    position: 'absolute',
    top: '50%',
    height: CIRCLE_SIZE,
    marginTop: -(CIRCLE_SIZE / 2),
    backgroundColor: GrottoTokens.goldSubtle,
  },
  rangeStripFull: {
    left: 0,
    right: 0,
  },
  rangeStripLeft: {
    left: 0,
    right: '50%',
  },
  rangeStripRight: {
    left: '50%',
    right: 0,
  },
  dayCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: GrottoTokens.gold,
  },
  dayText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  dayTextPast: {
    color: GrottoTokens.borderSubtle,
  },
  dayTextSelected: {
    color: GrottoTokens.white,
    fontFamily: FontFamily.sansSemiBold,
  },
  dayTextToday: {
    color: GrottoTokens.gold,
    fontFamily: FontFamily.sansSemiBold,
  },
  dayTextRange: {
    color: GrottoTokens.gold,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: GrottoTokens.gold,
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
  resetText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    textDecorationLine: 'underline',
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  searchBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },
});
