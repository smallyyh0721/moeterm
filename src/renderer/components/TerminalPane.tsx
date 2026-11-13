import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { fileStamp } from '../../shared/format';
import type { TabModel } from '../lib/prompt';
import { failureKeyAction } from '../../shared/terminal-keys';
import { TERM_FONT, TERM_THEME, bufferText } from '../lib/terminal';

export function TerminalPane({
  tab,
  active,
  visible,
  gridArea,
  onActivate,
  fontSize,
  onDims,
  onFontStep,
  onRetry,
  onDismiss,
}: {
  tab: TabModel;
  active: boolean;
  visible: boolean;
  gridArea?: { gridColumn: string; gridRow: string };
  onActivate: () => void;
  fontSize: number;
  onDims: (cols: number, rows: number) => void;
  onFontStep: (delta: number) => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(tab.sessionId);
  const onDimsRef = useRef(onDims);
  const onFontStepRef = useRef(onFontStep);
  const onRetryRef = useRef(onRetry);
  const onDismissRef = useRef(onDismiss);
  const statusRef = useRef(tab.status);
  const messageRef = useRef(tab.message);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  sessionRef.current = tab.sessionId;
  onDimsRef.current = onDims;
  onFontStepRef.current = onFontStep;
  onRetryRef.current = onRetry;
  onDismissRef.current = onDismiss;
  statusRef.current = tab.status;
  messageRef.current = tab.message;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      fontFamily: TERM_FONT,
      fontSize,
      theme: TERM_THEME,
      cursorBlink: true,
      scrollback: 8000,
      allowProposedApi: false,
      rightClickSelectsWord: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(
      new WebLinksAddon((event, uri) => {
        event.preventDefault();
        void window.moeterm.openExternal(uri);
      }),
    );
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;
    term.onData((data) => {
      const sessionId = sessionRef.current;
      if (sessionId) void window.moeterm.write(sessionId, data);
    });
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown' || event.isComposing) return true;
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.shiftKey && key === 'c') {
        void copySelection(term);
        return false;
      }
      if ((event.ctrlKey && event.shiftKey && key === 'v') || (event.shiftKey && event.key === 'Insert') || (event.ctrlKey && !event.shiftKey && key === 'v')) {
        void pasteInto(term);
        return false;
      }
      if (event.ctrlKey && !event.shiftKey && key === 'c' && term.hasSelection()) {
        void copySelection(term);
        return false;
      }
      const action = failureKeyAction(
        statusRef.current,
        event.key,
        event.ctrlKey || event.altKey || event.metaKey,
      );
      if (action === 'close') {
        onDismissRef.current();
        return false;
      }
      if (action === 'retry') {
        onRetryRef.current();
        return false;
      }
      return true;
    });
    // Windows Chromium pastes into xterm's textarea on a second right-click
    // unless that gesture is stopped before xterm focuses the textarea.
    let blockPasteUntil = 0;
    const onRightDown = (event: MouseEvent) => {
      if (event.button === 2) blockPasteUntil = performance.now() + 400;
    };
    const onMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      blockPasteUntil = performance.now() + 400;
      const width = 196;
      const height = 248;
      setMenu({
        x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
        y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
      });
    };
    const onPaste = (event: ClipboardEvent) => {
      if (performance.now() > blockPasteUntil) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      onFontStepRef.current(event.deltaY < 0 ? 1 : -1);
    };
    host.addEventListener('mousedown', onRightDown, true);
    host.addEventListener('contextmenu', onMenu, true);
    host.addEventListener('paste', onPaste, true);
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      host.removeEventListener('mousedown', onRightDown, true);
      host.removeEventListener('contextmenu', onMenu, true);
      host.removeEventListener('paste', onPaste, true);
      host.removeEventListener('wheel', onWheel);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    if (visible) fitRef.current?.fit();
  }, [fontSize, visible]);

  useEffect(() => {
    if (active) termRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!visible) return;
    const host = hostRef.current;
    const fit = fitRef.current;
    if (!host || !fit) return;
    const apply = () => {
      fit.fit();
      const dims = fit.proposeDimensions();
      if (!dims) return;
      if (active) onDimsRef.current(dims.cols, dims.rows);
      const sessionId = sessionRef.current;
      if (sessionId) void window.moeterm.resize(sessionId, dims.cols, dims.rows);
    };
    apply();
    const observer = new ResizeObserver(() => apply());
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible, active, fontSize, tab.sessionId]);

  useEffect(() => {
    const sessionId = tab.sessionId;
    const term = termRef.current;
    if (!sessionId || !term) return;
    const off = window.moeterm.onSshData((event) => {
      if (event.sessionId === sessionId) term.write(event.data);
    });
    void window.moeterm.attach(sessionId);
    return off;
  }, [tab.sessionId]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !tab.message) return;
    if (tab.status === 'error' && tab.message) {
      term.write(`\r\n\x1b[31m${tab.message}\x1b[0m\r\n\x1b[33m按 R 重试，按 Enter 关闭此终端\x1b[0m\r\n`);
      if (active) term.focus();
    } else if (tab.status === 'closed') {
      term.write(`\r\n\x1b[31m${tab.message ?? '连接已断开'}\x1b[0m\r\n\x1b[33m按 Enter 关闭此终端\x1b[0m\r\n`);
      if (active) term.focus();
    }
  }, [tab.status, tab.message, active]);

  const term = termRef.current;

  return (
    <div
      className={visible ? (active ? 'pane active shown' : 'pane shown') : 'pane'}
      style={visible ? gridArea : undefined}
      onMouseDown={onActivate}
    >
      <div className="pane-head">
        <span className={`dot ${tab.status === 'connected' ? 'on' : tab.status === 'connecting' ? 'wait' : ''}`} />
        <span className="pane-title">{tab.title}</span>
      </div>
      <div className="crt" ref={hostRef} />
      {tab.status === 'error' && tab.message ? (
        <button type="button" className="term-retry" onClick={() => onRetry()}>
          重试
        </button>
      ) : null}
      {menu && term ? (
        <>
          <div className="menu-catch" onMouseDown={() => setMenu(null)} />
          <div
            className="menu"
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <button type="button" disabled={!term.hasSelection()} onClick={() => { void copySelection(term); setMenu(null); }}>复制</button>
            <button type="button" onClick={() => { void pasteInto(term); setMenu(null); }}>粘贴</button>
            <button type="button" onClick={() => { term.selectAll(); setMenu(null); }}>全选</button>
            <button
              type="button"
              disabled={!term.hasSelection()}
              onClick={() => {
                void exportText(term.getSelection(), `moeterm-selection-${fileStamp()}`);
                setMenu(null);
              }}
            >
              导出所选为 TXT
            </button>
            <button
              type="button"
              onClick={() => {
                void exportText(bufferText(term), `moeterm-buffer-${fileStamp()}`);
                setMenu(null);
              }}
            >
              导出缓冲区为 TXT
            </button>
            <button type="button" onClick={() => { term.clear(); setMenu(null); }}>清屏</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

async function copySelection(term: Terminal): Promise<void> {
  const text = term.getSelection();
  if (!text) return;
  await window.moeterm.copyText(text);
}

async function pasteInto(term: Terminal): Promise<void> {
  const result = await window.moeterm.pasteText();
  if (result.ok && result.data) term.paste(result.data);
}

async function exportText(text: string, defaultName: string): Promise<void> {
  if (!text) return;
  await window.moeterm.exportText({ text, defaultName });
}
