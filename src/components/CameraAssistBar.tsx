import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PoseAssistState } from '../pose/usePoseAssist';
import type { Theme } from '../theme/colors';

interface Props {
  theme: Theme;
  enabled: boolean;
  onToggle: () => void;
  assist: PoseAssistState;
}

export function CameraAssistBar({ theme, enabled, onToggle, assist }: Props) {
  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <PreviewMount
        theme={theme}
        active={enabled && (assist.status === 'running' || assist.status === 'loading' || assist.status === 'degraded')}
        attach={assist.attachPreview}
      />
      <View style={styles.copy}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          onPress={onToggle}
          style={[
            styles.toggle,
            {
              backgroundColor: enabled ? theme.accent : theme.surfaceRaised,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.toggleText, { color: enabled ? theme.accentText : theme.text }]}>
            Kamera yardımcısı
          </Text>
        </Pressable>
        <Text style={[styles.status, { color: theme.textMuted }]}>{assist.statusText}</Text>
      </View>
    </View>
  );
}

function PreviewMount({
  theme,
  active,
  attach,
}: {
  theme: Theme;
  active: boolean;
  attach: (host: HTMLElement | null) => void;
}) {
  const setHost = (node: View | null) => {
    attach(active ? resolveHtmlElement(node) : null);
  };

  return (
    <View
      ref={setHost}
      style={[
        styles.preview,
        { backgroundColor: theme.bg, borderColor: theme.border, opacity: active ? 1 : 0.35 },
      ]}
    />
  );
}

function resolveHtmlElement(node: View | null): HTMLElement | null {
  if (!node) {
    return null;
  }
  const maybe = node as unknown as HTMLElement;
  return typeof maybe.appendChild === 'function' ? maybe : null;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  toggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '800',
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
  },
});
