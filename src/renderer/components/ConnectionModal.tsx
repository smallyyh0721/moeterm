import { useState } from 'react';
import type { ConnectionSave, PublicConnection } from '../../shared/types';
import { Modal } from './Modal';

export function ConnectionModal({
  folders,
  initial,
  parentId,
  onClose,
  onSave,
}: {
  folders: { id: string; name: string; depth: number }[];
  initial?: PublicConnection;
  parentId: string | null;
  onClose: () => void;
  onSave: (draft: ConnectionSave) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [folderId, setFolderId] = useState(parentId ?? '');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(String(initial?.port ?? 22));
  const [username, setUsername] = useState(initial?.username ?? '');
  const [authType, setAuthType] = useState<'password' | 'privateKey'>(initial?.authType ?? 'password');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [saveSecret, setSaveSecret] = useState(initial?.saveSecret ?? true);
  const [legacy, setLegacy] = useState(initial?.legacyAlgorithms ?? false);
  const [keyToken, setKeyToken] = useState<string | undefined>();
  const [keyLabel, setKeyLabel] = useState(initial?.keyLabel ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={initial ? '编辑连接' : '新建连接'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsedPort = Number(port);
          setBusy(true);
          const draft: ConnectionSave = {
            id: initial?.id,
            parentId: folderId || null,
            name,
            host,
            port: parsedPort,
            username,
            authType,
            saveSecret,
            legacyAlgorithms: legacy,
            password: password || undefined,
            passphrase: passphrase || undefined,
            keyToken,
            keyId: initial?.keyId,
            keyLabel: keyLabel || initial?.keyLabel,
          };
          void onSave(draft).then(
            () => undefined,
            (reason: unknown) => {
              setBusy(false);
              setError(reason instanceof Error ? reason.message : '没有保存成功');
            },
          );
        }}
      >
        <div className="modal-body form-grid">
          <label className="field">
            <span>名称</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>目录</span>
            <select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
              <option value="">根目录</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {`${'· '.repeat(folder.depth)}${folder.name}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>主机</span>
            <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="10.0.0.11 或主机名" />
          </label>
          <label className="field">
            <span>端口</span>
            <input value={port} onChange={(event) => setPort(event.target.value)} />
          </label>
          <label className="field">
            <span>用户名</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="field">
            <span>认证</span>
            <select value={authType} onChange={(event) => setAuthType(event.target.value as 'password' | 'privateKey')}>
              <option value="password">密码</option>
              <option value="privateKey">私钥</option>
            </select>
          </label>
          {authType === 'password' ? (
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                placeholder={initial?.hasPassword ? '留空则保持原密码' : ''}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          ) : (
            <>
              <div className="field">
                <span>私钥</span>
                <div className="key-row">
                  <code>{keyLabel || '还没有选择'}</code>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      void window.moeterm.pickKey().then((result) => {
                        if (!result.ok || !result.data) return;
                        setKeyToken(result.data.token);
                        setKeyLabel(result.data.label);
                      });
                    }}
                  >
                    选择文件
                  </button>
                </div>
              </div>
              <label className="field">
                <span>口令</span>
                <input
                  type="password"
                  value={passphrase}
                  placeholder={initial?.hasPassphrase ? '留空则保持原口令' : '私钥没有口令可留空'}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </label>
            </>
          )}
          <label className="check">
            <input type="checkbox" checked={saveSecret} onChange={(event) => setSaveSecret(event.target.checked)} />
            在数据目录里记住密码或口令
          </label>
          <label className="check">
            <input type="checkbox" checked={legacy} onChange={(event) => setLegacy(event.target.checked)} />
            兼容旧 SSH 算法（老存储设备常用）
          </label>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
