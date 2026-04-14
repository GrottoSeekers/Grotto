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

export default function MapScreen() {
  const router = useRouter();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapMoved, setMapMoved] = useState(false);

  useEffect(() => {
    db.select().from(listings).then(setAllListings).catch(console.error);
  }, []);

  const filtered = allListings.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      l.title.toLowerCase().includes(q) ||
      (l.city ?? '').toLowerCase().includes(q) ||
      (l.country ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      <MapView

        style={StyleSheet.absoluteFill}
        initialRegion={WORLD_REGION}
        onRegionChangeComplete={() => setMapMoved(true)}
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

      {/* Floating search bar */}
      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <SearchPill
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />

        {mapMoved && (
          <Pressable style={styles.searchAreaButton} onPress={() => setMapMoved(false)}>
            <Ionicons name="search" size={14} color={GrottoTokens.textPrimary} />
            <Text style={styles.searchAreaText}>Search this area</Text>
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
  searchAreaButton: {
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
  searchAreaText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
});
