import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepProgress } from '../components/StepProgress';
import { getNextTitle, getPrayer, getPrayerSteps, MADHAB_LABEL } from '../data';
import type { Theme } from '../theme/colors';
import type { PrayerId, SittingKind } from '../types/prayer';

interface Props {
  theme: Theme;
  prayerId: PrayerId;
  stepIndex: number;
  onIndexChange: (index: number) => void;
  onExit: () => void;
  onComplete: () => void;
  onHaptic: (kind: 'light' | 'medium') => void;
}

const SITTING_LABEL: Record<SittingKind, string> = {
  first: 'İlk oturuş',
  middle: 'Celse',
  last: 'Son oturuş',
};

export function PrayerScreen({
  theme,
  prayerId,
  stepIndex,
  onIndexChange,
  onExit,
  onComplete,
  onHaptic,
}: Props) {
  useKeepAwake();

  const { width } = useWindowDimensions();
  const isWide = width >= 700;
  const prayer = getPrayer(prayerId);
  const steps = useMemo(() => getPrayerSteps(prayerId), [prayerId]);
  const step = steps[stepIndex];
  const nextTitle = getNextTitle(steps, stepIndex);
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= steps.length - 1;

  if (!step) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: theme.text }]}>Adım bulunamadı.</Text>
          <Pressable onPress={onExit} style={[styles.exitBtn, { backgroundColor: theme.surface }]}>
            <Text style={[styles.exitLabel, { color: theme.accent }]}>Ana sayfa</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const goPrev = () => {
    if (isFirst) {
      return;
    }
    onHaptic('light');
    onIndexChange(stepIndex - 1);
  };

  const goNext = () => {
    onHaptic('medium');
    if (isLast) {
      onComplete();
      return;
    }
    onIndexChange(stepIndex + 1);
  };

  const titleSize = isWide ? 56 : 42;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={styles.shell}>
        <View style={styles.topBar}>
          <View style={styles.topCopy}>
            <Text style={[styles.prayerName, { color: theme.text }]}>
              {prayer.name} · {MADHAB_LABEL}
            </Text>
            <Text style={[styles.prayerMeta, { color: theme.textMuted }]}>
              {prayer.rakahCount} rekât farz
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Namazı bitir ve çık"
            onPress={onExit}
            hitSlop={8}
            style={[styles.exitBtn, { backgroundColor: theme.dangerSoft }]}
          >
            <Text style={[styles.exitLabel, { color: theme.danger }]}>Bitir</Text>
          </Pressable>
        </View>

        <StepProgress index={stepIndex} total={steps.length} theme={theme} />

        <ScrollView
          style={styles.stageScroll}
          contentContainerStyle={styles.stageContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sonraki adıma geç"
            onPress={goNext}
            style={styles.stageInner}
          >
            <Text style={[styles.rakah, { color: theme.accent }]}>
              Rekât {step.rakah} / {step.totalRakah}
            </Text>

            {step.sitting ? (
              <Text style={[styles.sitting, { color: theme.textMuted }]}>
                {SITTING_LABEL[step.sitting]}
              </Text>
            ) : null}

            <Text
              style={[
                styles.stepTitle,
                { color: theme.text, fontSize: titleSize, lineHeight: titleSize + 8 },
              ]}
            >
              {step.title}
            </Text>

            <Text style={[styles.instruction, { color: theme.text }]}>{step.instruction}</Text>

            {step.arabic ? (
              <Text style={[styles.arabic, { color: theme.arabic }]}>{step.arabic}</Text>
            ) : null}

            <View
              style={[styles.nextBox, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.nextLabel, { color: theme.textMuted }]}>Sıradaki</Text>
              <Text style={[styles.nextTitle, { color: theme.text }]}>
                {nextTitle ?? 'Namazı tamamla'}
              </Text>
            </View>

            <Text style={[styles.tapHint, { color: theme.textMuted }]}>
              İlerlemek için yazıya dokun
            </Text>
          </Pressable>
        </ScrollView>

        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Önceki adım"
            disabled={isFirst}
            onPress={goPrev}
            style={({ pressed }) => [
              styles.navBtn,
              {
                backgroundColor: theme.surfaceRaised,
                borderColor: theme.border,
                opacity: isFirst ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.navText, { color: theme.text }]}>Önceki</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Namazı tamamla' : 'Sonraki adım'}
            onPress={goNext}
            style={({ pressed }) => [
              styles.navBtn,
              styles.navPrimary,
              {
                backgroundColor: theme.accent,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={[styles.navText, { color: theme.accentText }]}>
              {isLast ? 'Tamamla' : 'Sonraki'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 14,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topCopy: {
    flex: 1,
    gap: 2,
  },
  prayerName: {
    fontSize: 20,
    fontWeight: '700',
  },
  prayerMeta: {
    fontSize: 14,
  },
  exitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  exitLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  stageScroll: {
    flex: 1,
  },
  stageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  stageInner: {
    gap: 12,
  },
  rakah: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sitting: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  instruction: {
    fontSize: 20,
    lineHeight: 30,
  },
  arabic: {
    fontSize: 22,
    lineHeight: 38,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingVertical: 8,
  },
  nextBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  nextLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  nextTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  tapHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  nav: {
    flexDirection: 'row',
    gap: 12,
  },
  navBtn: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navPrimary: {
    flex: 1.25,
  },
  navText: {
    fontSize: 22,
    fontWeight: '800',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
  },
});
