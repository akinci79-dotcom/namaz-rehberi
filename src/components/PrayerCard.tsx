import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PrayerDefinition } from '../types/prayer';
import type { Theme } from '../theme/colors';

interface Props {
  prayer: PrayerDefinition;
  theme: Theme;
  onPress: () => void;
}

export function PrayerCard({ prayer, theme, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${prayer.name} namazı, ${prayer.rakahCount} rekât farz`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: pressed ? theme.accent : theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={[styles.name, { color: theme.text }]}>{prayer.name}</Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>{prayer.summary}</Text>
        </View>
        <View style={[styles.count, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.countNumber, { color: theme.accent }]}>{prayer.rakahCount}</Text>
          <Text style={[styles.countLabel, { color: theme.accent }]}>rekât</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 92,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  meta: {
    fontSize: 15,
    lineHeight: 21,
  },
  count: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countNumber: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
