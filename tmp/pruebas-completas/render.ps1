$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA'
$qaRoot = Join-Path $projectRoot 'tmp\pruebas-completas'
$wordQa = $null
try {
  $wordQa = New-Object -ComObject Word.Application
  $wordQa.Visible = $false
  $wordQa.DisplayAlerts = 0
  foreach ($item in @(
    @{Name='Pruebas_unitarias_RUP2_resultados_actualizados.docx'; Stem='rup'},
    @{Name='Informe_detallado_pruebas_unitarias_telemedicina.docx'; Stem='informe'}
  )) {
    $docPath = Join-Path $projectRoot ('output\documents\' + $item.Name)
    $pdfPath = Join-Path $qaRoot ($item.Stem + '.pdf')
    $qaDoc = $wordQa.Documents.Open($docPath, $false, $true)
    $qaDoc.ExportAsFixedFormat($pdfPath, 17)
    $qaDoc.Close(0)
    Write-Output $pdfPath
  }
} finally {
  if ($null -ne $wordQa) { $wordQa.Quit() }
}
$poppler = 'C:\Users\inutil\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe'
foreach ($stem in @('rup','informe')) {
  & $poppler -r 120 -png (Join-Path $qaRoot ($stem + '.pdf')) (Join-Path $qaRoot ($stem + '-page'))
  if ($LASTEXITCODE -ne 0) { throw 'Error al convertir PDF a PNG' }
}
