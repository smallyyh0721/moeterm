import { useEffect, useState } from 'react';
import { formatMode, formatMtime, formatSize } from '../../shared/format';
import { remoteJoin, remoteParent } from '../../shared/remote-path';
import type { RemoteEntry, SftpProgress } from '../../shared/types';

export function SftpPanel({
  title,
  progress,
  onClose,
}: {
  title: string;
  progress: SftpProgress | null;
  onClose: () => void;
}) {
  const [cwd, setCwd] = useState('/');
  const [draftPath, setDraftPath] = useState('/');
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<{ title: string; value: string; run: (value: string) => Promise<void> } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RemoteEntry | null>(null);

  const load = async (target: string) => {
    setBusy(true);
    const result = await window.moeterm.sftpList(target);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    setCwd(result.data.cwd);
    setDraftPath(result.data.cwd);
    setEntries(result.data.entries);
    setSelected(null);
  };

  useEffect(() => {
    void load('');
  }, []);

  const selectedEntry = entries.find((entry) => entry.name === selected) ?? null;

  return (
    <section className="sftp">
      <div className="sftp-bar">
        <strong>SFTP</strong>
        <span>{title}</span>
        <button type="button" className="btn" onClick={() => void load(remoteParent(cwd))}>上级</button>
        <button type="button" className="btn" onClick={() => void load(cwd)}>刷新</button>
        <button type="button" className="btn" onClick={() => void window.moeterm.sftpUpload(cwd).then((result) => result.ok ? load(cwd) : setError(result.message))}>上传</button>
        <button
          type="button"
          className="btn"
          disabled={!selectedEntry || selectedEntry.isDir}
          onClick={() => selectedEntry && void download(remoteJoin(cwd, selectedEntry.name), setError)}
        >
          下载
        </button>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setAsk({
              title: '新建目录',
              value: '',
              run: async (value) => {
                const result = await window.moeterm.sftpMkdir(remoteJoin(cwd, value));
                if (!result.ok) throw new Error(result.message);
                await load(cwd);
              },
            })
          }
        >
          新建目录
        </button>
        <button
          type="button"
          className="btn"
          disabled={!selectedEntry}
          onClick={() => {
            if (!selectedEntry) return;
            setAsk({
              title: '重命名',
              value: selectedEntry.name,
              run: async (value) => {
                const result = await window.moeterm.sftpRename({
                  from: remoteJoin(cwd, selectedEntry.name),
                  to: remoteJoin(cwd, value),
                });
                if (!result.ok) throw new Error(result.message);
                await load(cwd);
              },
            });
          }}
        >
          重命名
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={!selectedEntry}
          onClick={() => selectedEntry && setPendingDelete(selectedEntry)}
        >
          删除
        </button>
        <button type="button" className="btn" onClick={onClose}>关闭</button>
      </div>
      <form
        className="pathbar"
        onSubmit={(event) => {
          event.preventDefault();
          void load(draftPath);
        }}
      >
        <input value={draftPath} onChange={(event) => setDraftPath(event.target.value)} />
      </form>
      {error ? <div className="sftp-error">{error}</div> : null}
      <div className="file-table">
        <div className="file-head">
          <span>名称</span>
          <span>大小</span>
          <span>修改时间</span>
          <span>权限</span>
        </div>
        {entries.map((entry) => (
          <button
            type="button"
            key={entry.name}
            className={selected === entry.name ? 'file-row selected' : 'file-row'}
            onClick={() => setSelected(entry.name)}
            onDoubleClick={() => {
              const target = remoteJoin(cwd, entry.name);
              if (entry.isDir) void load(target);
              else void download(target, setError);
            }}
          >
            <span>{entry.isDir ? `📁 ${entry.name}` : entry.name}</span>
            <span>{entry.isDir ? '' : formatSize(entry.size)}</span>
            <span>{formatMtime(entry.mtime)}</span>
            <span>{formatMode(entry.mode)}</span>
          </button>
        ))}
        {!busy && entries.length === 0 ? <div className="empty">空目录</div> : null}
      </div>
      {progress && !progress.done ? (
        <div className="progress">
          <span>{progress.name}</span>
          <span>{progress.total > 0 ? `${Math.min(100, Math.round((progress.transferred / progress.total) * 100))}%` : '…'}</span>
        </div>
      ) : null}
      {pendingDelete ? (
        <div className="inline-ask">
          <span>{pendingDelete.isDir ? `删除目录 ${pendingDelete.name} 及其内容？` : `删除 ${pendingDelete.name}？`}</span>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              const target = remoteJoin(cwd, pendingDelete.name);
              setPendingDelete(null);
              void window.moeterm.sftpRemove(target).then((result) => {
                if (!result.ok) setError(result.message);
                else void load(cwd);
              });
            }}
          >
            删除
          </button>
          <button type="button" className="btn" onClick={() => setPendingDelete(null)}>
            取消
          </button>
        </div>
      ) : null}
      {ask ? (
        <form
          className="inline-ask"
          onSubmit={(event) => {
            event.preventDefault();
            const value = ask.value.trim();
            if (!value) return;
            void ask.run(value).then(
              () => setAsk(null),
              (reason: unknown) => setError(reason instanceof Error ? reason.message : '操作失败'),
            );
          }}
        >
          <span>{ask.title}</span>
          <input autoFocus value={ask.value} onChange={(event) => setAsk({ ...ask, value: event.target.value })} />
          <button type="submit" className="btn primary">确定</button>
          <button type="button" className="btn" onClick={() => setAsk(null)}>取消</button>
        </form>
      ) : null}
    </section>
  );
}

async function download(target: string, setError: (message: string) => void): Promise<void> {
  const result = await window.moeterm.sftpDownload(target);
  if (!result.ok) setError(result.message);
}
