# Editor dependencies

These files are unmodified upstream sources, served locally. There is no CDN
dependency, package install, or JavaScript build step for the playground.

| Library | Version | Files | Upstream |
| --- | --- | --- | --- |
| code-input | 2.9.0 | `code-input.js`, `code-input.css`, `LICENSE` | https://www.npmjs.com/package/@webcoder49/code-input |
| Prism | 1.30.0 | `components/prism-core.js`, `LICENSE` | https://www.npmjs.com/package/prismjs |

Downloaded from the exact version's npm files via `https://cdn.jsdelivr.net/npm/`.
Both libraries use the MIT license; copies are included beside their source.
For upgrades, create new version directories and update the references in
`web/index.html` and `scripts/test-editor.mjs`. Keep the vendor files unformatted.
