// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const path = require('path');

// Find the project root directory
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react': path.resolve(projectRoot, 'node_modules', 'react'),
    'react-native': path.resolve(monorepoRoot, 'node_modules', 'react-native'),
    '@supabase/supabase-js': path.resolve(projectRoot, 'node_modules', '@supabase/supabase-js'),
    '@react-native-async-storage/async-storage': path.resolve(monorepoRoot, 'node_modules', '@react-native-async-storage/async-storage'),
    'expo-status-bar': path.resolve(projectRoot, 'node_modules', 'expo-status-bar'),
    'expo': path.resolve(projectRoot, 'node_modules', 'expo'),
};

// Force resolution of React to the mobile package's instance
config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Ensure strict singleton for React
    if (moduleName === 'react') {
        const mobileReact = path.resolve(projectRoot, 'node_modules', 'react');
        return {
            filePath: require.resolve(mobileReact, { paths: [projectRoot] }),
            type: 'sourceFile',
        };
    }

    // Ensure React Native resolves from root
    if (moduleName === 'react-native') {
        const rootReactNative = path.resolve(monorepoRoot, 'node_modules', 'react-native');
        return {
            filePath: require.resolve(rootReactNative, { paths: [monorepoRoot] }),
            type: 'sourceFile',
        };
    }

    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
