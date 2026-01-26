import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
	{ ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'docs/**', 'docs-legacy/**', '**/vitest.config.ts', '**/public/**', 'packages/postgres-backend/test/**', 'packages/redis-backend/test/**'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			globals: { ...globals.node }
		}
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			}
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-require-imports': 'off',
			'no-console': 'error'
		}
	},
	{
		files: ['**/*.test.ts', '**/test/**/*.ts'],
		languageOptions: {
			globals: { ...globals.mocha }
		},
		rules: {
			'@typescript-eslint/no-unused-expressions': 'off',
			'no-console': 'off'
		}
	},
	{
		// CLI tools and their servers are allowed to use console for user output
		files: ['**/cli.ts', '**/cli/**/*.ts', '**/agenda-rest/src/**/*.ts'],
		rules: {
			'no-console': 'off'
		}
	},
	eslintConfigPrettier
);
