# Bottom-Left Scratchpad

A minimal VS Code extension that adds a persistent `<textarea>` under the Explorer view for quick notes.

## Features
- Always-on scratchpad in the sidebar
- Auto-saves to global state
- No configuration required

## Installation

1. Clone this repo
2. `npm install`
3. `npm run compile`
4. Install in VS Code:
   - `code --install-extension bottom-left-scratchpad-0.0.1.vsix` (after running `vsce package`)

## Development

- Press F5 to open a new Extension Development Host
- Make changes in `src/extension.ts` and recompile with `npm run watch`

## Usage

Open any folder in VS Code. You’ll see a **Scratchpad** pane under the Explorer. Type notes and they’ll be saved automatically.
