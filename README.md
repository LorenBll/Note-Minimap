# Note-Minimap

Adds a code-minimap style sidebar to each open markdown note for position awareness and fast scrolling.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Build](#build)
- [Configuration](#configuration)
- [Compatibility](#compatibility)
- [Licence](#licence)
- [Support](#support)
- [Author](#author)

## Features

- Shows a minimap inside each open markdown note tab. The minimap renders the note's markdown lines as colour-coded bars: headings by level, code blocks, quotes, lists, horizontal rules, emphasis, and plain text each have their own colour, so the note's structure is visible at a glance.
  - Why: The note is often too long to fit on screen, and a minimap lets the user see structure and location without scrolling the note itself.
  - How: The minimap appears automatically in every open markdown tab. No command is needed.
- Sizes each line bar by its text length. A short line renders as a short bar and a long line fills more of the minimap width, so the minimap reflects the actual shape of the note rather than uniform stripes.
  - Why: Uniform bars hide the difference between sparse and dense regions of the note.
  - How: Nothing to configure; the bar width follows the line's character count automatically.
- Displays the current viewport with surrounding context in idle state. While the note is not being navigated, the minimap shows the currently visible section together with some adjacent lines above and below it, framed by the viewport indicator. At the very top or bottom of the note the absent side naturally has no context.
  - Why: The user can see which section of the note is on screen and how it relates to the surrounding content.
  - How: Scroll the note; the minimap updates live to follow the visible section.
- Shows the full representation with faded overflow on hover. When the pointer enters the minimap, the full-note representation is displayed and the parts outside the minimap window are faded, gradually transitioning back to full opacity at the window edges.
  - Why: Hovering previews the whole note's structure without committing to navigation.
  - How: Move the pointer over the minimap; leave it to return to the idle view.
- Scrolls with the mouse wheel or trackpad. Scrolling the wheel over the minimap scrolls the note by the corresponding amount, exactly as dragging the viewport would.
  - Why: The wheel is a familiar way to traverse long content, and the minimap makes each scroll gesture move through the note.
  - How: Hover the minimap and scroll the wheel (or swipe on a trackpad).
- Navigates by dragging. Pressing and dragging on the minimap scrolls the note to the corresponding position, with the viewport centred on the click point. A viewport indicator tracks the current location on the minimap's representation.
  - Why: Long notes take many wheel or scrollbar drags to traverse; dragging the minimap jumps to any part quickly.
  - How: Press anywhere on the minimap and drag. The note scrolls while dragging; when the viewport indicator reaches the top or bottom of the currently rendered portion, the minimap pans to reveal the following parts.
- Returns to the idle view after dragging. When the drag ends, the full-note representation is no longer shown for navigation and the minimap returns to the viewport-with-context view, or stays on the full representation if the pointer is still over the minimap.
  - Why: After navigating, the minimap returns to its informative idle state instead of staying in navigation mode.
  - How: Release the pointer after dragging. Move the pointer away from the minimap to see the idle view.
- Positions and sizes the minimap from settings. The minimap can sit on the left or right side of the tab, and its width, height, and vertical offset from the top of the note area are adjustable.
  - Why: Each user works with a different editor width, note length, and preference for where auxiliary information belongs.
  - How: Change the settings in the plugin's settings tab. The minimaps of all open notes update immediately.

## Requirements

- Obsidian 1.13.7 or later (`minAppVersion` is `1.13.7`).
- Node.js 18 or later and npm for development.

## Setup

1. Install Node.js 18 or later.
2. Clone the repository.
3. Install dependencies:

```bash
npm install
```

No additional configuration is required.

## Usage

1. Build the plugin and install it into a vault (see Build).
2. Enable **Note-Minimap** in **Settings → Community plugins**.
3. Open or create a markdown note. A minimap appears on the side of the tab.
4. Scroll the note to see the viewport indicator follow the current section.
5. Hover over the minimap to preview the full note; scroll the wheel over it to traverse the note.
6. Drag on the minimap to navigate; the note scrolls and the minimap pans as needed.

## Build

Compile the plugin from `src/main.ts` to `main.js`:

```bash
npm run dev      # watch mode, inline sourcemap
npm run build    # production build, minified, no sourcemap
```

Run the linter:

```bash
npm run lint
```

Manual install for testing:

1. Run `npm run build`.
2. Copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/note-minimap/`.
3. Reload Obsidian and enable **Note-Minimap** in **Settings → Community plugins**.

## Configuration

All settings are in the plugin's settings tab and take effect immediately.

| Setting | Default | Effect |
| --- | --- | --- |
| `Minimap side` | `Right` | Side of the note tab where the minimap is displayed. |
| `Minimap width` | `140` | Width of the minimap in pixels. |
| `Minimap height` | `400` | Height of the minimap in pixels. The effective height never exceeds the available tab height above the vertical offset. |
| `Vertical offset` | `30` | Offset of the minimap from the top border of the note area, in pixels. |

## Compatibility

- `minAppVersion` is `1.13.7` as declared in `manifest.json`.
- `isDesktopOnly` is `false`; the plugin does not use desktop-only APIs. Pointer and scroll interactions work on touch devices.
- The minimap tracks note edits in source mode and note renders in reading mode.

## Licence

0BSD. See [LICENSE](LICENSE).

Copyright (C) 2020-2026 by Dynalist Inc.

## Support

Report issues at https://github.com/LorenBll/Note-Minimap/issues.

## Author

[LorenBll](https://github.com/LorenBll)