# Lector QR → Excel

Aplicación web estática para escanear códigos QR con la cámara o subiendo imágenes, registrar los datos y exportarlos a Excel.

## Estructura del proyecto

```
qr-excel/
├── index.html        # Estructura HTML
├── css/
│   └── styles.css    # Estilos y variables de diseño
├── js/
│   └── app.js        # Toda la lógica (cámara, QR, tabla, Excel)
└── README.md
```

## Uso

Abre `index.html` en un navegador moderno (Chrome, Edge, Firefox).  
**No requiere servidor** — es 100% frontend estático.

> Para usar la cámara en producción el sitio debe servirse con **HTTPS** (requisito del navegador para `getUserMedia`).

## Funcionalidades

- 📷 Escaneo en tiempo real con la cámara trasera
- 🖼️ Subida de imagen PNG/JPG/WEBP con QR
- ✏️ Entrada manual de texto QR
- 📋 Tabla editable con los registros capturados
- ⬇️ Exportación a Excel (`.xlsx`)

## Formatos de QR soportados

| Formato | Ejemplo |
|---------|---------|
| JSON | `{"nombres":"Ana","apPaterno":"Pérez","carnet":"1234567"}` |
| Clave=valor | `nombres=Ana\|apPaterno=Pérez\|carnet=1234567` |
| Texto libre | Cualquier texto → se guarda en columna "QR Raw" |

## Correcciones aplicadas (v1.1)

- **Bug fix cámara**: cambiado `inversionAttempts: 'dontInvert'` → `'attemptBoth'` para detectar QR en cualquier condición de iluminación y contraste.
- **Mayor resolución de cámara**: se solicita 1280×720 para mejorar la tasa de detección.
- **Fix inicio de escaneo**: el loop ahora espera el evento `loadeddata` del video antes de arrancar.
- **Fix detener cámara**: se limpia `video.srcObject` correctamente al detener.

## Dependencias externas (CDN)

- [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs) v0.18.5
- [jsQR](https://github.com/cozmo/jsQR) v1.4.0
