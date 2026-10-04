# Evidencias de pruebas unitarias

Ejecuciones finales del 30 de septiembre de 2026: 69 casos únicos aprobados; 62 en siete suites de Jest y siete en unittest de Python. No hubo fallidos ni omitidos en las ejecuciones finales.

| Grupo | Casos |
| --- | ---: |
| Usuarios | 30 |
| Triaje con Jest | 7 |
| Triaje con Python | 7 |
| Decisiones de sala de espera | 7 |
| Historial y recetas | 9 |
| Simulación de pagos | 4 |
| Cálculos de reportes | 5 |

Cada carpeta conserva resultado.json, salida.log, ejecucion.json, fuentes, archivos.json, alcance.md y capturas.md. El primer intento de Python produjo siete errores de preparación; se conserva como intento-inicial.json y su log. Se corrigió únicamente la preparación de sustitutos y se repitieron los siete casos sin cambiar las expectativas ni el servicio.

casos.json relaciona PU-01 a PU-69 con escenarios y evidencias. resumen.json consolida ejecuciones y límites. Los hallazgos H-01 a H-09 siguen pendientes de corrección y nueva comprobación. Aprobar una aserción de caracterización no acredita un comportamiento funcional adecuado. El fallo manual de disponibilidad continúa pendiente de reproducción y corrección.

No se acreditan autenticación real, persistencia, transmisión de video, transacciones bancarias, generación final de PDF ni exactitud clínica o lingüística. No se midió cobertura de líneas ni ramas. Los servicios externos fueron sustituidos.

verificacion-estatica.json registra TypeScript y git diff --check con salida cero. cambios-aplicacion.patch, antes/ y las copias de fuentes documentan la extracción de lógica existente para probarla aisladamente. El repositorio ya contenía cambios locales antes de la ampliación.

Los Word editables están en output/documents. revision-documentos.json registra sus hashes y revisión visual. Faltan las capturas reales correspondientes a 15 figuras; figuras-pendientes.json y output/documents/Guia_capturas_pruebas_unitarias.md indican cómo obtenerlas. Los logs no sustituyen esas imágenes. Los documentos aún no constituyen una entrega académica completa con evidencias gráficas.
