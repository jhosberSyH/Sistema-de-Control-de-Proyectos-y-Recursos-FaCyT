import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Ningún componente ni vista puede depender de los datos mock.
const sinMocks = {
  group: ['@/testing/*', '**/testing/*'],
  message: 'Los datos mock solo se cargan desde src/main.tsx.',
}
// Los módulos no se importan entre sí: se combinan en app/routes (bulletproof-react).
const sinOtrosModulos = {
  group: ['@/modulos/*'],
  message: 'Un módulo no importa de otro; combínalos en src/app/routes.',
}

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/testing/**', 'src/main.tsx', 'src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [sinMocks] }] },
  },
  {
    // Un módulo puede importar sus propias carpetas con rutas relativas, nunca otro módulo por @/modulos.
    files: ['src/modulos/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [sinMocks, sinOtrosModulos] }] },
  },
)
