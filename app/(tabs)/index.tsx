import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ListingCard } from '@/components/listing-card';
import { MapClusterMarker } from '@/components/map-cluster-marker';
import { SearchModal } from '@/components/search-modal';
import { FilterSheet } from '@/components/filter-sheet';
import type { FilterState } from '@/components/filter-sheet';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useDiscoveryStore } from '@/store/discovery-store';
import { db } from '@/db/client';
import { listings, sits } from '@/db/schema';
import type { Listing, Sit } from '@/db/schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORLD_REGION: Region = {
  latitude: 30,
  longitude: 10,
  latitudeDelta: 80,
  longitudeDelta: 100,
};

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getDatesLabel(dateFrom: string | null, dateTo: string | null): string {
  if (!dateFrom) return 'Any dates';
  const from = new Date(dateFrom + 'T00:00:00');
  const fromStr = from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (!dateTo) return `From ${fromStr}`;
  const to = new Date(dateTo + 'T00:00:00');
  const toStr = to.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fromStr} – ${toStr}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoveryScreen() {
  const router = useRouter();
  const {
    viewMode,
    searchQuery,
    dateFrom,
    dateTo,
    sortBy,
    petFilters,
    minNights,
    amenityFilters,
    mapRegion,
    listings: storedListings,
    setViewMode,
    setSearchQuery,
    setDateRange,
    setSortBy,
    setPetFilters,
    setMinNights,
    setAmenityFilters,
    setMapRegion,
    setListings,
    clearFilters,
  } = useDiscoveryStore();

  const [mapMoved, setMapMoved]               = useState(false);
  const [currentRegion, setCurrentRegion]     = useState<Region>(WORLD_REGION);
  const [upcomingSits, setUpcomingSits]       = useState<Sit[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Load listings + upcoming sits
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      db.select().from(listings),
      db.select().from(sits),
    ]).then(([listingRows, sitRows]) => {
      setListings(listingRows);
      setUpcomingSits(sitRows.filter((s) => s.status === 'open' && s.startDate >= today));
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unique city/country suggestions for search modal
  const locationSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of storedListings) {
      if (l.city && !seen.has(l.city)) { seen.add(l.city); out.push(l.city); }
      if (l.country && !seen.has(l.country)) { seen.add(l.country); out.push(l.country); }
    }
    return out.sort();
  }, [storedListings]);

  function getNextSit(listingId: number): Sit | null {
    return upcomingSits
      .filter((s) => s.listingId === listingId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
  }

  // ── Full filter + sort pipeline ──────────────────────────────────────────────

  const filteredListings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const result = storedListings.filter((l) => {
      // 1. Location search
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        l.title.toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q) ||
        (l.country ?? '').toLowerCase().includes(q);

      // 2. Date range — listing must have a sit overlapping the requested window
      const matchesDates =
        !dateFrom ||
        upcomingSits.some(
          (s) =>
            s.listingId === l.id &&
            s.startDate <= (dateTo ?? '9999-12-31') &&
            s.endDate >= dateFrom,
        );

      // 3. Pet filter
      const petTypes: string[] = l.petTypes ? JSON.parse(l.petTypes) : [];
      const matchesPets =
        petFilters.length === 0 ||
        petFilters.some((pf) => {
          if (pf === 'no_pets') return petTypes.length === 0;
          return petTypes.some((pt) => pt.toLowerCase().includes(pf.toLowerCase()));
        });

      // 4. Sit duration — at least one open sit must meet the minimum
      const matchesDuration =
        minNights === 0 ||
        upcomingSits.some(
          (s) =>
            s.listingId === l.id &&
            nightsBetween(s.startDate, s.endDate) >= minNights,
        );

      // 5. Amenities — listing must have ALL requested amenities
      const amenities: string[] = l.amenities ? JSON.parse(l.amenities) : [];
      const matchesAmenities =
        amenityFilters.length === 0 ||
        amenityFilters.every((af) =>
          amenities.some((a) => a.toLowerCase().includes(af.toLowerCase())),
        );

      // 6. Map region (when active)
      const matchesRegion =
        !mapRegion ||
        (l.latitude  >= mapRegion.latitude  - mapRegion.latitudeDelta  / 2 &&
         l.latitude  <= mapRegion.latitude  + mapRegion.latitudeDelta  / 2 &&
         l.longitude >= mapRegion.longitude - mapRegion.longitudeDelta / 2 &&
         l.longitude <= mapRegion.longitude + mapRegion.longitudeDelta / 2);

      return matchesSearch && matchesDates && matchesPets && matchesDuration && matchesAmenities && matchesRegion;
    });

    // Sort
    if (sortBy === 'newest') {
      result.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    } else if (sortBy === 'start_date') {
      result.sort((a, b) => {
        const aNext = getNextSit(a.id);
        const bNext = getNextSit(b.id);
        if (!aNext && !bNext) return 0;
        if (!aNext) return 1;
        if (!bNext) return -1;
        return aNext.startDate.localeCompare(bNext.startDate);
      });
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedListings, upcomingSits, searchQuery, dateFrom, dateTo, petFilters, minNights, amenityFilters, mapRegion, sortBy]);

  // ── Active filter count (for badge) ──────────────────────────────────────────
  const activeFilterCount = [
    sortBy !== 'recommended',
    petFilters.length > 0,
    minNights > 0,
    amenityFilters.length > 0,
  ].filter(Boolean).length;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSearch(location: string, from: string | null, to: string | null) {
    setSearchQuery(location);
    setDateRange(from, to);
  }

  function handleApplyFilters(filters: FilterState) {
    setSortBy(filters.sortBy);
    setPetFilters(filters.petFilters);
    setMinNights(filters.minNights);
    setAmenityFilters(filters.amenityFilters);
  }

  function handleSearchThisArea() {
    setMapRegion(currentRegion);
    setMapMoved(false);
  }

  function handleClearMapRegion() {
    setMapRegion(WORLD_REGION);
    setMapMoved(false);
  }

  const datesLabel = getDatesLabel(dateFrom, dateTo);
  const locationLabel = searchQuery || 'Anywhere';
  const hasActiveSearch = !!searchQuery || !!dateFrom;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* ── Search bar + filter button ── */}
      <View style={styles.topRow}>
        <Pressable
          style={styles.searchPill}
          onPress={() => setSearchModalVisible(true)}
        >
          <View style={styles.searchIconWrap}>
            <Ionicons name="search" size={17} color={GrottoTokens.textPrimary} />
          </View>
          <View style={styles.searchTexts}>
            <Text style={styles.searchPrimary} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Text style={styles.searchSecondary} numberOfLines={1}>
              {datesLabel}
            </Text>
          </View>
          {hasActiveSearch && (
            <Pressable
              style={styles.searchClearBtn}
              onPress={() => { setSearchQuery(''); setDateRange(null, null); }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={GrottoTokens.textMuted} />
            </Pressable>
          )}
        </Pressable>

        <Pressable
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterSheetVisible(true)}
        >
          <Ionicons
            name="options-outline"
            size={19}
            color={activeFilterCount > 0 ? GrottoTokens.white : GrottoTokens.textPrimary}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Results count when filters active ── */}
      {(hasActiveSearch || activeFilterCount > 0) && (
        <View style={styles.resultsBanner}>
          <Text style={styles.resultsText}>
            {filteredListings.length} sit{filteredListings.length !== 1 ? 's' : ''} found
          </Text>
          <Pressable onPress={clearFilters} hitSlop={8}>
            <Text style={styles.resultsClear}>Clear all</Text>
          </Pressable>
        </View>
      )}

      {viewMode === 'list' ? (
        <FlatList
          data={filteredListings}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={(l: Listing) => router.push(`/listing/${l.id}`)}
              hasBadge={false}
              nextSit={getNextSit(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search" size={40} color={GrottoTokens.goldMuted} />
              <Text style={styles.emptyTitle}>No sits found</Text>
              <Text style={styles.emptyBody}>
                Try adjusting your search or filters to find more sits.
              </Text>
              <Pressable style={styles.emptyBtn} onPress={clearFilters}>
                <Text style={styles.emptyBtnText}>Clear filters</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={WORLD_REGION}
            onRegionChangeComplete={(region) => {
              setCurrentRegion(region);
              setMapMoved(true);
            }}
          >
            {filteredListings.map((listing) => (
              <Marker
                key={listing.id}
                coordinate={{ latitude: listing.latitude, longitude: listing.longitude }}
                onPress={() => router.push(`/listing/${listing.id}`)}
              >
                <MapClusterMarker count={1} />
              </Marker>
            ))}
          </MapView>

          {mapMoved && !mapRegion && (
            <Pressable style={styles.mapPill} onPress={handleSearchThisArea}>
              <Ionicons name="search" size={13} color={GrottoTokens.textPrimary} />
              <Text style={styles.mapPillText}>Search this area</Text>
            </Pressable>
          )}
          {mapRegion && (
            <Pressable style={[styles.mapPill, styles.mapPillActive]} onPress={handleClearMapRegion}>
              <Ionicons name="navigate" size={13} color={GrottoTokens.gold} />
              <Text style={[styles.mapPillText, styles.mapPillTextActive]}>
                {filteredListings.length} in this area · Clear
              </Text>
              <Ionicons name="close" size={13} color={GrottoTokens.gold} />
            </Pressable>
          )}
        </View>
      )}

      {/* Floating list/map toggle */}
      <Pressable
        style={styles.floatingToggle}
        onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
      >
        <Ionicons
          name={viewMode === 'list' ? 'map' : 'list'}
          size={16}
          color={GrottoTokens.white}
        />
        <Text style={styles.floatingToggleText}>
          {viewMode === 'list' ? 'Map' : 'List'}
        </Text>
      </Pressable>

      {/* ── Modals ── */}
      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        initialLocation={searchQuery}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        suggestions={locationSuggestions}
        onSearch={handleSearch}
      />

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        initialFilters={{ sortBy, petFilters, minNights, amenityFilters }}
        resultCount={filteredListings.length}
        onApply={handleApplyFilters}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },

  // ── Top search row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.sm,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    paddingVertical: 10,
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  searchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GrottoTokens.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTexts: {
    flex: 1,
  },
  searchPrimary: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    lineHeight: 18,
  },
  searchSecondary: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    lineHeight: 16,
  },
  searchClearBtn: {
    padding: 2,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: GrottoTokens.textPrimary,
    borderColor: GrottoTokens.textPrimary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: GrottoTokens.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GrottoTokens.white,
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 10,
    color: GrottoTokens.white,
  },

  // ── Results banner
  resultsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  resultsText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  resultsClear: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.gold,
    textDecorationLine: 'underline',
  },

  // ── Listing grid
  listContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.xxl,
    gap: Layout.spacing.md,
  },
  columnWrapper: {
    gap: Layout.spacing.md,
  },

  // ── Empty state
  empty: {
    alignItems: 'center',
    paddingTop: Layout.spacing.xxl,
    paddingHorizontal: Layout.spacing.xl,
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
    lineHeight: 21,
  },
  emptyBtn: {
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: Layout.spacing.xs,
  },
  emptyBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.white,
  },

  // ── Map
  mapContainer: {
    flex: 1,
  },
  mapPill: {
    position: 'absolute',
    top: Layout.spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  mapPillActive: {
    borderWidth: 1.5,
    borderColor: GrottoTokens.gold,
  },
  mapPillText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  mapPillTextActive: {
    color: GrottoTokens.gold,
  },

  // ── Floating toggle
  floatingToggle: {
    position: 'absolute',
    bottom: Layout.tabBarHeight + Layout.spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.textPrimary,
    borderRadius: Layout.radius.full,
    paddingVertical: 12,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingToggleText: {
    color: GrottoTokens.white,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
