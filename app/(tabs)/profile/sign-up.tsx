import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
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
import { Link, useRouter } from 'expo-router';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import type { AuthRole } from '@/lib/auth';
import { signUpDb } from '@/lib/auth';
import { useSessionStore } from '@/store/session-store';

export default function SignUpScreen() {
  const router = useRouter();
  const { setUser } = useSessionStore();

  const [role, setRole] = useState<AuthRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => !!role && email.trim().length > 0 && password.length > 0 && !isSubmitting, [
    role,
    email,
    password,
    isSubmitting,
  ]);

  async function handleSubmit() {
    if (!role) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await signUpDb({ role, email, password });
      setUser(user);
      router.replace('/profile');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.heading} selectable>Create your account</Text>
        <Text style={styles.subheading} selectable>
          First choose whether you’re joining as a sitter or an owner.
        </Text>

        <View style={styles.roleRow}>
          <RoleCard
            label="Sitter"
            description="I sit for homeowners"
            icon="paw"
            selected={role === 'sitter'}
            onPress={() => setRole('sitter')}
          />
          <RoleCard
            label="Owner"
            description="I need a trusted sitter"
            icon="home-outline"
            selected={role === 'owner'}
            onPress={() => setRole('owner')}
          />
        </View>

        {role && (
          <View style={styles.form}>
            <Field label="Email">
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={GrottoTokens.textMuted}
                style={styles.input}
                returnKeyType="next"
              />
            </Field>

            <Field label="Password">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="At least 6 characters"
                placeholderTextColor={GrottoTokens.textMuted}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </Field>

            {error && <Text style={styles.error} selectable>{error}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.submit,
                !canSubmit && styles.submitDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.submitText} selectable>{isSubmitting ? 'Creating…' : 'Create account'}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/profile/sign-in" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleCard({
  label,
  description,
  icon,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        selected && styles.roleCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.roleIconWrap, selected && styles.roleIconWrapSelected]}>
        <Ionicons name={icon} size={22} color={selected ? GrottoTokens.white : GrottoTokens.gold} />
      </View>
      <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]} selectable>{label}</Text>
      <Text style={[styles.roleHint, selected && styles.roleHintSelected]} selectable>{description}</Text>
      {selected && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={11} color={GrottoTokens.white} />
        </View>
      )}
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel} selectable>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Layout.spacing.md,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.md,
  },
  heading: {
    fontFamily: FontFamily.serifBold,
    fontSize: 28,
    color: GrottoTokens.textPrimary,
  },
  subheading: {
    marginTop: -6,
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    lineHeight: 20,
  },
  roleRow: {
    flexDirection: 'row',
    gap: Layout.spacing.md,
    marginTop: Layout.spacing.sm,
  },
  roleCard: {
    flex: 1,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.lg,
    paddingVertical: Layout.spacing.xl,
    gap: 10,
    boxShadow: `0 10px 26px ${GrottoTokens.shadow}`,
  },
  roleCardSelected: {
    backgroundColor: GrottoTokens.goldSubtle,
    borderColor: GrottoTokens.gold,
    boxShadow: `0 12px 30px ${GrottoTokens.shadowMedium}`,
  },
  roleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Layout.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.goldSubtle,
    borderWidth: 1,
    borderColor: GrottoTokens.goldMuted,
  },
  roleIconWrapSelected: {
    backgroundColor: GrottoTokens.gold,
    borderColor: GrottoTokens.gold,
  },
  roleLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 17,
    color: GrottoTokens.textPrimary,
  },
  roleLabelSelected: {
    color: GrottoTokens.textPrimary,
  },
  roleHint: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    lineHeight: 17,
  },
  roleHintSelected: {
    color: GrottoTokens.textSecondary,
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    marginTop: Layout.spacing.sm,
    gap: Layout.spacing.md,
  },
  field: {
    gap: Layout.spacing.xs,
  },
  fieldLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  input: {
    height: 48,
    borderRadius: Layout.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    backgroundColor: GrottoTokens.white,
    paddingHorizontal: Layout.spacing.md,
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  submit: {
    marginTop: Layout.spacing.sm,
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    boxShadow: `0 10px 24px ${GrottoTokens.shadowMedium}`,
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
  error: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.error,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.sm,
  },
  footerText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
  },
  footerLink: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.gold,
  },
});

