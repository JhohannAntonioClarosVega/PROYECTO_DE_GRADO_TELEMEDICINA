from pathlib import Path
import json, re, hashlib, shutil, subprocess
from datetime import datetime, timezone, timedelta

ROOT=Path(__file__).resolve().parents[2]
E=ROOT/'evidencias/pruebas-completas'
TMP=ROOT/'tmp/pruebas-completas'
TEMPLATE=Path('C:/Users/inutil/Downloads/Demo_pruebas_unitarias_RUP2_documento_completo.docx')
OFFICIAL=Path('C:/Users/inutil/Downloads/Documento_Oficial_V2 (5).docx')
PDF=Path('C:/Users/inutil/Downloads/PG - MODLEO_UML_RUP 2 1 (1).pdf')

def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x): p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

modules={
'usuarios':dict(name='Gestión de usuarios',tests=['__tests__/loginValidation.test.ts','__tests__/userValidation.test.ts'],sources=['utils/validation.ts','utils/userValidation.ts'],modified=[],count=30,limits='Se evaluaron cuatro validadores locales. Autenticación, alta de cuentas, asignación de roles y persistencia de perfiles requieren integración con Supabase.'),
'triaje':dict(name='Triaje mediante inteligencia artificial',tests=['__tests__/triageWorkflow.test.ts'],sources=['utils/triageWorkflow.ts'],modified=['components/SymptomChatbot.tsx','app/(doctor)/dashboard.tsx'],count=7,limits='Se comprobaron preparación de texto y filtro de especialidades. No se evaluaron micrófono, interfaz, traducción real ni exactitud clínica.'),
'triaje-python':dict(name='Triaje mediante inteligencia artificial',tests=['ai-engine/test_unit_llm.py'],sources=['ai-engine/llm_service.py'],modified=[],count=7,limits='Se sustituyeron dotenv, red, variables de configuración y escritura de errores. Se probó el servicio Python sin arrancar FastAPI ni consultar al proveedor. La validez clínica y lingüística requiere evaluación especializada.'),
'videoconsultas':dict(name='Videoconsultas',tests=['__tests__/consultationRules.test.ts'],sources=['utils/consultationRules.ts'],modified=['app/(patient)/waiting-room.tsx'],count=7,limits='Se evaluaron decisiones locales de la sala de espera. No se probó conexión, audio, video ni actualización real de disponibilidad. El fallo manual informado permanece pendiente de reproducción y corrección.'),
'historial-recetas':dict(name='Historial y recetas',tests=['__tests__/medicalRecord.test.ts'],sources=['utils/medicalRecord.ts','utils/triagePresentation.ts'],modified=['app/(doctor)/medical-record.tsx','components/TriageEvaluation.tsx'],count=9,limits='Se comprobaron campos obligatorios, preparación del prediagnóstico y fragmentos del HTML de la receta. No se probó guardar el historial, generar el archivo PDF, compartirlo ni verificar su contenido clínico.'),
'pagos':dict(name='Pagos',tests=['__tests__/paymentSimulation.test.ts'],sources=['services/paymentSimulation.ts'],modified=['app/(patient)/payment.tsx'],count=4,limits='Solo se probó la función de simulación con Supabase sustituido. La generación de un QR bancario y la verificación de transacciones reales no están implementadas.'),
'reportes':dict(name='Reportes',tests=['__tests__/reportStats.test.ts'],sources=['utils/reportStats.ts'],modified=['app/(admin)/reports.tsx'],count=5,limits='Existe la pantalla y su cálculo estadístico. Se evaluaron contadores y estimaciones, no la consulta a Supabase. No se implementaron los filtros por fecha y exportación previstos por el caso de uso.'),
}
results={}; executions={}; suitecount=0
for key,m in modules.items():
 r=read(E/key/'resultado.json')
 if key=='triaje-python':
  assert r['total']==7 and r['errors']==r['failures']==r['skipped']==0
  ex={k:r[k] for k in ['inicio','fin','comando','python']}
  ex.update(zona='America/La_Paz',archivos=m['tests'],versiones=read(E/'usuarios/ejecucion.json')['versiones'],commit=read(E/'usuarios/ejecucion.json')['commit'],cambiosLocales='Sí; extracción de reglas y nuevos archivos de prueba. Consultar inventario y fuentes.',codigoSalida=0)
  save(E/key/'ejecucion.json',ex)
  items=[(int(re.search(r'PU_(\d+)',v['id'])[1]),v['id'],v['status']) for v in r['cases']]
 else:
  assert r['numTotalTests']==m['count'] and r['numFailedTests']==r['numPendingTests']==0 and r['numPassedTests']==m['count']
  suitecount+=r['numTotalTestSuites']
  ex=read(E/key/'ejecucion.json');items=[]
  for s in r['testResults']:
   for i,v in enumerate(s['assertionResults']):
    match=re.search(r'PU-(\d+)',v['fullName'])
    n=int(match[1]) if match else i+1
    assert match or s['name'].endswith('loginValidation.test.ts')
    items.append((n,v['fullName'],v['status']))
 for n,title,status in items:
  assert n not in results and status=='passed'
  results[n]=dict(module=key,test_title=title,status=status)
 executions[key]=ex
assert sorted(results)==list(range(1,70)) and suitecount==7

cases=[]
old=(ROOT/'tmp/rup2-usuarios/build.py').read_text(encoding='utf-8')
ns={}
exec(old[old.index('data=[]'):old.index('assert len(data)==30')],ns)
oldrows=[line.split('|')[1:-1] for line in (ROOT/'evidencias/pruebas-usuarios/informe-usuarios.md').read_text(encoding='utf-8').splitlines() if line.startswith('| PU-')]
for n,((scenario,steps,expected),row) in enumerate(zip(ns['data'],oldrows),1):
 row=[s.strip() for s in row]
 use='Iniciar sesión' if n<=9 else 'Registrar usuario' if n<=21 else 'Editar perfil del paciente' if n<=25 else 'Editar perfil del médico'
 cases.append(dict(n=n,id=f'PU-{n:02}',use=use,fn=row[1],scenario=scenario,data=row[3],steps=steps,expected=expected))

def add(n,use,fn,scenario,data,action,expected):
 cases.append(dict(n=n,id=f'PU-{n:02}',use=use,fn=fn,scenario=scenario,data=data,steps=f'1. {action}\n2. Comparar la respuesta con la expectativa indicada.',expected=expected))
capture='Capturar sintomatología en Quechuañol'; process='Procesar y traducir sintomatología mediante IA'; classify='Clasificar urgencia y derivar al paciente';waiting='Visualizar sala de espera';clinical='Registrar historial clínico';pred='Visualizar prediagnóstico de IA';recipe='Autogenerar receta PDF';pay='Verificar transacción';report='Generar reportes estadísticos'
add(31,capture,'normalizeSymptomText','El texto de síntomas contiene solo espacios.','Tres espacios.','Invocar la normalización con tres espacios.','Se obtiene una cadena vacía.')
add(32,capture,'normalizeSymptomText','El relato tiene espacios exteriores.','«  uma nanay  ».','Invocar la normalización con el relato ficticio.','Se obtiene «uma nanay», conservando las palabras del relato.')
add(33,capture,'buildSymptomReport','Se completa el relato, su duración y el uso de medicamentos.','Síntomas: «uma nanay»; tiempo: «dos horas»; medicamentos: «ninguno».','Invocar la construcción del reporte con los tres textos.','Se obtienen tres líneas: «Síntomas principales: uma nanay», «Tiempo/Intensidad: dos horas» y «Medicamentos previos: ninguno».')
add(34,classify,'filterTriagesBySpecialty','La especialidad tiene diferencias de tildes y mayúsculas.','Cola: « PEDIATRIA » y «Cardiología»; médico: «Pediatría»; filtro activo.','Filtrar los dos triajes ficticios para Pediatría.','Se conserva únicamente el registro con especialidad « PEDIATRIA ».')
add(35,classify,'filterTriagesBySpecialty','El médico pertenece a Medicina General.','La misma cola ficticia de dos especialidades; médico: «Medicina General»; filtro activo.','Filtrar la cola para Medicina General.','Se conservan los dos registros de la cola.')
add(36,classify,'filterTriagesBySpecialty','El filtro por especialidad está desactivado.','Cola de Pediatría y Cardiología; médico: «Pediatría»; filtro inactivo.','Invocar el filtro desactivado con la cola ficticia.','Se conservan los dos registros de la cola.')
add(37,classify,'filterTriagesBySpecialty','Un triaje no incluye especialidad recomendada.','Cola con un objeto vacío; médico: «Pediatría»; filtro activo.','Filtrar la cola que contiene el registro sin especialidad.','El registro sin especialidad permanece en la cola. Se reproduce la regla existente.')
add(38,classify,'detect_heuristic_specialty','El relato contiene una referencia infantil y dolor de pecho.','«Mi wawa tiene dolor de pecho».','Invocar la regla de especialidad con el relato y comprobar que no se solicita una conexión.','La regla devuelve «Pediatría». Esto no acredita que la derivación sea clínicamente adecuada.')
add(39,classify,'analyze_symptoms_with_gemini','No está configurado el acceso al proveedor.','Relato «uma nanay»; lectura de configuración simulada como ausente.','Simular la configuración ausente, invocar el análisis y comprobar que no se solicita una conexión.','Se obtiene especialidad «Neurología», urgencia «Medium» y el texto original sin traducir.')
add(40,process,'analyze_symptoms_with_gemini','El proveedor simulado devuelve un objeto completo dentro de un bloque de texto.','Relato ficticio; JSON simulado: idioma Español, texto «Texto ficticio», urgencia Low, recomendación «Revisión ficticia», especialidad Medicina General.','Sustituir la respuesta de red por el JSON entre marcas de código e invocar el análisis.','Se devuelve el objeto esperado con sus cinco campos y se registra una llamada a la red simulada.')
add(41,process,'analyze_symptoms_with_gemini','El proveedor simulado omite campos del análisis.','JSON con solo recommended_specialty igual a «Medicina General».','Sustituir la respuesta por el objeto incompleto e invocar el análisis del relato ficticio.','El resultado carece de urgency_level y standardized_symptoms. Se reproduce la falta de comprobación de estos campos en el servicio.')
add(42,process,'analyze_symptoms_with_gemini','El proveedor simulado devuelve texto sin un objeto JSON.','«respuesta ficticia no estructurada»; relato «relato ficticio».','Sustituir la respuesta por texto no estructurado e invocar el análisis.','Se obtiene urgencia «Medium» y se conserva «relato ficticio» como texto estandarizado de respaldo.')
add(43,process,'transcribe_audio_only','La transcripción simulada incluye espacios exteriores.','Contenido ficticio codificado: ZmljdGljaW8=; respuesta «  Texto transcrito ficticio  ».','Sustituir la respuesta de red e invocar la transcripción con contenido ficticio.','Se obtiene «Texto transcrito ficticio» sin espacios exteriores. No se procesa una grabación real.')
add(44,process,'transcribe_audio_only','La solicitud de transcripción genera una excepción simulada.','Contenido ficticio ZmljdGljaW8=; excepción «Fallo ficticio de red».','Simular la excepción de red e invocar la transcripción.','Se devuelve «[Error: No se pudo transcribir el audio adjunto]».')
for n,status in [(45,'completed'),(46,'resolved')]:
 add(n,waiting,'isClosedTriage',f'El triaje tiene estado «{status}».',f'Estado {status}.','Invocar la regla de cierre con el estado indicado.','La función indica que el triaje está cerrado.')
add(47,waiting,'isClosedTriage','El triaje permanece en espera.','Estado waiting.','Invocar la regla de cierre con el estado de espera.','La función indica que el triaje no está cerrado.')
add(48,waiting,'isDoctorReadyForCall','La atención está en progreso, sin una cita recibida.','Estado in_progress; cita nula.','Invocar la decisión de habilitación con atención en progreso y cita nula.','La decisión local permite habilitar la llamada; no se establece una videoconferencia.')
add(49,waiting,'isDoctorReadyForCall','Hay un objeto de cita y el triaje sigue en espera.','Estado waiting; cita con id «cita-ficticia».','Invocar la decisión con el estado de espera y la cita ficticia.','La decisión local permite habilitar la llamada.')
add(50,waiting,'isDoctorReadyForCall','No hay una cita ni atención en progreso.','Estado waiting; cita nula.','Invocar la decisión con el estado de espera y cita nula.','La decisión local no habilita la llamada.')
add(51,waiting,'isDoctorReadyForCall','El objeto de cita tiene estado cancelado.','Estado waiting; cita con status cancelled.','Invocar la decisión con una cita ficticia cancelada.','La decisión permite habilitar la llamada porque solo comprueba la existencia del objeto de cita.')
add(52,clinical,'hasClinicalRecordFields','El diagnóstico está vacío.','Diagnóstico vacío; tratamiento «Plan ficticio».','Invocar la validación con diagnóstico vacío y tratamiento con contenido.','La validación rechaza los campos.')
add(53,clinical,'hasClinicalRecordFields','El tratamiento está vacío.','Diagnóstico «Diagnóstico ficticio»; tratamiento vacío.','Invocar la validación con diagnóstico con contenido y tratamiento vacío.','La validación rechaza los campos.')
add(54,clinical,'hasClinicalRecordFields','El diagnóstico y el tratamiento tienen contenido.','«Diagnóstico ficticio» y «Plan ficticio».','Invocar la validación con ambos textos ficticios.','Los campos superan la validación local. No se guarda un historial.')
add(55,clinical,'hasClinicalRecordFields','El diagnóstico y el tratamiento contienen solo espacios.','Tres espacios en cada campo.','Invocar la validación con ambos campos formados por espacios.','Los campos superan la validación local. Se reproduce una limitación de la regla existente.')
add(56,pred,'prepareTriageView','Se recibe un reporte con nombre, urgencia y análisis.','Paciente Ficticio; urgencia Low; análisis «Texto de prueba»; sin recomendación.','Preparar los datos de presentación e inspeccionar el nombre y el objeto de análisis.','Se conservan el nombre, Low y «Texto de prueba»; la recomendación es «Sin recomendación.».')
add(57,pred,'prepareTriageView','Se recibe un objeto de triaje vacío.','Objeto vacío.','Invocar la preparación con el objeto vacío y comparar nombre y urgencia.','Se obtiene nombre «Desconocido» y urgencia «Medium» como valores predeterminados.')
add(58,pred,'prepareTriageView','No se recibe ningún triaje.','Argumento sin definir.','Invocar la preparación sin argumentos y comparar nombre y urgencia.','Se obtiene el nombre de demostración «Juan Perez» y urgencia «Critical». No corresponden a un paciente evaluado.')
add(59,recipe,'generatePrescriptionHtml','Se prepara el contenido de una receta sin farmacia.','Paciente Ficticio; Médico Ficticio; Diagnóstico ficticio; Plan ficticio; farmacia vacía.','Generar el HTML y buscar los cuatro textos; comprobar la ausencia de la sección de farmacia.','El HTML contiene paciente, médico, diagnóstico y tratamiento; no contiene «Farmacia Aliada Sugerida».')
add(60,recipe,'generatePrescriptionHtml','Se incluye una farmacia en la receta.','Los mismos datos ficticios y farmacia «Farmacia Ficticia».','Generar el HTML y comprobar el título y el nombre de la farmacia.','El HTML contiene «Farmacia Aliada Sugerida» y «Farmacia Ficticia». No se genera el archivo PDF.')
add(61,pay,'markSimulatedPaymentWaiting','La simulación de pago no recibe un identificador.','Identificador sin definir; Supabase sustituido.','Ejecutar la simulación y consultar las llamadas al sustituto de Supabase.','No se solicita una tabla ni una actualización.')
add(62,pay,'markSimulatedPaymentWaiting','La simulación recibe un identificador ficticio.','Id «triaje-ficticio»; respuesta simulada sin error.','Ejecutar la simulación y comparar tabla, actualización y filtro recibidos por el sustituto.','Se solicita la tabla triages, el estado waiting y el filtro id igual a «triaje-ficticio». No se realiza un pago.')
add(63,pay,'markSimulatedPaymentWaiting','Supabase simulado devuelve un objeto de error.','Id «triaje-ficticio»; error con mensaje «Fallo ficticio».','Simular la respuesta con error, ejecutar la función y comprobar la resolución y el registro de errores.','La función termina sin devolver valor ni registrar el error recibido. No propaga el fallo.')
add(64,pay,'markSimulatedPaymentWaiting','Supabase simulado lanza una excepción.','Id «triaje-ficticio»; excepción «Fallo ficticio».','Simular la excepción, ejecutar la función y comprobar el registro de errores y su resolución.','La excepción se registra mediante console.error y la función termina sin propagarla.')
add(65,report,'calculateReportStats','No existen triajes en la colección.','Lista vacía.','Invocar el cálculo estadístico con una lista vacía.','Todos los contadores y la estimación de ingresos son cero.')
add(66,report,'calculateReportStats','La colección combina niveles conocidos y desconocidos.','Cuatro registros: Critical, Medium, Low y Unknown; sin estado.','Invocar el cálculo y comparar el objeto completo de estadísticas.','Total: 4; un registro por cada nivel reconocido; el nivel desconocido no incrementa esas categorías. Estimación y completados: 0.')
add(67,report,'calculateReportStats','Hay registros en espera y en progreso.','Dos registros: waiting e in_progress.','Calcular las estadísticas y comparar completados e ingresos estimados.','El campo completedTriages devuelve 2 y totalRevenue devuelve 100. Se reproduce el conteo de estados aún no finalizados.')
add(68,report,'calculateReportStats','Hay un registro con estado completado.','Un registro con estado completed.','Calcular las estadísticas y comparar completados e ingreso estimado.','Se obtiene 1 en completedTriages y 50 en totalRevenue. El importe es una estimación, no un cobro verificado.')
add(69,report,'calculateReportStats','Los estados no participan en la estimación existente.','Dos registros: pending y resolved.','Calcular las estadísticas y comparar completados e ingreso estimado.','completedTriages y totalRevenue son cero para estos estados.')

findings=[
('H-01',[21],'El registro acepta un nombre formado solo por espacios. La validación local no lo considera vacío.'),
('H-02',[25],'El perfil del paciente acepta teléfono y dirección formados solo por espacios.'),
('H-03',[37],'El filtro de especialidad conserva un triaje sin especialidad, incluso al seleccionar Pediatría. No confirma una derivación adecuada.'),
('H-04',[51],'La decisión local de habilitar la llamada acepta un objeto de cita cancelada porque no comprueba su estado. No se reprodujo una conexión real.'),
('H-05',[55],'La validación local del historial acepta diagnóstico y tratamiento compuestos solo por espacios.'),
('H-06',[57,58],'La preparación del prediagnóstico utiliza urgencia Medium ante un objeto vacío; si no hay triaje, devuelve datos de demostración y urgencia Critical. Estos valores no representan una evaluación clínica.'),
('H-07',[63,64],'La simulación de pago no propaga los errores: ignora los errores devueltos y solo registra las excepciones. La pantalla conserva su posterior indicación de éxito; este último recorrido no se ejecutó en interfaz.'),
('H-08',[67],'El contador denominado completedTriages incluye estados waiting e in_progress. Los ingresos se estiman multiplicando ciertos registros por 50; no provienen de cobros bancarios.'),
('H-09',[41],'El servicio de análisis devuelve una respuesta incompleta sin exigir urgency_level ni standardized_symptoms. La prueba se limita al servicio y no evalúa los valores de respaldo del endpoint FastAPI.'),
]
for c in cases:
 c.update(results[c['n']]);c['module_name']=modules[c['module']]['name'];c['framework']='unittest' if c['module']=='triaje-python' else 'Jest'
 c['finding']=next((h[0] for h in findings if c['n'] in h[1]),None)
 c['state']='Éxito al reproducir el comportamiento actual; se detectó una limitación funcional' if c['finding'] else 'Éxito'
 c['actual']='Las aserciones confirmaron la respuesta descrita en el resultado esperado.'
 c['evidence']=f"{c['module']}/resultado.json y salida.log; {c['id']}"
 if c['n']<=5:c['evidence']+=f" (caso original {c['n']})"
actuals={
31:'Cadena vacía.',32:'Texto «uma nanay».',33:'Las tres líneas coincidieron exactamente con las esperadas.',
34:'Lista con el primer registro de la cola.',35:'Lista original de dos registros.',36:'Lista original de dos registros.',37:'Lista con el objeto sin especialidad.',
38:'Especialidad Pediatría; ninguna llamada de red.',39:'Neurología; Medium; texto «uma nanay»; ninguna llamada de red.',40:'Objeto igual al JSON simulado; una llamada al sustituto de red.',41:'No se encontraron urgency_level ni standardized_symptoms.',42:'Urgencia Medium y texto «relato ficticio».',43:'Texto «Texto transcrito ficticio».',44:'Mensaje «[Error: No se pudo transcribir el audio adjunto]».',
45:'true, triaje cerrado.',46:'true, triaje cerrado.',47:'false, triaje no cerrado.',48:'true, habilitación local.',49:'true, habilitación local.',50:'false, sin habilitación local.',51:'true, incluso con cita cancelada.',
52:'false, campos rechazados.',53:'false, campos rechazados.',54:'true, campos aceptados localmente.',55:'true, se aceptaron los espacios.',56:'Paciente Ficticio; análisis con Low, Texto de prueba y Sin recomendación.',57:'Nombre Desconocido y urgencia Medium.',58:'Nombre Juan Perez y urgencia Critical.',59:'Los cuatro textos están presentes; la sección de farmacia está ausente.',60:'Están presentes el título de farmacia y Farmacia Ficticia.',
61:'No se llamó al sustituto supabase.from.',62:'Se comprobaron triages, actualización waiting y filtro id igual a triaje-ficticio.',63:'Resolución undefined; ninguna llamada a console.error.',64:'Resolución undefined; console.error recibió el mensaje y la excepción esperados.',
65:'Los seis valores estadísticos son 0.',66:'Total 4; Critical 1; Medium 1; Low 1; ingresos 0; completados 0.',67:'completedTriages=2; totalRevenue=100.',68:'completedTriages=1; totalRevenue=50.',69:'completedTriages=0; totalRevenue=0.'}
for c in cases:
 n=c['n']
 if n<=30:
  if n in [5,8,9,16,19,21,24,25,30]: c['actual']='isValid=true, sin mensaje de error.'
  else:
   msg=('Por favor ingresa tu correo y contraseña.' if n in [1,6,7] else 'Por favor ingresa tu contraseña.' if n==2 else 'Por favor ingresa tu correo electrónico.' if n in [3,4] else 'Por favor completa todos los campos comunes.' if n in [10,11,12,13,14,15,20] else 'Por favor selecciona una especialidad y adjunta tu título.' if n in [17,18] else 'Por favor completa el número de teléfono y la dirección.' if n in [22,23] else 'El nombre y el celular no pueden estar vacíos')
   c['actual']='isValid=false; mensaje «'+msg+'».'
 else:
  c['actual']=actuals[n]
  c['steps']='1. Preparar los datos ficticios: '+c['data'].rstrip('.')+'.\n'+c['steps'].replace('1. ','2. ',1).replace('\n2. Comparar','\n3. Comparar')
assert len(cases)==69
save(E/'casos.json',cases)
save(E/'resumen.json',dict(fecha='2026-09-30',casos=69,jest=62,suitesJest=7,python=7,fallidosFinales=0,omitidosFinales=0,erroresPreparacionInicialPython=7,modulos=modules,hallazgos=findings,ejecuciones=executions))

# Conservación de fuentes verificables por módulo, sin leer archivos de secretos.
for key,m in modules.items():
 dest=E/key/'fuentes';dest.mkdir(exist_ok=True)
 for f in m['tests']+m['sources']+m['modified']+['jest.config.js','package.json','scripts/record-unit-tests.cjs']:
  target=dest/(f+'.txt');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/f,target)
 (E/key/'alcance.md').write_text(f"# {m['name']}\n\n{m['count']} casos finales aprobados. Fallidos: 0. Omitidos: 0.\n\n## Archivos\n\nPruebas: "+', '.join(m['tests'])+'\n\nFunciones: '+', '.join(m['sources'])+'\n\nPantallas modificadas en esta ampliación: '+(', '.join(m['modified']) or 'Ninguna')+'\n\n## Límites\n\n'+m['limits']+'\n\nComando, fecha, versiones y estado local: ejecucion.json. Capturas: consultar capturas.md.\n',encoding='utf-8')
 changed=m['modified']+([s for s in m['sources'] if not (key in ['usuarios','triaje-python'])])+([t for t in m['tests'] if key!='usuarios'])
 save(E/key/'archivos.json',dict(creadosOModificadosEnEstaAmpliacion=changed,fuentesConservadas=[dict(archivo=str(f.relative_to(dest)),sha256=sha(f)) for f in dest.rglob('*.txt')]))

allchanged=sum([m['modified'] for m in modules.values()],[])
diff=subprocess.run(['git','diff','--',*allchanged],cwd=ROOT,capture_output=True).stdout
(E/'cambios-aplicacion.patch').write_bytes(diff)
save(E/'referencias.json',[dict(archivo=str(p),sha256=sha(p)) for p in [TEMPLATE,OFFICIAL,PDF]])
(TMP/'artifact.md').write_text('''# Contrato de la plantilla

Referencia: Demo_pruebas_unitarias_RUP2_documento_completo.docx, hash en evidencias/pruebas-completas/referencias.json.
Páginas 1 a 9 revisadas visualmente. Modelo RUP 2: página impresa 147 (física 180) y 184 (física 217) revisadas visualmente.
Se parte de una copia DOCX. Conservar tamaño carta, márgenes 2.159 cm laterales y 1.905 cm verticales, estilos Arial, jerarquía y encabezados de tabla rosados E8B8B8 y bordes B7B7B7.
Slots editables: portada, párrafos del capítulo, dos tablas, figuras, secciones y tablas por caso de uso del apéndice. Eliminar ejemplos no ejecutados, duplicación de perfiles, conclusión de demo y página vacía residual. Clonar estos patrones para los casos reales.
Adaptaciones autorizadas por legibilidad: tablas dentro de 17.272 cm, fuente 10.5 pt, encabezados repetidos, filas indivisibles, títulos con tabla siguiente. Se conserva el estilo de la demo pero no sus columnas desbordadas ni fuente 7 pt. Remover línea decorativa de Title. El informe técnico reutiliza estilos y tablas; sus casos se transponen de tres en tres para evitar diez columnas estrechas.
Numeración 3.3.1 a partir de la estructura del documento oficial vigente. Apéndice sin número porque el índice vigente no contiene una secuencia de apéndices. Los números de tablas y figuras corresponden al extracto independiente.
Figuras: espacios explícitos para capturas pendientes, autorizados por la petición actual. Ninguna imagen generada a partir de texto se presentará como captura.
Render: render_docx.py no dispone de LibreOffice. Fallback autorizado de Word COM en instancia oculta, exportación PDF de copia abierta solo lectura, seguido por Poppler e inspección de todas las páginas.
''',encoding='utf-8')
print('Catálogo verificado: 69 casos, 62 Jest, 7 unittest. Evidencias organizadas.')
