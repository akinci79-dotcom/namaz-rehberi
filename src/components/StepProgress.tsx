import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme/colors';

interface Props {
  index: number;
  total: number;
  theme: Theme;
}

export function StepProgress({ index, total, theme }: Props) {
  const ratio = total === 0 ? 0 : (index + 1) / total;

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: theme.progressTrack }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(ratio * 100)}%`, backgroundColor: theme.progressFill },
          ]}
        />
      </View>
      <Text style={[styles.label, { color: theme.textMuted }]}>
        Adım {index + 1} / {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  track: {
    height: 6,
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
