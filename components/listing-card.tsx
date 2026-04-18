import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { BoostBadge } from '@/components/boost-badge';
import type { Listing, Sit } from '@/db/schema';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  );
}

interface ListingCardProps {
  listing: Listing;
  onPress: (listing: Listing) => void;
  hasBadge?: boolean;
  sits?: Sit[];
  // legacy — still accepted so callers that pass nextSit don't break
  nextSit?: { startDate: string; endDate: string } | null;
}

export function ListingCard({ listing, onPress, hasBadge = false, sits, nextSit }: ListingCardProps) {
  const petTypes: string[] = listing.petTypes ? JSON.parse(listing.petTypes) : [];

  // Prefer the new `sits` array; fall back to legacy `nextSit`
  const displaySits: { startDate: string; endDate: string }[] = sits && sits.length > 0
    ? sits
    : nextSit ? [nextSit] : [];

  const firstSit  = displaySits[0] ?? null;
  const extraCount = displaySits.length - 1;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(listing)}
    >
      {/* Photo */}
      <View style={styles.imageContainer}>
        {listing.coverPhotoUrl ? (
          <Image
            source={{ uri: listing.coverPhotoUrl }}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="home-outline" size={40} color={GrottoTokens.goldMuted} />
          </View>
        )}

        {hasBadge && (
          <View style={styles.badgeContainer}>
            <BoostBadge />
          </View>
        )}
      </View>

      {/* Info below image */}
      <View style={styles.info}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
          {petTypes.length > 0 && (
            <View style={styles.petsRow}>
              <Ionicons name="paw" size={13} color={GrottoTokens.textMuted} />
              <Text style={styles.petCount}>{petTypes.length}</Text>
            </View>
          )}
        </View>

        {/* Location + beds */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={GrottoTokens.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {[listing.city, listing.country].filter(Boolean).join(', ')}
          </Text>
          {listing.bedrooms != null && (
            <>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="bed-outline" size={13} color={GrottoTokens.textMuted} />
              <Text style={styles.metaText}>{listing.bedrooms} bed</Text>
            </>
          )}
        </View>

        {/* Dates — Airbnb style */}
        {firstSit ? (
          <View style={styles.datesSection}>
            <View style={styles.datesRow}>
              <Text style={styles.datesLabel}>
                {formatDate(firstSit.startDate)} – {formatDate(firstSit.endDate)}
              </Text>
              <Text style={styles.nightsLabel}>
                {nightsBetween(firstSit.startDate, firstSit.endDate)} nights
              </Text>
            </View>
            {extraCount > 0 && (
              <Text style={styles.moreDates}>+{extraCount} more date{extraCount > 1 ? 's' : ''} available</Text>
            )}
          </View>
        ) : (
          <View style={styles.noDatesRow}>
            <Text style={styles.noDatesText}>No upcoming dates</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
  pressed: {
    opacity: 0.93,
    transform: [{ scale: 0.985 }],
  },

  // ── Image
  imageContainer: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: GrottoTokens.goldSubtle,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: Layout.spacing.sm,
    right: Layout.spacing.sm,
  },

  // ── Info section
  info: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.spacing.sm,
  },
  title: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
    flex: 1,
  },
  petsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  petCount: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
  },
  dot: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
  },

  // ── Dates — Airbnb style
  datesSection: {
    marginTop: 4,
    gap: 3,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datesLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  nightsLabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  moreDates: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.gold,
    textDecorationLine: 'underline',
  },
  noDatesRow: {
    marginTop: 4,
  },
  noDatesText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
  },
});
