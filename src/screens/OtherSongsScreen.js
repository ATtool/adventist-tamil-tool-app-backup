import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';

export default function OtherSongsScreen() {
  const navigation = useNavigation();
  const { colors, appFontSize } = useSettings();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={colors.text} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 4 }]}>
          இதர பாடல்கள்
        </Text>
        
        <View style={{ width: 40 }} /> 
      </View>

      <View style={styles.content}>
        <Ionicons name="library-outline" size={64} color={colors.border} style={{ marginBottom: 20 }} />
        <Text style={{ color: colors.text, fontSize: appFontSize }}>Other Songs List</Text>
        <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, marginTop: 10 }}>Coming Soon...</Text>
      </View>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1 },
  backButton: { padding: 5 },
  headerTitle: { fontFamily: 'Tamil003', flex: 1, textAlign: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }
});
