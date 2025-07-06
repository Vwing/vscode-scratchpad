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

    // Load any saved notes
    const saved = this.context.globalState.get<string>('scratchContent') || '';
    const escaped = saved
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Read indent size from user settings
    const config = vscode.workspace.getConfiguration('bottomLeftScratchpad');
    const indentSize = config.get<number>('indentSize', 2);

    webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;overflow:hidden;">
    <textarea
      id="pad"
      rows="6"
      style="
        width:100%;
        box-sizing:border-box;
        font-family:var(--vscode-editor-font-family);
        font-size:var(--vscode-editor-font-size);
      "
    >${escaped}</textarea>

    <script>
      const vscode = acquireVsCodeApi();
      const pad = document.getElementById('pad');
      const indentSize = ${indentSize};
      const indentStr = ' '.repeat(indentSize);

      // Auto-save on any change
      pad.addEventListener('input', () => {
        vscode.postMessage({ command: 'save', content: pad.value });
      });

      pad.addEventListener('keydown', e => {
        const value = pad.value;
        const sel = pad.selectionStart;
        const lineStart = value.lastIndexOf('\\n', sel - 1) + 1;
        const offset = sel - lineStart;

        // Compute how many leading spaces this line has
        let indentTotal = 0;
        while (
          indentTotal < value.length - lineStart &&
          value[lineStart + indentTotal] === ' '
        ) {
          indentTotal++;
        }

        // 1) ENTER: preserve entire indentTotal
        if (e.key === 'Enter') {
          e.preventDefault();
          const line = value.slice(lineStart, sel);
          const match = line.match(/^\\s*/);
          const indent = match ? match[0] : '';
          const insert = '\\n' + indent;
          pad.setRangeText(insert, sel, sel, 'end');
          pad.selectionStart = pad.selectionEnd = sel + insert.length;

        // 2) TAB / SHIFT+TAB: only at start-of-line
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) {
            // unindent one chunk if possible
            if (indentTotal >= indentSize) {
              pad.setRangeText('', lineStart, lineStart + indentSize, 'start');
              const newOffset = Math.max(0, offset - indentSize);
              pad.selectionStart = pad.selectionEnd = lineStart + newOffset;
            }
          } else {
            // indent one chunk
            pad.setRangeText(indentStr, lineStart, lineStart, 'start');
            pad.selectionStart = pad.selectionEnd = sel + indentSize;
          }

        // 3) BACKSPACE: smart-chunk delete if inside indent region
        } else if (e.key === 'Backspace') {
          if (offset > 0 && offset <= indentTotal && indentTotal >= indentSize) {
            e.preventDefault();
            // remove one indent chunk from the front
            pad.setRangeText('', lineStart, lineStart + indentSize, 'start');
            const newOffset = Math.max(0, offset - indentSize);
            pad.selectionStart = pad.selectionEnd = lineStart + newOffset;
          }
          // else fall through to default

        // 4) ARROW LEFT: step by chunk within indent region
        } else if (
          e.key === 'ArrowLeft' &&
          !e.shiftKey && !e.ctrlKey && !e.altKey
        ) {
          if (offset > 0 && offset <= indentTotal) {
            e.preventDefault();
            const newOffset = Math.max(0, offset - indentSize);
            pad.selectionStart = pad.selectionEnd = lineStart + newOffset;
          }
          // else default

        // 5) ARROW RIGHT: likewise
        } else if (
          e.key === 'ArrowRight' &&
          !e.shiftKey && !e.ctrlKey && !e.altKey
        ) {
          if (offset < indentTotal) {
            e.preventDefault();
            const newOffset = Math.min(indentTotal, offset + indentSize);
            pad.selectionStart = pad.selectionEnd = lineStart + newOffset;
          }
        }
      });

      // 6) CLICK: snap caret inside indent to nearest chunk
      pad.addEventListener('mouseup', () => {
        const sel = pad.selectionStart;
        const value = pad.value;
        const lineStart = value.lastIndexOf('\\n', sel - 1) + 1;
        const offset = sel - lineStart;
        // re-calc indentTotal
        let indentTotal = 0;
        while (
          indentTotal < value.length - lineStart &&
          value[lineStart + indentTotal] === ' '
        ) {
          indentTotal++;
        }
        if (offset > 0 && offset < indentTotal) {
          const nearest =
            Math.round(offset / indentSize) * indentSize;
          pad.selectionStart = pad.selectionEnd = lineStart + nearest;
        }
      });
    </script>
  </body>
</html>`;

    webviewView.webview.onDidReceiveMessage(async msg => {
      if (msg.command === 'save') {
        await this.context.globalState.update(
          'scratchContent',
          msg.content
        );
      }
    });
  }
}
