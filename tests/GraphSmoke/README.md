# Graph checks

Run from the repository root. The generator checks need only the project's .NET SDK:

```sh
dotnet run --project tests/GraphSmoke -- /tmp/purrject-graph-tests
```

This verifies resource embedding, JSON escaping, encoded documentation URLs,
duplicate requirements, unconfigured dependencies, and empty graphs. It also
generates fixtures for special names, cycles, self dependencies, and a larger map.

The browser checks use Node's built-in WebSocket with Chrome's DevTools protocol;
no npm dependencies are required. Start a separate headless Chrome instance:

```sh
google-chrome-stable --headless --remote-debugging-port=9222 --user-data-dir=/tmp/purrject-graph-chrome about:blank
```

Then, in another terminal:

```sh
node tests/GraphSmoke/browser.mjs /tmp/purrject-graph-tests
```

The browser checks exercise elastic neighbor following, partial movement, stable
release, isolated components, warm theme colors, arrow updates, exact direct-neighbor
highlights, theme persistence, disabled storage, reduced motion, search, keyboard
focus, panning, zoom, and mobile sizing. They also check all fixtures for runtime
errors and external network requests, and save day/night/selection/mobile screenshots.
Pass a different DevTools endpoint as the script's second argument if needed.
