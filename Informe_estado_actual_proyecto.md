# Informe del estado actual del proyecto de telemedicina

Fecha de auditoría: **4 de octubre de 2026**, zona America/La_Paz. Auditoría documental y de código, sin ejecución de la aplicación, sin pruebas nuevas y sin operaciones sobre datos reales.

## 1. Resultado y significado del porcentaje

**Avance general estimado y sustentado: 28 % del alcance documentado** —27,59 % antes del redondeo—. Si se consideran únicamente los compromisos de implementación y capacidades técnicas, dejando fuera las tres actividades formales de validación, la estimación es **31 %** —30,77 %—.

Estos porcentajes no significan que solo exista esa proporción de pantallas, ni que falte exactamente el 72 % de las horas de trabajo. Miden cumplimiento parcial de los requisitos con la evidencia disponible. Hay interfaces y conexiones programadas en casi todos los módulos, pero varios procesos exigidos no están completos: pago bancario, comisiones, movimientos financieros, cola con posición y tiempo estimado, entrega persistente de PDF, reportes por fechas y exportación. Además, la configuración real de la base de datos y los servicios desplegados no está acreditada en los archivos revisados.

**No se certifica ningún módulo completo de extremo a extremo.** Las 114 pruebas unitarias históricas aprobadas demuestran comprobaciones concretas de funciones y componentes aislados. No equivalen a 114 requisitos completos ni acreditan las conexiones externas.

La confianza es **alta para la presencia de código y las ausencias visibles en el repositorio**, **media para su grado de implementación** y **baja para el funcionamiento desplegado**, porque no se consultó la base de datos, no se abrió una sesión real ni se conectaron dispositivos. Una configuración existente fuera del repositorio o evidencia adicional puede cambiar la valoración. El porcentaje no es una medición estadística ni una certificación de producción.

### Qué significa llegar al 100 %

- **100 % de implementación:** todos los requisitos funcionales, sus alternativas y las capacidades técnicas del alcance están implementados y conectados, con configuración reproducible. Un QR decorativo, una estimación de dinero o una ruta local de PDF no sustituyen lo exigido.
- **100 % de cumplimiento del proyecto evaluado:** además de lo anterior, existen resultados identificables de aceptación, usabilidad, integración y rendimiento, y evidencia de los requisitos no funcionales. No significa ausencia absoluta de errores.
- Este informe mide el sistema y los compromisos de calidad del documento. No califica la redacción de la tesis, el cumplimiento del cronograma, Figma, Trello o la defensa académica.

## 2. Fuentes, versión y límites de la revisión

Fuente normativa: [Documento_Oficial_V2 (5).docx](<C:/Users/inutil/Downloads/Documento_Oficial_V2 (5).docx>). Es la versión vigente suministrada y la más reciente entre los documentos oficiales localizados. Se revisaron los objetivos, alcance, límites, arquitectura, los **15 RF**, **5 RNF**, las **15 especificaciones de casos de uso** y las declaraciones de pruebas. Los diagramas del documento no sustituyen un esquema ejecutable de la base de datos.

Referencia del repositorio: `018992e62f0edf1ff8acd1d506f7b2fab7bd601d`. Al inicio, `git status --short` no mostraba cambios. La única entrega nueva de esta auditoría es este informe.

SHA-256 del documento oficial: `7dbea4834f980d1c137c88946eec2b5626e8564a9a49ce3f8112b285c37615a6`.

Fuentes de contraste:

- [Revisión anterior de hallazgos](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/output/reviews/Revision_hallazgos_pruebas_unitarias.md).
- [Word de resultados finales](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/output/documents/Pruebas_unitarias_RUP2_documento_final.docx), además de los antecedentes referenciados en la revisión anterior.
- [Evidencias finales del 30 de septiembre](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/evidencias/revision-hallazgos-20260930/final): `jest.json`, `python.json`, logs, `ejecucion.json` y fuentes conservadas.
- Código de rutas de pacientes, médicos y administradores; rutas alternativas `(tabs)`; componentes, servicios, validadores, motor Python y configuración Expo/Supabase/Jest. Se siguieron los flujos de datos y las conexiones de las funciones, no solo los nombres de pantallas.
- Configuración SQL disponible: una migración de `doctors.is_online`. No se encontró un esquema completo versionado, políticas RLS, definición de buckets ni configuración de publicación Realtime en el repositorio.

No se leyeron valores de archivos `.env`, no se publican credenciales ni identificadores personales, y no se ejecutaron scripts de diagnóstico que pudieran llamar a Gemini o Supabase. Tampoco se ejecutaron pruebas de integración, seguridad, rendimiento, compilaciones móviles ni pruebas unitarias nuevas. Las observaciones de seguridad son revisión estática, no vulnerabilidades explotadas.

El documento oficial afirma que hubo recorridos manuales satisfactorios de autenticación, videoconsulta, historial y receta. Se conservan como **declaraciones históricas**: no contienen aquí la trazabilidad suficiente para certificar el mismo resultado en el estado actual. Su mención de QR de prueba tampoco acredita una pasarela bancaria.

## 3. Método de cálculo reproducible

Se cuentan **29 unidades de evaluación**, sin contar dos veces un RF y su caso de uso:

1. Los 15 requisitos funcionales RF-01 a RF-15.
2. Los 5 no funcionales RNF-01 a RNF-05.
3. Seis compromisos explícitos del alcance que amplían los RF: perfiles, reprogramación, comisiones, historial financiero, información generacional y soporte multiplataforma. Se identifican como A-01 a A-06; no son nuevas funciones propuestas por esta auditoría.
4. Las tres actividades formales de calidad exigidas: usabilidad, integración y rendimiento, identificadas como Q-01 a Q-03.

Cada unidad pesa **1/29 del total, aproximadamente 3,45 %**. Se usan pesos iguales porque el documento no fija prioridades ponderadas. Los porcentajes por módulo dependen de los requisitos asignados, no de archivos, líneas o número de tests. Los requisitos amplios se valoran como un conjunto y no se fragmentan para aumentar artificialmente el avance.

| Puntuación por requisito | Criterio |
| --- | --- |
| 0 | Capacidad exigida ausente, solo simulada en su aspecto esencial, o resultado de calidad sin evidencia verificable suficiente. Se distingue expresamente ausencia de no verificación. |
| 0,25 | Hay soporte inicial o un subconjunto, pero falta la parte principal del proceso. |
| 0,50 | Existe una parte sustancial del flujo; faltan alternativas, integración de pasos o componentes necesarios. |
| 0,75 | El flujo principal está programado y los límites son menores que la parte existente; quedan consistencia, configuración o comprobación externa. No se considera completo. |
| 1 | El alcance de esa unidad está íntegramente satisfecho con evidencia suficiente. Ningún requisito amplio recibe esta puntuación en esta auditoría. |

La columna «puntos» de la matriz explica el crédito parcial. «Parcial» y «no verificado» pueden coexistir: el primero describe implementación; el segundo, evidencia de funcionamiento. El 0 de una actividad de calidad no afirma que nunca se intentó, sino que no hay evidencia reproducible suficiente para acreditar su cumplimiento actual.

**Cálculos:** suma de puntos = **8,00**; avance general = `8 / 29 × 100 = 27,59 %`. Excluyendo solo Q-01, Q-02 y Q-03: `8 / 26 × 100 = 30,77 %` de implementación sustentada. Si esos tres planes de validación se completaran sin cambiar ninguna función, subiría el indicador general, pero el de implementación seguiría en 30,77 %; así se evita confundir pruebas con desarrollo.

### Avance por módulo

| Módulo o área | Unidades incluidas | Puntos / máximo | Avance estimado | Límite de la evidencia |
| --- | --- | ---: | ---: | --- |
| Usuarios, autenticación, roles y perfiles | RF-01–03, A-01 | 2,75 / 4 | 68,75 % | Validaciones unitarias; Auth, permisos y persistencia real no certificados. |
| Triaje e IA | RF-04–06 | 1,25 / 3 | 41,67 % | Preparación y servicio simulado comprobados; traducción real, clasificación clínica y derivación completa no. |
| Sala de espera, disponibilidad y videoconsulta | RF-07–09, A-02 | 1,00 / 4 | 25,00 % | Reglas locales comprobadas; cola, disponibilidad y video real incompletos o no verificados. |
| Prediagnóstico, historial y recetas | RF-10–12 | 1,25 / 3 | 41,67 % | Hay consultas e inserciones programadas; no está completo el circuito del PDF al paciente. |
| Pagos | RF-13–14, A-03–04 | 0,00 / 4 | 0,00 % | Existe una simulación útil, pero no satisface los requisitos bancarios. |
| Reportes | RF-15, A-05 | 0,25 / 2 | 12,50 % | Contadores y barras; faltan datos financieros reales, filtros, exportación y definición generacional. |
| Soporte web y móvil | A-06 | 0,50 / 1 | 50,00 % | Código y configuración compartidos; sin matriz de ejecución por plataforma. |
| Requisitos no funcionales | RNF-01–05 | 1,00 / 5 | 20,00 % | Bases parciales; sin acreditación de seguridad, carga o disponibilidad operativa. |
| Validación formal exigida | Q-01–03 | 0,00 / 3 | 0,00 % acreditado | Relatos manuales anteriores; falta evidencia suficiente para certificar el alcance actual. |
| **Total** | **29 unidades** | **8,00 / 29** | **27,59 %, redondeado a 28 %** | **Estimación conservadora del alcance completo.** |

No se promedian directamente los porcentajes de las filas: se suman sus puntos y denominadores.

## 4. Matriz completa de requisitos y casos de uso

Los identificadores de evidencia E01–E15 se desarrollan en la sección 9 con archivos y líneas. Los nombres de casos de uso siguientes corresponden a las tablas del documento oficial; los dos perfiles se incluyen en A-01 porque aparecen en el alcance, aunque no tengan una tabla propia de caso de uso.

### Gestión de usuarios

| ID y caso de uso | Exigencia oficial | Existe actualmente y evidencia | Estado y puntos | Qué falta |
| --- | --- | --- | --- | --- |
| RF-01 Registrar usuario | Registro web/móvil, cuenta y datos persistidos, rechazo de duplicados y formatos incorrectos. | `handleRegister`: validación local, consulta de correo/CI, `signUp`, perfil, paciente o médico y carga de título. E01; validaciones de usuarios en E15. | Parcial avanzado; persistencia no verificada. **0,75**. | Comprobar formato y errores con el servicio, confirmar configuración de correo y sesión. Resolver altas parciales: un fallo después de crear Auth puede dejar una cuenta sin datos completos; cerrar sesión no revierte la creación. Verificar permisos y restricciones de unicidad en servidor. |
| RF-02 Iniciar sesión / autenticación segura | Validar credenciales, rechazar acceso incorrecto y dirigir al panel del rol. | `signInWithPassword`, lectura de rol, validación de aprobación médica y cierre de sesión. E01/E02. | Parcial avanzado; autenticación real no verificada ahora. **0,75**. | Confirmar sesiones persistidas/expiradas, cierre y acceso directo por URL. No hay una protección común visible en todos los layouts; el rol de la URL de videoconsulta no debe autorizar operaciones. Completar permisos efectivos en servidor. |
| RF-03 Asignar roles y especialidades | Administrador selecciona usuario, asigna rol y especialidad, guarda y comunica fallos. | Panel comprueba rol admin, aprueba/rechaza médicos y reasigna especialidad. CRUD de especialidades. E02. | Parcial. **0,50**. | La aprobación modifica `doctors.is_active` y `specialty_id`; no equivale a asignar un rol arbitrario a un usuario existente. Completar ese flujo o acordar formalmente que aprobación médica es el alcance aceptado. Comprobar filas afectadas y RLS; `.select()` sin inspeccionar sus datos no asegura actualización. |
| A-01 Editar perfil del paciente y del médico | Alcance de usuarios: datos personales, historial básico y especialidades. | Paciente: contacto, género, alergias, sangre y contacto de emergencia. Médico: nombre/contacto y lectura de especialidad. Recuperación y actualizaciones programadas. E03. | Parcial avanzado; guardado real no verificado. **0,75**. | Comprobar lectura posterior al guardado, errores entre escrituras y consistencia de género. La especialidad se administra en el panel correspondiente. Los valores iniciales, como grupo sanguíneo, no deben confundirse con información confirmada. |

### Triaje e inteligencia artificial

| ID y caso de uso | Exigencia oficial | Existe actualmente y evidencia | Estado y puntos | Qué falta |
| --- | --- | --- | --- | --- |
| RF-04 Capturar sintomatología en Quechuañol | Texto o voz web/móvil, envío y aviso para reingresar contenido vacío o inaudible. | Conversación guiada, limpieza de texto, grabación, conversión a base64, transcripción y envío HTTP. E04. | Parcial. **0,50**. | Ante error de transcripción se inserta `[Audio adjunto]`; no es la solicitud clara de regrabar exigida. Verificar permisos y formato real del audio en navegador y móvil: Python lo declara `audio/mp4` sin negociar el tipo recibido. Evitar identificación de paciente de respaldo y completar reintentos comprensibles. |
| RF-05 Procesar y traducir IA | Interpretar dialecto, obtener términos clínicos, guardar resultado estructurado; si no comprende, derivar a validación manual. | Prompt específico, heurísticas, llamada REST real programada, validación de cinco campos y error controlado. El cliente guarda después de un HTTP exitoso. E04/E05. | Parcial. **0,50**. | Confirmar contrato HTTP con cliente. El error manual llega como 502 y el cliente muestra un error genérico; no existe bandeja, estado y atención del triaje manual. Comprobar traducción con muestras aceptadas por especialistas; no se puede inferir calidad del prompt. Definir tiempos límite y recuperación ante fallos. |
| RF-06 Clasificar urgencia y derivar | Nivel de prioridad, especialidad y cola correcta; Medicina General si no hay especialistas disponibles. | IA devuelve nivel y especialidad; se almacenan y se filtra visualmente por especialidad. E04–E06. | Parcial inicial. **0,25**. | No se encontró consulta de disponibilidad para decidir la derivación ni asignación de cola por disponibilidad. H-03 sigue incluyendo especialidad vacía en filtros específicos. La consulta de triajes ordena por fecha descendente, no establece una cola de prioridad clínica. Confirmar equivalencia Leve/Moderado/Severo con Low/Medium/Critical y salida segura para emergencias. |

### Videoconsultas y sala de espera

| ID y caso de uso | Exigencia oficial | Existe actualmente y evidencia | Estado y puntos | Qué falta |
| --- | --- | --- | --- | --- |
| RF-07 Visualizar sala de espera | Posición, tiempo estimado dinámico, pausa/aviso de desconexión y estado demorado. | Consulta de triaje/cita, polling, suscripción y transición hacia llamada. Reglas de cancelación probadas aisladamente. E07. | Parcial inicial. **0,25**. | No hay cálculo ni presentación de posición y tiempo estimado de atención en esta pantalla. No consume `is_online` para pausar o informar demora. El tiempo transcurrido que aparece en otros paneles no equivale al tiempo estimado. |
| RF-08 Control de disponibilidad médica | Interruptor web En línea/Ocupado, persistencia, uso en enrutamiento y conservación del estado ante fallo. | `Sidebar.toggleAvailability` actualiza `doctors.is_online` y revierte estado local si recibe error; hay migración de columna. E07/E13. | Parcial inicial y pendiente de verificación del fallo informado. **0,25**. | El interruptor está en `Sidebar`, usado por `(tabs)`, mientras el acceso médico normal dirige a `(doctor)` con `CustomDrawer`, sin ese interruptor. Tampoco se encontró consumo de disponibilidad en derivación. Verificar ruta, migración, fila afectada y permisos. No se declara corregido ni se afirma haber reproducido hoy el fallo. |
| RF-09 Transmisión de videoconsulta | Aceptación por ambas partes, audio/video, permisos, aviso de red inestable y finalización coherente. | Sala externa Whereby incrustada mediante iframe web o WebView móvil, solicitud de permisos y enlaces con triaje/historial. E08. | Parcial sustancial; video real no verificado. **0,50**. | La URL de sala es fija para todas las consultas. No existe en el código revisado creación de sala por cita ni integración de eventos de conexión/calidad. Un temporizador de tres segundos da por terminada la conexión visual. Verificar dos participantes, aislamiento, permisos y reconexión; no certificar cifrado por el texto de pantalla. |
| A-02 Agenda y reprogramación | Alcance de videoconsultas: aceptar o reprogramar consultas; actor médico gestiona agenda. | Hay creación de citas al atender y un guardado básico de horarios en una rama del perfil. E03/E06. | Reprogramación no implementada como proceso. **0**. | No hay flujo completo para cambiar fecha de una cita, resolver conflictos y reflejar el cambio al paciente. Guardar un horario no reprograma una consulta existente. |

### Prediagnóstico, historial y recetas

| ID y caso de uso | Exigencia oficial | Existe actualmente y evidencia | Estado y puntos | Qué falta |
| --- | --- | --- | --- | --- |
| RF-10 Visualizar prediagnóstico IA | Cargar reporte de consulta activa en panel lateral; recargar ante fallo de BD. | Consulta por `triageId`, panel de videollamada y componente de evaluación; preparación local sin urgencia inventada en ese componente. E08/E09. | Parcial. **0,50**. | Falta manejo completo de carga/fallo con recarga en el panel de videollamada; su consulta solo registra el error. Confirmar asociación y permisos. Otras vistas aún tienen urgencia Medium de respaldo; la corrección H-06 no cubre todas las pantallas. |
| RF-11 Registrar historial clínico | Guardar diagnóstico, tratamiento y notas; recuperar expediente permanente; impedir campos obligatorios vacíos. | Dos formularios insertan `medical_records`; historias de paciente, médico y directorio consultan registros. E08–E10. | Parcial. **0,50**. | La vista independiente usa el validador corregido, pero `videocall.handleSaveMedicalRecord` solo comprueba cadenas vacías y permite espacios. Hay escrituras separadas y citas potencialmente nulas; se puede guardar y fallar después al cambiar estado. Confirmar integridad, recuperación, aislamiento y cierre sin duplicados. |
| RF-12 Autogenerar receta PDF | PDF después de guardar, firma del médico, descarga por el paciente, recomendación de farmacia y reintento. | Plantilla HTML, farmacia opcional, `Print.printToFileAsync` y compartir desde la vista médica. E09/E10. | Parcial inicial. **0,25**. | Se guarda la URI local en `prescription_file_url`, sin carga a Storage. El historial del paciente no selecciona ese campo ni ofrece descarga. El formulario de la llamada no genera PDF. La plantilla imprime nombre y línea de firma, no una firma digital implementada. Puede reutilizarse una URI generada antes de editar el tratamiento. Verificar generación web/móvil y entrega persistente tras resolver estas brechas. |

### Pagos y reportes

| ID y caso de uso | Exigencia oficial | Existe actualmente y evidencia | Estado y puntos | Qué falta |
| --- | --- | --- | --- | --- |
| RF-13 Generar código QR de pago | Solicitar QR único a API bancaria con monto exacto y mostrar fallo del servicio. | Icono QR, monto fijo y texto explícito de demostración. E11. | Función bancaria no implementada; interfaz simulada. **0**. | Proveedor, contrato, entorno de pruebas, generación de QR por transacción y tratamiento de indisponibilidad. No se considera avance funcional bancario dibujar el icono. |
| RF-14 Verificar transacción | Webhook, verificar identidad/monto, registrar pagado y habilitar sala; informar rechazo. | Botón y temporizadores cambian `triages.status` a waiting mediante un servicio que propaga errores. E11. | Solo simulación; verificación bancaria no implementada. **0**. | Endpoint de confirmación autenticada, correlación de transacción, monto, estado de pago separado y tratamiento de duplicados/rechazos. La sala debe depender del resultado autorizado, no de un botón de simulación. |
| A-03 Retener comisiones | Alcance de pagos y justificación económica: comisión por atención efectiva. | Texto comercial en reportes; sin cálculo ni registro de comisión. E12. | No implementada. **0**. | Regla de tarifa/porcentaje, evento que devenga comisión y asiento que distinga bruto, comisión y neto. No se interpreta la constante 50 como una comisión. |
| A-04 Historial de transacciones | Movimientos económicos visibles para médicos y pacientes. | No se encontró servicio, consulta o pantalla de movimientos financieros. | No implementado en el repositorio. **0**. | Modelo transaccional, relación con consulta/participantes, estados y vistas por usuario. No confundir historial clínico con historial financiero. |
| RF-15 Generar reportes estadísticos y financieros | Cantidades, urgencias, tiempos, ingresos/egresos, rango de fechas, gráficos/tablas y exportación PDF; límite de rango. | Lee triajes, calcula contadores y barras de urgencia. Dinero estimado por estados multiplicados por 50. E12. | Parcial inicial. **0,25**. | Fechas, tiempos de atención, ingresos/egresos reales, tablas exportables a PDF, límite de consulta y mensajes de falta de datos/error. H-08 sigue pendiente; etiquetas «pagos exitosos» y «validada mediante QR» no están respaldadas. |
| A-05 Información estadística generacional | Alcance de reportes usa expresamente «información estadística generacional». | No se encontraron agrupaciones generacionales ni definición del término en la implementación. E12. | Pendiente de aclaración, sin implementación acreditada. **0**. | Confirmar si significa cohortes de edad u otra dimensión, o si es un error de redacción. No se exige añadir fecha de nacimiento sin esa decisión. Se mantiene la obligación textual en el denominador hasta aclararla. |

### Plataformas, requisitos no funcionales y validación

| ID | Exigencia oficial | Existe actualmente y evidencia | Estado y puntos | Qué falta |
| --- | --- | --- | --- | --- |
| A-06 Web y móvil | Paciente móvil y web en varios RF; médico/administrador web; arquitectura Expo/React Native. | Configuración Android/iOS/web, navegación adaptable y ramas para grabación, documentos y video. E14. | Parcial. **0,50**. | Builds identificables y revisión de los flujos en las plataformas comprometidas. Compartir componentes no demuestra compatibilidad; PDF, permisos, WebView y dirección del API requieren comprobarse por plataforma. |
| RNF-01 Seguridad y privacidad | Cifrado de historiales/credenciales/video y bloqueo de conexiones inseguras. | Supabase Auth y clientes para servicios HTTPS; controles parciales de rol. E01/E13/E14. | Parcial inicial; seguridad desplegada no verificada. **0,25**. | Esquema y RLS, políticas de Storage, autorización del API, protección de rutas/roles, configuración TLS y evidencia del tratamiento de datos. El API Python no valida sesión en el código; CORS abierto y fallback HTTP local no prueban un despliegue seguro. No se verificó cifrado en reposo ni E2E. |
| RNF-02 Rendimiento bajo concurrencia | Triajes y llamadas simultáneos estables; cola temporal ante exceso. | Backend y consultas existen, sin política de capacidad ni cola de saturación identificada. | Pendiente de implementación específica y de verificación. **0**. | Definir concurrencia y latencias aceptables, tiempos límite y capacidad; posteriormente comprobarlos. La consulta periódica cada dos segundos no acredita escalabilidad. |
| RNF-03 Usabilidad e inclusión | Navegación accesible para baja alfabetización; contrastes/botones y métricas de abandono/error. | Flujo guiado, mensajes bilingües, lectura por voz y componentes adaptables. E04/E14. | Parcial. **0,50**. | Comprobar comprensión real y accesibilidad, completar recuperación de errores y medir abandono. La existencia de estilos no acredita contraste o accesibilidad efectiva. |
| RNF-04 Disponibilidad 99,9 % | Atención 24/7 y respaldo automático ante caída. | No hay despliegue, monitorización o failover reproducible documentado en el repositorio. | No verificado; infraestructura exigida no acreditada. **0**. | Evidencia del hosting, periodo de medición, supervisión, recuperación y servidor de respaldo. No se asume 99,9 % por usar un servicio en la nube. |
| RNF-05 Interoperabilidad de APIs | Integración robusta IA/banco/base de datos sin pérdida y fallos seguros. | Contrato IA y algunas excepciones; simulación bancaria con errores controlados. E04/E05/E11. | Parcial inicial. **0,25**. | Completar API bancaria, coherencia de estados, operaciones recuperables y errores visibles; demostrar contratos y ausencia de pérdidas en escenarios definidos. |
| Q-01 Usabilidad | Pruebas con usuarios e interacción con IA en Quechuañol. | No se localizaron resultados de sesiones con participantes, protocolo y métricas suficientes. | Pendiente de verificación formal. **0**. | Preparar protocolo, participantes y criterios; ejecutar posteriormente y registrar resultados. |
| Q-02 Integración | Flujo sincronizado entre módulos y servicios. | El Word declara recorridos anteriores; las 114 pruebas usan sustitutos. | No acreditado para el alcance y versión actuales. **0**. | Plan por contratos y recorridos con datos ficticios; resolver bloqueos antes de ejecutar y conservar resultados identificables por versión. No se ejecuta en esta auditoría. |
| Q-03 Rendimiento | Estabilidad y velocidad ante conexiones simultáneas. | No se localizaron mediciones formales de carga y latencia. | Pendiente de verificación formal. **0**. | Acordar umbrales y entorno aislado, ejecutar posteriormente y documentar. No se ejecuta en esta auditoría. |

### Requisitos del texto que requieren interpretación, sin inflar el cálculo

- La justificación económica menciona ganancias por alianzas con farmacias y laboratorios. Existe selección de farmacia en recetas; no hay seguimiento de ventas, liquidación ni módulo de laboratorios. Se considera contexto del modelo comercial, sin sumar un requisito independiente no especificado operacionalmente. Se necesita confirmar si esa monetización debe entregarse; las recomendaciones de farmacia ya están dentro de RF-12.
- «Firma digital» aparece en el caso de receta, pero no define si es firma electrónica dibujada, imagen autorizada o firma criptográfica. Se incluye como parte faltante de RF-12 sin inventar una obligación normativa adicional.
- RNF-02 habla de «parámetros» de latencia sin fijarlos; RNF-04 sí fija 99,9 %, pero no el periodo de medida. Faltan criterios de aceptación.
- RF-06 no especifica el destino de un triaje cuya especialidad está ausente. No se debe confundir ese caso con la falta de médicos disponibles, cuyo destino a Medicina General sí está definido.
- La etiqueta de pago «Completado» en un caso de uso puede confundirse con consulta `completed`. Deben separarse estado financiero y estado de atención.
- Los límites oficiales excluyen SUS/bases gubernamentales, modo offline, otras lenguas originarias, facturación electrónica y pagos a crédito/cuotas. **No se agregan como pendientes ni al denominador.** El alcance geográfico es Cochabamba; no se inventa un requisito de geolocalización. El sistema es apoyo al prediagnóstico, no reemplazo de emergencias presenciales.

## 5. Base de datos y configuración disponibles

**No se inspeccionó ninguna base de datos remota.** La siguiente es una estructura inferida de consultas e inserciones; no certifica que las tablas, claves, índices o políticas estén efectivamente creados.

| Recurso esperado por el código | Uso observado | Información que falta acreditar |
| --- | --- | --- |
| Auth y `profiles` | Identidad, correo/CI, rol, nombre y contacto; se espera correspondencia de ID con el usuario autenticado. | Configuración de confirmación, restricciones únicas, creación de perfil, RLS y autorización para cambiar roles. |
| `patients`, `doctors`, `specialties` | Datos clínicos básicos, aprobación, especialidad y disponibilidad. | Claves/relaciones y políticas. Solo está versionada la adición de `is_online`; no su aplicación remota. |
| `doctor_schedules` | Guardado de horario básico en una rama del perfil. | Esquema, clave para `upsert`, uso efectivo al asignar y reprogramar. |
| `triages` | Síntomas, resultados IA, especialidad, urgencia y estados pending/waiting/in_progress/completed/resolved. | Valor inicial de estado: la inserción no lo fija. Restricciones y transiciones, índices, permisos por paciente/médico y publicación Realtime. |
| `appointments` | Relación entre triaje, paciente y médico; estado y fecha. | Unicidad por triaje, estados permitidos, asignación concurrente y reglas de propiedad. Varias consultas usan `limit(1)` sin orden: no prueban cuál sería la cita correcta si hay duplicados. |
| `medical_records`, `allied_pharmacies` | Diagnóstico, tratamiento, notas, participantes, cita, farmacia y posible URI de receta. | Integridad de asociaciones, nulabilidad, políticas de lectura y consistencia entre guardado y cierre. |
| Storage `doctor_documents` | Carga de títulos y obtención de URL pública. | Existencia, carácter público/privado, acceso permitido y tamaño/tipos. Obtener una URL en código no demuestra que el archivo sea accesible o privado. |
| Almacenamiento de recetas | Se guarda una URI local como campo de registro. | Bucket y proceso de carga/descarga persistente, autorizada y desde otro dispositivo. No se localizaron. |
| Pagos y comisiones | Sin modelo financiero consumido por la aplicación. | Esquema real si existe fuera del repositorio; de lo contrario, diseño de transacciones y movimientos. |

La aplicación usa variables de entorno para URL/clave pública de Supabase y para el API de IA; Python usa configuración de Gemini. Se comprobó cómo se referencian, **no sus valores ni su validez**. No se requieren claves secretas pegadas en el informe o en el chat.

El README continúa siendo una guía genérica de Expo. No hay manifiesto de dependencias Python ni configuración de despliegue reproducible localizada para demostrar los compromisos operativos. Eso es una limitación de reproducibilidad, no prueba de que no exista un servidor externo.

## 6. Hallazgos anteriores contrastados y problemas adicionales

| Hallazgo | Estado actual sustentado |
| --- | --- |
| H-01 Registro con espacios | La corrección permanece en `validateRegistrationFields`; las fuentes coinciden con la ejecución unitaria final. Cerrado solo para la regla local comprobada; no certifica el registro completo. |
| H-02 Perfil de paciente con espacios | La corrección permanece y está probada localmente; falta validar persistencia real. |
| H-03 Triaje sin especialidad | **Sigue pendiente.** El filtro conserva `doc.includes(ai)` cuando `ai` está vacío; PU-37 lo caracteriza. La nueva respuesta de IA exige especialidad, pero eso no resuelve registros antiguos/incompletos ni la regla del filtro. |
| H-04 Citas canceladas | La regla local y las reevaluaciones de sala de espera conservan la corrección. El inicio médico todavía continúa hacia la llamada si fallan inserción de cita o cambio de estado; es una brecha distinta del flujo completo. |
| H-05 Campos clínicos con espacios | La función `hasClinicalRecordFields` y la vista médica independiente están corregidas. **No debe declararse resuelto en todas las rutas:** el formulario dentro de `videocall.tsx:406` usa `if (!diagnosis || !treatment)`, que no rechaza espacios. Observación estática nueva, sin prueba de guardado real. |
| H-06 Prediagnóstico inventado | Corregido en `prepareTriageView` y `TriageEvaluation`. Aún hay `Medium` por defecto en sala de espera y consultas alternativas, además de identificadores/nombres de respaldo en otras rutas. No se extiende el cierre a toda la aplicación. |
| H-07 Error de pago simulado | La simulación propaga errores y no anuncia éxito ante fallo en los casos probados. La integración bancaria sigue ausente. |
| H-08 Reportes monetarios | **Parcial y pendiente.** El contador de completadas está separado; el importe sigue siendo estados × 50. La interfaz lo presenta como ingresos y pagos QR exitosos y llama «Pacientes Atendidos» al total de triajes. Se requieren datos financieros y etiquetas correctas. |
| H-09 Respuestas IA inválidas | Corrección conservada en servicio y conversión a 502 en FastAPI. Falta comprobar HTTP y cliente; la validación manual no tiene proceso operativo y la transcripción mantiene una gestión de errores distinta. |
| Disponibilidad médica | **Pendiente.** Existe código y migración, pero el control está en el layout alternativo; no está demostrado en la ruta médica habitual ni usado por el enrutamiento. La causa del incidente histórico no se establece sin ejecución. |

### Problemas que bloquean procesos principales

1. **Identidad y permisos sin contrato verificable.** No hay esquema/RLS completos disponibles y no todos los layouts tienen una guarda común. Hay un identificador fijo de paciente como respaldo en chatbot y sala de espera. No se publica su valor ni se asume que corresponda a una persona real. Si falta sesión, el proceso debería detenerse, no escoger una identidad de respaldo. El efecto real depende también de las políticas remotas.
2. **Atención sin confirmación de persistencia.** `handleAttend` registra errores de cita/estado y continúa hacia la llamada. El botón de evaluación alternativo navega directamente. No existe un único flujo coherente de asignación y aceptación acreditado.
3. **Cierre e historial inconsistentes.** Guardar registro y cambiar estado son operaciones separadas. `handleEndCall` permite salir con textos escritos sin guardarlos; la pantalla puede mostrar «guardado» aunque no haya ocurrido ese guardado. La salida sin guardar puede marcar completado y emitir texto por broadcast sin crear registro permanente.
4. **Receta no entregada de forma persistente.** URI local, sin subida a Storage ni descarga desde historial del paciente. La plantilla HTML aprobada no resuelve este circuito. Además, reutilizar un PDF generado antes de modificar los campos puede desalinearlo del registro guardado.
5. **Video no aislado por consulta en el código.** Todas las consultas construyen la misma sala externa. El chat lateral contiene respuestas automáticas simuladas; no demuestra comunicación entre participantes. Ese chat no se añade al alcance como una función nueva, pero debe distinguirse de la comunicación real.
6. **Cola clínica incompleta.** Listar triajes recientes por fecha no calcula turno/tiempo ni selecciona profesional disponible; el filtro opcional de especialidad no es un mecanismo completo de derivación.
7. **IA con error controlado pero sin continuidad manual.** El cliente evita guardar un análisis ante HTTP no exitoso, pero pierde la explicación de validación manual y etiqueta distintos errores como «Error de Supabase». No hay bandeja de resolución manual. Las llamadas al proveedor no fijan un timeout explícito.
8. **Pago y finanzas simulados.** No existe QR bancario ni webhook. Los reportes financieros no pueden cerrarse con los datos actuales de estados clínicos.

Estos puntos son deducciones trazables al código, no resultados de pruebas formales. No se afirma que se haya accedido indebidamente a información o que se haya producido una pérdida de datos real.

## 7. Qué está implementado y qué está comprobado

Hay bloques locales concretos terminados para los escenarios unitarios documentados: validación de campos obligatorios de usuarios, preparación del texto de síntomas, determinadas decisiones de citas, rechazo de campos clínicos en la función extraída, preparación del prediagnóstico sin datos ficticios, HTML de recetas, propagación de errores en la simulación y conteo de atenciones completadas. **Son subconjuntos de requisitos**, no requisitos completos certificados.

| Evidencia histórica final | Resultado registrado | Qué demuestra |
| --- | --- | --- |
| Usuarios, dos suites | 39 aprobadas | Validaciones locales. |
| Triaje Jest | 7 aprobadas | Preparación/filtro, incluida caracterización H-03. |
| Reglas de sala de espera | 14 aprobadas | Decisiones locales de estados. |
| Historial/prediagnóstico/recetas | 19 aprobadas | Funciones y HTML; no las dos rutas completas de guardado. |
| Servicio de pagos simulados | 8 aprobadas | Orquestación con Supabase sustituido. |
| Reportes | 5 aprobadas | Cálculos; conserva caracterización monetaria pendiente. |
| Componentes aislados | 6 aprobadas | Tres casos de pago, uno de prediagnóstico y dos de sala de espera. Ya incluidos en Jest. |
| **Jest** | **98 aprobadas en 8 suites** | **No acredita navegación real ni servicios externos.** |
| **Python unittest** | **16 aprobadas** | **Servicio con red/configuración sustituidas; no endpoint HTTP ni calidad clínica.** |
| **Total** | **114 aprobadas, 0 fallidas, 0 omitidas** | **Resultado del 30/09/2026, no nueva ejecución del 04/10/2026.** |

Los 23 archivos de fuentes enumerados en `final/ejecucion.json` conservan sus hashes. Esto respalda la correspondencia del código evaluado, pero no demuestra que toda la aplicación ni sus dependencias externas estén sin cambios. El commit histórico era otro y había cambios locales; sus hashes identifican mejor esa ejecución que el commit por sí solo.

Las comprobaciones anteriores registraron TypeScript sin errores y otras verificaciones estáticas. No se repitieron ahora. Las pruebas de componentes sustituyen también partes del entorno de estilos: no acreditan apariencia ni compatibilidad visual web/móvil.

## 8. Lista priorizada de trabajo y dependencias

Esta es una propuesta para decidir el trabajo siguiente, no cambios realizados ni autorización asumida para operaciones remotas.

| Orden | Tarea | Depende de | Resultado necesario para cerrarla |
| --- | --- | --- | --- |
| P0-1 | Confirmar reglas de alcance y criterios de aceptación: H-03, H-08, estados, firma, generaciones, capacidad y plataformas. | Decisiones del responsable del proyecto. | Lista acordada de reglas sin contradicciones entre Word y sistema. No cambiar el alcance para ocultar ausencias. |
| P0-2 | Obtener esquema y configuración saneados de Supabase y preparar entorno de ensayo aislado. | Acceso autorizado a metadatos, sin datos reales. | DDL, claves, restricciones, políticas, buckets y Realtime reproducibles; ninguna migración se aplica en esta auditoría. |
| P0-3 | Unificar identidad, autorización y rutas activas. Retirar identidades de respaldo y comprobar permisos efectivos. | P0-2 y definición de roles. | Un usuario solo actúa con su identidad y privilegios; rutas antiguas no eluden las reglas. |
| P0-4 | Unificar creación/asignación de cita, cierre e historial. No continuar con escrituras fallidas; usar la misma validación en ambos formularios. | P0-2, P0-3 y estados acordados. | No hay éxito visual sin persistencia ni registros desasociados; repetir una acción no duplica la consulta. |
| P1-1 | Completar disponibilidad médica en la ruta realmente usada, su persistencia y consumo por derivación. | P0-2/P0-3; diagnóstico del botón. | Estado confirmado en servidor y reflejado en asignación; recuperación del último estado ante error. |
| P1-2 | Completar contrato IA–cliente, errores de audio y circuito de validación manual. | P0-1/P0-3; endpoint de ensayo disponible. | Respuesta válida o caso manual claro, sin urgencias inventadas ni asociación a paciente equivocado. |
| P1-3 | Construir derivación, prioridad, posición y estimación de espera, con alternativa a Medicina General. | P1-1/P1-2 y política clínica. | Cola coherente con prioridad y profesionales disponibles; pausa/demora visible y reprogramación consistente. |
| P1-4 | Completar aislamiento y ciclo real de videoconsulta por cita. | P0-3/P0-4 y acceso de pruebas al proveedor de video. | Sala asociada a la consulta, participantes autorizados, estado real de conexión, errores y finalización. |
| P1-5 | Completar PDF persistente y acceso del paciente; definir firma y coherencia con el registro guardado. | P0-2/P0-4 y decisión de firma. | Archivo vinculado a versión del registro, recuperable por el paciente desde otro dispositivo, con manejo de fallos. |
| P1-6 | Implementar QR y verificación bancaria en sandbox, después comisiones e historial financiero. | Proveedor/contrato de ensayo, reglas de tarifas y P0-2/P0-3. | Transacción identificada y validada, acceso controlado y movimientos trazables. No usar transferencias reales para completar desarrollo. |
| P2-1 | Completar reportes: etiquetas correctas, filtros, tiempos, finanzas, exportación y dimensión generacional acordada. | Estados de atención fiables y P1-6 para finanzas; P0-1 para generaciones. | Reporte que concilie con fuentes, filtre por periodo y exporte; H-08 cerrado con evidencia. |
| P2-2 | Documentar despliegue, límites, recuperación, privacidad y disponibilidad. | Entornos/proveedores conocidos. | Configuración reproducible y criterios RNF medibles, sin suponer garantías por el framework. |
| P2-3 | Ejecutar posteriormente integración por contratos y recorridos; luego usabilidad y rendimiento, más verificaciones de seguridad acordadas. | Cierre de bloqueos correspondientes y entorno aislado. | Registros con fecha, versión, entradas ficticias, resultados y fallos conservados. No se requiere esperar a todos los módulos para validar un contrato ya estable. |
| P3 | Actualizar documento académico y capturas con los resultados realmente obtenidos. | Evidencia de cada etapa. | El texto distingue simulaciones, funciones implementadas, pruebas y pendientes. |

Antes de una integración general conviene resolver P0. Se pueden planificar verificaciones parciales posteriores de Auth/perfiles y contrato IA, pero las pruebas no sustituyen la implementación del QR, cola o descarga de recetas que hoy faltan.

### Decisiones y material necesarios del responsable

1. **H-03:** destino de triajes sin especialidad, distinto del caso sin profesionales disponibles. Opciones a acordar: revisión manual/vista general o regla explícita de asignación.
2. **H-08:** presentación temporal de dinero no verificado; ocultarlo o rotularlo como estimación de simulación. Para el cumplimiento final del RF-15 se necesitan transacciones reales verificadas en el entorno correspondiente.
3. **Base de datos:** exportación solo de esquema, restricciones, políticas y configuración de Storage/Realtime; no enviar datos de pacientes ni claves de servicio.
4. **Disponibilidad:** ruta/pantalla exacta del fallo histórico y entorno donde ocurrió. El código actual tiene dos estructuras de navegación y solo una incluye el interruptor.
5. **Servicios de ensayo:** dirección del API de IA accesible desde web/móvil, cuentas ficticias por rol, proveedor y sandbox bancario, y configuración autorizada de salas de video. Los secretos se configuran por el mecanismo seguro del entorno, no en el informe.
6. **Reglas financieras:** tarifa, comisión, momento del cobro/devengo, significado de estados y alcance de alianzas comerciales.
7. **Criterios clínicos y lingüísticos:** profesionales que validarán muestras de Quechuañol, prioridad, derivación y tratamiento de emergencias. Las heurísticas de palabras no sustituyen esa aceptación.
8. **PDF y reportes:** significado de firma digital, dimensión «generacional», columnas del reporte y límites temporales.
9. **Plataformas y RNF:** Android/iOS comprometidos, navegadores, volumen simultáneo, latencia aceptable y periodo de medida del 99,9 %. Evidencias manuales anteriores con fecha, versión y entorno permitirían mejorar la confianza sin inventar resultados.

## 9. Índice de evidencias de código

Las líneas corresponden al estado leído el 04/10/2026. Los enlaces son locales y no exponen servicios ni credenciales.

- **E01 Usuarios:** [registro, validación y creación](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/register.tsx:76), líneas 76–196; [login y rol](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/index.tsx:72), 72–142; [validadores](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/utils/userValidation.ts:16).
- **E02 Administración:** [comprobación admin](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(admin)/dashboard.tsx:111>), 111–138; aprobación y reasignación 253–327; rechazo 336–381. [Especialidades](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(admin)/specialties.tsx:58>), 58–140.
- **E03 Perfiles:** [paciente](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(patient)/profile.tsx:51>), 51–201; [médico](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(doctor)/profile.tsx:30>), 30–115.
- **E04 Cliente y persistencia del triaje:** [chatbot](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/components/SymptomChatbot.tsx:88), 88–168 audio y 171–274 envío/errores; [servicio de triajes](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/services/triage.service.ts:18), 18–68.
- **E05 IA:** [servicio Python](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/ai-engine/llm_service.py:10), 10–127 análisis y 129–160 transcripción; [endpoints](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/ai-engine/main.py:12), 12–61.
- **E06 Derivación e inicio médico:** [filtro](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/utils/triageWorkflow.ts:6); [atender](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(doctor)/dashboard.tsx:130>), 130–184; servicio de E04 ordena triajes por fecha.
- **E07 Espera y disponibilidad:** [sala de espera](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(patient)/waiting-room.tsx:38>), 38–218 y presentación 289–337; [interruptor](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/components/Sidebar.tsx:54), 54–74; [reglas locales](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/utils/consultationRules.ts:1).
- **E08 Videoconsulta:** [pantalla](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(doctor)/videocall.tsx:76>), 76–126 conexión visual; 352–375 triaje; 384–403 chat simulado; 406–501 guardado; 504–545 salida; 548–613 sala fija/iframe/WebView. No se reproduce la URL privada de sala en este informe.
- **E09 Prediagnóstico y receta:** [evaluación](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/components/TriageEvaluation.tsx:8), 8–14 y 105–130; [preparación](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/utils/triagePresentation.ts:1); [vista clínica/PDF](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(doctor)/medical-record.tsx:83>), 83–136 y 138–220; [HTML y firma textual](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/utils/medicalRecord.ts:3), especialmente 77–79.
- **E10 Recuperación clínica:** [historial paciente](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(patient)/history.tsx:29>), 29–102; [historial médico](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(doctor)/history.tsx:29>), 29–95; [expedientes](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(doctor)/patient-records.tsx:43>), 43–125. Existen también rutas alternativas `(tabs)/historial` y `(tabs)/consultas`.
- **E11 Pagos:** [pantalla simulada](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(patient)/payment.tsx:14>), 14–105; [servicio](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/services/paymentSimulation.ts:1).
- **E12 Reportes:** [cálculo](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/utils/reportStats.ts:1); [pantalla](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(admin)/reports.tsx:24>), 24–41 y 74–121.
- **E13 Persistencia/configuración:** [cliente Supabase](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/lib/supabase.ts:17); [única migración localizada](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/supabase/migrations/01_add_is_online_to_doctors.sql:6).
- **E14 Plataformas y rutas:** [configuración Expo](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app.json:1); [layout raíz](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/_layout.tsx:15); [layout médico](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(doctor)/_layout.tsx:8>); [layout alternativo con Sidebar](<C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/app/(tabs)/_layout.tsx:36>); [menú compartido](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/components/CustomDrawer.tsx:18).
- **E15 Ejecución histórica:** [metadatos y hashes](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/evidencias/revision-hallazgos-20260930/final/ejecucion.json); [Jest](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/evidencias/revision-hallazgos-20260930/final/jest.json); [Python](C:/Users/inutil/Documents/GitHub/PROYECTO_DE_GRADO_TELEMEDICINA/evidencias/revision-hallazgos-20260930/final/python.json).

Los archivos de estilo, iconos, temas, componentes comunes y pantallas de plantilla ayudan a la presentación, pero no reciben puntos adicionales por existir. Los scripts diagnósticos externos no se toman como pruebas aprobadas por el solo hecho de estar en el proyecto.

## 10. Alcance de la entrega

Se entrega este informe independiente. No se corrigió código, no se agregaron funciones, no se modificaron documentos académicos ni evidencias anteriores, y no se realizaron operaciones sobre la base de datos. Las tareas y decisiones descritas quedan propuestas para una etapa posterior.
