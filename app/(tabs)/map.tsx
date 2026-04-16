import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
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
  const latMin = region.latitude - region.latitudeDelta / 2;
  const latMax = region.latitude + region.latitudeDelta / 2;
  const lngMin = region.longitude - region.longitudeDelta / 2;
  const lngMax = region.longitude + region.longitudeDelta / 2;
  return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
}

export default function MapScreen() {
  const router = useRouter();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentRegion, setCurrentRegion] = useState<Region>(WORLD_REGION);
  const [searchRegion, setSearchRegion] = useState<Region | null>(null);
  const [mapMoved, setMapMoved] = useState(false);

  useEffect(() => {
    db.select().from(listings).then(setAllListings).catch(console.error);
  }, []);

  const filtered = allListings.filter((l) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      l.title.toLowerCase().includes(q) ||
      (l.city ?? '').toLowerCase().includes(q) ||
      (l.country ?? '').toLowerCase().includes(q);

    const matchesRegion = !searchRegion || isInRegion(l.latitude, l.longitude, searchRegion);

    return matchesSearch && matchesRegion;
  });

  function handleSearchThisArea() {
    setSearchRegion(currentRegion);
    setMapMoved(false);
  }

  function handleClearArea() {
    setSearchRegion(null);
    setMapMoved(false);
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={WORLD_REGION}
        onRegionChangeComplete={(region) => {
          setCurrentRegion(region);
          setMapMoved(true);
        }}
      >
        {filtered.map((listing) => (
          <Marker
            key={listing.id}
            coordinate={{ latitude: listing.latitude, longitude: listing.longitude }}
            onPress={() => router.push(`/listing/${listing.id}`)}
          >
            <MapClusterMarker count={1} />
          </Marker>
        ))}
      </MapView>

      {/* Floating controls */}
      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <SearchPill
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />

        {/* Search this area — shown when map has been panned */}
        {mapMoved && !searchRegion && (
          <Pressable style={styles.pillButton} onPress={handleSearchThisArea}>
            <Ionicons name="search" size={14} color={GrottoTokens.textPrimary} />
            <Text style={styles.pillButtonText}>Search this area</Text>
          </Pressable>
        )}

        {/* Active region filter indicator */}
        {searchRegion && (
          <Pressable style={[styles.pillButton, styles.pillButtonActive]} onPress={handleClearArea}>
            <Ionicons name="navigate" size={14} color={GrottoTokens.gold} />
            <Text style={[styles.pillButtonText, styles.pillButtonTextActive]}>
              {filtered.length} listing{filtered.length !== 1 ? 's' : ''} in this area
            </Text>
            <Ionicons name="close" size={14} color={GrottoTokens.gold} />
          </Pressable>
        )}
      </SafeAreaView>
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
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: Layout.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  pillButtonActive: {
    borderWidth: 1.5,
    borderColor: GrottoTokens.gold,
  },
  pillButtonText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  pillButtonTextActive: {
    color: GrottoTokens.gold,
  },
});
