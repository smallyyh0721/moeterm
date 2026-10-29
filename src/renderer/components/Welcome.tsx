const ART = String.raw`
 __  __             _____
|  \/  | ___   ___ |_   _|___ _ __ _ __ ___
| |\/| |/ _ \ / _ \  | |/ _ \ '__| '_ \ _ \
| |  | | (_) |  __/  | |  __/ |  | | | | | |
|_|  |_|\___/ \___|  |_|\___|_|  |_| |_| |_|
`;

export function Welcome() {
  return (
    <div className="welcome">
      <pre>{ART}</pre>
      <p>古典 Linux 风格的 SSH / SFTP 终端</p>
      <ul>
        <li>左侧按目录整理连接，目录上的「全部」会一次打开里面的会话。</li>
        <li>右键终端可以复制、粘贴，或把选中内容和整个缓冲区导出成 txt。</li>
        <li>标题栏的「日志」会把之后的输出写进数据目录。</li>
        <li>私钥、密码和日志都在同一个数据目录里。</li>
      </ul>
      <p className="hint">F11 全屏 · Ctrl+Shift+C 复制 · Ctrl+Shift+V 粘贴</p>
    </div>
  );
}
