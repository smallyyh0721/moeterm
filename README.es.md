# kittyTerm

[中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Español](README.es.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Un terminal libre para Windows, con el aire de un Linux clásico. Sirve para abrir SSH, pasar archivos y dejar que una mascota se mueva en una esquina del escritorio.

kittyTerm se queda en lo que hace un terminal: conexiones guardadas, shell, SFTP y registros. La ventana es oscura, y el gato blanco de la barra de título es su marca. Al arrancar, ese gato recorre una barra del 0 % al 100 %.

[Descargar el instalador de Windows](https://github.com/smallyyh0721/moeterm/releases/tag/v2.0.0)

![Inicio](docs/style-previews/current.png)

## Funciones

- Terminal SSH. Entrada con contraseña o clave privada. La clave del host se guarda en el primer contacto, y un cambio posterior se detiene hasta que usted lo acepte.
- SFTP en la misma conexión. Las subidas y bajadas muestran el avance y la velocidad.
- Las conexiones se ordenan en carpetas a la izquierda. **Abrir todo** inicia cada sesión de la carpeta.
- Copiar y pegar. El clic derecho exporta la selección o todo el búfer como texto.
- Cada terminal tiene su registro. La carpeta de registros se cambia al momento. La carpeta de datos vale después de reiniciar.
- Dividir la vista en dos, tres o cuatro paneles. Una ventana nueva empieza con uno solo. Cada panel muestra el nombre de la sesión arriba.
- Tres aspectos: verde clásico, naranja y negro, y marrón cálido. Los temas naranja y marrón ponen un retrato en el inicio.
- La mascota se oculta, se arrastra y cambia de pose. Si deja el puntero encima, cuenta un chiste de programador. Puede instalar otra desde Petdex o importar un paquete local.
- Ctrl y la rueda cambian el tamaño de la letra. F11 pone la pantalla completa.
- Si la conexión falla, R reintenta y Enter cierra ese terminal.

![Naranja y negro](docs/style-previews/zzz.png)

![Marrón cálido](docs/style-previews/fff.png)

![Dos paneles](docs/split-preview/split-2.png)

![Cuatro paneles](docs/split-preview/split-4.png)

## Instalación

El instalador es [kittyTerm.Setup.2.0.0.exe](https://github.com/smallyyh0721/moeterm/releases/download/v2.0.0/kittyTerm.Setup.2.0.0.exe), para Windows 10 / 11 x64. Se instala para el usuario actual y no pide administrador. Sin certificado de firma, SmartScreen puede avisar de un editor desconocido. Elija ejecutarlo de todos modos.

Después de instalar, los datos quedan en la carpeta `data` del directorio de instalación. En desarrollo no hay ese directorio, y los datos quedan en `%APPDATA%\kittyTerm`.

| Ruta | Contenido |
| --- | --- |
| `tree.json` | Carpetas y conexiones, sin contraseñas |
| `secrets.json` | Contraseñas y frases de clave cifradas con el DPAPI del usuario de Windows |
| `keys\` | Claves privadas importadas |
| `known_hosts.json` | Claves de host conocidas |
| `logs\` | Registros. Esa carpeta se puede mover |
| `settings.json` | Tamaño de letra, mascota, tema e interruptor del registro |

En otro equipo los archivos de clave siguen, pero hay que volver a escribir las contraseñas guardadas. Si los datos siguen dentro de la carpeta de instalación, desinstalar el programa los borra. Mueva antes la carpeta de datos si quiere conservarlos.

## Desarrollo

```powershell
npm install
npm test
npm run dev
```

Empaquetar:

```powershell
npm test
npm run build
npm run smoke
npm run pack
```

## Licencia

MIT
