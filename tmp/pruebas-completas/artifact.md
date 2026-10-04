# Contrato de la plantilla

Referencia: Demo_pruebas_unitarias_RUP2_documento_completo.docx, hash en evidencias/pruebas-completas/referencias.json.
Páginas 1 a 9 revisadas visualmente. Modelo RUP 2: página impresa 147 (física 180) y 184 (física 217) revisadas visualmente.
Se parte de una copia DOCX. Conservar tamaño carta, márgenes 2.159 cm laterales y 1.905 cm verticales, estilos Arial, jerarquía y encabezados de tabla rosados E8B8B8 y bordes B7B7B7.
Slots editables: portada, párrafos del capítulo, dos tablas, figuras, secciones y tablas por caso de uso del apéndice. Eliminar ejemplos no ejecutados, duplicación de perfiles, conclusión de demo y página vacía residual. Clonar estos patrones para los casos reales.
Adaptaciones autorizadas por legibilidad: tablas dentro de 17.272 cm, fuente 10.5 pt, encabezados repetidos, filas indivisibles, títulos con tabla siguiente. Se conserva el estilo de la demo pero no sus columnas desbordadas ni fuente 7 pt. Remover línea decorativa de Title. El informe técnico reutiliza estilos y tablas; sus casos se transponen de tres en tres para evitar diez columnas estrechas.
Numeración 3.3.1 a partir de la estructura del documento oficial vigente. Apéndice sin número porque el índice vigente no contiene una secuencia de apéndices. Los números de tablas y figuras corresponden al extracto independiente.
Figuras: espacios explícitos para capturas pendientes, autorizados por la petición actual. Ninguna imagen generada a partir de texto se presentará como captura.
Render: render_docx.py no dispone de LibreOffice. Fallback autorizado de Word COM en instancia oculta, exportación PDF de copia abierta solo lectura, seguido por Poppler e inspección de todas las páginas.
