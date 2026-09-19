# @drumee/ui-runtime

Drumee minimal frontend runtime. This is a pre-release CommonJS API extracted
from the validated Phase 4.5 minimal-kernel boundary. It is prepared for a
public prerelease under the `next` dist-tag, is not yet published to npm and
does not claim stable API compatibility.

The runtime owns the non-MFS LETC bootstrap, elementary Skeleton/Widget
catalog, Kind/addon coordination, logical plugin loading, browser entry and the
minimal Host, Visitor and Organization context boundary. Browser builds remain
the responsibility of `ui-build`; this repository ships no generated bundle.

## Development

Node.js 18 or newer is required.

```bash
npm ci
npm test
npm pack --dry-run --ignore-scripts
```

The test suite includes the LETC/Kind/plugin unit contracts, a shipped-file
dependency audit, `npm pack`, and installation into a clean consumer with
`NODE_PATH` disabled. The artifact smoke test resolves and loads a plugin kind
through the installed package.

## Ownership boundary

This repository is browser/runtime code only. It remains CommonJS and
Webpack-compatible, with no SSR. It does not own Webpack tooling, MFS, Finder,
Window Manager, Team behavior or application policy.

## Non-goals

This prerelease does not add React, Vue, ESM, SSR, MFS, Finder, Marketing,
Team migration, platform bootstrap or a new frontend framework.

## Provenance

The repository was history-extracted from
`drumee/transient:target/foundation/ui-runtime` at transient commit
`e3f4468d3ea882baeee4c7fefbd956aca4128d28`. See [PROVENANCE.md](PROVENANCE.md)
for extraction and symbol-level source details.
