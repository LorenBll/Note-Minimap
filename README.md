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

- Shows a minimap inside each open markdown note tab. The minimap renders the note's markdown lines as colour-coded bars: file properties (YAML frontmatter), headings by level, code blocks, quotes, lists, horizontal rules, emphasis, and plain text each have their own colour, so the note's structure is visible at a glance.
  - Why: The note is often too long to fit on screen, and a minimap lets the user see structure and location without scrolling the note itself.
  - How: The minimap appears automatically in every open markdown tab. No command is needed.
- Sizes each line bar by its text length. A short line renders as a short bar and a long line fills more of the minimap width, so the minimap reflects the actual shape of the note rather than uniform stripes.
  - Why: Uniform bars hide the difference between sparse and dense regions of the note.
  - How: Nothing to configure; the bar width follows the line's character count automatically.
- Scales each line's vertical size to its rendered height. A line that wraps onto several visual rows occupies proportionally more vertical space, and a heading occupies more than a plain line, so the minimap's vertical positions match the note's on-screen layout instead of collapsing every source line to one stripe.
  - Why: A fixed-height stripe per source line compresses wrapped lines into a single line and stops the minimap from corresponding to what is on screen.
  - How: Nothing to configure; the vertical scale follows the rendered line heights automatically.
- Displays the current viewport with surrounding context in idle state. While the note is not being navigated, the minimap shows the currently visible section together with some adjacent lines above and below it, framed by the viewport indicator. At the very top or bottom of the note the absent side naturally has no context.
  - Why: The user can see which section of the note is on screen and how it relates to the surrounding content.
  - How: Scroll the note; the minimap updates live to follow the visible section. The viewport indicator tracks the note tab's scroll position and height exactly, so the content at the top of the screen is the content at the top of the indicator. Resizing the note tab re-computes the viewport in real time, without needing to hover over the minimap.
- Shows the scrollable space beyond the end of the note. Obsidian lets a note scroll past its last line so the cursor line can stay centred; the minimap represents this extra space as a striped region at the bottom of the representation, hatched with 45° oblique lines, and the viewport indicator extends into it when the note is scrolled there.
  - Why: The note's scroll range is larger than its content; a minimap that ignored the empty tail would misrepresent the viewport position near the end.
  - How: Scroll the note past its last line. The striped region and the viewport indicator reflect the extra space automatically.
- Shows the full representation with faded overflow on hover. When the pointer enters the minimap, the full-note representation is displayed and the parts outside the minimap window are faded, gradually transitioning back to full opacity at the window edges.
  - Why: Hovering previews the whole note's structure without committing to navigation.
  - How: Move the pointer over the minimap; leave it to return to the idle view.
- Enlarges the minimap on demand. While the pointer is over the minimap and the configured enlarge key is held, the minimap grows by a configurable percentage, animates smoothly to its new size, moves to the vertical centre of the tab, and stays on its configured side. The title bars and line bars enlarge at the same time, in an animation simultaneous with the minimap's own growth, so the enlarged view shows the same span of the note at a larger size instead of simply showing more of it.
  - Why: A larger, centred view makes a note's fine structure easier to read, while the normal size keeps the idle minimap unobtrusive.
  - How: Choose the **Enlarge key** and the **Enlargement** percentage in the settings. Hold that key and move the pointer over the minimap; release the key or leave the minimap to return to the normal size. While enlarged, scroll the wheel over the minimap to pan its window without moving the note; the viewport indicator stays at the viewport's position in the note, even when that lies outside the minimap's bounds.
- Shows title text in a tooltip while the minimap is enlarged. While the enlarge key is held, hovering a title bar for a heading at or above the configured **Title tooltip level** displays a tooltip beside the bar with the heading's text, with inline markdown removed.
  - Why: The coloured title bars show where titles are, but not what they say; the tooltip makes titles identifiable while navigating the enlarged minimap.
  - How: Enlarge the minimap and hover a title bar whose heading level is at or below the configured **Title tooltip level**. Click such a title bar to scroll the note so the clicked title ends up at the top of the viewport.
- Scrolls with the mouse wheel or trackpad. Scrolling the wheel over the minimap at normal size scrolls the note by the corresponding amount, scaled in proportion to the note tab's viewport size, so a larger viewport traverses the note faster and a smaller one more slowly. While the minimap is enlarged, the wheel instead pans the minimap's own window and leaves the note's viewport untouched.
  - Why: The wheel is a familiar way to traverse long content, and the minimap makes each scroll gesture move through the note; adapting the speed to the viewport keeps the gesture consistent as the tab is resized. In enlarged mode the note should stay put while the minimap window moves, so clicking a title then jumps the note to it.
  - How: Hover the minimap and scroll the wheel (or swipe on a trackpad) to traverse the note at normal size. Enlarge the minimap to pan its window instead; the panning is deliberately slow so each gesture positions the window precisely. No configuration is needed.
- Navigates by dragging. Pressing and dragging on the minimap scrolls the note to the corresponding position, with the viewport centred on the click point. A viewport indicator tracks the current location on the minimap's representation.
  - Why: Long notes take many wheel or scrollbar drags to traverse; dragging the minimap jumps to any part quickly.
  - How: Press anywhere on the minimap and drag. The note scrolls while dragging; when the viewport indicator reaches the top or bottom of the currently rendered portion, the minimap pans to reveal the following parts. The panning speed is proportionate to the viewport size, so a smaller viewport pans more slowly and the location stays easy to track.
- Returns to the idle view after dragging. When the drag ends, the full-note representation is no longer shown for navigation and the minimap returns to the viewport-with-context view, or stays on the full representation if the pointer is still over the minimap.
  - Why: After navigating, the minimap returns to its informative idle state instead of staying in navigation mode.
  - How: Release the pointer after dragging. Move the pointer away from the minimap to see the idle view.
- Positions and sizes the minimap from settings. The minimap can sit on the left or right side of the tab, and its width, height, and vertical offset are set as percentages of the tab size, so the minimap scales with the window. The vertical offset is measured from the top border of the note tab to the minimap's top, centre, or bottom, as chosen in the settings.
  - Why: Each user works with a different editor width, note length, and preference for where auxiliary information belongs; relative sizing keeps the minimap proportionate as the tab resizes.
  - How: Change the settings in the plugin's settings tab. The minimaps of all open notes update immediately.
- Optionally hides the minimap in reading mode. The minimap can be restricted to editing mode, leaving reading mode without the sidebar.
  - Why: In reading mode the note is already rendered as a readable page, and some users prefer an uncluttered view.
  - How: Disable **Show minimap in reading mode** in the plugin's settings. The minimaps of all open notes update immediately.
- Excludes selected files and folders. The minimap is not shown for notes matching configured paths or glob patterns.
  - Why: Not every note benefits from a minimap, and some layouts are better left untouched.
  - How: In the settings tab, use **Exclusions → Add exclusion** to select a file or folder from the vault, or type a path or glob pattern. Patterns ending with `/` match a folder and everything inside it. Examples: `dashboard.md`, `dashboards/`, `**/templates/*.md`.

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
6. Hold the enlarge key (default **Shift**) while hovering the minimap to enlarge it, centre it vertically, and scale up the bars; release the key to return to the normal size. While enlarged, hover a title bar to see its text and scroll the wheel to pan the minimap window without moving the note.
7. While enlarged, click a title bar to scroll the note so the clicked title ends up at the top of the viewport.
8. Drag on the minimap to navigate; the note scrolls and the minimap pans as needed.
9. To hide the minimap in reading mode or for specific notes, adjust **Show minimap in reading mode** and **Exclusions** in the settings.

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
| `Show minimap in reading mode` | `Enabled` | Whether the minimap is displayed when the note is shown in reading mode. |
| `Minimap width` | `15` | Width of the minimap as a percentage of the note tab width. |
| `Minimap height` | `60` | Height of the minimap as a percentage of the note tab height. The effective height never exceeds the tab height above the vertical offset. |
| `Vertical offset` | `5` | Offset of the minimap from the top border of the note tab, as a percentage of the note tab height. The offset is applied to the point selected by `Vertical offset anchor`. |
| `Vertical offset anchor` | `Top` | Point of the minimap from which the vertical offset is measured: the minimap top, centre, or bottom. The offset is always measured from the top border of the note tab. |
| `Enlarge key` | `Shift` | Modifier key that, while held with the pointer over the minimap, enlarges it. One of `Shift`, `Control`, `Alt`, or `Meta`. |
| `Enlargement` | `50` | Percentage by which the minimap grows while the enlarge key is held. The title and line bars scale with the enlargement. The enlarged minimap animates to its new size, stays vertically centred, and remains on its configured side. |
| `Title tooltip level` | `3` | Deepest heading level that shows a tooltip while the minimap is enlarged. Level `3` shows tooltips for H1, H2, and H3 titles. |
| `Excluded files and folders` | `(none)` | Paths or glob patterns of files and folders that never show a minimap. Patterns ending with `/` match a folder and everything inside it. |

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