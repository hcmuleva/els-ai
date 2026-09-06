const path = require('path');
let expoPath;
try {
  expoPath = path.dirname(require.resolve('expo/package.json'));
} catch {
  expoPath = '<rootDir>/node_modules/expo';
}

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^test-renderer$': require.resolve('react-test-renderer'),
    '^expo/src/(.*)$': `${expoPath}/src/$1`,
    '^expo/virtual/(.*)$': `${expoPath}/virtual/$1`
  },
  clearMocks: true,
  forceExit: true,
};
