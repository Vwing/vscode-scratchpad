# Bottom-Left Scratchpad

A minimal VS Code extension that adds a persistent `<textarea>` under the Explorer view for quick notes.

## Features

- Always-on scratchpad in the sidebar  
- Defaults to ~6 lines, still resizable by dragging  
- **Indentation-aware editing**  
  - **Configurable** `indentSize` (default `2` spaces)  
  - **Tab / Shift+Tab** to indent/unindent _at the start_ of the current line  
  - **Enter** preserves the full leading indent from the previous line  
  - **Backspace** deletes a whole indent chunk when inside the indent region, otherwise behaves normally (including merging lines)  
  - **Arrow keys** move by full indent chunks within the indent region  
  - **Click** on leading spaces snaps the cursor to the nearest indent boundary  
- Auto-saves to global state  
- No build-time configuration required

## Configuration

You can tweak the number of spaces per indent level:

```jsonc
// in settings.json
{
  "bottomLeftScratchpad.indentSize": 4  // use 4-space indents instead of 2
}
```

## Installation

1. Clone this repo  
2. `npm install`  
3. `npm run compile`  
4. Package and install in VS Code:
   ```bash
   npm install -g vsce
   vsce package
   code --install-extension bottom-left-scratchpad-0.0.1.vsix
   ```

## Development

- Press **F5** to open a new Extension Development Host  
- Edit `src/extension.ts`, then recompile with `npm run compile`

## Usage

Open any folder in VS Code. You’ll see a **Scratchpad** pane under the Explorer.  
Type your notes—everything is saved automatically and indentation behaves like in an editor.