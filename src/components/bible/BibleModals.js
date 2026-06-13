import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

export function NoteModal({ visible, colors, isDark, appFontSize, noteText, setNoteText, onSave, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[styles.noteCard, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold', marginBottom: 15 }}>Add Note</Text>
          <TextInput 
            style={[styles.noteInput, { color: colors.text, borderColor: colors.border, fontSize: appFontSize }]} 
            placeholderTextColor={colors.subtext} placeholder="Type your notes here..." 
            multiline autoFocus value={noteText} onChangeText={setNoteText} 
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 10, marginRight: 15 }}><Text style={{ color: colors.subtext, fontWeight: 'bold', fontSize: appFontSize }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={onSave} style={{ padding: 10, backgroundColor: colors.glow, borderRadius: 10 }}><Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: appFontSize }}>Save Note</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CrossRefModal({ visible, colors, isDark, appFontSize, bibleLanguage, crossRefsList, getBookName, onJump, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlayBottom}>
        <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.bottomSheet, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <View style={{ width: 34 }} />
            <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>Cross References</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 5 }}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          {crossRefsList.length === 0 ? (
            <View style={styles.bodyCenter}><Ionicons name="search" size={50} color={colors.border} /><Text style={{ color: colors.subtext, marginTop: 10 }}>No cross references found.</Text></View>
          ) : (
            <FlatList data={crossRefsList} keyExtractor={(item, index) => index.toString()} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.crossRefCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => onJump(item.to_book_id, item.to_chapter, item.to_verse)}>
                  <Ionicons name="book" size={20} color={colors.primary} style={{ marginRight: 15 }} />
                  <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold', fontFamily: bibleLanguage === 'english' ? undefined : 'Tamil008' }}>
                    {getBookName(item.to_book_id)} {item.to_chapter}:{item.to_verse}
                  </Text>
                  <View style={{ flex: 1 }} /><Ionicons name="arrow-forward-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bodyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlayCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  noteCard: { width: '100%', padding: 20, borderRadius: 20, borderWidth: 1 },
  noteInput: { borderWidth: 1, borderRadius: 10, padding: 15, minHeight: 100, textAlignVertical: 'top' },
  modalOverlayBottom: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: { width: '100%', maxHeight: '75%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, overflow: 'hidden', paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  crossRefCard: { flexDirection: 'row', alignItems: 'center', padding: 20, marginBottom: 10, borderRadius: 15, borderWidth: 1 }
});
