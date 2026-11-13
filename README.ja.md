# kittyTerm

[中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Español](README.es.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

古典的な Linux の雰囲気を持つ、Windows 向けの自由な端末です。SSH とファイル転送に使い、机の隅は動き続けるペットに任せてください。

kittyTerm がやるのは端末の仕事だけです。接続の保存、シェル、SFTP、ログ。窓は暗い古典的な端末で、タイトルバーの白い猫が印です。起動中、その猫は進捗を 0% から 100% まで進みます。

[Windows 用インストーラーを入手](https://github.com/smallyyh0721/moeterm/releases/tag/v2.0.1)

![ホーム](docs/style-previews/current.png)

## 機能

- SSH 端末。パスワードまたは秘密鍵で入ります。ホスト鍵は最初の接続で覚え、その後変わったら止まるまで受け入れません。
- 同じ接続で SFTP を開けます。送受信は進捗と速度を出します。
- 左の一覧はフォルダーで接続をまとめます。フォルダーの「すべて」で中のセッションを一度に開きます。
- コピーと貼り付け。右クリック一度でメニューが開きます。コピー、貼り付け、すべて選択、選択範囲やバッファー全体の書き出しができます。
- 上部のタブをドラッグして、端末の順番を変えられます。
- 端末ごとにログを取ります。ログの場所はすぐ変えられます。データの場所は再起動後に効きます。
- 画面は 2、3、4 までに分割できます。起動直後は 1 画面です。各枠の上にセッション名が出ます。
- 見た目は 3 つです。古典緑、橙と黒、暖かい茶。橙と茶のホームには主題の絵が付きます。
- 机上のペットは隠せ、ドラッグでき、ポーズが変わります。ポインターを置くとプログラマの冗談を言います。Petdex から別のペットを入れるか、手元の包みを読み込めます。
- Ctrl とホイールで文字の大きさを変えます。F11 で全画面です。
- 接続に失敗したら、R で再試行、Enter でその端末を閉じます。

![橙と黒](docs/style-previews/zzz.png)

![暖かい茶](docs/style-previews/fff.png)

![左右](docs/split-preview/split-2.png)

![四分割](docs/split-preview/split-4.png)

## インストール

インストーラーは [kittyTerm.Setup.2.0.1.exe](https://github.com/smallyyh0721/moeterm/releases/download/v2.0.1/kittyTerm.Setup.2.0.1.exe) です。Windows 10 / 11 x64 向けで、今のユーザーに入り、管理者は要りません。署名証明書がないため、SmartScreen が不明な発行元と出すことがあります。そのまま実行を選んでください。

入れたあと、データはインストール先の `data` フォルダーにあります。開発中はインストール先がないので、`%APPDATA%\kittyTerm` にあります。

| パス | 中身 |
| --- | --- |
| `tree.json` | フォルダーと接続。パスワードは含みません |
| `secrets.json` | 今の Windows ユーザーの DPAPI で暗号化したパスワードと鍵のパスフレーズ |
| `keys\` | 読み込んだ秘密鍵 |
| `known_hosts.json` | 既知のホスト鍵 |
| `logs\` | 端末ログ。この場所は移せます |
| `settings.json` | 文字サイズ、ペット、見た目、ログのスイッチ |

別のパソコンでは鍵ファイルはそのままですが、保存したパスワードは入れ直します。データがまだインストール先の中にあると、アンインストールで消えます。残すなら先にデータの場所を移してください。

## 開発

```powershell
npm install
npm test
npm run dev
```

パッケージ:

```powershell
npm test
npm run build
npm run smoke
npm run pack
```

## ライセンス

MIT
