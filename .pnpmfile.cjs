// TypeScript 7 (the native Go port) is our compiler: `tsc` resolves to typescript@7.
// TS 7 no longer ships the JS compiler API (`require('typescript')` only exposes the
// version), so tools built on that API — typescript-eslint, typedoc, vue-tsc — still
// need TypeScript 6. pnpm resolves their `typescript` peer to the root typescript@7,
// so we turn that peer into a regular dependency on TypeScript 6 for those packages.
// Drop entries from this list once a tool supports TS 7 natively.

const TS6 = 'npm:typescript@~6.0.3';

const TS_API_CONSUMERS = new Set([
	'typedoc',
	'typescript-eslint',
	'ts-api-utils',
	'vue-tsc',
	'@vue/language-core',
	'@volar/typescript'
]);

function needsTs6(name) {
	return TS_API_CONSUMERS.has(name) || name.startsWith('@typescript-eslint/');
}

function readPackage(pkg) {
	if (needsTs6(pkg.name) && pkg.peerDependencies && pkg.peerDependencies.typescript) {
		delete pkg.peerDependencies.typescript;
		if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.typescript;
		pkg.dependencies = { ...pkg.dependencies, typescript: TS6 };
	}
	return pkg;
}

module.exports = { hooks: { readPackage } };
