const assert = require('assert');
const { calcularRestante, parsearLineasDetalle } = require('../orderUtils');

assert.strictEqual(calcularRestante(250, 90), 160);
assert.strictEqual(calcularRestante(100, 200), 0);

const detalle = parsearLineasDetalle('2 x Brownies\n1 x Torta Chantilly');
assert.deepStrictEqual(detalle, [
  { producto_nombre: 'Brownies', cantidad: 2 },
  { producto_nombre: 'Torta Chantilly', cantidad: 1 }
]);

console.log('order utils tests ok');
