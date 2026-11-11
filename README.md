# Scripture website

This contains the static content for [scripturelang.com](https://scripturelang.com).
The Rust interpreter lives in [scripturelang/scripturec](https://github.com/scripturelang/scripturec).

## Local development

Serve `web/` with [miniserve](https://github.com/svenstaro/miniserve), a static
HTTP server installed through Cargo. Run these commands from this repository:

```sh
make setup # one-time installation of miniserve through Cargo
make serve
```

Running `make` also starts the server. Use `make serve PORT=9090` to choose a
different port. Stop the server with Ctrl-C.

The development server sends `Cache-Control: no-cache` so the browser revalidates
scripts and runtime files after changes. Restart an already-running `make serve`
to pick up changes to the server command.

The playground follows the system's light or dark appearance automatically.
Both palettes are defined with CSS custom properties in `web/playground.css`.

## Code editor

The editor uses code-input 2.9.0 and Prism 1.30.0, bundled locally under
`web/vendor/` with their licenses. No new build step or CDN connection is needed.
`web/editor.js` defines a small set of highlighting rules for Scripture's tokens;
it does not parse or validate programs. The Rust interpreter remains responsible
for the language grammar and diagnostics.

When adding tokens to the language, update those color rules as needed. Colors
for both light and dark appearances live in `web/playground.css`. Draft saving,
Reset example, Tab indentation, Escape then Tab, and error navigation retain the
existing playground behavior. If the editor libraries fail to load, the plain
textarea remains usable.

## Source formatting

HTML, CSS, and JavaScript use Prettier with two-space indentation and an
80-column target. Format the maintained sources with:

```sh
make pretty
```

## Updating the WebAssembly runtime

Build in `scripturec`, then install and validate the bundle from this repository.
With sibling checkouts, run from the `scripturec` directory:

```sh
cargo web
cd ../www
make update
```

`cargo web --offline` also works when the compiler dependencies and binding tool
are cached. `make update` requires Node.js 22+ and defaults to `../scripturec/pkg`.
For another checkout, use `make update RUNTIME_PKG=/path/to/scripturec/pkg`.

The updater hashes every filename and file's contents with SHA-256, including
the JavaScript loader, Wasm binary, helper snippets, declarations, and package
metadata. It tests a temporary copy against the website's lessons and runtime
checks, then installs it under `web/pkg/<hash>/` and atomically replaces
`web/pkg/manifest.json`. A failed validation leaves the selected build unchanged.
Identical updates reuse the existing directory without rewriting the manifest.
Existing hash directories are verified and never overwritten.

Review and commit the new directory, manifest, and any website changes together.
Publishing is a separate step; `make update` does not deploy anything. Website
builds still need no Rust toolchain and never fetch or compile the runtime.
The compiler owns the programs in `scripturec/examples`; the website owns its
guided examples in `web/lessons.js`.

The playground revalidates the small manifest before each run and loads all runtime
files from that build's directory. This lets an already-open page using this loader
pick up a newly published interpreter on its next run. `web/_headers` configures
Cloudflare static hosting to revalidate mutable entry points and cache versioned
bundles for a year. Local `make serve` revalidates all files. Other hosts need the
equivalent cache headers.

Keep older hash directories when publishing so existing sessions can finish
loading their builds. The legacy files directly under `web/pkg/` are retained for
pages opened before the manifest loader was introduced; the updater leaves them
alone. Do not manually edit files in a hash directory. Update the compiler bundle
and rerun `make update` instead.

Updates use a `.update-lock` directory to prevent simultaneous installations. If
an update is forcibly killed, verify no update is running before removing that
lock and any abandoned `.update-*` temporary directories.

Run the website checks from this directory:

```sh
node scripts/test-runtime.mjs
node scripts/test-runtime-loader.mjs
node scripts/test-update-runtime.mjs
node scripts/test-playground.mjs
node scripts/test-editor.mjs
```
