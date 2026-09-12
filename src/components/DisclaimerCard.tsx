import { StyleSheet, Text, View } from 'react-native';

import { DISCLAIMER } from '../data';
import type { Theme } from '../theme/colors';

export function DisclaimerCard({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.accent }]}>Uyarı</Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>{DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
});
