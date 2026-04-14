import { GrottoTokens } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View, ViewStyle } from 'react-native';

interface SearchPillProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchPill({ value, onChangeText, placeholder = 'Search destinations…', style }: SearchPillProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="search" size={18} color={GrottoTokens.gold} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={GrottoTokens.textMuted}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Layout.searchPillHeight,
    backgroundColor: GrottoTokens.white,
    borderRadius: Layout.radius.full,
    borderWidth: 1,
    borderColor: GrottoTokens.borderSubtle,
    paddingHorizontal: Layout.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    marginRight: Layout.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: GrottoTokens.textPrimary,
  },
});
