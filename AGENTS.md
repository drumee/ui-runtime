# UI runtime contribution rules

- Preserve CommonJS and the existing Webpack-compatible browser contract.
- Keep this runtime independently installable and application-neutral.
- Do not introduce SSR, React, Vue, ESM migration or a new bundler architecture.
- Do not add Team, Finder, MFS or other application code.
- Preserve the non-MFS LETC/Widget, Skeleton and Kind/plugin contracts.
- Do not add hidden imports from transient, sibling repositories, `target/**`,
  `sources/**`, parent `node_modules` or `NODE_PATH`.
- `npm ci`, `npm test` and `npm pack` must work from a standalone clone.
- Do not publish npm packages without explicit R1 authorization.
- Do not begin Phase 4.6 or later work without explicit authorization.
