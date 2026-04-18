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
import { resetPassword } from '@/lib/auth';
import GrottoLogo from '@/components/GrottoLogo';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReset() {
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(email ?? '', code.trim(), newPassword);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={GrottoTokens.gold} />
        </View>
        <Text style={styles.heading}>Password updated</Text>
        <Text style={styles.subheading}>
          Your password has been changed successfully. Sign in with your new password.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
          onPress={() => router.replace('/profile/sign-in')}
        >
          <Text style={styles.submitText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const canSubmit = code.length === 6 && newPassword.length >= 6 && !isSubmitting;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <GrottoLogo size={48} variant="light" mark="house" />
        </View>

        <Text style={styles.heading}>Reset password</Text>
        <Text style={styles.subheading}>
          Enter the 6-digit code from your email and choose a new password.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Reset code</Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor={GrottoTokens.textMuted}
            style={styles.codeInput}
            maxLength={6}
            returnKeyType="next"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={GrottoTokens.textMuted}
              style={[styles.input, styles.passwordInput]}
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
            <Pressable
              style={styles.showToggle}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
            >
              <Text style={styles.showToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
          onPress={handleReset}
          disabled={!canSubmit}
        >
          <Text style={styles.submitText}>{isSubmitting ? 'Updating…' : 'Update password'}</Text>
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
    marginBottom: Layout.spacing.xs,
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
  fieldGroup: {
    gap: Layout.spacing.xs,
  },
  label: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  codeInput: {
    height: 52,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
    paddingHorizontal: Layout.spacing.md,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 22,
    color: GrottoTokens.textPrimary,
    textAlign: 'center',
    letterSpacing: 6,
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
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 60,
  },
  showToggle: {
    position: 'absolute',
    right: Layout.spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  showToggleText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: GrottoTokens.gold,
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
