// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Root config files run in Node at build time, not in the app bundle — `app.config.js`
    // reads `__dirname` to locate google-services.json. The Expo preset targets React Native,
    // where those globals don't exist, so they're declared here for these files only.
    files: ["*.config.js"],
    languageOptions: {
      globals: { __dirname: "readonly", __filename: "readonly", module: "writable", require: "readonly", process: "readonly" },
    },
  },
  {
    // Jest's globals aren't in the Expo preset either, so every `jest.mock` in the setup file
    // was reported as `no-undef`. Test files under `__tests__` are already covered by the
    // preset; this one sits at the root and was missed.
    files: ["jest.setup.js"],
    languageOptions: {
      globals: { jest: "readonly", beforeEach: "readonly", afterEach: "readonly", require: "readonly", module: "writable" },
    },
  },
]);
