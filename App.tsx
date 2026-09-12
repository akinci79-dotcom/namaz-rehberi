import { useCallback, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { assertPrayerIntegrity } from './src/data/sanity';
import { DoneScreen } from './src/screens/DoneScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PrayerScreen } from './src/screens/PrayerScreen';
import { themeFromScheme } from './src/theme/colors';
import type { AppRoute, PrayerId } from './src/types/prayer';

if (__DEV__) {
  try {
    assertPrayerIntegrity();
  } catch (error) {
    console.error(error);
  }
}

export default function App() {
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFromScheme(scheme), [scheme]);
  const [route, setRoute] = useState<AppRoute>({ name: 'home' });
  const [stepIndex, setStepIndex] = useState(0);

  const openPrayer = useCallback((prayerId: PrayerId) => {
    setStepIndex(0);
    setRoute({ name: 'prayer', prayerId });
  }, []);

  const goHome = useCallback(() => {
    setStepIndex(0);
    setRoute({ name: 'home' });
  }, []);

  const haptic = useCallback(async (kind: 'light' | 'medium') => {
    try {
      await Haptics.impactAsync(
        kind === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    } catch {
      // Web / desteksiz cihaz: sessizce geç
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      {route.name === 'home' ? (
        <HomeScreen theme={theme} onSelect={openPrayer} />
      ) : null}
      {route.name === 'prayer' ? (
        <PrayerScreen
          theme={theme}
          prayerId={route.prayerId}
          stepIndex={stepIndex}
          onIndexChange={setStepIndex}
          onExit={goHome}
          onComplete={() => setRoute({ name: 'done', prayerId: route.prayerId })}
          onHaptic={haptic}
        />
      ) : null}
      {route.name === 'done' ? (
        <DoneScreen
          theme={theme}
          prayerId={route.prayerId}
          onHome={goHome}
          onRepeat={() => openPrayer(route.prayerId)}
        />
      ) : null}
    </SafeAreaProvider>
  );
}
