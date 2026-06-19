import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';

export default function SavedServices() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { colors, isDark, hapticsEnabled } = useSettings();
  
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  // Fetch services whenever the screen comes into focus
  useEffect(() => {
    if (isFocused) {
      loadSavedServices();
    }
  }, [isFocused]);

  const loadSavedServices = async () => {
    setIsLoading(true);
    try {
      const storedServices = await AsyncStorage.getItem('@saved_services');
      if (storedServices) {
        let parsed = JSON.parse(storedServices);
        // Sort by newest date first
        parsed.sort((a, b) => new Date(b.date) - new Date(a.date));
        setServices(parsed);
      } else {
        setServices([]);
      }
    } catch (error) {
      console.error("Error loading services:", error);
      Alert.alert("Error", "Could not load your saved services.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (id, name) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Service",
      `Are you sure you want to delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => deleteService(id) 
        }
      ]
    );
  };

  const deleteService = async (id) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const updatedServices = services.filter(service => service.id !== id);
      await AsyncStorage.setItem('@saved_services', JSON.stringify(updatedServices));
      setServices(updatedServices);
    } catch (error) {
      console.error("Error deleting service:", error);
      Alert.alert("Error", "Could not delete the service.");
    }
  };

  const openService = (service) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ViewService', { service });
  };

  const renderServiceCard = ({ item }) => {
    const formattedDate = new Date(item.date).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
        activeOpacity={0.7}
        onPress={() => openService(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <View style={[styles.iconBadge, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.cardDate, { color: colors.primary }]}>
                {formattedDate}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.deleteBtn} 
            onPress={() => confirmDelete(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: '500' }}>
            <Ionicons name="list" size={14} color={colors.subtext} /> {item.agenda?.length || 0} Agenda Items
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 17 }}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Services</Text>
          {/* Empty view for balance */}
          <View style={styles.headerBtn} /> 
        </View>

        {/* List */}
        {!isLoading && services.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={60} color={colors.border} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Services Yet</Text>
            <Text style={[styles.emptyStateText, { color: colors.subtext }]}>
              Services you create in the Builder will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={services}
            keyExtractor={(item) => item.id}
            renderItem={renderServiceCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 12, 
    borderBottomWidth: 1 
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center', padding: 5, width: 80 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  listContainer: { padding: 15, paddingBottom: 100 },
  
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 15,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
    marginLeft: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
