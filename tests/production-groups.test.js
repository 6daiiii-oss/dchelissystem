const assert = require('node:assert/strict');
const test = require('node:test');
const { clasificarHojaProduccion, resolverPetipanNombre, grupoProductoProduccion } = require('../public/production-classification');

const normalizar = (nombre) => String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

test('petit pan mini es pan genérico, mientras los rellenos siguen separados', () => {
  assert.equal(resolverPetipanNombre('Petit pan mini'), 'Petipan');
  assert.equal(resolverPetipanNombre('petipan'), 'Petipan');
  assert.equal(resolverPetipanNombre('Petit pan de pollo'), 'Petipan de Pollo');
  assert.equal(resolverPetipanNombre('Petit pan mini pollo con piña'), 'Petipan de pollo c/piña');
  assert.equal(resolverPetipanNombre('Petipan de pollo c/durazno'), 'Petipan de pollo c/durazno');
  assert.equal(resolverPetipanNombre('Petipan pollo crispy'), 'Petipan pollo crispy');
  assert.equal(resolverPetipanNombre('Petipan con jamón'), 'Petipan con jamón');
  assert.equal(resolverPetipanNombre('Pan de hamburguesa'), null);
});

test('bocaditos primero, rellenos después y panes al final, sin alterar cantidades', () => {
  const entradas = [
    ['Sandwich de Asado', 12], ['Petipan de Pollo', 25], ['Petit pan mini', 30],
    ['Empanada pollo', 20], ['Pan de Molde Integral', 8], ['Triple pollo', 15],
    ['Petit pan mini', 10], ['Petipan pollo crispy', 5], ['Mini Ciabatta', 6],
    ['Pye de limón', 15], ['Pye de limón', 1]
  ];
  const detalles = entradas.map(([producto_nombre, cantidad], i) => ({ producto_nombre, cantidad, pedido_id: i + 1 }));
  const clientes = entradas.map((_, i) => ({ id: i + 1, cliente_nombre: `Cliente ${i + 1}` }));
  const { filas, especiales } = clasificarHojaProduccion(detalles, clientes, () => null, normalizar);
  assert.deepEqual(filas.map((item) => [item.grupo, item.nombre, item.total]), [
    ['Bocaditos', 'Empanada pollo', 20],
    ['Bocaditos', 'Pye de limón (BOCADITOS)', 15],
    ['Sándwiches y triples', 'Petipan de Pollo', 25],
    ['Sándwiches y triples', 'Petipan pollo crispy', 5],
    ['Sándwiches y triples', 'Sandwich de Asado', 12],
    ['Sándwiches y triples', 'Triple pollo', 15],
    ['Panes', 'Mini Ciabatta', 6],
    ['Panes', 'Pan de Molde Integral', 8],
    ['Panes', 'Petipan', 40]
  ]);
  assert.deepEqual(especiales.map((item) => [item.nombre, item.total]), [['Pye de limón (TORTA)', 1]]);
  assert.equal(grupoProductoProduccion('Croissant con Pollo', normalizar), 'Sándwiches y triples');
  assert.equal(grupoProductoProduccion('Mini Croissant', normalizar), 'Panes');
});
