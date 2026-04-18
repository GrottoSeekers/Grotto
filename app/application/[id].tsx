import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { db } from '@/db/client';
import { applications, listings, sits, users } from '@/db/schema';
import type { Application, Listing, Sit, User } from '@/db/schema';
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

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  pending:   { label: 'Pending review',  bg: GrottoTokens.goldSubtle, color: GrottoTokens.gold,    icon: 'time-outline' },
  accepted:  { label: 'Accepted',        bg: '#E8F5EE',               color: '#4CAF7D',            icon: 'checkmark-circle-outline' },
  declined:  { label: 'Not this time',   bg: GrottoTokens.surface,    color: GrottoTokens.textMuted, icon: 'close-circle-outline' },
  withdrawn: { label: 'Withdrawn',       bg: GrottoTokens.surface,    color: GrottoTokens.textMuted, icon: 'remove-circle-outline' },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useSessionStore();

  const [application, setApplication] = useState<Application | null>(null);
  const [listing, setListing]         = useState<Listing | null>(null);
  const [sit, setSit]                 = useState<Sit | null>(null);
  const [sitter, setSitter]           = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);
  const [actioning, setActioning]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const appId = Number(id);

      db.select().from(applications).where(eq(applications.id, appId))
        .then(async ([app]) => {
          if (!app) { setLoading(false); return; }
          setApplication(app);

          const [listingRows, sitRows, sitterRows] = await Promise.all([
            db.select().from(listings).where(eq(listings.id, app.listingId)),
            db.select().from(sits).where(eq(sits.id, app.sitId)),
            db.select().from(users).where(eq(users.id, app.sitterId)),
          ]);

          setListing(listingRows[0] ?? null);
          setSit(sitRows[0] ?? null);
          setSitter(sitterRows[0] ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [id])
  );

  async function handleAccept() {
    if (!application || !sit || !sitter || actioning) return;
    setActioning(true);
    try {
      await db.update(applications)
        .set({ status: 'accepted' })
        .where(eq(applications.id, application.id));

      await db.update(sits)
        .set({ status: 'confirmed', sitterId: sitter.id })
        .where(eq(sits.id, sit.id));

      setApplication(prev => prev ? { ...prev, status: 'accepted' } : prev);
      Alert.alert(
        'Application accepted',
        `${sitter.name.split(' ')[0]}'s application has been accepted. They'll be sitting for you!`,
        [{ text: 'Great', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Error', 'Could not accept the application. Please try again.');
    } finally {
      setActioning(false);
    }
  }

  async function handleDecline() {
    if (!application || !sitter || actioning) return;
    Alert.alert(
      'Decline application?',
      `This will let ${sitter.name.split(' ')[0]} know their application was unsuccessful.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActioning(true);
            try {
              await db.update(applications)
                .set({ status: 'declined' })
                .where(eq(applications.id, application.id));
              setApplication(prev => prev ? { ...prev, status: 'declined' } : prev);
            } catch {
              Alert.alert('Error', 'Could not decline. Please try again.');
            } finally {
              setActioning(false);
            }
          },
        },
      ]
    );
  }

  async function handleWithdraw() {
    if (!application || actioning) return;
    Alert.alert(
      'Withdraw application?',
      'You can always apply again if the dates are still open.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setActioning(true);
            try {
              await db.update(applications)
                .set({ status: 'withdrawn' })
                .where(eq(applications.id, application.id));
              setApplication(prev => prev ? { ...prev, status: 'withdrawn' } : prev);
            } catch {
              Alert.alert('Error', 'Could not withdraw. Please try again.');
            } finally {
              setActioning(false);
            }
          },
        },
      ]
    );
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={GrottoTokens.gold} />
      </View>
    );
  }

  if (!application || !listing || !sit) {
    return (
      <View style={styles.loader}>
        <Text style={styles.notFound}>Application not found.</Text>
      </View>
    );
  }

  const isOwner = !!currentUser && currentUser.id === listing.ownerId;
  const nights  = nightsBetween(sit.startDate, sit.endDate);
  const status  = STATUS_CONFIG[application.status] ?? STATUS_CONFIG.pending;
  const isPending = application.status === 'pending';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={GrottoTokens.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isOwner ? 'Application' : 'Your application'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* ── Status banner ── */}
        <View style={[styles.statusBanner, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon as any} size={18} color={status.color} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>

        {/* ── Sitter card (owner view) ── */}
        {isOwner && sitter && (
          <Pressable
            style={styles.personCard}
            onPress={() => router.push(`/user/${sitter.id}`)}
          >
            {sitter.avatarUrl ? (
              <Image source={{ uri: sitter.avatarUrl }} style={styles.personAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.personAvatar, styles.personAvatarFallback]}>
                <Ionicons name="person" size={28} color={GrottoTokens.goldMuted} />
              </View>
            )}
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{sitter.name}</Text>
              {sitter.location && (
                <Text style={styles.personSub}>{sitter.location}</Text>
              )}
              {sitter.bio && (
                <Text style={styles.personBio} numberOfLines={2}>{sitter.bio}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={GrottoTokens.textMuted} />
          </Pressable>
        )}

        {/* ── Sit details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isOwner ? 'Sit details' : 'Your sit'}
          </Text>
          <View style={styles.sitCard}>
            {listing.coverPhotoUrl ? (
              <Image source={{ uri: listing.coverPhotoUrl }} style={styles.sitThumb} contentFit="cover" />
            ) : (
              <View style={[styles.sitThumb, styles.sitThumbFallback]}>
                <Ionicons name="home-outline" size={22} color={GrottoTokens.goldMuted} />
              </View>
            )}
            <View style={styles.sitCardBody}>
              <Text style={styles.sitTitle} numberOfLines={2}>{listing.title}</Text>
              {listing.city && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color={GrottoTokens.textMuted} />
                  <Text style={styles.metaText}>
                    {[listing.city, listing.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={12} color={GrottoTokens.textMuted} />
                <Text style={styles.metaText}>
                  {formatDate(sit.startDate)} – {formatDate(sit.endDate)}
                </Text>
              </View>
              <Text style={styles.nightsLabel}>
                {nights} night{nights !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Message ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isOwner ? `Message from ${sitter?.name.split(' ')[0] ?? 'sitter'}` : 'Your message'}
          </Text>
          {application.message ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{application.message}</Text>
            </View>
          ) : (
            <Text style={styles.noMessage}>No message was included.</Text>
          )}
        </View>

        {/* ── Sitter profile bullets (owner only) ── */}
        {isOwner && sitter && (sitter.occupation || sitter.whyIWantToSit) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About the sitter</Text>
            <View style={styles.bulletList}>
              {sitter.occupation && (
                <View style={styles.bulletRow}>
                  <Ionicons name="briefcase-outline" size={16} color={GrottoTokens.textSecondary} />
                  <Text style={styles.bulletText}>{sitter.occupation}</Text>
                </View>
              )}
              {sitter.whyIWantToSit && (
                <View style={styles.bulletRow}>
                  <Ionicons name="heart-outline" size={16} color={GrottoTokens.textSecondary} />
                  <Text style={styles.bulletText}>{sitter.whyIWantToSit}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom actions ── */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {isOwner && isPending && (
          <View style={styles.footerRow}>
            <Pressable
              style={[styles.declineBtn, actioning && styles.btnDisabled]}
              onPress={handleDecline}
              disabled={actioning}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </Pressable>
            <Pressable
              style={[styles.acceptBtn, actioning && styles.btnDisabled]}
              onPress={handleAccept}
              disabled={actioning}
            >
              {actioning ? (
                <ActivityIndicator color={GrottoTokens.white} size="small" />
              ) : (
                <Text style={styles.acceptBtnText}>Accept</Text>
              )}
            </Pressable>
          </View>
        )}
        {!isOwner && isPending && (
          <Pressable
            style={[styles.withdrawBtn, actioning && styles.btnDisabled]}
            onPress={handleWithdraw}
            disabled={actioning}
          >
            <Text style={styles.withdrawBtnText}>Withdraw application</Text>
          </Pressable>
        )}
      </SafeAreaView>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GrottoTokens.offWhite,
  },
  notFound: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textMuted,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 14,
    backgroundColor: GrottoTokens.white,
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
  headerTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Layout.spacing.sm,
  },

  scrollContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.xl,
    gap: Layout.spacing.md,
  },

  // ── Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
  },
  statusLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
  },

  // ── Person card (sitter, shown to owner)
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  personAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  personAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: {
    flex: 1,
    gap: 3,
  },
  personName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    color: GrottoTokens.textPrimary,
  },
  personSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  personBio: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    lineHeight: 17,
    marginTop: 2,
  },

  // ── Section
  section: {
    gap: Layout.spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // ── Sit card
  sitCard: {
    flexDirection: 'row',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sitThumb: {
    width: 96,
    height: 96,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  sitThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sitCardBody: {
    flex: 1,
    padding: Layout.spacing.md,
    gap: 4,
    justifyContent: 'center',
  },
  sitTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textSecondary,
    flex: 1,
  },
  nightsLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.gold,
    marginTop: 2,
  },

  // ── Message
  messageBox: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  messageText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    lineHeight: 24,
  },
  noMessage: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textMuted,
    fontStyle: 'italic',
  },

  // ── Bullet list
  bulletList: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    gap: Layout.spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 20,
  },

  // ── Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  footerRow: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    alignItems: 'center',
  },
  declineBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textSecondary,
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.gold,
    alignItems: 'center',
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },
  withdrawBtn: {
    marginHorizontal: Layout.spacing.md,
    marginVertical: Layout.spacing.md,
    paddingVertical: 15,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.error,
    alignItems: 'center',
  },
  withdrawBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.error,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
