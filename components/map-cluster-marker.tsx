import { GrottoTokens, FontFamily } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

interface MapClusterMarkerProps {
  count?: number;
  isSelected?: boolean;
}

export function MapClusterMarker({ count = 1, isSelected = false }: MapClusterMarkerProps) {
  const isCluster = count > 1;
  return (
    <View style={styles.wrapper}>
      <View style={[styles.pill, isSelected && styles.pillSelected]}>
        <Text style={[styles.label, isSelected && styles.labelSelected]}>
          {isCluster ? `${count} sits` : '1 sit'}
        </Text>
      </View>
      <View style={[styles.pointer, isSelected && styles.pointerSelected]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  pill: {
    backgroundColor: GrottoTokens.gold,
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pillSelected: {
    backgroundColor: GrottoTokens.textPrimary,
  },
  label: {
    color: GrottoTokens.white,
    fontSize: 12,
    fontFamily: FontFamily.sansSemiBold,
    letterSpacing: 0.2,
  },
  labelSelected: {
    color: GrottoTokens.white,
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: GrottoTokens.gold,
    marginTop: -1,
  },
  pointerSelected: {
    borderTopColor: GrottoTokens.textPrimary,
  },
});
