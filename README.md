# AstraCamillaGui

A fork of [CamillaEQ](https://github.com/AlfredJKwack/camillaEQ) by AlfredJKwack.
It is a browser UI for [AstraCamillaDsp](https://github.com/alexanderp4580/AstraCamillaDSP),
a CamillaDSP fork, running on a Raspberry Pi under [moOde audio](https://moodeaudio.org/).

For how the EQ, pipeline and preset pages work, see the upstream
[README](https://github.com/AlfredJKwack/camillaEQ#readme) and [docs](docs/).

## Changes from upstream

- **Native spectrum.** The spectrum comes from AstraCamillaDsp's analysis API over
  the same websocket as everything else. This replaces upstream's second CamillaDSP
  instance (a bandpass filter bank on its own port). No spectrum port and no
  spectrum config are needed.
- **Energy page.** Live RMS and peak meters for each channel, with peak hold.
- **Night mode editor.** Adds an editor for AstraCamillaDsp's `NightMode` processor
  on the pipeline page.
- **Slider controls.** Sliders replace knobs in the EQ band and pipeline block editors.
- **DSP host defaults to the host that served the page.** Opening the UI from a
  phone connects to the Pi without typing an address.
- **Maintenance.** Dependencies upgraded, svelte-check clean, keyboard
  accessibility fixes. Built and tested on Node 24 only.

The UI can still connect to stock CamillaDSP. EQ, pipeline editing and presets
work there, but spectrum, energy and night mode need AstraCamillaDsp.

## Development

Needs Node 24 (`nvm use`).

```bash
npm install
npm run dev     # client on :5173, API on :3000
npm test
```

To run without real hardware, start the mock DSP and connect to `localhost:3146`:
```bash
npm -w server exec -- tsx -e "import { MockCamillaDSP } from './src/services/mockCamillaDSP'; new MockCamillaDSP().start()"
```

## Production

```bash
npm run build
npm run start   # serves the built UI and API on :3000
```
The server keeps presets in `server/data/`. To change that, set `CONFIG_DIR`. Other
settings are in [.env.example](.env.example). For a systemd unit, see
[deploy/systemd](deploy/systemd/).

## License

MIT, same as upstream. See [LICENSE](LICENSE).
