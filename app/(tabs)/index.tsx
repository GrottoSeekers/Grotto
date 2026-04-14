import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { SearchPill } from '@/components/search-pill';
import { ListingCard } from '@/components/listing-card';
import { MapClusterMarker } from '@/components/map-cluster-marker';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useDiscoveryStore } from '@/store/discovery-store';
import { db } from '@/db/client';
import { listings } from '@/db/schema';
import type { Listing } from '@/db/schema';

const FILTER_CHIPS = ['Dogs', 'Cats', 'Europe', 'UK', 'USA', 'Long stays'];

const WORLD_REGION: Region = {
  latitude: 30,
  longitude: 10,
  latitudeDelta: 80,
  longitudeDelta: 100,
};

export default function DiscoveryScreen() {
  const router = useRouter();
  const {
    viewMode,
    searchQuery,
    activeFilters,
    listings: storedListings,
    setViewMode,
    setSearchQuery,
    toggleFilter,
    setListings,
    setMapRegion,
  } = useDiscoveryStore();

  const [mapMoved, setMapMoved] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region>(WORLD_REGION);
  const mapRef = useRef<MapView>(null);

  // Load listings from DB
  useEffect(() => {
    db.select().from(listings).then((rows) => {
      setListings(rows);
    }).catch(console.error);
  // setListings is a stable Zustand action — intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter listings by search query and active filters
  const filteredListings = storedListings.filter((l) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      l.title.toLowerCase().includes(q) ||
      (l.city ?? '').toLowerCase().includes(q) ||
      (l.country ?? '').toLowerCase().includes(q);

    const matchesFilters =
      activeFilters.length === 0 ||
      activeFilters.some((f) => {
        const fl = f.toLowerCase();
        if (fl === 'dogs') return (l.petTypes ?? '').includes('dog');
        if (fl === 'cats') return (l.petTypes ?? '').includes('cat');
        if (fl === 'europe') return ['france', 'spain', 'greece', 'uk'].includes((l.country ?? '').toLowerCase());
        if (fl === 'uk') return (l.country ?? '').toLowerCase() === 'uk';
        if (fl === 'usa') return (l.country ?? '').toLowerCase() === 'usa';
        if (fl === 'long stays') return true;
        return true;
      });

    return matchesSearch && matchesFilters;
  });

  function handleListingPress(listing: Listing) {
    router.push(`/listing/${listing.id}`);
  }

  function handleSearchThisArea() {
    setMapRegion(currentRegion);
    setMapMoved(false);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Search bar */}
      <SearchPill
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
      />

      {viewMode === 'list' ? (
        <>
          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
            style={styles.chipsScroll}
          >
            {FILTER_CHIPS.map((chip) => {
              const active = activeFilters.includes(chip);
              return (
                <Pressable
                  key={chip}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleFilter(chip)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {chip}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Listing grid */}
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
                onPress={handleListingPress}
                hasBadge={false}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No listings found</Text>
              </View>
            }
          />
        </>
      ) : (
        // Map mode
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
                onPress={() => handleListingPress(listing)}
              >
                <MapClusterMarker count={1} />
              </Marker>
            ))}
          </MapView>

          {/* Search this area button */}
          {mapMoved && (
            <Pressable style={styles.searchAreaButton} onPress={handleSearchThisArea}>
              <Ionicons name="search" size={14} color={GrottoTokens.textPrimary} />
              <Text style={styles.searchAreaText}>Search this area</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Floating toggle button */}
      <Pressable
        style={styles.floatingButton}
        onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
      >
        <Ionicons
          name={viewMode === 'list' ? 'map' : 'list'}
          size={16}
          color={GrottoTokens.white}
        />
        <Text style={styles.floatingButtonText}>
          {viewMode === 'list' ? 'View Map' : 'View List'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  searchBar: {
    marginHorizontal: Layout.spacing.md,
    marginTop: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsContainer: {
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.sm,
    paddingBottom: Layout.spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.white,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  chipActive: {
    backgroundColor: GrottoTokens.gold,
    borderColor: GrottoTokens.gold,
  },
  chipText: {
    fontSize: 13,
    fontFamily: FontFamily.sansMedium,
    color: GrottoTokens.textSecondary,
  },
  chipTextActive: {
    color: GrottoTokens.white,
  },
  listContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.xxl,
    gap: Layout.spacing.md,
  },
  columnWrapper: {
    gap: Layout.spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Layout.spacing.xxl,
  },
  emptyText: {
    fontFamily: FontFamily.sansRegular,
    color: GrottoTokens.textMuted,
    fontSize: 15,
  },
  mapContainer: {
    flex: 1,
  },
  searchAreaButton: {
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
  searchAreaText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  floatingButton: {
    position: 'absolute',
    bottom: Layout.tabBarHeight + Layout.spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 12,
    paddingHorizontal: 22,
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingButtonText: {
    color: GrottoTokens.white,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
