$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA'
$qaRoot = Join-Path $projectRoot 'tmp\rup2-final'
$wordQa = $null
try {
  $wordQa = New-Object -ComObject Word.Application
  $wordQa.Visible = $false
  $wordQa.DisplayAlerts = 0
  $qaDoc = $wordQa.Documents.Open((Join-Path $projectRoot 'output\documents\Pruebas_unitarias_RUP2_documento_final.docx'), $false, $true)
  $qaDoc.ExportAsFixedFormat((Join-Path $qaRoot 'final.pdf'), 17)
  $qaDoc.Close(0)
} finally { if ($null -ne $wordQa) { $wordQa.Quit() } }
& 'C:\Users\inutil\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe' -r 100 -png (Join-Path $qaRoot 'final.pdf') (Join-Path $qaRoot 'page')
if ($LASTEXITCODE -ne 0) { throw 'Error al convertir PDF a PNG' }
