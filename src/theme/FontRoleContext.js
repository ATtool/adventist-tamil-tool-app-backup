import React, { createContext, useContext } from 'react';

/**
 * Lets a screen say "everything inside this subtree is song lyrics" (or Bible
 * verses, etc.) without adding a prop to every MixedText.  MixedText falls
 * back to inferring a role from the existing style when no provider is used.
 */
const FontRoleContext = createContext(null);

export const FontRoleProvider = ({ role, children }) => (
  <FontRoleContext.Provider value={role || null}>{children}</FontRoleContext.Provider>
);

export const useFontRole = () => useContext(FontRoleContext);

export default FontRoleContext;
