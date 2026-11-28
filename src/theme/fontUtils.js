import { TAMIL_FONTS, ENGLISH_FONTS } from './fontData';

/**
 * Font roles used by MixedText.  The role decides which user-selected font a
 * piece of text is rendered with.  A role can be set explicitly on MixedText
 * (`fontRole="lyrics"`), inherited from a FontRoleProvider, or inferred from
 * the style the screen already uses (Tamil008 = heading, Tamil003 = body).
 */
export const FONT_CATEGORIES = [
  {
    id: 'heading',
    label: 'Headings',
    labelTa: 'தலைப்புகள்',
    description: 'Screen titles and big headings',
    tamilDefault: 'tamil008',
    englishDefault: null,
    sampleTa: 'யேசு கிறிஸ்து',
    sampleEn: 'Jesus Christ',
  },
  {
    id: 'subheading',
    label: 'Subheadings',
    labelTa: 'துணைத் தலைப்புகள்',
    description: 'Section labels and smaller titles',
    tamilDefault: 'tamil008',
    englishDefault: null,
    sampleTa: 'இன்றைய வசனம்',
    sampleEn: 'Today\u2019s Verse',
  },
  {
    id: 'body',
    label: 'Body & UI Text',
    labelTa: 'உரை & இடைமுகம்',
    description: 'Buttons, labels, menus and normal text',
    tamilDefault: null,
    englishDefault: null,
    sampleTa: 'அமைதியுடன் செல்',
    sampleEn: 'Go in peace',
  },
  {
    id: 'songTitle',
    label: 'Song Titles',
    labelTa: 'பாடல் தலைப்புகள்',
    description: 'Titles in the song reader',
    tamilDefault: 'tamil008',
    englishDefault: null,
    sampleTa: 'என் இயேசு நல்லவர்',
    sampleEn: 'My Jesus is good',
  },
  {
    id: 'lyrics',
    label: 'Song Lyrics',
    labelTa: 'பாடல் வரிகள்',
    description: 'Lyrics in Zion, Thirumarai and other songs',
    tamilDefault: null,
    englishDefault: null,
    sampleTa: 'உம்மை நேசிக்கிறேன் ஆண்டவரே',
    sampleEn: 'I love You, Lord',
  },
  {
    id: 'bible',
    label: 'Bible Verses',
    labelTa: 'வேத வசனங்கள்',
    description: 'Tamil and English Bible verse text',
    tamilDefault: null,
    englishDefault: null,
    sampleTa: 'தேவன் அன்பாகவே இருக்கிறார்',
    sampleEn: 'God is love',
  },
];

export const TEXT_STYLES = [
  { id: 'auto', label: 'Auto', hint: 'Follow the app\u2019s existing style' },
  { id: 'normal', label: 'Normal' },
  { id: 'bold', label: 'Bold' },
  { id: 'italic', label: 'Italic' },
  { id: 'boldItalic', label: 'Bold Italic' },
];

export const DEFAULT_MASTER_TAMIL = 'tamil003';
export const DEFAULT_MASTER_ENGLISH = 'tinos';

const TAMIL_BY_ID = new Map(TAMIL_FONTS.map((f) => [f.id, f]));
const ENGLISH_BY_ID = new Map(ENGLISH_FONTS.map((f) => [f.id, f]));

export const getTamilFont = (id) => TAMIL_BY_ID.get(id) || TAMIL_BY_ID.get(DEFAULT_MASTER_TAMIL);
export const getEnglishFont = (id) => ENGLISH_BY_ID.get(id) || ENGLISH_BY_ID.get(DEFAULT_MASTER_ENGLISH);
export const getFontById = (language, id) =>
  language === 'english' ? getEnglishFont(id) : getTamilFont(id);
export const getFontsForLanguage = (language) =>
  language === 'english' ? ENGLISH_FONTS : TAMIL_FONTS;

export const getDefaultFontSettings = () => ({
  masterTamil: DEFAULT_MASTER_TAMIL,
  masterEnglish: DEFAULT_MASTER_ENGLISH,
  categories: FONT_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = {
      tamil: category.tamilDefault,
      english: category.englishDefault,
      textStyle: 'auto',
      customized: false,
    };
    return acc;
  }, {}),
});

/**
 * Merge a saved payload with the current defaults.  This makes old saved
 * settings (and settings saved before a new font/category was added) safe.
 */
export const normalizeFontSettings = (saved) => {
  const defaults = getDefaultFontSettings();
  if (!saved || typeof saved !== 'object') return defaults;

  const result = {
    masterTamil: TAMIL_BY_ID.has(saved.masterTamil) ? saved.masterTamil : defaults.masterTamil,
    masterEnglish: ENGLISH_BY_ID.has(saved.masterEnglish)
      ? saved.masterEnglish
      : defaults.masterEnglish,
    categories: {},
  };

  FONT_CATEGORIES.forEach((category) => {
    const fallback = defaults.categories[category.id];
    const value = saved.categories?.[category.id] || {};
    result.categories[category.id] = {
      // `null` is a deliberate choice ("use the app font"), so keep it rather
      // than replacing it with the category's original default.
      tamil:
        value.tamil === null
          ? null
          : TAMIL_BY_ID.has(value.tamil)
            ? value.tamil
            : fallback.tamil,
      english:
        value.english === null
          ? null
          : ENGLISH_BY_ID.has(value.english)
            ? value.english
            : fallback.english,
      textStyle: TEXT_STYLES.some((s) => s.id === value.textStyle)
        ? value.textStyle
        : fallback.textStyle,
      customized: Boolean(value.customized),
    };
  });

  return result;
};

/**
 * Resolve a font + requested style to a registered font family name.
 * Fonts that do not ship a real bold/italic face are rendered with the
 * nearest real face plus a synthetic style flag.
 */
export const resolveFace = (font, bold = false, italic = false) => {
  const faces = font?.faces || {};
  const regular = faces.regular || 'Tamil003';

  if (bold && italic) {
    if (faces.boldItalic) {
      return { family: faces.boldItalic, syntheticBold: false, syntheticItalic: false };
    }
    if (faces.bold) {
      return { family: faces.bold, syntheticBold: false, syntheticItalic: true };
    }
    if (faces.italic) {
      return { family: faces.italic, syntheticBold: true, syntheticItalic: false };
    }
    return { family: regular, syntheticBold: true, syntheticItalic: true };
  }

  if (bold) {
    if (faces.bold) return { family: faces.bold, syntheticBold: false, syntheticItalic: false };
    return { family: regular, syntheticBold: true, syntheticItalic: false };
  }

  if (italic) {
    if (faces.italic) return { family: faces.italic, syntheticBold: false, syntheticItalic: false };
    return { family: regular, syntheticBold: false, syntheticItalic: true };
  }

  return { family: regular, syntheticBold: false, syntheticItalic: false };
};

export const parseTextStyle = (textStyle) => {
  switch (textStyle) {
    case 'bold':
      return { bold: true, italic: false };
    case 'italic':
      return { bold: false, italic: true };
    case 'boldItalic':
      return { bold: true, italic: true };
    case 'normal':
      return { bold: false, italic: false };
    default:
      return null; // auto
  }
};

export const resolveCategoryFonts = (settings) => {
  const masterTamil = getTamilFont(settings.masterTamil);
  const masterEnglish = getEnglishFont(settings.masterEnglish);
  const categories = {};

  FONT_CATEGORIES.forEach((category) => {
    const value = settings.categories[category.id] || {};
    categories[category.id] = {
      tamil: getTamilFont(value.tamil || settings.masterTamil),
      english: getEnglishFont(value.english || settings.masterEnglish),
      textStyle: value.textStyle || 'auto',
    };
  });

  return { masterTamil, masterEnglish, categories };
};

/**
 * Every face key that must be loaded for a given settings payload.  Used by
 * the provider after loading settings and whenever the user changes a font.
 */
export const getFaceKeysForSettings = (settings) => {
  const keys = new Set();
  const addFont = (font, textStyle) => {
    if (!font) return;
    const parsed = parseTextStyle(textStyle);
    if (!parsed) {
      // Auto: load all real faces so existing bold/italic text renders well.
      Object.values(font.faces).forEach((key) => key && keys.add(key));
      return;
    }
    const face = resolveFace(font, parsed.bold, parsed.italic);
    keys.add(face.family);
    // Also load the regular face as a safe fallback.
    if (font.faces.regular) keys.add(font.faces.regular);
  };

  addFont(getTamilFont(settings.masterTamil), 'auto');
  addFont(getEnglishFont(settings.masterEnglish), 'auto');

  FONT_CATEGORIES.forEach((category) => {
    const value = settings.categories[category.id] || {};
    addFont(getTamilFont(value.tamil || settings.masterTamil), value.textStyle);
    addFont(getEnglishFont(value.english || settings.masterEnglish), value.textStyle);
  });

  return [...keys];
};

export const getFontDisplayName = (font) => font?.name || 'Default';

/**
 * Font family for <TextInput>s.  Inputs cannot split Tamil/English runs, so
 * they use the body Tamil font (Tamil families include basic Latin glyphs).
 * Falls back to the original Tamil003 face when no settings are available.
 */
export const getInputFontFamily = (resolvedFonts) => {
  const font =
    resolvedFonts?.categories?.body?.tamil || getTamilFont(DEFAULT_MASTER_TAMIL);
  return resolveFace(font, false, false).family;
};
