(function (global) {
  function obtenerPreciosProducto(prod) {
    const datos = prod?.precios || {};
    const x100 = Number(datos.x100 ?? prod?.precio_x100 ?? prod?.precio ?? 0);
    const x50 = Number(datos.x50 ?? prod?.precio_x50 ?? 0);
    const x25 = Number(datos.x25 ?? prod?.precio_x25 ?? 0);
    const precioUnitario = Number(
      prod?.precio_unidad ??
      (prod?.precio !== undefined && prod?.precio !== null && !prod?.precios ? Number(prod.precio) : (x100 > 0 ? x100 / 100 : Number(prod?.precio || 0)))
    );

    return { x100, x50, x25, precioUnitario };
  }

  function calcularSubtotal(prod, cantidad) {
    const cant = Math.max(0, Number(cantidad) || 0);
    if (cant <= 0) return 0;

    if (prod && prod.precio !== undefined && prod.precio !== null && !prod.precios) {
      return Number((cant * Number(prod.precio)).toFixed(2));
    }

    const precios = obtenerPreciosProducto(prod);
    const precioPaquete = cant >= 75 ? precios.x100 : cant >= 50 ? precios.x50 : precios.x25;
    if (precioPaquete > 0) {
      const tamanoPaquete = cant >= 75 ? 100 : cant >= 50 ? 50 : 25;
      return Number((cant * (precioPaquete / tamanoPaquete)).toFixed(2));
    }

    const unit = Number(precios.precioUnitario || prod?.precio || 0);
    return Number((cant * unit).toFixed(2));
  }

  const api = { obtenerPreciosProducto, calcularSubtotal };
  global.DchelisPricing = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
