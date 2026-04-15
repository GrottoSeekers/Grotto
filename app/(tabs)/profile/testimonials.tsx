import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { eq, desc } from 'drizzle-orm';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useSessionStore } from '@/store/session-store';
import { db } from '@/db/client';
import { testimonials } from '@/db/schema';
import type { Testimonial } from '@/db/schema';
import { supabase } from '@/lib/supabase';

function StarRow({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={13}
          color={GrottoTokens.gold}
        />
      ))}
    </View>
  );
}

function TestimonialCard({
  item,
  onDelete,
}: {
  item: Testimonial;
  onDelete: (id: number) => void;
}) {
  const initials = item.ownerName
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0]!)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function confirmDelete() {
    Alert.alert(
      'Delete testimonial',
      `Remove the ${item.status === 'pending' ? 'request to' : 'testimonial from'} ${item.ownerName}? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.ownerAvatar}>
          <Text style={styles.ownerInitials}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ownerName}>{item.ownerName}</Text>
          {item.sitDescription ? (
            <Text style={styles.sitDesc}>{item.sitDescription}</Text>
          ) : null}
        </View>
        {item.status === 'pending' ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending</Text>
          </View>
        ) : null}
        <Pressable
          onPress={confirmDelete}
          hitSlop={12}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={17} color={GrottoTokens.error} />
        </Pressable>
      </View>
      {item.rating ? <StarRow rating={item.rating} /> : null}
      {item.body ? (
        <Text style={styles.bodyText}>"{item.body}"</Text>
      ) : (
        <Text style={styles.awaitingText}>
          Waiting for {item.ownerName} to reply. Once they do, tap the button below to add their review.
        </Text>
      )}
    </View>
  );
}

export default function TestimonialsScreen() {
  const router = useRouter();
  const { currentUser } = useSessionStore();
  const [items, setItems] = useState<Testimonial[]>([]);

  async function syncFromSupabase() {
    if (!currentUser) return;
    // Get all tokens we've sent out
    const localRows = await db
      .select({ requestToken: testimonials.requestToken })
      .from(testimonials)
      .where(eq(testimonials.sitterId, currentUser.id));

    const tokens = localRows.map((r) => r.requestToken).filter(Boolean) as string[];
    if (tokens.length === 0) return;

    // Check Supabase for any that have been submitted by the owner
    const { data } = await supabase
      .from('testimonials')
      .select('request_token, body, rating, status')
      .in('request_token', tokens)
      .eq('status', 'published');

    if (!data || data.length === 0) return;

    // Update local records that are now published
    for (const row of data) {
      await db
        .update(testimonials)
        .set({ body: row.body, rating: row.rating, status: 'published' })
        .where(eq(testimonials.requestToken, row.request_token));
    }
  }

  async function load() {
    if (!currentUser) return;
    await syncFromSupabase().catch(console.error);
    const rows = await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.sitterId, currentUser.id))
      .orderBy(desc(testimonials.createdAt));
    setItems(rows);
  }

  async function handleDelete(id: number) {
    await db.delete(testimonials).where(eq(testimonials.id, id));
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [currentUser?.id])
  );

  const published = items.filter((t) => t.status === 'published');
  const pending = items.filter((t) => t.status === 'pending');

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Intro banner ── */}
      <View style={styles.introBanner}>
        <Ionicons name="ribbon-outline" size={28} color={GrottoTokens.gold} />
        <Text style={styles.introTitle}>Testimonials</Text>
        <Text style={styles.introBody}>
          Ask previous homeowners to vouch for you. Share a link or send an email — they
          don't need the Grotto app.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.requestBtn, pressed && styles.pressed]}
          onPress={() => router.push('/profile/request-testimonial')}
        >
          <Ionicons name="add" size={18} color={GrottoTokens.white} />
          <Text style={styles.requestBtnText}>Request a testimonial</Text>
        </Pressable>
      </View>

      {/* ── Published ── */}
      {published.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Published ({published.length})</Text>
          {published.map((t) => (
            <TestimonialCard key={t.id} item={t} onDelete={handleDelete} />
          ))}
        </View>
      ) : null}

      {/* ── Pending ── */}
      {pending.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Waiting for response ({pending.length})</Text>
          {pending.map((t) => (
            <View key={t.id}>
              <TestimonialCard item={t} onDelete={handleDelete} />
              <Pressable
                style={({ pressed }) => [styles.addResponseBtn, pressed && styles.pressed]}
                onPress={() =>
                  router.push({
                    pathname: '/profile/add-testimonial',
                    params: { pendingId: String(t.id) },
                  })
                }
              >
                <Ionicons name="create-outline" size={15} color={GrottoTokens.white} />
                <Text style={styles.addResponseText}>Got a reply? Enter it here</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Empty state ── */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color={GrottoTokens.goldMuted} />
          <Text style={styles.emptyTitle}>No testimonials yet</Text>
          <Text style={styles.emptyBody}>
            Tap "Request a testimonial" to send a personalised link to a homeowner you've
            sat for. Their review will appear here once submitted.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  content: {
    padding: Layout.spacing.md,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.md,
  },

  // ── Intro banner ──────────────────────────────────────────────────────────
  introBanner: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.lg,
    alignItems: 'center',
    gap: Layout.spacing.sm,
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  introTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 22,
    color: GrottoTokens.textPrimary,
  },
  introBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 13,
    paddingHorizontal: Layout.spacing.xl,
    marginTop: Layout.spacing.xs,
    boxShadow: `0 6px 16px rgba(201,168,76,0.35)`,
  },
  requestBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },

  // ── Section ───────────────────────────────────────────────────────────────
  section: {
    gap: Layout.spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Layout.spacing.xs,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.md,
    gap: Layout.spacing.sm,
    boxShadow: `0 2px 8px ${GrottoTokens.shadow}`,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  ownerAvatar: {
    width: 40,
    height: 40,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInitials: {
    fontFamily: FontFamily.serifBold,
    fontSize: 15,
    color: GrottoTokens.gold,
  },
  ownerName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  sitDesc: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 1,
  },
  pendingBadge: {
    backgroundColor: GrottoTokens.goldSubtle,
    borderRadius: Layout.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: GrottoTokens.gold,
  },
  bodyText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  awaitingText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    fontStyle: 'italic',
  },

  deleteBtn: {
    padding: 4,
    marginLeft: Layout.spacing.xs,
  },

  addResponseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 10,
    paddingHorizontal: Layout.spacing.md,
    marginTop: 4,
    boxShadow: `0 4px 12px rgba(201,168,76,0.3)`,
  },
  addResponseText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.white,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingVertical: Layout.spacing.xxl,
    paddingHorizontal: Layout.spacing.xl,
  },
  emptyTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 20,
    color: GrottoTokens.textPrimary,
  },
  emptyBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
