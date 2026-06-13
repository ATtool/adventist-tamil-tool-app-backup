const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Tells Expo to bundle .db and .ttf files with the app
config.resolver.assetExts.push('db', 'ttf');

module.exports = config;