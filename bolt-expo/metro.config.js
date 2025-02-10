const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname, { isCSSEnabled: true });

module.exports = config;
