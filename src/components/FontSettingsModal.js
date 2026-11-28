import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import {
  FONT_CATEGORIES,
  TEXT_STYLES,
  getTamilFont,
  getEnglishFont,
  parseTextStyle,
  resolveFace,
} from '../theme/fontUtils';
import FontPickerModal from './FontPickerModal';

const TAMIL_SAMPLE = 'யேசு கிறிஸ்து உங்களை நேசிக்கிறார்';
const ENGLISH_SAMPLE = 'Jesus Christ loves you';

const FontRow = ({ label, value, onPress, colors, sublabel }) => (
  <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={[styles.row, { borderBottomColor: colors.border }]}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.primary }]} numberOfLines={1}>
        {value}
      </Text>
      {!!sublabel && <Text style={[styles.rowSub, { color: colors.subtext }]}>{sublabel}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
  </TouchableOpacity>
);

export default function FontSettingsModal({ visible, onClose }) {
  const {
    colors,
    isDark,
    fontSettings,
    resolvedFonts,
    setMasterFont,
    setCategoryFont,
    setCategoryTextStyle,
    resetCategoryFonts,
    resetFontSettings,
  } = useSettings();

  const [view, setView] = useState('main');
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [picker, setPicker] = useState(null);

  const activeCategory = useMemo(
    () => FONT_CATEGORIES.find((category) => category.id === activeCategoryId) || null,
    [activeCategoryId]
  );

  const openMasterPicker = (language) => setPicker({ language, categoryId: null });
  const openCategoryPicker = (language) => setPicker({ language, categoryId: activeCategoryId });

  const closeModal = () => {
    setView('main');
    setActiveCategoryId(null);
    setPicker(null);
    onClose?.();
  };

  const pickerConfig = useMemo(() => {
    if (!picker) return null;
    const isMaster = !picker.categoryId;
    const category = FONT_CATEGORIES.find((item) => item.id === picker.categoryId);
    const selectedId = isMaster
      ? picker.language === 'english'
        ? fontSettings.masterEnglish
        : fontSettings.masterTamil
      : fontSettings.categories[picker.categoryId]?.[picker.language] ?? null;

    return {
      language: picker.language,
      selectedId,
      allowInherit: !isMaster,
      title: isMaster
        ? picker.language === 'english'
          ? 'App English Font'
          : 'App Tamil Font'
        : `${category?.label || 'Section'} — ${picker.language === 'english' ? 'English' : 'Tamil'} Font`,
      onSelect: (fontId) => {
        if (isMaster) {
          setMasterFont(picker.language, fontId);
        } else {
          setCategoryFont(picker.categoryId, picker.language, fontId);
        }
        setPicker(null);
      },
    };
  }, [picker, fontSettings, setMasterFont, setCategoryFont]);

  const renderCategoryEditor = () => {
    if (!activeCategory) return null;
    const value = fontSettings.categories[activeCategory.id];
    const tamilFont = value.tamil
      ? getTamilFont(value.tamil)
      : resolvedFonts.masterTamil;
    const englishFont = value.english
      ? getEnglishFont(value.english)
      : resolvedFonts.masterEnglish;
    const parsed = parseTextStyle(value.textStyle);
    // Match MixedText: Auto keeps Tamil regular and English bold.
    const tamilFace = resolveFace(
      tamilFont,
      parsed ? parsed.bold : false,
      parsed ? parsed.italic : false
    );
    const englishFace = resolveFace(
      englishFont,
      parsed ? parsed.bold : true,
      parsed ? parsed.italic : false
    );

    return (
      <>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              setView('main');
              setActiveCategoryId(null);
            }}
            style={styles.headerButton}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.title, { color: colors.text }]}>{activeCategory.label}</Text>
            <Text style={[styles.subtitle, { color: colors.subtext }]}>
              {activeCategory.description}
            </Text>
          </View>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.previewLabel, { color: colors.subtext }]}>PREVIEW</Text>
            <Text
              style={[
                styles.previewTamil,
                {
                  color: colors.text,
                  fontFamily: tamilFace.family,
                  fontWeight: tamilFace.syntheticBold ? 'bold' : 'normal',
                  fontStyle: tamilFace.syntheticItalic ? 'italic' : 'normal',
                },
              ]}
            >
              {activeCategory.sampleTa}
            </Text>
            <Text
              style={[
                styles.previewEnglish,
                {
                  color: colors.subtext,
                  fontFamily: englishFace.family,
                  fontWeight: englishFace.syntheticBold ? 'bold' : 'normal',
                  fontStyle: englishFace.syntheticItalic ? 'italic' : 'normal',
                },
              ]}
            >
              {activeCategory.sampleEn}
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.primary }]}>FONT</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FontRow
              label="Tamil Font"
              value={tamilFont.name}
              sublabel={value.tamil ? undefined : 'Following the app-wide Tamil font'}
              onPress={() => openCategoryPicker('tamil')}
              colors={colors}
            />
            <FontRow
              label="English Font"
              value={englishFont.name}
              sublabel={value.english ? undefined : 'Following the app-wide English font'}
              onPress={() => openCategoryPicker('english')}
              colors={colors}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.primary, marginTop: 22 }]}>TEXT STYLE</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 12 }]}>
            <View style={styles.styleGrid}>
              {TEXT_STYLES.map((item) => {
                const selected = value.textStyle === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.75}
                    onPress={() => setCategoryTextStyle(activeCategory.id, item.id)}
                    style={[
                      styles.styleChip,
                      {
                        backgroundColor: selected ? colors.primary : 'transparent',
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.styleChipText,
                        {
                          color: selected ? (isDark ? '#000' : '#FFF') : colors.text,
                          fontWeight: item.id === 'bold' || item.id === 'boldItalic' ? 'bold' : 'normal',
                          fontStyle: item.id === 'italic' || item.id === 'boldItalic' ? 'italic' : 'normal',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.helpText, { color: colors.subtext }]}>
              Auto keeps the app’s existing bold and italic areas unchanged.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Reset section font?',
                `Restore ${activeCategory.label} to its original font and style.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => resetCategoryFonts(activeCategory.id),
                  },
                ]
              )
            }
            style={[styles.resetButton, { borderColor: colors.danger, backgroundColor: 'rgba(255,59,48,0.08)' }]}
          >
            <Ionicons name="refresh" size={18} color={colors.danger} />
            <Text style={[styles.resetText, { color: colors.danger }]}>Reset this section</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  };

  const renderMain = () => (
    <>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerButton} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: colors.text }]}>Fonts & Typography</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Choose fonts for Tamil and English
          </Text>
        </View>
        <TouchableOpacity onPress={closeModal} style={styles.headerButton}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={[styles.sectionLabel, { color: colors.primary }]}>APP FONT</Text>
        <Text style={[styles.sectionHelp, { color: colors.subtext }]}>
          This is the default font for the whole app. Sections you customise below keep their own choice.
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FontRow
            label="Tamil App Font"
            value={resolvedFonts.masterTamil.name}
            onPress={() => openMasterPicker('tamil')}
            colors={colors}
          />
          <FontRow
            label="English App Font"
            value={resolvedFonts.masterEnglish.name}
            onPress={() => openMasterPicker('english')}
            colors={colors}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.primary, marginTop: 24 }]}>
          CUSTOMISE BY SECTION
        </Text>
        <Text style={[styles.sectionHelp, { color: colors.subtext }]}>
          Give headings, lyrics, Bible verses and other areas their own font, weight and italic style.
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {FONT_CATEGORIES.map((category, index) => {
            const value = fontSettings.categories[category.id];
            const tamilName = value.tamil ? getTamilFont(value.tamil).name : 'App font';
            const englishName = value.english ? getEnglishFont(value.english).name : 'App font';
            const styleName = TEXT_STYLES.find((item) => item.id === value.textStyle)?.label || 'Auto';
            return (
              <TouchableOpacity
                key={category.id}
                activeOpacity={0.75}
                onPress={() => {
                  setActiveCategoryId(category.id);
                  setView('category');
                }}
                style={[
                  styles.categoryRow,
                  index < FONT_CATEGORIES.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>{category.label}</Text>
                  <Text style={[styles.categoryMeta, { color: colors.subtext }]} numberOfLines={1}>
                    Tamil: {tamilName} • English: {englishName}
                  </Text>
                  <Text style={[styles.categoryMeta, { color: colors.subtext }]}>Style: {styleName}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Reset all fonts?',
              'Restore the original Tamil003 / Tamil008 / Tinos fonts and the default section styles.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset All',
                  style: 'destructive',
                  onPress: () => resetFontSettings(),
                },
              ]
            )
          }
          style={[styles.resetButton, { borderColor: colors.danger, backgroundColor: 'rgba(255,59,48,0.08)' }]}
        >
          <Ionicons name="refresh" size={18} color={colors.danger} />
          <Text style={[styles.resetText, { color: colors.danger }]}>Reset all fonts</Text>
        </TouchableOpacity>

        <Text style={[styles.licenseNote, { color: colors.subtext }]}>
          Additional fonts are from Google Fonts and are used under the SIL Open Font License.
        </Text>
      </ScrollView>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeModal}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          {view === 'category' ? renderCategoryEditor() : renderMain()}
        </SafeAreaView>

        {pickerConfig && (
          <FontPickerModal
            visible
            language={pickerConfig.language}
            selectedId={pickerConfig.selectedId}
            onSelect={pickerConfig.onSelect}
            onClose={() => setPicker(null)}
            allowInherit={pickerConfig.allowInherit}
            title={pickerConfig.title}
          />
        )}
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
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  sectionHelp: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowValue: { fontSize: 14, marginTop: 3 },
  rowSub: { fontSize: 11, marginTop: 3 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  categoryTitle: { fontSize: 15, fontWeight: '600' },
  categoryMeta: { fontSize: 11, marginTop: 3 },
  previewCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 20 },
  previewLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  previewTamil: { fontSize: 22, lineHeight: 34 },
  previewEnglish: { fontSize: 17, lineHeight: 26, marginTop: 6 },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  styleChipText: { fontSize: 13 },
  helpText: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetText: { fontSize: 14, fontWeight: '700', marginLeft: 6 },
  licenseNote: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 18 },
});
