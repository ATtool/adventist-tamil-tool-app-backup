import * as Font from 'expo-font';
import { FONT_FACE_ASSETS, TAMIL_FONTS, ENGLISH_FONTS } from './fontData';

// These are loaded by App.js before the UI renders.
const loaded = new Set([
  'Tamil003',
  'Tamil008',
  'Tinos',
  'Tinos-Bold',
  'Tinos-Italic',
  'Tinos-BoldItalic',
]);

const pending = new Map();
let allFamiliesPromise = null;

/**
 * Load a single registered font face.  Safe to call repeatedly; concurrent
 * calls share the same promise.
 */
export const loadFontFace = async (key) => {
  if (!key || loaded.has(key)) return;
  if (pending.has(key)) return pending.get(key);

  const asset = FONT_FACE_ASSETS[key];
  if (!asset) return;

  const promise = Font.loadAsync({ [key]: asset })
    .then(() => {
      loaded.add(key);
    })
    .catch((error) => {
      // A broken/missing font should never crash the app; the text simply
      // falls back to the platform font.
      console.warn(`Could not load font face "${key}":`, error);
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, promise);
  return promise;
};

export const loadFontFaces = async (keys = []) => {
  const unique = [...new Set(keys.filter(Boolean))].filter((key) => !loaded.has(key));
  if (unique.length === 0) return;
  await Promise.all(unique.map(loadFontFace));
};

/**
 * Load the regular face of every bundled family.  Used by the font picker so
 * each row can render its own preview.  This is intentionally lazy: the
 * picker is the only screen that needs every family at once.
 */
export const loadAllFontPreviews = async () => {
  if (allFamiliesPromise) return allFamiliesPromise;

  const keys = [...TAMIL_FONTS, ...ENGLISH_FONTS]
    .map((font) => font.faces.regular)
    .filter(Boolean);

  allFamiliesPromise = loadFontFaces(keys).catch((error) => {
    allFamiliesPromise = null;
    throw error;
  });
  return allFamiliesPromise;
};

export const isFontFaceLoaded = (key) => loaded.has(key);
