# Comprobación de usuarios y perfiles en Supabase

Preparado el 4 de octubre de 2026. Estas consultas no se han ejecutado contra tu proyecto. Son consultas de metadatos: no leen filas de pacientes, médicos, perfiles, cuentas ni archivos. No crean ni modifican objetos. El archivo es una guía independiente, no una migración.

## Cómo obtener la información

1. Abre https://supabase.com/dashboard y selecciona el proyecto utilizado por esta aplicación. Comprueba tú mismo que corresponde al proyecto configurado localmente; no compartas `.env`, claves ni cadenas de conexión.
2. En el menú del proyecto, abre **SQL Editor** y **New query**. Usa la conexión administrativa habitual del editor, sin cambiar permisos ni impersonar cuentas.
3. Copia y ejecuta **un bloque numerado cada vez**. Todos son `SELECT` sobre catálogos o sobre la configuración del bucket. No ejecutes el código de funciones que aparezca como resultado.
4. Exporta cada resultado como CSV o copia la tabla completa. Nómbralos `usuarios_Q01.csv`, `usuarios_Q02.csv`, etc. Para Q04 guarda también Q04b. Comparte el texto exacto de cualquier error, retirando información sensible. Un error o un resultado vacío no se interpretará automáticamente como configuración ausente.
5. Antes de compartir, revisa si alguna definición contiene un correo, UUID personal, URL firmada, token o secreto escrito literalmente. Sustituye ese literal por `[REDACTADO]`, conservando la estructura. No envíes filas de Table Editor, Authentication > Users ni el listado de archivos del bucket.

**Límite importante:** que una consulta administrativa funcione no demuestra que un paciente pueda hacer esa operación. Los permisos efectivos dependen de privilegios, políticas, funciones auxiliares, triggers y sesión. Esta etapa describe configuración; no ejecuta pruebas con usuarios reales.

## Q01. Tablas, columnas, tipos, obligatoriedad, valores predeterminados y enums

Incluye el estado de RLS. Una tabla ausente aparece expresamente, sin consultar sus datos.

```sql
WITH nombres(nombre) AS (
  VALUES ('profiles'), ('patients'), ('doctors'), ('specialties')
)
SELECT n.nombre AS tabla,
       c.oid IS NOT NULL AS encontrada,
       c.relkind AS clase_objeto,
       c.relrowsecurity AS rls_habilitado,
       c.relforcerowsecurity AS rls_forzado,
       a.attnum AS orden,
       a.attname AS columna,
       format_type(a.atttypid, a.atttypmod) AS tipo,
       (a.attnotnull OR t.typnotnull) AS obligatoria,
       COALESCE(pg_get_expr(d.adbin, d.adrelid), t.typdefault) AS valor_predeterminado,
       a.attidentity AS identidad,
       a.attgenerated AS generada,
       (SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
        FROM pg_enum e
        WHERE e.enumtypid = CASE WHEN t.typtype = 'd' THEN t.typbasetype ELSE t.oid END
       ) AS valores_enum
FROM nombres n
LEFT JOIN pg_namespace ns ON ns.nspname = 'public'
LEFT JOIN pg_class c ON c.relnamespace = ns.oid AND c.relname = n.nombre
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_type t ON t.oid = a.atttypid
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
ORDER BY n.nombre, a.attnum;
```

Compararemos estos campos usados por el cliente:

| Tabla | Campos esperados por los flujos revisados |
| --- | --- |
| profiles | id, full_name, email, identity_card, phone_number, address, gender, role |
| patients | id, blood_type, allergies, emergency_contact |
| doctors | id, specialty_id, title_document_url, license_number, is_active, rejection_reason |
| specialties | id, name |

El cliente usa el mismo ID de Auth para el perfil y la ficha de paciente/médico. Esto es una expectativa del cliente, no una relación confirmada todavía. Los joins `doctors → profiles` y `doctors → specialties` necesitan relaciones reconocibles por la API. `upsert({id: ...})` presupone una clave de conflicto adecuada. Para insertar una especialidad enviando solo `name`, `id` debe generarse de forma compatible.

## Q02. Restricciones y relaciones

Incluye claves primarias, únicas, checks, claves foráneas y sus reglas de borrado. Incluye restricciones de dominios utilizados por estas columnas.

```sql
WITH objetivo AS (
  SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('profiles','patients','doctors','specialties')
), dominios AS (
  SELECT DISTINCT a.atttypid FROM pg_attribute a JOIN objetivo o ON o.oid = a.attrelid
  WHERE a.attnum > 0 AND NOT a.attisdropped
)
SELECT CASE WHEN con.conrelid <> 0 THEN con.conrelid::regclass::text
            ELSE con.contypid::regtype::text END AS objeto,
       con.conname AS restriccion, con.contype AS tipo,
       con.convalidated AS validada,
       pg_get_constraintdef(con.oid, true) AS definicion
FROM pg_constraint con
WHERE con.conrelid IN (SELECT oid FROM objetivo)
   OR con.confrelid IN (SELECT oid FROM objetivo)
   OR con.contypid IN (SELECT atttypid FROM dominios)
ORDER BY objeto, restriccion;
```

Necesitamos distinguir duplicados de correo, CI, matrícula y nombre de especialidad; las búsquedas previas del formulario no sustituyen restricciones frente a altas simultáneas. No se consulta si hay duplicados reales ni se comparten cuentas.

## Q03. Índices, incluida unicidad por expresiones

```sql
SELECT ns.nspname AS esquema, tb.relname AS tabla,
       ix.relname AS indice, i.indisunique AS unico,
       i.indisvalid AS valido, pg_get_indexdef(i.indexrelid) AS definicion
FROM pg_index i
JOIN pg_class tb ON tb.oid = i.indrelid
JOIN pg_class ix ON ix.oid = i.indexrelid
JOIN pg_namespace ns ON ns.oid = tb.relnamespace
WHERE ns.nspname = 'public'
  AND tb.relname IN ('profiles','patients','doctors','specialties')
ORDER BY tabla, indice;
```

Permite comprobar si la unicidad depende de mayúsculas, espacios o un índice parcial. No se asume que la base normalice datos porque el cliente normalice el correo.

## Q04. Políticas RLS de tablas y documentos

Se incluyen todas las políticas de `storage.objects`: una política general puede afectar al bucket aunque no lo nombre literalmente.

```sql
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual AS condicion_lectura_filas,
       with_check AS condicion_escritura
FROM pg_policies
WHERE (schemaname = 'public'
       AND tablename IN ('profiles','patients','doctors','specialties'))
   OR (schemaname = 'storage' AND tablename IN ('objects','buckets'))
ORDER BY schemaname, tablename, policyname;
```

Q04b comprueba RLS en las tablas de Storage sin leer sus filas:

```sql
SELECT n.nspname AS esquema, c.relname AS tabla,
       c.relrowsecurity AS rls_habilitado,
       c.relforcerowsecurity AS rls_forzado
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage' AND c.relname IN ('objects','buckets');
```

Si aparecen funciones propias como `is_admin()` o similares en las condiciones, necesitamos su definición para interpretar la política. En **Database > Functions**, localiza solo esas funciones y copia su definición, sin editarlas ni ejecutarlas. Retira posibles literales sensibles. No presupongas que su nombre demuestra que comprueban correctamente el rol.

## Q05. Privilegios efectivos de las conexiones anon y authenticated

Paciente, médico y administrador son roles de la aplicación. Normalmente todos entran como `authenticated` en PostgreSQL; las políticas deben distinguirlos. Esta consulta comprueba privilegios de esquema, tabla y columna, pero NO evalúa las condiciones RLS con identidades concretas.

```sql
SELECT r.rolname AS rol_conexion, n.nspname AS esquema, c.relname AS tabla,
       a.attname AS columna,
       has_schema_privilege(r.oid, n.oid, 'USAGE') AS uso_esquema,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS select_tabla,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS insert_tabla,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS update_tabla,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS delete_tabla,
       has_column_privilege(r.oid, c.oid, a.attnum, 'SELECT') AS select_columna,
       has_column_privilege(r.oid, c.oid, a.attnum, 'INSERT') AS insert_columna,
       has_column_privilege(r.oid, c.oid, a.attnum, 'UPDATE') AS update_columna
FROM pg_roles r
CROSS JOIN pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE r.rolname IN ('anon','authenticated')
  AND ((n.nspname = 'public' AND c.relname IN ('profiles','patients','doctors','specialties'))
    OR (n.nspname = 'storage' AND c.relname = 'objects'))
ORDER BY r.rolname, esquema, tabla, a.attnum;
```

En particular revisaremos que editar contacto no permita elevar `profiles.role`, que un médico no se apruebe a sí mismo y que un paciente no modifique otro perfil. Son comprobaciones pendientes, no permisos inseguros confirmados.

## Q06. Triggers y funciones de creación/actualización

Consulta solo definiciones. `auth.users` se usa como nombre de objeto en los catálogos; no se leen sus filas. `pg_get_functiondef` devuelve texto y no ejecuta la función.

```sql
SELECT ns.nspname AS esquema, c.relname AS tabla,
       t.tgname AS trigger, t.tgenabled AS habilitacion,
       pg_get_triggerdef(t.oid, true) AS definicion_trigger,
       fn.nspname AS esquema_funcion, p.proname AS funcion,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       p.prosecdef AS security_definer, p.proconfig AS configuracion_funcion,
       pg_get_functiondef(p.oid) AS definicion_funcion
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace ns ON ns.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace fn ON fn.oid = p.pronamespace
WHERE NOT t.tgisinternal
  AND ((ns.nspname = 'auth' AND c.relname = 'users')
    OR (ns.nspname = 'public' AND c.relname IN ('profiles','patients','doctors','specialties')))
ORDER BY esquema, tabla, trigger;
```

Si una función llama a otra función propia que participa en el registro o permisos, comparte también esa definición desde Database > Functions, tras retirar secretos. Para funciones auxiliares de RLS anota también `SECURITY DEFINER/INVOKER`, `search_path` y los permisos EXECUTE mostrados en su configuración; sin ellos el análisis queda parcial.

Esto permite comprobar si Auth ya crea un perfil, con qué valores y si también crea la ficha del médico. El cliente actual no envía `options.data` al `signUp`; un trigger que dependa de esos metadatos podría no recibirlos. Si un trigger ya inserta `doctors`, la inserción posterior del cliente podría chocar con la clave primaria. Son hipótesis por contrastar, no fallos de tu base confirmados.

## Q07. Configuración del bucket médico

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'doctor_documents';
```

No consultes `storage.objects` para compartir listados de documentos. La consulta solo devuelve configuración del bucket esperado. Si una columna no existe en tu versión, comparte el error y revisa **Storage > doctor_documents > configuración del bucket**: público/privado, límite de tamaño y tipos permitidos. No cambies nada.

El registro guarda los archivos en la raíz con patrón `<id-usuario>-<marca-tiempo>.<extensión>`, no en una carpeta `<id-usuario>/`. Las políticas deben ser compatibles con ese patrón. El cliente genera una URL pública y el administrador la abre en iframe/WebView. Si el bucket es privado, ese mecanismo no basta; si es público, conocer la URL permite leer el archivo. Que exista una URL no prueba que la subida o descarga funcione.

## Q08. Ajustes Auth que debes describir, sin SQL ni datos de cuentas

Abre **Authentication > Sign In / Providers > Email** (en algunas versiones, **Providers > Email**) y anota los valores, sin cambiarlos:

- Proveedor Email habilitado: sí/no.
- Permitir nuevos registros: sí/no (puede aparecer en la configuración general de Sign In).
- Confirm email: sí/no.
- Longitud mínima y reglas de contraseña, sin escribir una contraseña.
- Si hay hooks de autenticación personalizados, indica su tipo y nombre; no compartas secretos ni cabeceras.

En **Authentication > URL Configuration**, indica si hay Site URL y rutas de retorno para web/móvil y si corresponden a desarrollo o producción. No envíes enlaces de confirmación recibidos ni URLs con tokens. Para este diagnóstico basta describir los destinos, no publicar dominios privados.

Confirmar correo puede hacer que `signUp` devuelva usuario sin sesión. El cliente actual comprueba `authData.user.id`, pero no `authData.session`, y continúa escribiendo perfiles y documentos. Eso requiere contrastar Auth, trigger y RLS juntos; no se recomienda desactivar confirmación ni abrir permisos para sortearlo.

## Resultado que debes compartir

Envía Q01, Q02, Q03, Q04, Q04b, Q05, Q06 y Q07, más las respuestas de Q08. Incluye fecha y un alias del proyecto, por ejemplo «telemedicina-desarrollo», y confirma que es el usado por la aplicación. Si no tienes permisos para un bloque, anótalo y comparte los demás.

La primera entrega útil es Q01 + Q02 + Q06 + «Confirm email: sí/no»: aclara la creación del perfil y las fichas. Q03–Q05 y Q07 permiten después cerrar duplicados, permisos y documentos. No necesitas crear cuentas ni probar registros reales para obtener este inventario.

## Referencias técnicas

- [Creación de usuarios y sesión en signUp](https://supabase.com/docs/reference/javascript/auth-signup).
- [Perfiles y triggers de Auth](https://supabase.com/docs/guides/auth/managing-user-data).
- [Políticas de acceso por fila](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Buckets públicos y privados](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- [Descarga de archivos privados](https://supabase.com/docs/guides/storage/serving/downloads).
