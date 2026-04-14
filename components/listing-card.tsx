import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { BoostBadge } from '@/components/boost-badge';
import type { Listing } from '@/db/schema';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ListingCardProps {
  listing: Listing;
  onPress: (listing: Listing) => void;
  hasBadge?: boolean;
}


export function ListingCard({ listing, onPress, hasBadge = false }: ListingCardProps) {
  const petTypes: string[] = listing.petTypes ? JSON.parse(listing.petTypes) : [];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(listing)}
    >
      {/* Photo */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: listing.coverPhotoUrl ?? undefined }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        {/* Gradient overlay */}
        <View style={styles.gradient} />

        {/* Top-right boost badge */}
        {hasBadge && (
          <View style={styles.badgeContainer}>
            <BoostBadge />
          </View>
        )}

        {/* Bottom info overlay */}
        <View style={styles.infoOverlay}>
          <Text style={styles.title} numberOfLines={1}>
            {listing.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.city} numberOfLines={1}>
              {listing.city}{listing.country ? `, ${listing.country}` : ''}
            </Text>
            {petTypes.length > 0 && (
              <View style={styles.petsRow}>
                <Ionicons name="paw" size={11} color={GrottoTokens.goldMuted} />
                <Text style={styles.petCount}>{petTypes.length}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    backgroundColor: GrottoTokens.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    aspectRatio: 3 / 4,
    width: '100%',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Layout.radius.lg,
  },
  badgeContainer: {
    position: 'absolute',
    top: Layout.spacing.sm,
    right: Layout.spacing.sm,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm,
    borderBottomLeftRadius: Layout.radius.lg,
    borderBottomRightRadius: Layout.radius.lg,
  },
  title: {
    color: GrottoTokens.white,
    fontSize: 13,
    fontFamily: FontFamily.serifBold,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  city: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontFamily: FontFamily.sansRegular,
    flex: 1,
  },
  petsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  petCount: {
    color: GrottoTokens.goldMuted,
    fontSize: 11,
    fontFamily: FontFamily.sansMedium,
  },
});
