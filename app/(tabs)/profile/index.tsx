import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useSessionStore } from '@/store/session-store';
import { getCurrentUserFromDb, signOutDb } from '@/lib/auth';
import GrottoLogo from '@/components/GrottoLogo';

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function memberSince(createdAt: string | null | undefined) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

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
    const since = memberSince(currentUser.createdAt);
    const roleLabel = currentUser.role === 'sitter' ? 'Sitter' : currentUser.role === 'owner' ? 'Owner' : 'Member';

    return (
      <ScrollView
        style={styles.scrollBg}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Profile</Text>

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {currentUser.avatarUrl ? (
              <Image
                source={{ uri: currentUser.avatarUrl }}
                style={styles.avatarImg}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.initials}>{getInitials(currentUser.name)}</Text>
              </View>
            )}
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel[0]}</Text>
            </View>
          </View>

          <Text style={styles.profileName}>{currentUser.name}</Text>
          {currentUser.location ? (
            <Text style={styles.profileLocation}>
              <Ionicons name="location-outline" size={13} color={GrottoTokens.textMuted} />
              {' '}{currentUser.location}
            </Text>
          ) : null}
          {since ? (
            <Text style={styles.profileSince}>Member since {since}</Text>
          ) : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>{currentUser.role === 'owner' ? 'Listings' : 'Sits'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{currentUser.reviewCount ?? 0}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {currentUser.rating && currentUser.rating > 0
                  ? currentUser.rating.toFixed(1)
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* ── Primary action ── */}
        <Pressable
          style={({ pressed }) => [styles.editProfileBtn, pressed && styles.pressed]}
          onPress={() => router.push('/profile/view')}
        >
          <Ionicons name="person-outline" size={18} color={GrottoTokens.white} />
          <Text style={styles.editProfileBtnText}>View & edit profile</Text>
          <Ionicons name="arrow-forward" size={16} color={GrottoTokens.white} />
        </Pressable>

        {/* ── Menu ── */}
        <View style={styles.menuCard}>
          {currentUser.role === 'sitter' ? (
            <>
              <MenuRow
                icon="eye-outline"
                label="Preview profile"
                sublabel="See how owners view your profile"
                onPress={() => router.push('/profile/preview')}
              />
              <View style={styles.menuDivider} />
              <MenuRow
                icon="ribbon-outline"
                label="Testimonials"
                onPress={() => router.push('/profile/testimonials')}
              />
              <View style={styles.menuDivider} />
            </>
          ) : null}
          <MenuRow
            icon="settings-outline"
            label="Settings"
            onPress={() => {}}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="help-circle-outline"
            label="Help & support"
            onPress={() => {}}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="shield-checkmark-outline"
            label="Privacy"
            onPress={() => {}}
          />
        </View>

        {/* ── Sign out ── */}
        <Pressable
          style={({ pressed }) => [styles.signOutRow, pressed && styles.pressed]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={18} color={GrottoTokens.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Not signed in ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <GrottoLogo size={72} variant="light" mark="house" />
      </View>
      <Text style={styles.heading}>Find your perfect{'\n'}house sit</Text>
      <Text style={styles.body}>
        Connect with trusted pet lovers around the world and open your home to passionate travellers.
      </Text>
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

function MenuRow({
  icon,
  label,
  sublabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={20} color={GrottoTokens.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sublabel ? <Text style={styles.menuSublabel}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={GrottoTokens.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GrottoTokens.offWhite,
  },
  scrollBg: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  scrollContent: {
    padding: Layout.spacing.md,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.lg,
    gap: Layout.spacing.md,
  },

  pageTitle: {
    fontFamily: FontFamily.serifBold,
    fontSize: 30,
    color: GrottoTokens.textPrimary,
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.xs,
  },

  // ── Profile card ──────────────────────────────────────────────────────────
  profileCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    alignItems: 'center',
    gap: 6,
    boxShadow: `0 8px 24px ${GrottoTokens.shadow}`,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.goldSubtle,
    borderWidth: 2,
    borderColor: GrottoTokens.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: Layout.radius.full,
    borderWidth: 2,
    borderColor: GrottoTokens.goldMuted,
  },
  initials: {
    fontFamily: FontFamily.serifBold,
    fontSize: 32,
    color: GrottoTokens.gold,
    lineHeight: 38,
  },
  roleBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: Layout.radius.full,
    backgroundColor: GrottoTokens.gold,
    borderWidth: 2,
    borderColor: GrottoTokens.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 11,
    color: GrottoTokens.white,
  },
  profileName: {
    fontFamily: FontFamily.serifBold,
    fontSize: 24,
    color: GrottoTokens.textPrimary,
    marginTop: 2,
  },
  profileLocation: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: GrottoTokens.textSecondary,
  },
  profileSince: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: GrottoTokens.borderSubtle,
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: FontFamily.serifBold,
    fontSize: 22,
    color: GrottoTokens.textPrimary,
  },
  statLabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: GrottoTokens.borderSubtle,
  },

  // ── Edit profile button ───────────────────────────────────────────────────
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GrottoTokens.gold,
    borderRadius: Layout.radius.full,
    paddingVertical: 15,
    paddingHorizontal: Layout.spacing.xl,
    boxShadow: `0 8px 20px rgba(201,168,76,0.35)`,
  },
  editProfileBtnText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    color: GrottoTokens.white,
    flex: 1,
    textAlign: 'center',
  },

  // ── Menu card ─────────────────────────────────────────────────────────────
  menuCard: {
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.xl,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    overflow: 'hidden',
    boxShadow: `0 4px 12px ${GrottoTokens.shadow}`,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.md,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Layout.radius.md,
    backgroundColor: GrottoTokens.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
  menuSublabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: GrottoTokens.textMuted,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: GrottoTokens.borderSubtle,
    marginLeft: 68,
  },

  // ── Sign out ──────────────────────────────────────────────────────────────
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    paddingVertical: Layout.spacing.md,
  },
  signOutText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    color: GrottoTokens.error,
  },

  // ── Not signed in ─────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.tabBarHeight + Layout.spacing.lg,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
    marginTop: Layout.spacing.lg,
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
