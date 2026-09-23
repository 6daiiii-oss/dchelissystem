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
      dias.set(dia.fecha, dia);
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
