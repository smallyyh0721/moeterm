import { themes } from '../../themes/registry';

const ART = String.raw`
  _    _ _   _        _____
 | | _(_) |_| |_ _   |_   _|__ _ __ _ __ ___
 | |/ / | __| __| | | || |/ _ \ '__| '_ ' _ \
 |   <| | |_| |_| |_| || |  __/ |  | | | | | |
 |_|\_\_|\__|\__|\__, ||_|\___|_|  |_| |_| |_|
                 |___/
`;

export function Welcome({
  portrait,
  dataDir,
  installedDefault,
}: {
  portrait: string | null;
  dataDir: string;
  installedDefault: boolean;
}) {
  const themeNames = themes.map((item) => item.file.name).join('、');
  return (
    <div className="welcome">
      {portrait ? (
        <div className="welcome-lockup">
          <img className="welcome-portrait" src={portrait} alt="" />
          <pre>{ART}</pre>
        </div>
      ) : (
        <pre>{ART}</pre>
      )}
      <p>古典linux风自由终端</p>
      <h2>桌面宠物</h2>
      <ul>
        <li>标题栏的「宠物」可以显示或关掉。</li>
        <li>鼠标放上去会弹出程序员梗。点一下换姿势，按住可以拖到别处。</li>
        <li>正在连接时它会跑，连上会欢呼，失败会垂头。</li>
        <li>想换一只：打开「设置」，输入 Petdex 名称，例如 boba，或导入本地宠物包。</li>
      </ul>
      <h2>界面风格</h2>
      <ul>
        <li>打开「设置」里的「界面风格」，可以在{themeNames}之间切换。</li>
        <li>选中的风格会记下来。带画像的风格会显示在首页名字旁边。</li>
      </ul>
      <p>
        {installedDefault
          ? '连接和宠物默认放在安装目录的 data 文件夹。改数据目录需要重启。日志目录可以在「设置」里直接改。'
          : '改数据目录需要重启。日志目录可以在「设置」里直接改。安装之后，数据默认在安装目录下的 data 文件夹。'}
      </p>
      {dataDir ? <p className="path-line"><code>{dataDir}</code></p> : null}
      <p className="hint">F11 全屏 · Ctrl+B 收起连接栏 · Ctrl+Shift+C/V 复制粘贴 · 右键菜单 · 拖动标签排序</p>
    </div>
  );
}
