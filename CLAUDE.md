# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a VS Code extension that provides a persistent scratchpad/notepad widget in the bottom of the Explorer sidebar. It features intelligent indentation handling, dark mode support, and workspace-specific content storage.

## Commands

**Development:**
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Build for distribution
npm run vscode:prepublish
```

**Testing the extension:**
1. Open this project in VS Code
2. Press F5 to launch a new Extension Development Host window
3. The scratchpad will appear at the bottom of the Explorer panel

## Architecture

The extension follows a single-file architecture in `src/extension.ts`:

- **`activate()`** - Extension entry point that registers the webview provider
- **`ScratchpadViewProvider`** - Implements `vscode.WebviewViewProvider`
  - Manages webview lifecycle
  - Handles message passing between extension and webview
  - Persists content and height to workspace state
  - Generates HTML/CSS based on VS Code theme

Key architectural decisions:
- Uses VS Code's webview API for the UI (not a tree view or custom editor)
- All state is stored in `workspaceState` (not global state)
- The webview content is a single textarea with custom event handling
- No external dependencies besides VS Code API and TypeScript

## Important Implementation Details

**Indentation System:**
The extension implements a sophisticated indentation system that:
- Uses configurable indent size (default 2 spaces, configurable via `bottomLeftScratchpad.indentSize`)
- Tab/Shift+Tab indent/outdent selected lines
- Enter preserves current line indentation
- Backspace removes full indent chunks when at beginning of indented line
- Arrow keys and clicks snap to indent boundaries

**Theme Integration:**
The extension dynamically adapts to VS Code's color theme by reading theme colors and generating appropriate CSS variables.

**State Persistence:**
- Content is saved per workspace using keys: `bottomLeftScratchpad.content.${workspaceUri}`
- Height is saved per workspace using keys: `bottomLeftScratchpad.height.${workspaceUri}`