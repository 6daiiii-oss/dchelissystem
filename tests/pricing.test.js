const assert = require('assert');
const { calcularSubtotal, obtenerPreciosProducto } = require('../public/pricing.js');

const producto = {
  id: 1,
  nombre: 'Empanada de carne',
  categoria: 'Bocaditos Salados',
  precio: null,
  precios: { x100: 80, x50: 45, x25: 22 }
};

assert.strictEqual(calcularSubtotal(producto, 125), 100.00);
assert.strictEqual(calcularSubtotal({ precio: 5, precios: null }, 3), 15.00);
assert.strictEqual(obtenerPreciosProducto(producto).precioUnitario, 0.8);
console.log('pricing tests ok');
