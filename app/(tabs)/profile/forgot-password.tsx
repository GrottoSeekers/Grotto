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
import { useRouter } from 'expo-router';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { requestPasswordReset } from '@/lib/auth';
import { sendEmail, passwordResetEmail } from '@/lib/email';
import GrottoLogo from '@/components/GrottoLogo';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequest() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { code } = await requestPasswordReset(email.trim());
      await sendEmail(
        email.trim(),
        'Grotto — your password reset code',
        passwordResetEmail(code),
      );
      setSentCode(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sentCode) {
    return (
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <GrottoLogo size={48} variant="light" mark="house" />
        </View>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle-outline" size={44} color={GrottoTokens.gold} />
        </View>
        <Text style={styles.heading}>Check your email</Text>
        <Text style={styles.subheading}>
          We've sent a 6-digit reset code to{' '}
          <Text style={styles.emailBold}>{email.trim()}</Text>.
          Enter it on the next screen to set a new password.
        </Text>

        <Text style={styles.spamNote}>Don't see it? Check your spam or junk folder.</Text>

        <Pressable
          style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
          onPress={() => router.push(`/profile/reset-password?email=${encodeURIComponent(email.trim())}`)}
        >
          <Text style={styles.submitText}>Enter reset code</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <GrottoLogo size={48} variant="light" mark="house" />
        </View>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-open-outline" size={40} color={GrottoTokens.gold} />
        </View>
        <Text style={styles.heading}>Forgot password?</Text>
        <Text style={styles.subheading}>
          Enter the email address for your account and we'll send you a reset code.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={GrottoTokens.textMuted}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={handleRequest}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.submit,
            (!email.trim() || isSubmitting) && styles.submitDisabled,
            pressed && !!email.trim() && styles.pressed,
          ]}
          onPress={handleRequest}
          disabled={!email.trim() || isSubmitting}
        >
          <Text style={styles.submitText}>{isSubmitting ? 'Sending…' : 'Send reset code'}</Text>
        </Pressable>

        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={GrottoTokens.textMuted} />
          <Text style={styles.backText}>Back to sign in</Text>
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
  emailBold: {
    fontFamily: FontFamily.sansSemiBold,
    color: GrottoTokens.textPrimary,
  },
  spamNote: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textMuted,
    textAlign: 'center',
    marginTop: -4,
  },
  input: {
    height: 48,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
    paddingHorizontal: Layout.spacing.md,
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Layout.spacing.sm,
  },
  backText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: GrottoTokens.textMuted,
  },
});
