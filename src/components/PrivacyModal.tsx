import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme/colors';

export const CAMERA_PRIVACY =
  'Kamera yardımcısı ön kamerayı kullanarak duruşunuzu (kıyam, rükû, secde, oturuş) bu cihazda tanır. Görüntü kareleri sunucuya yüklenmez, kaydedilmez ve başka bir yere gönderilmez. İzni istediğiniz an kapatabilirsiniz.';

interface Props {
  visible: boolean;
  theme: Theme;
  onAccept: () => void;
  onCancel: () => void;
}

export function PrivacyModal({ visible, theme, onAccept, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Kamera gizliliği</Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>{CAMERA_PRIVACY}</Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            HTTPS gerekir (bu sayfa zaten güvenli). Telefonu yere yakın ve yeterince geride bir
            yere yaslayın; ayakta dururken baştan dizlere kadar tüm gövde kadrajda kalsın. Dizler
            görünmezse secde ve oturuş güvenle ayırt edilemez. Namaz sırasında ekrana bakmadığınız
            için telefonu tam karşınıza değil, hafif yandan (yaklaşık 30-45 derece açıyla) yerleştirin
            — rükûdaki öne eğilme bu açıdan çok daha net görülür. Kamera açıkken süreyle adım
            atılmaz: sonraki duruş görünür ve tutulursa geçer, ya da Sonraki’ye basarsınız. Aynı
            duruştaki metinler (niyet → tekbir) için Sonraki gerekir.
          </Text>
          <View style={styles.row}>
            <Pressable
              onPress={onCancel}
              style={[styles.btn, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
            >
              <Text style={[styles.btnText, { color: theme.text }]}>Vazgeç</Text>
            </Pressable>
            <Pressable onPress={onAccept} style={[styles.btn, { backgroundColor: theme.accent }]}>
              <Text style={[styles.btnText, { color: theme.accentText }]}>Anladım, aç</Text>
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
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
