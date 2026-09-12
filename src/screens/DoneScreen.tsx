import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPrayer, getPrayerSteps, MADHAB_LABEL, rankLabel } from '../data';
import type { Theme } from '../theme/colors';
import type { PrayerId } from '../types/prayer';

interface Props {
  theme: Theme;
  prayerId: PrayerId;
  onHome: () => void;
  onRepeat: () => void;
}

export function DoneScreen({ theme, prayerId, onHome, onRepeat }: Props) {
  const prayer = getPrayer(prayerId);
  const steps = getPrayerSteps(prayerId);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: theme.accent }]}>
          {prayer.name} · {MADHAB_LABEL}
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>Namaz tamamlandı</Text>
        <Text style={[styles.lead, { color: theme.textMuted }]}>
          {prayer.rakahCount} rekât {rankLabel(prayer).toLocaleLowerCase('tr-TR')}, {steps.length}{' '}
          adım. Allah kabul etsin.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardText, { color: theme.textMuted }]}>
            Bu bir hatırlatma yardımcısıdır; namazın geçerliliği niyetinize, abdestinize ve
            kıldığınız namaza bağlıdır. Şüphede kaldığınız noktayı güvenilir bir âlime sorunuz.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onRepeat}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: theme.accent, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={[styles.btnText, { color: theme.accentText }]}>Tekrar başlat</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onHome}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: theme.surfaceRaised,
              borderColor: theme.border,
              borderWidth: 1,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: theme.text }]}>Ana sayfa</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  kicker: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  lead: {
    fontSize: 20,
    lineHeight: 28,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  cardText: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    gap: 12,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  btn: {
    minHeight: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 20,
    fontWeight: '800',
  },
});
