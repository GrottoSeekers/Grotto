import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { asc, eq } from 'drizzle-orm';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { db } from '@/db/client';
import { applications, chatMessages, listings, sits, users } from '@/db/schema';
import type { Application, ChatMessage, Listing, Sit, User } from '@/db/schema';
import { useSessionStore } from '@/store/session-store';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { notifyNewMessage } from '@/lib/notifications';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatTime(isoStr: string | null): string {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return formatDate(isoStr.slice(0, 10));
}

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: GrottoTokens.gold },
  accepted:  { label: 'Accepted',  color: '#4CAF7D' },
  declined:  { label: 'Declined',  color: GrottoTokens.textMuted },
  withdrawn: { label: 'Withdrawn', color: GrottoTokens.textMuted },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useSessionStore();

  const [application, setApplication] = useState<Application | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [sit, setSit] = useState<Sit | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const isOwner = currentUser?.role === 'owner';

  useFocusEffect(
    useCallback(() => {
      if (id && currentUser) loadData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, currentUser?.id])
  );

  async function loadData() {
    const appId = Number(id);
    try {
      const [app] = await db.select().from(applications).where(eq(applications.id, appId));
      if (!app) { setLoading(false); return; }
      setApplication(app);

      const [[listingRow], [sitRow], msgs] = await Promise.all([
        db.select().from(listings).where(eq(listings.id, app.listingId)),
        db.select().from(sits).where(eq(sits.id, app.sitId)),
        db.select().from(chatMessages)
          .where(eq(chatMessages.applicationId, appId))
          .orderBy(asc(chatMessages.id)),
      ]);

      setListing(listingRow ?? null);
      setSit(sitRow ?? null);
      setMessages(msgs);

      const otherUserId = isOwner ? app.sitterId : listingRow?.ownerId;
      if (otherUserId) {
        const [user] = await db.select().from(users).where(eq(users.id, otherUserId));
        setOtherUser(user ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!currentUser || !application || !inputText.trim() || sending) return;
    setSending(true);
    const text = inputText.trim();
    setInputText('');
    try {
      const [msg] = await db.insert(chatMessages).values({
        applicationId: application.id,
        senderId: currentUser.id,
        body: text,
      }).returning();
      setMessages(prev => [...prev, msg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      await notifyNewMessage(currentUser.name, listing?.title ?? '');
    } catch (e) {
      console.error(e);
      setInputText(text);
    } finally {
      setSending(false);
    }
  }

  async function handleAccept() {
    if (!application) return;
    await db.update(applications).set({ status: 'accepted' }).where(eq(applications.id, application.id));
    await db.update(sits).set({ status: 'confirmed', sitterId: application.sitterId }).where(eq(sits.id, application.sitId));
    setApplication(prev => prev ? { ...prev, status: 'accepted' } : prev);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2400);
  }

  async function handleDecline() {
    if (!application) return;
    await db.update(applications).set({ status: 'declined' }).where(eq(applications.id, application.id));
    setApplication(prev => prev ? { ...prev, status: 'declined' } : prev);
  }

  async function handleWithdraw() {
    if (!application) return;
    await db.update(applications).set({ status: 'withdrawn' }).where(eq(applications.id, application.id));
    setApplication(prev => prev ? { ...prev, status: 'withdrawn' } : prev);
  }

  // ── Loading / not found ────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={GrottoTokens.gold} />
      </View>
    );
  }

  if (!application || !listing) {
    return (
      <View style={styles.loader}>
        <Text style={styles.notFound}>Conversation not found.</Text>
      </View>
    );
  }

  const statusDisplay = STATUS_DISPLAY[application.status] ?? STATUS_DISPLAY.pending;
  const isPending = application.status === 'pending';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: GrottoTokens.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={GrottoTokens.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            {otherUser?.avatarUrl ? (
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.headerAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                <Ionicons name="person" size={15} color={GrottoTokens.goldMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {otherUser?.name ?? 'Unknown'}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>{listing.title}</Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Sit summary card ── */}
        {sit && (
          <View style={styles.sitCard}>
            {listing.coverPhotoUrl ? (
              <Image source={{ uri: listing.coverPhotoUrl }} style={styles.sitThumb} contentFit="cover" />
            ) : (
              <View style={[styles.sitThumb, styles.sitThumbFallback]}>
                <Ionicons name="home-outline" size={14} color={GrottoTokens.goldMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.sitTitle} numberOfLines={1}>{listing.title}</Text>
              <Text style={styles.sitDates}>
                {formatDate(sit.startDate)} – {formatDate(sit.endDate)}
              </Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: statusDisplay.color + '22' }]}>
              <Text style={[styles.statusChipText, { color: statusDisplay.color }]}>
                {statusDisplay.label}
              </Text>
            </View>
          </View>
        )}

        {/* ── Owner actions (pending only) ── */}
        {isOwner && isPending && (
          <View style={styles.actionsRow}>
            <Pressable style={styles.declineBtn} onPress={handleDecline}>
              <Text style={styles.declineBtnText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.acceptBtn} onPress={handleAccept}>
              <Ionicons name="checkmark" size={15} color={GrottoTokens.white} />
              <Text style={styles.acceptBtnText}>Accept application</Text>
            </Pressable>
          </View>
        )}

        {/* ── Sitter withdraw (pending only) ── */}
        {!isOwner && isPending && (
          <View style={styles.withdrawWrap}>
            <Pressable style={styles.withdrawBtn} onPress={handleWithdraw}>
              <Text style={styles.withdrawBtnText}>Withdraw application</Text>
            </Pressable>
          </View>
        )}

        {/* ── Messages ── */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesText}>No messages yet — say hello!</Text>
            </View>
          ) : (
            messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isMe={msg.senderId === currentUser?.id}
              />
            ))
          )}
        </ScrollView>

        {/* ── Input bar ── */}
        <SafeAreaView edges={['bottom']} style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Message…"
            placeholderTextColor={GrottoTokens.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <Pressable
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={GrottoTokens.white} />
            ) : (
              <Ionicons name="arrow-up" size={18} color={GrottoTokens.white} />
            )}
          </Pressable>
        </SafeAreaView>

      </SafeAreaView>

      {showConfetti && <ConfettiOverlay />}
    </KeyboardAvoidingView>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
          {msg.body}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
        {formatTime(msg.createdAt)}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.white,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
    gap: Layout.spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.surface,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  headerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  headerSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 1,
  },

  // ── Sit card
  sitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 10,
    backgroundColor: GrottoTokens.offWhite,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  sitThumb: {
    width: 40,
    height: 40,
    borderRadius: Layout.radius.md,
    backgroundColor: GrottoTokens.goldSubtle,
  },
  sitThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sitTitle: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textPrimary,
  },
  sitDates: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 1,
  },
  statusChip: {
    borderRadius: Layout.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusChipText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
  },

  // ── Owner actions
  actionsRow: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    alignItems: 'center',
  },
  declineBtnText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 11,
    borderRadius: Layout.radius.full,
    backgroundColor: '#4CAF7D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.white,
  },

  // ── Sitter withdraw
  withdrawWrap: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: GrottoTokens.borderSubtle,
  },
  withdrawBtn: {
    paddingVertical: 10,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    alignItems: 'center',
  },
  withdrawBtnText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },

  // ── Messages list
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    gap: 4,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Layout.spacing.xxl,
  },
  emptyMessagesText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textMuted,
  },

  // ── Bubbles
  bubbleWrap: {
    marginVertical: 2,
    maxWidth: '80%',
  },
  bubbleWrapMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapThem: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: GrottoTokens.gold,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: GrottoTokens.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextMe: {
    fontFamily: FontFamily.sansRegular,
    color: GrottoTokens.white,
  },
  bubbleTextThem: {
    fontFamily: FontFamily.sansRegular,
    color: GrottoTokens.textPrimary,
  },
  bubbleTime: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: GrottoTokens.textMuted,
    marginTop: 3,
    marginHorizontal: 4,
  },
  bubbleTimeMe: {
    textAlign: 'right',
  },
  bubbleTimeThem: {
    textAlign: 'left',
  },

  // ── Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    backgroundColor: GrottoTokens.surface,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GrottoTokens.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GrottoTokens.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: GrottoTokens.goldMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
});

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  GrottoTokens.gold,
  '#4CAF7D',
  '#F5873D',
  GrottoTokens.goldMuted,
  '#ffffff',
  '#A8E6CF',
  '#C9A84C',
];

type PieceConfig = {
  id: number;
  color: string;
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  spin: number;
  w: number;
  h: number;
};

function ConfettiOverlay() {
  const pieces = useMemo<PieceConfig[]>(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      // spread pieces evenly around the circle with some randomness
      angle: (i / 40) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      distance: 120 + Math.random() * 200,
      duration: 1000 + Math.random() * 600,
      delay: Math.random() * 180,
      spin: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 480),
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 5,
    }))
  , []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {pieces.map(p => (
        <ConfettiPiece key={p.id} {...p} />
      ))}
    </View>
  );
}

function ConfettiPiece({ angle, distance, duration, delay, spin, color, w, h }: Omit<PieceConfig, 'id'>) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.quad) })
    );
    return () => { cancelAnimation(progress); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // Horizontal: fan outward along the angle
    const tx = Math.cos(angle) * distance * p;
    // Vertical: initial upward burst then gravity pulls down
    const ty = Math.sin(angle) * distance * p * 0.5 + p * p * 450 - 60;
    // Flutter: piece tumbles as it falls
    const flutter = Math.abs(Math.cos(p * Math.PI * 4)) * 0.6 + 0.4;
    // Fade out in the last 30% of the animation
    const opacity = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${spin * p}deg` },
        { scaleX: flutter },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          // burst origin: horizontal centre, ~40% down the screen
          top: '42%',
          left: '50%',
          width: w,
          height: h,
          borderRadius: 2,
          backgroundColor: color,
          marginLeft: -w / 2,
          marginTop: -h / 2,
        },
        animStyle,
      ]}
    />
  );
}
