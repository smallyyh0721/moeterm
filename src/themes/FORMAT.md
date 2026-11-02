# 界面主题包

主题是独立资料，不写进组件。一个目录就是一套风格。渲染器会扫描 `src/themes/packs/*/theme.json`，再配上同目录里可选的画像。

新增主题时，复制 `packs/classic` 整目录，改名，改 `theme.json`。不要改设置弹窗、欢迎页或样式表，除非格式本身要加字段。

## 目录

```text
src/themes/packs/<id>/
  theme.json
  portrait.png | portrait.jpg | portrait.jpeg | portrait.webp   可选，最多一张
```

`<id>` 和 `theme.json` 里的 `id` 必须相同。只用小写字母、数字和短横线，以字母开头，最长 32 个字符。

画像只出现在没有打开终端时的首页，靠在标题字旁边。它不是窗口图标，也不是右下角那只桌面宠物。暖棕的画像是狗头，橙黑的画像是银发角色。没有画像的主题只显示原来的字标。画像在选中这个风格之后才读取，边长 256 像素就够首页使用，不要放进首屏脚本。

## theme.json

字段只允许这些，多一个校验就会失败：

| 字段 | 规则 |
| --- | --- |
| `id` | 与目录名相同 |
| `name` | 设置里显示的名字，1 到 16 个字 |
| `button` | `bevel`、`flat`、`round` 之一。对应立体边、底边强调、圆角平按钮 |
| `radius` | 0 到 16 的整数，单位是像素。`bevel` 用 0 |
| `glow` | 窗口背景一角的光。`#RRGGBB`、`#RRGGBBAA`，或 `rgb()` / `rgba()` |
| `colors` | 下面每一项都要有，不能多 |

颜色值同样只允许 `#RRGGBB`、`#RRGGBBAA`、`rgb()`、`rgba()`。

`colors` 的键：

`bg` `bgElev` `bgInset` `side` `titleA` `titleB` `stage` `terminal` `accent` `accentDim` `amber` `text` `muted` `line` `bevelLight` `bevelDark` `card` `bubble` `bubbleInk` `ok` `danger` `inputBorder` `selected` `hover` `btnTop` `btnBottom` `btnInset`

含义：

- `bg` 窗口底色，`side` 左侧栏，`stage` / `terminal` 终端区域
- `titleA` 到 `titleB` 是标题栏渐变，`card` 是弹窗和首页卡片
- `accent` 是标题、选中和强调色，`accentDim` 是次强调
- `amber` 是提示和「连接」小标题
- `text` 正文，`muted` 次要文字，两者都要在 `bg` 上看得清
- `line` 分割线，`inputBorder` 输入框，`selected` 选中行，`hover` 悬停行
- `bevelLight` / `bevelDark` 是立体边。`flat` 和 `round` 主要用 `line` 和 `accent`
- `btnTop` / `btnBottom` 是按钮渐变。平按钮和圆按钮用 `btnTop`
- `bubble` / `bubbleInk` 是宠物台词气泡的底色和字色
- `ok` 是在线圆点，`danger` 是错误

## 不要放进主题里的东西

产品名、窗口图标、终端字体、宠物动作、连接数据。主题只负责颜色、按钮形状和首页画像。

`button` 不要新造第四种。真要新形状，先在 `src/themes/validate.ts` 的 `themeButtons` 里加上名字，再在 `src/renderer/styles.css` 写 `html[data-button="那个名字"]` 的规则，并改这份说明。

要新增一个颜色角色时，同一轮改这三处：`themeColorKeys`、每一份已有的 `theme.json`、`styles.css` 里对应的变量。漏一份，测试不会过。

## 程序怎么用

设置里的「界面风格」把 `settings.theme` 存成主题 `id`。旧配置没有这个字段时用 `classic`。界面按 id 找主题，找不到就显示古典绿，但不会改掉已经写下的 id。

检查：`npm test` 会读 `packs` 下每一个目录。`theme.json` 不合法，或多于一张画像，测试失败。
