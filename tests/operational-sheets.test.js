const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { fechaTrabajo, construirHojasOperativas, verificarImportacion, validarVersionesCronogramaOperativo } = require('../production-sheets');
const { prepararDetalleCasino } = require('../casino-production');
const { clasificarHojaProduccion } = require('../public/production-classification');
const { serverContext } = require('./helpers/server-context');
const normalizar = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
const opciones = { prepararCasino: d => prepararDetalleCasino(d, null, (_, categoria) => categoria),
  resolverProducto: s => s, normalizar, urgente: () => true };

test('corte de Lima: HP y HE cambian juntas; panes siempre el día anterior y HPE el día de entrega', () => {
  const pedido = { fecha_recoge: '2026-10-06', hora_recoge: '21:00' };
  for (const [emision, esperado] of [['2026-10-05T07:59:59-05:00', '2026-10-05'],
    ['2026-10-05T08:00:00-05:00', '2026-10-06'], ['2026-10-05T17:00:00-05:00', '2026-10-06'],
    ['2026-10-06T17:00:00-05:00', '2026-10-06']]) {
    assert.equal(fechaTrabajo({ ...pedido, fecha_emision: emision }, 'Bocaditos'), esperado);
    assert.equal(fechaTrabajo({ ...pedido, fecha_emision: emision }, 'Panes'), '2026-10-05');
    for (const grupo of ['Sándwiches', 'Triples', 'Piqueos']) assert.equal(fechaTrabajo({ ...pedido, fecha_emision: emision }, grupo), '2026-10-06');
  }
  assert.equal(fechaTrabajo({ ...pedido, origen: 'casino', cronograma_casino_id: 1, fecha_emision: '2026-10-06T17:00:00-05:00' }, 'Bocaditos'), '2026-10-05');
  assert.equal(fechaTrabajo({ fecha_recoge: '2027-01-01' }, 'Panes'), '2026-12-31');
});

test('HP y HE comparten filas y cantidades; triples, sánguches y piqueos aparecen solo en HPE', () => {
  const pedidos = [{ id: 1, origen: 'casino', cronograma_casino_id: 1, fecha_recoge: '2026-10-06' }];
  const rows = ['Bocaditos', 'Panes', 'Tortas', 'Kekes', 'Sándwiches', 'Triples', 'Piqueos'].map((grupo, i) => ({
    pedido_id: 1, producto_nombre: 'alias incorrecto', producto_nombre_fuente: `${grupo} original`,
    casino_categoria_fuente: grupo, casino_clave_fuente: `hoja::${i}`, cantidad: i + 1
  }));
  const anterior = construirHojasOperativas('2026-10-05', pedidos, rows, opciones);
  assert.strictEqual(anterior.detalles, anterior.embalaje.detalles);
  assert.deepEqual(anterior.detalles.map(d => d.cantidad), [1, 2, 3, 4]);
  assert.equal(anterior.produccion_embalaje.detalles.length, 0);
  const entrega = construirHojasOperativas('2026-10-06', pedidos, rows, opciones);
  assert.equal(entrega.detalles.length, 0);
  assert.equal(entrega.embalaje.detalles.length, 0);
  assert.deepEqual(entrega.produccion_embalaje.detalles.map(d => [d.producto_nombre, d.cantidad]), [['Sándwiches original', 5], ['Triples original', 6], ['Piqueos original', 7]]);
});

test('Butifarra se clasifica como sánguche incluso si el registro previo dice bocaditos', () => {
  const ctx = serverContext();
  assert.equal(ctx.categoriaOperativaCasino('BUTIFARRAS', 'Bocaditos'), 'Sándwiches');
  const pedido = { id: 1, origen: 'pg', fecha_recoge: '2026-10-06', fecha_emision: '2026-10-05T07:00:00-05:00' };
  const hojas = construirHojasOperativas('2026-10-06', [pedido], [{ pedido_id: 1,
    producto_nombre: 'BUTIFARRA', categoria_operativa: 'Bocaditos', cantidad: 12 }], opciones);
  assert.equal(hojas.detalles.length, 0);
  assert.deepEqual(hojas.produccion_embalaje.detalles.map(d => [d.categoria_operativa, d.cantidad]), [['Sándwiches', 12]]);
});

test('los rellenos completos y la puntuación de cada nombre de casino nunca se colapsan', () => {
  const nombres = ['TRIPLE POLLO TOCINO, QUESO CREMA Y ESPINACA', 'TRIPLE POLLO TOCINO Y JAMON',
    'TRIPLE POLLO TOCINO QUESO CREMA Y ESPINACA'];
  const filas = nombres.map((nombre, i) => ({ origen: 'casino', producto_nombre_fuente: nombre,
    producto_nombre: 'TRIPLE POLLO TOCINO', categoria_operativa: 'Triples', cantidad: 20 + i }));
  const agrupado = clasificarHojaProduccion(filas, [], () => 'TRIPLE POLLO TOCINO', normalizar);
  assert.equal(agrupado.filas.length, 3);
  assert.deepEqual(agrupado.filas.map(f => [f.nombre, f.total]).sort(), nombres.map((n, i) => [n, 20 + i]).sort());
});

test('una revisión vacía oculta las cantidades antiguas de ese casino y día sin quitar otro casino', () => {
  const ctx = serverContext();
  const pedidos = [{ id: 1, origen: 'casino', casino_nombre: 'A', fecha_recoge: '2026-10-06', cronograma_casino_id: 1 },
    { id: 2, origen: 'casino', casino_nombre: 'B', fecha_recoge: '2026-10-06', cronograma_casino_id: 1 }];
  const revisiones = [{ id: 2, datos_json: JSON.stringify({ dias: [{ fecha: '2026-10-06', casinos: ['A'], productos: [] }] }) }];
  assert.deepEqual(Array.from(ctx.filtrarVersionesVigentesCronogramasCasino(pedidos, revisiones), p => p.id), [2]);
});

test('reconciliación aborta ante cualquier faltante, sobrante, nombre, cantidad, fecha o fila diferente', () => {
  const cronograma = { dias: [{ fecha: '2026-10-06', productos: [{ nombre_fuente: 'Triple completo', clave_fuente: 'hoja::3', por_casino: { A: 25 } }] }] };
  const row = { fecha_recoge: '2026-10-06', casino_nombre: 'A', producto_nombre_fuente: 'Triple completo', producto_nombre: 'Triple completo', casino_clave_fuente: 'hoja::3', cantidad: 25 };
  assert.equal(verificarImportacion(cronograma, [row]), 1);
  for (const rows of [[], [row, row], [{ ...row, cantidad: 26 }], [{ ...row, producto_nombre_fuente: 'Triple' }],
    [{ ...row, fecha_recoge: '2026-10-07' }], [{ ...row, casino_clave_fuente: 'hoja::4' }]]) {
    assert.throws(() => verificarImportacion(cronograma, rows), /no coincide/);
  }
});

test('la importación conserva filas independientes y días vacíos; rechaza cantidades ambiguas', async () => {
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Casino A');
  sheet.addRow(['Articulo', 'Lunes', 'Martes', 'Miércoles']);
  sheet.addRow(['', new Date('2026-10-05'), new Date('2026-10-06'), new Date('2026-10-07')]);
  sheet.addRow(['TRIPLE POLLO TOCINO QUESO CREMA ESPINACA', null, 20]);
  sheet.addRow(['TRIPLE POLLO TOCINO JAMON', null, 25]);
  const ctx = serverContext(); const datos = await ctx.procesarCronogramaCasinos(await book.xlsx.writeBuffer());
  assert.equal(datos.dias[1].productos.length, 2);
  assert.equal(datos.dias[0].productos.length, 0);
  assert.deepEqual(Array.from(datos.dias[0].casinos), ['Casino A']);
  assert.notEqual(datos.dias[1].productos[0].clave_fuente, datos.dias[1].productos[1].clave_fuente);
  sheet.mergeCells('C3:C4');
  await assert.rejects(ctx.procesarCronogramaCasinos(await book.xlsx.writeBuffer()), /cantidad ambigua/);
});

test('no publica hojas con cronogramas antiguos ni filas de totales importadas como productos', () => {
  const pedido = { id: 1, origen: 'casino', cronograma_casino_id: 9, fecha_recoge: '2026-10-08' };
  assert.throws(() => validarVersionesCronogramaOperativo([pedido], [
    { id: 9, datos_json: JSON.stringify({ version_importacion: 2 }) }
  ]), error => error.code === 'CRONOGRAMA_REQUIERE_REIMPORTACION' && error.status === 409);
  assert.doesNotThrow(() => validarVersionesCronogramaOperativo([pedido], [
    { id: 9, datos_json: JSON.stringify({ version_importacion: 3 }) }
  ]));
  assert.throws(() => construirHojasOperativas('2026-10-07', [pedido], [{
    pedido_id: 1, producto_nombre: 'Cantidades totales', producto_nombre_fuente: 'Cantidades totales', cantidad: 2199
  }], opciones), error => error.code === 'CRONOGRAMA_REQUIERE_REIMPORTACION' && error.status === 409);
});

test('la huella nueva deja reimportar el mismo Excel que quedó guardado con la huella anterior', () => {
  const ctx = serverContext();
  const old = require('node:crypto').createHash('sha256').update(JSON.stringify({ version: 2, dias: [] })).digest('hex');
  assert.notEqual(ctx.huellaCronogramaCasino({ dias: [] }), old);
  assert.equal(ctx.huellaCronogramaCasino({ dias: [] }), require('node:crypto').createHash('sha256')
    .update(JSON.stringify({ version: 3, dias: [] })).digest('hex'));
});

test('la API de hojas bloquea una importación vieja con un error que pide reimportar', async () => {
  const ctx = serverContext();
  let consultoDetalles = false;
  ctx.dbAllAsync = async sql => {
    if (sql.includes('FROM casino_cronogramas')) return [{ id: 9, datos_json: JSON.stringify({ version_importacion: 2 }) }];
    if (sql.includes('FROM detalles_pedido')) { consultoDetalles = true; return []; }
    return [{ id: 1, origen: 'casino', cronograma_casino_id: 9, fecha_recoge: '2026-10-08' }];
  };
  let status = 200, body;
  await ctx.routes['/api/admin/produccion']({ query: { fecha: '2026-10-07' } }, {
    status(code) { status = code; return this; },
    json(value) { body = value; return this; }
  });
  assert.equal(status, 409);
  assert.match(body.error, /Vuelve a importar el Excel original/);
  assert.equal(consultoDetalles, false, 'no lee ni muestra detalles de la importación vieja');
});
