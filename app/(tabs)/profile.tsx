import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>Profile</Text>
      <View style={styles.empty}>
        <Ionicons name="person-circle-outline" size={64} color={GrottoTokens.goldMuted} />
        <Text style={styles.emptyTitle}>Not signed in</Text>
        <Text style={styles.emptyBody}>
          Sign in to manage your profile, track your sits, and connect with the Grotto community.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GrottoTokens.offWhite,
  },
  heading: {
    fontFamily: FontFamily.serifBold,
    fontSize: 28,
    color: GrottoTokens.textPrimary,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
    gap: Layout.spacing.md,
    marginBottom: Layout.tabBarHeight,
  },
  emptyTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 18,
    color: GrottoTokens.textPrimary,
  },
  emptyBody: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: GrottoTokens.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
