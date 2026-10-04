# Pruebas unitarias de validación de usuarios

## A. Resumen de resultados

La revisión inicial volvió a ejecutar los cinco casos existentes de validateLoginFields: los cinco aprobaron. Se agregaron 25 casos para cubrir límites del login y las validaciones locales existentes de registro y perfiles. La ejecución final aprobó 30 casos en dos suites; fallidos: 0; omitidos: 0; pendientes de Jest: 0. Dos casos aprobados reproducen limitaciones conocidas de aceptación de espacios y no acreditan que esos datos sean adecuados. No se declara probado todo el módulo de usuarios.

## B. Herramientas y ejecución

| Nombre | Versión verificada | Función en las pruebas |
|---|---|---|
| Node.js | v24.15.0 | Ejecución de herramientas locales |
| npm | 11.12.1 | Ejecución de herramientas locales |
| jest | 29.7.0 | Ejecutar casos y aserciones |
| jest-expo | 57.0.5 | Preset existente para Expo |
| typescript | 6.0.3 | Comprobación estática adicional |
| expo | 57.0.19 | Entorno de la aplicación |
| react | 19.2.3 | Biblioteca de la aplicación |
| react-native | 0.86.3 | Entorno de interfaz |
| @types/jest | 30.0.0 | Tipos para escribir las pruebas |

Inicio de ejecución final: 2026-09-30T14:10:00.076000-04:00 (America/La_Paz, UTC−04:00).
Commit de referencia: `355b1d9ddb8508f811fa5a9e419eba16eb0919e2`. Había cambios locales antes de esta tarea; el commit por sí solo no representa el código ejecutado. El inventario previo y posterior está en `entorno.json` y hay copias de las funciones, pruebas y configuración en `fuentes/`.

Comando inicial:
```powershell
npm test -- --runInBand --watch=false --verbose --runTestsByPath __tests__/loginValidation.test.ts --json --outputFile=evidencias/pruebas-usuarios/inicial.json
```
Comando final:
```powershell
npm test -- --runInBand --watch=false --verbose --runTestsByPath __tests__/loginValidation.test.ts __tests__/userValidation.test.ts --json --outputFile=evidencias/pruebas-usuarios/final.json
```

Comprobación adicional: `.\node_modules\.bin\tsc.cmd --noEmit --pretty false`, código de salida 0, sin diagnósticos. El archivo `typescript.log` vacío corresponde a esa ejecución sin mensajes. `git diff --check` tampoco detectó errores de espacios; Git mostró avisos de conversión LF/CRLF.

Archivos ejecutados: `__tests__/loginValidation.test.ts` y `__tests__/userValidation.test.ts`. Se mantuvieron las dependencias y la configuración existentes. Las versiones indicadas son las instaladas, no solamente los rangos de package.json.

## C. Casos ejecutados

Para todos los casos: 1) preparar las entradas indicadas; 2) invocar la función; 3) comparar isValid y el mensaje mediante expect. PU-01 a PU-05 conservan sus aserciones originales; los demás usan toEqual sobre el resultado completo. Los nombres originales se corresponden con PU-01 a PU-05 por su orden dentro de loginValidation.test.ts.

Los datos son ficticios. Paciente base: email=paciente@example.test, password=Ficticia123!, fullName=Persona de Prueba, identityCard=TEST-001, phoneNumber=00000000, address=Dirección ficticia, isDoctor=false, selectedSpecialty="", document=null. Médico base: mismos campos con isDoctor=true, selectedSpecialty=especialidad-ficticia y objeto de documento con nombre titulo-ficticio.pdf y URI file:///ficticio.pdf; no se abre ni se sube archivo alguno. Las claves de las cinco pruebas originales también son literales ficticios, no credenciales reales.

| ID | Función | Escenario | Datos ficticios | Pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|---|---|---|---|
| PU-01 | validateLoginFields | Ambos campos vacíos | email="", password="" | Preparar, invocar y comparar | false; mensaje de correo y contraseña | Coincide con las aserciones | Aprobado | final.json y final.log; caso original 1 |
| PU-02 | validateLoginFields | Contraseña vacía | email=correo ficticio, password="" | Preparar, invocar y comparar | false; mensaje de contraseña | Coincide con las aserciones | Aprobado | final.json y final.log; caso original 2 |
| PU-03 | validateLoginFields | Correo vacío | email="", password=clave ficticia | Preparar, invocar y comparar | false; mensaje de correo | Coincide con las aserciones | Aprobado | final.json y final.log; caso original 3 |
| PU-04 | validateLoginFields | Correo de solo espacios | email=cinco espacios, password=clave ficticia | Preparar, invocar y comparar | false; mensaje de correo | Coincide con las aserciones | Aprobado | final.json y final.log; caso original 4 |
| PU-05 | validateLoginFields | Campos completos | email=correo ficticio, password=clave ficticia | Preparar, invocar y comparar | true; sin error | Coincide con las aserciones | Aprobado | final.json y final.log; caso original 5 |
| PU-06 | validateLoginFields | Argumentos undefined | email=undefined, password=undefined | Preparar, invocar y comparar | false; mensaje de correo y contraseña | Coincide con las aserciones | Aprobado | final.json y final.log; PU-06 |
| PU-07 | validateLoginFields | Argumentos null | email=null, password=null | Preparar, invocar y comparar | false; mensaje de correo y contraseña | Coincide con las aserciones | Aprobado | final.json y final.log; PU-07 |
| PU-08 | validateLoginFields | Correo con espacios exteriores | email=" paciente@example.test ", password=clave ficticia | Preparar, invocar y comparar | true; sin error | Coincide con las aserciones | Aprobado | final.json y final.log; PU-08 |
| PU-09 | validateLoginFields | Contraseña de solo espacios | email=correo ficticio, password=tres espacios | Preparar, invocar y comparar | true; sin error; no comprueba autenticación | Coincide con las aserciones | Aprobado | final.json y final.log; PU-09 |
| PU-10 | validateRegistrationFields | Campo común vacío: email | Paciente base con email="" | Preparar, invocar y comparar | false; mensaje de campos comunes | Coincide con las aserciones | Aprobado | final.json y final.log; PU-10 |
| PU-11 | validateRegistrationFields | Campo común vacío: password | Paciente base con password="" | Preparar, invocar y comparar | false; mensaje de campos comunes | Coincide con las aserciones | Aprobado | final.json y final.log; PU-11 |
| PU-12 | validateRegistrationFields | Campo común vacío: fullName | Paciente base con fullName="" | Preparar, invocar y comparar | false; mensaje de campos comunes | Coincide con las aserciones | Aprobado | final.json y final.log; PU-12 |
| PU-13 | validateRegistrationFields | Campo común vacío: identityCard | Paciente base con identityCard="" | Preparar, invocar y comparar | false; mensaje de campos comunes | Coincide con las aserciones | Aprobado | final.json y final.log; PU-13 |
| PU-14 | validateRegistrationFields | Campo común vacío: phoneNumber | Paciente base con phoneNumber="" | Preparar, invocar y comparar | false; mensaje de campos comunes | Coincide con las aserciones | Aprobado | final.json y final.log; PU-14 |
| PU-15 | validateRegistrationFields | Campo común vacío: address | Paciente base con address="" | Preparar, invocar y comparar | false; mensaje de campos comunes | Coincide con las aserciones | Aprobado | final.json y final.log; PU-15 |
| PU-16 | validateRegistrationFields | Paciente completo | Paciente base sin especialidad ni documento | Preparar, invocar y comparar | true; sin error | Coincide con las aserciones | Aprobado | final.json y final.log; PU-16 |
| PU-17 | validateRegistrationFields | Médico sin especialidad | Médico base con selectedSpecialty="" | Preparar, invocar y comparar | false; mensaje de especialidad y título | Coincide con las aserciones | Aprobado | final.json y final.log; PU-17 |
| PU-18 | validateRegistrationFields | Médico sin documento | Médico base con document=null | Preparar, invocar y comparar | false; mensaje de especialidad y título | Coincide con las aserciones | Aprobado | final.json y final.log; PU-18 |
| PU-19 | validateRegistrationFields | Médico completo | Médico base | Preparar, invocar y comparar | true; sin error | Coincide con las aserciones | Aprobado | final.json y final.log; PU-19 |
| PU-20 | validateRegistrationFields | Prioridad del mensaje común | Médico base con email="" y document=null | Preparar, invocar y comparar | false; mensaje de campos comunes | Coincide con las aserciones | Aprobado | final.json y final.log; PU-20 |
| PU-21 | validateRegistrationFields | Caracterización: nombre de solo espacios | Paciente base con fullName=tres espacios | Preparar, invocar y comparar | true; reproduce limitación H-01 | Coincide con las aserciones | Aprobado | final.json y final.log; PU-21 |
| PU-22 | validatePatientProfileFields | Teléfono vacío | phoneNumber="", address=dirección ficticia | Preparar, invocar y comparar | false; mensaje de teléfono y dirección | Coincide con las aserciones | Aprobado | final.json y final.log; PU-22 |
| PU-23 | validatePatientProfileFields | Dirección vacía | phoneNumber="00000000", address="" | Preparar, invocar y comparar | false; mensaje de teléfono y dirección | Coincide con las aserciones | Aprobado | final.json y final.log; PU-23 |
| PU-24 | validatePatientProfileFields | Campos completos | phoneNumber="00000000", address=dirección ficticia | Preparar, invocar y comparar | true; sin error | Coincide con las aserciones | Aprobado | final.json y final.log; PU-24 |
| PU-25 | validatePatientProfileFields | Caracterización: campos de solo espacios | phoneNumber=tres espacios, address=tres espacios | Preparar, invocar y comparar | true; reproduce limitación H-02 | Coincide con las aserciones | Aprobado | final.json y final.log; PU-25 |
| PU-26 | validateDoctorProfileFields | Nombre vacío | fullName="", phoneNumber="00000000" | Preparar, invocar y comparar | false; mensaje de nombre y celular | Coincide con las aserciones | Aprobado | final.json y final.log; PU-26 |
| PU-27 | validateDoctorProfileFields | Celular vacío | fullName="Médico de Prueba", phoneNumber="" | Preparar, invocar y comparar | false; mensaje de nombre y celular | Coincide con las aserciones | Aprobado | final.json y final.log; PU-27 |
| PU-28 | validateDoctorProfileFields | Nombre de solo espacios | fullName=tres espacios, phoneNumber="00000000" | Preparar, invocar y comparar | false; mensaje de nombre y celular | Coincide con las aserciones | Aprobado | final.json y final.log; PU-28 |
| PU-29 | validateDoctorProfileFields | Celular de solo espacios | fullName="Médico de Prueba", phoneNumber=tres espacios | Preparar, invocar y comparar | false; mensaje de nombre y celular | Coincide con las aserciones | Aprobado | final.json y final.log; PU-29 |
| PU-30 | validateDoctorProfileFields | Campos completos con espacios exteriores | fullName=" Médico de Prueba ", phoneNumber=" 00000000 " | Preparar, invocar y comparar | true; sin error | Coincide con las aserciones | Aprobado | final.json y final.log; PU-30 |

## D. Texto para el Capítulo III

### Pruebas unitarias de validación de usuarios

Se realizaron pruebas unitarias sobre cuatro funciones de validación de entradas utilizadas por las pantallas de inicio de sesión, registro y edición de perfiles. Se emplearon Jest 29.7.0 y el preset jest-expo 57.0.5 en Node.js 24.15.0. Las reglas de registro y perfiles se separaron de sus componentes sin alterar sus condiciones ni mensajes. Las pruebas invocaron estas funciones con datos ficticios, sin realizar solicitudes a Supabase ni a servicios externos.

La ejecución registró 30 pruebas aprobadas en dos suites, sin casos fallidos ni omitidos. Dos pruebas caracterizan la aceptación de entradas compuestas por espacios en registro y perfil de paciente; por ello, el resultado de Jest no implica ausencia de deficiencias funcionales. Estas pruebas no evalúan autenticación, persistencia ni recorridos de interfaz.

Tabla. Resumen de pruebas unitarias de validación de usuarios. La numeración final de la tabla debe ajustarse a la secuencia del Capítulo III.

| Elemento | Descripción |
|---|---|
| Objetivo | Verificar las reglas locales existentes de campos obligatorios en login, registro y perfiles. |
| Acción | Ejecutar con Jest dos suites que contienen 30 casos sobre cuatro funciones utilizadas por la aplicación. |
| Efecto | Los 30 casos coincidieron con sus expectativas. Se documentaron dos limitaciones relacionadas con espacios. El detalle y las evidencias corresponden al apéndice de pruebas unitarias. |

Fuente: elaboración propia con base en la ejecución registrada.

## E. Texto para el apéndice de pruebas unitarias

Las pruebas se ejecutaron de forma aislada sobre validateLoginFields, validateRegistrationFields, validatePatientProfileFields y validateDoctorProfileFields. Cada caso contiene el escenario, las entradas, los pasos, el resultado esperado y el resultado obtenido. La tabla del apartado C constituye el detalle de casos para este apéndice; los datos del apartado B identifican el entorno de ejecución.

La estructura se adapta del modelo RUP 2: página impresa 147 (página física 180) para Objetivo/Acción/Efecto y página impresa 184 (página física 217) para los casos del Apéndice N.º 3. El ejemplo incluye recorridos funcionales de interfaz; aquí se documentan pruebas unitarias de funciones aisladas. No se trasladan sus resultados, módulos ni cifras. La numeración definitiva del apéndice debe concordar con el índice del Word del proyecto.

Referencia vigente del proyecto: Documento_Oficial_V2 (5).docx, que reemplaza al archivo anterior. Se conserva el Capítulo III. Ninguna afirmación de pruebas previas del Word se utilizó como evidencia de esta ejecución.

Capturas pendientes de realizar con el usuario. No hay capturas generadas en esta entrega. Los archivos .log y .json son evidencia de ejecución, no imágenes ni snapshot tests. Pies de figura propuestos:

1. Versiones verificadas de las herramientas y configuración de Jest utilizada para las pruebas unitarias.
2. Función de validación del inicio de sesión y su utilización antes de la autenticación.
3. Casos automatizados de validación de usuarios y comprobaciones de resultados.
4. Ejecución de las pruebas unitarias con Jest y resumen de resultados.

## F. Cambios, hallazgos y límites

Archivos nuevos: utils/userValidation.ts, __tests__/userValidation.test.ts y esta carpeta de evidencias. Archivos modificados: app/register.tsx, app/(patient)/profile.tsx y app/(doctor)/profile.tsx, para usar las funciones extraídas. Se preservaron los cinco casos originales, utils/validation.ts y los cambios locales preexistentes. No se modificaron los documentos de referencia.

### H-01: registro admite nombre compuesto por espacios

La condición original de app/register.tsx evaluaba !fullName, sin trim(). PU-21 reproduce que tres espacios generan isValid=true. La extracción conserva esa condición. Es una limitación confirmada de la validación local; no se intentó registrar datos en Supabase. Propuesta pendiente: acordar y aplicar rechazo de espacios en campos textuales obligatorios, conservando la contraseña sin trim, y agregar pruebas de la regla corregida.

### H-02: perfil de paciente admite teléfono y dirección compuestos por espacios

La condición original evaluaba !phoneNumber y !address. PU-25 reproduce isValid=true para tres espacios en ambos campos. Propuesta pendiente: aplicar trim únicamente para comprobar la presencia de estos datos y verificar la regla corregida. No se modificó ese comportamiento en esta tarea.

PU-21 y PU-25 son pruebas de caracterización: aprobar significa reproducir el comportamiento actual, no aprobar la calidad del dato. No se cambiaron expectativas tras un fallo para ocultarlo.

Otras validaciones identificadas mediante lectura: especialidad obligatoria antes de aprobar un médico y motivo obligatorio de rechazo en el panel administrativo; consultas de correo y CI existentes al registrar; estado de aprobación del médico durante el login. No fueron ejecutadas en esta tanda.

No ejecutado: autenticación real, autorización por rol, aprobación administrativa, duplicados en Supabase, carga de documentos, guardado de perfiles, interfaz, cierre de sesión, disponibilidad médica y otros módulos. El fallo de disponibilidad informado por el usuario no se declara resuelto. Existe código de reportes, pero no se probó. Pagos siguen identificados como simulados. Postman, JMeter, SUS, compatibilidad, seguridad y calidad clínica quedan fuera del alcance.

No hay casos bloqueados dentro de las dos suites ejecutadas. Las comprobaciones fuera de alcance están no ejecutadas, no omitidas por Jest.

## Guía de capturas

Empezar por la captura 1 y esperar la confirmación «listo» antes de preparar la siguiente. En la terminal integrada, situada en la raíz del proyecto, ejecutar:

```powershell
node --version
npm --version
node -e "for (const n of ['jest','jest-expo','typescript','expo']) console.log(n + ': ' + require(n+'/package.json').version)"
Get-Content jest.config.js
```

Debe verse el comando, las versiones y la configuración. Dividir en dos imágenes si la letra queda pequeña. Pie: «Versiones verificadas de las herramientas y configuración de Jest utilizada para las pruebas unitarias». No abrir archivos .env.

La captura posterior de resultados puede repetirse sin sobrescribir la evidencia conservada con:
```powershell
npm test -- --runInBand --watch=false --verbose --runTestsByPath __tests__/loginValidation.test.ts __tests__/userValidation.test.ts
```

Si se repite la ejecución, sus tiempos pueden variar. Conservar los nombres y el resumen; dividir la salida en imágenes consecutivas si es necesario.
