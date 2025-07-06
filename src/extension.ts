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

    // 2) Read indent size from settings
    const config = vscode.workspace.getConfiguration('bottomLeftScratchpad');
    const indentSize = config.get<number>('indentSize', 2);

    const escaped = savedContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 3) Build the HTML, injecting savedHeight if present
    webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;overflow:hidden;">
    <textarea
      id="pad"
      ${savedHeight ? '' : 'rows="6"'}
      style="
        width:100%;
        box-sizing:border-box;
        font-family:var(--vscode-editor-font-family);
        font-size:var(--vscode-editor-font-size);
        ${savedHeight ? `height:${savedHeight}px;` : ''}
        resize:vertical;
      "
    >${escaped}</textarea>

    <script>
      const vscode = acquireVsCodeApi();
      const pad = document.getElementById('pad');
      const indentSize = ${indentSize};
      const indentStr = ' '.repeat(indentSize);

      // Auto-save on any content change
      pad.addEventListener('input', () => {
        vscode.postMessage({ command: 'save', content: pad.value });
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

      // 🔔 Watch for manual resize (drag-resize) and persist height
      new ResizeObserver(entries => {
        for (const e of entries) {
          const h = Math.round(e.contentRect.height);
          vscode.postMessage({ command: 'resize', height: h });
        }
      }).observe(pad);
    </script>
  </body>
</html>`;

    // 4) Handle both save & resize messages per‐workspace
    webviewView.webview.onDidReceiveMessage(async msg => {
      if (msg.command === 'save') {
        await this.context.workspaceState.update('scratchContent', msg.content);
      } else if (msg.command === 'resize') {
        await this.context.workspaceState.update('scratchpadHeight', msg.height);
      }
    });
  }
}
