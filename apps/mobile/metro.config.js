const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  nativewind: path.resolve(workspaceRoot, 'node_modules/nativewind'),
  'react-native-css-interop': path.resolve(
    workspaceRoot,
    'node_modules/react-native-css-interop'
  ),
  'react-native-svg': path.resolve(projectRoot, 'node_modules/react-native-svg'),
  '@react-native-community/datetimepicker': path.resolve(
    projectRoot,
    'node_modules/@react-native-community/datetimepicker'
  ),
  // HeroUI Native, Uniwind, and peer deps — resolve through pnpm symlinks
  uniwind: path.resolve(projectRoot, 'node_modules/uniwind'),
  'heroui-native': path.resolve(projectRoot, 'node_modules/heroui-native'),
  'tailwind-variants': path.resolve(projectRoot, 'node_modules/tailwind-variants'),
  'tailwind-merge': path.resolve(projectRoot, 'node_modules/tailwind-merge'),
  '@gorhom/bottom-sheet': path.resolve(projectRoot, 'node_modules/@gorhom/bottom-sheet'),
  'react-native-gesture-handler': path.resolve(projectRoot, 'node_modules/react-native-gesture-handler'),
  'react-native-worklets': path.resolve(projectRoot, 'node_modules/react-native-worklets'),
  'expo-haptics': path.resolve(projectRoot, 'node_modules/expo-haptics'),
};

module.exports = withNativeWind(config, { input: './global.css' });
