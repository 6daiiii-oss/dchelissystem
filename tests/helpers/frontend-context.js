const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../../public/admin.html'), 'utf8');
const classification = require('../../public/production-classification');
function frontendContext(resolver = s => s) {
  const containers = {};
  const context = { ...classification, window: {},
    document: { getElementById: id => containers[id] ||= { innerHTML: '', value: '2026-10-05' } },
    normalizarNombreProducto: s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
    obtenerProductoResolucion: resolver, resolverProductoNombres: () => [], obtenerProductosExtraParaProduccion: () => [],
    escapeHtmlAdmin: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    formatearFecha: String, formatearCantidadCasino: String
  };
  vm.createContext(context);
  for (const [start, end] of [['filtrarDetallesEmbalaje', '  function obtenerProductoResolucion'],
    ['ordenarClientesEmbalaje', '  async function cargarMatriz'],
    ['obtenerResumenPaquetesDesdeCantidades', '    function obtenerTextoItem']]) {
    const first = html.indexOf(`function ${start}(`);
    vm.runInContext(html.slice(first, html.indexOf(end, first)), context);
  }
  return { context, containers };
}
module.exports = { frontendContext };
