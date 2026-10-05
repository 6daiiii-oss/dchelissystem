const {
  resolverPetipanNombre,
  resolverCiabattaNombre,
  grupoProductoProduccion,
  normalizarCategoriaOperativa
} = require('./public/production-classification');

function normalizar(nombre) {
  return String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function nombreFuenteProducto(producto) {
  return String(producto?.nombre_fuente || producto?.nombre || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function esIdentidadProductoCasino(nombre) {
  return /^(?:TRIPLES?|SANDWICH|SANGUCHE|FRANCES(?:ITO)?|CIABAT[A-Z]*|CROISSANT|CROSSAINT|CAMOTE|MAIZ|ARABE|ARABITO|BAGUETINO|BAGUETINA)\b/.test(normalizar(nombre));
}

function nombreCanonico(producto) {
  return nombreFuenteProducto(producto);
}

function categoriaProducto(producto, nombre) {
  const clave = normalizar(nombre);
  // El francés mini sin relleno siempre es pan; el prefijo "Mini" evita
  // confundirlo con Francesito, que sí es un sánguche relleno.
  if (/^(?:MINI FRANCES|(?:PAN )?FRANCES MINI|PAN MINI FRANCES)$/.test(clave)) return 'Panes';
  if (/^TRIPLES?\b/.test(clave)) return 'Triples';
  const fuente = normalizarCategoriaOperativa(producto?.categoria_operativa);
  if (fuente) return fuente;
  const categoriaTexto = normalizar(producto?.categoria_fuente);
  if (/\b(MINI )?SANDWICH(?:ES)?\b/.test(categoriaTexto)) return 'Sándwiches';
  if (/\b(TRIPLE|TRIPLES)\b/.test(categoriaTexto)) return 'Triples';
  if (/\b(PAN|PANES|SIN RELLENO)\b/.test(categoriaTexto)) return 'Panes';
  const grupo = grupoProductoProduccion(nombre, normalizar);
  return grupo === 'Bocaditos' ? 'Bocaditos' : grupo;
}

function claveProducto(producto, nombre, categoria) {
  const fuente = nombreFuenteProducto(producto);
  const identidad = fuente && esIdentidadProductoCasino(fuente) ? fuente : nombre;
  return [normalizar(identidad), normalizar(categoria)].filter(Boolean).join('::');
}

function unirCronogramasCasino(rows) {
  const dias = new Map();
  const casinos = new Set();
  let reciente = null;

  for (const row of rows || []) {
    let datos;
    try { datos = JSON.parse(row.datos_json); } catch { continue; }
    if (!Array.isArray(datos?.dias)) continue;
    if (!reciente) reciente = row;

    for (const dia of datos.dias) {
      if (!dia?.fecha) continue;
      if (!dias.has(dia.fecha)) {
        dias.set(dia.fecha, {
          fecha: dia.fecha,
          dia: dia.dia || '',
          casinos: new Set(),
          productos: new Map()
        });
      }

      const destino = dias.get(dia.fecha);
      for (const casino of dia.casinos || []) {
        if (casino) {
          casinos.add(casino);
          destino.casinos.add(casino);
        }
      }

      for (const producto of dia.productos || []) {
        const nombre = nombreCanonico(producto);
        const categoria = categoriaProducto(producto, nombre);
        const clave = claveProducto(producto, nombre, categoria);
        if (!clave) continue;
        if (!destino.productos.has(clave)) {
          destino.productos.set(clave, {
            nombre,
            nombre_fuente: nombreFuenteProducto(producto),
            categoria_fuente: producto.categoria_fuente || '',
            categoria_operativa: categoria,
            grupo: producto.grupo || 'principal',
            por_casino: {},
            total: 0
          });
        }
        const acumulado = destino.productos.get(clave);
        if (acumulado.grupo !== 'extra' && producto.grupo === 'extra') acumulado.grupo = 'extra';

        for (const [casino, cantidadValor] of Object.entries(producto.por_casino || {})) {
          const cantidad = Number(cantidadValor || 0);
          if (!(cantidad > 0)) continue;
          casinos.add(casino);
          destino.casinos.add(casino);
          acumulado.por_casino[casino] = Number(acumulado.por_casino[casino] || 0) + cantidad;
          acumulado.total += cantidad;
        }
      }
    }
  }

  if (!reciente || !dias.size) return null;
  const ordenados = [...dias.values()]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((dia) => ({
      fecha: dia.fecha,
      dia: dia.dia,
      casinos: [...dia.casinos],
      productos: [...dia.productos.values()]
    }));

  return {
    id: reciente.id,
    nombre_archivo: reciente.nombre_archivo,
    fecha_inicio: ordenados[0]?.fecha || reciente.fecha_inicio,
    fecha_fin: ordenados.at(-1)?.fecha || reciente.fecha_fin,
    creado_en: reciente.creado_en,
    casinos: [...casinos],
    dias: ordenados
  };
}

module.exports = { unirCronogramasCasino };
