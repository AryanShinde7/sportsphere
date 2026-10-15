import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator, LogBox } from 'react-native';

// Suppress unhandled asset download warnings on mobile network hiccups
LogBox.ignoreLogs([
  'Call to function \'ExpoAsset.downloadAsync\' has been rejected',
  'Unable to download asset from url',
]);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    ionicons: require('../../assets/fonts/Ionicons.ttf'),
    Ionicons: require('../../assets/fonts/Ionicons.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E2550B" />
      </View>
    );
  }

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
