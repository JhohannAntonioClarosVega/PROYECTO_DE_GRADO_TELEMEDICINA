# Revisión y corrección de hallazgos de pruebas unitarias

Fecha de ejecución: 30 de septiembre de 2026. Proyecto de telemedicina. Revisión sobre el commit de referencia `355b1d9ddb8508f811fa5a9e419eba16eb0919e2`, con cambios locales anteriores y los cambios de esta revisión; el commit por sí solo no identifica los archivos ejecutados. Los hashes y las copias de fuentes identifican cada ejecución.

Se revisaron H-01 a H-09 contra el informe anterior, el documento oficial vigente `Documento_Oficial_V2 (5).docx` y el código. Se corrigieron siete hallazgos dentro del alcance unitario. H-08 quedó parcialmente corregido y H-03 requiere una decisión sobre el filtro. Las ejecuciones finales registraron **114 pruebas aprobadas, 0 fallidas y 0 omitidas**: 98 en ocho suites de Jest y 16 en unittest de Python. Las pruebas de caracterización que conservan reglas pendientes no acreditan que esas reglas sean funcionalmente adecuadas.

Los documentos Word y las evidencias previas se conservaron sin cambios. Se verificaron sus hashes en 124 archivos. No se implementó una pasarela bancaria, un circuito de triaje manual ni otra función para completar casos pendientes. No se hicieron correcciones en datos persistidos ni se verificó el botón de disponibilidad médica.

## Contraste de los nueve hallazgos

| Hallazgo | Problema y fundamento | Corrección y archivos | Prueba que lo comprueba y estado |
| --- | --- | --- | --- |
| H-01 | El registro aceptaba un nombre de solo espacios. RF 1 y el caso Registrar usuario exigen datos personales válidos; el propio validador ya establece que esos campos son obligatorios. Error confirmado de presencia de datos, sin inventar reglas de formato de CI, teléfono o contraseñas. | `utils/userValidation.ts`: se comprueba el contenido después de recortar espacios en los campos personales obligatorios y en la especialidad del médico. Se conserva el valor original; no se recorta la contraseña. | PU-21 ahora exige rechazo. Se añadieron pruebas de otros campos personales en blanco, especialidad en blanco y nombres con espacios exteriores. **Corregido en validación local.** |
| H-02 | El perfil del paciente aceptaba teléfono y dirección de solo espacios. La obligatoriedad proviene del formulario y su mensaje de validación actual; el documento no precisa una política de formatos de esos campos. Error confirmado respecto a la regla ya implementada. | `utils/userValidation.ts`: ambos campos deben contener caracteres distintos de espacios. | PU-25 exige rechazo. Se comprueba cada campo por separado y se conservan datos completos con espacios exteriores. **Corregido en validación local.** |
| H-03 | Un triaje sin especialidad coincide con cualquier filtro porque una cadena contiene la cadena vacía. RF 6 exige derivación a la especialidad correspondiente y define Medicina General cuando no hay especialistas; no establece qué hacer cuando falta la especialidad del propio triaje. El mecanismo está confirmado, pero su tratamiento necesita definición. | No se modificó `utils/triageWorkflow.ts`. Se consultó si debe excluirse del filtro específico y conservarse en la vista general, o permanecer visible para todos con indicación de que falta asignación. | PU-37 permanece como **caracterización de una regla pendiente**, no como prueba de corrección. **Pendiente de decisión.** |
| H-04 | Se habilitaba la llamada por la mera existencia de una cita, incluso cancelada. RF 9 exige aceptación de la llamada; el panel médico crea una cita `scheduled` al iniciar la atención. La cita cancelada no satisface esa condición. | `utils/consultationRules.ts`: se rechazan citas canceladas, finalizadas, desconocidas o sin estado y triajes cerrados. Se conserva el caso existente de triaje `in_progress` sin cita. `app/(patient)/waiting-room.tsx`: los eventos vuelven a consultar y aplicar la regla; ya no activan la llamada incondicionalmente y una cancelación revoca la navegación pendiente. | PU-49, PU-51, siete casos adicionales de estados y dos pruebas de componente en `reviewScreens.test.tsx`. **Corregido en la decisión local y su uso por el componente aislado.** No se probó transmisión real. |
| H-05 | Se aceptaban diagnóstico y tratamiento de solo espacios. RF 11 y el flujo alternativo del historial indican que no debe guardarse un formulario con campos obligatorios en blanco. | `utils/medicalRecord.ts`: ambos textos deben tener contenido después de recortar espacios. | PU-55 exige rechazo; dos casos comprueban cada campo en blanco y otro conserva textos con espacios exteriores. **Corregido en validación local.** |
| H-06 | Se inventaba urgencia Medium con un reporte incompleto y se mostraban paciente, síntomas y urgencia Critical de demostración cuando no había triaje. RF 10 exige mostrar el reporte generado y un estado sin datos ante un fallo. | `utils/triagePresentation.ts`: se eliminan los datos de demostración y se devuelve urgencia nula si no existe una clasificación reconocida. `components/TriageEvaluation.tsx`: se muestra «URGENCIA NO DISPONIBLE» y se deshabilita atender sin identificadores reales de paciente y triaje. | PU-57 y PU-58, tres niveles válidos, cuatro valores inválidos y una prueba del componente sin triaje. **Corregido en preparación y presentación local.** La recuperación real de datos y recarga requieren integración. |
| H-07 | La simulación ignoraba el error devuelto por Supabase y absorbía excepciones, tras lo cual la pantalla anunciaba éxito. RF 14 distingue éxito y fallo, aunque la verificación bancaria no está implementada. Error confirmado en la simulación existente. | `services/paymentSimulation.ts`: se rechazan identificadores vacíos o ambiguos y se propagan errores. `app/(patient)/payment.tsx`: ante fallo se informa el error, se restablece el botón y no se anuncia éxito ni se redirige. Los textos aclaran que se trata de una simulación y de un QR sin función de cobro. | PU-61, PU-63 y PU-64, cuatro identificadores inválidos y tres pruebas del componente con Supabase sustituido: error devuelto, excepción y actualización exitosa. **Corregido dentro de la simulación.** No acredita transacciones ni actualizaciones reales en Supabase. |
| H-08 | Se contaban `waiting` e `in_progress` como consultas completadas y se usaba ese número para estimar dinero. RF 15 habla de recaudaciones QR; los estados de atención no acreditan cobros. El conteo es un error confirmado. El proyecto no define suficientemente cómo presentar el dinero simulado. | `utils/reportStats.ts`: `completedTriages` cuenta exclusivamente `completed`. `resolved` continúa excluido porque el panel lo presenta como cancelado. **El cálculo monetario anterior y la pantalla de reportes todavía no se modificaron**: queda pendiente elegir entre mostrar ingresos no disponibles o conservar una estimación claramente rotulada. La pantalla aún contiene etiquetas financieras que deberán ajustarse con esa decisión. | PU-67 exige cero completadas para espera y atención en progreso; PU-68 y PU-69 cubren completado y estados excluidos. Sus aserciones monetarias siguen caracterizando la estimación anterior. **Parcial: conteo corregido; importe y presentación financiera pendientes.** |
| H-09 | El servicio aceptaba respuestas sin urgencia ni síntomas estandarizados; además, ante fallos devolvía una clasificación Medium fabricada. RF 5 exige datos estructurados y contempla validación manual cuando la IA no comprende el caso. El contrato del servicio y su prompt exigen cinco campos y valores de urgencia/especialidad determinados. | `ai-engine/llm_service.py`: se exigen cinco cadenas no vacías, una urgencia reconocida y una especialidad admitida. Un fallo de configuración, red o contenido produce `TriageAnalysisError` con indicación de validación manual, sin inventar urgencia ni registrar los síntomas recibidos. `ai-engine/main.py`: se traduce ese error a HTTP 502 y se eliminan los valores clínicos por defecto del endpoint. | PU-39, PU-41 y PU-42 ahora exigen error controlado; nueve pruebas adicionales cubren ausencia, tipos incorrectos, espacios, valores desconocidos y fallo de red. PU-40 conserva el resultado válido. **Corregido en el servicio aislado.** FastAPI no estaba instalado en el entorno de pruebas: el endpoint se revisó y pasó comprobación sintáctica, pero no se ejecutó por HTTP. |

## Ejecuciones y errores conservados

| Etapa | Resultado real | Evidencia |
| --- | --- | --- |
| Comprobación inicial | Los 62 casos de Jest y los siete unitarios de Python anteriores aprobaron. Un patrón de descubrimiento demasiado amplio también intentó importar tres scripts externos y produjo tres errores de preparación. | `base/jest.json`, `base/python.json` y sus logs. |
| Regresión antes de corregir la aplicación | 108 casos: 62 aprobados y 46 fallidos. Fueron 34 fallos en Jest y 12 en Python. Estos fallos demuestran la diferencia entre el comportamiento anterior y las expectativas correctas. | `regresion-antes/jest.json`, `regresion-antes/python.json`, logs y copias de fuentes. |
| Primera ejecución después de las correcciones | Las 92 pruebas de funciones de Jest y las 16 de Python aprobaron. Fallaron seis pruebas nuevas de componentes por la preparación de temporizadores/estilos del entorno de prueba. | `corregido/jest.json`, `corregido/python.json` y logs. |
| Ajustes del entorno de componentes | Un intento produjo error de carga de la suite; el siguiente aprobó sus seis casos. Se sustituyó la integración de estilos y se mantuvo real la lógica de los componentes y los hooks. No se cambiaron expectativas para hacerlos aprobar. | `componentes-reintento.json`, `componentes-reintento-2.json` y logs. |
| Ejecución final completa | **114 casos aprobados, 0 fallidos y 0 omitidos.** Jest: 98 casos en ocho suites; Python: 16 casos. | `final/jest.json`, `final/python.json`, logs, `final/ejecucion.json` y `final/fuentes/`. |

Los tres scripts externos de Python son diagnósticos de Gemini, modelos y Supabase, no suites unitarias aisladas. Sus importaciones fallaron por dependencias ausentes antes de ejecutar consultas externas. El ejecutor quedó restringido a `test_unit_*.py`; no se instalaron dependencias para ejecutar esos diagnósticos. La entrada directa de `test_unit_llm.py` ahora utiliza unittest sin sobrescribir los resultados históricos.

Las pruebas de componentes utilizan datos ficticios, temporizadores controlados, Supabase y navegación sustituidos. No son recorridos manuales ni pruebas de integración de pantallas desplegadas. La transformación de estilos también se sustituye; no se verifica la apariencia visual.

## Comprobaciones adicionales

- TypeScript con `--noEmit --pretty false`: salida 0.
- `git diff --check`: salida 0.
- ESLint sobre los archivos TypeScript modificados y sus pruebas: cero errores y dos advertencias de dependencias de hooks en la sala de espera. Esas advertencias ya corresponden a efectos existentes; no se cambió su ciclo de vida para ampliar esta corrección.
- Sintaxis de los archivos Python modificados y ejecutores: correcta mediante `ast.parse`.
- En una comprobación intermedia, TypeScript detectó que un evento de eliminación de Supabase podía contener un objeto vacío. Se añadió una comprobación de existencia de `triage_id`. El diagnóstico se observó en la salida de la herramienta; las comprobaciones finales guardadas ya resultaron correctas.
- Se conservaron también los resultados iniciales de ESLint, incluidos los problemas de importaciones y comillas corregidos durante esta revisión.

Entorno: las versiones efectivas y las fechas UTC están en `final/ejecucion.json`. La zona del proyecto es America/La_Paz. No se midió cobertura de líneas o ramas ni se afirma cobertura completa de los módulos.

## Archivos y trazabilidad

Los cambios de aplicación se limitan a las funciones y componentes indicados en la tabla. Las pruebas ajustadas son `userValidation.test.ts`, `consultationRules.test.ts`, `medicalRecord.test.ts`, `paymentSimulation.test.ts`, `reportStats.test.ts` y `ai-engine/test_unit_llm.py`. Se creó `__tests__/reviewScreens.test.tsx` y los ejecutores `scripts/record-unit-review.py` y `scripts/record-python-unit-tests.py`.

Carpeta de evidencias de esta revisión:

`C:\Users\inutil\Documents\GitHub\PROYECTO_DE_GRADO_TELEMEDICINA\evidencias\revision-hallazgos-20260930`

- `antes/`: copias del código y las pruebas al inicio, con extensión `.txt` para que Jest no las descubra como suites nuevas.
- `historico-preservado.json`: hashes de los documentos y evidencias anteriores.
- `requisitos.txt` e `informe-anterior.txt`: extracción de los documentos consultados.
- `base/`, `regresion-antes/`, `corregido/`, `final/`: comandos, fechas, versiones, resultados, logs y fuentes de las ejecuciones.
- `cambios-respecto-inicio.patch`: diferencias de esta revisión, separadas de los cambios locales preexistentes.
- `resumen-final.json`: resultados consolidados, archivos cambiados y estado de los hallazgos.
- `verificacion-estatica-final.json`, `typescript-final.log`, `diff-check-final.log`, `eslint-final.json`: comprobaciones adicionales.

## Pendientes

1. **H-03:** decidir el tratamiento de triajes sin especialidad. Recomendación propuesta: excluirlos del filtro específico y conservarlos en la vista general. No se aplicó esa regla sin respuesta.
2. **H-08:** decidir si se ocultan los ingresos no verificados o se conserva una estimación de simulación. El contador de completadas ya está separado, pero el cálculo monetario y la presentación todavía requieren esa definición. No se afirma que H-08 esté cerrado.
3. **Disponibilidad médica:** el botón reportado sigue pendiente de reproducción y comprobación real. Las pruebas de la sala de espera no demuestran que ese interruptor funcione.
4. **H-09 e integración:** comprobar el HTTP 502 y su presentación en el cliente en un entorno con FastAPI. El cliente existente detiene el guardado ante una respuesta HTTP no exitosa, según revisión del código; no se ejecutó ese recorrido. La gestión completa del triaje manual y la evaluación clínica/lingüística permanecen fuera de esta corrección.
5. **Servicios reales:** autenticación, persistencia, videollamada, generación final de PDF y transacciones requieren integración o pruebas manuales; no se acreditan con estos resultados.
6. **Documentación académica y capturas:** se mantienen las versiones anteriores hasta que se solicite actualizarlas. Este informe de revisión es independiente.

La aprobación final demuestra las aserciones ejecutadas con sustitutos y datos ficticios. No demuestra que los módulos completos funcionen correctamente ni que el sistema esté libre de errores.
