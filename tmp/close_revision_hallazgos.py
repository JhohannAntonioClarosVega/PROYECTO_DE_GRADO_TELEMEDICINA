import ast
import difflib
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
e = root / 'evidencias/revision-hallazgos-20260930'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

# Verificar que ni documentos ni evidencias previas cambiaron.
history = read(e / 'historico-preservado.json')
assert all(sha(root / item['archivo']) == item['sha256'] for item in history)
for stage in ['base', 'regresion-antes']:
    for item in read(e / stage / 'ejecucion.json')['fuentes']:
        rel = item['archivo']
        candidates = [e/'antes'/(rel+'.txt'), e/'corregido/fuentes'/(rel+'.txt'), root/rel]
        match = next((p for p in candidates if p.exists() and sha(p) == item['sha256']), None)
        assert match is not None, (stage, rel)
        target = e / stage / 'fuentes' / (rel+'.txt')
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(match, target)

j = read(e/'final/jest.json')
p = read(e/'final/python.json')
assert j['numTotalTests'] == 98 and j['numPassedTests'] == 98 and j['numFailedTests'] == 0
assert p['total'] == 16 and p['passed'] == 16 and p['failures'] == p['errors'] == p['skipped'] == 0
assert j['numPendingTests'] == 0
for item in read(e/'final/ejecucion.json')['fuentes']:
    assert sha(root/item['archivo']) == item['sha256'], item['archivo']

patch = []
changed = []
for backup in sorted((e/'antes').rglob('*.txt')):
    rel = str(backup.relative_to(e/'antes'))[:-4]
    now = root/rel
    if now.exists() and now.read_bytes() != backup.read_bytes():
        changed.append(rel.replace('\\','/'))
        patch.extend(difflib.unified_diff(backup.read_text(encoding='utf-8').splitlines(True), now.read_text(encoding='utf-8').splitlines(True), fromfile='antes/'+rel, tofile='despues/'+rel))
(e/'cambios-respecto-inicio.patch').write_text(''.join(patch),encoding='utf-8')
for filename in ['ai-engine/llm_service.py','ai-engine/main.py','ai-engine/test_unit_llm.py','scripts/record-unit-review.py','scripts/record-python-unit-tests.py']:
    ast.parse((root/filename).read_text(encoding='utf-8'),filename=filename)
lint = read(e/'eslint-final.json')
summary = {'fechaUTC': datetime.now(timezone.utc).isoformat(), 'total': 114, 'aprobadas': 114, 'fallidas': 0,
           'omitidas': 0, 'jest': {'casos': 98, 'suites':8}, 'python': {'casos':16},
           'regresionAntes': {'total':108, 'aprobadas':62, 'fallidas':46},
           'base': {'jestAprobadas':62, 'pythonAprobadas':7, 'erroresImportacionScriptsExternos':3},
           'documentosYEvidenciasAnterioresPreservados':len(history),
           'archivosModificadosRespectoInicio':changed,
           'archivosCreados': ['__tests__/reviewScreens.test.tsx','scripts/record-unit-review.py','scripts/record-python-unit-tests.py'],
           'eslint': {'errores':sum(x['errorCount'] for x in lint), 'advertencias':sum(x['warningCount'] for x in lint)},
           'typescript': read(e/'verificacion-estatica-final.json')['typescript'], 'sintaxisPython': 'correcta',
           'hallazgos': {'corregidosEnAlcanceUnitario':['H-01','H-02','H-04','H-05','H-06','H-07','H-09'],
                         'parcial':['H-08'], 'pendienteDefinicion':['H-03']},
           'disponibilidadMedica': 'Pendiente de reproducción y verificación real; no se corrigió.'}
(e/'resumen-final.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
