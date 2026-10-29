import { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { fileStamp } from '../../shared/format';
import type { TabModel } from '../lib/prompt';
import { TERM_FONT, TERM_THEME, bufferText } from '../lib/terminal';

export function TerminalPane({
  tab,
  active,
  fontSize,
  onDims,
}: {
  tab: TabModel;
  active: boolean;
  fontSize: number;
  onDims: (cols: number, rows: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(tab.sessionId);
  const onDimsRef = useRef(onDims);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  sessionRef.current = tab.sessionId;
  onDimsRef.current = onDims;

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
      return true;
    });
    const onMenu = (event: MouseEvent) => {
      event.preventDefault();
      setMenu({ x: event.clientX, y: event.clientY });
    };
    host.addEventListener('contextmenu', onMenu);
    return () => {
      host.removeEventListener('contextmenu', onMenu);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    if (active) fitRef.current?.fit();
  }, [fontSize, active]);

  useEffect(() => {
    if (!active) return;
    const host = hostRef.current;
    const fit = fitRef.current;
    if (!host || !fit) return;
    const apply = () => {
      fit.fit();
      const dims = fit.proposeDimensions();
      if (!dims) return;
      onDimsRef.current(dims.cols, dims.rows);
      const sessionId = sessionRef.current;
      if (sessionId) void window.moeterm.resize(sessionId, dims.cols, dims.rows);
    };
    apply();
    const observer = new ResizeObserver(() => apply());
    observer.observe(host);
    return () => observer.disconnect();
  }, [active, fontSize, tab.sessionId]);

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
    if (tab.status === 'error' || tab.status === 'closed') {
      term.write(`\r\n\x1b[31m${tab.message}\x1b[0m\r\n`);
    }
  }, [tab.status, tab.message]);

  const term = termRef.current;

  return (
    <div className={active ? 'pane active' : 'pane'}>
      <div className="crt" ref={hostRef} />
      {menu && term ? (
        <>
          <div className="menu-catch" onMouseDown={() => setMenu(null)} />
          <div className="menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(event) => event.stopPropagation()}>
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
