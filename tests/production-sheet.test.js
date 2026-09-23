const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync(require('node:path').join(__dirname, '../public/admin.html'), 'utf8');
function functionSource(start, end) {
  const first = html.indexOf(`function ${start}(`);
  const last = html.indexOf(end, first);
  assert.ok(first >= 0 && last > first);
  return html.slice(first, last);
}

const resumen = new Function(`${functionSource('obtenerResumenPaquetesDesdeCantidades', '    function obtenerTextoItem(')}; return obtenerResumenPaquetesDesdeCantidades;`)();

test('las cantidades de pedidos independientes no se combinan ni se fraccionan salvo múltiplos completos de 50', () => {
  const cantidades = [30, 20, 75, 70, 25, 55, 55, 150, 30].map((cantidad, indice) => ({ pedido_id: indice + 1, cantidad }));
  assert.equal(resumen(cantidades), '1x20 / 1x25 / 2x30 / 3x50 / 2x55 / 1x70 / 1x75');
});

test('la producción se divide en dos hojas, conserva totales y señala el casino', () => {
  const contenedor = { innerHTML: '' };
  const render = new Function('document', 'obtenerProductoResolucion', 'normalizarNombreProducto', 'escapeHtmlAdmin', 'formatearFecha',
    'clasificarHojaProduccion', `${functionSource('renderizarHojaProduccionCocina', '  async function cargarMatriz(')}; return renderizarHojaProduccionCocina;`)(
    { getElementById: () => contenedor },
    () => null,
    (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
    (value) => String(value),
    () => 'MARTES 22 DE SETIEMBRE',
    require('../production-classification').clasificarHojaProduccion
  );
  const detalles = Array.from({ length: 40 }, (_, i) => ({ producto_nombre: `Bocadito ${String(i).padStart(2, '0')}`, cantidad: 25, pedido_id: 1, origen: 'pg' }));
  detalles.push({ producto_nombre: 'Keke vainilla', cantidad: 6, pedido_id: 2, origen: 'casino' });
  render({ fecha:'2026-09-22', clientes:[{ id:1, cliente_nombre:'Cliente' }, { id:2, cliente_nombre:'Casino Victoria' }], detalles });
  assert.equal((contenedor.innerHTML.match(/class="production-paper(?: production-compact)?"/g) || []).length, 2);
  assert.match(contenedor.innerHTML, /<th>PRODUCTO<\/th><th>TOTAL<\/th>/);
  assert.match(contenedor.innerHTML, /<td class="production-total">25<\/td>/);
  assert.match(contenedor.innerHTML, /KEKE VAINILLA/);
  assert.doesNotMatch(contenedor.innerHTML, /KEKE VAINILLA<\/td>/);
  assert.doesNotMatch(contenedor.innerHTML, /Control manual/);
});

test('embalaje separa productos y clientes en bloques legibles', () => {
  const contenedor = { innerHTML: '' };
  const clientes = Array.from({ length: 13 }, (_, i) => ({ id:i+1, cliente_nombre:`Cliente ${i+1}`, origen:'pg' }));
  const productos = Array.from({ length: 40 }, (_, i) => `Bocadito ${i}`);
  const detalles = clientes.flatMap((cliente) => productos.map((producto_nombre) => ({
    pedido_id:cliente.id, producto_nombre, cantidad:25
  })));
  const render = new Function('document', 'window', 'ordenarClientesEmbalaje', 'normalizarNombreProducto',
    'obtenerProductoResolucion', 'escapeHtmlAdmin', 'obtenerResumenPaquetesDesdeCantidades',
    `${functionSource('renderizarMatrizProducto', '  function renderizarHojaProduccionCocina(')}; return renderizarMatrizProducto;`)(
    { getElementById: () => contenedor }, { __datosProduccionClientes:clientes, __datosProduccionDetalles:detalles },
    (value) => value, (value) => String(value).toUpperCase(), () => null, (value) => String(value), resumen
  );
  render([{ contenedorId:'hojaProduccion', titulo:'BOCADITOS / TORTAS', productosLista:productos }]);
  assert.equal((contenedor.innerHTML.match(/class="kitchen-page"/g) || []).length, 4);
  assert.match(contenedor.innerHTML, /<div class="pack-badge">13x25<\/div>/);
});
