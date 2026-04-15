import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { eq, desc } from 'drizzle-orm';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useSessionStore } from '@/store/session-store';
import { db } from '@/db/client';
import { testimonials } from '@/db/schema';
import type { Testimonial } from '@/db/schema';

const { width: SCREEN_W } = Dimensions.get('window');
// Initial estimate; overridden by onLayout to get the exact rendered width
const GALLERY_W_ESTIMATE = SCREEN_W - Layout.spacing.md * 2 - 2; // -2 for borderWidth
const GALLERY_ASPECT = 0.72;

const PET_LABEL: Record<string, string> = {
  dogs: 'Dogs',
  cats: 'Cats',
  birds: 'Birds',
  rabbits: 'Rabbits',
  fish: 'Fish',
  reptiles: 'Reptiles',
  'small-animals': 'Small animals',
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function memberSince(createdAt: string | null | undefined) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={14}
          color={GrottoTokens.gold}
        />
      ))}
    </View>
  );
}

export default function ViewProfileScreen() {
  const router = useRouter();
  const { currentUser } = useSessionStore();

  const [bioExpanded, setBioExpanded] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideW, setSlideW] = useState(GALLERY_W_ESTIMATE);
  const [publishedTestimonials, setPublishedTestimonials] = useState<Testimonial[]>([]);
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;
      db.select()
        .from(testimonials)
        .where(eq(testimonials.sitterId, currentUser.id))
        .orderBy(desc(testimonials.createdAt))
        .then((rows) => setPublishedTestimonials(rows.filter((t) => t.status === 'published')))
        .catch(console.error);
    }, [currentUser?.id])
  );

  function onGalleryLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSlideW(w);
  }

  if (!currentUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>No profile found.</Text>
      </View>
    );
  }

  const since = memberSince(currentUser.createdAt);
  const pets = parseJson<string[]>(currentUser.preferredPets, []);
  const galleryPhotos = parseJson<string[]>(currentUser.galleryPhotos, []);
  const hasRating = (currentUser.rating ?? 0) > 0 && (currentUser.reviewCount ?? 0) > 0;
  const bioTruncated = (currentUser.bio ?? '').length > 180;
  const whyTruncated = (currentUser.whyIWantToSit ?? '').length > 180;

  // Build slides: avatar first (if set), then gallery photos
  const slides: Array<{ key: string; uri: string | null; isAvatar: boolean }> = [];
  if (currentUser.avatarUrl) {
    slides.push({ key: 'avatar', uri: currentUser.avatarUrl, isAvatar: true });
  }
  galleryPhotos.forEach((uri, i) => slides.push({ key: `gallery-${i}`, uri, isAvatar: false }));
  const hasPhotos = slides.length > 0;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setActiveSlide(viewableItems[0].index);
      }
    },
  ).current;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Photo gallery / hero ── */}
      {hasPhotos ? (
        <View style={styles.galleryCard}>
          <FlatList
            ref={flatListRef}
            data={slides}
            keyExtractor={(item) => item.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={slideW}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            onLayout={onGalleryLayout}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            getItemLayout={(_, index) => ({
              length: slideW,
              offset: slideW * index,
              index,
            })}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.uri! }}
                style={{ width: slideW, height: Math.round(slideW * GALLERY_ASPECT) }}
                contentFit="cover"
              />
            )}
          />

          {/* Dot indicators */}
          {slides.length > 1 ? (
            <View style={styles.dotsRow}>
              {slides.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeSlide && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}

          {/* Photo count badge */}
          {slides.length > 1 ? (
            <View style={styles.countBadge}>
              <Ionicons name="images-outline" size={12} color={GrottoTokens.white} />
              <Text style={styles.countText}>{activeSlide + 1} / {slides.length}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Hero info card ── */}
      <View style={styles.heroCard}>
        {/* Avatar circle (only if no photo slides) */}
        {!hasPhotos ? (
          <View style={styles.avatarWrap}>
            <View style={styles.avatarFallback}>
              <Text style={styles.initials}>{getInitials(currentUser.name)}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.heroName}>{currentUser.name}</Text>

        {currentUser.location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={GrottoTokens.textMuted} />
            <Text style={styles.locationText}>{currentUser.location}</Text>
          </View>
        ) : null}

        {hasRating ? (
          <View style={styles.ratingRow}>
            <StarRating rating={currentUser.rating!} />
            <Text style={styles.ratingText}>
              {currentUser.rating!.toFixed(1)} · {currentUser.reviewCount} review{currentUser.reviewCount !== 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.verifiedRow}>
          <Ionicons name="checkmark-circle" size={16} color={GrottoTokens.success} />
          <Text style={styles.verifiedText}>Email verified</Text>
        </View>

        {since ? <Text style={styles.sinceText}>Member since {since}</Text> : null}
      </View>

      {/* ── Personal details ── */}
      {(currentUser.occupation || currentUser.location) ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal details</Text>
          {currentUser.occupation ? (
            <DetailRow icon="briefcase-outline" label="Occupation" value={currentUser.occupation} />
          ) : null}
          {currentUser.location ? (
            <DetailRow icon="location-outline" label="Lives in" value={currentUser.location} />
          ) : null}
          {since ? (
            <DetailRow icon="calendar-outline" label="Member since" value={since} />
          ) : null}
        </View>
      ) : null}

      {/* ── About me ── */}
      {currentUser.bio ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About me</Text>
          <Text style={styles.cardBody} numberOfLines={bioExpanded ? undefined : 5}>
            {currentUser.bio}
          </Text>
          {bioTruncated ? (
            <Pressable onPress={() => setBioExpanded((v) => !v)}>
              <Text style={styles.readMore}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── Why I want to sit (sitters only) ── */}
      {currentUser.role !== 'owner' && currentUser.whyIWantToSit ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Why I want to house sit</Text>
          <Text style={styles.cardBody} numberOfLines={whyExpanded ? undefined : 5}>
            {currentUser.whyIWantToSit}
          </Text>
          {whyTruncated ? (
            <Pressable onPress={() => setWhyExpanded((v) => !v)}>
              <Text style={styles.readMore}>{whyExpanded ? 'Show less' : 'Read more'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── Preferred pets (sitters only) ── */}
      {currentUser.role !== 'owner' && pets.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferred pets</Text>
          <View style={styles.petsWrap}>
            {pets.map((key) => (
              <View key={key} style={styles.petChip}>
                <Ionicons name="paw" size={13} color={GrottoTokens.gold} />
                <Text style={styles.petChipText}>{PET_LABEL[key] ?? key}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Empty state nudge ── */}
      {currentUser.role === 'owner'
        ? (!currentUser.bio && !currentUser.occupation ? (
          <View style={styles.emptyCard}>
            <Ionicons name="home-outline" size={32} color={GrottoTokens.goldMuted} />
            <Text style={styles.emptyTitle}>Your profile is bare</Text>
            <Text style={styles.emptyBody}>
              Add a bio and photos so sitters know who they'll be working with.
            </Text>
          </View>
        ) : null)
        : (!currentUser.bio && !currentUser.occupation && !currentUser.whyIWantToSit && pets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="person-add-outline" size={32} color={GrottoTokens.goldMuted} />
            <Text style={styles.emptyTitle}>Your profile is bare</Text>
            <Text style={styles.emptyBody}>
              Add a bio, photos, and more so owners know who they're welcoming into their home.
            </Text>
          </View>
        ) : null)
      }

      {/* ── Testimonials (sitters only) ── */}
      {currentUser.role !== 'owner' && publishedTestimonials.length > 0 ? (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.cardTitle}>Testimonials</Text>
            <Pressable onPress={() => router.push('/profile/testimonials')}>
              <Text style={styles.readMore}>Manage</Text>
            </Pressable>
          </View>
          {publishedTestimonials.map((t) => {
            const initials = t.ownerName
              .trim().split(' ').filter(Boolean)
              .map((p) => p[0]!).slice(0, 2).join('').toUpperCase();
            return (
              <View key={t.id} style={styles.testimonialItem}>
                <View style={styles.testimonialHeader}>
                  <View style={styles.testimonialAvatar}>
                    <Text style={styles.testimonialInitials}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.testimonialOwner}>{t.ownerName}</Text>
                    {t.sitDescription ? (
                      <Text style={styles.testimonialSitDesc}>{t.sitDescription}</Text>
                    ) : null}
                  </View>
                  {t.rating ? (
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons
                          key={i}
                          name={i <= t.rating! ? 'star' : 'star-outline'}
                          size={12}
                          color={GrottoTokens.gold}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
                {t.body ? (
                  <Text style={styles.testimonialBody}>"{t.body}"</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* ── Edit button ── */}
      <Pressable
        style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
        onPress={() => router.push('/profile/edit')}
      >
        <Ionicons name="create-outline" size={18} color={GrottoTokens.white} />
        <Text style={styles.editBtnText}>Edit profile</Text>
      </Pressable>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={GrottoTokens.textMuted} style={{ width: 22 }} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textMuted,
  },
  scroll: { flex: 1, backgroundColor: GrottoTokens.offWhite },
  content: {
    padding: Layout.spacing.md,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.xl,
    gap: Layout.spacing.md,
  },

  // ── Gallery ───────────────────────────────────────────────────────────────
  galleryCard: {
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    backgroundColor: GrottoTokens.surface,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    boxShadow: `0 8px 24px ${GrottoTokens.shadow}`,
    position: 'relative',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    width: 18,
    backgroundColor: GrottoTokens.white,
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Layout.radius.full,
  },
  countText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.white,
  },

  // ── Hero info card ────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    alignItems: 'center',
    gap: 8,
    boxShadow: `0 8px 24px ${GrottoTokens.shadow}`,
  },
  avatarWrap: { marginBottom: 4 },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.goldSubtle,
    borderWidth: 2.5,
    borderColor: GrottoTokens.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FontFamily.serifBold,
    fontSize: 36,
    color: GrottoTokens.gold,
    lineHeight: 42,
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
    gap: 8,
    marginTop: 2,
  },
  ratingText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBF7EF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Layout.radius.full,
    marginTop: 2,
  },
  verifiedText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.success,
  },
  sinceText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 2,
  },

  // ── Info cards ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.md,
    gap: Layout.spacing.md,
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  cardTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 18,
    color: GrottoTokens.textPrimary,
  },
  cardBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: GrottoTokens.textSecondary,
  },
  readMore: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.gold,
    marginTop: -4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  detailLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    width: 100,
  },
  detailValue: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    flex: 1,
  },

  // ── Pets ──────────────────────────────────────────────────────────────────
  petsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.goldMuted,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  petChipText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.xl,
    alignItems: 'center',
    gap: Layout.spacing.sm,
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  emptyTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  emptyBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: GrottoTokens.textSecondary,
    textAlign: 'center',
  },

  // ── Testimonial items ─────────────────────────────────────────────────────
  testimonialItem: {
    gap: Layout.spacing.sm,
    paddingTop: Layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
  },
  testimonialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  testimonialAvatar: {
    width: 36,
    height: 36,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testimonialInitials: {
    fontFamily: FontFamily.serifBold,
    fontSize: 13,
    color: GrottoTokens.gold,
  },
  testimonialOwner: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  testimonialSitDesc: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 1,
  },
  testimonialBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 21,
    fontStyle: 'italic',
  },

  // ── Edit button ───────────────────────────────────────────────────────────
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.textPrimary,
    borderRadius: Layout.radius.full,
    paddingVertical: 16,
    boxShadow: `0 8px 20px rgba(0,0,0,0.18)`,
  },
  editBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
