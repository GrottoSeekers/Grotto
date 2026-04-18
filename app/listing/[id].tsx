import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { eq } from 'drizzle-orm';
import MapView, { Circle, Marker } from 'react-native-maps';

import { db } from '@/db/client';
import { listings, sits, users } from '@/db/schema';
import type { Listing, Sit, User } from '@/db/schema';
import { SaveToListSheet } from '@/components/save-to-list-sheet';
import { ReviewsSheet } from '@/components/reviews-sheet';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useSessionStore } from '@/store/session-store';

interface PetDetail {
  name: string;
  breed?: string;
  age?: number;
  photoUrl?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 360;
const SHEET_OVERLAP = 28;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  );
}

const AMENITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  wifi: 'wifi-outline',
  pool: 'water-outline',
  gym: 'barbell-outline',
  parking: 'car-outline',
  garden: 'leaf-outline',
  kitchen: 'restaurant-outline',
  washer: 'shirt-outline',
  tv: 'tv-outline',
  'air conditioning': 'snow-outline',
  heating: 'flame-outline',
  workspace: 'desktop-outline',
  bbq: 'flame-outline',
  patio: 'home-outline',
  'hot tub': 'thermometer-outline',
  elevator: 'arrow-up-outline',
  fireplace: 'bonfire-outline',
};

function amenityIcon(name: string): keyof typeof Ionicons.glyphMap {
  return AMENITY_ICONS[name.toLowerCase()] ?? 'checkmark-circle-outline';
}

const PET_COLORS = [
  GrottoTokens.goldSubtle,
  '#EEF4F8',
  '#F0EEF8',
  '#EEF8F1',
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useSessionStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [openSits, setOpenSits] = useState<Sit[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);
  const [reviewsVisible, setReviewsVisible]     = useState(false);

  useEffect(() => {
    if (!id) return;
    const listingId = Number(id);
    const today = new Date().toISOString().slice(0, 10);

    db.select()
      .from(listings)
      .where(eq(listings.id, listingId))
      .then(async ([row]) => {
        if (!row) { setLoading(false); return; }
        setListing(row);

        const [ownerRows, sitRows] = await Promise.all([
          db.select().from(users).where(eq(users.id, row.ownerId)),
          db.select().from(sits).where(eq(sits.listingId, listingId)),
        ]);

        setOwner(ownerRows[0] ?? null);
        setOpenSits(
          sitRows
            .filter((s) => s.status === 'open' && s.startDate >= today)
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
        );
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
  const petDetails: PetDetail[] = listing.petPhotos ? JSON.parse(listing.petPhotos) : [];
  const amenities: string[] = listing.amenities ? JSON.parse(listing.amenities) : [];
  const extraPhotos: string[] = listing.photos ? JSON.parse(listing.photos) : [];

  // Carousel: cover → house photos → pet photos
  const petPhotoUrls = petDetails.filter((p) => p.photoUrl).map((p) => p.photoUrl!);
  const carouselPhotos = [
    ...(listing.coverPhotoUrl ? [listing.coverPhotoUrl] : []),
    ...extraPhotos,
    ...petPhotoUrls,
  ];

  const hasWifi = amenities.some((a) => a.toLowerCase() === 'wifi');
  const visibleAmenities = showAllAmenities ? amenities : amenities.slice(0, 5);

  const subtitleParts = [
    [listing.city, listing.country].filter(Boolean).join(', '),
    listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
    listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
  ].filter(Boolean);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCarouselIndex(idx);
  }

  const nextSit = openSits[0] ?? null;
  const isOwner = !!currentUser && currentUser.id === listing.ownerId;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Photo carousel ─────────────────────────────────── */}
        <View style={styles.carouselOuter}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
          >
            {carouselPhotos.length > 0 ? (
              carouselPhotos.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={styles.carouselImage}
                  contentFit="cover"
                  transition={200}
                />
              ))
            ) : (
              <View style={[styles.carouselImage, styles.carouselPlaceholder]}>
                <Ionicons name="home-outline" size={52} color={GrottoTokens.goldMuted} />
              </View>
            )}
          </ScrollView>

          {/* Nav: back + share + save */}
          <View style={[styles.carouselNav, { top: insets.top + 10 }]}>
            <Pressable
              style={styles.navBtn}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={18} color={GrottoTokens.textPrimary} />
            </Pressable>
            <View style={styles.navRight}>
              <Pressable
                style={styles.navBtn}
                hitSlop={8}
                onPress={() => {
                  const location = [listing.city, listing.country].filter(Boolean).join(', ');
                  Share.share({
                    title: listing.title,
                    message: location
                      ? `${listing.title} — ${location}\n\nFound on Grotto`
                      : `${listing.title}\n\nFound on Grotto`,
                  });
                }}
              >
                <Ionicons name="share-outline" size={18} color={GrottoTokens.textPrimary} />
              </Pressable>
              <Pressable
                style={styles.navBtn}
                hitSlop={8}
                onPress={() => setSaveSheetVisible(true)}
              >
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={18}
                  color={saved ? '#E34E6F' : GrottoTokens.textPrimary}
                />
              </Pressable>
            </View>
          </View>

          {/* Photo counter pill */}
          {carouselPhotos.length > 1 && (
            <View style={styles.photoPill}>
              <Text style={styles.photoPillText}>
                {carouselIndex + 1} / {carouselPhotos.length}
              </Text>
            </View>
          )}
        </View>

        {/* ── White sheet ────────────────────────────────────── */}
        <View style={styles.sheet}>

          {/* Title */}
          <Text style={styles.title}>{listing.title}</Text>

          {/* Subtitle: City · X bed · X bath */}
          {subtitleParts.length > 0 && (
            <Text style={styles.subtitle}>{subtitleParts.join(' · ')}</Text>
          )}

          {/* Rating — tappable opens reviews sheet */}
          {owner?.rating != null && owner.rating > 0 && (
            <Pressable
              style={styles.ratingRow}
              onPress={() => setReviewsVisible(true)}
              hitSlop={6}
            >
              <Ionicons name="star" size={13} color={GrottoTokens.gold} />
              <Text style={styles.ratingNum}>{owner.rating.toFixed(2)}</Text>
              {!!owner.reviewCount && (
                <Text style={styles.ratingReviews}>
                  · {owner.reviewCount} review{owner.reviewCount !== 1 ? 's' : ''}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={12} color={GrottoTokens.textMuted} />
            </Pressable>
          )}

          <View style={styles.divider} />

          {/* Owner quick row — navigates to owner profile */}
          {owner && (
            <>
              <Pressable
                style={({ pressed }) => [styles.ownerRow, pressed && styles.ownerRowPressed]}
                onPress={() => router.push(`/user/${owner.id}`)}
              >
                <View style={styles.ownerRowLeft}>
                  {owner.avatarUrl ? (
                    <Image
                      source={{ uri: owner.avatarUrl }}
                      style={styles.ownerRowAvatar}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={[styles.ownerRowAvatar, styles.ownerRowAvatarFallback]}>
                      <Ionicons name="person" size={20} color={GrottoTokens.goldMuted} />
                    </View>
                  )}
                  <View>
                    <Text style={styles.ownerRowTitle}>
                      Sit with {owner.name.split(' ')[0]}
                    </Text>
                    {owner.location && (
                      <Text style={styles.ownerRowSub}>Based in {owner.location}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={GrottoTokens.textMuted} />
              </Pressable>
              <View style={styles.divider} />
            </>
          )}

          {/* Highlights */}
          <View style={styles.highlights}>
            {petTypes.length > 0 && (
              <View style={styles.highlightRow}>
                <View style={styles.highlightIconBox}>
                  <Ionicons name="paw-outline" size={24} color={GrottoTokens.textPrimary} />
                </View>
                <View style={styles.highlightTexts}>
                  <Text style={styles.highlightTitle}>
                    {petTypes.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' & ')}
                  </Text>
                  <Text style={styles.highlightSub}>Pets you'll be caring for</Text>
                </View>
              </View>
            )}
            {listing.bedrooms != null && (
              <View style={styles.highlightRow}>
                <View style={styles.highlightIconBox}>
                  <Ionicons name="bed-outline" size={24} color={GrottoTokens.textPrimary} />
                </View>
                <View style={styles.highlightTexts}>
                  <Text style={styles.highlightTitle}>
                    {listing.bedrooms} bedroom{listing.bedrooms !== 1 ? 's' : ''} to yourself
                  </Text>
                  <Text style={styles.highlightSub}>Your own private space during the sit</Text>
                </View>
              </View>
            )}
            {hasWifi && (
              <View style={styles.highlightRow}>
                <View style={styles.highlightIconBox}>
                  <Ionicons name="wifi-outline" size={24} color={GrottoTokens.textPrimary} />
                </View>
                <View style={styles.highlightTexts}>
                  <Text style={styles.highlightTitle}>Wifi included</Text>
                  <Text style={styles.highlightSub}>Stay connected throughout</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Description */}
          {listing.description && (
            <>
              <Text
                style={styles.description}
                numberOfLines={descExpanded ? undefined : 4}
              >
                {listing.description}
              </Text>
              <Pressable
                style={styles.showMoreBtn}
                onPress={() => setDescExpanded((v) => !v)}
              >
                <Text style={styles.showMoreText}>
                  {descExpanded ? 'Show less' : 'Show more'}
                </Text>
                <Ionicons
                  name={descExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={GrottoTokens.textPrimary}
                />
              </Pressable>
              <View style={styles.divider} />
            </>
          )}

          {/* ── Pets ── */}
          {petTypes.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Meet the pets</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.petsRow}
                style={styles.petsScroll}
              >
                {petTypes.map((p, i) => {
                  const detail = petDetails[i];
                  return (
                    <View key={i} style={styles.petCard}>
                      <View style={[styles.petCircle, { backgroundColor: PET_COLORS[i % PET_COLORS.length] }]}>
                        {detail?.photoUrl ? (
                          <Image
                            source={{ uri: detail.photoUrl }}
                            style={styles.petPhoto}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <Ionicons name="paw" size={30} color={GrottoTokens.gold} />
                        )}
                      </View>
                      <Text style={styles.petName}>
                        {detail?.name ?? (p.charAt(0).toUpperCase() + p.slice(1))}
                      </Text>
                      <Text style={styles.petType}>
                        {detail?.breed
                          ? (detail.age ? `${detail.breed} · ${detail.age}yo` : detail.breed)
                          : (p.charAt(0).toUpperCase() + p.slice(1))}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
              <View style={styles.divider} />
            </>
          )}

          {/* ── Amenities ── */}
          {amenities.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>What this home offers</Text>
              <View style={styles.amenitiesList}>
                {visibleAmenities.map((a) => (
                  <View key={a} style={styles.amenityRow}>
                    <Ionicons name={amenityIcon(a)} size={22} color={GrottoTokens.textSecondary} style={styles.amenityRowIcon} />
                    <Text style={styles.amenityRowText}>
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </Text>
                  </View>
                ))}
              </View>
              {amenities.length > 5 && (
                <Pressable
                  style={styles.showAllBtn}
                  onPress={() => setShowAllAmenities((v) => !v)}
                >
                  <Text style={styles.showAllText}>
                    {showAllAmenities
                      ? 'Show less'
                      : `Show all ${amenities.length} amenities`}
                  </Text>
                </Pressable>
              )}
              <View style={styles.divider} />
            </>
          )}

          {/* ── Available dates ── */}
          {!isOwner && openSits.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Available dates</Text>
              <View style={styles.datesList}>
                {openSits.map((sit) => {
                  const nights = nightsBetween(sit.startDate, sit.endDate);
                  return (
                    <Pressable
                      key={sit.id}
                      style={({ pressed }) => [styles.dateCard, pressed && { opacity: 0.75 }]}
                      onPress={() => router.push(`/listing/apply/${listing.id}?sitId=${sit.id}`)}
                    >
                      <View style={styles.dateCardIcon}>
                        <Ionicons name="calendar-outline" size={20} color={GrottoTokens.gold} />
                      </View>
                      <View style={styles.dateCardBody}>
                        <Text style={styles.dateCardRange}>
                          {formatDate(sit.startDate)} – {formatDate(sit.endDate)}
                        </Text>
                        <Text style={styles.dateCardNights}>
                          {nights} night{nights !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={GrottoTokens.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.divider} />
            </>
          )}

          {/* ── Location ── */}
          <Text style={styles.sectionTitle}>Where you'll be</Text>
          <Text style={styles.locationSubtitle}>
            {[listing.city, listing.country].filter(Boolean).join(', ')}
          </Text>
          <View style={styles.mapBox}>
            <MapView
              style={StyleSheet.absoluteFill}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              initialRegion={{
                latitude: listing.latitude,
                longitude: listing.longitude,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
              }}
            >
              {/* Show a radius circle rather than exact pin for sitter privacy */}
              <Circle
                center={{ latitude: listing.latitude, longitude: listing.longitude }}
                radius={800}
                fillColor="rgba(201,168,76,0.15)"
                strokeColor={GrottoTokens.gold}
                strokeWidth={1.5}
              />
              <Marker
                coordinate={{ latitude: listing.latitude, longitude: listing.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.mapDot} />
              </Marker>
            </MapView>
          </View>
          <View style={styles.mapDisclaimer}>
            <Ionicons name="location-outline" size={13} color={GrottoTokens.textMuted} />
            <Text style={styles.mapDisclaimerText}>
              Approximate area shown. Exact address shared once a sit is confirmed.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* ── Meet your homeowner ── */}
          {owner && (
            <>
              <Text style={styles.sectionTitle}>Meet your homeowner</Text>
              <View style={styles.ownerCard}>
                {/* Avatar + name + stats */}
                <View style={styles.ownerCardHeader}>
                  <View style={styles.ownerCardAvatarWrap}>
                    {owner.avatarUrl ? (
                      <Image
                        source={{ uri: owner.avatarUrl }}
                        style={styles.ownerCardAvatar}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.ownerCardAvatar, styles.ownerCardAvatarFallback]}>
                        <Ionicons name="person" size={36} color={GrottoTokens.goldMuted} />
                      </View>
                    )}
                    <Text style={styles.ownerCardName}>{owner.name}</Text>
                    <Text style={styles.ownerCardRole}>Homeowner</Text>
                  </View>

                  <View style={styles.ownerCardStats}>
                    {!!owner.reviewCount && owner.reviewCount > 0 && (
                      <View style={styles.ownerStat}>
                        <Text style={styles.ownerStatNum}>{owner.reviewCount}</Text>
                        <Text style={styles.ownerStatLabel}>Reviews</Text>
                      </View>
                    )}
                    {owner.rating != null && owner.rating > 0 && (
                      <View style={[styles.ownerStat, styles.ownerStatBorder]}>
                        <Text style={styles.ownerStatNum}>{owner.rating.toFixed(1)} ★</Text>
                        <Text style={styles.ownerStatLabel}>Rating</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Detail bullets */}
                <View style={styles.ownerDetails}>
                  {owner.occupation && (
                    <View style={styles.ownerDetailRow}>
                      <Ionicons name="briefcase-outline" size={16} color={GrottoTokens.textSecondary} />
                      <Text style={styles.ownerDetailText}>{owner.occupation}</Text>
                    </View>
                  )}
                  {owner.location && (
                    <View style={styles.ownerDetailRow}>
                      <Ionicons name="location-outline" size={16} color={GrottoTokens.textSecondary} />
                      <Text style={styles.ownerDetailText}>Lives in {owner.location}</Text>
                    </View>
                  )}
                </View>

                {/* Bio */}
                {owner.bio && (
                  <Text style={styles.ownerBio}>{owner.bio}</Text>
                )}
              </View>
            </>
          )}

          {/* Bottom breathing room for sticky bar */}
          <View style={{ height: 110 }} />
        </View>
      </ScrollView>

      {/* ── Reviews sheet ───────────────────────────────────── */}
      {owner && (
        <ReviewsSheet
          visible={reviewsVisible}
          onClose={() => setReviewsVisible(false)}
          subjectId={owner.id}
          subjectName={owner.name}
          rating={owner.rating ?? 0}
          reviewCount={owner.reviewCount ?? 0}
        />
      )}

      {/* ── Save to list sheet ──────────────────────────────── */}
      <SaveToListSheet
        visible={saveSheetVisible}
        onClose={() => setSaveSheetVisible(false)}
        listingId={listing.id}
        listingTitle={listing.title}
        onSavedChange={(isSaved) => setSaved(isSaved)}
      />

      {/* ── Sticky bottom bar ────────────────────────────────── */}
      {isOwner ? (
        <SafeAreaView edges={['bottom']} style={styles.stickyBar}>
          <View style={styles.stickyInner}>
            <View style={styles.ownerBadgeRow}>
              <Ionicons name="home" size={16} color={GrottoTokens.gold} />
              <Text style={styles.ownerBadgeText}>Your listing</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.manageBtn, pressed && styles.ctaBtnPressed]}
              onPress={() => router.push(`/listing/manage/${listing.id}`)}
            >
              <Ionicons name="create-outline" size={16} color={GrottoTokens.textPrimary} />
              <Text style={styles.manageBtnText}>Manage</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : (
        <SafeAreaView edges={['bottom']} style={styles.stickyBar}>
          <View style={styles.stickyInner}>
            <View style={styles.stickyLeft}>
              {nextSit ? (
                <>
                  <Text style={styles.stickyLabel}>Next available</Text>
                  <Text style={styles.stickyDate}>{formatDate(nextSit.startDate)}</Text>
                </>
              ) : (
                <Text style={styles.stickyLabel}>Open to applications</Text>
              )}
            </View>
            <Pressable
              style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
              onPress={() => router.push(`/listing/apply/${listing.id}`)}
            >
              <Text style={styles.ctaText}>Apply to Sit</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GrottoTokens.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    // no padding — full bleed carousel
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

  // ── Carousel
  carouselOuter: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    overflow: 'hidden',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  carouselPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    zIndex: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  navRight: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  photoPill: {
    position: 'absolute',
    bottom: SHEET_OVERLAP + 12,
    right: Layout.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Layout.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoPillText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: GrottoTokens.white,
  },

  // ── White sheet
  sheet: {
    backgroundColor: GrottoTokens.white,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    marginTop: -SHEET_OVERLAP,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.lg,
  },
  title: {
    fontFamily: FontFamily.serifBold,
    fontSize: 24,
    color: GrottoTokens.textPrimary,
    lineHeight: 32,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    marginBottom: Layout.spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  ratingNum: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  ratingReviews: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: GrottoTokens.borderSubtle,
    marginVertical: Layout.spacing.lg,
  },

  // ── Owner quick row
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    flex: 1,
  },
  ownerRowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  ownerRowAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerRowTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  ownerRowSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    marginTop: 2,
  },
  ownerRowPressed: {
    opacity: 0.6,
  },

  // ── Highlights
  highlights: {
    gap: Layout.spacing.lg,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.md,
  },
  highlightIconBox: {
    width: 40,
    alignItems: 'center',
    paddingTop: 2,
  },
  highlightTexts: {
    flex: 1,
  },
  highlightTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    marginBottom: 2,
  },
  highlightSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    lineHeight: 19,
  },

  // ── Description
  description: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textSecondary,
    lineHeight: 24,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Layout.spacing.sm,
  },
  showMoreText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    textDecorationLine: 'underline',
  },

  // ── Pets
  sectionTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 20,
    color: GrottoTokens.textPrimary,
    marginBottom: Layout.spacing.md,
  },
  petsScroll: {
    marginHorizontal: -Layout.spacing.md,
  },
  petsRow: {
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.md,
    paddingBottom: 4,
  },
  petCard: {
    alignItems: 'center',
    gap: 6,
    width: 90,
  },
  petCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GrottoTokens.borderSubtle,
    overflow: 'hidden',
  },
  petPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  petName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    textAlign: 'center',
  },
  petType: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
  },

  // ── Amenities
  amenitiesList: {
    gap: Layout.spacing.md,
  },
  amenityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amenityRowIcon: {
    width: 36,
  },
  amenityRowText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    flex: 1,
  },
  showAllBtn: {
    marginTop: Layout.spacing.md,
    borderWidth: 1,
    borderColor: GrottoTokens.textPrimary,
    borderRadius: Layout.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  showAllText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },

  // ── Dates
  datesList: {
    gap: Layout.spacing.sm,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GrottoTokens.goldSubtle,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  dateCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  dateCardBody: {
    flex: 1,
  },
  dateCardRange: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  dateCardNights: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
    marginTop: 2,
  },

  // ── Location
  locationSubtitle: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    marginBottom: Layout.spacing.md,
  },
  mapBox: {
    height: 200,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    backgroundColor: GrottoTokens.surface,
  },

  // ── Owner card
  ownerCard: {
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    gap: Layout.spacing.md,
  },
  ownerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.md,
  },
  ownerCardAvatarWrap: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  ownerCardAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  ownerCardAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerCardName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
    textAlign: 'center',
  },
  ownerCardRole: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
  },
  ownerCardStats: {
    flex: 1,
    justifyContent: 'center',
    gap: Layout.spacing.md,
  },
  ownerStat: {
    gap: 2,
    paddingBottom: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  ownerStatBorder: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  ownerStatNum: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  ownerStatLabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  ownerDetails: {
    gap: Layout.spacing.sm,
  },
  ownerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  ownerDetailText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  ownerBio: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 22,
    paddingTop: Layout.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
  },

  // ── Sticky bar
  stickyBar: {
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  stickyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  stickyLeft: {
    flex: 1,
  },
  stickyLabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  stickyDate: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    marginTop: 2,
  },
  ctaBtn: {
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  ctaBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
    letterSpacing: 0.2,
  },

  // ── Owner bar
  ownerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    flex: 1,
  },
  ownerBadgeText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.gold,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    borderWidth: 1.5,
    borderColor: GrottoTokens.textPrimary,
    borderRadius: Layout.radius.full,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  manageBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },

  // ── Map
  mapDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GrottoTokens.gold,
    borderWidth: 2.5,
    borderColor: GrottoTokens.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  mapDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Layout.spacing.sm,
  },
  mapDisclaimerText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    flex: 1,
    lineHeight: 17,
  },
});
