const path = require('path');

module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            [
                'module-resolver',
                {
                    alias: {
                        alias: {
                            '@': './',
                            'react': path.resolve(__dirname, 'node_modules/react'),
                            'react-native': path.resolve(__dirname, '../../node_modules/react-native'),
                            '@unitimetable/shared': path.resolve(__dirname, '../shared'),
                        },
                    },
                },
            ],
            'react-native-reanimated/plugin',
        ],
    };
};
