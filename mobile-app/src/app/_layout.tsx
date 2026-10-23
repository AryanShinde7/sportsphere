import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LogBox } from 'react-native';

// Suppress unhandled asset download warnings on mobile network hiccups
LogBox.ignoreLogs([
  'Call to function \'ExpoAsset.downloadAsync\' has been rejected',
  'Unable to download asset from url',
]);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Layout() {
  // @expo/vector-icons loads its own fonts internally.
  // Do NOT manually load Ionicons.ttf here — it conflicts with the package's
  // internal font registration and causes intermittent broken icons.

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#111827',
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 14,
        },
        headerShadowVisible: true,
        contentStyle: { backgroundColor: '#F9FAFB' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen
        name="athlete/[id]"
        options={{
          title: 'Athlete Profile',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="support/[id]"
        options={{
          title: 'Support Athlete',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: 'My Profile',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
