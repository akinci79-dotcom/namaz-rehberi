import { Pressable, StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme/colors';

interface Props {
  theme: Theme;
  muted: boolean;
  onToggle: () => void;
}

export function VoiceToggle({ theme, muted, onToggle }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: !muted }}
      accessibilityLabel={muted ? 'Sesi aç' : 'Sesi kapat'}
      onPress={onToggle}
      style={[
        styles.btn,
        {
          backgroundColor: muted ? theme.surfaceRaised : theme.accentSoft,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.text, { color: muted ? theme.textMuted : theme.accent }]}>
        {muted ? 'Ses kapalı' : 'Ses açık'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '800',
  },
});
