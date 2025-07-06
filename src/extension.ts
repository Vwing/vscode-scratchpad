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

  resolveWebviewView(
    webviewView: vscode.WebviewView
  ) {
    webviewView.webview.options = { enableScripts: true };

    const saved = this.context.globalState.get<string>('scratchContent') || '';
    const escaped = saved
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;overflow:hidden;">
    <textarea
      id="pad"
      rows="6"
      style="width:100%;box-sizing:border-box;font-family:var(--vscode-editor-font-family);font-size:var(--vscode-editor-font-size);"
    >${escaped}</textarea>

    <script>
      const vscode = acquireVsCodeApi();
      const pad = document.getElementById('pad');

      pad.addEventListener('input', () => {
        vscode.postMessage({ command: 'save', content: pad.value });
      });

      pad.addEventListener('keydown', e => {
        const selectionStart = pad.selectionStart;
        const value = pad.value;

        if (e.key === 'Enter') {
          e.preventDefault();
          const lineStart = value.lastIndexOf('\\n', selectionStart - 1) + 1;
          const line = value.slice(lineStart, selectionStart);
          const indentMatch = line.match(/^\\s*/);
          const indent = indentMatch ? indentMatch[0] : '';
          const insert = '\\n' + indent;
          pad.setRangeText(insert, selectionStart, selectionStart, 'end');
          pad.selectionStart = pad.selectionEnd = selectionStart + insert.length;

        } else if (e.key === 'Tab') {
          e.preventDefault();
          const lineStart = value.lastIndexOf('\\n', selectionStart - 1) + 1;

          if (e.shiftKey) {
            // Remove 2 spaces at start of line
            if (value.slice(lineStart, lineStart + 2) === '  ') {
              pad.setRangeText(
                '',
                lineStart,
                lineStart + 2,
                'start'
              );
              const newPos = selectionStart - 2;
              pad.selectionStart = pad.selectionEnd = newPos > lineStart ? newPos : lineStart;
            }
          } else {
            // Insert 2 spaces at start of line
            pad.setRangeText(
              '  ',
              lineStart,
              lineStart,
              'start'
            );
            pad.selectionStart = pad.selectionEnd = selectionStart + 2;
          }
        }
      });

      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.command === 'save') {
          // No-op, handled by postMessage
        }
      });
    </script>
  </body>
</html>`;
    webviewView.webview.onDidReceiveMessage(async msg => {
      if (msg.command === 'save') {
        await this.context.globalState.update('scratchContent', msg.content);
      }
    });
  }
}
