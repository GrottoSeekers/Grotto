import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { verifyEmail } from '@/lib/auth';
import { useSessionStore } from '@/store/session-store';
import GrottoLogo from '@/components/GrottoLogo';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { setUser } = useSessionStore();
  const { userId, code: codeParam } = useLocalSearchParams<{ userId: string; code: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleVerify() {
    if (!userId || code.length !== 6) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await verifyEmail(Number(userId), code.trim());
      setUser(user);
      router.replace('/profile');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <GrottoLogo size={48} variant="light" mark="house" />
        </View>

        <View style={styles.iconWrap}>
          <Ionicons name="mail-outline" size={40} color={GrottoTokens.gold} />
        </View>

        <Text style={styles.heading}>Verify your email</Text>
        <Text style={styles.subheading}>
          We've sent a 6-digit code to your email address. Enter it below to activate your account.
        </Text>

        {codeParam ? (
          <View style={styles.codeHintBox}>
            <Ionicons name="key-outline" size={15} color={GrottoTokens.gold} />
            <Text style={styles.codeHintText}>Your code: <Text style={styles.codeHintValue}>{codeParam}</Text></Text>
          </View>
        ) : (
          <Text style={styles.spamNote}>Don't see it? Check your spam or junk folder.</Text>
        )}

        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="000000"
          placeholderTextColor={GrottoTokens.textMuted}
          style={styles.codeInput}
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.submit,
            (code.length !== 6 || isSubmitting) && styles.submitDisabled,
            pressed && code.length === 6 && styles.pressed,
          ]}
          onPress={handleVerify}
          disabled={code.length !== 6 || isSubmitting}
        >
          <Text style={styles.submitText}>{isSubmitting ? 'Verifying…' : 'Verify email'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: Layout.spacing.md,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.md,
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xs,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: -Layout.spacing.xs,
  },
  heading: {
    fontFamily: FontFamily.serifBold,
    fontSize: 28,
    color: GrottoTokens.textPrimary,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  spamNote: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
    marginTop: -4,
  },
  codeHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: GrottoTokens.goldSubtle,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: GrottoTokens.goldMuted,
    paddingVertical: 10,
    paddingHorizontal: Layout.spacing.md,
    marginTop: -4,
  },
  codeHintText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  codeHintValue: {
    fontFamily: FontFamily.sansSemiBold,
    color: GrottoTokens.textPrimary,
    letterSpacing: 2,
  },
  codeInput: {
    height: 56,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
    paddingHorizontal: Layout.spacing.md,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 24,
    color: GrottoTokens.textPrimary,
    textAlign: 'center',
    letterSpacing: 8,
  },
  error: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.error,
    textAlign: 'center',
  },
  submit: {
    marginTop: Layout.spacing.xs,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.55,
  },
  submitText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
