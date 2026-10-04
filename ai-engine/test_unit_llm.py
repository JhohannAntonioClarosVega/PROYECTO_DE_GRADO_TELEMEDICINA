"""Pruebas aisladas: dotenv, red y escritura de errores están sustituidos."""
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, mock_open, patch
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent))
with patch.dict(sys.modules, {'dotenv': Mock(load_dotenv=Mock())}):
    import llm_service


class LlmUnitTests(unittest.TestCase):
    def setUp(self):
        self.network = self.enterContext(patch.object(llm_service.urllib.request, 'urlopen'))
        self.enterContext(patch.object(llm_service.os, 'getenv', return_value='TEST_ONLY'))
        self.enterContext(patch('builtins.open', mock_open()))
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))

    def response(self, text):
        content = {'candidates': [{'content': {'parts': [{'text': text}]}}]}
        self.network.return_value.__enter__.return_value.read.return_value = json.dumps(content).encode()

    def test_PU_38_prioridad_pediatrica(self):
        self.assertEqual(llm_service.detect_heuristic_specialty('Mi wawa tiene dolor de pecho'), 'Pediatría')
        self.network.assert_not_called()

    def test_PU_39_no_inventa_clasificacion_sin_configuracion(self):
        with patch.object(llm_service.os, 'getenv', return_value=None):
            with self.assertRaisesRegex(ValueError, 'Requiere validación manual'):
                llm_service.analyze_symptoms_with_gemini('uma nanay')
        self.network.assert_not_called()

    def test_PU_40_interpretar_respuesta_simulada(self):
        expected = {'detected_language': 'Español', 'standardized_symptoms': 'Texto ficticio',
                    'urgency_level': 'Low', 'ai_recommendation': 'Revisión ficticia',
                    'recommended_specialty': 'Medicina General'}
        self.response('```json\n' + json.dumps(expected) + '\n```')
        self.assertEqual(llm_service.analyze_symptoms_with_gemini('relato ficticio'), expected)
        self.network.assert_called_once()

    def test_PU_41_rechaza_respuesta_incompleta(self):
        self.response('{"recommended_specialty":"Medicina General"}')
        with self.assertRaisesRegex(ValueError, 'Requiere validación manual'):
            llm_service.analyze_symptoms_with_gemini('relato ficticio')

    def test_PU_42_no_inventa_clasificacion_ante_respuesta_no_json(self):
        self.response('respuesta ficticia no estructurada')
        with self.assertRaisesRegex(ValueError, 'Requiere validación manual'):
            llm_service.analyze_symptoms_with_gemini('relato ficticio')

    def test_PU_43_transcripcion_simulada(self):
        self.response('  Texto transcrito ficticio  ')
        self.assertEqual(llm_service.transcribe_audio_only('ZmljdGljaW8='), 'Texto transcrito ficticio')

    def test_PU_44_error_controlado_de_transcripcion(self):
        self.network.side_effect = RuntimeError('Fallo ficticio de red')
        self.assertEqual(llm_service.transcribe_audio_only('ZmljdGljaW8='), '[Error: No se pudo transcribir el audio adjunto]')

    def test_H09_fallo_red_no_inventa_urgencia(self):
        self.network.side_effect = RuntimeError('Fallo ficticio de red')
        with self.assertRaisesRegex(ValueError, 'Requiere validación manual'):
            llm_service.analyze_symptoms_with_gemini('relato ficticio')


def invalid_response_case(field, value):
    def test(self):
        response = {'detected_language': 'Español', 'standardized_symptoms': 'Texto ficticio',
                    'urgency_level': 'Low', 'ai_recommendation': 'Revisión ficticia',
                    'recommended_specialty': 'Medicina General'}
        response[field] = value
        self.response(json.dumps(response))
        with self.assertRaisesRegex(ValueError, 'Requiere validación manual'):
            llm_service.analyze_symptoms_with_gemini('relato ficticio')
    return test


for name, field, value in [
    ('urgencia_ausente', 'urgency_level', None),
    ('urgencia_desconocida', 'urgency_level', 'Unknown'),
    ('sintomas_blancos', 'standardized_symptoms', ' \t '),
    ('sintomas_tipo_incorrecto', 'standardized_symptoms', 5),
    ('idioma_ausente', 'detected_language', None),
    ('recomendacion_ausente', 'ai_recommendation', None),
    ('especialidad_ausente', 'recommended_specialty', None),
    ('especialidad_desconocida', 'recommended_specialty', 'Especialidad inexistente'),
]:
    setattr(LlmUnitTests, 'test_H09_rechaza_' + name, invalid_response_case(field, value))


if __name__ == '__main__':
    unittest.main(verbosity=2)
