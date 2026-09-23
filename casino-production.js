function extraerPedidosCasino(cronograma, fecha, resolverProducto) {
  const dia = cronograma?.dias?.find((item) => item.fecha === fecha);
  if (!dia) return { clientes: [], detalles: [] };

  const casinos = Array.isArray(dia.casinos) ? dia.casinos : cronograma.casinos || [];
  const clientes = [];
  const detalles = [];
  for (let indice = 0; indice < casinos.length; indice += 1) {
    const casino = casinos[indice];
    const id = -(indice + 1);
    const items = [];
    for (const producto of dia.productos || []) {
      const cantidad = Number(producto?.por_casino?.[casino] || 0);
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
      items.push({
        pedido_id: id,
        origen: 'casino',
        tipo_cliente: 'Casino',
        fecha_recoge: fecha,
        hora_recoge: '12:00',
        es_urgente: false,
        producto_nombre: resolverProducto(producto.nombre),
        producto_nombre_original: producto.nombre,
        cantidad,
        paquetes: {},
        foto_torta: ''
      });
    }
    if (!items.length) continue;
    clientes.push({
      id,
      cliente_nombre: casino,
      tipo_cliente: 'Casino',
      origen: 'casino',
      fecha_recoge: fecha,
      hora_recoge: '12:00',
      es_urgente: false
    });
    detalles.push(...items);
  }
  return { clientes, detalles };
}

module.exports = { extraerPedidosCasino };
