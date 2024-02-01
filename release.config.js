module.exports = {
    branches: ['master'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        [
            '@semantic-release/changelog',
            {
                changelogFile: 'CHANGELOG.md',
            },
        ],
        '@semantic-release/github',
        '@semantic-release/npm',
        [
            '@semantic-release/git',
            {
                assets: ['package.json', 'CHANGELOG.md', 'package-lock.json'],
                message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
            },
        ],
    ],
};
