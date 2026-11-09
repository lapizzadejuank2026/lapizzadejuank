# La Pizza de Juan K — continuidad del trabajo

**Cierre:** lunes 9 de noviembre de 2026 (Colombia)
**Retomar:** martes 10 de noviembre de 2026
**Repositorio:** `lapizzadejuank2026/lapizzadejuank` (rama `main`)
**Aplicación:** https://lapizzadejuank2026.github.io/lapizzadejuank/

## Estado al cerrar

- El usuario confirmó que el centro de control abre desde Chrome y que **Pedidos** muestra la alarma activada y el estado sin pedidos nuevos cuando corresponde. El funcionamiento real de una nueva alarma después de los últimos cambios no se volvió a probar aquí.
- Las pestañas **Pedidos** y **Productos** están integradas en `panel-pedidos.html`, con `admin-productos.html` como módulo editor. Se corrigieron problemas de carga/ingreso de Productos durante la sesión.
- Se actualizó `admin-productos.html` para que **cada tamaño de pizza (Personal, Small, Mediana, Familiar) tenga los botones «Editar» y «Guardar cambios» propios** y que cada sabor también pueda editarse y guardarse individualmente. Los productos adicionales, como hamburguesas, mantienen su edición independiente.
- El usuario **abrió la interfaz actualizada y confirmó que quedó a su gusto**. La publicación en GitHub Pages de estos cambios se verificó como exitosa.
- Código publicado: `admin-productos.html` commit `85740e90e7fb92a3317cd961af9023fef16f91f8`; ajuste de enlace del panel `dc6dae8c503ee0f765752b9151abc15bcca8603c`. El panel mantiene la lógica de recepción/alarma; la funcionalidad debe probarse con un pedido de prueba cuando sea oportuno.
- No se hicieron cambios intencionales a Firestore ni a contraseñas en el último ajuste. Firebase proyecto: `pizzadejuank`, colección `pedidos`, colección `productos`.

## Fotografías: pendiente importante

- El usuario puede seleccionar JPG/PNG/WEBP en los formularios, pero la **subida directa a Firebase Storage falló**. Según la conversación, la consola mostraba «Actualizar proyecto» y se prefirió no activar facturación.
- Se acordó evaluar como alternativa guardar fotografías de menú en el repositorio GitHub y usar URLs HTTPS de GitHub Pages en la casilla «Enlace de fotografía», seguido de «Guardar cambios» en cada producto.
- Hay una imagen inicial JPG ya cargada en la raíz del repositorio; conviene organizar nuevas fotos en una carpeta `fotos/`. **No afirmar que la carga de archivos está funcionando** hasta probar una foto y verla en el menú de clientes.
- Evitar alterar reglas de Firebase o activar servicios de pago sin acuerdo.

## Próximos pasos sugeridos

1. Probar la edición de una pizza de forma individual con un cambio inocuo y comprobar que se guarda en Firestore y se refleja en el menú del cliente; revisar si el menú usa los mismos documentos para tamaños y sabores.
2. Subir **una** foto al repositorio (idealmente en `fotos/`), confirmar su URL pública de GitHub Pages y pegarla en el editor; comprobar visualización real.
3. Revisar las tarjetas de hamburguesas y bebidas con imágenes y edición sin tocar la recepción.
4. Hacer pedido de prueba para confirmar recepción, contador y alarma tras cambios recientes.
5. Más adelante: planificar una plataforma multinegocio/multiperfil con aislamiento seguro de datos por restaurante. **No construir esto antes de cerrar las pruebas del negocio actual**.

## Precaución

No alterar nuevamente la autenticación ni la alarma del panel de Pedidos sin respaldo y prueba, pues hubo regresiones de acceso durante esta sesión. No guardar contraseñas o tokens en este archivo.
