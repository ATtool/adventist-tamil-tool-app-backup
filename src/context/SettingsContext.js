import React, { createContext, useState, useContext, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const isDark = true; 
  
  const [timeZone, setTimeZone] = useState('India (IST)');
  
  // Base scale for the entire app UI (default: 15)
  const [appFontSize, _setAppFontSize] = useState(15); 
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // --- SONG READING PREFERENCES ---
  const [titleSize, setTitleSize] = useState(20);
  const [titleSpacing, setTitleSpacing] = useState(0);
  const [lyricsSize, setLyricsSize] = useState(18); 
  const [lyricsSpacing, setLyricsSpacing] = useState(0);
  const [lyricsLineHeight, setLyricsLineHeight] = useState(32);

  // --- BIBLE READING PREFERENCES ---
  const [bibleLanguage, _setBibleLanguage] = useState('both'); 
  const [activeEnglishVersion, _setActiveEnglishVersion] = useState('KJV');

  const [bibleFontSize, setBibleFontSize] = useState(18);
  const [bibleLineHeight, setBibleLineHeight] = useState(32);
  const [bibleLetterSpacing, setBibleLetterSpacing] = useState(0);

  // Load saved preferences on startup
  useEffect(() => {
    const loadSettings = async () => {
      try {
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
    setLyricsSize(18); 
    setLyricsSpacing(0); 
    setLyricsLineHeight(32);
    setBibleFontSize(18); 
    setBibleLineHeight(32); 
    setBibleLetterSpacing(0);
  };

  const colors = {
    background: '#05070A',               
    card: 'rgba(255, 255, 255, 0.04)',   
    text: '#FFFFFF',                     
    subtext: '#8E94A3',                  
    primary: '#00F0FF',                  
    border: 'rgba(255, 255, 255, 0.08)', 
    glow: 'rgba(0, 240, 255, 0.15)',
    accent: '#FFD700',
    danger: '#FF3B30',
    success: '#30D158'
  };

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
      timeZone, setTimeZone, colors, typography, isDark,
      appFontSize, setAppFontSize, hapticsEnabled, setHapticsEnabled,
      titleSize, setTitleSize, titleSpacing, setTitleSpacing,
      lyricsSize, setLyricsSize, lyricsSpacing, setLyricsSpacing, lyricsLineHeight, setLyricsLineHeight,
      bibleLanguage, setBibleLanguage,
      activeEnglishVersion, setActiveEnglishVersion,
      bibleFontSize, setBibleFontSize,
      bibleLineHeight, setBibleLineHeight,
      bibleLetterSpacing, setBibleLetterSpacing,
      restoreDefaultTextSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);