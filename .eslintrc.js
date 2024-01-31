module.exports = {
	env: {
		node: true
	},
	root: true,
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:@typescript-eslint/recommended-requiring-type-checking'
	],
	parserOptions: {
		project: './tsconfig.eslint.json'
	},
	parser: '@typescript-eslint/parser',
	rules: {
		'@typescript-eslint/no-unsafe-call': 'warn',
		'@typescript-eslint/no-unsafe-return': 'warn',
		'@typescript-eslint/no-unsafe-member-access': 'warn',
		'@typescript-eslint/no-explicit-any': 'warn',
		'@typescript-eslint/no-unsafe-assignment': 'warn',
		'@typescript-eslint/no-misused-promises': 'warn',
		'@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
        '@typescript-eslint/no-redundant-type-constituents': 'warn',
		'@typescript-eslint/restrict-template-expressions': 'warn'
	},
	overrides: [
		{
			files: ['*.test.ts'],
			env: {
				mocha: true
			},
			rules: {
				'@typescript-eslint/no-unused-expressions': 'off',
				'import/no-relative-packages': 'off'
			}
		}
	]
};
