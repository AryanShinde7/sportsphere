import { Stack } from 'expo-router';

export default function Layout() {
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
    </Stack>
  );
}
