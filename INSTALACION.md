# Instalación para D'chelis

## Producción en Render + PostgreSQL

1. El servidor Node.js se ejecuta como **Web Service** en Render.
2. La base de datos se guarda en **Render PostgreSQL** mediante la variable de entorno `DATABASE_URL`.
3. En Render, configura `DATABASE_URL` con la **Internal Database URL** de tu PostgreSQL.
4. Ejecuta el servicio con:

   ```bash
   npm start
   ```

5. No copies ni dependas de `dchelis.db`: la persistencia de pedidos, productos, fórmulas e inventario está en PostgreSQL.

## Desarrollo local

1. Instala **Node.js LTS**.
2. Ejecuta `npm install`.
3. Define `DATABASE_URL` apuntando a una base PostgreSQL de desarrollo.
4. Ejecuta `npm start`.
5. Abre `http://localhost:3000`.

## Frontend público

GitHub Pages solo publica archivos estáticos. Para registrar pedidos, la interfaz debe apuntar al servidor Node mediante `public/config.js`:

```js
window.DCHELIS_API_URL = 'https://tu-servicio.onrender.com';
```

## Pago por Yape

El sistema registra el número de operación que el cliente escribe y deja el pedido como **pendiente de verificación**. Yape no ofrece, en este proyecto, una confirmación automática de pagos. No se debe marcar un pago como confirmado hasta comprobarlo en la app de Yape. El cliente puede pagar un adelanto y el panel muestra el saldo pendiente.
