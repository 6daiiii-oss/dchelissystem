const assert = require('node:assert/strict');
const test = require('node:test');
const { extraerPedidosCasino } = require('../casino-production');

const cronograma = {
  casinos: ['Casino Norte', 'Casino Sur'],
  dias: [{
    fecha: '2026-09-24',
    casinos: ['Casino Norte', 'Casino Sur'],
    productos: [
      { nombre: 'Empanada de pollo', por_casino: { 'Casino Norte': 30, 'Casino Sur': 25 }, total: 55 },
      { nombre: 'Keke vainilla', por_casino: { 'Casino Sur': 2 }, total: 2 },
      { nombre: 'Producto sin alias', por_casino: { 'Casino Norte': 1 }, total: 1 }
    ]
  }]
};

test('Cocina recibe los mismos ítems de cada casino sin combinarlos ni perder nombres desconocidos', () => {
  const { clientes, detalles } = extraerPedidosCasino(cronograma, '2026-09-24', (nombre) =>
    nombre === 'Empanada de pollo' ? 'Empanada pollo' : nombre
  );
  assert.deepEqual(clientes.map((item) => [item.id, item.cliente_nombre, item.origen, item.hora_recoge]), [
    [-1, 'Casino Norte', 'casino', '12:00'],
    [-2, 'Casino Sur', 'casino', '12:00']
  ]);
  assert.deepEqual(detalles.map((item) => [item.pedido_id, item.producto_nombre, item.cantidad]), [
    [-1, 'Empanada pollo', 30],
    [-1, 'Producto sin alias', 1],
    [-2, 'Empanada pollo', 25],
    [-2, 'Keke vainilla', 2]
  ]);
  assert.ok(detalles.every((item) => item.origen === 'casino' && !item.es_urgente && item.fecha_recoge === '2026-09-24'));
});

test('un día ausente no agrega pedidos a la producción', () => {
  assert.deepEqual(extraerPedidosCasino(cronograma, '2026-09-25', (nombre) => nombre), { clientes: [], detalles: [] });
});
