import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { desc, eq, inArray } from 'drizzle-orm';
import { useRouter, useFocusEffect } from 'expo-router';

import { db } from '@/db/client';
import { applications, chatMessages, listings, sits, users } from '@/db/schema';
import type { Application, ChatMessage, Listing, Sit, User } from '@/db/schema';
import { useSessionStore } from '@/store/session-store';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppRow = {
  application: Application;
  listing: Listing;
  sit: Sit;
  otherUser: User | null;
  lastMessage: ChatMessage | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function relativeTime(isoStr: string | null): string {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return formatDate(isoStr.slice(0, 10));
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Pending',   bg: GrottoTokens.goldSubtle, color: GrottoTokens.gold },
  accepted:  { label: 'Accepted',  bg: '#E8F5EE',               color: '#4CAF7D' },
  declined:  { label: 'Declined',  bg: GrottoTokens.surface,    color: GrottoTokens.textMuted },
  withdrawn: { label: 'Withdrawn', bg: GrottoTokens.surface,    color: GrottoTokens.textMuted },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const router = useRouter();
  const { currentUser } = useSessionStore();
  const isOwner = currentUser?.role === 'owner';

  const [rows, setRows]                 = useState<AppRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) { setLoading(false); return; }
      setLoading(true);
      loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id, isOwner])
  );

  async function attachLastMessages(base: AppRow[]): Promise<AppRow[]> {
    if (base.length === 0) return base;
    const appIds = base.map(r => r.application.id);
    const msgs = await db.select().from(chatMessages)
      .where(inArray(chatMessages.applicationId, appIds))
      .orderBy(desc(chatMessages.id));

    const lastMsgMap: Record<number, ChatMessage> = {};
    for (const msg of msgs) {
      if (!lastMsgMap[msg.applicationId]) lastMsgMap[msg.applicationId] = msg;
    }

    return base
      .map(r => ({ ...r, lastMessage: lastMsgMap[r.application.id] ?? null }))
      .sort((a, b) => {
        const aTime = a.lastMessage?.createdAt ?? a.application.createdAt ?? '';
        const bTime = b.lastMessage?.createdAt ?? b.application.createdAt ?? '';
        return bTime.localeCompare(aTime);
      });
  }

  async function loadApplications() {
    if (!currentUser) return;
    try {
      if (isOwner) {
        const ownerListings = await db.select().from(listings)
          .where(eq(listings.ownerId, currentUser.id));
        if (ownerListings.length === 0) { setRows([]); setLoading(false); return; }

        const listingIds = ownerListings.map(l => l.id);
        const apps = await db.select().from(applications)
          .where(inArray(applications.listingId, listingIds));
        if (apps.length === 0) { setRows([]); setLoading(false); return; }

        const sitIds    = [...new Set(apps.map(a => a.sitId))];
        const sitterIds = [...new Set(apps.map(a => a.sitterId))];
        const [sitRows, sitterRows] = await Promise.all([
          db.select().from(sits).where(inArray(sits.id, sitIds)),
          db.select().from(users).where(inArray(users.id, sitterIds)),
        ]);

        const sitMap     = Object.fromEntries(sitRows.map(s => [s.id, s]));
        const sitterMap  = Object.fromEntries(sitterRows.map(u => [u.id, u]));
        const listingMap = Object.fromEntries(ownerListings.map(l => [l.id, l]));

        const base: AppRow[] = apps
          .filter(a => sitMap[a.sitId] && listingMap[a.listingId])
          .map(a => ({
            application: a,
            listing:     listingMap[a.listingId],
            sit:         sitMap[a.sitId],
            otherUser:   sitterMap[a.sitterId] ?? null,
            lastMessage: null,
          }));

        setRows(await attachLastMessages(base));
      } else {
        const apps = await db.select().from(applications)
          .where(eq(applications.sitterId, currentUser.id));
        if (apps.length === 0) { setRows([]); setLoading(false); return; }

        const listingIds = [...new Set(apps.map(a => a.listingId))];
        const sitIds     = [...new Set(apps.map(a => a.sitId))];
        const ownerIds   = new Set<number>();

        const [appListings, appSits] = await Promise.all([
          db.select().from(listings).where(inArray(listings.id, listingIds)),
          db.select().from(sits).where(inArray(sits.id, sitIds)),
        ]);
        appListings.forEach(l => ownerIds.add(l.ownerId));

        const ownerRows  = await db.select().from(users).where(inArray(users.id, [...ownerIds]));
        const listingMap = Object.fromEntries(appListings.map(l => [l.id, l]));
        const sitMap     = Object.fromEntries(appSits.map(s => [s.id, s]));
        const ownerMap   = Object.fromEntries(ownerRows.map(u => [u.id, u]));

        const base: AppRow[] = apps
          .filter(a => listingMap[a.listingId] && sitMap[a.sitId])
          .map(a => ({
            application: a,
            listing:     listingMap[a.listingId],
            sit:         sitMap[a.sitId],
            otherUser:   ownerMap[listingMap[a.listingId]?.ownerId] ?? null,
            lastMessage: null,
          }));

        setRows(await attachLastMessages(base));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(appId: number, role: 'owner' | 'sitter', currentlyArchived: boolean) {
    const patch = role === 'owner'
      ? { archivedByOwner:  currentlyArchived ? 0 : 1 }
      : { archivedBySitter: currentlyArchived ? 0 : 1 };
    await db.update(applications).set(patch).where(eq(applications.id, appId));
    setRows(prev => prev.map(r =>
      r.application.id === appId
        ? { ...r, application: { ...r.application, ...patch } }
        : r
    ));
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!currentUser && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.heading}>Messages</Text>
        <View style={styles.emptyWrap}>
          <Ionicons name="person-outline" size={48} color={GrottoTokens.goldMuted} />
          <Text style={styles.emptyTitle}>Sign in to view messages</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.heading}>Messages</Text>
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={GrottoTokens.gold} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived lists ─────────────────────────────────────────────────────────

  const archiveField = isOwner ? 'archivedByOwner' : 'archivedBySitter';
  const active   = rows.filter(r => !r.application[archiveField]);
  const archived = rows.filter(r =>  r.application[archiveField]);

  // Owner sections (within active only)
  const pending  = active.filter(r => r.application.status === 'pending');
  const reviewed = active.filter(r => r.application.status !== 'pending');

  const isEmpty = rows.length === 0;

  const cardProps = (row: AppRow) => ({
    row,
    isOwner,
    currentUserId: currentUser?.id,
    onPress: () => router.push(`/chat/${row.application.id}`),
    onArchive: () => handleArchive(
      row.application.id,
      isOwner ? 'owner' : 'sitter',
      !!row.application[archiveField]
    ),
    isArchived: !!row.application[archiveField],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>Messages</Text>

      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubble-outline" size={48} color={GrottoTokens.goldMuted} />
          <Text style={styles.emptyTitle}>
            {isOwner ? 'No applications yet' : 'No messages yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {isOwner
              ? 'When sitters apply for your listings, their applications will appear here.'
              : 'Apply for a sit on the Discover tab — your conversations will live here.'}
          </Text>
          {!isOwner && (
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/')}>
              <Text style={styles.emptyBtnText}>Find a sit</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {isOwner ? (
            // ── Owner: pending + reviewed sections, then archived
            <>
              {pending.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Needs your attention</Text>
                  {pending.map(row => <AppCard key={row.application.id} {...cardProps(row)} />)}
                </>
              )}
              {reviewed.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, pending.length > 0 && { marginTop: Layout.spacing.lg }]}>
                    Reviewed
                  </Text>
                  {reviewed.map(row => <AppCard key={row.application.id} {...cardProps(row)} />)}
                </>
              )}
            </>
          ) : (
            // ── Sitter: flat list
            <>
              {active.length === 0 && archived.length > 0 && (
                <View style={styles.allArchivedWrap}>
                  <Text style={styles.allArchivedText}>All conversations archived</Text>
                </View>
              )}
              {active.map(row => <AppCard key={row.application.id} {...cardProps(row)} />)}
            </>
          )}

          {/* Archived section — both roles */}
          {archived.length > 0 && (
            <>
              <Pressable style={styles.archivedToggle} onPress={() => setShowArchived(v => !v)}>
                <Ionicons
                  name={showArchived ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={GrottoTokens.textMuted}
                />
                <Text style={styles.archivedToggleText}>Archived ({archived.length})</Text>
              </Pressable>
              {showArchived && archived.map(row => (
                <AppCard key={row.application.id} {...cardProps(row)} dimmed />
              ))}
            </>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Application card ─────────────────────────────────────────────────────────

function AppCard({
  row, isOwner, currentUserId, onPress, onArchive, isArchived, dimmed,
}: {
  row: AppRow;
  isOwner: boolean;
  currentUserId: number | undefined;
  onPress: () => void;
  onArchive: () => void;
  isArchived: boolean;
  dimmed?: boolean;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const { application, listing, sit, otherUser, lastMessage } = row;
  const statusCfg = STATUS_CONFIG[application.status] ?? STATUS_CONFIG.pending;
  const isPending = application.status === 'pending';

  const previewText = lastMessage
    ? (lastMessage.senderId === currentUserId ? `You: ${lastMessage.body || '📎 Attachment'}` : (lastMessage.body || '📎 Attachment'))
    : (isOwner ? 'Applied for a sit' : 'Sent an application');

  const timeStr = relativeTime(lastMessage?.createdAt ?? application.createdAt);
  const hasUnread = isPending && lastMessage != null && lastMessage.senderId !== currentUserId;

  function renderRightActions() {
    return (
      <Pressable
        style={styles.archiveAction}
        onPress={() => {
          swipeRef.current?.close();
          onArchive();
        }}
      >
        <Ionicons
          name={isArchived ? 'arrow-undo-outline' : 'archive-outline'}
          size={20}
          color="#fff"
        />
        <Text style={styles.archiveActionText}>
          {isArchived ? 'Unarchive' : 'Archive'}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.cardWrapper, dimmed && styles.cardDimmed]}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={onPress}
        >
          {/* Cover image / avatar area */}
          <View style={styles.cardImageWrap}>
            {isOwner ? (
              otherUser?.avatarUrl ? (
                <Image source={{ uri: otherUser.avatarUrl }} style={styles.cardImage} contentFit="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImageFallback]}>
                  <Ionicons name="person" size={40} color={GrottoTokens.goldMuted} />
                </View>
              )
            ) : (
              listing.coverPhotoUrl ? (
                <Image source={{ uri: listing.coverPhotoUrl }} style={styles.cardImage} contentFit="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImageFallback]}>
                  <Ionicons name="home-outline" size={40} color={GrottoTokens.goldMuted} />
                </View>
              )
            )}

            {/* Status pill over image */}
            <View style={[styles.cardStatusPill, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.cardStatusText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>

            {/* Unread dot */}
            {hasUnread && <View style={styles.unreadDot} />}
          </View>

          {/* Info below image */}
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardNameGroup}>
                <Text style={[styles.cardName, hasUnread && styles.cardNameBold]} numberOfLines={1}>
                  {isOwner ? (otherUser?.name ?? 'Unknown sitter') : (otherUser?.name ?? listing.title)}
                </Text>
                {!isOwner && (
                  <Text style={styles.cardSubName} numberOfLines={1}>{listing.title}</Text>
                )}
                {isOwner && (
                  <Text style={styles.cardSubName} numberOfLines={1}>{listing.title}</Text>
                )}
              </View>
              <Text style={styles.cardTime}>{timeStr}</Text>
            </View>

            <Text style={[styles.cardSub, hasUnread && styles.cardSubUnread]} numberOfLines={2}>
              {previewText}
            </Text>

            <View style={styles.cardDatesRow}>
              <Ionicons name="calendar-outline" size={13} color={GrottoTokens.gold} />
              <Text style={styles.cardDates}>
                {formatDate(sit.startDate)} – {formatDate(sit.endDate)}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  heading: {
    fontFamily: FontFamily.serifBold,
    fontSize: 28,
    color: GrottoTokens.textPrimary,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.xl,
    paddingTop: Layout.spacing.xs,
  },

  // ── Section label
  sectionLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Layout.spacing.sm,
    marginTop: Layout.spacing.sm,
  },

  // ── Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
    gap: Layout.spacing.md,
    marginBottom: Layout.tabBarHeight,
  },
  emptyTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 18,
    color: GrottoTokens.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: Layout.spacing.sm,
  },
  emptyBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.white,
  },

  // ── Card wrapper
  cardWrapper: {
    marginBottom: Layout.spacing.md,
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardDimmed: { opacity: 0.45 },

  // ── Card (full-width, image on top)
  card: {
    backgroundColor: GrottoTokens.white,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  // ── Archive swipe action
  archiveAction: {
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    width: 82,
    gap: 4,
  },
  archiveActionText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#fff',
  },

  // ── Cover image area
  cardImageWrap: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: GrottoTokens.goldSubtle,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStatusPill: {
    position: 'absolute',
    bottom: Layout.spacing.sm,
    left: Layout.spacing.sm,
    borderRadius: Layout.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardStatusText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
  },
  unreadDot: {
    position: 'absolute',
    top: Layout.spacing.sm,
    right: Layout.spacing.sm,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GrottoTokens.gold,
    borderWidth: 2,
    borderColor: GrottoTokens.white,
  },

  // ── Info below image
  cardBody: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Layout.spacing.sm,
  },
  cardNameGroup: { flex: 1, gap: 2 },
  cardName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 17,
    color: GrottoTokens.textPrimary,
  },
  cardNameBold: { fontFamily: FontFamily.sansSemiBold },
  cardSubName: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  cardTime: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    flexShrink: 0,
    marginTop: 3,
  },
  cardSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 20,
  },
  cardSubUnread: {
    fontFamily: FontFamily.sansMedium,
    color: GrottoTokens.textPrimary,
  },
  cardDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  cardDates: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },

  // ── Archived section
  allArchivedWrap: {
    paddingVertical: Layout.spacing.xl,
    alignItems: 'center',
  },
  allArchivedText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textMuted,
  },
  archivedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Layout.spacing.md,
    marginTop: Layout.spacing.sm,
  },
  archivedToggleText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textMuted,
  },
});
