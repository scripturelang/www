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

The playground follows the system's light or dark appearance automatically.
Both palettes are defined with CSS custom properties in `web/playground.css`.

## Source formatting

HTML, CSS, and JavaScript use Prettier with two-space indentation and an
80-column target. Format the maintained sources with:

```sh
make pretty
```

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
