import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { reviews } from '@/db/schema';
import type { Review } from '@/db/schema';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  subjectId: number;
  subjectName: string;
  rating: number;
  reviewCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={GrottoTokens.gold}
        />
      ))}
    </View>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewsSheet({
  visible,
  onClose,
  subjectId,
  subjectName,
  rating,
  reviewCount,
}: Props) {
  const [reviewList, setReviewList] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) loadReviews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function loadReviews() {
    setLoading(true);
    const rows = await db
      .select()
      .from(reviews)
      .where(eq(reviews.subjectId, subjectId));
    setReviewList(rows);
    setLoading(false);
  }

  // Distribution for the summary bar
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviewList.filter((r) => r.rating === star).length,
  }));
  const maxCount = Math.max(...dist.map((d) => d.count), 1);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Reviews</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={GrottoTokens.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ── Rating summary ── */}
            <View style={styles.summary}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryScore}>{rating.toFixed(1)}</Text>
                <StarRating rating={rating} size={18} />
                <Text style={styles.summaryCount}>
                  {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                </Text>
              </View>

              {!loading && reviewList.length > 0 && (
                <View style={styles.summaryBars}>
                  {dist.map(({ star, count }) => (
                    <View key={star} style={styles.barRow}>
                      <Text style={styles.barLabel}>{star}</Text>
                      <Ionicons name="star" size={10} color={GrottoTokens.gold} />
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${Math.round((count / maxCount) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* ── Review cards ── */}
            {loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Loading…</Text>
              </View>
            ) : reviewList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={36} color={GrottoTokens.goldMuted} />
                <Text style={styles.emptyTitle}>No reviews yet</Text>
                <Text style={styles.emptyText}>
                  {subjectName.split(' ')[0]} hasn't received any reviews on Grotto yet.
                </Text>
              </View>
            ) : (
              <View style={styles.reviewList}>
                {reviewList.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </View>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const initials = getInitials(review.authorName);

  return (
    <View style={styles.reviewCard}>
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
            <Text style={styles.reviewInitials}>{initials}</Text>
          )}
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewAuthor}>{review.authorName}</Text>
          {review.sitDescription && (
            <Text style={styles.reviewSitDesc}>{review.sitDescription}</Text>
          )}
        </View>
        <StarRating rating={review.rating} size={12} />
      </View>
      <Text style={styles.reviewBody}>{review.body}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: GrottoTokens.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: GrottoTokens.borderSubtle,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  closeBtn: {
    position: 'absolute',
    right: Layout.spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GrottoTokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.lg,
  },

  // ── Summary
  summary: {
    flexDirection: 'row',
    gap: Layout.spacing.xl,
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  summaryLeft: {
    alignItems: 'center',
    gap: 6,
    minWidth: 72,
  },
  summaryScore: {
    fontFamily: FontFamily.serifBold,
    fontSize: 44,
    color: GrottoTokens.textPrimary,
    lineHeight: 50,
  },
  summaryCount: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 2,
  },
  summaryBars: {
    flex: 1,
    gap: 5,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  barLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
    width: 10,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: GrottoTokens.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: GrottoTokens.gold,
  },
  barCount: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: GrottoTokens.textMuted,
    width: 16,
    textAlign: 'right',
  },

  divider: {
    height: 1,
    backgroundColor: GrottoTokens.borderSubtle,
    marginBottom: Layout.spacing.lg,
  },

  // ── Review list
  reviewList: {
    gap: Layout.spacing.lg,
  },
  reviewCard: {
    gap: Layout.spacing.sm,
    paddingBottom: Layout.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GrottoTokens.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reviewAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewInitials: {
    fontFamily: FontFamily.serifBold,
    fontSize: 14,
    color: GrottoTokens.gold,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewAuthor: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  reviewSitDesc: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 1,
  },
  reviewBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 22,
  },

  // ── Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.xl,
    gap: Layout.spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  emptyText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
