# End-to-end tests (Playwright + Electron)

These tests launch the **real built Electron app** and drive it through Playwright's
Electron support. They cover the integration that the jsdom/Vitest suite has to mock
away: the real main↔renderer IPC boundary, electron-store persistence, the on-disk
chart scan pipeline, and **real VexFlow SVG layout**.

## Running

```bash
yarn test:e2e        # builds the app, then runs the e2e suite
yarn test:e2e:only   # runs against the existing ./out build (skip the build)
```

A desktop window opens while the suite runs (it is started minimized). On a headless
Linux CI runner, wrap the command in `xvfb-run`.

## How fixtures work

`support.ts#launchApp` builds a throwaway library on disk for each run:

- a `song.ini` + a hand-written `notes.chart` (plain-text `.chart`) with an
  Expert drums track and **no audio stems** — keeping `SongView` off the audio path.
- a fresh `--user-data-dir` whose `config.json` optionally seeds
  `lastOpenedPath`, so the seeded-library test can rescan without the native folder
  dialog.

Everything else (gameplay scoring, the input bus, the playhead engine, settings
wiring) is covered far faster and more deterministically by the Vitest suite.
