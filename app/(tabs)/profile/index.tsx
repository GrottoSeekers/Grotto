import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useSessionStore } from '@/store/session-store';
import { getCurrentUserFromDb, signOutDb } from '@/lib/auth';

export default function ProfileIndexScreen() {
  const router = useRouter();
  const { currentUser, isLoading, setUser, clearUser, setLoadingDone } = useSessionStore();

  useEffect(() => {
    getCurrentUserFromDb()
      .then((user) => {
        if (user) setUser(user);
        else clearUser();
      })
      .catch(() => setLoadingDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await signOutDb();
    clearUser();
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-circle-outline" size={40} color={GrottoTokens.goldMuted} />
      </View>
    );
  }

  // ── Signed in ────────────────────────────────────────────────────────────
  if (currentUser) {
    return (
      <View style={styles.container}>
        <View style={styles.signedInCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={GrottoTokens.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{currentUser.name}</Text>
            <Text style={styles.meta}>
              {currentUser.role === 'sitter' ? 'Sitter' : currentUser.role === 'owner' ? 'Owner' : 'Member'}
              {currentUser.email ? ` · ${currentUser.email}` : ''}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={16} color={GrottoTokens.textPrimary} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  // ── Not signed in ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Icon + branding */}
      <View style={styles.brandRow}>
        <View style={styles.iconRing}>
          <Ionicons name="home" size={28} color={GrottoTokens.gold} />
        </View>
      </View>

      {/* Heading */}
      <Text style={styles.heading}>Find your perfect{'\n'}house sit</Text>
      <Text style={styles.body}>
        Connect with trusted pet lovers around the world and open your home to passionate travellers.
      </Text>

      {/* Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => router.push('/profile/sign-up')}
        >
          <Text style={styles.primaryBtnText}>Create an account</Text>
          <Ionicons name="arrow-forward" size={16} color={GrottoTokens.white} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => router.push('/profile/sign-in')}
        >
          <Text style={styles.secondaryBtnText}>Sign in to your account</Text>
          <Ionicons name="arrow-forward" size={16} color={GrottoTokens.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.offWhite,
  },
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.lg,
  },

  // ── Signed in ──────────────────────────────────────────────────────────────
  signedInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    padding: Layout.spacing.lg,
    boxShadow: `0 10px 26px ${GrottoTokens.shadow}`,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GrottoTokens.goldMuted,
  },
  name: {
    fontFamily: FontFamily.serifBold,
    fontSize: 18,
    color: GrottoTokens.textPrimary,
  },
  meta: {
    marginTop: 2,
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  signOutBtn: {
    marginTop: Layout.spacing.lg,
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
  },
  signOutText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 14,
    color: GrottoTokens.textPrimary,
  },

  // ── Not signed in ─────────────────────────────────────────────────────────
  brandRow: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
    marginTop: Layout.spacing.lg,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.goldSubtle,
    borderWidth: 1.5,
    borderColor: GrottoTokens.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: FontFamily.serifBold,
    fontSize: 30,
    lineHeight: 38,
    color: GrottoTokens.textPrimary,
  },
  body: {
    marginTop: Layout.spacing.sm,
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: GrottoTokens.textSecondary,
  },
  actions: {
    marginTop: Layout.spacing.xl,
    gap: Layout.spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 16,
    paddingHorizontal: Layout.spacing.xl,
    boxShadow: `0 10px 24px rgba(201,168,76,0.38)`,
  },
  primaryBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    paddingVertical: 16,
    paddingHorizontal: Layout.spacing.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  secondaryBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
