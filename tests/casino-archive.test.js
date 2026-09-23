const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { unirCronogramasCasino } = require('../casino-archive');
const { clasificarHojaProduccion } = require('../public/production-classification');

test('las semanas importadas se conservan y una fecha repetida usa el último Excel', () => {
  const vieja = { id: 1, nombre_archivo: 'Viejo.xlsx', fecha_inicio: '2026-09-14', fecha_fin: '2026-09-22', datos_json: JSON.stringify({
    dias: [
      { fecha: '2026-09-14', casinos: ['Antiguo'], productos: [{ nombre: 'Keke', total: 1 }] },
      { fecha: '2026-09-22', casinos: ['Antiguo'], productos: [{ nombre: 'Keke', total: 2 }] }
    ]
  }) };
  const nueva = { id: 2, nombre_archivo: 'Nuevo.xlsx', fecha_inicio: '2026-09-22', fecha_fin: '2026-09-28', datos_json: JSON.stringify({
    dias: [
      { fecha: '2026-09-22', casinos: ['Actual'], productos: [{ nombre: 'Keke', total: 3 }] },
      { fecha: '2026-09-28', casinos: ['Actual'], productos: [{ nombre: 'Pie', total: 20 }] }
    ]
  }) };
  const combinado = unirCronogramasCasino([nueva, vieja]);
  assert.deepEqual(combinado.dias.map((dia) => [dia.fecha, dia.casinos[0], dia.productos[0].total]), [
    ['2026-09-14', 'Antiguo', 1],
    ['2026-09-22', 'Actual', 3],
    ['2026-09-28', 'Actual', 20]
  ]);
  assert.deepEqual(combinado.casinos, ['Actual', 'Antiguo']);
});

test('pye y tortita con 15 o más son bocaditos; tortas pequeñas conservan el nombre del casino', () => {
  const datos = [
    ['Pye de limón', 15, 1], ['Pye de manzana', 20, 1],
    ['Tortita helada', 25, 1], ['Tortita helada', 1, 2],
    ['Torta de moka', 1, 1], ['Keke de chocolate', 1, 1], ['Kekes Keke de chocolate', 3, 2]
  ];
  const detalles = datos.map(([producto_nombre, cantidad, pedido_id]) => ({ producto_nombre, cantidad, pedido_id }));
  const clientes = [{ id: 1, cliente_nombre: 'Barranco' }, { id: 2, cliente_nombre: 'NY' }];
  const resultado = clasificarHojaProduccion(detalles, clientes, (nombre) => nombre, (nombre) => nombre.toUpperCase());
  assert.deepEqual(resultado.filas.map((item) => [item.nombre, item.total]), [
    ['Pye de limón (BOCADITOS)', 15], ['Pye de manzana (BOCADITOS)', 20], ['Tortita helada (BOCADITOS)', 25]
  ]);
  assert.deepEqual(resultado.especiales.map((item) => [item.nombre, item.total, item.cliente]), [
    ['Keke de chocolate', 4, ''], ['Torta de moka (TORTA)', 1, 'Barranco'], ['Tortita helada (TORTA)', 1, 'NY']
  ]);
});

test('un pedido del lunes permanece visible hasta que termina su semana', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '../public/admin.html'), 'utf8');
  const inicio = html.indexOf('    function crearSemanasCasino(');
  const fin = html.indexOf('    function productosConPedidoEnDias(', inicio);
  const source = html.slice(inicio, fin);
  const crearSemanas = new Function('lunesDeFechaCasino', 'formatearFechaCasino', 'fechaCasinoADate', 'isoDateCasino',
    `${source}; return crearSemanasCasino;`)(
    (fecha) => { const date = new Date(`${fecha}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return date.toISOString().slice(0,10); },
    (fecha) => fecha,
    (fecha) => new Date(`${fecha}T12:00:00Z`),
    (fecha) => fecha.toISOString().slice(0,10)
  );
  const semanas = crearSemanas([{ fecha: '2026-09-21' }, { fecha: '2026-09-28' }]);
  assert.equal(semanas[0].finSemana, '2026-09-27');
  assert.equal(semanas[1].finSemana, '2026-10-04');
  assert.equal(semanas[0].finSemana >= '2026-09-23', true);
  assert.equal(semanas[0].finSemana < '2026-09-28', true);
});
