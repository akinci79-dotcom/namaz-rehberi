import { StyleSheet, Text, View } from 'react-native';

import { MADHAB_LABEL } from '../data';
import type { Theme } from '../theme/colors';

export function MadhabBadge({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
      <Text style={[styles.text, { color: theme.badgeText }]}>{MADHAB_LABEL} · Farz ve Vitir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
