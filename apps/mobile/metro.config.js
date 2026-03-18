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
};

module.exports = withNativeWind(config, { input: './global.css' });
