# ZoriApp 2026 — Matriz de aceptación móvil

**Alcance:** interfaz clara, orientación, formulario, OCR, colas offline y PWA. Versión de prueba independiente de `main`; no hacer escrituras de prueba en la base de pacientes real.

## Dispositivos y anchos
| Perfil | Viewport CSS aproximado | Revisión |
|---|---:|---|
| Android compacto | 320 × 568 | Formulario y navegación, sin scroll global horizontal |
| Android habitual | 360 × 740 | Dos columnas o una según el breakpoint, sin botones cortados |
| iPhone X | 375 × 812 | Notch, barra inferior, teclado, Safari y PWA |
| Android actual | 390 × 844 | Registro, OCR, búsqueda y tablas |
| iPhone 11 | 414 × 896 | Navegación fija, foco en campos y entrada de textos |
| Android grande | 430 × 932 | Tarjetas y banner institucional |
| iPad / tableta | 768 × 1024 | Menús, formularios y estadísticas |
| Horizontal | altura < 480 | Menú Más desplazable y botones accesibles |

## Criterios para APROBADO
1. No hay scroll horizontal en el documento al abrir Inicio, Registrar, Pacientes, detalle, Laboratorio, Tacto, Mini Jornada y Dashboard.
2. Ningún texto, flecha o botón se sale de su tarjeta; solo las tablas pueden desplazarse horizontalmente dentro de su contenedor.
3. Barra de navegación inferior no tapa botones ni controles, incluso con home indicator de iPhone X/11.
4. Al enfocar teléfono, correo, cédula y nombre, Safari no cambia inesperadamente el zoom.
5. El logo ORIGINAL de Zoriak está visible sobre azul, Prosilod mantiene empaque original, hospital usa fotografía institucional enviada por el equipo.
6. La pantalla de acceso, la de registro y los módulos clínicos tienen superficies claras y texto con contraste suficiente.
7. Al escribir 'María Elena García Pérez' se conservan espacios. Cerrar teclado no elimina ni concatena términos.
8. El menú Más abre, se desplaza, se cierra y no se oculta detrás de la barra inferior.
9. Sin internet, luego de preparar el equipo, el motor OCR y la vista de registro cargan correctamente. **No guardar fichas de prueba conectadas a Firebase real**.
10. No borrar datos del sitio, caché completa ni reinstalar una PWA con fichas pendientes: verificar sincronización y acceso en producción previamente.
11. La nueva PWA de producción se instala siempre desde el dominio definitivo. No mezclar almacenamiento de previews (otro origen) con producción.
12. La administración debe auditar permisos de Firestore por roles antes de habilitar registros clínicos masivos.

## Limitaciones conocidas
- Los tests automáticos Vercel/Node NO constituyen pruebas funcionales en dispositivos físicos o con VoiceOver.
- Para probar escritura y sincronización end-to-end debe conectarse un entorno de prueba Firebase separado. No escribir registros ficticios en la colección de producción.
- iOS muy antiguo puede carecer de WebCrypto o Service Workers; el sistema debe informar falta de soporte y nunca guardar registros sin cifrado.
