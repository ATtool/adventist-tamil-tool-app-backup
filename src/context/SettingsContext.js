import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const isDark = true; 
  
  const [timeZone, setTimeZone] = useState('India (IST)');
  
  // Notice we changed this to _setAppFontSize. The underscore is a standard naming trick 
  // to say "this is the raw, internal state setter".
  const [appFontSize, _setAppFontSize] = useState(16); 
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // --- SONG SETTINGS ---
  const [titleSize, setTitleSize] = useState(20);
  const [titleSpacing, setTitleSpacing] = useState(0);
  const [lyricsSize, setLyricsSize] = useState(20); 
  const [lyricsSpacing, setLyricsSpacing] = useState(0);
  const [lyricsLineHeight, setLyricsLineHeight] = useState(30);

  // --- BIBLE SETTINGS ---
  const [bibleLanguage, _setBibleLanguage] = useState('both'); 
  const [activeEnglishVersion, _setActiveEnglishVersion] = useState('KJV');

  const [bibleFontSize, setBibleFontSize] = useState(20);
  const [bibleLineHeight, setBibleLineHeight] = useState(32);
  const [bibleLetterSpacing, setBibleLetterSpacing] = useState(0);

  // Load saved settings on startup (Reading the "Notebook")
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('@bible_language');
        if (savedLang !== null) _setBibleLanguage(savedLang);

        // NEW: Load the saved font size from the phone's hard drive!
        const savedAppFontSize = await AsyncStorage.getItem('@app_font_size');
        if (savedAppFontSize !== null) {
          // AsyncStorage saves everything as text (strings), so we must convert it back to a number
          _setAppFontSize(parseInt(savedAppFontSize, 10)); 
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
      } catch (e) { console.error("Failed to load settings", e); }
    };
    loadSettings();
  }, []);

  // NEW: This is the function SettingsScreen will call. 
  // It updates the screen instantly, AND writes it down in the "Notebook".
  const setAppFontSize = async (size) => {
    _setAppFontSize(size);
    await AsyncStorage.setItem('@app_font_size', size.toString());
  };

  const setBibleLanguage = async (lang) => {
    _setBibleLanguage(lang);
    await AsyncStorage.setItem('@bible_language', lang);
  };

  const setActiveEnglishVersion = async (version) => {
    _setActiveEnglishVersion(version);
    await AsyncStorage.setItem('@active_english_version', version);
  };

  // We also make sure the reset button clears the hard drive memory back to 16
  const restoreDefaultTextSettings = async () => {
    _setAppFontSize(16);
    await AsyncStorage.setItem('@app_font_size', '16');

    setTitleSize(20); setTitleSpacing(0);
    setLyricsSize(20); setLyricsSpacing(0); setLyricsLineHeight(30);
    setBibleFontSize(20); setBibleLineHeight(32); setBibleLetterSpacing(0);
  };

  const colors = {
    background: '#05070A',               
    card: 'rgba(255, 255, 255, 0.04)',   
    text: '#FFFFFF',                     
    subtext: '#8E94A3',                  
    primary: '#00F0FF',                  
    border: 'rgba(255, 255, 255, 0.08)', 
    glow: 'rgba(0, 240, 255, 0.15)' 
  };

  return (
    <SettingsContext.Provider value={{ 
      timeZone, setTimeZone, colors, isDark,
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
