function claveNombreProduccion(nombre) {
  return String(nombre || '').normalize('NFC').trim();
}

// Los pedidos de casinos conservan el texto de la celda, sin aliases del catálogo.
function nombreDetalleProduccion(detalle, resolver = (nombre) => nombre) {
  if (String(detalle?.origen || '').toLowerCase() === 'casino' || detalle?.producto_nombre_fuente) {
    return String(detalle.producto_nombre_fuente || detalle.producto_nombre_original || detalle.producto_nombre || '').trim();
  }
  return resolver(detalle?.producto_nombre) || detalle?.producto_nombre || 'Producto';
}

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
  const esCiabatta = /\bCIABAT[A-Z]*\b/.test(clave);
  if (!esCiabatta) return null;
  if (/\bCIABAT[A-Z]*\b.*\bHOT\s*DOG\b/.test(clave)) return 'Ciabatta con hotdog';
  if (/\bCIABAT[A-Z]*\b.*\bCHORIZO\b/.test(clave)) return 'Ciabatta con chorizo';
  if (/^(?:(?:MINI|MINNI)\s+CIABAT[A-Z]*|CIABAT[A-Z]*|PAN\s+CIABAT[A-Z]*\s+(?:MINI|CHICO)(?:\s+X\s*\d+\s*UND)?)$/.test(clave)) {
    return 'Mini Ciabatta';
  }
  return original;
}

function grupoProductoProduccion(nombre, normalizar) {
  const clave = normalizar(nombre);
  if (/\bEMPANADA\b.*\bBODA\b/.test(clave)) return 'Bocaditos';

  // Excepciones operativas que deben conservar su propia familia.
  if (/\bENROLLADO\b.*\bJAMON\b.*\bESPARRAGOS?\b/.test(clave)
      || /\bPIONON(?:O|ITO|ITOS)\b.*\bESPINACA\b/.test(clave)) {
    return 'Triples';
  }

  if (/^TRIPLE(?:S)?\b/.test(clave)) return 'Triples';

  if (/\bMAIZ\b.*\bLOMO\b/.test(clave) || /^YEMITAS?\b/.test(clave)) return 'Panes';

  if (/^(?:PETIPAN|PETIT PAN|PETITPAN|PETI PAN)(?:\s|$)/.test(clave)) {
    return /^(?:PETIPAN|PETIT PAN|PETITPAN|PETI PAN)(?:\s+MINI)?$/.test(clave) ? 'Panes' : 'Sándwiches';
  }

  if (/\b(SANDWICH|SANGUCHE|BUTIFARRA|CAPRESE|CAPRECCE)\b/.test(clave)) {
    return 'Sándwiches';
  }

  // En cronogramas de Casinos, el tipo de pan forma parte de la identidad del
  // sánguche. Una fila "Francesito con asado" no puede fusionarse con
  // "Ciabattita con asado". Cualquier base de pan con relleno se trata como
  // Sándwich; la pieza de pan sola continúa en Panes.
  const baseRellena = clave.match(/^(?:MINI |MINNI )?(FRANCES(?:ITO)?|CIABAT[A-Z]*|CROISSANT|CROSSAINT|CAMOTE|MAIZ|ARABE|ARABITO|BAGUETINO)\b/);
  if (baseRellena) {
    const resto = clave.slice(baseRellena[0].length).trim();
    if (resto && !/^(?:MINI|CHICO|PEQUENO|SIN RELLENO)(?: X \d+ UND)?$/.test(resto)) return 'Sándwiches';
  }

  if (/^PIQUEOS?\b/.test(clave)
      || /\b(BROCHETAS?|ALITAS?\s+BOUCHET|GUINDONES?|ESPARRAGOS?|HOJARASCAS?|TEQUENOS?|VOULEVANS?|CANAPES?)\b/.test(clave)) {
    return 'Piqueos';
  }

  if (/\bCIABAT[A-Z]*\b/.test(clave) && !/^(?:SANDWICH|SANGUCHE|TRIPLE)\b/.test(clave)) return 'Panes';
  if (/^(PAN|MINI|MINNI|BAGUETINA|BAGUETTE|BAGUETINO|CIABAT[A-Z]*|CROISSANT|CROSSAINT|FRANCES|ARABE|ARABITO|PULLMAN|PULMAN|ROSETA)\b/.test(clave)) return 'Panes';

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
  const unidades = Number(cantidad || 0);
  const esKeke = /\b(KEKE|KEKES|QUEQUE|QUEQUES|CARROT|BUDIN)\b/.test(clave);
  const esPastel = /^TORTA\b/.test(clave)
    || /^TORTITAS?\b/.test(clave)
    || /^MOUSSE\b/.test(clave)
    || /^CREMA\s+VOLTEADA\b/.test(clave)
    || /^TRES\s+LECHES\b/.test(clave)
    || /^CHEESE\s*CAKE\b/.test(clave)
    || /^CHEESECAKE\b/.test(clave)
    || /\b(PIE|PYE)\b/.test(clave);
  const esPostreEnteroPorCantidad = unidades > 0 && unidades <= 5 && (
    /^TORTITAS?\b/.test(clave)
    || /^MOUSSE\b/.test(clave)
    || /^CREMA\s+VOLTEADA\b/.test(clave)
    || /^TRES\s+LECHES\b/.test(clave)
    || /^CHEESE\s*CAKE\b/.test(clave)
    || /^CHEESECAKE\b/.test(clave)
  );
  const esTorta = (/^TORTA\b/.test(clave) && !/^TORTITA\b/.test(clave)) || esPostreEnteroPorCantidad;
  return { esKeke, esTorta, esPastel, grupo: grupoProductoProduccion(nombreAjustado, normalizar), nombreAjustado };
}

function normalizarCategoriaOperativa(valor) {
  const clave = normalizarBaseProduccion(valor);
  const mapa = {
    BOCADITO: 'Bocaditos', BOCADITOS: 'Bocaditos',
    SANDWICH: 'Sándwiches', SANDWICHES: 'Sándwiches', SANGUCHE: 'Sándwiches', SANGUCHES: 'Sándwiches',
    TRIPLE: 'Triples', TRIPLES: 'Triples',
    PIQUEO: 'Piqueos', PIQUEOS: 'Piqueos',
    PAN: 'Panes', PANES: 'Panes',
    TORTA: 'Tortas', TORTAS: 'Tortas',
    KEKE: 'Kekes', KEKES: 'Kekes', QUEQUE: 'Kekes', QUEQUES: 'Kekes'
  };
  return mapa[clave] || '';
}

function filtrarItemsEmbalaje(detalles, resolver, normalizar) {
  const nombres = new Map();
  return (detalles || []).filter((detalle) => {
    const cantidad = Number(detalle.cantidad || 0);
    if (!(cantidad > 0)) return false;
    const categoriaManual = normalizarCategoriaOperativa(detalle.categoria_operativa);
    if (categoriaManual === 'Tortas' || categoriaManual === 'Kekes') return false;
    if (categoriaManual) return true;
    const original = `${detalle.origen || 'pg'}::${nombreDetalleProduccion(detalle)}`;
    if (!nombres.has(original)) nombres.set(original, nombreDetalleProduccion(detalle, resolver));
    const tipo = tipoItemCocina(nombres.get(original), cantidad, normalizar);
    return !tipo.esKeke && !tipo.esTorta;
  });
}

function clasificarHojaProduccion(detalles, clientes, resolver, normalizar, ordenReferencia = []) {
  const nombres = new Map((clientes || []).map((cliente) => [Number(cliente.id), cliente.cliente_nombre || 'Cliente']));
  const principales = new Map();
  const especiales = new Map();
  const orden = new Map((ordenReferencia || []).map((nombre, indice) => [normalizar(nombre), indice]));
  const grupos = ['Bocaditos', 'Sándwiches', 'Piqueos', 'Triples', 'Panes'];

  const acumularTurno = (destino, detalle, cantidad) => {
    if (detalle?.es_urgente) destino.urgente += cantidad;
    else destino.normal += cantidad;
    destino.total += cantidad;
  };

  for (const detalle of detalles || []) {
    const cantidad = Number(detalle.cantidad || 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    const fuenteTipo = detalle.producto_nombre_original || detalle.producto_nombre || 'Producto';
    const esCasino = String(detalle.origen || '').toLowerCase() === 'casino' || Boolean(detalle.producto_nombre_fuente);
    const conservarIdentidadCasino = esCasino || /^(?:TRIPLES?|SANDWICH|SANGUCHE|FRANCES(?:ITO)?|CIABAT[A-Z]*|CROISSANT|CROSSAINT|CAMOTE|MAIZ|ARABE|ARABITO|BAGUETINO|BAGUETINA)\b/.test(normalizar(fuenteTipo)) || /^(?:PAN )?FRANCES MINI$/.test(normalizar(fuenteTipo));
    const nombreBase = String(
      (conservarIdentidadCasino ? fuenteTipo : null)
      || resolverPetipanNombre(detalle.producto_nombre)
      || resolverNombreEspecialProduccion(detalle.producto_nombre)
      || resolver(detalle.producto_nombre)
      || detalle.producto_nombre
      || 'Producto'
    ).replace(/^(?:KEKES\s+)+(?=KEKE\b)/i, '').trim();

    const tipo = tipoItemCocina(fuenteTipo, cantidad, normalizar);
    const categoriaManual = normalizarCategoriaOperativa(detalle.categoria_operativa);
    const nombre = esCasino ? nombreDetalleProduccion(detalle) : resolverPyePorCantidad(nombreBase, cantidad, normalizar);
    const clave = esCasino ? claveNombreProduccion(nombre) : normalizar(nombre);
    const esKeke = categoriaManual === 'Kekes' || (!categoriaManual && tipo.esKeke);
    const esTorta = categoriaManual === 'Tortas' || (!categoriaManual && tipo.esTorta);
    const esPastel = esTorta || (!categoriaManual && tipo.esPastel);
    const grupo = ['Bocaditos', 'Sándwiches', 'Piqueos', 'Triples', 'Panes'].includes(categoriaManual)
      ? categoriaManual
      : grupoProductoProduccion(nombre, normalizar);

    if (esKeke || esTorta) {
      const cliente = nombres.get(Number(detalle.pedido_id)) || 'Cliente';
      const etiqueta = nombre;
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

    const etiqueta = !esCasino && esPastel ? `${nombre} (BOCADITOS)` : nombre;
    const llave = `principal:${grupo}:${clave}`;
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

function resolverNombreEspecialProduccion(nombre) {
  const original = String(nombre || '').trim();
  const clave = normalizarBaseProduccion(original);
  if (/\bENROLLADO\b.*\bJAMON\b.*\bESPARRAGOS?\b/.test(clave)) return 'Enrollado de jamón con espárragos';
  if (/\bPIONON(?:O|ITO|ITOS)\b.*\bESPINACA\b/.test(clave)) return 'Pionono con espinaca';
  if (/\bMAIZ\b.*\bLOMO\b/.test(clave)) return 'Maíz lomo';
  if (/^YEMITAS?\b/.test(clave)) return 'Yemita';
  return resolverCiabattaNombre(original);
}

if (typeof module !== 'undefined') module.exports = {
  claveNombreProduccion, nombreDetalleProduccion, clasificarHojaProduccion, resolverPetipanNombre, resolverCiabattaNombre,
  grupoProductoProduccion, tipoItemCocina, filtrarItemsEmbalaje, resolverPyePorCantidad,
  resolverNombreEspecialProduccion, normalizarCategoriaOperativa
};
