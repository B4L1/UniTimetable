import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '@/stores/appStore';

console.log('[RootLayout File] File is being executed/imported');

export default function RootLayout() {
  console.log('[RootLayout debug] Rendering minimal layout');

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: 'blue', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 24, color: 'white', fontWeight: 'bold' }}>MINIMAL LAYOUT WORKS</Text>
        <Text style={{ color: 'white', marginTop: 10 }}>If you see this, native code is fine.</Text>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000088',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
