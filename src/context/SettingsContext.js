import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const isDark = true; 
  
  const [timeZone, setTimeZone] = useState('India (IST)');
  const [appFontSize, setAppFontSize] = useState(16); 
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

  // Load saved settings on startup and AUTO-HEAL corrupted states
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('@bible_language');
        if (savedLang !== null) _setBibleLanguage(savedLang);

        const savedVersion = await AsyncStorage.getItem('@active_english_version');
        // AUTO-HEAL: If the Concordance leaked into the English version state, force it back to KJV
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

  const setBibleLanguage = async (lang) => {
    _setBibleLanguage(lang);
    await AsyncStorage.setItem('@bible_language', lang);
  };

  const setActiveEnglishVersion = async (version) => {
    _setActiveEnglishVersion(version);
    await AsyncStorage.setItem('@active_english_version', version);
  };

  const restoreDefaultTextSettings = () => {
    setAppFontSize(16);
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
