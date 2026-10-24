export default [
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: {
      'no-unused-vars': 'warn',
      'no-var': 'error',
      eqeqeq: 'error',
    },
  },
];
