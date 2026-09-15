import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clearSessionLog, getSessionLogText } from '../pose/sessionLog';
import type { Theme } from '../theme/colors';

interface Props {
  visible: boolean;
  theme: Theme;
  onClose: () => void;
}

/**
 * Namaz sırasında telefona bakılamadığı için kamera oturumu boyunca ne
 * olduğunu (adım/algı/çerçeve/ilerleme) canlı gözlemlemek imkansız. Bu ekran,
 * usePoseAssist'in sessizce tuttuğu kaydı gösterir — namazdan sonra buraya
 * bakıp metni kopyalayarak paylaşabilirsiniz.
 */
export function DiagnosticsModal({ visible, theme, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const text = visible ? getSessionLogText() : '';

  const handleCopy = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Kopyalama desteklenmiyorsa kullanıcı metni elle seçip kopyalayabilir.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Kamera oturumu kaydı</Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            En son kamera açılışından bu yana ne olduğunun kaydı. Metni seçip kopyalayıp
            paylaşabilirsiniz.
          </Text>
          <ScrollView style={[styles.logBox, { borderColor: theme.border }]}>
            <Text selectable style={[styles.logText, { color: theme.text }]}>
              {text}
            </Text>
          </ScrollView>
          <View style={styles.row}>
            <Pressable
              onPress={() => {
                clearSessionLog();
                onClose();
              }}
              style={[styles.btn, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
            >
              <Text style={[styles.btnText, { color: theme.text }]}>Temizle</Text>
            </Pressable>
            {Platform.OS === 'web' ? (
              <Pressable onPress={handleCopy} style={[styles.btn, { backgroundColor: theme.accent }]}>
                <Text style={[styles.btnText, { color: theme.accentText }]}>
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              style={[styles.btn, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
            >
              <Text style={[styles.btnText, { color: theme.text }]}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    maxWidth: 640,
    width: '100%',
    maxHeight: '85%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  logBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    maxHeight: 420,
  },
  logText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
