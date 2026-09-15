function calcularRestante(montoTotal, montoPagado) {
  const total = Number(montoTotal) || 0;
  const pagado = Number(montoPagado) || 0;
  return Math.max(0, total - pagado);
}

function parsearLineasDetalle(texto) {
  return String(texto || '')
    .split(/\r?\n|,/) 
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const match = linea.match(/^\s*(\d+)\s*(?:x|X)?\s*(.+?)\s*$/i);
      if (!match) {
        return { producto_nombre: linea, cantidad: 1 };
      }
      return {
        producto_nombre: String(match[2] || '').trim(),
        cantidad: Number(match[1]) || 1
      };
    })
    .filter((item) => item.producto_nombre);
}

module.exports = {
  calcularRestante,
  parsearLineasDetalle
};
