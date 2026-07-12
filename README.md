# <img width="64" height="64" alt="SightKick Logo Github" src="https://cdn.sightkick.dev/images/sightkick-logo.png" /> SightKick

A game for learning drums with sheet music for thousands of songs. Mute the drum track, play along with your kit, and chase your best score.

<h1 align="center">
  <a href="https://sightkick.dev">Guide</a> |
  <a href="https://github.com/tonygoldcrest/sightkick/releases">Download</a> |
  <a href="https://discord.gg/kwBx9VZt3">Discord</a>
</h1>

<img width="1478" height="880" alt="image" src="https://cdn.sightkick.dev/images/hero.png" />

## Requirements

* **macOS**, **Windows** (x64), or **Linux** (x64).
* Optional drum-track separation needs the [stem splitter tool](https://github.com/tonygoldcrest/sightkick-tools) (~130 MB, one-time download from within the app; Apple Silicon and Windows only).

## Features

* **Sheet music rendering**: drum charts from Clone Hero `.mid`/`.chart` files are rendered as standard notation in real time
* **Thousands of songs**: browse and download from the Enchor community library directly inside the app
* **MIDI e-kit support**: connect your electronic drum kit and get real-time hit detection scored against the chart, with a star rating at the end of each song
* **Stem mixer**: mute the recorded drums and hear your own playing; adjust levels per stem
* **Stem splitting**: separate a mixed recording into individual tracks automatically (macOS Apple Silicon and Windows; ~130 MB one-time download)
* **Scrolling playhead**: three modes: Cursor (follows note by note), Measure (highlights the current bar), or None
* **Color-coded notation**: each drum and cymbal maps to a distinct color; filled noteheads for drums, × for cymbals
* **Multiple difficulties**: switch between chart difficulties from the side menu
* **Favorites and search**: local library search plus online search with one-click download

## For developers

SightKick is an Electron + React 19 desktop app. Drum charts are parsed from Clone Hero `.mid`/`.chart` files and rendered as sheet music with VexFlow; the UI uses Tailwind CSS v4 and Ant Design v6.

Requires [Node.js](https://nodejs.org/) and [Yarn](https://yarnpkg.com/) v4 (Berry). This project uses `yarn` exclusively (don't use `npm`).

```bash
yarn install        # install dependencies
yarn start          # run in dev mode (Electron + hot reload)
yarn build          # compile main, preload, and renderer
yarn lint           # ESLint with --fix
yarn test           # Jest
yarn storybook      # component stories on :6006
yarn package        # build a macOS app (yarn package:win / package:linux)
```

## Acknowledgements

* [Enchor](https://www.enchor.us/) for the song library
* TheNathannator for the [GH/RB specification](https://github.com/TheNathannator/GuitarGame_ChartFormats)

## License

[MIT](LICENSE) © Anton Korolkov
