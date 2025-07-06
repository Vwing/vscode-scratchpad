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
      
      /* Editor container styles */
      #editor-container {
        width: 100%;
        ${savedHeight ? `height: ${savedHeight}px;` : 'height: 150px;'}
        position: relative;
        border: 1px solid var(--vscode-panel-border);
        box-sizing: border-box;
      }
      
      #editor-container:focus-within {
        border-color: var(--vscode-focusBorder);
      }
      
      /* CodeMirror 5 styles */
      .CodeMirror {
        height: 100% !important;
        font-family: var(--vscode-editor-font-family, monospace) !important;
        font-size: var(--vscode-editor-font-size, 13px) !important;
        border: none !important;
      }
      
      .CodeMirror-scroll {
        padding: 8px !important;
      }
      
      /* Hanging indent for wrapped lines */
      .CodeMirror-wrap pre {
        padding-left: 0;
        text-indent: 0;
      }
      
      .CodeMirror .CodeMirror-line {
        text-indent: 0;
      }
      
      .CodeMirror-wrap .CodeMirror-line > span {
        padding-left: 0;
      }
      
      .CodeMirror-cursor {
        border-left-color: var(--vscode-editor-foreground) !important;
      }
      
      .CodeMirror-selected {
        background-color: var(--vscode-textPreformat-background) !important;
      }
      
      .CodeMirror-focused .CodeMirror-selected {
        background-color: var(--vscode-textPreformat-background) !important;
      }
      
      /* Resize handle */
      #resizer {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
        background: linear-gradient(135deg, transparent 50%, var(--vscode-scrollbarSlider-background) 50%);
        z-index: 10;
      }
      
      #resizer:hover {
        background: linear-gradient(135deg, transparent 50%, var(--vscode-scrollbarSlider-hoverBackground) 50%);
      }
    </style>
    <!-- Load bundled CodeMirror that includes all dependencies -->
    <script src="https://unpkg.com/codemirror@5.65.2/lib/codemirror.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/codemirror@5.65.2/lib/codemirror.css">
    <!-- Load wrap mode addon for proper hanging indents -->
    <script src="https://unpkg.com/codemirror@5.65.2/addon/wrap/hardwrap.js"></script>
  </head>
  <body style="margin:0;padding:0;overflow:hidden;">
    <div id="editor-container">
      <textarea id="editor">${escaped}</textarea>
      <div id="resizer"></div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const container = document.getElementById('editor-container');
      const resizer = document.getElementById('resizer');
      const indentSize = ${indentSize};
      const indentStr = ' '.repeat(indentSize);
      
      // Initialize CodeMirror 5 (more stable for webviews)
      const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
        lineNumbers: false,
        lineWrapping: true,
        indentUnit: indentSize,
        tabSize: indentSize,
        indentWithTabs: false,
        theme: 'default',
        mode: 'text/plain',
        styleActiveLine: false,
        viewportMargin: Infinity
      });
      
      // Custom hanging indent implementation
      function updateHangingIndents() {
        const wrapper = editor.getWrapperElement();
        const lines = wrapper.querySelectorAll('.CodeMirror-line');
        
        lines.forEach((lineElement, index) => {
          const lineText = editor.getLine(index);
          if (!lineText) return;
          
          // Count leading spaces
          let leadingSpaces = 0;
          while (leadingSpaces < lineText.length && lineText[leadingSpaces] === ' ') {
            leadingSpaces++;
          }
          
          if (leadingSpaces > 0) {
            const indentPx = leadingSpaces * 7; // Approximate char width
            lineElement.style.textIndent = \`-\${indentPx}px\`;
            lineElement.style.paddingLeft = \`\${indentPx}px\`;
          } else {
            lineElement.style.textIndent = '';
            lineElement.style.paddingLeft = '';
          }
        });
      }
      
      // Update hanging indents on content change
      editor.on('change', updateHangingIndents);
      editor.on('refresh', updateHangingIndents);
      
      // Initial update
      setTimeout(updateHangingIndents, 100);
      
      // Set height
      editor.setSize('100%', '100%');
      
      // Apply custom styles
      const isDark = ${isDarkTheme};
      if (isDark) {
        editor.getWrapperElement().style.backgroundColor = 'var(--vscode-editor-background)';
        editor.getWrapperElement().style.color = 'var(--vscode-editor-foreground)';
      } else {
        editor.getWrapperElement().style.backgroundColor = 'var(--vscode-sideBar-background)';
        editor.getWrapperElement().style.color = 'var(--vscode-sideBar-foreground)';
      }
      
      // Remove gutter
      editor.getWrapperElement().querySelector('.CodeMirror-gutters').style.display = 'none';
      editor.getWrapperElement().querySelector('.CodeMirror-sizer').style.marginLeft = '0';
      
      // Auto-save on change
      let saveTimeout;
      editor.on('change', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          vscode.postMessage({ command: 'save', content: editor.getValue() });
        }, 300);
      });
      
      // Smart indentation key bindings
      editor.setOption('extraKeys', {
        'Tab': (cm) => {
          const cursor = cm.getCursor();
          const line = cm.getLine(cursor.line);
          const lineStart = cursor.ch;
          
          // Count leading spaces
          let leadingSpaces = 0;
          while (leadingSpaces < line.length && line[leadingSpaces] === ' ') {
            leadingSpaces++;
          }
          
          // If cursor is at start of line or within leading indent, add indent at start
          if (lineStart <= leadingSpaces) {
            cm.replaceRange(indentStr, {line: cursor.line, ch: 0}, {line: cursor.line, ch: 0});
            cm.setCursor({line: cursor.line, ch: cursor.ch + indentSize});
          } else {
            // Otherwise just insert spaces at cursor
            cm.replaceSelection(indentStr);
          }
        },
        
        'Shift-Tab': (cm) => {
          const cursor = cm.getCursor();
          const line = cm.getLine(cursor.line);
          const lineStart = cursor.ch;
          
          // Count leading spaces
          let leadingSpaces = 0;
          while (leadingSpaces < line.length && line[leadingSpaces] === ' ') {
            leadingSpaces++;
          }
          
          // Only unindent if we have enough leading spaces and cursor is in indent region
          if (leadingSpaces >= indentSize && lineStart <= leadingSpaces) {
            cm.replaceRange('', {line: cursor.line, ch: 0}, {line: cursor.line, ch: indentSize});
            const newCh = Math.max(0, cursor.ch - indentSize);
            cm.setCursor({line: cursor.line, ch: newCh});
          }
        },
        
        'Enter': (cm) => {
          const cursor = cm.getCursor();
          const line = cm.getLine(cursor.line);
          const match = line.match(/^\\s*/);
          const indent = match ? match[0] : '';
          cm.replaceSelection('\\n' + indent);
        },
        
        'Backspace': (cm) => {
          const cursor = cm.getCursor();
          const line = cm.getLine(cursor.line);
          const offset = cursor.ch;
          
          // Count leading spaces
          let leadingSpaces = 0;
          while (leadingSpaces < line.length && line[leadingSpaces] === ' ') {
            leadingSpaces++;
          }
          
          // If cursor is within indent region and we have enough spaces, delete chunk
          if (offset > 0 && offset <= leadingSpaces && leadingSpaces >= indentSize) {
            cm.replaceRange('', {line: cursor.line, ch: 0}, {line: cursor.line, ch: indentSize});
            const newCh = Math.max(0, offset - indentSize);
            cm.setCursor({line: cursor.line, ch: newCh});
          } else {
            // Default backspace behavior
            return CodeMirror.Pass;
          }
        },
        
        'Left': (cm) => {
          const cursor = cm.getCursor();
          const line = cm.getLine(cursor.line);
          const offset = cursor.ch;
          
          // Count leading spaces
          let leadingSpaces = 0;
          while (leadingSpaces < line.length && line[leadingSpaces] === ' ') {
            leadingSpaces++;
          }
          
          // If within indent region, move by chunks
          if (offset > 0 && offset <= leadingSpaces) {
            const newOffset = Math.max(0, offset - indentSize);
            cm.setCursor({line: cursor.line, ch: newOffset});
          } else {
            return CodeMirror.Pass;
          }
        },
        
        'Right': (cm) => {
          const cursor = cm.getCursor();
          const line = cm.getLine(cursor.line);
          const offset = cursor.ch;
          
          // Count leading spaces
          let leadingSpaces = 0;
          while (leadingSpaces < line.length && line[leadingSpaces] === ' ') {
            leadingSpaces++;
          }
          
          // If within indent region, move by chunks
          if (offset < leadingSpaces) {
            const newOffset = Math.min(leadingSpaces, offset + indentSize);
            cm.setCursor({line: cursor.line, ch: newOffset});
          } else {
            return CodeMirror.Pass;
          }
        }
      });

      // Click-to-snap for indent boundaries
      editor.on('cursorActivity', () => {
        // Delay to allow click event to complete
        setTimeout(() => {
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          const offset = cursor.ch;
          
          // Count leading spaces
          let leadingSpaces = 0;
          while (leadingSpaces < line.length && line[leadingSpaces] === ' ') {
            leadingSpaces++;
          }
          
          // If cursor is within indent region but not on boundary, snap to nearest
          if (offset > 0 && offset < leadingSpaces) {
            const nearest = Math.round(offset / indentSize) * indentSize;
            editor.setCursor({line: cursor.line, ch: nearest});
          }
        }, 10);
      });
      
      // Handle resizing
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
        editor.setSize('100%', '100%'); // Refresh CodeMirror size
      });

      document.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          const h = container.offsetHeight;
          vscode.postMessage({ command: 'resize', height: h });
        }
      });
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
        
        /* CodeMirror 5 styles for dark theme */
        .CodeMirror {
          background-color: var(--vscode-editor-background) !important;
          color: var(--vscode-editor-foreground) !important;
        }
        
        .CodeMirror-lines {
          color: var(--vscode-editor-foreground) !important;
        }
      `;
    } else {
      return `
        body {
          background-color: var(--vscode-sideBar-background);
          color: var(--vscode-sideBar-foreground);
        }
        
        /* CodeMirror 5 styles for light theme */
        .CodeMirror {
          background-color: var(--vscode-sideBar-background) !important;
          color: var(--vscode-sideBar-foreground) !important;
        }
        
        .CodeMirror-lines {
          color: var(--vscode-sideBar-foreground) !important;
        }
      `;
    }
  }
}
