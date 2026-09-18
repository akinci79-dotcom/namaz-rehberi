import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PoseAssistState } from '../pose/usePoseAssist';
import type { Theme } from '../theme/colors';

interface Props {
  theme: Theme;
  enabled: boolean;
  onToggle: () => void;
  assist: PoseAssistState;
  /** Kamera açıkken canlı önizleme yüksekliği (ekranın ~%40–55’i). */
  previewHeight: number;
}

export function CameraAssistBar({ theme, enabled, onToggle, assist, previewHeight }: Props) {
  const live =
    enabled && (assist.status === 'running' || assist.status === 'loading' || assist.status === 'degraded');

  return (
    <View style={enabled ? styles.stack : undefined}>
      {enabled ? (
        <View
          style={[
            styles.stage,
            {
              height: previewHeight,
              backgroundColor: theme.bg,
              borderColor: theme.border,
            },
          ]}
        >
          <PreviewMount theme={theme} active={live} attach={assist.attachPreview} large />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.overlayTop}>
              <ToggleChip theme={theme} enabled={enabled} onToggle={onToggle} />
              <Text style={styles.frameHint}>Ayakta ve secdede tüm gövdeye yer bırakın</Text>
            </View>
            <View
              style={[
                styles.overlayBottom,
                assist.passedFlash ? styles.overlayPassed : null,
              ]}
            >
              <Text style={[styles.statusOn, assist.passedFlash ? styles.statusPassed : null]}>
                {assist.statusText}
              </Text>
              <Text style={[styles.debugOn, assist.passedFlash ? styles.debugPassed : null]}>
                {assist.debugLine}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ToggleChip theme={theme} enabled={enabled} onToggle={onToggle} />
          <Text style={[styles.statusOff, { color: theme.textMuted }]}>{assist.statusText}</Text>
        </View>
      )}
    </View>
  );
}

function ToggleChip({
  theme,
  enabled,
  onToggle,
}: {
  theme: Theme;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onToggle}
      style={[
        styles.toggle,
        {
          backgroundColor: enabled ? 'rgba(212,168,75,0.95)' : theme.surfaceRaised,
          borderColor: enabled ? 'rgba(255,255,255,0.35)' : theme.border,
        },
      ]}
    >
      <Text style={[styles.toggleText, { color: enabled ? '#1A1408' : theme.text }]}>
        {enabled ? 'Takibi kapat' : 'Kamerayla rekât takibi'}
      </Text>
    </Pressable>
  );
}

function PreviewMount({
  theme,
  active,
  attach,
  large,
}: {
  theme: Theme;
  active: boolean;
  attach: (host: HTMLElement | null) => void;
  large?: boolean;
}) {
  const setHost = (node: View | null) => {
    attach(active ? resolveHtmlElement(node) : null);
  };

  return (
    <View
      ref={setHost}
      style={[
        large ? styles.previewLarge : styles.preview,
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
  stack: {
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  stage: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewLarge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  overlayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  overlayBottom: {
    backgroundColor: 'rgba(8,10,9,0.72)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  overlayPassed: {
    backgroundColor: 'rgba(212,168,75,0.92)',
  },
  statusPassed: {
    color: '#1A1408',
  },
  debugPassed: {
    color: '#3A2E14',
  },
  frameHint: {
    flex: 1,
    color: '#F4EFE4',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusOn: {
    color: '#F8F3E8',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  debugOn: {
    color: '#C8C0B0',
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  statusOff: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
});
