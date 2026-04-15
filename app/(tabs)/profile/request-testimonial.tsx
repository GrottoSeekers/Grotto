import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useSessionStore } from '@/store/session-store';
import { db } from '@/db/client';
import { testimonials } from '@/db/schema';
import { supabase } from '@/lib/supabase';

const FORM_BASE_URL =
  'https://ndxojbukvqjuhvqjuuwm.supabase.co/storage/v1/object/public/web/testimonial.html';

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 20; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export default function RequestTestimonialScreen() {
  const router = useRouter();
  const { currentUser } = useSessionStore();

  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [petName, setPetName] = useState('');
  const [sitDate, setSitDate] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Derive a sit description from pet name + date for storage
  function buildSitDescription() {
    if (petName.trim() && sitDate.trim()) return `${petName.trim()}, ${sitDate.trim()}`;
    if (petName.trim()) return petName.trim();
    if (sitDate.trim()) return sitDate.trim();
    return null;
  }

  async function handleSend(method: 'email' | 'share') {
    if (!currentUser) return;
    if (!ownerName.trim()) {
      Alert.alert('Required', "Please enter the homeowner's name.");
      return;
    }

    setSaving(true);
    try {
      const token = generateToken();
      const sitDescription = buildSitDescription();

      // Save to local SQLite
      await db.insert(testimonials).values({
        sitterId: currentUser.id,
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim() || null,
        sitDescription,
        status: 'pending',
        requestToken: token,
      });

      // Save to Supabase so the web form can read it
      await supabase.from('testimonials').insert({
        sitter_name: currentUser.name,
        owner_name: ownerName.trim(),
        sit_description: sitDescription,
        status: 'pending',
        request_token: token,
      });

      const sitterFirstName = currentUser.name.split(' ')[0] ?? currentUser.name;
      const ownerFirstName = ownerName.trim().split(' ')[0] ?? ownerName.trim();
      const pet = petName.trim();
      const date = sitDate.trim();

      // ── Subject line ──────────────────────────────────────────────────────
      let subject = `Following up`;
      if (pet) subject += ` regarding ${pet}`;
      subject += ` / Testimonial`;

      // ── Opening line ──────────────────────────────────────────────────────
      let openingLine = `I really enjoyed sitting for you`;
      if (pet && date) openingLine += ` — looking after ${pet} on ${date} was a genuine pleasure!`;
      else if (pet) openingLine += ` — looking after ${pet} was a genuine pleasure!`;
      else if (date) openingLine += ` on ${date} — it was a genuine pleasure!`;
      else openingLine += ` — it was a genuine pleasure!`;

      // ── Personal note section ─────────────────────────────────────────────
      const noteSection = personalNote.trim()
        ? `\n\n${personalNote.trim()}`
        : '';

      // ── Web form link — static HTML hosted in Supabase Storage ─────────
      const reviewLink = `${FORM_BASE_URL}?token=${token}`;

      // ── Full email body ───────────────────────────────────────────────────
      const replyInstruction = `Leave a review here → ${reviewLink}\n\n(Tap that link to open a short form in your browser — no app or account needed. It takes less than a minute.)`;

      const body = [
        `Hi ${ownerFirstName},`,
        ``,
        openingLine,
        ``,
        `I am currently building up my profile on Grotto and would love it if you could provide a short testimonial of your experience. Even just a sentence or two would be incredibly helpful and much appreciated.${noteSection}`,
        ``,
        replyInstruction,
        ``,
        `Thank you so much for your support,`,
        sitterFirstName,
      ].join('\n');

      if (method === 'email') {
        const mailUrl = `mailto:${ownerEmail.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        const canOpen = await Linking.canOpenURL(mailUrl);
        if (canOpen) {
          await Linking.openURL(mailUrl);
        } else {
          Alert.alert('No mail app', 'Could not open a mail app. Try sharing the message instead.');
          return;
        }
      } else {
        await Share.share({ title: subject, message: body });
      }

      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageDesc}>
        The homeowner receives a personalised email with a "Leave a review here →" link.
        Tapping it opens their email app with a template ready to send back — no app needed.
      </Text>

      {/* ── Form ── */}
      <View style={styles.formCard}>
        <View style={styles.field}>
          <Text style={styles.label}>
            Homeowner's name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Niamh Kelly"
            placeholderTextColor={GrottoTokens.textMuted}
            value={ownerName}
            onChangeText={setOwnerName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.field}>
          <Text style={styles.label}>Homeowner's email</Text>
          <TextInput
            style={styles.input}
            placeholder="For sending directly via email"
            placeholderTextColor={GrottoTokens.textMuted}
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.field}>
          <Text style={styles.label}>
            Pet's name <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Solly"
            placeholderTextColor={GrottoTokens.textMuted}
            value={petName}
            onChangeText={setPetName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.field}>
          <Text style={styles.label}>
            Sit date <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. May 2025 or 27th May 2025"
            placeholderTextColor={GrottoTokens.textMuted}
            value={sitDate}
            onChangeText={setSitDate}
            autoCapitalize="sentences"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.field}>
          <Text style={styles.label}>
            Personal note <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Add a personal line to include in the email…"
            placeholderTextColor={GrottoTokens.textMuted}
            value={personalNote}
            onChangeText={setPersonalNote}
            multiline
            autoCapitalize="sentences"
          />
        </View>
      </View>

      {/* ── Send buttons ── */}
      <View style={styles.sendSection}>
        <Text style={styles.sendTitle}>How would you like to send it?</Text>

        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            !ownerEmail.trim() && styles.sendBtnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={() => handleSend('email')}
          disabled={saving || !ownerEmail.trim()}
        >
          <Ionicons
            name="mail-outline"
            size={20}
            color={ownerEmail.trim() ? GrottoTokens.white : GrottoTokens.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.sendBtnTitle, !ownerEmail.trim() && styles.sendBtnTitleDisabled]}>
              Send via email
            </Text>
            <Text style={[styles.sendBtnSub, !ownerEmail.trim() && styles.sendBtnSubDisabled]}>
              {ownerEmail.trim() ? 'Opens your mail app' : 'Enter an email address above'}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={ownerEmail.trim() ? GrottoTokens.white : GrottoTokens.textMuted}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.sendBtnOutline, pressed && styles.pressed]}
          onPress={() => handleSend('share')}
          disabled={saving}
        >
          <Ionicons name="share-outline" size={20} color={GrottoTokens.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sendBtnOutlineTitle}>Share via WhatsApp, iMessage…</Text>
            <Text style={styles.sendBtnOutlineSub}>
              Sends the full message text via any app
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={GrottoTokens.textMuted} />
        </Pressable>
      </View>

      {/* ── How it works note ── */}
      <View style={styles.noteBanner}>
        <Ionicons name="checkmark-circle-outline" size={16} color={GrottoTokens.gold} />
        <Text style={styles.noteText}>
          When the homeowner submits their review, it will{' '}
          <Text style={styles.noteBold}>automatically appear on your profile</Text>
          {' '}— no manual entry needed. Just open the Testimonials screen to sync.
        </Text>
      </View>
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
  pageDesc: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 21,
  },

  // ── Form card ─────────────────────────────────────────────────────────────
  formCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    overflow: 'hidden',
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  field: {
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    gap: 4,
  },
  label: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    color: GrottoTokens.error,
  },
  optional: {
    color: GrottoTokens.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontFamily: FontFamily.sansRegular,
  },
  input: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    paddingVertical: 6,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  divider: {
    height: 1,
    backgroundColor: GrottoTokens.borderSubtle,
    marginHorizontal: Layout.spacing.md,
  },

  // ── Send section ──────────────────────────────────────────────────────────
  sendSection: {
    gap: Layout.spacing.sm,
  },
  sendTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Layout.spacing.xs,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    boxShadow: `0 6px 16px rgba(201,168,76,0.35)`,
  },
  sendBtnDisabled: {
    backgroundColor: GrottoTokens.borderSubtle,
    boxShadow: 'none',
  },
  sendBtnTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },
  sendBtnTitleDisabled: {
    color: GrottoTokens.textMuted,
  },
  sendBtnSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  sendBtnSubDisabled: {
    color: GrottoTokens.textMuted,
  },
  sendBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  sendBtnOutlineTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  sendBtnOutlineSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 1,
  },

  // ── Info note ─────────────────────────────────────────────────────────────
  noteBanner: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.md,
  },
  noteText: {
    flex: 1,
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    lineHeight: 19,
  },
  noteBold: {
    fontFamily: FontFamily.sansSemiBold,
    color: GrottoTokens.textSecondary,
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
