/**
 * Root layout — the single app shell that wraps every screen.
 *
 * Expo Router renders this file once for the lifetime of the app. Its
 * responsibilities are:
 *
 * 1. **Font loading** — Inter (400/500/600/700 weights) plus Ionicons and
 *    MaterialCommunityIcons icon fonts are loaded asynchronously. The icon
 *    fonts must be explicitly pre-loaded on Android (iOS loads them lazily).
 *    The splash screen is held open until fonts are ready (or have failed to
 *    load), preventing a flash of unstyled text on first render.
 *
 * 2. **Provider nesting** — React context providers are ordered carefully:
 *
 *      SafeAreaProvider
 *        ErrorBoundary         ← catches any render crash and shows a fallback
 *          QueryClientProvider ← React Query — owns the API mutation cache
 *            GestureHandlerRootView ← required for react-native-gesture-handler
 *              HistoryProvider ← outermost data provider (no dependencies)
 *                StreakProvider ← reads history-independent streak data
 *                  GameProvider ← innermost — can read history/streak if needed
 *                    AuthProvider       ← optional self-hosted login (JWT in AsyncStorage)
 *                      SpiritAnimalProvider
 *                        Tabs + TabBar
 *
 * 3. **API base URL** — `setBaseUrl()` is called at module load time (before
 *    any component mounts) so the React Query hooks can construct correct URLs
 *    immediately. `EXPO_PUBLIC_DOMAIN` is set by the Replit workspace.
 *
 * 4. **Tab navigation** — the two tabs (Reframe / History) share this layout.
 *    `headerShown: false` gives each screen full control over its header area.
 *    The custom `TabBar` component replaces Expo Router's default tab bar with
 *    the glassmorphic design that matches the app's dark aesthetic.
 *
 * 5. **Full-screen modal routes** — routes like `spirit-animal-quiz` are
 *    registered with `href: null` so they don't appear in the tab bar. The
 *    custom `TabBar` hides itself when such routes are active, giving a true
 *    full-screen experience.
 */

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GameProvider } from "@/context/GameContext";
import { HistoryProvider } from "@/context/HistoryContext";
import { TabBar } from "@/components/TabBar";
import { StreakProvider } from "@/context/StreakContext";
import { seedIfEmpty } from "@/utils/seedData";
import { JournalSessionProvider } from "@/context/JournalSessionContext";
import { applyReminderPreference } from "@/utils/notifications";
import { SpiritAnimalProvider } from "@/context/SpiritAnimalContext";
import { AuthProvider } from "@/context/AuthContext";

// Configure the API client before any hooks can run
const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (!domain) {
  console.warn(
    "EXPO_PUBLIC_DOMAIN is not set — API calls will fail. " +
    "Set this environment variable to the domain where the API server is reachable.",
  );
}
setBaseUrl(domain ? `https://${domain}` : "");

// Keep the native splash screen up while fonts load
SplashScreen.preventAutoHideAsync();
seedIfEmpty();

// Routes where the TabBar should be hidden to allow full-screen presentation
const HIDDEN_TAB_BAR_ROUTES = new Set(["spirit-animal-quiz", "onboarding", "profile"]);

// A single QueryClient instance for the app lifetime — React Query manages
// caching, deduplication, and background refetching for API calls
const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    // Hide the splash screen once fonts are loaded or have definitively failed.
    // Waiting for fontError too avoids an infinite splash screen if the CDN
    // is unavailable; the app will render with system fonts instead.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      applyReminderPreference().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Check if user has completed onboarding — redirect if not
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    AsyncStorage.getItem("onboarding_completed").then((val) => {
      if (!val) {
        router.replace("/onboarding");
      }
      setOnboardingChecked(true);
    }).catch(() => setOnboardingChecked(true));
  }, [fontsLoaded, fontError]);

  // Show a solid black view while fonts are still loading to prevent a
  // flicker of unstyled content before the splash screen hides
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
            <HistoryProvider>
              <StreakProvider>
                <GameProvider>
                  <JournalSessionProvider>
                    <AuthProvider>
                    <SpiritAnimalProvider>
                      <Tabs
                        tabBar={(props) => {
                          const routeName = props.state.routes[props.state.index]?.name ?? "";
                          if (HIDDEN_TAB_BAR_ROUTES.has(routeName)) return null;
                          return <TabBar {...props} />;
                        }}
                        screenOptions={{ headerShown: false }}
                        initialRouteName="history"
                      >
                        <Tabs.Screen name="index" options={{ title: "Speak" }} />
                        <Tabs.Screen name="history" options={{ title: "Shape" }} />
                        <Tabs.Screen name="flashcards" options={{ title: "Own" }} />
                        <Tabs.Screen name="discuss" options={{ title: "Discuss", href: null }} />
                        <Tabs.Screen name="journal" options={{ title: "Journal", href: null }} />
                        <Tabs.Screen name="journal-feedback" options={{ title: "Session Complete", href: null }} />
                        <Tabs.Screen name="spirit-animal-quiz" options={{ title: "Spirit Animal", href: null }} />
                        <Tabs.Screen name="profile" options={{ title: "Profile", href: null }} />
                        <Tabs.Screen name="onboarding" options={{ title: "Welcome", href: null }} />
                      </Tabs>
                    </SpiritAnimalProvider>
                    </AuthProvider>
                  </JournalSessionProvider>
                </GameProvider>
              </StreakProvider>
            </HistoryProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
