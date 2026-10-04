"""Ejecuta unittest por descubrimiento y guarda resultados en una carpeta explícita."""
import json
from pathlib import Path
import sys
import unittest

root = Path(__file__).resolve().parents[1]
dest = Path(sys.argv[1]).resolve()
if not dest.is_relative_to(root / 'evidencias/revision-hallazgos-20260930'):
    raise SystemExit('La salida debe permanecer en las evidencias de esta revisión')
entries = []

class Result(unittest.TextTestResult):
    def addSuccess(self, test):
        super().addSuccess(test)
        entries.append({'id': test.id(), 'status': 'passed'})
    def addFailure(self, test, err):
        super().addFailure(test, err)
        entries.append({'id': test.id(), 'status': 'failed', 'detail': self._exc_info_to_string(err, test)})
    def addError(self, test, err):
        super().addError(test, err)
        entries.append({'id': test.id(), 'status': 'error', 'detail': self._exc_info_to_string(err, test)})
    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        entries.append({'id': test.id(), 'status': 'skipped', 'reason': reason})

# Los otros test_*.py son diagnósticos manuales de proveedores, no suites aisladas.
suite = unittest.defaultTestLoader.discover(str(root / 'ai-engine'), pattern='test_unit_*.py')
result = unittest.TextTestRunner(verbosity=2, resultclass=Result).run(suite)
with (dest / 'python.json').open('x', encoding='utf-8') as file:
    json.dump({'cases': entries, 'total': result.testsRun, 'passed': sum(e['status'] == 'passed' for e in entries),
               'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped)}, file, ensure_ascii=False, indent=2)
sys.exit(0 if result.wasSuccessful() else 1)
