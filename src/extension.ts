import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ScratchpadViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'bottomLeftScratchpad',
      provider
    )
  );
}

class ScratchpadViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };

    // 1) Load saved notes and saved height (px) per‐workspace
    const savedContent =
      this.context.workspaceState.get<string>('scratchContent') || '';
    const savedHeight =
      this.context.workspaceState.get<number>('scratchpadHeight') || 0;

    // 2) Read settings
    const config = vscode.workspace.getConfiguration('bottomLeftScratchpad');
    const indentSize = config.get<number>('indentSize', 2);

    // 3) Get VS Code color theme
    const colorTheme = vscode.window.activeColorTheme.kind;
    const isDarkTheme = colorTheme === vscode.ColorThemeKind.Dark || 
                       colorTheme === vscode.ColorThemeKind.HighContrast;

    const escaped = savedContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 4) Build CSS based on VS Code theme
    const css = this.buildCSS(isDarkTheme);

    // 5) Build the HTML, injecting savedHeight if present
    webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <style>
      ${css}
    </style>
  </head>
  <body style="margin:0;padding:0;overflow:hidden;">
    <div id="container" style="position:relative;width:100%;${savedHeight ? `height:${savedHeight}px;` : 'height:auto;'}">
      <div id="display" style="
        position:absolute;
        top:0;
        left:0;
        right:0;
        bottom:0;
        padding:8px;
        box-sizing:border-box;
        font-family:var(--vscode-editor-font-family, monospace);
        font-size:var(--vscode-editor-font-size);
        line-height:1.4;
        white-space:pre-wrap;
        word-wrap:break-word;
        overflow-wrap:break-word;
        overflow-y:auto;
        pointer-events:none;
      "></div>
      <textarea
        id="pad"
        ${savedHeight ? '' : 'rows="6"'}
        style="
          position:absolute;
          top:0;
          left:0;
          width:100%;
          height:100%;
          box-sizing:border-box;
          font-family:var(--vscode-editor-font-family, monospace);
          font-size:var(--vscode-editor-font-size);
          line-height:1.4;
          white-space:pre-wrap;
          word-wrap:break-word;
          overflow-wrap:break-word;
          background:transparent;
          resize:none;
          padding:8px;
        "
      >${escaped}</textarea>
      <div id="resizer" style="
        position:absolute;
        bottom:0;
        right:0;
        width:20px;
        height:20px;
        cursor:nwse-resize;
        user-select:none;
      "></div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const pad = document.getElementById('pad');
      const display = document.getElementById('display');
      const container = document.getElementById('container');
      const resizer = document.getElementById('resizer');
      const indentSize = ${indentSize};
      const indentStr = ' '.repeat(indentSize);

      // Function to render text with hanging indents
      function renderWithIndents(text) {
        const lines = text.split('\\n');
        display.innerHTML = '';
        
        lines.forEach((line, index) => {
          const lineDiv = document.createElement('div');
          lineDiv.style.position = 'relative';
          lineDiv.style.minHeight = '1.4em';
          
          // Count leading spaces
          let leadingSpaces = 0;
          while (leadingSpaces < line.length && line[leadingSpaces] === ' ') {
            leadingSpaces++;
          }
          
          // Calculate indent in ch units (character width)
          const indentWidth = leadingSpaces + 'ch';
          
          // Apply hanging indent
          lineDiv.style.textIndent = '-' + indentWidth;
          lineDiv.style.paddingLeft = indentWidth;
          
          // Set content
          lineDiv.textContent = line || '\\u200B'; // Zero-width space for empty lines
          
          display.appendChild(lineDiv);
        });
      }

      // Initial render
      renderWithIndents(pad.value);

      // Auto-save on any content change
      pad.addEventListener('input', () => {
        vscode.postMessage({ command: 'save', content: pad.value });
        renderWithIndents(pad.value);
      });

      pad.addEventListener('keydown', e => {
        const value = pad.value;
        const sel = pad.selectionStart;
        const lineStart = value.lastIndexOf('\\n', sel - 1) + 1;
        const offset = sel - lineStart;

        // count full leading spaces this line
        let indentTotal = 0;
        while (
          indentTotal < value.length - lineStart &&
          value[lineStart + indentTotal] === ' '
        ) {
          indentTotal++;
        }

        // 1) ENTER → preserve indent
        if (e.key === 'Enter') {
          e.preventDefault();
          const line = value.slice(lineStart, sel);
          const match = line.match(/^\\s*/);
          const indent = match ? match[0] : '';
          const insert = '\\n' + indent;
          pad.setRangeText(insert, sel, sel, 'end');
          pad.selectionStart = pad.selectionEnd = sel + insert.length;

        // 2) TAB / SHIFT+TAB → indent/unindent at start
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) {
            if (indentTotal >= indentSize) {
              pad.setRangeText(
                '',
                lineStart,
                lineStart + indentSize,
                'start'
              );
              const newOffset = Math.max(0, offset - indentSize);
              pad.selectionStart = pad.selectionEnd = lineStart + newOffset;
            }
          } else {
            pad.setRangeText(indentStr, lineStart, lineStart, 'start');
            pad.selectionStart = pad.selectionEnd = sel + indentSize;
          }

        // 3) BACKSPACE → chunk-delete in indent region
        } else if (e.key === 'Backspace') {
          if (offset > 0 && offset <= indentTotal && indentTotal >= indentSize) {
            e.preventDefault();
            pad.setRangeText(
              '',
              lineStart,
              lineStart + indentSize,
              'start'
            );
            const newOffset = Math.max(0, offset - indentSize);
            pad.selectionStart = pad.selectionEnd = lineStart + newOffset;
          }
          // else default backspace

        // 4) / 5) Arrow keys → step by chunk in indent
        } else if (
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
          !e.shiftKey && !e.ctrlKey && !e.altKey
        ) {
          const dir = e.key === 'ArrowLeft' ? -1 : +1;
          if ((dir < 0 && offset > 0) || (dir > 0 && offset < indentTotal)) {
            e.preventDefault();
            const newOffset = Math.min(
              indentTotal,
              Math.max(0, offset + dir * indentSize)
            );
            pad.selectionStart = pad.selectionEnd = lineStart + newOffset;
          }
        }
      });

      // 6) CLICK inside indent → snap to nearest chunk
      pad.addEventListener('mouseup', () => {
        const sel = pad.selectionStart;
        const value = pad.value;
        const lineStart = value.lastIndexOf('\\n', sel - 1) + 1;
        const offset = sel - lineStart;
        let indentTotal = 0;
        while (
          indentTotal < value.length - lineStart &&
          value[lineStart + indentTotal] === ' '
        ) {
          indentTotal++;
        }
        if (offset > 0 && offset < indentTotal) {
          const nearest = Math.round(offset / indentSize) * indentSize;
          pad.selectionStart = pad.selectionEnd = lineStart + nearest;
        }
      });

      // Sync scroll positions
      pad.addEventListener('scroll', () => {
        display.scrollTop = pad.scrollTop;
        display.scrollLeft = pad.scrollLeft;
      });

      // Handle manual resizing
      let isResizing = false;
      let startY = 0;
      let startHeight = 0;

      resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = container.offsetHeight;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(100, startHeight + deltaY);
        container.style.height = newHeight + 'px';
      });

      document.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          const h = container.offsetHeight;
          vscode.postMessage({ command: 'resize', height: h });
        }
      });

      // Set initial height if saved
      const savedHeight = ${savedHeight};
      if (savedHeight && savedHeight > 0) {
        container.style.height = savedHeight + 'px';
      } else {
        // Default height based on rows
        container.style.height = (6 * 1.4 * 16 + 16) + 'px'; // 6 rows * line-height * font-size + padding
      }
    </script>
  </body>
</html>`;

    // 6) Handle both save & resize messages per‐workspace
    webviewView.webview.onDidReceiveMessage(async msg => {
      if (msg.command === 'save') {
        await this.context.workspaceState.update('scratchContent', msg.content);
      } else if (msg.command === 'resize') {
        await this.context.workspaceState.update('scratchpadHeight', msg.height);
      }
    });
  }

  private buildCSS(isDarkTheme: boolean): string {
    if (isDarkTheme) {
      return `
        body {
          background-color: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
        }
        
        #container {
          border: 1px solid var(--vscode-panel-border);
          background-color: var(--vscode-editor-background);
        }
        
        #container:focus-within {
          border-color: var(--vscode-focusBorder);
        }
        
        #display {
          color: var(--vscode-editor-foreground);
          background-color: transparent;
        }
        
        #display > div {
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        #pad {
          color: transparent;
          caret-color: var(--vscode-editor-foreground);
          outline: none;
          border: none;
        }
        
        #pad::selection {
          background-color: var(--vscode-textPreformat-background);
        }
        
        #resizer {
          background: linear-gradient(135deg, transparent 50%, var(--vscode-scrollbarSlider-background) 50%);
        }
        
        #resizer:hover {
          background: linear-gradient(135deg, transparent 50%, var(--vscode-scrollbarSlider-hoverBackground) 50%);
        }
      `;
    } else {
      return `
        body {
          background-color: var(--vscode-sideBar-background);
          color: var(--vscode-sideBar-foreground);
        }
        
        #container {
          border: 1px solid var(--vscode-panel-border);
          background-color: var(--vscode-sideBar-background);
        }
        
        #container:focus-within {
          border-color: var(--vscode-focusBorder);
        }
        
        #display {
          color: var(--vscode-sideBar-foreground);
          background-color: transparent;
        }
        
        #display > div {
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        #pad {
          color: transparent;
          caret-color: var(--vscode-sideBar-foreground);
          outline: none;
          border: none;
        }
        
        #pad::selection {
          background-color: var(--vscode-textPreformat-background);
        }
        
        #resizer {
          background: linear-gradient(135deg, transparent 50%, var(--vscode-scrollbarSlider-background) 50%);
        }
        
        #resizer:hover {
          background: linear-gradient(135deg, transparent 50%, var(--vscode-scrollbarSlider-hoverBackground) 50%);
        }
      `;
    }
  }
}
