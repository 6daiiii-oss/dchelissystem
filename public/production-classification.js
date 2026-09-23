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

function resolverCiabattaNombre(nombre) {
  const original = String(nombre || '').trim();
  const clave = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (!/\bCIABATTA\b/.test(clave)) return null;
  if (/\bCIABATTA\b.*\bHOT\s*DOG\b/.test(clave)) return 'Ciabatta con hotdog';
  // Evitar que una coincidencia parcial del catálogo elimine un relleno distinto.
  if (/^(?:MINI CIABATTA|CIABATTA|PAN CIABATTA MINI)$/.test(clave)) return 'Mini Ciabatta';
  return original;
}

function grupoProductoProduccion(nombre, normalizar) {
  const clave = normalizar(nombre);
  if (/\bEMPANADA\b.*\bBODA\b/.test(clave)) return 'Bocaditos';
  if (/\bCIABATTA\b/.test(clave) && !/^(?:SANDWICH|SANGUCHE|TRIPLE)\b/.test(clave)) return 'Panes';
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

function tipoItemCocina(nombre, cantidad, normalizar) {
  const clave = normalizar(nombre);
  const esKeke = /\b(KEKE|KEKES|QUEQUE|QUEQUES|CARROT|BUDIN)\b/.test(clave);
  const esPastel = /\b(TORTA|TORTITAS?|PIE|PYE|MOUSSE|CREMA|TRES LECHES)\b/.test(clave);
  const esTorta = esPastel && (/^TORTA\b/.test(clave) || Number(cantidad) < 10);
  return { esKeke, esTorta, esPastel, grupo: grupoProductoProduccion(nombre, normalizar) };
}

function filtrarItemsEmbalaje(detalles, resolver, normalizar) {
  const nombres = new Map();
  return (detalles || []).filter((detalle) => {
    const cantidad = Number(detalle.cantidad || 0);
    if (!(cantidad > 0)) return false;
    const original = detalle.producto_nombre;
    if (!nombres.has(original)) nombres.set(original, resolver(original) || original);
    const tipo = tipoItemCocina(nombres.get(original), cantidad, normalizar);
    return !tipo.esKeke && !tipo.esTorta;
  });
}

function clasificarHojaProduccion(detalles, clientes, resolver, normalizar) {
  const nombres = new Map((clientes || []).map((cliente) => [Number(cliente.id), cliente.cliente_nombre || 'Cliente']));
  const principales = new Map();
  const especiales = new Map();

  for (const detalle of detalles || []) {
    const cantidad = Number(detalle.cantidad || 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    const nombre = String(resolverPetipanNombre(detalle.producto_nombre) || resolverCiabattaNombre(detalle.producto_nombre)
      || resolver(detalle.producto_nombre) || detalle.producto_nombre || 'Producto')
      .replace(/^(?:KEKES\s+)+(?=KEKE\b)/i, '').trim();
    const clave = normalizar(nombre);
    const { esKeke, esPastel, esTorta, grupo } = tipoItemCocina(nombre, cantidad, normalizar);

    if (esKeke || esTorta) {
      const cliente = nombres.get(Number(detalle.pedido_id)) || 'Cliente';
      const etiqueta = esKeke ? nombre : `${nombre} (TORTA)`;
      const llave = esKeke ? `keke:${clave}` : `torta:${clave}:${Number(detalle.pedido_id)}`;
      if (!especiales.has(llave)) especiales.set(llave, { nombre: etiqueta, cliente: esKeke ? '' : cliente, total: 0 });
      especiales.get(llave).total += cantidad;
    } else {
      const etiqueta = esPastel ? `${nombre} (BOCADITOS)` : nombre;
      const llave = `principal:${clave}`;
      if (!principales.has(llave)) principales.set(llave, { nombre: etiqueta, grupo, total: 0 });
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

if (typeof module !== 'undefined') module.exports = {
  clasificarHojaProduccion, resolverPetipanNombre, resolverCiabattaNombre,
  grupoProductoProduccion, tipoItemCocina, filtrarItemsEmbalaje
};
