function normalizarBaseProduccion(nombre) {
  return String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolverPetipanNombre(nombre) {
  const original = String(nombre || '').trim();
  const limpio = normalizarBaseProduccion(original)
    .replace(/^(?:MINI|MINNI)\s+/, '')
    .replace(/^PAN\s+/, '')
    .replace(/\s+(?:CHICO|PEQUENO)(?:\s+X\s*\d+\s*UND)?$/, '')
    .trim();
  const coincidencia = limpio.match(/^(?:PETIT\s*PAN|PETI\s*PAN|PETIPAN|PETITPAN)(?:\s+(.*))?$/);
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
  const originalRelleno = original
    .replace(/^(?:(?:mini|minni)\s+)?(?:pan\s+)?(?:petit\s*pan|peti\s*pan|petipan|petitpan)(?:\s+|$)/i, '')
    .replace(/\bmini\b/ig, '').replace(/\s+/g, ' ').trim();
  return originalRelleno ? `Petipan ${originalRelleno}` : 'Petipan';
}

function resolverCiabattaNombre(nombre) {
  const original = String(nombre || '').trim();
  const clave = normalizarBaseProduccion(original);
  if (!/\bCIABATTA\b/.test(clave)) return null;
  if (/\bCIABATTA\b.*\bHOT\s*DOG\b/.test(clave)) return 'Ciabatta con hotdog';
  if (/^(?:(?:MINI|MINNI)\s+CIABATTA|CIABATTA|PAN\s+CIABATTA\s+(?:MINI|CHICO)(?:\s+X\s*\d+\s*UND)?)$/.test(clave)) {
    return 'Mini Ciabatta';
  }
  return original;
}

function grupoProductoProduccion(nombre, normalizar) {
  const clave = normalizar(nombre);
  if (/\bEMPANADA\b.*\bBODA\b/.test(clave)) return 'Bocaditos';

  if (/\b(BROCHETAS?|ALITAS?\s+BOUCHET|GUINDONES?|ESPARRAGOS?|HOJARASCAS?|TEQUENOS?|VOULEVANS?|CANAPES?)\b/.test(clave)
      || /\bPIONONIT(?:O|OS)\b.*\bESPINACA\b/.test(clave)) {
    return 'Piqueos';
  }

  if (/^TRIPLE(?:S)?\b/.test(clave)) return 'Triples';

  if (/^(?:PETIPAN|PETIT PAN|PETITPAN|PETI PAN)(?:\s|$)/.test(clave)) {
    return /^(?:PETIPAN|PETIT PAN|PETITPAN|PETI PAN)(?:\s+MINI)?$/.test(clave) ? 'Panes' : 'Sándwiches';
  }

  if (/\b(SANDWICH|SANGUCHE|BUTIFARRA|CAPRESE|CAPRECCE)\b/.test(clave)
      || /\bCROISSANT\b.*\b(POLLO|MIXTO|JAMON|QUESO)\b/.test(clave)
      || /\b(?:FRANCES|ARABE|CIABATTA)\b.*\b(POLLO|ASADO|LOMITO|HAMBURGUESA)\b/.test(clave)) {
    return 'Sándwiches';
  }

  if (/\bCIABATTA\b/.test(clave) && !/^(?:SANDWICH|SANGUCHE|TRIPLE)\b/.test(clave)) return 'Panes';
  if (/^(PAN|MINI|MINNI|BAGUETINA|BAGUETTE|BAGUETINO|CIABATTA|CROISSANT|FRANCES|ARABE|PULLMAN|PULMAN|ROSETA)\b/.test(clave)) return 'Panes';

  return 'Bocaditos';
}

function resolverPyePorCantidad(nombre, cantidad, normalizar) {
  const original = String(nombre || '').trim();
  const clave = normalizar(original);
  if (!/\b(PIE|PYE)\b/.test(clave)) return original;

  const unidades = Number(cantidad || 0);
  const eraTortaExplicita = /^TORTA\b/.test(clave);

  let base = original.replace(/^TORTA\s+/i, '').trim();
  const claveBase = normalizar(base);
  if (/\bLIMON\b/.test(claveBase)) base = 'Pye de Limón';
  else if (/\bMANZANA\b/.test(claveBase)) base = 'Pye de Manzana';
  else {
    base = base
      .replace(/^PIE\b/i, 'Pye')
      .replace(/^PYE\b/i, 'Pye')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (unidades > 0 && unidades <= 5) return `Torta ${base}`;
  if (unidades >= 10) return base;
  if (eraTortaExplicita) return `Torta ${base}`;
  return base;
}

function tipoItemCocina(nombre, cantidad, normalizar) {
  const nombreAjustado = resolverPyePorCantidad(nombre, cantidad, normalizar);
  const clave = normalizar(nombreAjustado);
  const esKeke = /\b(KEKE|KEKES|QUEQUE|QUEQUES|CARROT|BUDIN)\b/.test(clave);
  const esPastel = /\b(TORTA|TORTITAS?|PIE|PYE|MOUSSE|CREMA|TRES LECHES)\b/.test(clave);
  const esTorta = /^TORTA\b/.test(clave) && !/^TORTITA\b/.test(clave);
  return { esKeke, esTorta, esPastel, grupo: grupoProductoProduccion(nombreAjustado, normalizar), nombreAjustado };
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

function clasificarHojaProduccion(detalles, clientes, resolver, normalizar, ordenReferencia = []) {
  const nombres = new Map((clientes || []).map((cliente) => [Number(cliente.id), cliente.cliente_nombre || 'Cliente']));
  const principales = new Map();
  const especiales = new Map();
  const orden = new Map((ordenReferencia || []).map((nombre, indice) => [normalizar(nombre), indice]));
  const grupos = ['Bocaditos', 'Sándwiches', 'Triples', 'Piqueos', 'Panes'];

  const acumularTurno = (destino, detalle, cantidad) => {
    if (detalle?.es_urgente) destino.urgente += cantidad;
    else destino.normal += cantidad;
    destino.total += cantidad;
  };

  for (const detalle of detalles || []) {
    const cantidad = Number(detalle.cantidad || 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    const nombreBase = String(
      resolverPetipanNombre(detalle.producto_nombre)
      || resolverCiabattaNombre(detalle.producto_nombre)
      || resolver(detalle.producto_nombre)
      || detalle.producto_nombre
      || 'Producto'
    ).replace(/^(?:KEKES\s+)+(?=KEKE\b)/i, '').trim();

    const fuenteTipo = detalle.producto_nombre_original || detalle.producto_nombre || nombreBase;
    const tipo = tipoItemCocina(fuenteTipo, cantidad, normalizar);
    const nombre = resolverPyePorCantidad(nombreBase, cantidad, normalizar);
    const clave = normalizar(nombre);
    const esKeke = tipo.esKeke;
    const esPastel = tipo.esPastel;
    const esTorta = tipo.esTorta;
    const grupo = grupoProductoProduccion(nombre, normalizar);

    if (esKeke || esTorta) {
      const cliente = nombres.get(Number(detalle.pedido_id)) || 'Cliente';
      const etiqueta = esKeke ? nombre : (nombre.toUpperCase().startsWith('TORTA ') ? nombre : `Torta ${nombre}`);
      const llave = esKeke ? `keke:${clave}` : `torta:${clave}:${Number(detalle.pedido_id)}`;
      if (!especiales.has(llave)) {
        especiales.set(llave, {
          nombre: etiqueta,
          cliente: esKeke ? '' : cliente,
          tipo: esKeke ? 'keke' : 'torta',
          urgente: 0,
          normal: 0,
          total: 0
        });
      }
      acumularTurno(especiales.get(llave), detalle, cantidad);
      continue;
    }

    const etiqueta = esPastel ? `${nombre} (BOCADITOS)` : nombre;
    const llave = `principal:${clave}`;
    if (!principales.has(llave)) {
      principales.set(llave, { nombre: etiqueta, grupo, urgente: 0, normal: 0, total: 0, orden: orden.get(clave) ?? 99999 });
    }
    acumularTurno(principales.get(llave), detalle, cantidad);
  }

  const ordenarTexto = (a, b) => a.nombre.localeCompare(b.nombre, 'es') || String(a.cliente || '').localeCompare(String(b.cliente || ''), 'es');
  return {
    filas: [...principales.values()].sort((a, b) =>
      grupos.indexOf(a.grupo) - grupos.indexOf(b.grupo)
      || a.orden - b.orden
      || ordenarTexto(a, b)
    ),
    especiales: [...especiales.values()].sort((a, b) =>
      (a.tipo === 'keke' ? 0 : 1) - (b.tipo === 'keke' ? 0 : 1) || ordenarTexto(a, b)
    )
  };
}

if (typeof module !== 'undefined') module.exports = {
  clasificarHojaProduccion, resolverPetipanNombre, resolverCiabattaNombre,
  grupoProductoProduccion, tipoItemCocina, filtrarItemsEmbalaje, resolverPyePorCantidad
};
