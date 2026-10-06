const assert = require('node:assert/strict');
const test = require('node:test');
const { frontendContext } = require('./helpers/frontend-context');

function matriz(clientes, detalles, resolver) {
  const ui = frontendContext(resolver);
  ui.context.window.__datosEmbalajeClientes = clientes;
  ui.context.window.__datosEmbalajeDetalles = detalles;
  return ui;
}

test('las cantidades de pedidos independientes no se fraccionan salvo múltiplos completos de 50', () => {
  const { context } = frontendContext();
  const cantidades = [30, 20, 75, 70, 25, 55, 55, 150, 30].map((cantidad, i) => ({ pedido_id: i + 1, cantidad }));
  assert.equal(context.obtenerResumenPaquetesDesdeCantidades(cantidades), '1x20 / 1x25 / 2x30 / 3x50 / 2x55 / 1x70 / 1x75');
});

test('HP reserva páginas para bocaditos y panes y conserva kekes y tortas; HPE permanece independiente', () => {
  const { context, containers } = frontendContext();
  const clientes = [{ id: 1, cliente_nombre: 'Casino Victoria', origen: 'casino' }];
  context.renderizarHojaProduccionCocina({ fecha: '2026-10-05', clientes, detalles: [
    { pedido_id: 1, origen: 'casino', producto_nombre: 'ALFAJOR', categoria_operativa: 'Bocaditos', cantidad: 25 },
    { pedido_id: 1, origen: 'casino', producto_nombre: 'KEKE VAINILLA', categoria_operativa: 'Kekes', cantidad: 2 },
    { pedido_id: 1, origen: 'casino', producto_nombre: 'PAN FRANCES MINI', categoria_operativa: 'Panes', cantidad: 30 }
  ] });
  const hp = containers.hojaProduccionCocina.innerHTML;
  assert.equal((hp.match(/<section class="production-paper/g) || []).length, 2);
  assert.match(hp, /ALFAJOR/); assert.match(hp, /KEKE VAINILLA/); assert.match(hp, /PAN FRANCES MINI/);
  assert.match(hp, /class="production-total">25/);
  context.renderizarHojasEmbalajePorHora({ fecha: '2026-10-06', clientes, detalles: [
    { pedido_id: 1, origen: 'casino', producto_nombre: 'TRIPLE POLLO TOCINO QUESO CREMA ESPINACA', categoria_operativa: 'Triples', cantidad: 20 },
    { pedido_id: 1, origen: 'casino', producto_nombre: 'TRIPLE POLLO TOCINO JAMON', categoria_operativa: 'Triples', cantidad: 35 },
    { pedido_id: 1, origen: 'casino', producto_nombre: 'PAN FRANCES MINI', categoria_operativa: 'Panes', cantidad: 30 }
  ] });
  const hpe = containers.hojaDistribucionCocina.innerHTML;
  assert.match(hpe, /TRIPLE POLLO TOCINO QUESO CREMA ESPINACA/); assert.match(hpe, /TRIPLE POLLO TOCINO JAMON/);
  assert.match(hpe, />20<\/strong>/); assert.match(hpe, />35<\/strong>/);
  assert.doesNotMatch(hpe, /PAN FRANCES MINI|ALFAJOR|KEKE VAINILLA/);
});

test('HE pagina por altura y conserva todas las cantidades de 13 clientes', () => {
  let resoluciones = 0;
  const clientes = Array.from({ length: 13 }, (_, i) => ({ id: i + 1, cliente_nombre: `Cliente ${i + 1}` }));
  const productos = Array.from({ length: 40 }, (_, i) => `Bocadito ${i}`);
  const detalles = clientes.flatMap(p => productos.map(producto_nombre => ({ pedido_id: p.id, producto_nombre, cantidad: 25 })));
  const { context, containers } = matriz(clientes, detalles, s => { resoluciones++; return s; });
  context.renderizarMatrizProducto([{ titulo: 'BOCADITOS', productosLista: productos }]);
  assert.equal((containers.hojaProduccion.innerHTML.match(/class="kitchen-page"/g) || []).length, 2);
  assert.equal((containers.hojaProduccion.innerHTML.match(/13x25/g) || []).length, 40);
  assert.equal(resoluciones, 40);
});

test('HE incluye tortas y kekes y no fusiona dos nombres distintos por puntuación', () => {
  const clientes = [{ id: 1, cliente_nombre: 'Casino' }];
  const detalles = ['EMPANADA, CARNE', 'EMPANADA CARNE', 'KEKE LIMON', 'TORTA MOKA'].map((n, i) => ({
    pedido_id: 1, origen: 'casino', producto_nombre: n, categoria_operativa: i === 2 ? 'Kekes' : i === 3 ? 'Tortas' : 'Bocaditos', cantidad: i + 1
  }));
  const { context, containers } = matriz(clientes, detalles);
  const listas = context.obtenerListasEmbalaje(context.filtrarDetallesEmbalaje(detalles));
  assert.equal(listas.bocaditos.length, 2); assert.equal(listas.kekes.length, 1); assert.equal(listas.tortas.length, 1);
  context.renderizarMatrizProducto(Object.entries(listas).map(([titulo, productosLista]) => ({ titulo, productosLista })));
  const html = containers.hojaProduccion.innerHTML;
  for (const d of detalles) assert.match(html, new RegExp(d.producto_nombre));
  assert.equal((html.match(/class="pack-badge"/g) || []).length, 4);
});

test('cuando los clientes superan el ancho de A4, no se omite ninguno ni se repite el total', () => {
  const clientes = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, cliente_nombre: `Pedido ${i + 1}` }));
  const detalles = clientes.map(c => ({ pedido_id: c.id, producto_nombre: 'ALFAJOR', cantidad: 25 }));
  const { context, containers } = matriz(clientes, detalles);
  context.renderizarMatrizProducto([{ titulo: 'BOCADITOS', productosLista: ['ALFAJOR'] }]);
  const html = containers.hojaProduccion.innerHTML;
  assert.equal((html.match(/class="kitchen-page"/g) || []).length, 3);
  for (const c of clientes) assert.equal((html.match(new RegExp(`PEDIDO ${c.id}(?!\\d)`, 'g')) || []).length, 1);
  assert.equal((html.match(/class="pack-badge"/g) || []).length, 1);
});

test('HE imprime los panes en una página aparte', () => {
  const clientes = [{ id: 1, cliente_nombre: 'Casino' }];
  const detalles = [{ pedido_id: 1, producto_nombre: 'EMPANADA CARNE', cantidad: 25 }, { pedido_id: 1, producto_nombre: 'PAN FRANCES MINI', cantidad: 60 }];
  const { context, containers } = matriz(clientes, detalles);
  context.renderizarMatrizProducto([{ titulo: 'BOCADITOS', productosLista: ['EMPANADA CARNE'] }, { titulo: 'PANES', productosLista: ['PAN FRANCES MINI'] }]);
  const paginas = containers.hojaProduccion.innerHTML.match(/<div class="kitchen-page">[\s\S]*?<\/table><\/div>/g);
  assert.equal(paginas.length, 2); assert.match(paginas[0], /EMPANADA CARNE/); assert.doesNotMatch(paginas[0], /PAN FRANCES MINI/);
  assert.match(paginas[1], /PAN FRANCES MINI/); assert.doesNotMatch(paginas[1], /EMPANADA CARNE/);
});


test('HE separa el mismo nombre cuando corresponde a bocaditos y a tortas; no duplica el total', () => {
  const clientes = [{ id: 1, cliente_nombre: 'Casino' }];
  const detalles = [{ pedido_id: 1, origen: 'casino', producto_nombre: 'PYE LIMON', categoria_operativa: 'Bocaditos', cantidad: 25 },
    { pedido_id: 1, origen: 'casino', producto_nombre: 'PYE LIMON', categoria_operativa: 'Tortas', cantidad: 1 }];
  const { context, containers } = matriz(clientes, detalles);
  context.renderizarMatrizProducto([{ titulo: 'BOCADITOS', productosLista: ['PYE LIMON'] }, { titulo: 'TORTAS', productosLista: ['PYE LIMON'] }]);
  const html = containers.hojaProduccion.innerHTML;
  assert.equal((html.match(/class="pack-badge"/g) || []).length, 2);
  assert.match(html, />1x25<\/div>/); assert.match(html, />1x1<\/div>/); assert.doesNotMatch(html, /1x26|2x26/);
});

test('el recuadro del total de HE se renderiza dentro de su celda', () => {
  const clientes = [{ id: 1, cliente_nombre: 'Casino' }];
  const detalles = [{ pedido_id: 1, producto_nombre: 'EMPANADA CARNE', cantidad: 25 }];
  const { context, containers } = matriz(clientes, detalles);
  context.renderizarMatrizProducto([{ titulo: 'BOCADITOS', productosLista: ['EMPANADA CARNE'] }]);
  const html = containers.hojaProduccion.innerHTML;
  assert.match(html, /<td class="pack-cell"><div class="pack-badge">1x25<\/div><\/td>/);
});

test('HE muestra la cantidad de Barranco junto a EMPANADA CARNE aunque el cronograma diga EMPANADITAS DE CARNE', () => {
  const clientes = [
    { id: 1, cliente_nombre: 'Pedido general', origen: 'pg' },
    { id: -2, cliente_nombre: 'Barranco', origen: 'casino' }
  ];
  const detalles = [
    { pedido_id: 1, origen: 'pg', producto_nombre: 'EMPANADA CARNE', categoria_operativa: 'Bocaditos', cantidad: 25 },
    { pedido_id: -2, origen: 'casino', producto_nombre_fuente: 'EMPANADITAS DE CARNE', producto_nombre: 'EMPANADITAS DE CARNE', categoria_operativa: 'Bocaditos salados', cantidad: 20 }
  ];
  const { context, containers } = matriz(clientes, detalles);
  const filtrados = context.filtrarDetallesEmbalaje(detalles);
  const listas = context.obtenerListasEmbalaje(filtrados);
  context.renderizarMatrizProducto(Object.entries(listas).map(([titulo, productosLista]) => ({
    titulo: titulo.toUpperCase(), productosLista, grupo: ({ bocaditos: 'Bocaditos', sandwiches: 'Sándwiches', triples: 'Triples', piqueos: 'Piqueos', panes: 'Panes', tortas: 'Tortas', kekes: 'Kekes' })[titulo]
  })), filtrados);
  const html = containers.hojaProduccion.innerHTML;
  const rows = [...html.matchAll(/<tr><td class="prod-col">([^<]*)<\/td>([\s\S]*?)<\/tr>/g)];
  const carne = rows.filter(([, nombre]) => nombre === 'EMPANADA CARNE');
  assert.equal(carne.length, 1, 'los alias exactos de empanada de carne quedan en una sola fila operativa');
  assert.match(carne[0][2], /<td class="qty-cell kitchen-normal kitchen-casino">20<\/td>/, 'la celda de Barranco conserva sus 20 unidades');
  assert.match(carne[0][2], /1x20 \/ 1x25/, 'el total incluye los dos pedidos sin perder su distribución');
  assert.ok(!rows.some(([, nombre]) => nombre === 'EMPANADITAS DE CARNE'));
  assert.equal(detalles[1].producto_nombre_fuente, 'EMPANADITAS DE CARNE', 'el detalle conserva el nombre original del cronograma');
});

test('HP, HE y HPE asimilan diminutivos exactos y dejan intactos rellenos diferentes', () => {
  const clientes = [{ id: 1, cliente_nombre: 'Casino', origen: 'casino' }];
  const dulces = [
    ['ALFAJORCITO DE MANJAR', 'ALFAJOR'], ['COCADITAS', 'COCADAS'],
    ['CONITOS DE MANJAR', 'CONITOS'], ['DONITAS', 'DONAS'],
    ['EMPANADITA DE BODA', 'EMPANADA DE BODA'], ['KEKITO DE ZANAHORIA', 'KEKITO ZANAHORIA'],
    ['NIDITOS DE AMOR', 'NIDITOS'], ['PAÑUELITOS DE MANJAR', 'PAÑUELITOS'],
    ['PIONONITOS', 'PIONONO'], ['PROFITEROLES', 'PROFITEROL']
  ];
  for (const [fuente, canonico] of dulces) assert.equal(require('../public/production-classification').nombreVisibleProductoCronograma(fuente), canonico);
  const triples = ['TRIPLE TOCINO ESPINACA QUESO CREMA', 'TRIPLE POLLO JAMON QUESO'];
  for (const name of triples) assert.equal(require('../public/production-classification').nombreVisibleProductoCronograma(name), name);

  const detalles = dulces.slice(0, 2).map(([producto_nombre_fuente, producto_nombre], i) => ({
    pedido_id: 1, origen: 'casino', producto_nombre_fuente, producto_nombre,
    categoria_operativa: 'Bocaditos', cantidad: (i + 1) * 25
  }));
  const { context, containers } = matriz(clientes, detalles);
  const listas = context.obtenerListasEmbalaje(context.filtrarDetallesEmbalaje(detalles));
  context.renderizarMatrizProducto(Object.entries(listas).map(([titulo, productosLista]) => ({ titulo: titulo.toUpperCase(), productosLista })), detalles);
  assert.match(containers.hojaProduccion.innerHTML, /<td class="prod-col">ALFAJOR<\/td>/);
  assert.match(containers.hojaProduccion.innerHTML, /<td class="prod-col">COCADAS<\/td>/);
  assert.doesNotMatch(containers.hojaProduccion.innerHTML, /ALFAJORCITO DE MANJAR|COCADITAS/);
  context.renderizarHojaProduccionCocina({ fecha: '2026-10-05', clientes, detalles });
  assert.match(containers.hojaProduccionCocina.innerHTML, /ALFAJOR/);
  assert.match(containers.hojaProduccionCocina.innerHTML, /COCADAS/);
  context.renderizarHojasEmbalajePorHora({ fecha: '2026-10-06', clientes, detalles: triples.map((producto_nombre_fuente, i) => ({
    pedido_id: 1, origen: 'casino', producto_nombre_fuente, producto_nombre: producto_nombre_fuente,
    categoria_operativa: 'Triples', cantidad: (i + 1) * 25
  })) });
  for (const name of triples) assert.ok(containers.hojaDistribucionCocina.innerHTML.includes(name));
});
