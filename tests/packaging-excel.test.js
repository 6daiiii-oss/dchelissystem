const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { filtrarItemsEmbalaje, grupoProductoProduccion } = require('../public/production-classification');

test('el Excel de embalaje separa panes y excluye solo kekes y tortas', async () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const desde = server.indexOf("app.get('/api/admin/exportar-excel'");
  const hasta = server.indexOf('\nconst PORT =', desde);
  assert.ok(desde > 0 && hasta > desde);
  let workbook;
  class Worksheet {
    constructor(name) { this.name = name; this.cells = new Map(); this.columns = new Map(); this.rows = new Map(); }
    getCell(fila, columna) {
      const clave = columna ? `${fila}:${columna}` : fila;
      if (!this.cells.has(clave)) this.cells.set(clave, { value: undefined });
      return this.cells.get(clave);
    }
    getColumn(numero) {
      if (!this.columns.has(numero)) this.columns.set(numero, { letter: String.fromCharCode(64 + numero) });
      return this.columns.get(numero);
    }
    getRow(numero) {
      if (!this.rows.has(numero)) this.rows.set(numero, {});
      return this.rows.get(numero);
    }
  }
  class Workbook {
    constructor() { workbook = this; this.worksheets = []; this.xlsx = { write: async () => {} }; }
    addWorksheet(nombre) { const hoja = new Worksheet(nombre); this.worksheets.push(hoja); return hoja; }
  }
  const detalles = [
    ['Empanada de boda', 25], ['Ciabatta con hotdog', 15], ['Keke de chocolate', 2],
    ['Torta chantilly', 1], ['Pye de limón', 1], ['Pye de limón', 25], ['Petipan de pollo', 20]
  ].map(([producto_nombre, cantidad]) => ({ pedido_id: 1, producto_nombre, cantidad }));
  const normalizar = (nombre) => String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const app = { get: (_, __, handler) => { app.handler = handler; } };
  const cargar = new Function('app', 'requireAdminAuth', 'dbAllAsync', 'cargarCasinosProduccion', 'ExcelJS',
    'sumarDiasIso', 'resolverProductoProduccion', 'normalizarProducto', 'grupoProductoProduccion',
    'filtrarItemsEmbalaje', 'console', `${server.slice(desde, hasta)}; return app.handler;`);
  let consultas = 0;
  const handler = cargar(app, () => {}, async () => ++consultas === 1
    ? [{ id:1, cliente_nombre:'Casino', origen:'casino', es_urgente:false }]
    : detalles, async () => ({ clientes:[], detalles:[] }), { Workbook },
  () => '2026-09-24', (nombre) => nombre, normalizar, grupoProductoProduccion, filtrarItemsEmbalaje, console);
  const res = { setHeader: () => {}, end: () => {}, status: () => { throw new Error('No debería fallar'); } };
  await handler({ query:{ fecha:'2026-09-23' } }, res);
  assert.deepEqual(workbook.worksheets.map((hoja) => hoja.name), ['Embalaje', 'Panes']);
  const nombres = (hoja) => [...hoja.cells.entries()].filter(([clave]) => /^\d+:1$/.test(clave)).map(([, celda]) => celda.value);
  assert.deepEqual(nombres(workbook.worksheets[0]), ['Empanada de boda', 'Pye de limón', 'Petipan de pollo']);
  assert.deepEqual(nombres(workbook.worksheets[1]), ['Ciabatta con hotdog']);
  assert.equal(workbook.worksheets[0].getCell(4, 2).value, 25);
  assert.equal(workbook.worksheets[1].getCell(3, 2).value, 15);
});
