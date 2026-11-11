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

## Updating the WebAssembly runtime

Build in `scripturec`, then explicitly copy the complete generated bundle here.
With sibling checkouts, run from the `scripturec` directory:

```sh
cargo web
mkdir -p ../www/web/pkg
cp -R pkg/. ../www/web/pkg/
```

`cargo web --offline` also works when the compiler dependencies and binding tool
are cached. Copy the JavaScript loader, helper snippets, Wasm binary, declarations,
and `package.json` together; they are a matched bundle. Review and commit the updated
`web/pkg/` files in this repository when ready. Compiler changes do not update
this copy automatically, and website builds never fetch or compile the runtime.
The compiler's example programs remain in `scripturec`; the website owns its
guided examples in `web/lessons.js`.

## Optional development checks

The existing checks use Node.js 22+ without npm or third-party packages:

```sh
node scripts/test-runtime.mjs
node scripts/test-playground.mjs
```

They are optional locally and also run in GitHub Actions, independently of
hosting. They are not a build or deployment step. The runtime checks execute
every guided lesson against the bundled Wasm and verify errors, partial output,
and asynchronous execution. The UI checks cover draft recovery, lesson navigation,
mobile views, keyboard handling, diagnostics, and worker lifecycle.
