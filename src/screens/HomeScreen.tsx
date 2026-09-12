import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DisclaimerCard } from '../components/DisclaimerCard';
import { MadhabBadge } from '../components/MadhabBadge';
import { PrayerCard } from '../components/PrayerCard';
import { PRAYERS } from '../data';
import type { Theme } from '../theme/colors';
import type { PrayerId } from '../types/prayer';

interface Props {
  theme: Theme;
  onSelect: (id: PrayerId) => void;
}

export function HomeScreen({ theme, onSelect }: Props) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <MadhabBadge theme={theme} />
          <Text style={[styles.title, { color: theme.text }]}>Namaz Rehberi</Text>
          <Text style={[styles.lead, { color: theme.textMuted }]}>
            Telefonunu veya tableti önüne koy. Farz namazı veya vitiri seç; büyük yazılar
            hangi rekâtta olduğunu ve sıradaki hareketi gösterir.
          </Text>
        </View>

        <View style={styles.list}>
          {PRAYERS.map((prayer) => (
            <PrayerCard
              key={prayer.id}
              prayer={prayer}
              theme={theme}
              onPress={() => onSelect(prayer.id)}
            />
          ))}
        </View>

        <DisclaimerCard theme={theme} />

        <Text style={[styles.footnote, { color: theme.textMuted }]}>
          Sünnet ve nafile yok. İlerleme Sonraki / Önceki ile veya isteğe bağlı kamera
          yardımcısıyla (görüntü cihazda kalır) yapılır.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 10,
    paddingBottom: 4,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  lead: {
    fontSize: 17,
    lineHeight: 24,
  },
  list: {
    gap: 12,
  },
  footnote: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
});
