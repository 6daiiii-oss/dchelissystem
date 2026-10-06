const { normalizarCategoriaOperativa, grupoProductoProduccion } = require('./public/production-classification');

const GRUPOS_HPE = new Set(['Sándwiches', 'Triples', 'Piqueos']);

function fechaAnterior(fecha) {
  const date = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function fechaTrabajo(pedido, grupo) {
  const entrega = String(pedido.fecha_recoge || '');
  const anterior = fechaAnterior(entrega);
  if (!anterior) return '';
  if (GRUPOS_HPE.has(grupo)) return entrega;
  // Los panes nunca se desplazan por la hora de alta o de entrega.
  if (grupo === 'Panes') return anterior;
  // Importar un cronograma no equivale a registrar un pedido tardío.
  if (String(pedido.origen || '').toLowerCase() === 'casino' && Number(pedido.cronograma_casino_id) > 0) return anterior;
  const emision = pedido.fecha_emision || pedido.fecha_registro;
  if (!emision) return anterior;
  const instante = new Date(emision);
  if (Number.isNaN(instante.getTime())) throw new Error('El pedido tiene una fecha de emisión inválida.');
  return instante >= new Date(`${anterior}T08:00:00-05:00`) ? entrega : anterior;
}

// Una sola lectura de detalles persistidos alimenta las tres vistas. Las vistas
// seleccionan filas de este registro; nunca vuelven a interpretar el Excel.
function construirHojasOperativas(fecha, pedidos, rows, opciones) {
  const { prepararCasino, resolverProducto, normalizar, urgente } = opciones;
  const pedidosPorId = new Map(pedidos.map(p => [Number(p.id), p]));
  const registro = rows.map(row => {
    const pedido = pedidosPorId.get(Number(row.pedido_id));
    if (!pedido) throw new Error('Detalle sin pedido en el registro de embalaje.');
    const base = String(pedido.origen || '').toLowerCase() === 'casino'
      ? prepararCasino(row) : { ...row, producto_nombre: resolverProducto(row.producto_nombre), producto_nombre_original: row.producto_nombre };
    if (!String(base.producto_nombre || '').trim()) throw new Error('Producto sin nombre en el registro de embalaje.');
    const grupo = normalizarCategoriaOperativa(base.categoria_operativa)
      || grupoProductoProduccion(base.producto_nombre, normalizar);
    const trabajo = fechaTrabajo(pedido, grupo);
    const esHpe = GRUPOS_HPE.has(grupo);
    let paquetes = row.paquetes || {};
    if (typeof paquetes === 'string') paquetes = JSON.parse(paquetes);
    const cantidad = Number(row.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida en el registro de embalaje.');
    return {
      ...base,
      origen: pedido.origen || 'pg', tipo_cliente: pedido.tipo_cliente || 'Cliente',
      fecha_recoge: pedido.fecha_recoge,
      hora_recoge: pedido.origen === 'casino' ? '09:00' : pedido.hora_recoge,
      categoria_operativa: grupo, grupo_operativo: grupo,
      fecha_produccion: trabajo,
      fecha_hp: esHpe ? null : trabajo, fecha_he: esHpe ? null : trabajo,
      fecha_hpe: esHpe ? trabajo : null,
      es_urgente: !esHpe && grupo !== 'Panes' && urgente(fecha, pedido, grupo),
      cantidad, paquetes, foto_torta: row.foto_torta || ''
    };
  });
  const vista = detalles => {
    const ids = new Set(detalles.map(d => Number(d.pedido_id)));
    return { fecha, detalles, clientes: pedidos.filter(p => ids.has(Number(p.id))).map(p => ({
      ...p, hora_recoge: p.origen === 'casino' ? '09:00' : p.hora_recoge,
      es_urgente: detalles.some(d => Number(d.pedido_id) === Number(p.id) && d.es_urgente)
    })) };
  };
  const embalaje = vista(registro.filter(d => d.fecha_he === fecha));
  const produccion = vista(embalaje.detalles);
  const produccionEmbalaje = vista(registro.filter(d => d.fecha_hpe === fecha));
  return { fecha, clientes: produccion.clientes, detalles: produccion.detalles,
    embalaje, produccion_embalaje: produccionEmbalaje };
}

function verificarImportacion(cronograma, rows) {
  const esperadas = [];
  for (const dia of cronograma.dias || []) for (const producto of dia.productos || []) {
    for (const [casino, cantidad] of Object.entries(producto.por_casino || {})) {
      if (!(Number(cantidad) > 0)) continue;
      esperadas.push(JSON.stringify([dia.fecha, casino, producto.clave_fuente,
        producto.nombre_fuente || producto.nombre, producto.nombre_fuente || producto.nombre,
        producto.categoria_fuente || '', Number(cantidad)]));
    }
  }
  const reales = rows.map(row => JSON.stringify([row.fecha_recoge, row.casino_nombre,
    row.casino_clave_fuente, row.producto_nombre_fuente, row.producto_nombre,
    row.casino_categoria_fuente || '', Number(row.cantidad)]));
  esperadas.sort(); reales.sort();
  if (esperadas.length !== reales.length || esperadas.some((fila, i) => fila !== reales[i])) {
    throw new Error('La importación no coincide con las celdas del Excel. No se guardó ningún pedido.');
  }
  return esperadas.length;
}

module.exports = { GRUPOS_HPE, fechaTrabajo, construirHojasOperativas, verificarImportacion };
