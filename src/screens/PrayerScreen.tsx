import { useCallback, useMemo, useRef, useState } from 'react';
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

import { CameraAssistBar } from '../components/CameraAssistBar';
import { PrivacyModal } from '../components/PrivacyModal';
import { StepProgress } from '../components/StepProgress';
import { VoiceToggle } from '../components/VoiceToggle';
import { getNextTitle, getPrayer, getPrayerSteps, MADHAB_LABEL, rankLabel } from '../data';
import { usePoseAssist } from '../pose/usePoseAssist';
import { usePoseVoiceCues } from '../pose/usePoseVoiceCues';
import { usePracticeTimer } from '../pose/usePracticeTimer';
import type { Theme } from '../theme/colors';
import type { PrayerId, SittingKind } from '../types/prayer';
import { isVoiceMuted, setVoiceMuted, unlockSpeech } from '../voice/speech';
import { usePrayerVoice } from '../voice/usePrayerVoice';

const PRIVACY_KEY = 'namaz.cameraPrivacy.v1';

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

  const { width, height } = useWindowDimensions();
  const isWide = width >= 700;
  const previewHeight = Math.round(Math.min(560, Math.max(240, height * (isWide ? 0.42 : 0.5))));
  const prayer = getPrayer(prayerId);
  const steps = useMemo(() => getPrayerSteps(prayerId), [prayerId]);
  const step = steps[stepIndex];
  const nextTitle = getNextTitle(steps, stepIndex);
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= steps.length - 1;
  const [cameraOn, setCameraOn] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [voiceMuted, setVoiceMutedState] = useState(isVoiceMuted);

  const indexRef = useRef(stepIndex);
  indexRef.current = stepIndex;
  const lastRef = useRef(isLast);
  lastRef.current = isLast;

  const goPrev = useCallback(() => {
    if (indexRef.current <= 0) {
      return;
    }
    onHaptic('light');
    onIndexChange(indexRef.current - 1);
  }, [onHaptic, onIndexChange]);

  const advanceStep = useCallback(() => {
    onHaptic('medium');
    if (lastRef.current) {
      onComplete();
      return;
    }
    onIndexChange(indexRef.current + 1);
  }, [onComplete, onHaptic, onIndexChange]);

  const jumpStep = useCallback((newIndex: number) => {
    onHaptic('medium');
    if (newIndex >= steps.length) {
      onComplete();
      return;
    }
    onIndexChange(newIndex);
  }, [onComplete, onHaptic, onIndexChange, steps.length]);

  const goNext = useCallback(() => {
    unlockSpeech();
    advanceStep();
  }, [advanceStep]);

  const assist = usePoseAssist({
    enabled: cameraOn,
    steps,
    stepIndex,
    onAdvance: advanceStep,
    onJump: jumpStep,
  });

  usePracticeTimer({
    enabled: !cameraOn,
    steps,
    stepIndex,
    onAdvance: advanceStep,
  });

  usePrayerVoice(prayerId, steps, stepIndex, !voiceMuted);
  usePoseVoiceCues(cameraOn && !voiceMuted, assist);

  const requestCamera = () => {
    if (cameraOn) {
      setCameraOn(false);
      return;
    }
    const accepted = typeof localStorage !== 'undefined' && localStorage.getItem(PRIVACY_KEY) === '1';
    if (!accepted) {
      setPrivacyOpen(true);
      return;
    }
    unlockSpeech();
    setCameraOn(true);
  };

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

  const titleSize = cameraOn ? (isWide ? 36 : 28) : isWide ? 56 : 42;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={styles.shell}>
        <View style={styles.topBar}>
          <View style={styles.topCopy}>
            <Text style={[styles.prayerName, { color: theme.text }]}>
              {prayer.name} · {MADHAB_LABEL}
            </Text>
            <Text style={[styles.prayerMeta, { color: theme.textMuted }]}>
              {prayer.rakahCount} rekât {rankLabel(prayer).toLocaleLowerCase('tr-TR')}
            </Text>
          </View>
          <VoiceToggle
            theme={theme}
            muted={voiceMuted}
            onToggle={() => {
              const nextMuted = !voiceMuted;
              setVoiceMuted(nextMuted);
              setVoiceMutedState(nextMuted);
              if (!nextMuted) {
                unlockSpeech();
              }
            }}
          />
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

        {!cameraOn ? <StepProgress index={stepIndex} total={steps.length} theme={theme} /> : null}

        <CameraAssistBar
          theme={theme}
          enabled={cameraOn}
          onToggle={requestCamera}
          assist={assist}
          previewHeight={previewHeight}
        />
        {!cameraOn ? (
          <Text style={[styles.practiceLabel, { color: theme.textMuted }]}>
            Süre ile prova (kamerasız)
          </Text>
        ) : null}

        <PrivacyModal
          visible={privacyOpen}
          theme={theme}
          onCancel={() => setPrivacyOpen(false)}
          onAccept={() => {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(PRIVACY_KEY, '1');
            }
            setPrivacyOpen(false);
            unlockSpeech();
            setCameraOn(true);
          }}
        />

        <ScrollView
          style={styles.stageScroll}
          contentContainerStyle={[styles.stageContent, cameraOn && styles.stageContentCamera]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sonraki adıma geç"
            onPress={goNext}
            style={[styles.stageInner, cameraOn && styles.stageInnerCamera]}
          >
            <Text style={[styles.rakah, { color: theme.accent, fontSize: cameraOn ? 22 : 28 }]}>
              Rekât {step.rakah} / {step.totalRakah}
            </Text>

            {step.sitting ? (
              <Text style={[styles.sitting, { color: theme.textMuted }]}>
                {SITTING_LABEL[step.sitting]}
              </Text>
            ) : null}

            {assist.cue ? (
              <Text style={[styles.cue, { color: theme.accent, fontSize: cameraOn ? 22 : 26 }]}>
                {assist.cue}
              </Text>
            ) : null}

            <Text
              style={[
                styles.stepTitle,
                { color: theme.text, fontSize: titleSize, lineHeight: titleSize + 6 },
              ]}
            >
              {step.title}
            </Text>

            {!cameraOn ? (
              <Text style={[styles.instruction, { color: theme.text }]}>{step.instruction}</Text>
            ) : null}

            {!cameraOn && step.arabic ? (
              <Text style={[styles.arabic, { color: theme.arabic }]}>{step.arabic}</Text>
            ) : null}

            <View
              style={[
                styles.nextBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
                cameraOn && styles.nextBoxCamera,
              ]}
            >
              <Text style={[styles.nextLabel, { color: theme.textMuted }]}>Sıradaki</Text>
              <Text style={[styles.nextTitle, { color: theme.text, fontSize: cameraOn ? 18 : 22 }]}>
                {nextTitle ?? 'Namazı tamamla'}
              </Text>
            </View>

            {!cameraOn ? (
              <Text style={[styles.tapHint, { color: theme.textMuted }]}>
                Süre ile prova (kamerasız). Dokunarak da geçebilirsiniz. Rekât bitince bir kez sayı.
              </Text>
            ) : null}
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
              cameraOn && styles.navBtnCamera,
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
              cameraOn && styles.navBtnCamera,
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
    gap: 10,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
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
  stageContentCamera: {
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  stageInner: {
    gap: 12,
  },
  stageInnerCamera: {
    gap: 6,
  },
  nextBoxCamera: {
    paddingVertical: 8,
    marginTop: 0,
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
  cue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 32,
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
  practiceLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
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
  navBtnCamera: {
    minHeight: 58,
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
