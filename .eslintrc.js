module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  settings: {
    "import/resolver": "webpack"
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "indent": ["error", 4]
  },
};
