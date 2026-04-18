import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ListingCard } from '@/components/listing-card';
import { MapClusterMarker } from '@/components/map-cluster-marker';
import { SearchModal } from '@/components/search-modal';
import { FilterSheet } from '@/components/filter-sheet';
import type { FilterState } from '@/components/filter-sheet';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useDiscoveryStore } from '@/store/discovery-store';
import { eq } from 'drizzle-orm';
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
  // Suppress "Redo search" after programmatic camera moves (fly-to-search, user location)
  const isProgrammaticMove = useRef(false);
  // Track user location for auto-fly on first fix
  const userCoordRef  = useRef<{ latitude: number; longitude: number } | null>(null);
  const hasFlewToUser = useRef(false);
  // Fly-to queued while map is unmounted (list mode) — executed in onMapReady
  const onMapReadyFlyRef = useRef<Listing[] | null>(null);

  // Load listings + upcoming sits (re-runs on focus so new listings appear immediately)
  useFocusEffect(
    useCallback(() => {
      const today = new Date().toISOString().slice(0, 10);
      Promise.all([
        db.select().from(listings).where(eq(listings.listingStatus, 'active')),
        db.select().from(sits),
      ]).then(([listingRows, sitRows]) => {
        setListings(listingRows);
        setUpcomingSits(sitRows.filter((s) => s.status === 'open' && s.startDate >= today));
      }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );


  // Structured location suggestions for search modal
  const locationSuggestions = useMemo(() => {
    const countries = new Map<string, { label: string; sublabel: string; type: 'country' }>();
    const cities = new Map<string, { label: string; sublabel: string; type: 'city' }>();
    for (const l of storedListings) {
      if (l.country && !countries.has(l.country)) {
        countries.set(l.country, { label: l.country, sublabel: 'Country', type: 'country' });
      }
      if (l.city && !cities.has(l.city)) {
        cities.set(l.city, { label: l.city, sublabel: l.country ?? '', type: 'city' });
      }
    }
    const sortedCountries = [...countries.values()].sort((a, b) => a.label.localeCompare(b.label));
    const sortedCities = [...cities.values()].sort((a, b) => a.label.localeCompare(b.label));
    return [...sortedCountries, ...sortedCities];
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

  // ── Viewport-visible listings (for map count pill) ───────────────────────────
  const mapVisibleListings = useMemo(() => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = currentRegion;
    return filteredListings.filter(
      (l) =>
        l.latitude  >= latitude  - latitudeDelta  / 2 &&
        l.latitude  <= latitude  + latitudeDelta  / 2 &&
        l.longitude >= longitude - longitudeDelta / 2 &&
        l.longitude <= longitude + longitudeDelta / 2,
    );
  }, [filteredListings, currentRegion]);

  // ── Active filter count (for badge) ──────────────────────────────────────────
  const activeFilterCount = [
    sortBy !== 'recommended',
    petFilters.length > 0,
    minNights > 0,
    amenityFilters.length > 0,
  ].filter(Boolean).length;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // ── Fly map to a set of listings (reliable manual bounds calculation) ─────────
  function flyToListings(items: Listing[]) {
    if (!mapRef.current || items.length === 0) return;
    isProgrammaticMove.current = true;
    if (items.length === 1) {
      mapRef.current.animateToRegion(
        { latitude: items[0].latitude, longitude: items[0].longitude, latitudeDelta: 0.8, longitudeDelta: 0.8 },
        800,
      );
    } else {
      const lats = items.map((l) => l.latitude);
      const lngs = items.map((l) => l.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      mapRef.current.animateToRegion(
        {
          latitude:       (minLat + maxLat) / 2,
          longitude:      (minLng + maxLng) / 2,
          latitudeDelta:  Math.max((maxLat - minLat) * 1.6, 0.5),
          longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.5),
        },
        800,
      );
    }
  }

  function handleSearch(location: string, from: string | null, to: string | null) {
    setSearchQuery(location);
    setDateRange(from, to);
    setMapRegion(null);
    setMapMoved(false);

    if (!location.trim()) return;

    const q = location.toLowerCase();
    const matching = storedListings.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.city  ?? '').toLowerCase().includes(q) ||
        (l.country ?? '').toLowerCase().includes(q),
    );

    if (matching.length === 0) return;

    if (viewMode === 'map') {
      // Map is already mounted — fly directly
      flyToListings(matching);
    } else {
      // Switch to map; onMapReady will fire the fly once MapView has mounted
      onMapReadyFlyRef.current = matching;
      setViewMode('map');
    }
  }

  function handleApplyFilters(filters: FilterState) {
    setSortBy(filters.sortBy);
    setPetFilters(filters.petFilters);
    setMinNights(filters.minNights);
    setAmenityFilters(filters.amenityFilters);
  }

  // "Search this area" — pins the current viewport as the region filter so
  // filteredListings tightens to only what's visible; text search is preserved
  function handleRedoSearch() {
    setMapRegion(currentRegion);
    setMapMoved(false);
  }

  function handleClearMapRegion() {
    setMapRegion(null);
    setMapMoved(false);
  }

  function handleUserLocationChange(event: { nativeEvent: { coordinate?: { latitude: number; longitude: number } } }) {
    const coord = event.nativeEvent.coordinate;
    if (!coord) return;
    userCoordRef.current = { latitude: coord.latitude, longitude: coord.longitude };
    if (!hasFlewToUser.current && mapRef.current) {
      hasFlewToUser.current = true;
      isProgrammaticMove.current = true;
      mapRef.current.animateToRegion(
        { latitude: coord.latitude, longitude: coord.longitude, latitudeDelta: 1.5, longitudeDelta: 1.5 },
        800,
      );
    }
  }

  function handleLocateMe() {
    if (userCoordRef.current && mapRef.current) {
      isProgrammaticMove.current = true;
      mapRef.current.animateToRegion(
        { ...userCoordRef.current, latitudeDelta: 0.8, longitudeDelta: 0.8 },
        600,
      );
    }
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
            initialRegion={currentRegion}
            showsUserLocation
            showsMyLocationButton={false}
            onMapReady={() => {
              if (onMapReadyFlyRef.current) {
                const items = onMapReadyFlyRef.current;
                onMapReadyFlyRef.current = null;
                flyToListings(items);
              }
            }}
            onUserLocationChange={handleUserLocationChange}
            onRegionChangeComplete={(region) => {
              setCurrentRegion(region);
              if (isProgrammaticMove.current) {
                // Programmatic fly-to (search / locate me) — don't show redo pill
                isProgrammaticMove.current = false;
              } else {
                setMapMoved(true);
              }
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

          {/* Count pill — only counts what's visible in the current viewport */}
          <View style={styles.mapCountPill}>
            <Ionicons name="home-outline" size={13} color={GrottoTokens.textSecondary} />
            <Text style={styles.mapCountText}>
              {mapVisibleListings.length} sit{mapVisibleListings.length !== 1 ? 's' : ''} found
            </Text>
          </View>

          {/* "Redo search here" — appears after manual pan/zoom */}
          {mapMoved && (
            <Pressable style={styles.mapPill} onPress={handleRedoSearch}>
              <Ionicons name="search" size={13} color={GrottoTokens.white} />
              <Text style={styles.mapPillText}>Search this area</Text>
            </Pressable>
          )}

          {/* Locate me button */}
          <Pressable style={styles.locateBtn} onPress={handleLocateMe}>
            <Ionicons name="locate" size={20} color={GrottoTokens.textPrimary} />
          </Pressable>
        </View>
      )}

      {/* Floating list/map toggle */}
      <Pressable
        style={styles.floatingToggle}
        onPress={() => {
          const next = viewMode === 'list' ? 'map' : 'list';
          if (next === 'map') setMapMoved(false);
          setViewMode(next);
        }}
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
  mapCountPill: {
    position: 'absolute',
    top: Layout.spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  mapCountText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
  },
  mapPill: {
    position: 'absolute',
    bottom: Layout.tabBarHeight + 72,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    backgroundColor: GrottoTokens.textPrimary,
    borderRadius: Layout.radius.full,
    paddingVertical: 11,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  mapPillText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.white,
  },
  locateBtn: {
    position: 'absolute',
    bottom: Layout.tabBarHeight + Layout.spacing.md,
    right: Layout.spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
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
