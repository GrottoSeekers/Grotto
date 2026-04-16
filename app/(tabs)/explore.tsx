import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { eq, inArray } from 'drizzle-orm';
import { useRouter } from 'expo-router';

import { db } from '@/db/client';
import { listings, sits, savedLists, savedListItems } from '@/db/schema';
import type { Listing, Sit, SavedList } from '@/db/schema';
import { useSessionStore } from '@/store/session-store';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  );
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  open:      { label: 'Open',      bg: GrottoTokens.goldSubtle,  text: GrottoTokens.gold },
  confirmed: { label: 'Confirmed', bg: '#E8F5EE',                text: GrottoTokens.success },
  live:      { label: 'Live now',  bg: '#E8F5EE',                text: GrottoTokens.success },
  completed: { label: 'Completed', bg: GrottoTokens.surface,     text: GrottoTokens.textMuted },
  cancelled: { label: 'Cancelled', bg: '#FBE8E8',                text: GrottoTokens.error },
};

type SitWithListing = Sit & { listing?: Listing };

interface ListWithListings extends SavedList {
  savedListings: Listing[];
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const { currentUser } = useSessionStore();
  const isOwner = currentUser?.role === 'owner';

  // Shared
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'sits' | 'saved'>('sits');

  // Sitter: my sits
  const [mySits, setMySits]           = useState<SitWithListing[]>([]);

  // Sitter: saved lists
  const [savedListData, setSavedListData] = useState<ListWithListings[]>([]);
  const [savedListsLoading, setSavedListsLoading] = useState(false);

  // Owner
  const [myListings, setMyListings]   = useState<Listing[]>([]);
  const [openSitCounts, setOpenSitCounts] = useState<Record<number, number>>({});

  // Saved list detail modal
  const [selectedList, setSelectedList] = useState<ListWithListings | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }

    if (isOwner) {
      db.select()
        .from(listings)
        .where(eq(listings.ownerId, currentUser.id))
        .then(async (rows) => {
          setMyListings(rows);
          if (rows.length > 0) {
            const ids = rows.map((r) => r.id);
            const sitRows = await db.select().from(sits).where(inArray(sits.listingId, ids));
            const counts: Record<number, number> = {};
            for (const s of sitRows) {
              if (s.status === 'open' && s.startDate >= today) {
                counts[s.listingId] = (counts[s.listingId] ?? 0) + 1;
              }
            }
            setOpenSitCounts(counts);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      db.select()
        .from(sits)
        .where(eq(sits.sitterId, currentUser.id))
        .then(async (sitRows) => {
          const uniqueIds = [...new Set(sitRows.map((r) => r.listingId))];
          let listingMap: Record<number, Listing> = {};
          if (uniqueIds.length > 0) {
            const listingRows = await db.select().from(listings).where(inArray(listings.id, uniqueIds));
            for (const l of listingRows) listingMap[l.id] = l;
          }
          setMySits(sitRows.map((s) => ({ ...s, listing: listingMap[s.listingId] })));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Load saved lists when tab switches to "saved"
  useEffect(() => {
    if (activeTab === 'saved' && currentUser && !isOwner) {
      loadSavedLists();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id]);

  async function loadSavedLists() {
    if (!currentUser) return;
    setSavedListsLoading(true);
    const listRows = await db
      .select()
      .from(savedLists)
      .where(eq(savedLists.sitterId, currentUser.id));

    const result: ListWithListings[] = [];
    for (const list of listRows) {
      const items = await db
        .select()
        .from(savedListItems)
        .where(eq(savedListItems.listId, list.id));
      const listingIds = items.map((i) => i.listingId);
      let savedListings: Listing[] = [];
      if (listingIds.length > 0) {
        savedListings = await db.select().from(listings).where(inArray(listings.id, listingIds));
      }
      result.push({ ...list, savedListings });
    }
    setSavedListData(result);
    setSavedListsLoading(false);
  }

  async function refreshList(listId: number) {
    if (!currentUser) return;
    const items = await db
      .select()
      .from(savedListItems)
      .where(eq(savedListItems.listId, listId));
    const listingIds = items.map((i) => i.listingId);
    let savedListings: Listing[] = [];
    if (listingIds.length > 0) {
      savedListings = await db.select().from(listings).where(inArray(listings.id, listingIds));
    }
    setSavedListData((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, savedListings } : l))
    );
    if (selectedList?.id === listId) {
      setSelectedList((prev) => prev ? { ...prev, savedListings } : prev);
    }
  }

  // ── Not signed in ────────────────────────────────────────────────────────────
  if (!currentUser && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.pageTitle}>{isOwner ? 'My Listings' : 'My Sits'}</Text>
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={48} color={GrottoTokens.goldMuted} />
          <Text style={styles.emptyTitle}>Sign in to view your sits</Text>
          <Text style={styles.emptyBody}>
            Create an account or sign in to start booking and managing house sits.
          </Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => router.push('/profile/sign-in')}
          >
            <Text style={styles.emptyBtnText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.pageTitle}>{isOwner ? 'My Listings' : 'My Sits'}</Text>
        <View style={styles.emptyState}>
          <ActivityIndicator color={GrottoTokens.gold} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Owner view ───────────────────────────────────────────────────────────────
  if (isOwner) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <Text style={styles.pageTitle}>My Listings</Text>
            <Pressable style={styles.createBtn}>
              <Ionicons name="add" size={18} color={GrottoTokens.white} />
              <Text style={styles.createBtnText}>New</Text>
            </Pressable>
          </View>

          {myListings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={48} color={GrottoTokens.goldMuted} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyBody}>
                Create your first listing to start finding trusted sitters for your pets.
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {myListings.map((listing) => (
                <OwnerListingCard
                  key={listing.id}
                  listing={listing}
                  openSits={openSitCounts[listing.id] ?? 0}
                  onPress={() => router.push(`/listing/${listing.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Sitter view ──────────────────────────────────────────────────────────────
  const upcoming = mySits.filter(
    (s) => s.startDate >= today && s.status !== 'completed' && s.status !== 'cancelled'
  ).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const past = mySits.filter(
    (s) => s.startDate < today || s.status === 'completed' || s.status === 'cancelled'
  ).sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Segment control ── */}
      <View style={styles.topArea}>
        <Text style={styles.pageTitle}>My Activity</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentBtn, activeTab === 'sits' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('sits')}
          >
            <Text style={[styles.segmentText, activeTab === 'sits' && styles.segmentTextActive]}>
              My Sits
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, activeTab === 'saved' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('saved')}
          >
            <Text style={[styles.segmentText, activeTab === 'saved' && styles.segmentTextActive]}>
              Saved Lists
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === 'sits' ? (
        // ── My Sits tab
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
        >
          {mySits.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={GrottoTokens.goldMuted} />
              <Text style={styles.emptyTitle}>No sits yet</Text>
              <Text style={styles.emptyBody}>
                Browse the discover tab to find and apply for house sits near you.
              </Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/')}>
                <Text style={styles.emptyBtnText}>Find a sit</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {upcoming.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Upcoming</Text>
                  <View style={styles.cardList}>
                    {upcoming.map((sit) => (
                      <SitCard
                        key={sit.id}
                        sit={sit}
                        onPress={() => sit.listing && router.push(`/listing/${sit.listing.id}`)}
                      />
                    ))}
                  </View>
                </>
              )}
              {past.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, upcoming.length > 0 && styles.sectionLabelSpaced]}>
                    Past
                  </Text>
                  <View style={styles.cardList}>
                    {past.map((sit) => (
                      <SitCard
                        key={sit.id}
                        sit={sit}
                        onPress={() => sit.listing && router.push(`/listing/${sit.listing.id}`)}
                      />
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        // ── Saved Lists tab
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
        >
          {savedListsLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={GrottoTokens.gold} />
            </View>
          ) : savedListData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={48} color={GrottoTokens.goldMuted} />
              <Text style={styles.emptyTitle}>No saved lists yet</Text>
              <Text style={styles.emptyBody}>
                Tap the heart on any listing to save it. Create lists by date, location, or anything you like.
              </Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/')}>
                <Text style={styles.emptyBtnText}>Browse sits</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.savedGrid}>
              {savedListData.map((list) => (
                <SavedListCard
                  key={list.id}
                  list={list}
                  onPress={() => setSelectedList(list)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Saved list detail modal ── */}
      {selectedList && (
        <SavedListDetailModal
          list={selectedList}
          onClose={() => setSelectedList(null)}
          onListingPress={(listing) => {
            setSelectedList(null);
            router.push(`/listing/${listing.id}`);
          }}
          onRefresh={() => refreshList(selectedList.id)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Sitter sit card ──────────────────────────────────────────────────────────

function SitCard({ sit, onPress }: { sit: SitWithListing; onPress: () => void }) {
  const { listing } = sit;
  const nights = nightsBetween(sit.startDate, sit.endDate);
  const cfg = STATUS_CONFIG[sit.status] ?? STATUS_CONFIG.open;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardImageWrap}>
        {listing?.coverPhotoUrl ? (
          <Image source={{ uri: listing.coverPhotoUrl }} style={styles.cardImage} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Ionicons name="home-outline" size={24} color={GrottoTokens.goldMuted} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {listing?.title ?? 'Listing removed'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>
        {listing && (
          <View style={styles.cardLocationRow}>
            <Ionicons name="location-outline" size={12} color={GrottoTokens.textMuted} />
            <Text style={styles.cardLocation} numberOfLines={1}>
              {[listing.city, listing.country].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
        <View style={styles.cardDatesRow}>
          <Ionicons name="calendar-outline" size={13} color={GrottoTokens.gold} />
          <Text style={styles.cardDates}>
            {formatDate(sit.startDate)} – {formatDate(sit.endDate)}
          </Text>
          <Text style={styles.cardNights}>· {nights} night{nights !== 1 ? 's' : ''}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Owner listing card ───────────────────────────────────────────────────────

function OwnerListingCard({
  listing, openSits, onPress,
}: { listing: Listing; openSits: number; onPress: () => void }) {
  const petTypes: string[] = listing.petTypes ? JSON.parse(listing.petTypes) : [];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardImageWrap}>
        {listing.coverPhotoUrl ? (
          <Image source={{ uri: listing.coverPhotoUrl }} style={styles.cardImage} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Ionicons name="home-outline" size={24} color={GrottoTokens.goldMuted} />
          </View>
        )}
        <View style={[styles.activeDot, { backgroundColor: listing.isActive ? GrottoTokens.success : GrottoTokens.textMuted }]} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
          <Ionicons name="chevron-forward" size={16} color={GrottoTokens.textMuted} />
        </View>
        <View style={styles.cardLocationRow}>
          <Ionicons name="location-outline" size={12} color={GrottoTokens.textMuted} />
          <Text style={styles.cardLocation} numberOfLines={1}>
            {[listing.city, listing.country].filter(Boolean).join(', ')}
          </Text>
        </View>
        <View style={styles.cardMetaRow}>
          {listing.bedrooms != null && (
            <View style={styles.cardMeta}>
              <Ionicons name="bed-outline" size={12} color={GrottoTokens.textSecondary} />
              <Text style={styles.cardMetaText}>{listing.bedrooms} bed</Text>
            </View>
          )}
          {petTypes.length > 0 && (
            <View style={styles.cardMeta}>
              <Ionicons name="paw-outline" size={12} color={GrottoTokens.textSecondary} />
              <Text style={styles.cardMetaText}>{petTypes.length} pet{petTypes.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: openSits > 0 ? GrottoTokens.goldSubtle : GrottoTokens.surface }]}>
            <Text style={[styles.statusText, { color: openSits > 0 ? GrottoTokens.gold : GrottoTokens.textMuted }]}>
              {openSits > 0 ? `${openSits} open date${openSits !== 1 ? 's' : ''}` : 'No open dates'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Saved list card (grid) ───────────────────────────────────────────────────

function SavedListCard({ list, onPress }: { list: ListWithListings; onPress: () => void }) {
  const count = list.savedListings.length;
  const previews = list.savedListings.slice(0, 4).map((l) => l.coverPhotoUrl).filter(Boolean) as string[];

  return (
    <Pressable
      style={({ pressed }) => [styles.savedCard, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Photo mosaic */}
      <View style={styles.mosaicWrap}>
        {previews.length === 0 ? (
          <View style={styles.mosaicEmpty}>
            <Text style={styles.mosaicEmptyEmoji}>{list.emoji ?? '🏡'}</Text>
          </View>
        ) : previews.length === 1 ? (
          <Image source={{ uri: previews[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.mosaicGrid}>
            <Image source={{ uri: previews[0] }} style={styles.mosaicLeft} contentFit="cover" />
            <View style={styles.mosaicRight}>
              {previews.slice(1, 3).map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={[styles.mosaicSmall, i === 0 && styles.mosaicSmallTop]}
                  contentFit="cover"
                />
              ))}
            </View>
          </View>
        )}
        {/* Emoji badge */}
        <View style={styles.listEmojiPill}>
          <Text style={styles.listEmoji}>{list.emoji ?? '🏡'}</Text>
        </View>
      </View>

      {/* Label */}
      <View style={styles.savedCardLabel}>
        <Text style={styles.savedCardName}>{list.name}</Text>
        <Text style={styles.savedCardCount}>
          {count} {count === 1 ? 'sit' : 'sits'}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Saved list detail modal ──────────────────────────────────────────────────

function SavedListDetailModal({
  list, onClose, onListingPress, onRefresh,
}: {
  list: ListWithListings;
  onClose: () => void;
  onListingPress: (l: Listing) => void;
  onRefresh: () => void;
}) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Pressable style={styles.modalBack} onPress={onClose} hitSlop={10}>
            <Ionicons name="chevron-down" size={22} color={GrottoTokens.textPrimary} />
          </Pressable>
          <View style={styles.modalHeaderCenter}>
            <Text style={styles.modalEmoji}>{list.emoji ?? '🏡'}</Text>
            <Text style={styles.modalTitle}>{list.name}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.modalSubtitle}>
          {list.savedListings.length} saved sit{list.savedListings.length !== 1 ? 's' : ''}
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalScroll}
        >
          {list.savedListings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={40} color={GrottoTokens.goldMuted} />
              <Text style={styles.emptyTitle}>This list is empty</Text>
              <Text style={styles.emptyBody}>
                Save sits from the discover page to add them here.
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {list.savedListings.map((listing) => (
                <Pressable
                  key={listing.id}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => onListingPress(listing)}
                >
                  <View style={styles.cardImageWrap}>
                    {listing.coverPhotoUrl ? (
                      <Image source={{ uri: listing.coverPhotoUrl }} style={styles.cardImage} contentFit="cover" transition={200} />
                    ) : (
                      <View style={[styles.cardImage, styles.cardImageFallback]}>
                        <Ionicons name="home-outline" size={24} color={GrottoTokens.goldMuted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
                    <View style={styles.cardLocationRow}>
                      <Ionicons name="location-outline" size={12} color={GrottoTokens.textMuted} />
                      <Text style={styles.cardLocation} numberOfLines={1}>
                        {[listing.city, listing.country].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    {listing.bedrooms != null && (
                      <View style={styles.cardMeta}>
                        <Ionicons name="bed-outline" size={12} color={GrottoTokens.textSecondary} />
                        <Text style={styles.cardMetaText}>{listing.bedrooms} bed</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  scrollContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.xl,
    paddingTop: Layout.spacing.sm,
  },
  topArea: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
    backgroundColor: GrottoTokens.offWhite,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  pageTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 28,
    color: GrottoTokens.textPrimary,
    paddingBottom: Layout.spacing.sm,
  },

  // ── Segment control
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: GrottoTokens.surface,
    borderRadius: Layout.radius.full,
    padding: 3,
    gap: 2,
    marginBottom: Layout.spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Layout.radius.full,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: GrottoTokens.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textMuted,
  },
  segmentTextActive: {
    color: GrottoTokens.textPrimary,
    fontFamily: FontFamily.sansSemiBold,
  },

  // ── Section labels
  sectionLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Layout.spacing.sm,
    marginTop: Layout.spacing.md,
  },
  sectionLabelSpaced: {
    marginTop: Layout.spacing.lg,
  },
  cardList: {
    gap: Layout.spacing.md,
  },

  // ── Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.xxl,
    gap: Layout.spacing.md,
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

  // ── Sit / listing cards
  card: {
    flexDirection: 'row',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  cardImageWrap: {
    width: 88,
    alignSelf: 'stretch',
    position: 'relative',
  },
  cardImage: {
    width: 88,
    height: '100%',
    minHeight: 88,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: GrottoTokens.white,
  },
  cardBody: {
    flex: 1,
    padding: Layout.spacing.md,
    gap: 6,
    justifyContent: 'center',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.spacing.sm,
  },
  cardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    flex: 1,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardLocation: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    flex: 1,
  },
  cardDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDates: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.textPrimary,
  },
  cardNights: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    flexWrap: 'wrap',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardMetaText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
  },
  statusBadge: {
    borderRadius: Layout.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
  },

  // ── Saved lists grid
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.md,
  },
  savedCard: {
    width: '47%',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  mosaicWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: GrottoTokens.goldSubtle,
    position: 'relative',
    overflow: 'hidden',
  },
  mosaicEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mosaicEmptyEmoji: {
    fontSize: 40,
  },
  mosaicGrid: {
    flex: 1,
    flexDirection: 'row',
  },
  mosaicLeft: {
    flex: 1,
    height: '100%',
  },
  mosaicRight: {
    flex: 1,
    height: '100%',
    gap: 2,
  },
  mosaicSmall: {
    flex: 1,
    width: '100%',
  },
  mosaicSmallTop: {
    marginBottom: 1,
  },
  listEmojiPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: Layout.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  listEmoji: {
    fontSize: 16,
  },
  savedCardLabel: {
    padding: Layout.spacing.sm,
    gap: 2,
  },
  savedCardName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  savedCardCount: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },

  // ── Saved list detail modal
  modalSafe: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    backgroundColor: GrottoTokens.white,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  modalBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  modalEmoji: {
    fontSize: 24,
  },
  modalTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 20,
    color: GrottoTokens.textPrimary,
  },
  modalSubtitle: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.xs,
    backgroundColor: GrottoTokens.white,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  modalScroll: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.xxl,
  },

  // ── Misc
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  createBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.white,
  },
});
