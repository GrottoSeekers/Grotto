import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { SearchPill } from '@/components/search-pill';
import { MapClusterMarker } from '@/components/map-cluster-marker';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { db } from '@/db/client';
import { listings } from '@/db/schema';
import type { Listing } from '@/db/schema';

const WORLD_REGION: Region = {
  latitude: 30,
  longitude: 10,
  latitudeDelta: 80,
  longitudeDelta: 100,
};

function isInRegion(lat: number, lng: number, region: Region): boolean {
  return (
    lat >= region.latitude  - region.latitudeDelta  / 2 &&
    lat <= region.latitude  + region.latitudeDelta  / 2 &&
    lng >= region.longitude - region.longitudeDelta / 2 &&
    lng <= region.longitude + region.longitudeDelta / 2
  );
}

export default function MapScreen() {
  const router = useRouter();
  const [allListings, setAllListings]         = useState<Listing[]>([]);
  const [searchQuery, setSearchQuery]         = useState('');
  const [currentRegion, setCurrentRegion]     = useState<Region>(WORLD_REGION);
  const [searchRegion, setSearchRegion]       = useState<Region | null>(null);
  const [mapMoved, setMapMoved]               = useState(false);

  const mapRef              = useRef<MapView>(null);
  const isProgrammaticMove  = useRef(false);
  const userCoordRef        = useRef<{ latitude: number; longitude: number } | null>(null);
  const hasFlewToUser       = useRef(false);

  useFocusEffect(
    useCallback(() => {
      db.select().from(listings).then(setAllListings).catch(console.error);
    }, [])
  );

  // ── Filter pipeline ───────────────────────────────────────────────────────────

  const filteredListings = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return allListings.filter((l) => {
      const matchesSearch =
        !q ||
        l.title.toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q) ||
        (l.country ?? '').toLowerCase().includes(q);

      const matchesRegion =
        !searchRegion || isInRegion(l.latitude, l.longitude, searchRegion);

      return matchesSearch && matchesRegion;
    });
  }, [allListings, searchQuery, searchRegion]);

  // Viewport-visible count (for the count pill)
  const mapVisibleListings = useMemo(
    () => allListings.filter((l) => isInRegion(l.latitude, l.longitude, currentRegion)),
    [allListings, currentRegion],
  );

  // ── Fly helpers ───────────────────────────────────────────────────────────────

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
      mapRef.current.animateToRegion(
        {
          latitude:       (Math.min(...lats) + Math.max(...lats)) / 2,
          longitude:      (Math.min(...lngs) + Math.max(...lngs)) / 2,
          latitudeDelta:  Math.max((Math.max(...lats) - Math.min(...lats)) * 1.6, 0.5),
          longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.6, 0.5),
        },
        800,
      );
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSearch(text: string) {
    setSearchQuery(text);
    setSearchRegion(null);
    setMapMoved(false);
    if (!text.trim()) return;
    const q = text.toLowerCase();
    const matching = allListings.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.city  ?? '').toLowerCase().includes(q) ||
        (l.country ?? '').toLowerCase().includes(q),
    );
    if (matching.length > 0) flyToListings(matching);
  }

  function handleSearchThisArea() {
    setSearchRegion(currentRegion);
    setMapMoved(false);
  }

  function handleClearArea() {
    setSearchRegion(null);
    setMapMoved(false);
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={WORLD_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        onUserLocationChange={handleUserLocationChange}
        onRegionChangeComplete={(region) => {
          setCurrentRegion(region);
          if (isProgrammaticMove.current) {
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

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        {/* Search bar */}
        <SearchPill
          value={searchQuery}
          onChangeText={handleSearch}
          style={styles.searchBar}
        />

        {/* Viewport count pill */}
        <View style={styles.countPill} pointerEvents="none">
          <Ionicons name="home-outline" size={13} color={GrottoTokens.textSecondary} />
          <Text style={styles.countPillText}>
            {mapVisibleListings.length} sit{mapVisibleListings.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      </SafeAreaView>

      {/* "Search this area" — appears after manual pan */}
      {mapMoved && !searchRegion && (
        <Pressable style={styles.searchAreaPill} onPress={handleSearchThisArea}>
          <Ionicons name="search" size={13} color={GrottoTokens.white} />
          <Text style={styles.searchAreaPillText}>Search this area</Text>
        </Pressable>
      )}

      {/* Active region indicator — tap to clear */}
      {searchRegion && (
        <Pressable style={styles.activeRegionPill} onPress={handleClearArea}>
          <Ionicons name="navigate" size={13} color={GrottoTokens.gold} />
          <Text style={styles.activeRegionText}>
            {filteredListings.length} sit{filteredListings.length !== 1 ? 's' : ''} in this area
          </Text>
          <Ionicons name="close" size={13} color={GrottoTokens.gold} />
        </Pressable>
      )}

      {/* Locate me button */}
      <Pressable style={styles.locateBtn} onPress={handleLocateMe}>
        <Ionicons name="locate" size={20} color={GrottoTokens.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  searchBar: {
    marginHorizontal: Layout.spacing.md,
    marginTop: Layout.spacing.sm,
    width: '90%',
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: Layout.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  countPillText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
  },
  searchAreaPill: {
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
  searchAreaPillText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.white,
  },
  activeRegionPill: {
    position: 'absolute',
    bottom: Layout.tabBarHeight + 72,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: GrottoTokens.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  activeRegionText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.gold,
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
});
