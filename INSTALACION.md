# Instalación para D'chelis

## Opción recomendada para la presentación: instalar en la PC

1. Instala **Node.js LTS** en la PC del cliente.
2. Copia esta carpeta completa, incluyendo `dchelis.db`.
3. Abre una terminal dentro de la carpeta y ejecuta:

   ```bash
   npm install
   npm start
   ```

4. Abre `http://localhost:3000` en el navegador. El catálogo, los pedidos, la cocina, el inventario y la página de colaboradores quedarán conectados a la base de datos local de esa PC.
5. Para que otros dispositivos de la misma red vean los pedidos, abre `http://IP-DE-LA-PC:3000/colaboradores.html`. Permite Node.js en el firewall privado de Windows si este lo solicita.

## GitHub Pages

GitHub Pages solo publica archivos estáticos: **no puede ejecutar `server.js` ni guardar pedidos en SQLite**. Por eso un sitio publicado únicamente allí no puede registrar pedidos ni compartirlos con producción.

Para conservar la web pública en GitHub Pages, instala este servidor Node en una PC que permanezca encendida o en un hosting que soporte Node.js y SQLite, habilita una URL HTTPS para él y escribe esa URL en `public/config.js`:

```js
window.DCHELIS_API_URL = 'https://pedidos.tudominio.com';
```

Después vuelve a publicar los archivos de `public/` en GitHub Pages. La URL se usa para registrar pedidos y para la página `colaboradores.html`.

## Pago por Yape

El sistema registra el número de operación que el cliente escribe y deja el pedido como **pendiente de verificación**. Yape no ofrece, en este proyecto, una confirmación automática de pagos. No se debe marcar un pago como confirmado hasta comprobarlo en la app de Yape. El cliente puede pagar un adelanto y el panel muestra el saldo pendiente.
