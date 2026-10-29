import type { DataPaths } from '../../shared/api';
import type { Settings } from '../../shared/types';
import { Modal } from './Modal';

export function SettingsModal({
  settings,
  paths,
  onChange,
  onClose,
}: {
  settings: Settings;
  paths: DataPaths | null;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) {
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
        <label className="check">
          <input type="checkbox" checked={settings.petEnabled} onChange={(event) => onChange({ petEnabled: event.target.checked })} />
          显示宠物
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.logEnabled} onChange={(event) => onChange({ logEnabled: event.target.checked })} />
          保存终端日志
        </label>
        <div className="path-block">
          <div>数据目录</div>
          <code>{paths?.dataDir ?? '…'}</code>
          <div className="modal-actions left">
            <button type="button" className="btn" onClick={() => void window.moeterm.openPath('data')}>
              打开数据目录
            </button>
            <button type="button" className="btn" onClick={() => void window.moeterm.openPath('keys')}>
              打开密钥目录
            </button>
            <button type="button" className="btn" onClick={() => void window.moeterm.openPath('logs')}>
              打开日志目录
            </button>
          </div>
        </div>
        <p className="fine">私钥文件放在密钥目录。保存的密码用当前 Windows 用户的 DPAPI 加密，换一台电脑需要重新填写。MoeTerm {paths?.version ?? ''}</p>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          完成
        </button>
      </div>
    </Modal>
  );
}
