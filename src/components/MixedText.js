import React, { createContext, forwardRef, useContext, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

/**
 * MixedText — drop-in replacement for the react-native <Text> component.
 *
 * Typography rules for bilingual (Tamil + English) content:
 *   1. Tamil script  -> always regular/default font weight (never bold),
 *                       rendered at the component's own font size.
 *   2. English words -> always bold, rendered exactly 2px smaller than the
 *                       surrounding Tamil text at every level
 *                       (Title, H1, H2, Body, Subtext, Caption, ...).
 *
 * The component splits any string it receives into Tamil/English runs using
 * the Unicode Tamil block (U+0B80-U+0BFF) and renders each run with its own
 * style, while non-text children (icons, nested text components, ...) are
 * passed through untouched. The base font size is also provided to nested
 * MixedText components through context, so English runs nested inside a
 * MixedText that does not declare its own fontSize still scale correctly.
 */

// English renders 2px smaller than the surrounding Tamil text.
const ENGLISH_SIZE_DELTA = -2;
const ENGLISH_MIN_SIZE = 9;
// Tamil custom fonts usually ship a single weight, so English runs fall back
// to the (bold-capable) system font to guarantee a visible bold weight.
const ENGLISH_USES_SYSTEM_FONT = true;

const TAMIL_RE = /[\u0B80-\u0BFF]/;
const LATIN_RE = /[A-Za-z0-9]/;

const classifyChar = (ch) => {
  if (TAMIL_RE.test(ch)) return 'ta';
  if (LATIN_RE.test(ch)) return 'en';
  return 'n';
};

/**
 * Splits a string into consecutive { type: 'ta' | 'en' | 'n', text } runs.
 * Neutral characters (spaces, punctuation, symbols, digits of other scripts)
 * attach to the run they sit inside so words are never torn apart.
 */
export function splitTextRuns(str) {
  if (typeof str !== 'string' || str.length === 0) return null;

  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const type = classifyChar(str[i]);
    let j = i + 1;
    while (j < str.length && classifyChar(str[j]) === type) j++;
    tokens.push({ type, text: str.slice(i, j) });
    i = j;
  }

  const runs = [];
  let pending = '';
  for (const token of tokens) {
    if (token.type === 'n') {
      pending += token.text;
      continue;
    }
    const last = runs[runs.length - 1];
    if (!last) {
      runs.push({ type: token.type, text: pending + token.text });
    } else if (last.type === token.type) {
      last.text += pending + token.text;
    } else {
      last.text += pending;
      runs.push({ type: token.type, text: token.text });
    }
    pending = '';
  }
  if (pending) {
    if (runs.length > 0) runs[runs.length - 1].text += pending;
    else runs.push({ type: 'n', text: pending });
  }
  return runs;
}

// Propagates the resolved base font size to nested MixedText components.
const BaseFontSizeContext = createContext(null);

const flattenChildren = (children, out = []) => {
  React.Children.forEach(children, (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') return;
    if (typeof child === 'string' || typeof child === 'number') {
      out.push(String(child));
      return;
    }
    if (Array.isArray(child)) {
      flattenChildren(child, out);
      return;
    }
    out.push(child); // React element (icon, nested text, ...) — untouched
  });
  return out;
};

const MixedText = forwardRef(({ children, style, ...rest }, ref) => {
  const inheritedFontSize = useContext(BaseFontSizeContext);

  const flat = useMemo(() => (style ? StyleSheet.flatten(style) || {} : {}), [style]);
  const parts = useMemo(() => flattenChildren(children), [children]);

  const hasRenderableText = parts.some(
    (part) => typeof part === 'string' && part.trim().length > 0
  );

  // Own fontSize wins; otherwise inherit from an enclosing MixedText.
  const baseFontSize =
    typeof flat.fontSize === 'number' ? flat.fontSize : inheritedFontSize;

  // Per-run props that only apply per <Text> node and are not inherited.
  const runProps = {};
  if (rest.allowFontScaling !== undefined) runProps.allowFontScaling = rest.allowFontScaling;
  if (rest.selectable !== undefined) runProps.selectable = rest.selectable;
  if (rest.maxFontSizeMultiplier !== undefined) runProps.maxFontSizeMultiplier = rest.maxFontSizeMultiplier;

  const renderRuns = (str, keyPrefix) => {
    const runs = splitTextRuns(str);
    if (!runs) return str;

    return runs.map((run, index) => {
      if (run.type === 'en') {
        const runStyle = { fontWeight: '700' };
        if (ENGLISH_USES_SYSTEM_FONT && flat.fontFamily) runStyle.fontFamily = undefined;
        if (typeof baseFontSize === 'number') {
          runStyle.fontSize = Math.max(ENGLISH_MIN_SIZE, baseFontSize + ENGLISH_SIZE_DELTA);
        }
        if (flat.includeFontPadding === false) runStyle.includeFontPadding = false;
        return (
          <Text key={`${keyPrefix}en${index}`} style={runStyle} {...runProps}>
            {run.text}
          </Text>
        );
      }

      // Tamil (and neutral) runs: regular weight, base size, own font family.
      const runStyle = { fontWeight: '400' };
      if (flat.includeFontPadding === false) runStyle.includeFontPadding = false;
      return (
        <Text key={`${keyPrefix}ta${index}`} style={runStyle} {...runProps}>
          {run.text}
        </Text>
      );
    });
  };

  const content = hasRenderableText
    ? parts.map((part, index) => {
        if (typeof part !== 'string') {
          return <React.Fragment key={`el${index}`}>{part}</React.Fragment>;
        }
        return <React.Fragment key={`s${index}`}>{renderRuns(part, `s${index}`)}</React.Fragment>;
      })
    : children;

  return (
    <BaseFontSizeContext.Provider value={baseFontSize}>
      <Text ref={ref} style={style} {...rest}>
        {content}
      </Text>
    </BaseFontSizeContext.Provider>
  );
});

export default MixedText;
