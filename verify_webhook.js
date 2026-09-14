const http = require('http');
const { URL } = require('url');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL('http://localhost:3000' + path);
    const payload = body ? Buffer.from(body) : null;
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (payload) options.headers['Content-Length'] = payload.length;

    const r = http.request(options, (res) => {
      let s = '';
      res.on('data', (d) => s += d);
      res.on('end', () => resolve({ status: res.statusCode, body: s }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  const payload = {
    tipo_cliente: 'Particular',
    cliente_nombre: 'Test Cliente',
    celular: '999999999',
    monto_total: 0.1,
    adelanto: 0.1,
    metodo_pago: 'Yape - verificación pendiente',
    fecha_recoge: '2026-09-14',
    hora_recoge: '12:00',
    dedicatoria: '',
    foto_torta: '',
    detalles: [{ producto_nombre: 'test', cantidad: 1, subtotal: 0.1, paquetes: {} }]
  };

  const r1 = await req('POST', '/api/pedidos', JSON.stringify(payload));
  const o = JSON.parse(r1.body);
  console.log('created_status', r1.status, 'created_code', o.codigo);

  const r2 = await req('POST', '/api/yape-webhook', JSON.stringify({
    codigo: o.codigo,
    nro_operacion: '123456',
    monto: 0.1,
    tipo: 'yape_confirmado',
    origen: 'macrodroid'
  }));
  console.log('webhook_status', r2.status, 'webhook_body', r2.body);

  const r3 = await req('GET', `/api/pedidos/estado/${encodeURIComponent(o.codigo)}`);
  console.log('state_status', r3.status, 'state_body', r3.body);
})();
