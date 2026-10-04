# Guía de capturas reales

Las capturas están pendientes. Completar una etapa por vez. Mantener visibles el nombre del archivo o el comando, el contenido y su tamaño legible. No abrir .env ni mostrar credenciales reales. Una captura de código o de una ejecución nueva no debe presentarse como una imagen tomada en la ejecución histórica del 30 de septiembre. Los resultados originales se conservan en evidencias/pruebas-completas.

Carpeta del proyecto: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA`.

Para cada toma: abrir el archivo en el editor, ajustar el tamaño de texto y usar Windows + Mayús + S. Guardar la imagen sin recortar nombres o resultados importantes. Las figuras de ejecución pueden dividirse en tomas contiguas, sin alterar los resultados.

## Figura 3.1 Configuración de Jest utilizada en las pruebas

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\jest.config.js`.
Visible: Archivo completo: preset, testMatch y transformIgnorePatterns.
Demuestra: Configuración real del proyecto.
Fuente: Elaboración propia, 2026.

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

## Figura 3.4 Ejecución de pruebas de triaje mediante inteligencia artificial

Abrir: `Terminal PowerShell`.
Visible: Comando completo, nombres de los archivos o casos y resumen final; fecha de la ejecución visible.
Demuestra: Resultado real de 7 casos; no certifica el módulo completo.
Fuente: Elaboración propia, 2026.

Desde la carpeta del proyecto, ejecutar estos comandos. Esta nueva ejecución no sobrescribe el JSON histórico:
```powershell
Get-Date -Format o
node node_modules/jest/bin/jest.js --runInBand --watch=false --verbose --runTestsByPath __tests__/triageWorkflow.test.ts
```
Registrar la fecha de la nueva captura y conservar su salida antes de incorporarla. Los 69 resultados de los documentos corresponden a las ejecuciones identificadas en ejecucion.json.

## Figura 3.5 Ejecución de pruebas de triaje en Python

Abrir: `Terminal PowerShell`.
Visible: Comando completo, nombres de los archivos o casos y resumen final; fecha de la ejecución visible.
Demuestra: Resultado real de 7 casos; no certifica el módulo completo.
Fuente: Elaboración propia, 2026.

Desde la carpeta del proyecto, ejecutar estos comandos. Esta nueva ejecución no sobrescribe el JSON histórico:
```powershell
Get-Date -Format o
& "C:\Users\inutil\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m unittest discover -s ai-engine -p test_unit_llm.py -v
```
Registrar la fecha de la nueva captura y conservar su salida antes de incorporarla. Los 69 resultados de los documentos corresponden a las ejecuciones identificadas en ejecucion.json.

## Figura 3.6 Ejecución de pruebas de videoconsultas

Abrir: `Terminal PowerShell`.
Visible: Comando completo, nombres de los archivos o casos y resumen final; fecha de la ejecución visible.
Demuestra: Resultado real de 7 casos; no certifica el módulo completo.
Fuente: Elaboración propia, 2026.

Desde la carpeta del proyecto, ejecutar estos comandos. Esta nueva ejecución no sobrescribe el JSON histórico:
```powershell
Get-Date -Format o
node node_modules/jest/bin/jest.js --runInBand --watch=false --verbose --runTestsByPath __tests__/consultationRules.test.ts
```
Registrar la fecha de la nueva captura y conservar su salida antes de incorporarla. Los 69 resultados de los documentos corresponden a las ejecuciones identificadas en ejecucion.json.

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

## Figura 3.8 Ejecución de pruebas de pagos

Abrir: `Terminal PowerShell`.
Visible: Comando completo, nombres de los archivos o casos y resumen final; fecha de la ejecución visible.
Demuestra: Resultado real de 4 casos; no certifica el módulo completo.
Fuente: Elaboración propia, 2026.

Desde la carpeta del proyecto, ejecutar estos comandos. Esta nueva ejecución no sobrescribe el JSON histórico:
```powershell
Get-Date -Format o
node node_modules/jest/bin/jest.js --runInBand --watch=false --verbose --runTestsByPath __tests__/paymentSimulation.test.ts
```
Registrar la fecha de la nueva captura y conservar su salida antes de incorporarla. Los 69 resultados de los documentos corresponden a las ejecuciones identificadas en ejecucion.json.

## Figura 3.9 Ejecución de pruebas de reportes

Abrir: `Terminal PowerShell`.
Visible: Comando completo, nombres de los archivos o casos y resumen final; fecha de la ejecución visible.
Demuestra: Resultado real de 5 casos; no certifica el módulo completo.
Fuente: Elaboración propia, 2026.

Desde la carpeta del proyecto, ejecutar estos comandos. Esta nueva ejecución no sobrescribe el JSON histórico:
```powershell
Get-Date -Format o
node node_modules/jest/bin/jest.js --runInBand --watch=false --verbose --runTestsByPath __tests__/reportStats.test.ts
```
Registrar la fecha de la nueva captura y conservar su salida antes de incorporarla. Los 69 resultados de los documentos corresponden a las ejecuciones identificadas en ejecucion.json.

## Figura A.1 Código de pruebas de triaje mediante inteligencia artificial

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\__tests__\triageWorkflow.test.ts`.
Visible: PU-31 a PU-37, en dos tomas si es necesario.
Demuestra: Lógica evaluada y aserciones; datos y servicios externos ficticios.
Fuente: Elaboración propia, 2026.

## Figura A.2 Código de pruebas de triaje en Python

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\ai-engine\test_unit_llm.py`.
Visible: setUp y sustitución de red; PU-40 y PU-41.
Demuestra: Lógica evaluada y aserciones; datos y servicios externos ficticios.
Fuente: Elaboración propia, 2026.

## Figura A.3 Código de pruebas de videoconsultas

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\__tests__\consultationRules.test.ts`.
Visible: PU-45 a PU-51.
Demuestra: Lógica evaluada y aserciones; datos y servicios externos ficticios.
Fuente: Elaboración propia, 2026.

## Figura A.4 Código de pruebas de historial y recetas

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\__tests__\medicalRecord.test.ts`.
Visible: PU-55 a PU-58; PU-59 y PU-60 en otra toma.
Demuestra: Lógica evaluada y aserciones; datos y servicios externos ficticios.
Fuente: Elaboración propia, 2026.

## Figura A.5 Código de pruebas de pagos

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\__tests__\paymentSimulation.test.ts`.
Visible: jest.mock de Supabase, PU-62 a PU-64.
Demuestra: Lógica evaluada y aserciones; datos y servicios externos ficticios.
Fuente: Elaboración propia, 2026.

## Figura A.6 Código de pruebas de reportes

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\__tests__\reportStats.test.ts`.
Visible: PU-65 a PU-69.
Demuestra: Lógica evaluada y aserciones; datos y servicios externos ficticios.
Fuente: Elaboración propia, 2026.
