import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { db } from '@/db/client';
import { testimonials } from '@/db/schema';

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={8}>
          <Ionicons
            name={i <= value ? 'star' : 'star-outline'}
            size={30}
            color={GrottoTokens.gold}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function AddTestimonialScreen() {
  const router = useRouter();
  const { pendingId } = useLocalSearchParams<{ pendingId: string }>();

  const [ownerName, setOwnerName] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pendingId) return;
    db.select()
      .from(testimonials)
      .where(eq(testimonials.id, Number(pendingId)))
      .then(([row]) => {
        if (row) setOwnerName(row.ownerName);
      })
      .catch(console.error);
  }, [pendingId]);

  async function handleSave() {
    if (!body.trim()) {
      Alert.alert('Required', 'Please enter the testimonial text.');
      return;
    }
    setSaving(true);
    try {
      if (pendingId) {
        await db
          .update(testimonials)
          .set({ body: body.trim(), rating, status: 'published' })
          .where(eq(testimonials.id, Number(pendingId)));
      }
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not save the testimonial. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.bg}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageDesc}>
        Received a testimonial from {ownerName || 'the homeowner'}? Paste it below and
        choose a star rating — it will appear published on your profile.
      </Text>

      <View style={styles.formCard}>
        {/* Star rating */}
        <View style={styles.field}>
          <Text style={styles.label}>Star rating</Text>
          <StarPicker value={rating} onChange={setRating} />
        </View>

        <View style={styles.divider} />

        {/* Testimonial body */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Testimonial text <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={`What did ${ownerName || 'the homeowner'} say about your sit?`}
            placeholderTextColor={GrottoTokens.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
            autoCapitalize="sentences"
          />
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
        onPress={handleSave}
        disabled={saving}
      >
        <Ionicons name="checkmark" size={18} color={GrottoTokens.white} />
        <Text style={styles.saveBtnText}>
          {saving ? 'Saving…' : 'Publish testimonial'}
        </Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
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

  formCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    overflow: 'hidden',
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  field: {
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.sm,
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
  input: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    paddingVertical: 4,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  divider: {
    height: 1,
    backgroundColor: GrottoTokens.borderSubtle,
    marginHorizontal: Layout.spacing.md,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 15,
    paddingHorizontal: Layout.spacing.xl,
    boxShadow: `0 8px 20px rgba(201,168,76,0.35)`,
  },
  saveBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
