import { GrottoTokens } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface BoostBadgeProps {
  label?: string;
}

export function BoostBadge({ label = 'Boosted' }: BoostBadgeProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="star" size={10} color={GrottoTokens.white} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GrottoTokens.gold,
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 3,
  },
  icon: {
    // inline icon
  },
  label: {
    color: GrottoTokens.white,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
