Explora los archivos de tu servidor FTP y automatiza las transferencias desde Homey. Guarda capturas de cámaras, envía informes a tu NAS o pon archivos de audio a disposición de un reproductor compatible.

• Gestiona archivos desde Homey: sube y descarga archivos, crea carpetas y cambia el nombre, mueve o elimina archivos y carpetas.
• Automatiza con Flow: guarda imágenes o archivos codificados en base64, obtén listas de archivos en JSON, carga imágenes en tus Flows o crea un enlace de descarga temporal.
• Guarda archivos desde URL: transfiere descargas HTTP, HTTPS o FTP a tu servidor, incluidos los enlaces de exportación de Simple (Sys) Log, sin pasar el archivo por un token de Flow.
• Compatibilidad con Simple (Sys) Log: guarda exportaciones CSV, Excel o JSON con la tarjeta de exportación dedicada, o conecta su tarjeta de URL de exportación a «Guardar un archivo desde una URL» para registros grandes.
• Supervisa la conexión: Homey comprueba automáticamente la carpeta configurada. Activa Flows cuando el servidor FTP deje de estar disponible, vuelva a estarlo o falle una transferencia.

Añade un dispositivo de tipo «Conexión FTP» e introduce los datos del servidor. Al emparejarlo, Homey prueba primero FTP seguro (FTPS) y, si es necesario, recurre a FTP sin cifrar. Si eliges una carpeta de inicio, la navegación y las operaciones con archivos en Flow se limitan a ella. Abre la pantalla de reparación del dispositivo para explorar tus archivos en la app Homey o en la app web.

Funciona con servidores FTP, incluido Micro Web Server.

Requiere la app Better Logic Library. Los campos de texto de nombre de archivo y ruta admiten código BLL. Consulta los ajustes de la app Better Logic Library para aprender a usar el código BLL.

Para más información, consulta el tema de esta app en el foro de la comunidad de Homey.
Para acceder a la wiki y al manual de usuario de FTP Client, selecciona «Visitar el sitio web» en «Sitio web del desarrollador» en la página de esta app en la Homey App Store.
