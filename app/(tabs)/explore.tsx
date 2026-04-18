import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { and, eq, inArray } from 'drizzle-orm';
import { useRouter, useFocusEffect } from 'expo-router';

import { db } from '@/db/client';
import { applications, listings, sits, savedLists, savedListItems, users } from '@/db/schema';
import type { Application, Listing, Sit, SavedList, User } from '@/db/schema';
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

type SitterEntry = {
  application: Application;
  sit: Sit;
  listing?: Listing;
  owner?: User;
};

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

  // Sitter: my sits/applications
  const [mySits, setMySits]           = useState<SitterEntry[]>([]);

  // Sitter: saved lists
  const [savedListData, setSavedListData] = useState<ListWithListings[]>([]);
  const [savedListsLoading, setSavedListsLoading] = useState(false);

  // Owner
  const [myListings, setMyListings]   = useState<Listing[]>([]);
  const [openSitCounts, setOpenSitCounts] = useState<Record<number, number>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    active: true, draft: false, archived: false,
  });

  // Saved list detail modal
  const [selectedList, setSelectedList] = useState<ListWithListings | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) { setLoading(false); return; }

      setLoading(true);

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
        db.select().from(applications)
          .where(eq(applications.sitterId, currentUser.id))
          .then(async (appRows) => {
            if (appRows.length === 0) { setMySits([]); setLoading(false); return; }

            const sitIds     = [...new Set(appRows.map((a) => a.sitId))];
            const listingIds = [...new Set(appRows.map((a) => a.listingId))];

            const [sitRows, listingRows] = await Promise.all([
              db.select().from(sits).where(inArray(sits.id, sitIds)),
              db.select().from(listings).where(inArray(listings.id, listingIds)),
            ]);

            const ownerIds = [...new Set(listingRows.map((l) => l.ownerId))];
            const ownerRows = ownerIds.length > 0
              ? await db.select().from(users).where(inArray(users.id, ownerIds))
              : [];

            const sitMap     = Object.fromEntries(sitRows.map((s) => [s.id, s]));
            const listingMap = Object.fromEntries(listingRows.map((l) => [l.id, l]));
            const ownerMap   = Object.fromEntries(ownerRows.map((u) => [u.id, u]));

            setMySits(
              appRows
                .filter((a) => sitMap[a.sitId])
                .map((a) => {
                  const listing = listingMap[a.listingId];
                  return {
                    application: a,
                    sit: sitMap[a.sitId],
                    listing,
                    owner: listing ? ownerMap[listing.ownerId] : undefined,
                  };
                })
                .sort((a, b) => b.sit.startDate.localeCompare(a.sit.startDate))
            );
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id, isOwner])
  );

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

  async function handleDeleteList(listId: number) {
    Alert.alert(
      'Delete list?',
      'This removes the list and all saved sits in it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await db.delete(savedListItems).where(eq(savedListItems.listId, listId));
            await db.delete(savedLists).where(eq(savedLists.id, listId));
            setSavedListData(prev => prev.filter(l => l.id !== listId));
            setSelectedList(prev => prev?.id === listId ? null : prev);
          },
        },
      ]
    );
  }

  function handleRenameList(listId: number, currentName: string) {
    Alert.prompt(
      'Rename list',
      '',
      async (newName) => {
        if (!newName?.trim()) return;
        await db.update(savedLists).set({ name: newName.trim() }).where(eq(savedLists.id, listId));
        setSavedListData(prev =>
          prev.map(l => l.id === listId ? { ...l, name: newName.trim() } : l)
        );
        setSelectedList(prev =>
          prev?.id === listId ? { ...prev, name: newName.trim() } : prev
        );
      },
      'plain-text',
      currentName
    );
  }

  async function handleRemoveFromList(listId: number, listingId: number) {
    await db.delete(savedListItems).where(
      and(eq(savedListItems.listId, listId), eq(savedListItems.listingId, listingId))
    );
    await refreshList(listId);
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

  // ── Owner helpers ─────────────────────────────────────────────────────────────

  async function handleDeleteListing(listingId: number) {
    Alert.alert(
      'Move to Deleted?',
      'The listing will be hidden. You can restore it from your Deleted section.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db
                .update(listings)
                .set({ listingStatus: 'deleted' })
                .where(eq(listings.id, listingId));
              setMyListings(prev =>
                prev.map(l => l.id === listingId ? { ...l, listingStatus: 'deleted' } : l)
              );
            } catch {
              Alert.alert('Error', 'Could not delete this listing. Please try again.');
            }
          },
        },
      ],
    );
  }

  async function updateStatus(listingId: number, value: string) {
    try {
      await db
        .update(listings)
        .set({ listingStatus: value })
        .where(eq(listings.id, listingId));
      setMyListings(prev =>
        prev.map(l => l.id === listingId ? { ...l, listingStatus: value } : l)
      );
    } catch {
      Alert.alert('Error', 'Could not update status.');
    }
  }

  function handleStatusChange(listingId: number, current: string | null) {
    const cur = current ?? 'active';
    Alert.alert(
      'Status',
      undefined,
      [
        {
          text: (cur === 'active' ? '✓  ' : '') + 'Active',
          onPress: () => updateStatus(listingId, 'active'),
        },
        {
          text: (cur === 'draft' ? '✓  ' : '') + 'Draft',
          onPress: () => updateStatus(listingId, 'draft'),
        },
        {
          text: (cur === 'inactive' ? '✓  ' : '') + 'Inactive',
          onPress: () => updateStatus(listingId, 'inactive'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  // ── Owner view ───────────────────────────────────────────────────────────────
  // "Archived" bucket catches both inactive and deleted statuses
  const OWNER_SECTIONS: Array<{ key: string; label: string; color: string; match: (s: string | null) => boolean }> = [
    { key: 'active',   label: 'Active',   color: '#4CAF7D', match: s => (s ?? 'active') === 'active' },
    { key: 'draft',    label: 'Drafts',   color: '#F5873D', match: s => s === 'draft' },
    { key: 'archived', label: 'Archived', color: '#9E9E9E', match: s => s === 'inactive' || s === 'deleted' },
  ];

  if (isOwner) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <Text style={styles.pageTitle}>My Listings</Text>
            <Pressable style={styles.createBtn} onPress={() => router.push('/listing/create')}>
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
            <View style={styles.sectionList}>
              {OWNER_SECTIONS.map(({ key, label, color, match }) => {
                const sectionListings = myListings.filter(l => match(l.listingStatus));
                const isExpanded = expandedSections[key];
                const count = sectionListings.length;
                return (
                  <View key={key} style={styles.section}>
                    <Pressable
                      style={styles.sectionHeader}
                      onPress={() =>
                        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
                      }
                    >
                      <View style={[styles.sectionDot, { backgroundColor: color }]} />
                      <Text style={styles.sectionHeaderLabel}>{label}</Text>
                      <View style={[styles.sectionCountBadge, { backgroundColor: color + '22' }]}>
                        <Text style={[styles.sectionCountText, { color }]}>{count}</Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={GrottoTokens.textMuted}
                      />
                    </Pressable>

                    {isExpanded && count === 0 && (
                      <Text style={styles.sectionEmpty}>
                        No {label.toLowerCase()} listings
                      </Text>
                    )}

                    {isExpanded && count > 0 && (
                      <View style={styles.sectionCards}>
                        {sectionListings.map((listing) => (
                          <OwnerListingCard
                            key={listing.id}
                            listing={listing}
                            openSits={openSitCounts[listing.id] ?? 0}
                            onPress={() => router.push(`/listing/${listing.id}`)}
                            onDelete={() => handleDeleteListing(listing.id)}
                            onStatusPress={() =>
                              handleStatusChange(listing.id, listing.listingStatus ?? 'active')
                            }
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Sitter view ──────────────────────────────────────────────────────────────

  const applied   = mySits.filter((e) => e.application.status === 'pending');
  const approved  = mySits.filter((e) => e.application.status === 'accepted' && e.sit.status !== 'live' && e.sit.status !== 'completed' && e.sit.status !== 'cancelled');
  const live      = mySits.filter((e) => e.sit.status === 'live');
  const previous  = mySits.filter((e) => e.sit.status === 'completed');
  const cancelled = mySits.filter((e) => e.sit.status === 'cancelled' || e.application.status === 'withdrawn' || e.application.status === 'declined');

  const SITTER_SECTIONS = [
    { key: 'applied',   label: 'Applied',        color: GrottoTokens.gold,    entries: applied },
    { key: 'approved',  label: 'Approved',        color: GrottoTokens.success, entries: approved },
    { key: 'live',      label: 'Live now',        color: GrottoTokens.success, entries: live },
    { key: 'previous',  label: 'Previous sits',   color: GrottoTokens.textMuted, entries: previous },
    { key: 'cancelled', label: 'Cancelled',       color: '#D44C4C',            entries: cancelled },
  ].filter((s) => s.entries.length > 0);

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
            <View style={{ gap: Layout.spacing.xl }}>
              {SITTER_SECTIONS.map(({ key, label, color, entries }, idx) => (
                <View key={key}>
                  <View style={styles.sitterSectionHeader}>
                    <View style={[styles.sitterSectionDot, { backgroundColor: color }]} />
                    <Text style={styles.sitterSectionLabel}>{label}</Text>
                    <View style={[styles.sitterSectionBadge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.sitterSectionBadgeText, { color }]}>{entries.length}</Text>
                    </View>
                  </View>
                  <View style={styles.cardList}>
                    {entries.map((entry) => (
                      <SitCard
                        key={entry.application.id}
                        entry={entry}
                        onPress={() => entry.listing && router.push(`/listing/${entry.listing.id}`)}
                        onMessage={() => router.push(`/chat/${entry.application.id}`)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
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
                  onOptions={() => Alert.alert(
                    list.name,
                    undefined,
                    [
                      { text: 'Rename', onPress: () => handleRenameList(list.id, list.name) },
                      { text: 'Delete list', style: 'destructive', onPress: () => handleDeleteList(list.id) },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  )}
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
          onOptions={() => Alert.alert(
            selectedList.name,
            undefined,
            [
              { text: 'Rename', onPress: () => handleRenameList(selectedList.id, selectedList.name) },
              { text: 'Delete list', style: 'destructive', onPress: () => handleDeleteList(selectedList.id) },
              { text: 'Cancel', style: 'cancel' },
            ]
          )}
          onRemoveListing={(listingId) => handleRemoveFromList(selectedList.id, listingId)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Sitter sit card ──────────────────────────────────────────────────────────

function SitCard({ entry, onPress, onMessage }: {
  entry: SitterEntry;
  onPress: () => void;
  onMessage: () => void;
}) {
  const { sit, listing, owner } = entry;
  const nights = nightsBetween(sit.startDate, sit.endDate);

  return (
    <Pressable
      style={({ pressed }) => [styles.sitCard, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Cover image */}
      <View style={styles.sitCardImageWrap}>
        {listing?.coverPhotoUrl ? (
          <Image source={{ uri: listing.coverPhotoUrl }} style={styles.sitCardImage} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.sitCardImage, styles.cardImageFallback]}>
            <Ionicons name="home-outline" size={32} color={GrottoTokens.goldMuted} />
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.sitCardBody}>
        {/* Title + location */}
        <Text style={styles.sitCardTitle} numberOfLines={1}>
          {listing?.title ?? 'Listing removed'}
        </Text>

        {/* Owner row */}
        {owner && (
          <View style={styles.sitCardOwnerRow}>
            {owner.avatarUrl ? (
              <Image source={{ uri: owner.avatarUrl }} style={styles.sitCardOwnerAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.sitCardOwnerAvatar, styles.sitCardOwnerAvatarFallback]}>
                <Ionicons name="person" size={10} color={GrottoTokens.goldMuted} />
              </View>
            )}
            <Text style={styles.sitCardOwnerName} numberOfLines={1}>{owner.name}</Text>
          </View>
        )}

        {listing && (
          <View style={styles.cardLocationRow}>
            <Ionicons name="location-outline" size={13} color={GrottoTokens.textMuted} />
            <Text style={styles.cardLocation} numberOfLines={1}>
              {[listing.city, listing.country].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}

        {/* Dates */}
        <View style={styles.cardDatesRow}>
          <Ionicons name="calendar-outline" size={14} color={GrottoTokens.gold} />
          <Text style={styles.cardDates}>
            {formatDate(sit.startDate)} – {formatDate(sit.endDate)}
          </Text>
          <Text style={styles.cardNights}>· {nights}n</Text>
        </View>

        {/* Message button */}
        <Pressable
          style={styles.messageBtn}
          onPress={(e) => { e.stopPropagation(); onMessage(); }}
          hitSlop={4}
        >
          <Ionicons name="chatbubble-outline" size={13} color={GrottoTokens.gold} />
          <Text style={styles.messageBtnText}>Message owner</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const LISTING_STATUS_COLORS: Record<string, string> = {
  active:   '#4CAF7D', // green
  draft:    '#F5873D', // orange
  inactive: '#9E9E9E', // grey
  deleted:  '#9E9E9E', // grey (same — both are archived)
};

const LISTING_STATUS_LABELS: Record<string, string> = {
  active:   'Live',
  draft:    'Draft',
  inactive: 'Archived',
  deleted:  'Archived',
};

function statusColor(s: string | null) {
  return LISTING_STATUS_COLORS[s ?? 'active'] ?? LISTING_STATUS_COLORS.active;
}

// ─── Owner listing card ───────────────────────────────────────────────────────

function OwnerListingCard({
  listing, openSits, onPress, onDelete, onStatusPress,
}: {
  listing: Listing;
  openSits: number;
  onPress: () => void;
  onDelete: () => void;
  onStatusPress: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const isSwipeOpen = useRef(false);
  const petTypes: string[] = listing.petTypes ? JSON.parse(listing.petTypes) : [];
  const statusVal = listing.listingStatus ?? 'active';

  function renderRightActions() {
    return (
      <Pressable
        style={styles.swipeDeleteAction}
        onPress={() => {
          swipeRef.current?.close();
          onDelete();
        }}
      >
        <Ionicons name="trash" size={22} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Pressable>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={60}
      onSwipeableOpen={() => { isSwipeOpen.current = true; }}
      onSwipeableClose={() => { isSwipeOpen.current = false; }}
    >
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => {
          if (isSwipeOpen.current) {
            swipeRef.current?.close();
          } else {
            onPress();
          }
        }}
      >
        <View style={styles.cardImageWrap}>
          {listing.coverPhotoUrl ? (
            <Image source={{ uri: listing.coverPhotoUrl }} style={styles.cardImage} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.cardImage, styles.cardImageFallback]}>
              <Ionicons name="home-outline" size={24} color={GrottoTokens.goldMuted} />
            </View>
          )}
          {/* Tappable status dot */}
          <Pressable
            style={[styles.activeDot, { backgroundColor: statusColor(statusVal) }]}
            onPress={(e) => { e.stopPropagation(); onStatusPress(); }}
            hitSlop={8}
          />
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
            <View style={[styles.statusBadge, { backgroundColor: statusColor(statusVal) + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor(statusVal) }]}>
                {LISTING_STATUS_LABELS[statusVal]}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

// ─── Saved list card (grid) ───────────────────────────────────────────────────

function SavedListCard({ list, onPress, onOptions }: { list: ListWithListings; onPress: () => void; onOptions: () => void }) {
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
        <View style={{ flex: 1 }}>
          <Text style={styles.savedCardName} numberOfLines={1}>{list.name}</Text>
          <Text style={styles.savedCardCount}>
            {count} {count === 1 ? 'sit' : 'sits'}
          </Text>
        </View>
        <Pressable
          onPress={(e) => { e.stopPropagation(); onOptions(); }}
          hitSlop={8}
          style={styles.listOptionsBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={GrottoTokens.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Saved list detail modal ──────────────────────────────────────────────────

function SavedListDetailModal({
  list, onClose, onListingPress, onRefresh, onOptions, onRemoveListing,
}: {
  list: ListWithListings;
  onClose: () => void;
  onListingPress: (l: Listing) => void;
  onRefresh: () => void;
  onOptions: () => void;
  onRemoveListing: (listingId: number) => void;
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
          <Pressable style={styles.modalOptionsBtn} onPress={onOptions} hitSlop={10}>
            <Ionicons name="ellipsis-horizontal" size={20} color={GrottoTokens.textPrimary} />
          </Pressable>
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
                <View key={listing.id} style={styles.modalListingRow}>
                  <Pressable
                    style={({ pressed }) => [styles.card, styles.modalListingCard, pressed && styles.cardPressed]}
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
                  <Pressable
                    style={styles.removeFromListBtn}
                    onPress={() => onRemoveListing(listing.id)}
                    hitSlop={6}
                  >
                    <Ionicons name="close-circle" size={22} color={GrottoTokens.textMuted} />
                  </Pressable>
                </View>
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

  // ── Sitter section headers
  sitterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
  },
  sitterSectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sitterSectionLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    flex: 1,
  },
  sitterSectionBadge: {
    borderRadius: Layout.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sitterSectionBadgeText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
  },

  // ── Section labels (owner collapsible sections use these)
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

  // ── Sitter sit card (larger format)
  sitCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  sitCardImageWrap: {
    width: '100%',
    height: 160,
  },
  sitCardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: GrottoTokens.goldSubtle,
  },
  sitCardBody: {
    padding: Layout.spacing.md,
    gap: 6,
  },
  sitCardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 17,
    color: GrottoTokens.textPrimary,
  },
  sitCardOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sitCardOwnerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  sitCardOwnerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sitCardOwnerName: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    flex: 1,
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
    minHeight: 88,
    alignSelf: 'stretch',
    position: 'relative',
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
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
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: GrottoTokens.goldSubtle,
    borderRadius: Layout.radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: GrottoTokens.goldMuted,
  },
  messageBtnText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.gold,
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
  listOptionsBtn: {
    padding: 4,
  },

  // ── Modal listing row (card + remove button)
  modalListingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  modalListingCard: {
    flex: 1,
  },
  removeFromListBtn: {
    padding: 4,
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
  modalOptionsBtn: {
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

  // ── Collapsible sections
  sectionList: {
    gap: Layout.spacing.sm,
  },
  section: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 14,
    gap: Layout.spacing.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeaderLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    flex: 1,
  },
  sectionCountBadge: {
    borderRadius: Layout.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
  },
  sectionEmpty: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: Layout.spacing.md,
  },
  sectionCards: {
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.sm,
    paddingBottom: Layout.spacing.sm,
  },

  // ── Swipe-to-delete action
  swipeDeleteAction: {
    width: 88,
    alignSelf: 'stretch',
    backgroundColor: GrottoTokens.error,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: Layout.radius.lg,
    marginLeft: Layout.spacing.xs,
  },
  swipeDeleteText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: '#fff',
  },
});
