"""Registra una ejecución aislada sin sobrescribir evidencias anteriores."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
stage = sys.argv[1]
if stage not in ('base', 'regresion-antes', 'corregido', 'final'):
    raise SystemExit('Etapa no permitida')
dest = ROOT / 'evidencias/revision-hallazgos-20260930' / stage
dest.mkdir(exist_ok=False)
env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
node = 'node'
metadata = {'inicioUTC': datetime.now(timezone.utc).isoformat(), 'etapa': stage,
            'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'python': sys.version, 'cambiosLocales': True, 'comandos': []}
metadata['versiones'] = json.loads(subprocess.check_output([node, '-e',
    "console.log(JSON.stringify({node:process.version,...Object.fromEntries(['jest','jest-expo','typescript','expo'].map(n=>[n,require(n+'/package.json').version]))}))"], cwd=ROOT, text=True))
test_files = sorted(ROOT.glob('__tests__/*.test.*'))
source_files = test_files + sorted(ROOT.glob('utils/*.ts')) + [ROOT / f for f in ['services/paymentSimulation.ts', 'ai-engine/llm_service.py', 'ai-engine/main.py', 'ai-engine/test_unit_llm.py', 'components/TriageEvaluation.tsx', 'app/(patient)/payment.tsx', 'app/(patient)/waiting-room.tsx', 'app/(admin)/reports.tsx']]
metadata['fuentes'] = [{'archivo': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in source_files]
for source in source_files:
    target = dest / 'fuentes' / (str(source.relative_to(ROOT)) + '.txt')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
jest = [node, 'node_modules/jest/bin/jest.js', '--runInBand', '--watch=false', '--verbose', '--json', '--outputFile=' + str(dest / 'jest.json')]
python = [sys.executable, str(ROOT / 'scripts/record-python-unit-tests.py'), str(dest)]
for name, command in [('jest', jest), ('python', python)]:
    start = datetime.now(timezone.utc).isoformat()
    run = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding='utf-8', errors='replace')
    (dest / f'{name}.log').write_text(run.stdout + run.stderr, encoding='utf-8')
    metadata['comandos'].append({'tipo': name, 'argumentos': command, 'inicioUTC': start, 'finUTC': datetime.now(timezone.utc).isoformat(), 'codigoSalida': run.returncode})
    print(f'{name}: código {run.returncode}')
metadata['finUTC'] = datetime.now(timezone.utc).isoformat()
(dest / 'ejecucion.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print(dest)
