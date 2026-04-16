import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { eq } from 'drizzle-orm';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '@/db/client';
import { listings, reviews, users } from '@/db/schema';
import type { Listing, Review, User } from '@/db/schema';
import { ReviewsSheet } from '@/components/reviews-sheet';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function memberSince(createdAt: string | null | undefined) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={15}
          color={GrottoTokens.gold}
        />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [user, setUser]           = useState<User | null>(null);
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [loading, setLoading]     = useState(true);
  const [reviewsVisible, setReviewsVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    const userId = Number(id);

    Promise.all([
      db.select().from(users).where(eq(users.id, userId)),
      db.select().from(listings).where(eq(listings.ownerId, userId)),
      db.select().from(reviews).where(eq(reviews.subjectId, userId)),
    ]).then(([userRows, listingRows, reviewRows]) => {
      setUser(userRows[0] ?? null);
      setUserListings(listingRows);
      setRecentReviews(reviewRows.slice(0, 3));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GrottoTokens.gold} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Profile not found.</Text>
      </View>
    );
  }

  const since          = memberSince(user.createdAt);
  const hasRating      = (user.rating ?? 0) > 0 && (user.reviewCount ?? 0) > 0;
  const petTypes: string[] = [];
  userListings.forEach((l) => {
    if (l.petTypes) {
      (JSON.parse(l.petTypes) as string[]).forEach((p) => {
        if (!petTypes.includes(p)) petTypes.push(p);
      });
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: GrottoTokens.offWhite }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Layout.spacing.xl }]}
      >
        {/* Back button */}
        <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={GrottoTokens.textPrimary} />
          </Pressable>
        </View>

        {/* ── Hero card ── */}
        <View style={styles.heroCard}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {user.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatarImg}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.initials}>{getInitials(user.name)}</Text>
              </View>
            )}
            <View style={[styles.roleBadge, user.role === 'sitter' && styles.roleBadgeSitter]}>
              <Text style={styles.roleBadgeText}>
                {user.role === 'sitter' ? 'S' : 'O'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroName}>{user.name}</Text>

          {user.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={GrottoTokens.textMuted} />
              <Text style={styles.locationText}>{user.location}</Text>
            </View>
          ) : null}

          {/* Rating — tappable */}
          {hasRating ? (
            <Pressable style={styles.ratingRow} onPress={() => setReviewsVisible(true)}>
              <StarRating rating={user.rating!} />
              <Text style={styles.ratingScore}>{user.rating!.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>
                · {user.reviewCount} review{user.reviewCount !== 1 ? 's' : ''}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={GrottoTokens.textMuted} />
            </Pressable>
          ) : null}

          {/* Verified / member since */}
          <View style={styles.badgeRow}>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={GrottoTokens.success} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
            {since ? (
              <View style={styles.sinceBadge}>
                <Ionicons name="time-outline" size={13} color={GrottoTokens.textMuted} />
                <Text style={styles.sinceText}>Since {since}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── About ── */}
        {(user.bio || user.occupation) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            {user.occupation ? (
              <View style={styles.detailRow}>
                <Ionicons name="briefcase-outline" size={17} color={GrottoTokens.textSecondary} style={styles.detailIcon} />
                <Text style={styles.detailText}>{user.occupation}</Text>
              </View>
            ) : null}
            {user.bio ? (
              <Text style={styles.bioText}>{user.bio}</Text>
            ) : null}
          </View>
        ) : null}

        {/* ── Listings ── */}
        {userListings.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {userListings.length === 1 ? 'Their home' : `Their homes (${userListings.length})`}
            </Text>
            {userListings.map((listing) => {
              const pets: string[] = listing.petTypes ? JSON.parse(listing.petTypes) : [];
              return (
                <Pressable
                  key={listing.id}
                  style={({ pressed }) => [styles.listingRow, pressed && styles.pressed]}
                  onPress={() => router.push(`/listing/${listing.id}`)}
                >
                  {listing.coverPhotoUrl ? (
                    <Image
                      source={{ uri: listing.coverPhotoUrl }}
                      style={styles.listingThumb}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={[styles.listingThumb, styles.listingThumbFallback]}>
                      <Ionicons name="home-outline" size={18} color={GrottoTokens.goldMuted} />
                    </View>
                  )}
                  <View style={styles.listingInfo}>
                    <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
                    <Text style={styles.listingLocation} numberOfLines={1}>
                      {[listing.city, listing.country].filter(Boolean).join(', ')}
                    </Text>
                    <View style={styles.listingMeta}>
                      {listing.bedrooms != null && (
                        <View style={styles.metaItem}>
                          <Ionicons name="bed-outline" size={12} color={GrottoTokens.textMuted} />
                          <Text style={styles.metaText}>{listing.bedrooms} bed</Text>
                        </View>
                      )}
                      {pets.length > 0 && (
                        <View style={styles.metaItem}>
                          <Ionicons name="paw-outline" size={12} color={GrottoTokens.textMuted} />
                          <Text style={styles.metaText}>{pets.length} pet{pets.length !== 1 ? 's' : ''}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={GrottoTokens.textMuted} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* ── Recent reviews ── */}
        {recentReviews.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Recent reviews</Text>
              {(user.reviewCount ?? 0) > 3 ? (
                <Pressable onPress={() => setReviewsVisible(true)}>
                  <Text style={styles.seeAll}>See all {user.reviewCount}</Text>
                </Pressable>
              ) : null}
            </View>
            {recentReviews.map((review, i) => (
              <View
                key={review.id}
                style={[styles.reviewItem, i > 0 && styles.reviewItemBorder]}
              >
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    {review.authorAvatarUrl ? (
                      <Image
                        source={{ uri: review.authorAvatarUrl }}
                        style={styles.reviewAvatarImg}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <Text style={styles.reviewInitials}>
                        {getInitials(review.authorName)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewAuthor}>{review.authorName}</Text>
                    {review.sitDescription ? (
                      <Text style={styles.reviewSitDesc}>{review.sitDescription}</Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= review.rating ? 'star' : 'star-outline'}
                        size={12}
                        color={GrottoTokens.gold}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewBody} numberOfLines={3}>{review.body}</Text>
              </View>
            ))}

            {(user.reviewCount ?? 0) > 3 ? (
              <Pressable style={styles.seeAllBtn} onPress={() => setReviewsVisible(true)}>
                <Text style={styles.seeAllBtnText}>
                  See all {user.reviewCount} reviews
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Reviews sheet */}
      {user && (
        <ReviewsSheet
          visible={reviewsVisible}
          onClose={() => setReviewsVisible(false)}
          subjectId={user.id}
          subjectName={user.name}
          rating={user.rating ?? 0}
          reviewCount={user.reviewCount ?? 0}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.offWhite,
  },
  notFound: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textMuted,
  },
  scrollContent: {
    gap: Layout.spacing.md,
  },

  // ── Nav bar
  navBar: {
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Hero card
  heroCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    marginHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: GrottoTokens.goldMuted,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: GrottoTokens.goldSubtle,
    borderWidth: 2.5,
    borderColor: GrottoTokens.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FontFamily.serifBold,
    fontSize: 34,
    color: GrottoTokens.gold,
    lineHeight: 40,
  },
  roleBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: GrottoTokens.gold,
    borderWidth: 2,
    borderColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeSitter: {
    backgroundColor: GrottoTokens.textPrimary,
  },
  roleBadgeText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 11,
    color: GrottoTokens.white,
  },
  heroName: {
    fontFamily: FontFamily.serifBold,
    fontSize: 26,
    color: GrottoTokens.textPrimary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GrottoTokens.goldSubtle,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Layout.radius.full,
    borderWidth: 1,
    borderColor: GrottoTokens.goldMuted,
  },
  ratingScore: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  ratingCount: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    textDecorationLine: 'underline',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EBF7EF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Layout.radius.full,
  },
  verifiedText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.success,
  },
  sinceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GrottoTokens.surface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Layout.radius.full,
  },
  sinceText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },

  // ── Cards
  card: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    marginHorizontal: Layout.spacing.md,
    padding: Layout.spacing.md,
    gap: Layout.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 18,
    color: GrottoTokens.textPrimary,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.gold,
    textDecorationLine: 'underline',
  },

  // ── About / bio
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  detailIcon: {
    width: 22,
  },
  detailText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    flex: 1,
  },
  bioText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 22,
  },

  // ── Listings
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    paddingVertical: 4,
  },
  listingThumb: {
    width: 60,
    height: 60,
    borderRadius: Layout.radius.md,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  listingThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: {
    flex: 1,
    gap: 3,
  },
  listingTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  listingLocation: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  listingMeta: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },

  // ── Reviews
  reviewItem: {
    gap: Layout.spacing.sm,
  },
  reviewItemBorder: {
    paddingTop: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reviewAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewInitials: {
    fontFamily: FontFamily.serifBold,
    fontSize: 12,
    color: GrottoTokens.gold,
  },
  reviewAuthor: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  reviewSitDesc: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: GrottoTokens.textMuted,
    marginTop: 1,
  },
  reviewBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    lineHeight: 20,
  },
  seeAllBtn: {
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Layout.spacing.xs,
  },
  seeAllBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },

  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
