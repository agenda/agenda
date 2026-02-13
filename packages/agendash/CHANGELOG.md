# agendash

## 8.1.2

### Patch Changes

- Updated dependencies [f9437cc]
  - agenda@6.2.3

## 8.1.1

### Patch Changes

- 75bb2ba: Add "default" export condition to all packages to support CommonJS require()

  The exports map only specified the "import" condition, which prevented CommonJS projects from using require() to load these packages. Node.js require() matches "require" or "default" conditions, not "import". With require(esm) now stable in Node.js 20.19+, 22.12+, and 24+, adding a "default" condition allows CJS projects to consume these ESM packages directly.

- Updated dependencies [75bb2ba]
  - agenda@6.2.2

## 8.1.0

### Minor Changes

- 045fe5e: CVE-2026-25128 by overriding fast-xml-parser to ^5.3.4 in root package.json

### Patch Changes

- fb05ddd: fix failed jobs
- Updated dependencies [fb05ddd]
  - agenda@6.2.1

## 8.0.1

### Patch Changes

- Security: Fix CVE-2026-25128 (fast-xml-parser RangeError DoS) via pnpm override to ^5.3.4

## 8.0.0

### Patch Changes

- Updated dependencies [758cb99]
- Updated dependencies [09e7b54]
  - agenda@6.2.0

## 7.0.0

### Minor Changes

- 605ba67: bi-directional state notificatoins
- 71cd27d: keyboard events

### Patch Changes

- 4df1f8f: add progress bar
- Updated dependencies [c34ae31]
- Updated dependencies [9c6843e]
- Updated dependencies [605ba67]
  - agenda@6.1.0

## 6.0.1

### Patch Changes

- e784be4: relative path for assets

## 6.0.0

### Minor Changes

- 7e2eaa1: Modernize Agendash frontend with Vue 3 + Vite

### Patch Changes

- 94f7e9b: feat: add connection ownership tracking and improve sort direction API
- Updated dependencies [c23769b]
- Updated dependencies [5d53d72]
- Updated dependencies [7b262a6]
- Updated dependencies [457adf6]
- Updated dependencies [0f80e59]
- Updated dependencies [c946a23]
- Updated dependencies [4a3f8ed]
- Updated dependencies [b10bf2d]
- Updated dependencies [0aa54be]
- Updated dependencies [6420cdd]
- Updated dependencies [f8e62ee]
- Updated dependencies [bfbeb12]
- Updated dependencies [225a9f8]
- Updated dependencies [073e62d]
- Updated dependencies [e6b3354]
- Updated dependencies [fda16c1]
- Updated dependencies [ce647d2]
- Updated dependencies [94f7e9b]
- Updated dependencies [f8e62ee]
  - agenda@6.0.0

## 6.0.0-alpha.0

### Patch Changes

- 94f7e9b: feat: add connection ownership tracking and improve sort direction API
- Updated dependencies [7b262a6]
- Updated dependencies [457adf6]
- Updated dependencies [c946a23]
- Updated dependencies [4a3f8ed]
- Updated dependencies [f8e62ee]
- Updated dependencies [bfbeb12]
- Updated dependencies [225a9f8]
- Updated dependencies [073e62d]
- Updated dependencies [94f7e9b]
- Updated dependencies [f8e62ee]
  - agenda@6.0.0-alpha.0
