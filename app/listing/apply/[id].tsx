import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { eq } from 'drizzle-orm';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { notifyNewApplication } from '@/lib/notifications';
import { db } from '@/db/client';
import { listings, sits, users, applications, chatMessages } from '@/db/schema';
import type { Listing, Sit, User } from '@/db/schema';
import { useSessionStore } from '@/store/session-store';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ApplyScreen() {
  const { id, sitId } = useLocalSearchParams<{ id: string; sitId?: string }>();
  const router = useRouter();
  const { currentUser } = useSessionStore();

  // If a specific sit was tapped, skip straight to step 2
  const initialStep: 1 | 2 | 3 = sitId ? 2 : 1;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [openSits, setOpenSits] = useState<Sit[]>([]);
  const [selectedSit, setSelectedSit] = useState<Sit | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
        const upcoming = sitRows
          .filter(s => s.status === 'open' && s.startDate >= today)
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        setOpenSits(upcoming);

        // Pre-select: either the tapped sit, or the only available one
        if (sitId) {
          const pre = upcoming.find(s => s.id === Number(sitId));
          if (pre) setSelectedSit(pre);
        } else if (upcoming.length === 1) {
          setSelectedSit(upcoming[0]);
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSubmit() {
    if (!currentUser || !selectedSit || !listing || submitting) return;
    setSubmitting(true);
    try {
      const [app] = await db.insert(applications).values({
        sitId: selectedSit.id,
        listingId: listing.id,
        sitterId: currentUser.id,
        message: message.trim() || null,
        status: 'pending',
      }).returning();

      // Seed the first chat message from the application's intro text
      if (app && message.trim()) {
        await db.insert(chatMessages).values({
          applicationId: app.id,
          senderId: currentUser.id,
          body: message.trim(),
        });
      }

      // Notify the owner (fires as a device notification)
      await notifyNewApplication(listing.title, currentUser.name);
      setStep(4);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / not found ────────────────────────────────────────────────────

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

  // ── Step 4: Success ────────────────────────────────────────────────────────

  if (step === 4) {
    const nights = selectedSit ? nightsBetween(selectedSit.startDate, selectedSit.endDate) : 0;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={80} color={GrottoTokens.gold} />
          </View>
          <Text style={styles.successTitle}>Application sent!</Text>
          <Text style={styles.successBody}>
            {owner?.name.split(' ')[0] ?? 'The owner'} will review your application and be in touch.
          </Text>

          {selectedSit && (
            <View style={styles.successCard}>
              {listing.coverPhotoUrl ? (
                <Image
                  source={{ uri: listing.coverPhotoUrl }}
                  style={styles.successThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.successThumb, styles.successThumbFallback]}>
                  <Ionicons name="home-outline" size={20} color={GrottoTokens.goldMuted} />
                </View>
              )}
              <View style={styles.successCardBody}>
                <Text style={styles.successCardTitle} numberOfLines={1}>{listing.title}</Text>
                <Text style={styles.successCardDates}>
                  {formatDate(selectedSit.startDate)} – {formatDate(selectedSit.endDate)}
                </Text>
                <Text style={styles.successCardNights}>
                  {nights} night{nights !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          <Pressable
            style={styles.successPrimaryBtn}
            onPress={() => router.replace('/(tabs)/messages')}
          >
            <Text style={styles.successPrimaryText}>View my activity</Text>
          </Pressable>
          <Pressable
            style={styles.successSecondaryBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.successSecondaryText}>Back to listing</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Steps 1–3 ──────────────────────────────────────────────────────────────

  const ownerFirstName = owner?.name.split(' ')[0] ?? 'the owner';
  const nights = selectedSit ? nightsBetween(selectedSit.startDate, selectedSit.endDate) : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: GrottoTokens.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3);
              else router.back();
            }}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={GrottoTokens.textPrimary} />
          </Pressable>

          {/* Progress dots */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={[styles.dot, step >= s && styles.dotActive]} />
            ))}
          </View>

          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
        >

          {/* ── Step 1: Choose a date ── */}
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>When would you{'\n'}like to sit?</Text>
              <Text style={styles.stepSub}>
                {listing.title}{listing.city ? `  ·  ${listing.city}` : ''}
              </Text>

              {openSits.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="calendar-outline" size={36} color={GrottoTokens.goldMuted} />
                  <Text style={styles.emptyText}>No open dates available right now</Text>
                </View>
              ) : (
                <View style={styles.sitList}>
                  {openSits.map((sit) => {
                    const n = nightsBetween(sit.startDate, sit.endDate);
                    const selected = selectedSit?.id === sit.id;
                    return (
                      <Pressable
                        key={sit.id}
                        style={[styles.sitOption, selected && styles.sitOptionSelected]}
                        onPress={() => setSelectedSit(sit)}
                      >
                        <View style={[styles.radio, selected && styles.radioSelected]}>
                          {selected && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sitDates, selected && styles.sitDatesSelected]}>
                            {formatDate(sit.startDate)} – {formatDate(sit.endDate)}
                          </Text>
                          <Text style={styles.sitNights}>
                            {n} night{n !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        {selected && (
                          <Ionicons name="checkmark-circle" size={20} color={GrottoTokens.gold} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* ── Step 2: Your message ── */}
          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Introduce{'\n'}yourself</Text>
              <Text style={styles.stepSub}>
                Tell {ownerFirstName} why you'd be a great sitter
              </Text>

              {selectedSit && (
                <View style={styles.dateBadge}>
                  <Ionicons name="calendar-outline" size={14} color={GrottoTokens.gold} />
                  <Text style={styles.dateBadgeText}>
                    {formatDate(selectedSit.startDate)} – {formatDate(selectedSit.endDate)}
                    {'  ·  '}{nights} night{nights !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}

              <TextInput
                style={styles.messageInput}
                placeholder={`Hi ${ownerFirstName},\n\nI'd love to sit for you…`}
                placeholderTextColor={GrottoTokens.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
                maxLength={600}
                autoFocus
              />
              <Text style={styles.charCount}>{message.length} / 600</Text>

              <View style={styles.tipBox}>
                <Ionicons name="bulb-outline" size={15} color={GrottoTokens.gold} />
                <Text style={styles.tipText}>
                  Owners love hearing about your experience with pets and why this sit appeals to you.
                </Text>
              </View>
            </>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Review your{'\n'}application</Text>
              <Text style={styles.stepSub}>Check everything looks right before submitting</Text>

              {/* Property card */}
              <View style={styles.reviewCard}>
                {listing.coverPhotoUrl ? (
                  <Image
                    source={{ uri: listing.coverPhotoUrl }}
                    style={styles.reviewThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.reviewThumb, styles.reviewThumbFallback]}>
                    <Ionicons name="home-outline" size={26} color={GrottoTokens.goldMuted} />
                  </View>
                )}
                <View style={styles.reviewCardBody}>
                  <Text style={styles.reviewCardTitle} numberOfLines={2}>{listing.title}</Text>
                  {listing.city && (
                    <Text style={styles.reviewCardMeta}>
                      {[listing.city, listing.country].filter(Boolean).join(', ')}
                    </Text>
                  )}
                  {selectedSit && (
                    <Text style={styles.reviewCardMeta}>
                      {formatDate(selectedSit.startDate)} – {formatDate(selectedSit.endDate)}
                    </Text>
                  )}
                  <Text style={styles.reviewCardNights}>
                    {nights} night{nights !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {/* Message */}
              <View style={styles.reviewSection}>
                <View style={styles.reviewSectionHead}>
                  <Text style={styles.reviewSectionLabel}>Your message</Text>
                  <Pressable onPress={() => setStep(2)} hitSlop={8}>
                    <Text style={styles.editLink}>Edit</Text>
                  </Pressable>
                </View>
                <Text style={message.trim() ? styles.reviewMessage : styles.reviewMessageEmpty}>
                  {message.trim() || 'No message added'}
                </Text>
              </View>

              {/* Sitter profile */}
              {currentUser && (
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionLabel}>Applying as</Text>
                  <View style={styles.reviewProfile}>
                    {currentUser.avatarUrl ? (
                      <Image
                        source={{ uri: currentUser.avatarUrl }}
                        style={styles.reviewAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.reviewAvatar, styles.reviewAvatarFallback]}>
                        <Ionicons name="person" size={18} color={GrottoTokens.goldMuted} />
                      </View>
                    )}
                    <View>
                      <Text style={styles.reviewProfileName}>{currentUser.name}</Text>
                      {currentUser.location && (
                        <Text style={styles.reviewProfileSub}>{currentUser.location}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              <Text style={styles.disclaimer}>
                By submitting you confirm the details are accurate. The owner will review and contact you through Grotto.
              </Text>
            </>
          )}

        </ScrollView>

        {/* ── Sticky footer ── */}
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {step === 1 && (
            <Pressable
              style={[styles.footerBtn, !selectedSit && styles.footerBtnDisabled]}
              onPress={() => selectedSit && setStep(2)}
              disabled={!selectedSit}
            >
              <Text style={styles.footerBtnText}>Continue</Text>
            </Pressable>
          )}
          {step === 2 && (
            <Pressable
              style={styles.footerBtn}
              onPress={() => setStep(3)}
            >
              <Text style={styles.footerBtnText}>Review application</Text>
            </Pressable>
          )}
          {step === 3 && (
            <Pressable
              style={[styles.footerBtn, submitting && styles.footerBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={GrottoTokens.white} size="small" />
              ) : (
                <Text style={styles.footerBtnText}>Submit application</Text>
              )}
            </Pressable>
          )}
        </SafeAreaView>

      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.white,
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

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.surface,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GrottoTokens.borderSubtle,
  },
  dotActive: {
    backgroundColor: GrottoTokens.gold,
    width: 20,
  },

  // ── Content
  scrollContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  stepTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 30,
    color: GrottoTokens.textPrimary,
    lineHeight: 38,
    marginBottom: Layout.spacing.sm,
  },
  stepSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    marginBottom: Layout.spacing.xl,
    lineHeight: 20,
  },

  // ── Step 1
  emptyBox: {
    alignItems: 'center',
    gap: Layout.spacing.md,
    paddingVertical: Layout.spacing.xxl,
  },
  emptyText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
  },
  sitList: {
    gap: Layout.spacing.sm,
  },
  sitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  sitOptionSelected: {
    borderColor: GrottoTokens.gold,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: GrottoTokens.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.white,
  },
  radioSelected: {
    borderColor: GrottoTokens.gold,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GrottoTokens.gold,
  },
  sitDates: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  sitDatesSelected: {
    fontFamily: FontFamily.sansSemiBold,
  },
  sitNights: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 2,
  },

  // ── Step 2
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GrottoTokens.goldSubtle,
    borderRadius: Layout.radius.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: Layout.spacing.lg,
  },
  dateBadgeText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  messageInput: {
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    minHeight: 160,
    lineHeight: 24,
    backgroundColor: GrottoTokens.white,
  },
  charCount: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    textAlign: 'right',
    marginTop: Layout.spacing.xs,
    marginBottom: Layout.spacing.md,
  },
  tipBox: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.goldSubtle,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
    lineHeight: 19,
  },

  // ── Step 3
  reviewCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    marginBottom: Layout.spacing.lg,
  },
  reviewThumb: {
    width: 100,
    height: 100,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  reviewThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCardBody: {
    flex: 1,
    padding: Layout.spacing.md,
    gap: 4,
    justifyContent: 'center',
  },
  reviewCardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    lineHeight: 20,
  },
  reviewCardMeta: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
  },
  reviewCardNights: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.gold,
    marginTop: 2,
  },
  reviewSection: {
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
    paddingTop: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
  },
  reviewSectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.sm,
  },
  reviewSectionLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  editLink: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
    textDecorationLine: 'underline',
  },
  reviewMessage: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 22,
  },
  reviewMessageEmpty: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textMuted,
    fontStyle: 'italic',
  },
  reviewProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    marginTop: Layout.spacing.sm,
  },
  reviewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  reviewAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewProfileName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  reviewProfileSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    marginTop: 2,
  },
  disclaimer: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: Layout.spacing.sm,
  },

  // ── Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  footerBtn: {
    margin: Layout.spacing.md,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  footerBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  footerBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.white,
    letterSpacing: 0.2,
  },

  // ── Success
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
    gap: Layout.spacing.md,
  },
  successIconWrap: {
    marginBottom: Layout.spacing.sm,
  },
  successTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 32,
    color: GrottoTokens.textPrimary,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Layout.spacing.sm,
  },
  successCard: {
    flexDirection: 'row',
    backgroundColor: GrottoTokens.white,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    width: '100%',
    marginBottom: Layout.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  successThumb: {
    width: 80,
    height: 80,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  successThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCardBody: {
    flex: 1,
    padding: Layout.spacing.md,
    justifyContent: 'center',
    gap: 3,
  },
  successCardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },
  successCardDates: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
  },
  successCardNights: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: GrottoTokens.gold,
  },
  successPrimaryBtn: {
    width: '100%',
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  successPrimaryText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.white,
  },
  successSecondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  successSecondaryText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    color: GrottoTokens.textSecondary,
    textDecorationLine: 'underline',
  },
});
