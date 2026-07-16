import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

// This MUST run before App.js loads, so we use require() here —
// require() runs exactly where it's written, unlike import,
// which always jumps to the top of the file automatically.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
]);

const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
