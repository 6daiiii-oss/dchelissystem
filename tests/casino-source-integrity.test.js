const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ExcelJS = require('exceljs');
const classification = require('../public/production-classification');
const { prepararDetalleCasino } = require('../casino-production');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf8');
function serverContext() {
  const routes = {};
  const context = { routes, console, Buffer, URL, Date, process: { env: { ADMIN_SESSION_SECRET: 'test' } } };
  context.require = (name) => name === 'express' ? (() => ({ set() {}, get(url, ...handlers) { routes[url] = handlers.at(-1); }, delete(url, ...handlers) { routes[`DELETE ${url}`] = handlers.at(-1); } }))
    : name === 'cors' ? (() => {}) : name === 'bcryptjs' ? { hashSync: () => '' }
    : name === './db' ? {} : name.startsWith('./') ? require(path.join(__dirname, '..', name)) : require(name);
  vm.createContext(context);
  vm.runInContext(server.split('// Middlewares')[0], context);
  const exportHelperStart = server.indexOf('function agregarMatrizHojasExcel(');
  const exportRouteStart = server.indexOf("app.get('/api/admin/exportar-excel'", exportHelperStart);
  vm.runInContext(server.slice(exportHelperStart, exportRouteStart), context);
  context.requireAdminAuth = (req, res, next) => next?.();
  const deleteStart = server.indexOf("app.delete('/api/admin/casinos/cronograma/:id'");
  const deleteEnd = server.indexOf("\napp.get('/api/admin/casinos/cronograma/:id'", deleteStart);
  vm.runInContext(server.slice(deleteStart, deleteEnd), context);
  return context;
}
function frontend() {
  const containers = {};
  const context = { ...classification, window: {},
    document: { getElementById: (id) => containers[id] ||= { innerHTML: '', value: '2026-10-06' } },
    normalizarNombreProducto: (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim(),
    obtenerProductoResolucion: () => { throw Error('Un artículo de casino llegó al resolver de catálogo'); },
    resolverProductoNombres: () => [], obtenerProductosExtraParaProduccion: () => [],
    escapeHtmlAdmin: String, formatearFecha: String, formatearCantidadCasino: String
  };
  vm.createContext(context);
  for (const [start, end] of [
    ['filtrarDetallesEmbalaje', '  function obtenerProductoResolucion'],
    ['ordenarClientesEmbalaje', '  async function cargarMatriz'],
    ['obtenerResumenPaquetesDesdeCantidades', '    function obtenerTextoItem']
  ]) {
    const first = html.indexOf(`function ${start}(`);
    vm.runInContext(html.slice(first, html.indexOf(end, first)), context);
  }
  return { context, containers };
}
const badResolver = () => { throw Error('No debe renombrar la fuente'); };

test('revisión uno por uno de nombres del cronograma: solo alias exactos cambian en las hojas', { skip: !process.env.CASINO_SOURCE_XLSX }, async () => {
  const ctx = serverContext();
  const parsed = await ctx.procesarCronogramaCasinos(fs.readFileSync(process.env.CASINO_SOURCE_XLSX));
  const names = new Set(parsed.dias.flatMap(dia => dia.productos.map(producto => producto.nombre_fuente || producto.nombre)));
  const aliasesEsperados = [
    ['ALFAJORCITO', 'ALFAJOR'], ['ALFAJORCITO DE MANJAR', 'ALFAJOR'],
    ['CISNE', 'CISNES'], ['COCADITAS', 'COCADAS'], ['CONITOS DE MANJAR', 'CONITOS'], ['DONITAS', 'DONAS'],
    ['EMPANADITA DE BODA', 'EMPANADA DE BODA'], ['EMPANADITAS DE CARNE', 'EMPANADA CARNE'],
    ['EMPANADITAS DE POLLO', 'EMPANADA POLLO'], ['EMPANADITAS DE QUESO', 'EMPANADA QUESO'],
    ['EMPANADITAS MIXTAS', 'EMPANADA MIXTA'], ['EMPANADA DE CARNE', 'EMPANADA CARNE'], ['EMPANADA DE POLLO', 'EMPANADA POLLO'],
    ['ENROLLADO DE HOT DOG', 'ENROLLADO HOT DOG'], ['KEKITO DE ZANAHORIA', 'KEKITO ZANAHORIA'], ['NIDITOS DE AMOR', 'NIDITOS'],
    ['MOUSSE DE MARACUYA', 'MOUSSE MARACUYA'], ['PAÑUELITOS DE MANJAR', 'PAÑUELITOS'],
    ['PIE DE MANZANA', 'PYE DE MANZANA'], ['PIONONITOS', 'PIONONO'], ['PROFITEROLES', 'PROFITEROL'],
    ['RELAMPAGO DE CHOCOLATE', 'RELAMPAGOS'], ['RELÁMPAGO DE CHOCOLATE', 'RELAMPAGOS'],
    ['TARTALETA DE DURAZNO', 'TARTALETA DURAZNO'], ['TORTA CHANTILLY', 'TORTITA CHANTILLY'],
    ['TORTITA DE CHANTILLY', 'TORTITA CHANTILLY'], ['TORTITA DE CHOCOLATE', 'TORTITA CHOCOLATE']
  ].filter(([fuente]) => names.has(fuente));
  const cambios = [...names].filter(name => classification.nombreVisibleProductoCronograma(name) !== name)
    .map(name => [name, classification.nombreVisibleProductoCronograma(name)]).sort(([a], [b]) => a.localeCompare(b, 'es'));
  assert.deepEqual(cambios, aliasesEsperados.sort(([a], [b]) => a.localeCompare(b, 'es')));
  for (const name of names) {
    if (/^TRIPLE\b/.test(name)) assert.equal(classification.nombreVisibleProductoCronograma(name), name, `no mezclar rellenos: ${name}`);
    if (/^(?:FRANCESITO|FRANCES|CIABATITTA|CIABATTA|CROISSANT|CROSSAINT|ARABITO)\b/.test(name)) {
      assert.equal(classification.nombreVisibleProductoCronograma(name), name, `conservar pan y relleno: ${name}`);
    }
  }
  console.log(`Auditados ${names.size} nombres fuente; ${cambios.length} equivalencias exactas y el resto conserva identidad.`);
});

test('cada variante del Excel llega a producción, lista de embalaje, matriz y distribución sin resolver aliases', () => {
  const ctx = serverContext();
  const names = ['FRANCESITO CON HOT DOG', 'FRANCESITO POLLO A LA BRASA', 'FRANCESITO CON CHORIZO',
    'CROISSANT JAMON QUESO', 'TRIPLE ACEITUNA HUEVO JAMON', 'TRIPLE TOCINO ESPINACA QUESO CREMA',
    'TRIPLE MERMELADA QUESO CREMA', 'EMPANADITAS DE POLLO', 'PAN FRANCES MINI', 'PRODUCTO NUEVO SIN CATALOGO'];
  const details = names.map((nombre, i) => prepararDetalleCasino({ pedido_id: 1, origen: 'casino',
    producto_nombre: 'Nombre erróneo antiguo', producto_nombre_fuente: nombre,
    casino_clave_fuente: `hoja::${i}`, cantidad: i + 20 }, badResolver, ctx.categoriaOperativaCasino));
  assert.deepEqual(details.map(d => d.producto_nombre), names);
  const { context: ui, containers } = frontend();
  const clients = [{ id: 1, cliente_nombre: 'Casino prueba', origen: 'casino', hora_recoge: '09:00' }];
  const lists = ui.obtenerListasEmbalaje(details);
  assert.equal(Object.values(lists).flat().length, names.length, 'también deben aparecer artículos fuera del catálogo');
  ui.window.__datosEmbalajeClientes = clients;
  ui.renderizarMatrizProducto(Object.entries(lists).map(([titulo, productosLista]) => ({ titulo, productosLista })), details);
  assert.doesNotMatch(containers.hojaProduccion.innerHTML, /ENTREGA\s+2026-/);
  assert.doesNotMatch(containers.hojaProduccion.innerHTML, /kitchen-casino-tag/);
  for (const name of names) {
    const visible = classification.nombreVisibleProductoCronograma(name);
    assert.ok(containers.hojaProduccion.innerHTML.includes(visible), `${name} → ${visible}`);
  }
  ui.renderizarHojasEmbalajePorHora({ fecha: '2026-10-06', clientes: clients, detalles: details });
  for (const name of names.slice(0, 7)) {
    const visible = classification.nombreVisibleProductoCronograma(name);
    assert.ok(containers.hojaDistribucionCocina.innerHTML.includes(visible), `${name} → ${visible}`);
  }
  assert.ok(!containers.hojaDistribucionCocina.innerHTML.includes('60 MINI FRANCÉS'));
  ui.renderizarHojaProduccionCocina({ fecha: '2026-10-06', clientes: clients, detalles: details,
    embalaje: { clientes: clients, detalles: details } });
  for (const name of names.slice(7)) {
    const visible = classification.nombreVisibleProductoCronograma(name);
    assert.ok(containers.hojaProduccionCocina.innerHTML.includes(visible), `${name} → ${visible}`);
  }
  for (const name of names.slice(0, 7)) assert.ok(!containers.hojaProduccionCocina.innerHTML.includes(name), 'HPE no debe aparecer en HP: ' + name);
});

test('cronograma: empanadas el día anterior, triples el mismo día, sin depender de la hora de importación', () => {
  const ctx = serverContext();
  const order = { origen: 'casino', cronograma_casino_id: 5, fecha_recoge: '2026-10-06', hora_recoge: '09:00', fecha_emision: '2026-10-05T18:00:00-05:00' };
  assert.equal(ctx.fechaProduccionAnticipada(order, 'Bocaditos'), '2026-10-05');
  assert.equal(ctx.fechaProduccionAnticipada(order, 'Triples'), '2026-10-06');
  assert.equal(ctx.fechaProduccionAnticipada({ ...order, origen: 'pg', cronograma_casino_id: null }, 'Panes'), '2026-10-05');
});

test('importación real: filas distintas, columnas por fecha, celdas vacías y totales SUM sin artículo', async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Morelli');
  sheet.addRow(['', 'Categoría', 'Articulo', 'Lunes', 'Martes', 'Miércoles']);
  sheet.addRow(['', '', '', new Date('2026-10-05'), new Date('2026-10-06'), new Date('2026-10-07')]);
  sheet.addRow(['', 'Bocaditos salados', 'EMPANADITAS DE CARNE', null, 50]);
  sheet.addRow(['', 'Mini sandwich', 'TRIPLE POLLO JAMON QUESO', null, 20]);
  sheet.addRow(['', 'Mini sandwich', 'CROISSANT JAMON QUESO', null, 40]);
  sheet.addRow(['', '', '', null, { formula: 'SUM(E3:E5)', result: 110 }]);
  const ctx = serverContext();
  const parsed = await ctx.procesarCronogramaCasinos(await book.xlsx.writeBuffer());
  const day = parsed.dias.find(d => d.fecha === '2026-10-06');
  assert.equal(day.productos.length, 3);
  assert.deepEqual(Array.from(day.productos, p => [p.nombre, p.total]), [
    ['EMPANADITAS DE CARNE', 50], ['TRIPLE POLLO JAMON QUESO', 20], ['CROISSANT JAMON QUESO', 40]
  ]);
  assert.equal(parsed.dias.find(d => d.fecha === '2026-10-05').productos.length, 0);
  assert.equal(new Set(day.productos.map(p => p.clave_fuente)).size, 3);
});

test('importación ignora filas de totales y conserva triples y panes con nombres distintos', async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Crazy');
  sheet.addRow(['', 'Categoría', 'Artículo', 'Lunes', 'Martes', 'Miércoles']);
  sheet.addRow(['', '', '', new Date('2026-10-05'), new Date('2026-10-06'), new Date('2026-10-07')]);
  sheet.addRow(['', 'Triples', 'TRIPLE TOCINO ESPINACA QUESO CREMA', null, 30, null]);
  sheet.addRow(['', 'Triples', 'TRIPLE POLLO Y TOCINO', null, 50, null]);
  sheet.addRow(['', 'Triples', 'TRIPLE ACEITUNA HUEVO JAMON', null, 30, null]);
  sheet.addRow(['', 'Panes', 'PAN HAMBURGUESITA', null, null, 100]);
  sheet.addRow(['', 'Panes', 'PAN HAMBURGUESA ROLLYS', null, null, 12]);
  sheet.addRow(['', '', 'CANTIDADES TOTALES', null, 110, 112]);
  const ctx = serverContext();
  const parsed = await ctx.procesarCronogramaCasinos(await book.xlsx.writeBuffer());
  const martes = parsed.dias.find(d => d.fecha === '2026-10-06');
  const miercoles = parsed.dias.find(d => d.fecha === '2026-10-07');
  assert.deepEqual(Array.from(martes.productos, p => [p.nombre, p.total]), [
    ['TRIPLE TOCINO ESPINACA QUESO CREMA', 30], ['TRIPLE POLLO Y TOCINO', 50], ['TRIPLE ACEITUNA HUEVO JAMON', 30]
  ]);
  assert.deepEqual(Array.from(miercoles.productos, p => [p.nombre, p.total]), [
    ['PAN HAMBURGUESITA', 100], ['PAN HAMBURGUESA ROLLYS', 12]
  ]);
});

test('PAN y TIPO no duplican el nombre del pan y conservan los rellenos distintos', async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Benavides');
  sheet.addRow(['PAN', 'TIPO', 'PRECIO', 'Lunes', 'Martes', 'Miércoles']);
  sheet.addRow(['', '', '', new Date('2026-10-05'), new Date('2026-10-06'), new Date('2026-10-07')]);
  sheet.addRow(['ARABITO', 'ARABITO PIZZERO (TOMATE, QUESO)', null, null, 20]);
  sheet.addRow(['BAGUETINO', 'BAGUETINO DE JAMON Y HUEVO', null, null, 25]);
  sheet.addRow(['FRANCES', 'POLLO PIÑA', null, null, null, 30]);
  sheet.addRow(['FRANCES', 'POLLO DURAZNO', null, null, null, 35]);
  const parsed = await serverContext().procesarCronogramaCasinos(await book.xlsx.writeBuffer());
  const martes = parsed.dias.find(day => day.fecha === '2026-10-06');
  const miercoles = parsed.dias.find(day => day.fecha === '2026-10-07');
  assert.deepEqual(Array.from(martes.productos, product => product.nombre), [
    'ARABITO PIZZERO (TOMATE, QUESO)', 'BAGUETINO DE JAMON Y HUEVO'
  ]);
  assert.deepEqual(Array.from(miercoles.productos, product => product.nombre), [
    'FRANCES POLLO PIÑA', 'FRANCES POLLO DURAZNO'
  ]);
});

// Opt-in audit against the original workbook; no private workbook is committed.
test('reconciliación del Excel original, celda por celda para todas sus hojas y fechas', { skip: !process.env.CASINO_SOURCE_XLSX }, async () => {
  const ctx = serverContext();
  const buffer = fs.readFileSync(process.env.CASINO_SOURCE_XLSX);
  const parsed = await ctx.procesarCronogramaCasinos(buffer);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  const expected = [], actual = [];
  const text = (cell) => { const v = cell.value; return v == null ? '' : String(v.richText ? v.richText.map(t => t.text).join('') : v.result ?? v); };
  for (const sheet of book.worksheets) {
    // Independent traversal: explicit headers and dates, no application parser helpers.
    let columns = [], nameColumn = 3, panColumn = 0, typeColumn = 0;
    for (let r = 1; r <= sheet.rowCount; r++) {
      const values = [];
      for (let c = 1; c <= sheet.columnCount; c++) values[c] = text(sheet.getCell(r, c)).trim();
      const dayCols = values.map((v, c) => /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)$/i.test(v || '') ? c : 0).filter(Boolean);
      if (dayCols.length >= 3) {
        nameColumn = values.findIndex(v => /^(articulo|artículo|item|producto)$/i.test(v || ''));
        panColumn = values.findIndex(v => /^pan$/i.test(v || ''));
        typeColumn = values.findIndex(v => /^tipo$/i.test(v || ''));
        if (nameColumn < 1 && panColumn < 1 && typeColumn > 0) nameColumn = typeColumn;
        columns = dayCols.map(c => {
          const cellValue = sheet.getCell(r + 1, c).value;
          const raw = cellValue && Object.hasOwn(cellValue, 'result') ? cellValue.result : cellValue;
          let date;
          if (raw instanceof Date) date = raw.toISOString().slice(0, 10);
          else if (typeof raw === 'number') date = new Date(Date.UTC(1899, 11, 30) + raw * 86400000).toISOString().slice(0, 10);
          else if (/^\d{1,2}-sep$/i.test(String(raw))) date = `2026-09-${String(raw).split('-')[0].padStart(2, '0')}`;
          else throw Error(`Fecha no reconocida ${sheet.name} ${r + 1} ${c}`);
          return [c, date];
        }); r++; continue;
      }
      if (!columns.length) continue;
      let name;
      if (nameColumn > 0) name = text(sheet.getCell(r, nameColumn));
      else {
        const pan = panColumn > 0 ? text(sheet.getCell(r, panColumn)).replace(/\u00a0/g, ' ').trim() : '';
        const type = typeColumn > 0 ? text(sheet.getCell(r, typeColumn)).replace(/\u00a0/g, ' ').trim() : '';
        const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
        const panKey = normalize(pan), typeKey = normalize(type);
        name = panKey && typeKey && (typeKey === panKey || typeKey.startsWith(`${panKey} `)) ? type : [pan, type].filter(Boolean).join(' ');
      }
      name = name.replace(/\u00a0/g, ' ').trim();
      if (!name || /TOTAL|#REF/i.test(name)) continue;
      for (const [c, date] of columns) {
        const val = sheet.getCell(r, c).value;
        const qty = typeof val === 'object' ? Number(val?.result || 0) : Number(val || 0);
        if (qty > 0) expected.push([sheet.name, date, name, qty, r]);
      }
    }
  }
  for (const day of parsed.dias) for (const p of day.productos) for (const [casino, qty] of Object.entries(p.por_casino)) {
    const row = +p.clave_fuente.split('::').at(-1);
    actual.push([casino, day.fecha, p.nombre, qty, row]);
    const d = prepararDetalleCasino({ origen: 'casino', producto_nombre: 'alias anterior', producto_nombre_fuente: p.nombre_fuente, casino_categoria_fuente: p.categoria_fuente, cantidad: qty }, badResolver, ctx.categoriaOperativaCasino);
    assert.equal(d.producto_nombre, p.nombre_fuente);
    assert.equal(classification.nombreDetalleProduccion(d, badResolver), p.nombre_fuente);
  }
  const sort = rows => rows.map(JSON.stringify).sort();
  assert.deepEqual(sort(actual), sort(expected));
  console.log(`Reconciliadas ${actual.length} celdas de ${book.worksheets.length} hojas, sin faltantes ni sobrantes.`);
});


test('API Cocina y Excel descargado conservan cantidades, fechas y filas; descartan versiones antiguas', async () => {
  const ctx = serverContext();
  const clients = [
    { id: 1, cliente_nombre: 'Morelli', casino_nombre: 'Morelli', origen: 'casino', cronograma_casino_id: 8, fecha_recoge: '2026-10-06', hora_recoge: '09:00' },
    { id: 2, cliente_nombre: 'Morelli', casino_nombre: 'Morelli', origen: 'casino', cronograma_casino_id: 7, fecha_recoge: '2026-10-06', hora_recoge: '09:00' }
  ];
  const details = [
    { producto_nombre_fuente: 'EMPANADITAS DE CARNE', casino_categoria_fuente: 'Bocaditos salados', cantidad: 50 },
    { producto_nombre_fuente: 'TRIPLE POLLO JAMON QUESO', casino_categoria_fuente: 'Mini sandwich', cantidad: 20 },
    { producto_nombre_fuente: 'CROISSANT JAMON QUESO', casino_categoria_fuente: 'Mini sandwich', cantidad: 40 },
    { producto_nombre_fuente: 'KEKE DE ZANAHORIA', casino_categoria_fuente: 'Kekes', cantidad: 1 }
  ].map((d, i) => ({ ...clients[0], ...d, pedido_id: 1, producto_nombre: 'Nombre anterior incorrecto', casino_clave_fuente: `MORELLI::${i}`, casino_orden_fuente: i }));
  ctx.dbAllAsync = async (sql, params) => {
    if (sql.includes('FROM detalles_pedido')) {
      assert.ok(!params.includes(2), 'no consultar detalles de la versión anterior');
      return details;
    }
    if (sql.includes('FROM casino_cronogramas')) return [{ id: 8, datos_json: JSON.stringify({ version_importacion: 3, dias: [{ fecha: '2026-10-06', casinos: ['Morelli'] }] }) }];
    return clients;
  };
  const start = server.indexOf("app.get('/api/admin/produccion'");
  vm.runInContext(server.slice(start, server.indexOf('\nconst PORT =', start)), ctx);
  let response;
  await ctx.routes['/api/admin/produccion']({ query: { fecha: '2026-10-05' } }, { json: value => { response = value; } });
  assert.equal(response.detalles.find(d => d.producto_nombre === 'EMPANADITAS DE CARNE').cantidad, 50);
  assert.equal(response.detalles.some(d => d.producto_nombre.startsWith('TRIPLE')), false);
  await ctx.routes['/api/admin/produccion']({ query: { fecha: '2026-10-06' } }, { json: value => { response = value; } });
  assert.equal(response.embalaje.detalles.length, 0);
  assert.equal(response.produccion_embalaje.detalles.length, 2);
  assert.equal(response.produccion_embalaje.detalles.find(d => d.producto_nombre === 'TRIPLE POLLO JAMON QUESO').cantidad, 20);
  const { Writable } = require('node:stream');
  const exportar = async fecha => {
    const chunks = [];
    const res = new Writable({ write(chunk, encoding, cb) { chunks.push(chunk); cb(); } });
    res.setHeader = () => {};
    res.status = () => { throw Error('La exportación devolvió un error'); };
    await ctx.routes['/api/admin/exportar-excel']({ query: { fecha } }, res);
    const libro = new ExcelJS.Workbook(); await libro.xlsx.load(Buffer.concat(chunks));
    return libro;
  };
  const book = await exportar('2026-10-05');
  assert.ok(book.getWorksheet('HP Producción'));
  assert.ok(book.getWorksheet('HE Bocaditos'));
  assert.ok(book.getWorksheet('HE Tortas y Kekes'));
  assert.ok(book.getWorksheet('HE Panes'));
  assert.ok(book.getWorksheet('HPE Sánguches'));
  assert.equal(book.getWorksheet('HE Bocaditos').pageSetup.orientation, 'portrait');
  assert.equal(book.getWorksheet('HP Producción').pageSetup.orientation, 'landscape');
  const hp = book.getWorksheet('HP Producción');
  const hpEmpanadaRow = hp.getColumn(1).values.findIndex(value => value === 'EMPANADA CARNE');
  assert.ok(hpEmpanadaRow > 0);
  assert.equal(hp.getCell(hpEmpanadaRow, 2).value, 50);
  assert.equal(hp.getCell(hpEmpanadaRow, 3).result, 50);
  const he = book.getWorksheet('HE Bocaditos');
  const empanadaRow = he.getColumn(1).values.findIndex(value => value === 'EMPANADA CARNE');
  assert.ok(empanadaRow > 0);
  assert.equal(he.getCell(empanadaRow, 2).value, 50);
  assert.equal(he.getCell(empanadaRow, 3).result, 50);
  const source = book.getWorksheet('Detalle de pedidos');
  assert.equal(source.rowCount, 3);
  assert.deepEqual(source.getRow(2).values.slice(1, 8), ['Morelli', 'EMPANADA CARNE', 50, 'Bocaditos', '2026-10-05', '2026-10-05', '2026-10-06']);
  assert.equal(source.getCell('I2').value, 'EMPANADITAS DE CARNE');
  assert.equal(source.getCell('B3').value, 'KEKE DE ZANAHORIA');
  assert.ok(!source.getColumn(2).values.includes('TRIPLE POLLO JAMON QUESO'));
  const hpeBook = await exportar('2026-10-06');
  const hpe = hpeBook.getWorksheet('HPE Sánguches');
  assert.equal(hpe.pageSetup.orientation, 'landscape');
  const tripleRow = hpe.getColumn(1).values.findIndex(value => value === 'TRIPLE POLLO JAMON QUESO');
  assert.ok(tripleRow > 0);
  assert.equal(hpe.getCell(tripleRow, 2).value, 20);
  assert.equal(hpe.getCell(tripleRow, 3).result, 20);
  const croissantRow = hpe.getColumn(1).values.findIndex(value => value === 'CROISSANT JAMON QUESO');
  assert.ok(croissantRow > 0);
  assert.equal(hpe.getCell(croissantRow, 2).value, 40);
});

test('eliminar un Excel de casinos borra en una transacción solo su importación y pedidos asociados', async () => {
  const ctx = serverContext();
  const consultas = [];
  ctx.dbGetAsync = async (sql, params) => {
    consultas.push([sql, params]);
    return { id: 14 };
  };
  ctx.dbRunAsync = async (sql, params = []) => {
    consultas.push([sql, params]);
    return { changes: sql.startsWith('DELETE FROM pedidos') ? 3 : 1 };
  };
  let status = 200, body;
  await ctx.routes['DELETE /api/admin/casinos/cronograma/:id']({ params: { id: '14' } }, {
    status(code) { status = code; return this; },
    json(value) { body = value; return this; }
  });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.pedidos_eliminados, 3);
  assert.deepEqual(consultas.map(([sql]) => sql), [
    'SELECT id FROM casino_cronogramas WHERE id = ?',
    'BEGIN TRANSACTION',
    'DELETE FROM pedidos WHERE origen = ? AND cronograma_casino_id = ?',
    'DELETE FROM casino_cronogramas WHERE id = ?',
    'COMMIT'
  ]);
  assert.equal(consultas[2][1][0], 'casino');
  assert.equal(consultas[2][1][1], 14);
});
