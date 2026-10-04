# Capturas pendientes

## Figura 3.7 Ejecución de pruebas de historial y recetas

Abrir: `Terminal PowerShell`.
Visible: Comando completo, nombres de los archivos o casos y resumen final; fecha de la ejecución visible.
Demuestra: Resultado real de 9 casos; no certifica el módulo completo.
Fuente: Elaboración propia, 2026.

Desde la carpeta del proyecto, ejecutar estos comandos. Esta nueva ejecución no sobrescribe el JSON histórico:
```powershell
Get-Date -Format o
node node_modules/jest/bin/jest.js --runInBand --watch=false --verbose --runTestsByPath __tests__/medicalRecord.test.ts
```
Registrar la fecha de la nueva captura y conservar su salida antes de incorporarla. Los 69 resultados de los documentos corresponden a las ejecuciones identificadas en ejecucion.json.

## Figura A.4 Código de pruebas de historial y recetas

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\__tests__\medicalRecord.test.ts`.
Visible: PU-55 a PU-58; PU-59 y PU-60 en otra toma.
Demuestra: Lógica evaluada y aserciones; datos y servicios externos ficticios.
Fuente: Elaboración propia, 2026.

