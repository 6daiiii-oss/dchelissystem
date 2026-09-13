(function (global) {
  function obtenerPreciosProducto(prod) {
    const datos = prod?.precios || {};
    const x100 = Number(datos.x100 ?? prod?.precio_x100 ?? prod?.precio ?? 0);
    const x50 = Number(datos.x50 ?? prod?.precio_x50 ?? 0);
    const x25 = Number(datos.x25 ?? prod?.precio_x25 ?? 0);
    const precioUnitario = Number(
      prod?.precio_unidad ??
      (x100 > 0 ? x100 / 100 : Number(prod?.precio || 0))
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
    if (cantidad >= 75 && precios.x100 > 0) {
      return Number((cantidad * (precios.x100 / 100)).toFixed(2));
    }

    const x100 = Number(precios.x100 || 0);
    const x50 = Number(precios.x50 || 0);
    const x25 = Number(precios.x25 || 0);
    const unit = Number(precios.precioUnitario || 0);

    let restante = cant;
    let total = 0;

    if (x100 > 0) {
      const completos100 = Math.floor(restante / 100);
      total += completos100 * x100;
      restante -= completos100 * 100;
    }

    if (x50 > 0) {
      const completos50 = Math.floor(restante / 50);
      total += completos50 * x50;
      restante -= completos50 * 50;
    }

    if (x25 > 0) {
      const completos25 = Math.floor(restante / 25);
      total += completos25 * x25;
      restante -= completos25 * 25;
    }

    if (restante > 0) {
      const unitPrice = unit > 0 ? unit : Number(prod?.precio || 0);
      if (unitPrice > 0) total += restante * unitPrice;
    }

    return Number(total.toFixed(2));
  }

  const api = { obtenerPreciosProducto, calcularSubtotal };
  global.DchelisPricing = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
