const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const html = fs.readFileSync(require('node:path').join(__dirname, '../public/admin.html'), 'utf8');
const clasificacionScript = html.match(/<script src="(production-classification\.js(?:\?[^\"]*)?)"><\/script>/)?.[1];
assert.ok(clasificacionScript, 'La hoja carga el clasificador desde public');
const clasificacion = {};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../public', clasificacionScript.split('?')[0]), 'utf8'), clasificacion);
assert.equal(typeof clasificacion.clasificarHojaProduccion, 'function');
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
    clasificacion.clasificarHojaProduccion
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

test('embalaje agrupa productos en el mínimo de páginas sin perder cantidades', () => {
  const contenedor = { innerHTML: '' };
  let resoluciones = 0;
  const clientes = Array.from({ length: 13 }, (_, i) => ({ id:i+1, cliente_nombre:`Cliente ${i+1}`, origen:'pg' }));
  const productos = Array.from({ length: 40 }, (_, i) => `Bocadito ${i}`);
  const detalles = clientes.flatMap((cliente) => productos.map((producto_nombre) => ({
    pedido_id:cliente.id, producto_nombre, cantidad:25
  })));
  const render = new Function('document', 'window', 'ordenarClientesEmbalaje', 'normalizarNombreProducto',
    'obtenerProductoResolucion', 'escapeHtmlAdmin', 'obtenerResumenPaquetesDesdeCantidades',
    `${functionSource('renderizarMatrizProducto', '  function renderizarHojaProduccionCocina(')}; return renderizarMatrizProducto;`)(
    { getElementById: () => contenedor }, { __datosProduccionClientes:clientes, __datosProduccionDetalles:detalles },
    (value) => value, (value) => String(value).toUpperCase(), () => { resoluciones += 1; return null; }, (value) => String(value), resumen
  );
  render([{ titulo:'BOCADITOS', productosLista:productos }]);
  assert.equal((contenedor.innerHTML.match(/class="kitchen-page"/g) || []).length, 2);
  assert.match(contenedor.innerHTML, /<div class="pack-badge">13x25<\/div>/);
  assert.equal(resoluciones, productos.length, 'cada nombre se resuelve una sola vez aunque haya muchos pedidos');
});

test('embalaje imprime bocaditos y sándwiches juntos si caben, conservando el total', () => {
  const contenedor = { innerHTML: '' };
  const clientes = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, cliente_nombre: `Cliente ${i + 1}`, origen:'pg' }));
  const bocaditos = Array.from({ length: 25 }, (_, i) => `Bocadito ${i}`);
  const sandwiches = Array.from({ length: 7 }, (_, i) => `Sandwich ${i}`);
  const detalles = clientes.flatMap((cliente) => [...bocaditos, ...sandwiches].map((producto_nombre) => ({
    pedido_id: cliente.id, producto_nombre, cantidad:25
  })));
  const render = new Function('document', 'window', 'ordenarClientesEmbalaje', 'normalizarNombreProducto',
    'obtenerProductoResolucion', 'escapeHtmlAdmin', 'obtenerResumenPaquetesDesdeCantidades',
    `${functionSource('renderizarMatrizProducto', '  function renderizarHojaProduccionCocina(')}; return renderizarMatrizProducto;`)(
    { getElementById: () => contenedor }, { __datosProduccionClientes:clientes, __datosProduccionDetalles:detalles },
    (value) => value, (value) => String(value).toUpperCase(), () => null, (value) => String(value), resumen
  );
  render([
    { titulo:'BOCADITOS', productosLista:bocaditos },
    { titulo:'SÁNGUCHES / TRIPLES', productosLista:sandwiches }
  ]);
  assert.equal((contenedor.innerHTML.match(/class="kitchen-page"/g) || []).length, 1);
  assert.match(contenedor.innerHTML, /BOCADITOS/);
  assert.match(contenedor.innerHTML, /SÁNGUCHES \/ TRIPLES/);
  assert.doesNotMatch(contenedor.innerHTML, /TORTAS/);
  assert.match(contenedor.innerHTML, /<div class="pack-badge">14x25<\/div>/);
});

test('cuando los clientes superan el ancho de A4, no se omite ninguno ni se repite el total', () => {
  const contenedor = { innerHTML: '' };
  const clientes = Array.from({ length: 15 }, (_, i) => ({ id:i + 1, cliente_nombre:`Pedido ${i + 1}`, origen:'pg' }));
  const detalles = clientes.map((cliente) => ({ pedido_id:cliente.id, producto_nombre:'Alfajor', cantidad:25 }));
  const render = new Function('document', 'window', 'ordenarClientesEmbalaje', 'normalizarNombreProducto',
    'obtenerProductoResolucion', 'escapeHtmlAdmin', 'obtenerResumenPaquetesDesdeCantidades',
    `${functionSource('renderizarMatrizProducto', '  function renderizarHojaProduccionCocina(')}; return renderizarMatrizProducto;`)(
    { getElementById: () => contenedor }, { __datosProduccionClientes:clientes, __datosProduccionDetalles:detalles },
    (value) => value, (value) => String(value).toUpperCase(), () => null, (value) => String(value), resumen
  );
  render([{ titulo:'BOCADITOS', productosLista:['Alfajor'] }]);
  assert.equal((contenedor.innerHTML.match(/class="kitchen-page"/g) || []).length, 2);
  clientes.forEach((cliente) => assert.equal((contenedor.innerHTML.match(new RegExp(`PEDIDO ${cliente.id}(?!\\d)`, 'g')) || []).length, 1));
  assert.equal((contenedor.innerHTML.match(/class="pack-badge"/g) || []).length, 1);
});

test('embalaje imprime los panes en una página aparte aunque quepan con bocaditos', () => {
  const contenedor = { innerHTML: '' };
  const clientes = [{ id:1, cliente_nombre:'Casino', origen:'casino' }];
  const detalles = [
    { pedido_id:1, producto_nombre:'Empanada de boda', cantidad:25 },
    { pedido_id:1, producto_nombre:'Ciabatta con hotdog', cantidad:15 },
    { pedido_id:1, producto_nombre:'Sandwich de Asado', cantidad:10 }
  ];
  const render = new Function('document', 'window', 'ordenarClientesEmbalaje', 'normalizarNombreProducto',
    'obtenerProductoResolucion', 'escapeHtmlAdmin', 'obtenerResumenPaquetesDesdeCantidades',
    `${functionSource('renderizarMatrizProducto', '  function renderizarHojaProduccionCocina(')}; return renderizarMatrizProducto;`)(
    { getElementById: () => contenedor }, { __datosProduccionClientes:clientes, __datosProduccionDetalles:detalles },
    (value) => value, (value) => String(value).toUpperCase(), () => null, (value) => String(value), resumen
  );
  render([
    { titulo:'BOCADITOS', productosLista:['Empanada de boda'] },
    { titulo:'SÁNGUCHES / TRIPLES', productosLista:['Sandwich de Asado'] },
    { titulo:'PANES', productosLista:['Ciabatta con hotdog'] }
  ]);
  const paginas = contenedor.innerHTML.match(/<div class="kitchen-page">[\s\S]*?<\/table><\/div>/g) || [];
  assert.equal(paginas.length, 2);
  assert.match(paginas[0], /EMPANADA DE BODA/i);
  assert.match(paginas[0], /SANDWICH DE ASADO/i);
  assert.doesNotMatch(paginas[0], /CIABATTA/i);
  assert.match(paginas[1], /CIABATTA CON HOTDOG/i);
  assert.doesNotMatch(paginas[1], /EMPANADA DE BODA|SANDWICH DE ASADO/i);
});

test('producción reserva hojas distintas para bocaditos, sándwiches y panes', () => {
  const contenedor = { innerHTML: '' };
  const render = new Function('document', 'obtenerProductoResolucion', 'normalizarNombreProducto', 'escapeHtmlAdmin', 'formatearFecha',
    'clasificarHojaProduccion', `${functionSource('renderizarHojaProduccionCocina', '  async function cargarMatriz(')}; return renderizarHojaProduccionCocina;`)(
    { getElementById: () => contenedor }, () => null,
    (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
    (value) => String(value), () => 'MIÉRCOLES 23', clasificacion.clasificarHojaProduccion
  );
  render({ fecha:'2026-09-23', clientes:[{ id:1, cliente_nombre:'Casino' }], detalles:[
    { pedido_id:1, producto_nombre:'Alfajor', cantidad:20 },
    { pedido_id:1, producto_nombre:'Petit pan mini', cantidad:30 },
    { pedido_id:1, producto_nombre:'Petipan de pollo c/piña', cantidad:25 },
    { pedido_id:1, producto_nombre:'Triple pollo', cantidad:15 }
  ] });
  const paginas = contenedor.innerHTML.match(/<section class="production-paper[\s\S]*?<\/section>/g) || [];
  assert.equal(paginas.length, 3);
  assert.match(paginas[0], /ALFAJOR/);
  assert.doesNotMatch(paginas[0], /PETIPAN|TRIPLE POLLO/);
  assert.match(paginas[1], /PETIPAN DE POLLO C\/PIÑA[\s\S]*?TRIPLE POLLO/);
  assert.doesNotMatch(paginas[1], /ALFAJOR/);
  assert.match(paginas[2], /PETIPAN<\/td>/);
  assert.doesNotMatch(paginas[2], /TRIPLE POLLO|ALFAJOR/);
});
