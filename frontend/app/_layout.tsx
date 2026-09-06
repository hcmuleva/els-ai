import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '../src/context/AuthContext';
import { StudentProfileProvider } from '../src/context/StudentProfileContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { AiChatProvider } from '../src/context/AiChatContext';
import { queryClient } from '../src/config/queryClient';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationProvider>
              <StudentProfileProvider>
                <AiChatProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="story/[id]" options={{ headerShown: false }} />
                  </Stack>
                </AiChatProvider>
              </StudentProfileProvider>
            </NotificationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
