function clasificarHojaProduccion(detalles, clientes, resolver, normalizar) {
  const nombres = new Map((clientes || []).map((cliente) => [Number(cliente.id), cliente.cliente_nombre || 'Cliente']));
  const principales = new Map();
  const especiales = new Map();

  for (const detalle of detalles || []) {
    const cantidad = Number(detalle.cantidad || 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    const nombre = String(resolver(detalle.producto_nombre) || detalle.producto_nombre || 'Producto')
      .replace(/^(?:KEKES\s+)+(?=KEKE\b)/i, '').trim();
    const clave = normalizar(nombre);
    const esKeke = /\b(KEKE|KEKES|QUEQUE|QUEQUES|CARROT|BUDIN)\b/.test(clave);
    const esPastel = /\b(TORTA|TORTITAS?|PIE|PYE|MOUSSE|CREMA|TRES LECHES)\b/.test(clave);
    // En estos productos el nombre describe el sabor; la cantidad indica
    // si se trata de torta individual o bocaditos del mismo sabor.
    const esTorta = esPastel && cantidad < 10;

    if (esKeke || esTorta) {
      const cliente = nombres.get(Number(detalle.pedido_id)) || 'Cliente';
      const etiqueta = esKeke ? nombre : `${nombre} (TORTA)`;
      const llave = esKeke ? `keke:${clave}` : `torta:${clave}:${Number(detalle.pedido_id)}`;
      if (!especiales.has(llave)) especiales.set(llave, { nombre: etiqueta, cliente: esKeke ? '' : cliente, total: 0 });
      especiales.get(llave).total += cantidad;
    } else {
      const etiqueta = esPastel ? `${nombre} (BOCADITOS)` : nombre;
      const llave = `principal:${clave}`;
      if (!principales.has(llave)) principales.set(llave, { nombre: etiqueta, total: 0 });
      principales.get(llave).total += cantidad;
    }
  }

  const ordenar = (a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.cliente?.localeCompare(b.cliente || '', 'es') || 0;
  return {
    filas: [...principales.values()].sort(ordenar),
    especiales: [...especiales.values()].sort(ordenar)
  };
}

if (typeof module !== 'undefined') module.exports = { clasificarHojaProduccion };
