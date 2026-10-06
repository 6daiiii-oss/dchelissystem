const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');
const { Writable } = require('node:stream');
const { serverContext } = require('./helpers/server-context');

test('el Excel HE conserva cada fila fuente, incluye kekes/tortas y separa panes', async () => {
  const ctx = serverContext();
  const detalles = [
    ['EMPANADA, CARNE', 'Bocaditos', 25], ['EMPANADA CARNE', 'Bocaditos', 15],
    ['PAN FRANCES MINI', 'Panes', 60], ['KEKE CHOCOLATE', 'Kekes', 2], ['TORTA MOKA', 'Tortas', 1]
  ].map(([producto_nombre, categoria_operativa, cantidad], i) => ({ pedido_id: 1, producto_nombre,
    categoria_operativa, cantidad, fecha_he: '2026-10-05', casino_clave_fuente: `hoja::${i}`, origen: 'casino' }));
  const clientes = [{ id: 1, cliente_nombre: 'Casino', origen: 'casino', fecha_recoge: '2026-10-06', cronograma_casino_id: 1 }];
  ctx.cargarDatosHojas = async () => ({ clientes, detalles,
    embalaje: { clientes, detalles }, produccion_embalaje: { clientes: [], detalles: [] } });
  const chunks = [];
  const response = new Writable({ write(chunk, encoding, cb) { chunks.push(chunk); cb(); } });
  response.setHeader = () => {}; response.status = () => { throw Error('La exportación debe funcionar'); };
  await ctx.routes['/api/admin/exportar-excel']({ query: { fecha: '2026-10-05' } }, response);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.concat(chunks));
  assert.deepEqual(workbook.worksheets.map(s => s.name), ['HP Producción', 'HP Panes', 'HE Embalaje', 'HE Panes', 'HPE Sánguches', 'Detalle de pedidos']);
  const fuente = workbook.getWorksheet('Detalle de pedidos');
  assert.equal(fuente.rowCount, 6);
  for (let i = 0; i < detalles.length; i++) {
    const row = fuente.getRow(i + 2).values;
    assert.equal(row[2], detalles[i].producto_nombre);
    assert.equal(row[3], detalles[i].cantidad);
    assert.equal(row[5], '2026-10-05'); assert.equal(row[6], '2026-10-05'); assert.equal(row[7], '2026-10-06');
    assert.equal(row[8], detalles[i].casino_clave_fuente);
    assert.equal(row[9], detalles[i].producto_nombre);
  }
  const panes = workbook.getWorksheet('HE Panes');
  assert.equal(panes.getCell('A3').value, 'PAN FRANCES MINI'); assert.equal(panes.getCell('B3').value, 60);
  assert.equal(panes.getCell('C3').result, 60, 'el total lleva resultado cacheado verificable sin recalcular el Excel');
  const embalaje = workbook.getWorksheet('HE Embalaje');
  assert.equal(embalaje.getCell('B2').value, 'CASINO');
  assert.equal(embalaje.getCell('B2').value.includes('ENTREGA'), false, 'el encabezado muestra solo el nombre');
  const nombres = embalaje.getColumn(1).values.filter(v => typeof v === 'string');
  for (const n of ['EMPANADA, CARNE', 'EMPANADA CARNE', 'KEKE CHOCOLATE', 'TORTA MOKA']) assert.ok(nombres.includes(n));
  assert.equal(nombres.filter(n => n === 'EMPANADA, CARNE' || n === 'EMPANADA CARNE').length, 2,
    'nombres distintos por puntuación conservan filas separadas');
  assert.equal(embalaje.pageSetup.orientation, 'portrait');
  assert.equal(workbook.getWorksheet('HP Producción').pageSetup.orientation, 'landscape');
});
