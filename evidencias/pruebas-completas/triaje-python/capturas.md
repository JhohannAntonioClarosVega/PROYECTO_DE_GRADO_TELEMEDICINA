# Capturas pendientes

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

## Figura A.2 Código de pruebas de triaje en Python

Abrir: `C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\ai-engine\test_unit_llm.py`.
Visible: setUp y sustitución de red; PU-40 y PU-41.
Demuestra: Lógica evaluada y aserciones; datos y servicios externos ficticios.
Fuente: Elaboración propia, 2026.

