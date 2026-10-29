export function TitleBar({
  subtitle,
  logOn,
  petOn,
  sftpOn,
  fullscreen,
  onLog,
  onPet,
  onSftp,
  onSettings,
  onFullscreen,
}: {
  subtitle: string;
  logOn: boolean;
  petOn: boolean;
  sftpOn: boolean;
  fullscreen: boolean;
  onLog: () => void;
  onPet: () => void;
  onSftp: () => void;
  onSettings: () => void;
  onFullscreen: () => void;
}) {
  return (
    <header className="titlebar">
      <div className="brand">
        <span className="brand-mark" />
        <span className="brand-name">MoeTerm</span>
        <span className="brand-sub">{subtitle}</span>
      </div>
      <div className="title-actions">
        <button type="button" className={logOn ? 'btn on' : 'btn'} onClick={onLog}>
          日志{logOn ? ' 开' : ' 关'}
        </button>
        <button type="button" className={petOn ? 'btn on' : 'btn'} onClick={onPet}>
          宠物
        </button>
        <button type="button" className={sftpOn ? 'btn on' : 'btn'} onClick={onSftp}>
          SFTP
        </button>
        <button type="button" className="btn" onClick={onSettings}>
          设置
        </button>
        <button type="button" className="btn" onClick={onFullscreen}>
          {fullscreen ? '退出全屏' : '全屏'}
        </button>
      </div>
      <div className="win-actions">
        <button type="button" className="win-btn" onClick={() => void window.moeterm.windowMinimize()} aria-label="最小化">
          –
        </button>
        <button type="button" className="win-btn" onClick={() => void window.moeterm.windowMaximize()} aria-label="最大化">
          □
        </button>
        <button type="button" className="win-btn win-close" onClick={() => void window.moeterm.windowClose()} aria-label="关闭">
          ×
        </button>
      </div>
    </header>
  );
}
