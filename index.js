import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

// Suppress known Expo Go push notification notices in terminal and on-screen LogBox
const IGNORED_MESSAGES = [
  'Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
];

const shouldFilter = (args) => {
  for (const arg of args) {
    if (typeof arg === 'string') {
      if (IGNORED_MESSAGES.some((msg) => arg.includes(msg))) return true;
    } else if (arg && typeof arg.message === 'string') {
      if (IGNORED_MESSAGES.some((msg) => arg.message.includes(msg))) return true;
    }
  }
  return false;
};

const originalError = console.error;
console.error = (...args) => {
  if (shouldFilter(args)) return;
  originalError(...args);
};

const originalWarn = console.warn;
console.warn = (...args) => {
  if (shouldFilter(args)) return;
  originalWarn(...args);
};

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

// This MUST run before App.js loads, so we use require() here —
// require() runs exactly where it's written, unlike import,
// which always jumps to the top of the file automatically.
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
