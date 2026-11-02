import { useEffect, useState } from 'react';
import type { DataPaths } from '../../shared/api';
import type { InstalledPet, Settings } from '../../shared/types';
import { Modal } from './Modal';
import { themeById, themes } from '../../themes/registry';

export function SettingsModal({
  settings,
  paths,
  pets,
  onChange,
  onInstallSlug,
  onImportFile,
  onLogDir,
  onClose,
}: {
  settings: Settings;
  paths: DataPaths | null;
  pets: InstalledPet[];
  onChange: (patch: Partial<Settings>) => void;
  onInstallSlug: (slug: string) => Promise<string | null>;
  onImportFile: () => Promise<void>;
  onLogDir: (dir: string) => void;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState('');
  const [petError, setPetError] = useState('');
  const [busy, setBusy] = useState(false);
  const [installProgress, setInstallProgress] = useState<{ ratio: number; label: string } | null>(null);
  const [pathError, setPathError] = useState('');
  const [logError, setLogError] = useState('');
  const [dataNotice, setDataNotice] = useState('');
  useEffect(() => window.moeterm.onPetProgress(setInstallProgress), []);
  const ratio = Math.max(0, Math.min(1, installProgress?.ratio ?? 0));
  const percent = Math.round(ratio * 100);

  function startInstall(): void {
    setBusy(true);
    setPetError('');
    setInstallProgress({ ratio: 0, label: '准备安装' });
  }

  return (
    <Modal title="设置" onClose={onClose}>
      <div className="modal-body">
        <label className="field">
          <span>终端字号</span>
          <input
            type="range"
            min={12}
            max={24}
            value={settings.fontSize}
            onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
          />
          <em>{settings.fontSize}</em>
        </label>
        <div className="path-block">
          <div>界面风格</div>
          <div className="pet-picks">
            {themes.map((item) => (
              <button
                key={item.file.id}
                type="button"
                className={themeById(settings.theme).file.id === item.file.id ? 'btn on' : 'btn'}
                onClick={() => onChange({ theme: item.file.id })}
              >
                {item.file.name}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.petEnabled} onChange={(event) => onChange({ petEnabled: event.target.checked })} />
          显示宠物
        </label>
        <div className="path-block">
          <div>当前宠物</div>
          <div className="pet-picks">
            <button type="button" className={settings.activePetId === 'builtin' ? 'btn on' : 'btn'} onClick={() => onChange({ activePetId: 'builtin' })}>
              萌妹
            </button>
            {pets.map((item) => (
              <button
                key={item.id}
                type="button"
                className={settings.activePetId === item.id ? 'btn on' : 'btn'}
                onClick={() => onChange({ activePetId: item.id })}
              >
                {item.name}
              </button>
            ))}
          </div>
          <form
            className="pet-install"
            onSubmit={(event) => {
              event.preventDefault();
              const name = slug.trim().toLowerCase();
              if (!name) return;
              startInstall();
              void onInstallSlug(name).then((error) => {
                setBusy(false);
                setInstallProgress(null);
                if (error) setPetError(error);
                else setSlug('');
              });
            }}
          >
            <input value={slug} placeholder="Petdex 名称，例如 boba" onChange={(event) => setSlug(event.target.value)} />
            <button type="submit" className="btn" disabled={busy}>
              安装
            </button>
          </form>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              startInstall();
              void onImportFile().finally(() => {
                setBusy(false);
                setInstallProgress(null);
              });
            }}
          >
            导入本地 Petdex 包
          </button>
          {busy ? (
            <div className="pet-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <div className="pet-progress-label">{installProgress?.label ?? '正在安装'} {percent}%</div>
              <div className="pet-progress-track">
                <div className="pet-progress-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>
          ) : null}
          {petError ? <p className="form-error">{petError}</p> : null}
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.logEnabled} onChange={(event) => onChange({ logEnabled: event.target.checked })} />
          新建终端默认记录日志
        </label>
        <div className="path-block">
          <div>数据目录</div>
          <code>{paths?.dataDir ?? '…'}</code>
          <p className="fine">
            这里放连接、密钥和宠物。改完需要重启才生效。如果新目录里还没有连接，会把现在的内容复制过去。
          </p>
          {paths && paths.defaultDir !== paths.dataDir ? <p className="fine">默认位置：{paths.defaultDir}</p> : null}
          {dataNotice ? <p className="fine">{dataNotice}</p> : null}
          {pathError ? <p className="form-error">{pathError}</p> : null}
          <div className="modal-actions left">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPathError('');
                setDataNotice('');
                void window.moeterm.chooseDataDir().then((result) => {
                  if (!result.ok) {
                    setPathError(result.message);
                    return;
                  }
                  if (result.data) setDataNotice('数据目录已记下，需要重启后才会生效。');
                });
              }}
            >
              修改数据目录
            </button>
            {dataNotice ? (
              <button type="button" className="btn primary" onClick={() => void window.moeterm.relaunch()}>
                立即重启
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => void window.moeterm.openPath('data')}>
              打开数据目录
            </button>
            <button type="button" className="btn" onClick={() => void window.moeterm.openPath('keys')}>
              打开密钥目录
            </button>
          </div>
        </div>
        <div className="path-block">
          <div>日志目录</div>
          <code>{paths?.logDir ?? '…'}</code>
          <p className="fine">只影响日志文件。改完马上生效，不用重启。正在记录的终端会改写到新目录。</p>
          {logError ? <p className="form-error">{logError}</p> : null}
          <div className="modal-actions left">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setLogError('');
                void window.moeterm.chooseLogDir().then((result) => {
                  if (!result.ok) {
                    setLogError(result.message);
                    return;
                  }
                  if (result.data) onLogDir(result.data);
                });
              }}
            >
              修改日志目录
            </button>
            <button type="button" className="btn" onClick={() => void window.moeterm.openPath('logs')}>
              打开日志目录
            </button>
          </div>
        </div>
        <p className="fine">私钥文件放在密钥目录。保存的密码用当前 Windows 用户的 DPAPI 加密，换一台电脑需要重新填写。kittyTerm {paths?.version ?? ''}</p>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          完成
        </button>
      </div>
    </Modal>
  );
}
