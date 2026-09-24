const { resolverPetipanNombre, resolverCiabattaNombre } = require('./public/production-classification');

function normalizar(nombre) {
  return String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function nombreCanonico(producto) {
  return resolverPetipanNombre(producto?.nombre)
    || resolverCiabattaNombre(producto?.nombre)
    || String(producto?.nombre || '').trim();
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
        const clave = normalizar(nombre);
        if (!clave) continue;
        if (!destino.productos.has(clave)) {
          destino.productos.set(clave, {
            nombre,
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
