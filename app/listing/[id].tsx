import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { listings } from '@/db/schema';
import type { Listing } from '@/db/schema';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    db.select()
      .from(listings)
      .where(eq(listings.id, Number(id)))
      .then(([row]) => {
        setListing(row ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={GrottoTokens.gold} />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.loader}>
        <Text style={styles.notFound}>Listing not found.</Text>
      </View>
    );
  }

  const petTypes: string[] = listing.petTypes ? JSON.parse(listing.petTypes) : [];
  const amenities: string[] = listing.amenities ? JSON.parse(listing.amenities) : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero image */}
      <Image
        source={{ uri: listing.coverPhotoUrl ?? undefined }}
        style={styles.hero}
        contentFit="cover"
        transition={300}
      />

      {/* Details */}
      <View style={styles.body}>
        <Text style={styles.title}>{listing.title}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={GrottoTokens.gold} />
          <Text style={styles.location}>
            {[listing.city, listing.country].filter(Boolean).join(', ')}
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {listing.bedrooms != null && (
            <View style={styles.stat}>
              <Ionicons name="bed-outline" size={18} color={GrottoTokens.textSecondary} />
              <Text style={styles.statText}>{listing.bedrooms} bed</Text>
            </View>
          )}
          {listing.bathrooms != null && (
            <View style={styles.stat}>
              <Ionicons name="water-outline" size={18} color={GrottoTokens.textSecondary} />
              <Text style={styles.statText}>{listing.bathrooms} bath</Text>
            </View>
          )}
          {petTypes.length > 0 && (
            <View style={styles.stat}>
              <Ionicons name="paw-outline" size={18} color={GrottoTokens.textSecondary} />
              <Text style={styles.statText}>{petTypes.length} pet{petTypes.length > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Description */}
        {listing.description && (
          <>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </>
        )}

        {/* Amenities */}
        {amenities.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {amenities.map((a) => (
                <View key={a} style={styles.amenityTag}>
                  <Text style={styles.amenityText}>{a}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Pet types */}
        {petTypes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pets</Text>
            <View style={styles.petsRow}>
              {petTypes.map((p, i) => (
                <View key={i} style={styles.petTag}>
                  <Ionicons name="paw" size={13} color={GrottoTokens.gold} />
                  <Text style={styles.petText}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* CTA */}
      <SafeAreaView edges={['bottom']} style={styles.cta}>
        <Pressable style={styles.ctaButton}>
          <Text style={styles.ctaText}>Apply to Sit</Text>
        </Pressable>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.white,
  },
  content: {
    paddingBottom: Layout.spacing.xxl,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GrottoTokens.white,
  },
  notFound: {
    fontFamily: FontFamily.sansRegular,
    color: GrottoTokens.textMuted,
    fontSize: 15,
  },
  hero: {
    width: '100%',
    height: 300,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  body: {
    padding: Layout.spacing.md,
  },
  title: {
    fontFamily: FontFamily.serifBold,
    fontSize: 26,
    color: GrottoTokens.textPrimary,
    marginBottom: Layout.spacing.xs,
    lineHeight: 34,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    marginBottom: Layout.spacing.md,
  },
  location: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
  },
  statText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: GrottoTokens.borderSubtle,
    marginVertical: Layout.spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
    marginBottom: Layout.spacing.sm,
    marginTop: Layout.spacing.md,
  },
  description: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 22,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
  amenityTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: GrottoTokens.surface,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  amenityText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    textTransform: 'capitalize',
  },
  petsRow: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    flexWrap: 'wrap',
  },
  petTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    backgroundColor: GrottoTokens.goldSubtle,
    borderRadius: Layout.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  petText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.gold,
  },
  cta: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
  },
  ctaButton: {
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  ctaText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.white,
    letterSpacing: 0.3,
  },
});
