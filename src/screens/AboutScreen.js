import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../context/SettingsContext';

export default function AboutScreen() {
  const { colors } = useSettings();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>About the App</Text>
      <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 16 }}>Coming Soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }
});
