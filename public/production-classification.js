function resolverPetipanNombre(nombre) {
  const original = String(nombre || '').trim();
  const limpio = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const coincidencia = limpio.match(/^(?:PETIT\s*PAN|PETI\s*PAN)(?:\s+(.*))?$/);
  if (!coincidencia) return null;
  const relleno = String(coincidencia[1] || '').replace(/\bMINI\b/g, '').replace(/\s+/g, ' ').trim();
  if (!relleno) return 'Petipan';
  if (/^(?:(?:DE|CON) )?POLLO(?: (?:CON|C)?)? PINA$/.test(relleno) || /^(?:(?:DE|CON) )?POLLO PINA$/.test(relleno)) {
    return 'Petipan de pollo c/piña';
  }
  if (/^(?:(?:DE|CON) )?POLLO(?: (?:CON|C)?)? DURAZNO$/.test(relleno) || /^(?:(?:DE|CON) )?POLLO DURAZNO$/.test(relleno)) {
    return 'Petipan de pollo c/durazno';
  }
  if (/^(?:(?:DE|CON) )?POLLO$/.test(relleno)) return 'Petipan de Pollo';
  // Un relleno no conocido se mantiene independiente: no se pierde bajo "Petipan".
  const originalRelleno = original.replace(/^(?:petit\s*pan|peti\s*pan)(?:\s+|$)/i, '')
    .replace(/\bmini\b/ig, '').replace(/\s+/g, ' ').trim();
  return `Petipan ${originalRelleno}`;
}

function grupoProductoProduccion(nombre, normalizar) {
  const clave = normalizar(nombre);
  if (/^(?:PETIPAN|PETIT PAN|PETITPAN|PETI PAN)(?:\s|$)/.test(clave)) {
    return /^(?:PETIPAN|PETIT PAN|PETITPAN|PETI PAN)(?:\s+MINI)?$/.test(clave) ? 'Panes' : 'Sándwiches y triples';
  }
  if (/\b(SANDWICH|SANGUCHE|TRIPLE|BUTIFARRA|CAPRESE|CAPRECCE)\b/.test(clave)
      || /\bCROISSANT\b.*\b(POLLO|MIXTO|JAMON|QUESO)\b/.test(clave)
      || /\b(?:FRANCES|ARABE|CIABATTA)\b.*\b(POLLO|ASADO|LOMITO|HAMBURGUESA)\b/.test(clave)) {
    return 'Sándwiches y triples';
  }
  if (/^(PAN|MINI|BAGUETINA|BAGUETTE|CIABATTA|CROISSANT|FRANCES|ARABE)\b/.test(clave)) return 'Panes';
  return 'Bocaditos';
}

function clasificarHojaProduccion(detalles, clientes, resolver, normalizar) {
  const nombres = new Map((clientes || []).map((cliente) => [Number(cliente.id), cliente.cliente_nombre || 'Cliente']));
  const principales = new Map();
  const especiales = new Map();

  for (const detalle of detalles || []) {
    const cantidad = Number(detalle.cantidad || 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    const nombre = String(resolverPetipanNombre(detalle.producto_nombre) || resolver(detalle.producto_nombre) || detalle.producto_nombre || 'Producto')
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
      if (!principales.has(llave)) principales.set(llave, { nombre: etiqueta, grupo: grupoProductoProduccion(nombre, normalizar), total: 0 });
      principales.get(llave).total += cantidad;
    }
  }

  const ordenar = (a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.cliente?.localeCompare(b.cliente || '', 'es') || 0;
  return {
    filas: [...principales.values()].sort((a, b) =>
      ['Bocaditos', 'Sándwiches y triples', 'Panes'].indexOf(a.grupo)
      - ['Bocaditos', 'Sándwiches y triples', 'Panes'].indexOf(b.grupo) || ordenar(a, b)),
    especiales: [...especiales.values()].sort(ordenar)
  };
}

if (typeof module !== 'undefined') module.exports = { clasificarHojaProduccion, resolverPetipanNombre, grupoProductoProduccion };
