# kittyTerm

[中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Español](README.es.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

고전적인 리눅스 느낌의 Windows용 자유 터미널입니다. SSH와 파일 전송에 쓰고, 바탕화면 한구석에는 계속 움직이는 펫을 두십시오.

kittyTerm이 하는 일은 터미널의 일입니다. 연결 저장, 셸, SFTP, 로그. 창은 어두운 고전 터미널이고, 제목 막대의 흰 고양이가 표식입니다. 시작할 때 그 고양이는 진행 막대를 0%에서 100%까지 갑니다.

[Windows 설치 파일 받기](https://github.com/smallyyh0721/moeterm/releases/tag/v2.0.0)

![홈](docs/style-previews/current.png)

## 기능

- SSH 터미널. 암호 또는 개인 키로 들어갑니다. 호스트 키는 처음 연결할 때 기억하고, 나중에 바뀌면 받아들일 때까지 멈춥니다.
- 같은 연결에서 SFTP를 엽니다. 올리기와 받기는 진행과 속도를 보여 줍니다.
- 왼쪽에서 폴더로 연결을 정리합니다. 폴더의 **모두 열기**는 안의 세션을 한 번에 시작합니다.
- 복사와 붙여넣기. 오른쪽 단추로 선택 부분이나 버퍼 전체를 텍스트로 내보냅니다.
- 터미널마다 로그를 남깁니다. 로그 폴더는 바로 바꿀 수 있습니다. 데이터 폴더는 다시 시작한 뒤에 적용됩니다.
- 화면을 둘, 셋, 넷까지 나눕니다. 막 연 창은 한 칸입니다. 각 칸 위에 세션 이름이 있습니다.
- 모습은 세 가지입니다. 고전 초록, 주황과 검정, 따뜻한 갈색. 주황과 갈색 홈에는 주제 그림이 붙습니다.
- 바탕화면 펫은 숨기고, 끌고, 자세를 바꿀 수 있습니다. 포인터를 올리면 프로그래머 농담을 합니다. Petdex에서 다른 펫을 넣거나 로컬 꾸러미를 가져올 수 있습니다.
- Ctrl과 휠로 글자 크기를 바꿉니다. F11은 전체 화면입니다.
- 연결이 실패하면 R은 다시 시도하고 Enter는 그 터미널을 닫습니다.

![주황과 검정](docs/style-previews/zzz.png)

![따뜻한 갈색](docs/style-previews/fff.png)

![좌우](docs/split-preview/split-2.png)

![네 칸](docs/split-preview/split-4.png)

## 설치

설치 파일은 `kittyTerm Setup 2.0.0.exe`입니다. Windows 10 / 11 x64용이며 현재 사용자에게 설치되고 관리자는 필요 없습니다. 서명 인증서가 없어서 SmartScreen이 알 수 없는 게시자를 알릴 수 있습니다. 그대로 실행을 고르십시오.

설치 뒤 데이터는 설치 위치의 `data` 폴더에 있습니다. 개발 중에는 설치 위치가 없으므로 `%APPDATA%\kittyTerm`에 있습니다.

| 경로 | 내용 |
| --- | --- |
| `tree.json` | 폴더와 연결. 암호는 없습니다 |
| `secrets.json` | 현재 Windows 사용자의 DPAPI로 암호화한 암호와 키 암호 |
| `keys\` | 가져온 개인 키 |
| `known_hosts.json` | 알려진 호스트 키 |
| `logs\` | 터미널 로그. 이 폴더는 옮길 수 있습니다 |
| `settings.json` | 글자 크기, 펫, 모습, 로그 스위치 |

다른 컴퓨터에서는 키 파일은 그대로지만 저장한 암호는 다시 넣어야 합니다. 데이터가 아직 설치 폴더 안에 있으면 프로그램을 제거할 때 지워집니다. 남기려면 먼저 데이터 위치를 옮기십시오.

## 개발

```powershell
npm install
npm test
npm run dev
```

패키지:

```powershell
npm test
npm run build
npm run smoke
npm run pack
```

## 라이선스

MIT
