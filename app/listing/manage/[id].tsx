import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { applications, listings, sits, users } from '@/db/schema';
import type { Application, Listing, Sit, User } from '@/db/schema';
import { useSessionStore } from '@/store/session-store';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  open:      { label: 'Open',      bg: GrottoTokens.goldSubtle,  color: GrottoTokens.gold },
  confirmed: { label: 'Confirmed', bg: '#E8F5EE',                color: GrottoTokens.success },
  live:      { label: 'Live now',  bg: '#E8F5EE',                color: GrottoTokens.success },
  completed: { label: 'Completed', bg: GrottoTokens.surface,     color: GrottoTokens.textMuted },
  cancelled: { label: 'Cancelled', bg: '#FBE8E8',                color: GrottoTokens.error },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nightsBetween(start: string, end: string) {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function toDisplayDate(ymd: string) {
  if (!ymd || ymd.length < 10) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}-${m}-${y}`;
}

// ─── Calendar picker ──────────────────────────────────────────────────────────

function CalendarPicker({
  visible, onClose, onSelect, selectedDate, minDate,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (ymd: string) => void;
  selectedDate: string;
  minDate?: string;
}) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (!visible) return;
    if (selectedDate?.length === 10) {
      setViewYear(parseInt(selectedDate.slice(0, 4), 10));
      setViewMonth(parseInt(selectedDate.slice(5, 7), 10) - 1);
    } else {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const selDay   = selectedDate?.slice(0, 7) === monthStr ? parseInt(selectedDate.slice(8, 10), 10) : null;
  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={calSt.overlay} onPress={onClose}>
        <Pressable style={calSt.sheet} onPress={() => {}}>
          <View style={calSt.header}>
            <Pressable style={calSt.navBtn} onPress={prevMonth} hitSlop={10}>
              <Ionicons name="chevron-back" size={18} color={GrottoTokens.textPrimary} />
            </Pressable>
            <Text style={calSt.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <Pressable style={calSt.navBtn} onPress={nextMonth} hitSlop={10}>
              <Ionicons name="chevron-forward" size={18} color={GrottoTokens.textPrimary} />
            </Pressable>
          </View>

          <View style={calSt.dayHeaders}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
              <Text key={d} style={calSt.dayHeader}>{d}</Text>
            ))}
          </View>

          <View style={calSt.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={calSt.cell} />;
              const isSel = day === selDay;
              const isToday = day === todayDay;
              const mm = String(viewMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const disabled = !!minDate && `${viewYear}-${mm}-${dd}` < minDate;
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    calSt.cell,
                    isSel && calSt.cellSel,
                    isToday && !isSel && calSt.cellToday,
                    pressed && !disabled && calSt.cellPressed,
                  ]}
                  onPress={() => {
                    if (!disabled) {
                      onSelect(`${viewYear}-${mm}-${dd}`);
                      onClose();
                    }
                  }}
                  disabled={disabled}
                >
                  <Text style={[
                    calSt.cellText,
                    isSel && calSt.cellTextSel,
                    isToday && !isSel && calSt.cellTextToday,
                    disabled && calSt.cellTextDisabled,
                  ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={calSt.doneBtn} onPress={onClose}>
            <Text style={calSt.doneBtnText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ManageListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useSessionStore();

  const [listing, setListing]   = useState<Listing | null>(null);
  const [sitList, setSitList]   = useState<Sit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  type AppWithSitter = { app: Application; sitter: User | null; sit: Sit | null };
  const [appRows, setAppRows]   = useState<AppWithSitter[]>([]);

  // Add-dates form state
  const [addStart, setAddStart] = useState('');
  const [addEnd, setAddEnd]     = useState('');
  const [addingDates, setAddingDates] = useState(false);
  const [calTarget, setCalTarget] = useState<'start' | 'end' | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const listingId = Number(id);

      Promise.all([
        db.select().from(listings).where(eq(listings.id, listingId)),
        db.select().from(sits).where(eq(sits.listingId, listingId)),
        db.select().from(applications).where(eq(applications.listingId, listingId)),
      ]).then(async ([listingRows, sitRows, appList]) => {
        setListing(listingRows[0] ?? null);
        setSitList(sitRows.sort((a, b) => a.startDate.localeCompare(b.startDate)));

        if (appList.length > 0) {
          const sitterIds = [...new Set(appList.map(a => a.sitterId))];
          const sitIds    = [...new Set(appList.map(a => a.sitId))];
          const [sitterRows, sitDetailRows] = await Promise.all([
            db.select().from(users).where(inArray(users.id, sitterIds)),
            db.select().from(sits).where(inArray(sits.id, sitIds)),
          ]);
          const sitterMap = Object.fromEntries(sitterRows.map(u => [u.id, u]));
          const sitMap    = Object.fromEntries(sitDetailRows.map(s => [s.id, s]));
          setAppRows(
            appList
              .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
              .map(app => ({
                app,
                sitter: sitterMap[app.sitterId] ?? null,
                sit:    sitMap[app.sitId] ?? null,
              }))
          );
        } else {
          setAppRows([]);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }, [id])
  );

  // ── Delete ────────────────────────────────────────────────────────────────

  function confirmDelete(sit: Sit) {
    Alert.alert(
      'Remove these dates?',
      `${toDisplayDate(sit.startDate)} – ${toDisplayDate(sit.endDate)}\n\nSitters will no longer be able to apply for this period.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => doDelete(sit.id),
        },
      ],
    );
  }

  async function doDelete(sitId: number) {
    setDeleting(sitId);
    try {
      await db.delete(sits).where(eq(sits.id, sitId));
      setSitList(prev => prev.filter(s => s.id !== sitId));
    } catch {
      Alert.alert('Error', 'Could not remove these dates. Please try again.');
    } finally {
      setDeleting(null);
    }
  }

  // ── Add dates ─────────────────────────────────────────────────────────────

  async function handleAddDates() {
    if (!listing || !currentUser || !addStart || !addEnd) return;
    if (addEnd <= addStart) {
      Alert.alert('Invalid dates', 'The end date must be after the start date.');
      return;
    }
    setAddingDates(true);
    try {
      const inserted = await db.insert(sits).values({
        listingId: listing.id,
        ownerId: currentUser.id,
        status: 'open',
        startDate: addStart,
        endDate: addEnd,
      }).returning();
      if (inserted[0]) {
        setSitList(prev =>
          [...prev, inserted[0]].sort((a, b) => a.startDate.localeCompare(b.startDate))
        );
      }
      setAddStart('');
      setAddEnd('');
    } catch {
      Alert.alert('Error', 'Could not save these dates. Please try again.');
    } finally {
      setAddingDates(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <View style={st.loader}>
          <ActivityIndicator color={GrottoTokens.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <View style={st.loader}>
          <Text style={st.notFound}>Listing not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const upcoming = sitList.filter(
    s => s.startDate >= today && s.status !== 'completed' && s.status !== 'cancelled'
  );
  const past = sitList.filter(
    s => s.startDate < today || s.status === 'completed' || s.status === 'cancelled'
  );

  const canAdd = addStart.length === 10 && addEnd.length === 10 && addEnd > addStart;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={GrottoTokens.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle} numberOfLines={1}>Manage listing</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Listing hero ── */}
        <View style={st.listingHero}>
          {listing.coverPhotoUrl ? (
            <Image source={{ uri: listing.coverPhotoUrl }} style={st.heroImg} contentFit="cover" />
          ) : (
            <View style={[st.heroImg, st.heroImgFallback]}>
              <Ionicons name="home-outline" size={32} color={GrottoTokens.goldMuted} />
            </View>
          )}
          <View style={st.heroBody}>
            <Text style={st.heroTitle} numberOfLines={2}>{listing.title}</Text>
            <Text style={st.heroLocation}>
              {[listing.city, listing.country].filter(Boolean).join(', ')}
            </Text>
            <View style={st.heroStats}>
              {listing.bedrooms != null && (
                <View style={st.heroStat}>
                  <Ionicons name="bed-outline" size={13} color={GrottoTokens.textMuted} />
                  <Text style={st.heroStatText}>{listing.bedrooms} bed</Text>
                </View>
              )}
              <View style={[st.statusDot, { backgroundColor: listing.isActive ? GrottoTokens.success : GrottoTokens.textMuted }]} />
              <Text style={st.heroStatText}>{listing.isActive ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
        </View>

        {/* ── Applications ── */}
        {appRows.length > 0 && (
          <>
            <Text style={st.sectionTitle}>
              Applications
              {appRows.filter(r => r.app.status === 'pending').length > 0 && (
                <Text style={st.pendingBadge}>
                  {' '}· {appRows.filter(r => r.app.status === 'pending').length} pending
                </Text>
              )}
            </Text>
            <View style={st.appList}>
              {appRows.map(({ app, sitter, sit: appSit }) => (
                <Pressable
                  key={app.id}
                  style={({ pressed }) => [st.appRow, pressed && { opacity: 0.75 }]}
                  onPress={() => router.push(`/chat/${app.id}`)}
                >
                  {sitter?.avatarUrl ? (
                    <Image source={{ uri: sitter.avatarUrl }} style={st.appAvatar} contentFit="cover" />
                  ) : (
                    <View style={[st.appAvatar, st.appAvatarFallback]}>
                      <Ionicons name="person" size={16} color={GrottoTokens.goldMuted} />
                    </View>
                  )}
                  <View style={st.appBody}>
                    <Text style={st.appName}>{sitter?.name ?? 'Unknown sitter'}</Text>
                    {appSit && (
                      <Text style={st.appDates}>
                        {toDisplayDate(appSit.startDate)} – {toDisplayDate(appSit.endDate)}
                      </Text>
                    )}
                  </View>
                  <View style={[
                    st.appStatusPill,
                    {
                      backgroundColor:
                        app.status === 'pending' ? GrottoTokens.goldSubtle :
                        app.status === 'accepted' ? '#E8F5EE' :
                        GrottoTokens.surface,
                    },
                  ]}>
                    <Text style={[
                      st.appStatusText,
                      {
                        color:
                          app.status === 'pending' ? GrottoTokens.gold :
                          app.status === 'accepted' ? '#4CAF7D' :
                          GrottoTokens.textMuted,
                      },
                    ]}>
                      {app.status === 'pending' ? 'Pending' :
                       app.status === 'accepted' ? 'Accepted' :
                       app.status === 'declined' ? 'Declined' : 'Withdrawn'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={GrottoTokens.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ── Upcoming sits ── */}
        <Text style={st.sectionTitle}>Upcoming dates</Text>
        {upcoming.length === 0 ? (
          <View style={st.emptySection}>
            <Ionicons name="calendar-outline" size={32} color={GrottoTokens.goldMuted} />
            <Text style={st.emptyText}>No upcoming sits</Text>
            <Text style={st.emptySub}>Add date ranges below to let sitters apply.</Text>
          </View>
        ) : (
          <View style={st.sitList}>
            {upcoming.map(sit => (
              <SitRow
                key={sit.id}
                sit={sit}
                deleting={deleting === sit.id}
                onDelete={() => confirmDelete(sit)}
              />
            ))}
          </View>
        )}

        {/* ── Add date range ── */}
        <Text style={[st.sectionTitle, { marginTop: Layout.spacing.lg }]}>Add date range</Text>
        <View style={st.addCard}>
          <View style={st.addRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.dateFieldLabel}>From</Text>
              <Pressable
                style={st.dateBtn}
                onPress={() => setCalTarget('start')}
              >
                <Ionicons name="calendar-outline" size={16} color={GrottoTokens.gold} />
                <Text style={[st.dateBtnText, !addStart && st.dateBtnPlaceholder]}>
                  {addStart ? toDisplayDate(addStart) : 'DD-MM-YYYY'}
                </Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.dateFieldLabel}>To</Text>
              <Pressable
                style={st.dateBtn}
                onPress={() => setCalTarget('end')}
              >
                <Ionicons name="calendar-outline" size={16} color={GrottoTokens.gold} />
                <Text style={[st.dateBtnText, !addEnd && st.dateBtnPlaceholder]}>
                  {addEnd ? toDisplayDate(addEnd) : 'DD-MM-YYYY'}
                </Text>
              </Pressable>
            </View>
          </View>

          {addStart && addEnd && addEnd > addStart && (
            <View style={st.addPreview}>
              <Ionicons name="moon-outline" size={14} color={GrottoTokens.gold} />
              <Text style={st.addPreviewText}>
                {nightsBetween(addStart, addEnd)} night{nightsBetween(addStart, addEnd) !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          <Pressable
            style={[st.addBtn, (!canAdd || addingDates) && st.addBtnDisabled]}
            onPress={handleAddDates}
            disabled={!canAdd || addingDates}
          >
            {addingDates ? (
              <ActivityIndicator size="small" color={GrottoTokens.white} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={18} color={GrottoTokens.white} />
                <Text style={st.addBtnText}>Add dates</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ── Past sits ── */}
        {past.length > 0 && (
          <>
            <Text style={[st.sectionTitle, { marginTop: Layout.spacing.lg }]}>Past dates</Text>
            <View style={st.sitList}>
              {past.map(sit => (
                <SitRow
                  key={sit.id}
                  sit={sit}
                  deleting={deleting === sit.id}
                  onDelete={() => confirmDelete(sit)}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: Layout.spacing.xxl }} />
      </ScrollView>

      {/* ── Calendar pickers ── */}
      <CalendarPicker
        visible={calTarget === 'start'}
        onClose={() => setCalTarget(null)}
        selectedDate={addStart}
        onSelect={ymd => { setAddStart(ymd); setCalTarget(null); }}
        minDate={today}
      />
      <CalendarPicker
        visible={calTarget === 'end'}
        onClose={() => setCalTarget(null)}
        selectedDate={addEnd}
        onSelect={ymd => { setAddEnd(ymd); setCalTarget(null); }}
        minDate={addStart || today}
      />
    </SafeAreaView>
  );
}

// ─── Sit row ──────────────────────────────────────────────────────────────────

function SitRow({
  sit, deleting, onDelete,
}: { sit: Sit; deleting: boolean; onDelete: () => void }) {
  const cfg    = STATUS_CONFIG[sit.status] ?? STATUS_CONFIG.open;
  const nights = nightsBetween(sit.startDate, sit.endDate);
  const canDelete = sit.status === 'open';

  return (
    <View style={st.sitRow}>
      <View style={st.sitIcon}>
        <Ionicons name="calendar-outline" size={20} color={GrottoTokens.gold} />
      </View>
      <View style={st.sitBody}>
        <Text style={st.sitDates}>
          {toDisplayDate(sit.startDate)} – {toDisplayDate(sit.endDate)}
        </Text>
        <Text style={st.sitNights}>{nights} night{nights !== 1 ? 's' : ''}</Text>
      </View>
      <View style={[st.statusBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[st.statusText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
      {canDelete && (
        <Pressable
          style={st.deleteBtn}
          onPress={onDelete}
          disabled={deleting}
          hitSlop={8}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={GrottoTokens.error} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={GrottoTokens.error} />
          )}
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  // ── Applications section
  pendingBadge: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.gold,
  },
  appList: {
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.md,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    gap: Layout.spacing.sm,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  appAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  appAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBody: {
    flex: 1,
    gap: 2,
  },
  appName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  appDates: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
  },
  appStatusPill: {
    borderRadius: Layout.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  appStatusText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
  },

  safe: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    backgroundColor: GrottoTokens.white,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 18,
    color: GrottoTokens.textPrimary,
    flex: 1,
    textAlign: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: Layout.spacing.md,
  },

  // Listing hero
  listingHero: {
    flexDirection: 'row',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    overflow: 'hidden',
    marginBottom: Layout.spacing.lg,
  },
  heroImg: {
    width: 90,
    height: 90,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  heroImgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    padding: Layout.spacing.md,
    gap: 4,
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    lineHeight: 21,
  },
  heroLocation: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    marginTop: 2,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heroStatText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // Section headers
  sectionTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Layout.spacing.sm,
  },

  // Empty state
  emptySection: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.xl,
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  emptyText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textSecondary,
  },
  emptySub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.lg,
  },

  // Sit list + rows
  sitList: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    overflow: 'hidden',
  },
  sitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
    gap: Layout.spacing.md,
  },
  sitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sitBody: {
    flex: 1,
    gap: 2,
  },
  sitDates: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  sitNights: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  statusBadge: {
    borderRadius: Layout.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Add card
  addCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.md,
    gap: Layout.spacing.md,
  },
  addRow: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  dateFieldLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: GrottoTokens.textPrimary,
    marginBottom: Layout.spacing.xs,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    backgroundColor: GrottoTokens.offWhite,
  },
  dateBtnText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    flex: 1,
  },
  dateBtnPlaceholder: {
    color: GrottoTokens.textMuted,
  },
  addPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    paddingHorizontal: Layout.spacing.xs,
    marginTop: -Layout.spacing.xs,
  },
  addPreviewText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.gold,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 14,
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addBtnDisabled: {
    backgroundColor: GrottoTokens.goldMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  addBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },
});

// Calendar styles
const calSt = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.spacing.md,
  },
  sheet: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    width: Math.min(SCREEN_WIDTH - 32, 360),
    gap: Layout.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: FontFamily.serifBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginTop: Layout.spacing.xs,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.radius.full,
  },
  cellSel: {
    backgroundColor: GrottoTokens.gold,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: GrottoTokens.gold,
  },
  cellPressed: {
    backgroundColor: GrottoTokens.goldSubtle,
  },
  cellText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  cellTextSel: {
    color: GrottoTokens.white,
    fontFamily: FontFamily.sansSemiBold,
  },
  cellTextToday: {
    color: GrottoTokens.gold,
    fontFamily: FontFamily.sansSemiBold,
  },
  cellTextDisabled: {
    color: GrottoTokens.borderSubtle,
  },
  doneBtn: {
    marginTop: Layout.spacing.sm,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },
});
