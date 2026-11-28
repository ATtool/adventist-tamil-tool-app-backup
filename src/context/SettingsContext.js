import React, { createContext, useState, useContext, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FONT_CATEGORIES,
  getDefaultFontSettings,
  normalizeFontSettings,
  resolveCategoryFonts,
  getFaceKeysForSettings,
} from '../theme/fontUtils';
import { TAMIL_FONTS, ENGLISH_FONTS } from '../theme/fontData';
import { loadFontFaces } from '../theme/fontLoader';

const SettingsContext = createContext();
const FONT_SETTINGS_KEY = '@font_settings';

export const SettingsProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true); 
  
  const [timeZone, setTimeZone] = useState('India (IST)');
  
  // Base scale for the entire app UI (default: 15)
  const [appFontSize, _setAppFontSize] = useState(15); 
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // --- SONG READING PREFERENCES ---
  const [titleSize, setTitleSize] = useState(20);
  const [titleSpacing, setTitleSpacing] = useState(0);
  const [lyricsSize, setLyricsSize] = useState(21); 
  const [lyricsSpacing, setLyricsSpacing] = useState(0);
  const [lyricsLineHeight, setLyricsLineHeight] = useState(32);

  // --- BIBLE READING PREFERENCES ---
  const [bibleLanguage, _setBibleLanguage] = useState('both'); 
  const [activeEnglishVersion, _setActiveEnglishVersion] = useState('KJV');

  const [bibleFontSize, setBibleFontSize] = useState(18);
  const [bibleLineHeight, setBibleLineHeight] = useState(32);
  const [bibleLetterSpacing, setBibleLetterSpacing] = useState(0);

  // --- FONT / TYPOGRAPHY PREFERENCES ---
  // `fontSettings` stores the user's choices; `resolvedFonts` is the
  // ready-to-use mapping (master font + per-section overrides).
  const [fontSettings, setFontSettings] = useState(getDefaultFontSettings);
  const [fontLoadVersion, setFontLoadVersion] = useState(0);

  // Load saved preferences on startup
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@app_theme');
        if (savedTheme !== null) {
          setIsDark(savedTheme === 'dark');
        }

        const savedLang = await AsyncStorage.getItem('@bible_language');
        if (savedLang !== null) _setBibleLanguage(savedLang);

        const savedAppFontSize = await AsyncStorage.getItem('@app_font_size');
        if (savedAppFontSize !== null) {
          const parsedSize = parseInt(savedAppFontSize, 10);
          if (!isNaN(parsedSize) && parsedSize >= 12 && parsedSize <= 24) {
            // Scale the reading areas (bible verses, song lyrics, ...) to
            // the saved global size as well, without re-persisting it.
            await applyAppFontSize(parsedSize, { persist: false });
          }
        }

        const savedVersion = await AsyncStorage.getItem('@active_english_version');
        if (savedVersion) {
          if (savedVersion.toLowerCase().includes('concordance')) {
            _setActiveEnglishVersion('KJV');
            await AsyncStorage.setItem('@active_english_version', 'KJV');
          } else {
            _setActiveEnglishVersion(savedVersion);
          }
        }

        const savedFonts = await AsyncStorage.getItem(FONT_SETTINGS_KEY);
        if (savedFonts) {
          try {
            const normalized = normalizeFontSettings(JSON.parse(savedFonts));
            // Load the selected faces before switching settings so text never
            // flashes in a fallback system font.
            await loadFontFaces(getFaceKeysForSettings(normalized));
            setFontSettings(normalized);
            setFontLoadVersion((v) => v + 1);
          } catch (fontError) {
            console.warn('Failed to load font settings:', fontError);
          }
        } else {
          // Make sure the default faces are available (they normally are
          // already loaded by App.js, but the picker may ask for more).
          await loadFontFaces(getFaceKeysForSettings(getDefaultFontSettings()));
        }
      } catch (e) { 
        console.error("Failed to load settings", e); 
      }
    };
    loadSettings();
  }, []);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // Tracks the base size the reading areas were last scaled against, so
  // repeated slider events during a drag never accumulate stale deltas.
  const appliedBaseRef = useRef(15);

  const shiftReadingSizes = (delta) => {
    if (!delta) return;
    setBibleFontSize((s) => clamp(s + delta, 14, 40));
    setBibleLineHeight((s) => clamp(s + delta, 20, 70));
    setTitleSize((s) => clamp(s + delta, 16, 30));
    setLyricsSize((s) => clamp(s + delta, 12, 45));
    setLyricsLineHeight((s) => clamp(s + delta, 20, 70));
  };

  const applyAppFontSize = async (size, { persist = true } = {}) => {
    const delta = size - appliedBaseRef.current;
    appliedBaseRef.current = size;
    _setAppFontSize(size);

    // Shift the reading areas that keep their own sizes so the GLOBAL app
    // font size slider also scales the bible verse rendering area and the
    // song lyrics popups (Zion, Thirumarai, Other Songs, ...) — while each
    // area's own slider ranges stay valid.
    shiftReadingSizes(delta);

    if (persist) await AsyncStorage.setItem('@app_font_size', size.toString());
  };

  const setAppFontSize = (size) => applyAppFontSize(size);

  const setBibleLanguage = async (lang) => {
    _setBibleLanguage(lang);
    await AsyncStorage.setItem('@bible_language', lang);
  };

  const setActiveEnglishVersion = async (version) => {
    _setActiveEnglishVersion(version);
    await AsyncStorage.setItem('@active_english_version', version);
  };

  const restoreDefaultTextSettings = async () => {
    await setAppFontSize(15);
    setTitleSize(20); 
    setTitleSpacing(0);
    setLyricsSize(21); 
    setLyricsSpacing(0); 
    setLyricsLineHeight(32);
    setBibleFontSize(18); 
    setBibleLineHeight(32); 
    setBibleLetterSpacing(0);
  };

  // --- FONT / TYPOGRAPHY ACTIONS ---

  const persistFontSettings = async (next) => {
    // Load first, then apply, so no text is painted with a face that has not
    // been registered yet (which would briefly fall back to the system font).
    try {
      await loadFontFaces(getFaceKeysForSettings(next));
    } catch (error) {
      console.warn('Could not load selected fonts:', error);
    }

    setFontSettings(next);
    try {
      await AsyncStorage.setItem(FONT_SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Could not save font settings:', error);
    }

    // Re-render so text picks up any newly loaded faces immediately.
    setFontLoadVersion((v) => v + 1);
  };

  /**
   * Change the app-wide Tamil or English font.  Sections the user has not
   * customised follow the new app font; explicitly customised sections keep
   * their own choice.
   */
  const setMasterFont = (language, fontId) => {
    const masterKey = language === 'english' ? 'masterEnglish' : 'masterTamil';
    const next = {
      ...fontSettings,
      [masterKey]: fontId,
      categories: Object.keys(fontSettings.categories).reduce((acc, id) => {
        const value = fontSettings.categories[id];
        acc[id] = value.customized ? value : { ...value, [language]: null };
        return acc;
      }, {}),
    };
    persistFontSettings(next);
  };

  const setCategoryFont = (categoryId, language, fontId) => {
    const current = fontSettings.categories[categoryId];
    if (!current) return;
    const next = {
      ...fontSettings,
      categories: {
        ...fontSettings.categories,
        [categoryId]: {
          ...current,
          [language]: fontId,
          customized: true,
        },
      },
    };
    persistFontSettings(next);
  };

  const setCategoryTextStyle = (categoryId, textStyle) => {
    const current = fontSettings.categories[categoryId];
    if (!current) return;
    const next = {
      ...fontSettings,
      categories: {
        ...fontSettings.categories,
        [categoryId]: { ...current, textStyle, customized: true },
      },
    };
    persistFontSettings(next);
  };

  const resetCategoryFonts = (categoryId) => {
    const category = FONT_CATEGORIES.find((item) => item.id === categoryId);
    if (!category) return;
    const next = {
      ...fontSettings,
      categories: {
        ...fontSettings.categories,
        [categoryId]: {
          tamil: category.tamilDefault,
          english: category.englishDefault,
          textStyle: 'auto',
          customized: false,
        },
      },
    };
    persistFontSettings(next);
  };

  const resetFontSettings = () => persistFontSettings(getDefaultFontSettings());

  const resolvedFonts = useMemo(() => resolveCategoryFonts(fontSettings), [fontSettings]);

  const setTheme = async (themeMode) => {
    const dark = themeMode === 'dark';
    setIsDark(dark);
    await AsyncStorage.setItem('@app_theme', dark ? 'dark' : 'light');
  };

  const toggleTheme = async () => {
    const dark = !isDark;
    setIsDark(dark);
    await AsyncStorage.setItem('@app_theme', dark ? 'dark' : 'light');
  };

  const colors = useMemo(() => {
    if (isDark) {
      return {
        background: '#05070A',               
        card: 'rgba(255, 255, 255, 0.04)',   
        cardSolid: '#12161E',
        text: '#FFFFFF',                     
        subtext: '#8E94A3',                  
        primary: '#00F0FF',                  
        border: 'rgba(255, 255, 255, 0.08)', 
        glow: 'rgba(0, 240, 255, 0.15)',
        accent: '#FFD700',
        danger: '#FF3B30',
        success: '#30D158',
        tabBar: '#0A1929',
        tabActive: '#FFD700',
        tabInactive: '#00F0FF',
      };
    } else {
      return {
        background: '#F4F7FB',               
        card: '#FFFFFF',   
        cardSolid: '#FFFFFF',
        text: '#0F172A',                     
        subtext: '#5B677B',                  
        primary: '#0077E6',                  
        border: '#E2E8F0', 
        glow: 'rgba(0, 119, 230, 0.12)',
        accent: '#D97706',
        danger: '#EF4444',
        success: '#10B981',
        tabBar: '#FFFFFF',
        tabActive: '#0077E6',
        tabInactive: '#64748B',
      };
    }
  }, [isDark]);

  // Uniform Typography System (Sizes & Spacing Only)
  // We leave fontFamily out so individual screens can keep their exact fonts!
  const typography = useMemo(() => {
    const base = appFontSize;
    return {
      display: {
        fontSize: base + 13, // Massive Hero headers
        includeFontPadding: false,
      },
      h1: {
        fontSize: base + 10, // Big headers
        includeFontPadding: false,
      },
      h2: {
        fontSize: base + 6, // Section headers
        includeFontPadding: false,
      },
      title: {
        fontSize: base + 2, // Card/List titles
        includeFontPadding: false,
      },
      body: {
        fontSize: base, // Normal text
        includeFontPadding: false,
      },
      subtext: {
        fontSize: Math.max(11, base - 2), // Small descriptions
        includeFontPadding: false,
      },
      caption: {
        fontSize: Math.max(10, base - 4), // Tiny badges/dates
        includeFontPadding: false,
      },
    };
  }, [appFontSize]);

  return (
    <SettingsContext.Provider value={{ 
      timeZone, setTimeZone, colors, typography, isDark, setIsDark, setTheme, toggleTheme,
      appFontSize, setAppFontSize, hapticsEnabled, setHapticsEnabled,
      titleSize, setTitleSize, titleSpacing, setTitleSpacing,
      lyricsSize, setLyricsSize, lyricsSpacing, setLyricsSpacing, lyricsLineHeight, setLyricsLineHeight,
      bibleLanguage, setBibleLanguage,
      activeEnglishVersion, setActiveEnglishVersion,
      bibleFontSize, setBibleFontSize,
      bibleLineHeight, setBibleLineHeight,
      bibleLetterSpacing, setBibleLetterSpacing,
      restoreDefaultTextSettings,
      // Font & typography
      fontSettings,
      resolvedFonts,
      fontCategories: FONT_CATEGORIES,
      tamilFonts: TAMIL_FONTS,
      englishFonts: ENGLISH_FONTS,
      setMasterFont,
      setCategoryFont,
      setCategoryTextStyle,
      resetCategoryFonts,
      resetFontSettings,
      fontLoadVersion,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);