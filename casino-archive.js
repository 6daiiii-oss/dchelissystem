const { resolverPetipanNombre } = require('./public/production-classification');

function normalizarProductosPetipanDia(dia) {
  const productos = [];
  const posiciones = new Map();
  for (const producto of dia.productos || []) {
    const canonico = resolverPetipanNombre(producto.nombre);
    if (!canonico) { productos.push(producto); continue; }
    const clave = canonico.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (!posiciones.has(clave)) {
      posiciones.set(clave, productos.length);
      productos.push({ ...producto, nombre: canonico, grupo: 'extra', por_casino: { ...producto.por_casino } });
      continue;
    }
    const existente = productos[posiciones.get(clave)];
    existente.total = Number(existente.total || 0) + Number(producto.total || 0);
    for (const [casino, cantidad] of Object.entries(producto.por_casino || {})) {
      existente.por_casino[casino] = Number(existente.por_casino[casino] || 0) + Number(cantidad || 0);
    }
  }
  return { ...dia, productos };
}

function unirCronogramasCasino(rows) {
  const dias = new Map();
  const casinos = new Set();
  let reciente = null;
  for (const row of rows) {
    let datos;
    try { datos = JSON.parse(row.datos_json); } catch { continue; }
    if (!Array.isArray(datos?.dias)) continue;
    if (!reciente) reciente = row;
    for (const dia of datos.dias) {
      if (!dia?.fecha || dias.has(dia.fecha)) continue;
      dias.set(dia.fecha, normalizarProductosPetipanDia(dia));
      for (const casino of dia.casinos || []) casinos.add(casino);
    }
  }
  if (!reciente) return null;
  const ordenados = [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
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
