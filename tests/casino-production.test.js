const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { extraerPedidosCasino, prepararDetalleCasino } = require('../casino-production');
const { unirCronogramasCasino } = require('../casino-archive');
const { clasificarHojaProduccion } = require('../public/production-classification');

const cronograma = {
  casinos: ['Casino Norte', 'Casino Sur'],
  dias: [{
    fecha: '2026-09-24',
    casinos: ['Casino Norte', 'Casino Sur'],
    productos: [
      { nombre: 'Empanada de pollo', por_casino: { 'Casino Norte': 30, 'Casino Sur': 25 }, total: 55 },
      { nombre: 'Keke vainilla', por_casino: { 'Casino Sur': 2 }, total: 2 },
      { nombre: 'Producto sin alias', por_casino: { 'Casino Norte': 1 }, total: 1 }
    ]
  }]
};

test('Cocina recibe los mismos ítems de cada casino sin combinarlos ni perder nombres desconocidos', () => {
  const { clientes, detalles } = extraerPedidosCasino(cronograma, '2026-09-24', (nombre) =>
    nombre === 'Empanada de pollo' ? 'Empanada pollo' : nombre
  );
  assert.deepEqual(clientes.map((item) => [item.id, item.cliente_nombre, item.origen, item.hora_recoge]), [
    [-1, 'Casino Norte', 'casino', '09:00'],
    [-2, 'Casino Sur', 'casino', '09:00']
  ]);
  assert.deepEqual(detalles.map((item) => [item.pedido_id, item.producto_nombre, item.cantidad]), [
    [-1, 'Empanada pollo', 30],
    [-1, 'Producto sin alias', 1],
    [-2, 'Empanada pollo', 25],
    [-2, 'Keke vainilla', 2]
  ]);
  assert.ok(detalles.every((item) => item.origen === 'casino' && !item.es_urgente && item.fecha_recoge === '2026-09-24'));
});

test('un día ausente no agrega pedidos a la producción', () => {
  assert.deepEqual(extraerPedidosCasino(cronograma, '2026-09-25', (nombre) => nombre), { clientes: [], detalles: [] });
});


test('el consolidado conserva identidad y categoría de la fila original en todos los casinos', () => {
  const filas = [
    {
      id: 3, nombre_archivo: 'octubre.xlsx', creado_en: '2026-10-01',
      datos_json: JSON.stringify({ casinos: ['Joker Lima', 'Miami', 'Carrera'], dias: [{
        fecha: '2026-10-05', dia: 'Lunes', casinos: ['Joker Lima', 'Miami', 'Carrera'],
        productos: [
          { nombre: 'Mini Francés', nombre_fuente: 'FRANCESITO JAMON QUESO', categoria_fuente: 'Mini sandwich', por_casino: { 'Joker Lima': 20 }, total: 20 },
          { nombre: 'Mini Francés', nombre_fuente: 'PAN FRANCES MINI', categoria_fuente: 'Mini panes sin relleno', por_casino: { Miami: 60 }, total: 60 },
          { nombre: 'Triple jamón queso', nombre_fuente: 'TRIPLE JAMON QUESO', categoria_fuente: 'Triples', por_casino: { Carrera: 15 }, total: 15 }
        ]
      }] })
    }
  ];
  const consolidado = unirCronogramasCasino(filas);
  const productos = consolidado.dias[0].productos;
  assert.deepEqual(productos.map((p) => [p.nombre, p.categoria_operativa, p.por_casino]), [
    ['FRANCESITO JAMON QUESO', 'Sándwiches', { 'Joker Lima': 20 }],
    ['PAN FRANCES MINI', 'Panes', { Miami: 60 }],
    ['TRIPLE JAMON QUESO', 'Triples', { Carrera: 15 }]
  ]);
});

test('Cocina conserva Francesito relleno separado de Mini Francés aunque el catálogo los resuelva igual', () => {
  const entradas = [
    { pedido_id: -1, producto_nombre: 'Mini Francés', producto_nombre_original: 'FRANCESITO JAMON QUESO', categoria_operativa: 'Sándwiches', cantidad: 20 },
    { pedido_id: -2, producto_nombre: 'Mini Francés', producto_nombre_original: 'PAN FRANCES MINI', categoria_operativa: 'Panes', cantidad: 60 }
  ];
  const normalizar = (nombre) => String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const { filas } = clasificarHojaProduccion(entradas, [], () => 'Mini Francés', normalizar);
  assert.deepEqual(filas.map((fila) => [fila.nombre, fila.grupo, fila.total]), [
    ['FRANCESITO JAMON QUESO', 'Sándwiches', 20],
    ['PAN FRANCES MINI', 'Panes', 60]
  ]);
});


test('la producción recupera fuente y categoría del detalle guardado antes de agrupar', () => {
  const datosGuardados = [
    { pedido_id: -1, origen: 'casino', producto_nombre: 'Empanada pollo', producto_nombre_fuente: 'EMPANADITAS DE POLLO', casino_categoria_fuente: 'Bocaditos salados', cantidad: 30 },
    { pedido_id: -1, origen: 'casino', producto_nombre: 'Petipan', producto_nombre_fuente: 'PETIPAN CON POLLO', casino_categoria_fuente: 'Mini sandwich', cantidad: 20 },
    { pedido_id: -2, origen: 'casino', producto_nombre: 'Mini Francés', producto_nombre_fuente: 'FRANCESITO CON HOT DOG', casino_categoria_fuente: 'Mini sandwich', cantidad: 20 },
    { pedido_id: -2, origen: 'casino', producto_nombre: 'Mini Francés', producto_nombre_fuente: 'FRANCESITO POLLO A LA BRASA', casino_categoria_fuente: 'Mini sandwich', cantidad: 20 },
    { pedido_id: -2, origen: 'casino', producto_nombre: 'Mini Francés', producto_nombre_fuente: 'FRANCESITO CON CHORIZO', casino_categoria_fuente: 'Mini sandwich', cantidad: 20 }
  ];
  const resolverNombre = (nombre) => {
    if (nombre === 'EMPANADITAS DE POLLO') return 'Empanada de pollo';
    if (nombre === 'PETIPAN CON POLLO') return 'Petipan de Pollo';
    return nombre;
  };
  const resolverCategoria = (nombre) => {
    if (/^FRANCESITO|^PETIPAN/.test(nombre)) return 'Sándwiches';
    if (/^TRIPLE/.test(nombre)) return 'Triples';
    if (/^PAN FRANCES MINI$|^MINI FRANCES$/.test(nombre)) return 'Panes';
    return 'Bocaditos';
  };
  const detalles = datosGuardados.map((detalle) =>
    prepararDetalleCasino(detalle, resolverNombre, resolverCategoria)
  );
  assert.equal(detalles.find((d) => d.producto_nombre_original === 'EMPANADITAS DE POLLO').cantidad, 30);
  assert.ok(detalles.every((d) => d.producto_nombre_original !== 'Mini Francés'));
  assert.deepEqual(detalles.slice(2).map((d) => [d.producto_nombre, d.categoria_operativa]), [
    ['FRANCESITO CON HOT DOG', 'Sándwiches'],
    ['FRANCESITO POLLO A LA BRASA', 'Sándwiches'],
    ['FRANCESITO CON CHORIZO', 'Sándwiches']
  ]);
  const normalizar = (nombre) => String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const { filas } = clasificarHojaProduccion(detalles, [], resolverNombre, normalizar);
  assert.ok(filas.some((f) => f.nombre === 'Empanada de pollo' && f.total === 30 && f.grupo === 'Bocaditos'));
  assert.ok(filas.some((f) => f.nombre === 'Petipan de Pollo' && f.total === 20 && f.grupo === 'Sándwiches'));
  assert.equal(filas.filter((f) => f.nombre === 'Mini Francés').length, 0);
});


test('Cocina y embalaje leen los campos fuente persistidos del cronograma', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const inicioProduccion = server.indexOf("app.get('/api/admin/produccion'");
  const inicioExcel = server.indexOf("app.get('/api/admin/exportar-excel'", inicioProduccion);
  const finExcel = server.indexOf('\nconst PORT =', inicioExcel);
  assert.ok(inicioProduccion >= 0 && inicioExcel > inicioProduccion && finExcel > inicioExcel);
  const rutaProduccion = server.slice(inicioProduccion, inicioExcel);
  const rutaExcel = server.slice(inicioExcel, finExcel);
  const contar = (texto, patron) => (texto.match(patron) || []).length;
  assert.equal(contar(rutaProduccion, /dp\.producto_nombre_fuente/g), 2);
  assert.equal(contar(rutaProduccion, /dp\.casino_categoria_fuente/g), 2);
  assert.equal(contar(rutaProduccion, /prepararDetalleCasino\(det, resolverProductoCasinoOperacion, categoriaOperativaCasino\)/g), 2);
  assert.equal(contar(rutaExcel, /dp\.producto_nombre_fuente/g), 1);
  assert.equal(contar(rutaExcel, /dp\.casino_categoria_fuente/g), 1);
  assert.equal(contar(rutaExcel, /prepararDetalleCasino\(det, resolverProductoCasinoOperacion, categoriaOperativaCasino\)/g), 1);

  const inicioEmbalaje = rutaProduccion.indexOf('const idsEmbalaje');
  const rutaEmbalaje = rutaProduccion.slice(inicioEmbalaje);
  assert.ok(inicioEmbalaje >= 0);
  assert.match(rutaEmbalaje, /producto_nombre_original: esCasino \? detalleBase\.producto_nombre_original/);
  assert.match(rutaEmbalaje, /categoria_operativa: esCasino \? detalleBase\.categoria_operativa/);
});


test('los panes del pedido de mañana pasan al día de recojo desde el corte de las 8 a. m.', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const inicio = server.indexOf('function fechaProduccionAnticipada(');
  const fin = server.indexOf('\nfunction firmaDetallesPedido', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const funcion = server.slice(inicio, fin);
  const sumarDiasIso = (fecha, dias) => {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
  };
  const fechaIsoLimaDesdeValor = (valor) => {
    const fecha = valor instanceof Date ? valor : new Date(valor);
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(fecha).map(({ type, value }) => [type, value]));
    return `${partes.year}-${partes.month}-${partes.day}`;
  };
  const instanteLima = (fecha, hora) => new Date(`${fecha}T${hora}:00-05:00`);
  const producir = new Function(
    'sumarDiasIso', 'normalizarProducto', 'fechaIsoLimaDesdeValor', 'instanteLima',
    `${funcion}; return fechaProduccionAnticipada;`
  )(sumarDiasIso, (valor) => String(valor || '').toUpperCase(), fechaIsoLimaDesdeValor, instanteLima);
  const base = { fecha_recoge: '2026-10-05', hora_recoge: '09:00' };
  assert.equal(producir({ ...base, fecha_emision: '2026-10-04T07:59:00-05:00' }, 'Panes'), '2026-10-04');
  assert.equal(producir({ ...base, fecha_emision: '2026-10-04T08:00:00-05:00' }, 'Panes'), '2026-10-05');
  assert.equal(producir({ ...base, fecha_emision: '2026-10-04T10:00:00-05:00' }, 'Sándwiches'), '2026-10-05');
});
