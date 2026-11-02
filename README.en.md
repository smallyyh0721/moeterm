# kittyTerm

[中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Español](README.es.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

A classical Linux-style free terminal for Windows. Use it for SSH and file transfer, and leave the corner of the desktop to a pet that keeps moving.

kittyTerm stays with what a terminal is for: saved connections, a shell, SFTP, and logs. The window is a dark classical terminal, and the white cat in the title bar is its mark. While the app starts, that cat walks a progress bar from 0% to 100%.

[Download the Windows installer](https://github.com/smallyyh0721/moeterm/releases/tag/v2.0.0)

![Home](docs/style-previews/current.png)

## Features

- An SSH terminal. Sign in with a password or a private key. The host key is remembered on first connect, and a later change is blocked until you accept it.
- Open SFTP on the same connection. Uploads and downloads show progress and speed.
- Keep connections in folders on the left. **Open all** on a folder starts every session inside it.
- Copy and paste. Right-click to export the selection or the whole buffer as a text file.
- Each terminal has its own log. The log folder can be changed immediately. The data folder takes effect after a restart.
- Split the view into two, three, or four panes. A new window starts as one pane. Each pane shows the session name at the top.
- Three looks: classical green, orange-black, and warm brown. The orange and warm themes place a portrait on the home screen.
- The desktop pet can be hidden, dragged, and posed. Rest the pointer on it and it tells a programmer joke. Install another pet from Petdex, or import a local pack.
- Ctrl plus the mouse wheel changes the font size. F11 toggles fullscreen.
- After a failed connection, R retries and Enter closes that terminal.

![Orange-black](docs/style-previews/zzz.png)

![Warm brown](docs/style-previews/fff.png)

![Two panes](docs/split-preview/split-2.png)

![Four panes](docs/split-preview/split-4.png)

## Install

The installer is [kittyTerm.Setup.2.0.0.exe](https://github.com/smallyyh0721/moeterm/releases/download/v2.0.0/kittyTerm.Setup.2.0.0.exe) for Windows 10 / 11 x64. It installs for the current user and does not need an administrator. Without a code-signing certificate, SmartScreen may warn about an unknown publisher. Choose to run it anyway.

After installation, data lives in the `data` folder under the install directory. During development there is no install directory, so data stays in `%APPDATA%\kittyTerm`.

| Path | Contents |
| --- | --- |
| `tree.json` | Folders and connections, without passwords |
| `secrets.json` | Passwords and key passphrases encrypted with the current Windows user's DPAPI |
| `keys\` | Imported private keys |
| `known_hosts.json` | Known host keys |
| `logs\` | Terminal logs. The log folder can be moved |
| `settings.json` | Font size, pet, theme, and the log switch |

On another computer the key files remain, but saved passwords must be entered again. If data is still inside the install directory, uninstalling the program deletes it. Move the data folder first if you want to keep it.

## Develop

```powershell
npm install
npm test
npm run dev
```

Package:

```powershell
npm test
npm run build
npm run smoke
npm run pack
```

## License

MIT
