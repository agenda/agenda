# Contributing to Agenda

Thank you for your interest in contributing to Agenda!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/agenda.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b my-feature`

## Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint
pnpm lint:fix
```

## Pull Requests

1. Ensure tests pass: `pnpm test`
2. Ensure linting passes: `pnpm lint`
3. Add a changeset if needed: `pnpm changeset`
4. Submit your PR with a clear description

## Reporting Issues

Please use GitHub Issues to report bugs or request features. Include:
- Node.js version
- Agenda version
- Steps to reproduce
- Expected vs actual behavior
