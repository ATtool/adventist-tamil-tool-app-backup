import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { getFontsForLanguage, resolveFace } from '../theme/fontUtils';
import { loadAllFontPreviews } from '../theme/fontLoader';

const TAMIL_SAMPLE = 'யேசு கிறிஸ்து உங்களை நேசிக்கிறார்';
const ENGLISH_SAMPLE = 'Jesus Christ loves you';

/**
 * Full-screen font list.  Every row renders its sample in that font, so the
 * user can compare Tamil and English families visually before choosing one.
 */
export default function FontPickerModal({
  visible,
  language = 'tamil',
  selectedId,
  onSelect,
  onClose,
  allowInherit = false,
  inheritLabel = 'Use app font',
  title,
}) {
  const { colors, fontSettings } = useSettings();
  const [query, setQuery] = useState('');
  const [previewsReady, setPreviewsReady] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const fonts = useMemo(() => getFontsForLanguage(language), [language]);
  const sample = language === 'english' ? ENGLISH_SAMPLE : TAMIL_SAMPLE;
  const appFontId = language === 'english' ? fontSettings.masterEnglish : fontSettings.masterTamil;
  // When "Use app font" is available, a null selection means inherit — don't
  // also highlight the app-wide font row in that case.
  const activeId = selectedId != null ? selectedId : allowInherit ? null : appFontId;

  useEffect(() => {
    if (!visible) return undefined;
    let mounted = true;
    setPreviewsReady(false);
    setPreviewError(false);
    setQuery('');
    loadAllFontPreviews()
      .then(() => mounted && setPreviewsReady(true))
      .catch(() => mounted && setPreviewError(true));
    return () => {
      mounted = false;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fonts;
    return fonts.filter(
      (font) =>
        font.name.toLowerCase().includes(q) ||
        font.id.toLowerCase().includes(q)
    );
  }, [fonts, query]);

  const renderFont = ({ item }) => {
    const face = resolveFace(item, false, false);
    const selected = item.id === activeId;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onSelect(item.id)}
        style={[
          styles.row,
          {
            backgroundColor: selected ? colors.glow : colors.card,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[
              styles.sample,
              {
                color: colors.text,
                fontFamily: previewsReady ? face.family : undefined,
              },
            ]}
          >
            {sample}
          </Text>
          <Text style={[styles.name, { color: colors.subtext }]}>{item.name}</Text>
        </View>
        {selected ? (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        ) : (
          <View style={{ width: 24 }} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {title || (language === 'english' ? 'Choose English Font' : 'Choose Tamil Font')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.subtext }]}>
                {fonts.length} fonts available
              </Text>
            </View>
            <View style={styles.headerButton} />
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.subtext} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search fonts..."
              placeholderTextColor={colors.subtext}
              style={[styles.searchInput, { color: colors.text }]}
              autoCorrect={false}
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.subtext} />
              </TouchableOpacity>
            )}
          </View>

          {!previewsReady && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.subtext, marginLeft: 8, fontSize: 12 }}>
                {previewError ? 'Some previews could not load.' : 'Loading font previews...'}
              </Text>
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderFont}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
            ListHeaderComponent={
              allowInherit ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => onSelect(null)}
                  style={[
                    styles.row,
                    {
                      backgroundColor: selectedId == null ? colors.glow : colors.card,
                      borderColor: selectedId == null ? colors.primary : colors.border,
                      marginBottom: 10,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inheritTitle, { color: colors.text }]}>{inheritLabel}</Text>
                    <Text style={[styles.name, { color: colors.subtext }]}>
                      Follow the app-wide {language === 'english' ? 'English' : 'Tamil'} font
                    </Text>
                  </View>
                  {selectedId == null && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 30 }}>
                No fonts match “{query}”.
              </Text>
            }
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 11, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  sample: { fontSize: 18 },
  name: { fontSize: 11, marginTop: 4 },
  inheritTitle: { fontSize: 15, fontWeight: '600' },
});
