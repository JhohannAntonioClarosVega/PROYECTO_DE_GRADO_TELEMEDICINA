# Capturas pendientes

## Figura 3.2 Casos de validación de usuarios y comprobación de sus respuestas

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\__tests__\userValidation.test.ts`.
Visible: Importaciones y bloque PU-21; una segunda toma del bloque PU-25 si no cabe a tamaño legible.
Demuestra: Pruebas de caracterización que conservan las expectativas originales.
Fuente: Elaboración propia, 2026.

## Figura 3.3 Ejecución de pruebas de gestión de usuarios

Abrir: `Terminal PowerShell`.
Visible: Comando completo, nombres de los archivos o casos y resumen final; fecha de la ejecución visible.
Demuestra: Resultado real de 30 casos; no certifica el módulo completo.
Fuente: Elaboración propia, 2026.

Desde la carpeta del proyecto, ejecutar estos comandos. Esta nueva ejecución no sobrescribe el JSON histórico:
```powershell
Get-Date -Format o
node node_modules/jest/bin/jest.js --runInBand --watch=false --verbose --runTestsByPath __tests__/loginValidation.test.ts __tests__/userValidation.test.ts
```
Registrar la fecha de la nueva captura y conservar su salida antes de incorporarla. Los 69 resultados de los documentos corresponden a las ejecuciones identificadas en ejecucion.json.

