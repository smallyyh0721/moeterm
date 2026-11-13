import type { ReactNode } from 'react';
import iconUrl from '../../../build/mark.png';
import type { SplitLayout } from '../lib/split';

export function TitleBar({
  subtitle,
  logOn,
  petOn,
  sftpOn,
  sideOn,
  split,
  onLog,
  onPet,
  onSide,
  onSplit,
  onSftp,
  onSettings,
}: {
  subtitle: string;
  logOn: boolean;
  petOn: boolean;
  sftpOn: boolean;
  sideOn: boolean;
  split: SplitLayout;
  onLog: () => void;
  onPet: () => void;
  onSide: () => void;
  onSplit: (layout: SplitLayout) => void;
  onSftp: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="titlebar">
      <div className="brand">
        <img className="brand-mark" src={iconUrl} alt="" />
        <span className="brand-name">kittyTerm</span>
        <span className="brand-sub">{subtitle}</span>
      </div>
      <div className="title-actions">
        <button
          type="button"
          className={sideOn ? 'btn on' : 'btn'}
          onClick={onSide}
          title={sideOn ? '收起连接栏' : '展开连接栏'}
        >
          连接 <span className="side-mark">{sideOn ? '«' : '»'}</span>
        </button>
        <button type="button" className={logOn ? 'btn on' : 'btn'} onClick={onLog} title="只记录当前这个终端">
          日志{logOn ? ' 开' : ' 关'}
        </button>
        <button type="button" className={petOn ? 'btn on' : 'btn'} onClick={onPet}>
          宠物
        </button>
        <div className="split-switch" role="group" aria-label="分屏">
          <SplitButton layout="columns" current={split} title="左右分屏" onSplit={onSplit}>
            <i className="split-ico cols"><b /><b /></i>
          </SplitButton>
          <SplitButton layout="stack3" current={split} title="三格" onSplit={onSplit}>
            <i className="split-ico stack"><b /><b /><b /></i>
          </SplitButton>
          <SplitButton layout="grid4" current={split} title="四格" onSplit={onSplit}>
            <i className="split-ico grid"><b /><b /><b /><b /></i>
          </SplitButton>
        </div>
        <button type="button" className={sftpOn ? 'btn on' : 'btn'} onClick={onSftp}>
          SFTP
        </button>
        <button type="button" className="btn" onClick={onSettings}>
          设置
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

function SplitButton({
  layout,
  current,
  title,
  onSplit,
  children,
}: {
  layout: Exclude<SplitLayout, 'single'>;
  current: SplitLayout;
  title: string;
  onSplit: (layout: SplitLayout) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={current === layout ? 'on' : ''}
      title={current === layout ? `${title}，再点一次回到单屏` : title}
      aria-pressed={current === layout}
      onClick={() => onSplit(current === layout ? 'single' : layout)}
    >
      {children}
    </button>
  );
}
