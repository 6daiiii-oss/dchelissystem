const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const db = require('./db');

const app = express();

const PRODUCTOS_COCINA = [
  'EMPANADA CARNE', 'EMPANADA POLLO', 'EMPANADA ACEITUNA', 'EMPANADA DE JAMON', 'EMPANADA AJI GALLINA',
  'EMPANADA MIXTA', 'EMPANADA QUESO', 'ENROLLADO ACELGA', 'SOUFLE ALCACHOFA', 'ENROLLADO HOT DOG', 'PIZZAS',
  'ALFAJOR', 'ALFAJOR CHOCOLATE', 'BISCOTELAS', 'BROWNIES', 'CISNES', 'COCADAS', 'CONITOS', 'DONAS',
  'EMPANADA DE BODA', 'KEKITO ZANAHORIA', 'MERENGUITOS', 'MILHOJAS', 'MOUSSE FRESA', 'MOUSSE MARACUYA',
  'NIDITOS', 'OREJITAS', 'PAÑUELITOS', 'PIONONO', 'PIONONO CHANTILLY', 'PYE DE LIMON', 'PYE DE MANZANA',
  'PROFITEROL', 'ROSQUITAS', 'TARTALETA DE COCO', 'TARTALETA GUANABANA', 'TARTALETA DE FRESA',
  'TARTALETA DURAZNO', 'TARTALETA LUCUMA', 'TARTALETA DE SAUCO', 'TORTITA HELADA', 'TRES LECHES',
  'TORTITA CHOCOLATE', 'TORTITA CHANTILLY', 'TORTITA SELVA NEGRA', 'TRUFAS BLANCAS', 'TRUFAS', 'RELAMPAGOS'
];

const PRODUCTOS_COCINA_EXTRA = [
  'Sandwich de Asado', 'Croissant con Pollo', 'Sandwich de Lomito', 'Petipan', 'Petipan de pollo c/durazno',
  'Petipan de pollo c/piña', 'Petipan de Pollo', 'Sandwich de Salchicha norteña', 'Caprece Mozzarella con Tomate y Albaca',
  'Sandwich Hamburguesita', 'Croissant Mixto', 'Butifarras', 'Triple de Jamón y queso',
  'Triple palta, tomate, huevo', 'Triple pollo, jamón y queso', 'Triple pollo con durazno',
  'Triple espinaca y queso crema', 'Triple mermelada y queso crema', 'Triple pollo y lomo ahumado',
  'Triple pollo y tocino', 'Triple pollo con aceituna', 'Triple pollo con piña', 'Triple pollo, pecanas y jamón',
  'Pan de Molde (Pullman)', 'Pan de Molde Integral', 'Pan de Molde Marmoleado', 'Pan de Molde de Color',
  'Pan de Molde Blanco chico', 'Pan de Molde Integral chico', 'Baguetina', 'Mini Francés', 'Mini Croissant', 'Pan de Hamburguesa'
];

const PRODUCTOS_COCINA_MAPA_TIENDA = Object.fromEntries(Object.entries({
  'ALFAJORCITO DE CHOCOLATE': 'ALFAJOR CHOCOLATE',
  'ALFAJORCITO CHOCOLATE': 'ALFAJOR CHOCOLATE',
  'ALFAJORCITO DE MANJAR': 'ALFAJOR',
  'ALFAJORCITO MANJAR': 'ALFAJOR',
  'BISCOTELA': 'BISCOTELAS',
  'BROWNIE': 'BROWNIES',
  'CISNE': 'CISNES',
  'COCADITA': 'COCADAS',
  'COCADITAS': 'COCADAS',
  'CONITO DE MANJAR': 'CONITOS',
  'DONITA': 'DONAS',
  'DONITAS': 'DONAS',
  'KEKITO DE ZANAHORIA': 'KEKITO ZANAHORIA',
  'MERENGUETAS': 'MERENGUITOS',
  'MIL HOJAS': 'MILHOJAS',
  'MOUSE DE FRESA': 'MOUSSE FRESA',
  'MOUSE FRESA': 'MOUSSE FRESA',
  'MOUSE DE MARACUYA': 'MOUSSE MARACUYA',
  'MOUSE MARACUYA': 'MOUSSE MARACUYA',
  'NIDITO DE AMOR': 'NIDITOS',
  'PAÑUELITO': 'PAÑUELITOS',
  'PANUELITO': 'PAÑUELITOS',
  'PIONONITOS': 'PIONONO',
  'PIONONITOS DE CHANTILLY': 'PIONONO CHANTILLY',
  'PIE DE LIMON': 'PYE DE LIMON',
  'PIE LIMON': 'PYE DE LIMON',
  'PIE DE MANZANA': 'PYE DE MANZANA',
  'PIE MANZANA': 'PYE DE MANZANA',
  'PROFITEROLS': 'PROFITEROL',
  'ROSQUITA': 'ROSQUITAS',
  'TARTALETA COCO': 'TARTALETA DE COCO',
  'TARTALETA DE DURAZNO O FRESA': 'TARTALETA DURAZNO',
  'TARTALETA DE SAUCO': 'TARTALETA DE SAUCO',
  'TARTALETA SAUCO': 'TARTALETA DE SAUCO',
  'TORTITA DE CHOCOLATE': 'TORTITA CHOCOLATE',
  'TORTITA HELADA O SELVA NEGRA': 'TORTITA HELADA',
  'TORTITA SELVA NEGRA': 'TORTITA HELADA',
  'TORTITA TRES LECHES': 'TRES LECHES',
  'TORTA CHANTILLY': 'TORTITA CHANTILLY',
  'TRUFA BLANCA': 'TRUFAS BLANCAS',
  'TRUFA': 'TRUFAS',
  'EMPANADITA DE CARNE': 'EMPANADA CARNE',
  'EMPANADITAS DE CARNE': 'EMPANADA CARNE',
  'EMPANADA DE CARNE': 'EMPANADA CARNE',
  'EMPANADA CARNE': 'EMPANADA CARNE',
  'EMPANADITA DE POLLO': 'EMPANADA POLLO',
  'EMPANADITAS DE POLLO': 'EMPANADA POLLO',
  'EMPANADA DE POLLO': 'EMPANADA POLLO',
  'EMPANADA POLLO': 'EMPANADA POLLO',
  'EMPANADITA DE ACEITUNA': 'EMPANADA ACEITUNA',
  'EMPANADITAS DE ACEITUNA': 'EMPANADA ACEITUNA',
  'EMPANADA DE ACEITUNA': 'EMPANADA ACEITUNA',
  'EMPANADA ACEITUNA': 'EMPANADA ACEITUNA',
  'EMPANADITA DE JAMON': 'EMPANADA DE JAMON',
  'EMPANADITAS DE JAMON': 'EMPANADA DE JAMON',
  'EMPANADA DE JAMON': 'EMPANADA DE JAMON',
  'EMPANADA DE AJI DE GALLINA': 'EMPANADA AJI GALLINA',
  'EMPANADITA DE AJI DE GALLINA': 'EMPANADA AJI GALLINA',
  'EMPANADITAS DE AJI DE GALLINA': 'EMPANADA AJI GALLINA',
  'EMPANADA AJI GALLINA': 'EMPANADA AJI GALLINA',
  'EMPANADITA MIXTA': 'EMPANADA MIXTA',
  'EMPANADITAS MIXTAS': 'EMPANADA MIXTA',
  'EMPANADA MIXTA': 'EMPANADA MIXTA',
  'EMPANADITA DE QUESO': 'EMPANADA QUESO',
  'EMPANADITAS DE QUESO': 'EMPANADA QUESO',
  'EMPANADA DE QUESO': 'EMPANADA QUESO',
  'EMPANADA QUESO': 'EMPANADA QUESO',
  'ENROLLADO DE ACELGA': 'ENROLLADO ACELGA',
  'ENROLLADO DE HOT DOG': 'ENROLLADO HOT DOG',
  'HOT DOG': 'ENROLLADO HOT DOG',
  'PIZZITA': 'PIZZAS',
  'PIZZITAS': 'PIZZAS',
  'SOUFLE DE ALCACHOFA': 'SOUFLE ALCACHOFA',
  'SOUFLES DE ALCACHOFA': 'SOUFLE ALCACHOFA'
}).map(([tienda, cocina]) => [normalizarProducto(tienda), normalizarProducto(cocina)]));

const PRODUCTOS_COCINA_ALIASES = {
  'ALFAJOR': ['ALFAJOR', 'ALFAJORCITO', 'ALFAJORCITO DE MANJAR', 'ALFAJORCITO MANJAR'],
  'ALFAJOR CHOCOLATE': ['ALFAJOR CHOCOLATE', 'ALFAJORCITO DE CHOCOLATE', 'ALFAJORCITO CHOCOLATE', 'ALFAJOR DE CHOCOLATE'],
  'BISCOTELAS': ['BISCOTELAS', 'BISCOTELA'],
  'BROWNIES': ['BROWNIES', 'BROWNIE'],
  'CISNES': ['CISNES', 'CISNE'],
  'COCADAS': ['COCADAS', 'COCADITA', 'COCADITAS'],
  'CONITOS': ['CONITOS', 'CONITO', 'CONITOS DE MANJAR'],
  'DONAS': ['DONAS', 'DONITA', 'DONITAS'],
  'KEKITO ZANAHORIA': ['KEKITO ZANAHORIA', 'KEKITO DE ZANAHORIA'],
  'MERENGUITOS': ['MERENGUITOS', 'MERENGUETAS'],
  'MILHOJAS': ['MILHOJAS', 'MIL HOJAS'],
  'MOUSSE MARACUYA': ['MOUSSE MARACUYA', 'MOUSSE DE MARACUYA', 'MOUSSE MARACUYA O LUCUMA', 'MOUSE MARACUYA', 'MOUSE DE MARACUYA'],
  'MOUSSE FRESA': ['MOUSSE FRESA', 'MOUSSE DE FRESA', 'MOUSSE FRESA MARACUYA LUCUMA', 'MOUSE FRESA', 'MOUSE DE FRESA'],
  'NIDITOS': ['NIDITOS', 'NIDITO', 'NIDITOS DE AMOR'],
  'OREJITAS': ['OREJITAS', 'OREJITA'],
  'PAÑUELITOS': ['PAÑUELITOS', 'PANUELITOS', 'PAÑUELITO'],
  'PIONONO': ['PIONONO', 'PIONONITOS'],
  'PIONONO CHANTILLY': ['PIONONO CHANTILLY', 'PIONONITOS DE CHANTILLY', 'PIONONO DE CHANTILLY'],
  'PYE DE LIMON': ['PYE DE LIMON', 'PIE DE LIMON', 'PYE LIMON', 'PIE LIMON'],
  'PYE DE MANZANA': ['PYE DE MANZANA', 'PIE DE MANZANA', 'PYE MANZANA'],
  'PROFITEROL': ['PROFITEROL', 'PROFITEROLS'],
  'ROSQUITAS': ['ROSQUITAS', 'ROSQUITA'],
  'TARTALETA DE COCO': ['TARTALETA DE COCO', 'TARTALETA COCO'],
  'TARTALETA GUANABANA': ['TARTALETA GUANABANA', 'TARTALETA DE GUANABANA'],
  'TARTALETA DE FRESA': ['TARTALETA DE FRESA', 'TARTALETA FRESA'],
  'TARTALETA DURAZNO': ['TARTALETA DURAZNO', 'TARTALETA DE DURAZNO', 'TARTALETA DE DURAZNO O FRESA'],
  'TARTALETA LUCUMA': ['TARTALETA LUCUMA', 'TARTALETA DE LUCUMA'],
  'TARTALETA DE SAUCO': ['TARTALETA DE SAUCO', 'TARTALETA SAUCO'],
  'TORTITA HELADA': ['TORTITA HELADA', 'TORTITA HELADA O SELVA NEGRA', 'TORTITA SELVA NEGRA'],
  'TRES LECHES': ['TRES LECHES', 'TORTITA TRES LECHES'],
  'TORTITA CHOCOLATE': ['TORTITA CHOCOLATE', 'TORTITA DE CHOCOLATE'],
  'TORTITA CHANTILLY': ['TORTITA CHANTILLY', 'TORTA CHANTILLY'],
  'TRUFAS BLANCAS': ['TRUFAS BLANCAS', 'TRUFA BLANCA'],
  'TRUFAS': ['TRUFAS', 'TRUFA'],
  'RELAMPAGOS': ['RELAMPAGOS', 'RELAMPAGO', 'RELAMPAGOS DE CHOCOLATE'],
  'PIZZAS': ['PIZZAS', 'PIZZITA', 'PIZZITAS'],
  'SANDWICH DE ASADO': ['SANDWICH DE ASADO', 'SANDWICH ASADO', 'ASADO'],
  'CROISSANT CON POLLO': ['CROISSANT CON POLLO', 'CROISSANT POLLO', 'CROISSANT DE POLLO'],
  'SANDWICH DE LOMITO': ['SANDWICH DE LOMITO', 'SANDWICH LOMITO', 'LOMITO'],
  'PETIPAN': ['PETIPAN', 'PETIPAN DE POLLO', 'PETIPAN POLLO', 'PETIPAN DE POLLO C DURAZNO', 'PETIPAN DE POLLO C PIÑA', 'PETIPAN DE POLL'],
  'PETIPAN DE POLLO C DURAZNO': ['PETIPAN DURAZNO', 'PETIPAN POLLO DURAZNO', 'PETIPAN DE POLLO C DURAZNO', 'PETIPAN POLLO C DURAZNO', 'PETIPAN C DURAZNO'],
  'PETIPAN DE POLLO C PIÑA': ['PETIPAN PIÑA', 'PETIPAN POLLO PIÑA', 'PETIPAN DE POLLO C PIÑA', 'PETIPAN POLLO C PIÑA', 'PETIPAN C PIÑA'],
  'SANDWICH DE SALCHICHA NORTEÑA': ['SANDWICH DE SALCHICHA NORTEÑA', 'SANDWICH SALCHICHA', 'SALCHICHA NORTEÑA', 'SALCHICHA', 'SW SALCHICHA'],
  'CAPRECCE MOZZARELLA CON TOMATE Y ALBACA': ['CAPRECCE', 'CAPRECCE MOZZARELLA', 'CAPRECCE MOZZ', 'CAPRECCE MOZZARELLA TOMATE ALBACA', 'CAPRECCE MOZZ ALBACA TOMATE'],
  'SANDWICH HAMBURGUESITA': ['SANDWICH HAMBURGUESITA', 'SANDWICH DE HAMBURGUESA', 'HAMBURGUESITA'],
  'CROISSANT MIXTO': ['CROISSANT MIXTO', 'CROISSANT MIJTO', 'CROISSANT MIXTO JAMON Y QUESO'],
  'BUTIFARRAS': ['BUTIFARRA', 'BUTIFARRAS'],
  'TRIPLE DE JAMON Y QUESO': ['TRIPLE JAMON Y QUESO', 'TRIPLE JAMÓN Y QUESO', 'TRIPLE PJQ', 'PJQ', 'TRIPLE JAMON QUESO'],
  'TRIPLE PALTA TOMATE HUEVO': ['TRIPLE PALTA TOMATE HUEVO', 'TRIPLE PTH', 'PTH', 'TRIPLE PALTA TOMATE'],
  'TRIPLE POLLO JAMON Y QUESO': ['TRIPLE POLLO JAMON Y QUESO', 'TRIPLE POLLO JAMÓN Y QUESO', 'TRIPLE POLLO JQ', 'TRIPLE POLLO JAMON QUESO'],
  'TRIPLE POLLO CON DURAZNO': ['TRIPLE POLLO DURAZNO', 'TRIPLES DURAZNO', 'TRIPLE DURAZNO', 'TRIPLE POLLO CON DURAZNO'],
  'TRIPLE POLLO CON PIÑA': ['TRIPLE POLLO PIÑA', 'TRIPLES PIÑA', 'TRIPLE PIÑA', 'TRIPLE POLLO CON PIÑA'],
  'TRIPLE POLLO PECANAS Y JAMON': ['TRIPLE PECANA JAMON', 'TRIPLE POLLO PECANAS Y JAMON', 'TRIPLE POLLO PECANA Y JAMON'],
  'TRIPLE POLLO Y LOMO AHUMADO': ['TRIPLE CON LOMO AHUMADO', 'TRIPLE POLLO LOMO AHUMADO', 'TRIPLE POLLO CON LOMO AHUMADO', 'TRIPLE POLLO Y LOMO AHUMADO'],
  'TRIPLE POLLO Y TOCINO': ['TRIPLE POLLO TOCINO', 'TRIPLE POLLO CON TOCINO', 'TRIPLE TOCINO', 'TRIPLE POLLO Y TOCINO'],
  'TRIPLE POLLO CON ACEITUNA': ['TRIPLE POLLO ACEITUNA', 'TRIPLE ACEITUNA', 'TRIPLE POLLO CON ACEITUNA'],
  'TRIPLE ESPINACA Y QUESO CREMA': ['TRIPLE ESPINACA QUESO CREMA', 'TRIPLE ESPINACA', 'TRIPLE ESPINACA Y QUESO CREMA'],
  'TRIPLE MERMELADA Y QUESO CREMA': ['TRIPLE MERMELADA', 'TRIPLE MERMELADA QUESO CREMA', 'TRIPLE MERMELADA Y QUESO CREMA'],
  'PAN DE MOLDE PULLMAN': ['PAN PULLMAN', 'PAN DE MOLDE', 'PULLMAN', 'PAN DE MOLDE PULLMAN'],
  'PAN DE MOLDE INTEGRAL': ['PAN INTEGRAL', 'PAN DE MOLDE INTEGRAL'],
  'PAN DE MOLDE MARMOLEADO': ['PAN MARMOLEADO', 'PAN DE MOLDE MARMOLEADO'],
  'PAN DE MOLDE DE COLOR': ['PAN DE COLOR', 'PAN DE MOLDE DE COLOR'],
  'MINI FRANCES': ['PAN FRANCÉS', 'PAN FRANCES', 'FRANCES', 'MINI FRANCES', 'MINI FRANCÉS', 'MINI FRENCH', 'FRANCÉS'],
  'MINI CROISSANT': ['MINI CROISSANT', 'CROISSANT MINI', 'CROISSANT PEQUEÑO'],
  'PAN DE HAMBURGUESA': ['PAN HAMBURGUESA', 'PAN DE HAMBURGUESA'],
  'PAN DE MOLDE (PULLMAN)': ['PAN DE MOLDE', 'PAN MOLDE PULLMAN', 'PULLMAN'],
  'PETIPAN DE POLLO': ['PETIPAN DE POLLO', 'PETIPAN POLLO', 'PETIPAN DE POLL'],
  'TRIPLE POLLO JAMON Y QUESO': ['TRIPLE POLLO JAMON Y QUESO', 'TRIPLE POLLO JAMÓN Y QUESO', 'TRIPLE POLLO JQ', 'TRIPLE POLLO JAMON QUESO'],
  'SANDWICH HAMBURGUESITA': ['SANDWICH HAMBURGUESITA', 'SANDWICH DE HAMBURGUESA', 'HAMBURGUESITA'],
  'TRIPLE DE JAMON Y QUESO': ['TRIPLE JAMON Y QUESO', 'TRIPLE JAMÓN Y QUESO', 'TRIPLE PJQ', 'PJQ', 'TRIPLE JAMON QUESO'],
  'TRIPLE POLLO JAMON Y QUESO': ['TRIPLE POLLO JAMON Y QUESO', 'TRIPLE POLLO JAMON QUESO', 'TRIPLE POLLO JQ'],
  'PAN DE MOLDE (PULLMAN)': ['PAN DE MOLDE', 'PAN MOLDE PULLMAN', 'PAN DE MOLDE PULLMAN', 'PULLMAN'],
  'EMPANADA CARNE': ['EMPANADA CARNE', 'EMPANADAS DE CARNE', 'EMPANADITAS DE CARNE'],
  'EMPANADA POLLO': ['EMPANADA POLLO', 'EMPANADAS DE POLLO', 'EMPANADITAS DE POLLO'],
  'EMPANADA ACEITUNA': ['EMPANADA ACEITUNA', 'EMPANADITAS DE ACEITUNA'],
  'EMPANADA DE JAMON': ['EMPANADA DE JAMON', 'EMPANADITAS DE JAMON'],
  'EMPANADA AJI GALLINA': ['EMPANADA AJI GALLINA', 'EMPANADITAS DE AJI DE GALLINA'],
  'EMPANADA MIXTA': ['EMPANADA MIXTA', 'EMPANADITAS MIXTAS'],
  'EMPANADA QUESO': ['EMPANADA QUESO', 'EMPANADITAS DE QUESO'],
  'ENROLLADO ACELGA': ['ENROLLADO ACELGA', 'ENROLLADOS DE ACELGA'],
  'SOUFLE ALCACHOFA': ['SOUFLE ALCACHOFA', 'SOUFLES DE ALCACHOFA']
};
const PRODUCTOS_COCINA_SET = new Set(PRODUCTOS_COCINA.map((nombre) => normalizarProducto(nombre)));

const FORMULAS_INVENTARIO_PRODUCTOS = {
  'SANDWICH DE ASADO': 'formula_sandwich_asado',
  'CROISSANT CON POLLO': 'formula_croissant_pollo',
  'SANDWICH DE LOMITO': 'formula_sandwich_lomito',
  'PETIPAN': 'formula_petipan_pollo',
  'PETIPAN DE POLLO C DURAZNO': 'formula_petipan_pollo_durazno',
  'PETIPAN DE POLLO C PIÑA': 'formula_petipan_pollo_pina',
  'SANDWICH DE SALCHICHA NORTEÑA': 'formula_sandwich_salchicha_nortena',
  'CAPRECCE MOZZARELLA CON TOMATE Y ALBACA': 'formula_caprece_mozzarella',
  'SANDWICH HAMBURGUESITA': 'formula_sandwich_hamburguesita',
  'CROISSANT MIXTO': 'formula_croissant_mixto',
  'BUTIFARRAS': 'formula_butifarras',
  'TRIPLE DE JAMON Y QUESO': 'formula_triple_jamon_queso',
  'TRIPLE PALTA TOMATE HUEVO': 'formula_triple_palta_tomate_huevo',
  'TRIPLE POLLO CON DURAZNO': 'formula_triple_pollo_durazno',
  'TRIPLE POLLO CON PIÑA': 'formula_triple_pollo_pina',
  'TRIPLE POLLO PECANAS Y JAMON': 'formula_triple_pollo_pecana_jamon',
  'TRIPLE POLLO JAMON Y QUESO': 'formula_triple_pollo_jamon_queso',
  'TRIPLE ESPINACA Y QUESO CREMA': 'formula_triple_espinaca_queso_crema',
  'TRIPLE MERMELADA Y QUESO CREMA': 'formula_triple_mermelada_queso_crema',
  'TRIPLE POLLO Y LOMO AHUMADO': 'formula_triple_pollo_lomo_ahumado',
  'TRIPLE POLLO Y TOCINO': 'formula_triple_pollo_tocino',
  'TRIPLE POLLO CON ACEITUNA': 'formula_triple_pollo_aceituna'
};

function normalizarProducto(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[´`]/g, '')
    .replace(/[(),.;:]/g, ' ')
    .toUpperCase()
    .replace(/\bDE\b|\bDEL\b|\bY\b/g, ' ')
    .replace(/\s*[-/]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productoEsCocina(nombre) {
  return !!resolverNombreCocina(nombre);
}

function resolverNombreCocina(nombre) {
  const valor = normalizarProducto(nombre);
  if (!valor) return null;

  const exacto = PRODUCTOS_COCINA.find((producto) => normalizarProducto(producto) === valor);
  if (exacto) return exacto;

  const mapeado = PRODUCTOS_COCINA_MAPA_TIENDA[valor];
  if (mapeado) return mapeado;

  let mejorAlias = null;
  let mejorLongitud = -1;
  for (const [clave, aliases] of Object.entries(PRODUCTOS_COCINA_ALIASES)) {
    const aliasExacto = aliases.find((alias) => normalizarProducto(alias) === valor);
    if (aliasExacto) {
      const longitud = normalizarProducto(clave).length;
      if (longitud > mejorLongitud) {
        mejorAlias = clave;
        mejorLongitud = longitud;
      }
    }
  }
  if (mejorAlias) return mejorAlias;

  for (const [clave, aliases] of Object.entries(PRODUCTOS_COCINA_ALIASES)) {
    const claveNormalizada = normalizarProducto(clave);
    const aliasCoincide = aliases.some((alias) => {
      const aliasNormalizado = normalizarProducto(alias);
      return valor.includes(aliasNormalizado) || aliasNormalizado.includes(valor)
        || valor.includes(claveNormalizada) || claveNormalizada.includes(valor);
    });
    if (aliasCoincide) return clave;
  }

  const productoExtra = PRODUCTOS_COCINA_EXTRA.find((producto) => {
    const normalizado = normalizarProducto(producto);
    return normalizado === valor || valor.includes(normalizado) || normalizado.includes(valor);
  });
  if (productoExtra) return productoExtra;

  return null;
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicialización de tablas SQLite para asegurar la persistencia de datos
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      precio REAL NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      tipo_cliente TEXT,
      cliente_nombre TEXT,
      celular TEXT,
      monto_total REAL,
      adelanto REAL,
      metodo_pago TEXT,
      fecha_recoge TEXT,
      hora_recoge TEXT,
      dedicatoria TEXT DEFAULT '',
      foto_torta TEXT DEFAULT '',
      estado TEXT DEFAULT 'Registrado',
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS detalles_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER,
      producto_nombre TEXT,
      cantidad INTEGER,
      subtotal REAL,
      paquetes TEXT DEFAULT '{}',
      FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
    )
  `);
});

// Ruta principal para servir la interfaz web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint: Obtener Catálogo de Productos
app.get('/api/productos', (req, res) => {
  db.all(`SELECT id, nombre, categoria, precio, precio_x25, precio_x50, precio_x100, precio_unidad FROM productos ORDER BY categoria ASC, nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Endpoint para registrar un nuevo pedido y asegurar su visualización en producción
app.post('/api/pedidos', (req, res) => {
  const { tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, dedicatoria, foto_torta, detalles } = req.body;

    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ error: 'El pedido debe incluir al menos un detalle.' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const pagoPendiente = String(metodo_pago || '').includes('verificación pendiente');
        const estadoInicial = pagoPendiente ? 'Pendiente de verificación de pago' : 'Registrado';
        const queryPedido = `INSERT INTO pedidos (codigo, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, dedicatoria, foto_torta, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const fechaCodigo = String(fecha_recoge || '').replace(/-/g, '');
        const sufijoUnico = crypto.randomBytes(4).toString('hex').toUpperCase();
        const codigoPedido = `PED-${fechaCodigo}-${sufijoUnico}`;
        db.run(queryPedido, [codigoPedido, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, String(dedicatoria || '').trim(), String(foto_torta || ''), estadoInicial], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            const pedidoId = this.lastID;
            const queryDetalle = `INSERT INTO detalles_pedido (pedido_id, producto_nombre, cantidad, subtotal, paquetes) VALUES (?, ?, ?, ?, ?)`;

            let stmt = db.prepare(queryDetalle);
            detalles.forEach(det => {
                const paquetes = det.paquetes && typeof det.paquetes === 'object' ? JSON.stringify(det.paquetes) : '{}';
                stmt.run(pedidoId, det.producto_nombre, det.cantidad, det.subtotal, paquetes);
            });
            stmt.finalize((err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                db.run('COMMIT', (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.status(201).json({ message: 'Pedido registrado con éxito', id: pedidoId, codigo: codigoPedido });
                });
            });
        });
    });
});

// Endpoint: Obtener Pedidos Generales
app.get('/api/admin/pedidos', (req, res) => {
  db.all(`
    SELECT id, codigo, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago,
           fecha_recoge, hora_recoge, dedicatoria, foto_torta, estado, fecha_registro
    FROM pedidos
    ORDER BY fecha_recoge ASC, hora_recoge ASC, id ASC
  `, [], (err, pedidos) => {
    if (err) return res.status(500).json({ error: err.message });

    const pedidosFinales = pedidos.map((pedido) => ({
      ...pedido,
      detalles: []
    }));

    let index = 0;
    const cargarDetalles = () => {
      if (index >= pedidosFinales.length) return res.json({ pedidos: pedidosFinales });

      const pedido = pedidosFinales[index];
      db.all(`
        SELECT producto_nombre, cantidad, subtotal, paquetes
        FROM detalles_pedido
        WHERE pedido_id = ?
        ORDER BY id ASC
      `, [pedido.id], (errDetalle, detalles) => {
        if (errDetalle) return res.status(500).json({ error: errDetalle.message });
        pedido.detalles = (detalles || []).map((item) => ({
          ...item,
          paquetes: item.paquetes ? JSON.parse(item.paquetes) : {}
        }));
        index += 1;
        cargarDetalles();
      });
    };

    cargarDetalles();
  });
});

// Vista de solo lectura para el personal de despacho. No expone acciones de
// edición, eliminación, teléfonos ni importes de los clientes.
app.get('/api/colaboradores/salidas', (req, res) => {
  const fecha = String(req.query.fecha || new Date().toISOString().slice(0, 10)).trim();
  db.all(`
    SELECT p.id, p.codigo, p.cliente_nombre, p.fecha_recoge, p.hora_recoge, p.estado,
           d.producto_nombre, d.cantidad, d.paquetes
    FROM pedidos p
    LEFT JOIN detalles_pedido d ON d.pedido_id = p.id
    WHERE p.fecha_recoge = ? AND p.estado <> 'Pendiente de verificación de pago'
    ORDER BY p.hora_recoge ASC, p.id ASC, d.id ASC
  `, [fecha], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const pedidos = new Map();
    (rows || []).forEach((row) => {
      if (!pedidos.has(row.id)) {
        pedidos.set(row.id, {
          id: row.id, codigo: row.codigo, cliente_nombre: row.cliente_nombre,
          fecha_recoge: row.fecha_recoge, hora_recoge: row.hora_recoge,
          estado: row.estado, detalles: []
        });
      }
      if (row.producto_nombre) {
        pedidos.get(row.id).detalles.push({ producto_nombre: row.producto_nombre, cantidad: row.cantidad, paquetes: row.paquetes });
      }
    });
    res.json({ fecha, pedidos: [...pedidos.values()] });
  });
});

app.get('/api/admin/inventario', (req, res) => {
  db.all(`SELECT id, nombre, categoria, unidad, cantidad_base, formula, descripcion FROM formulas_inventario ORDER BY categoria, nombre ASC`, [], (err, formulas) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`SELECT id, nombre, stock, unidad, actualizado_en FROM stock_inventario ORDER BY nombre ASC`, [], (errStock, stock) => {
      if (errStock) return res.status(500).json({ error: errStock.message });

      res.json({
        formulas: (formulas || []).map((item) => ({
          ...item,
          formula: item.formula ? JSON.parse(item.formula) : {}
        })),
        stock: stock || []
      });
    });
  });
});

app.post('/api/admin/inventario/calcular', (req, res) => {
  const { producto, cantidad } = req.body || {};
  if (!producto || !cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({ error: 'Se requiere producto y cantidad válida.' });
  }

  db.get(`SELECT id, nombre, categoria, unidad, cantidad_base, formula, descripcion FROM formulas_inventario WHERE id = ? OR nombre = ? LIMIT 1`, [producto, producto], (err, formulaItem) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!formulaItem) return res.status(404).json({ error: 'Fórmula no encontrada.' });

    const formula = formulaItem.formula ? JSON.parse(formulaItem.formula) : {};
    const base = Number(formulaItem.cantidad_base || 100);
    const multiplicador = Number(cantidad) / base;
    const resultado = {};

    Object.entries(formula).forEach(([insumo, valor]) => {
      const requerido = Number(valor) * multiplicador;
      resultado[insumo] = Number(requerido.toFixed(3));
    });

    res.json({
      producto: formulaItem.nombre,
      categoria: formulaItem.categoria,
      cantidadSolicitada: Number(cantidad),
      base: Number(formulaItem.cantidad_base || 100),
      totalNecesario: resultado
    });
  });
});

app.get('/api/admin/inventario/compra-dia', (req, res) => {
  const fecha = String(req.query.fecha || '').trim();
  if (!fecha) {
    return res.status(400).json({ error: 'Se requiere una fecha para calcular la compra del día.' });
  }

  db.all(`
    SELECT p.id as pedido_id, p.fecha_recoge, d.producto_nombre, d.cantidad
    FROM pedidos p
    INNER JOIN detalles_pedido d ON d.pedido_id = p.id
    WHERE p.fecha_recoge = ? AND p.estado <> 'Pendiente de verificación de pago'
    ORDER BY p.id ASC, d.id ASC
  `, [fecha], (err, filas) => {
    if (err) return res.status(500).json({ error: err.message });

    const insumos = {};
    const detalleProductos = {};

    (filas || []).forEach((fila) => {
      const nombreRaw = fila.producto_nombre || '';
      const productoNormalizado = normalizarProducto(nombreRaw);
      const productoKey = Object.keys(FORMULAS_INVENTARIO_PRODUCTOS).find((key) => normalizarProducto(key) === productoNormalizado)
        || Object.keys(FORMULAS_INVENTARIO_PRODUCTOS).find((key) => normalizarProducto(key).includes(productoNormalizado) || productoNormalizado.includes(normalizarProducto(key)));
      const formulaId = productoKey ? FORMULAS_INVENTARIO_PRODUCTOS[productoKey] : null;
      if (!formulaId) return;

      detalleProductos[formulaId] = (detalleProductos[formulaId] || 0) + Number(fila.cantidad || 0);
    });

    const ids = Object.keys(detalleProductos);
    if (ids.length === 0) {
      return res.json({ fecha, resumen: [], totalGeneral: 0, productos: [] });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.all(`SELECT id, nombre, categoria, cantidad_base, formula FROM formulas_inventario WHERE id IN (${placeholders})`, ids, (errFormulas, formulas) => {
      if (errFormulas) return res.status(500).json({ error: errFormulas.message });

      const resumen = [];
      Object.entries(detalleProductos).forEach(([formulaId, cantidadTotal]) => {
        const formulaItem = (formulas || []).find((item) => item.id === formulaId);
        if (!formulaItem) return;

        const formula = formulaItem.formula ? JSON.parse(formulaItem.formula) : {};
        const base = Number(formulaItem.cantidad_base || 100);
        const factor = Number(cantidadTotal) / base;

        Object.entries(formula).forEach(([insumo, valor]) => {
          const unidades = Number(valor) * factor;
          const actual = insumos[insumo] || 0;
          insumos[insumo] = Number((actual + unidades).toFixed(3));
        });

        resumen.push({
          producto: formulaItem.nombre,
          cantidadTotal: Number(cantidadTotal),
          base,
          formula: formulaItem.formula ? JSON.parse(formulaItem.formula) : {}
        });
      });

      const totalGeneral = Object.values(insumos).reduce((sum, value) => sum + Number(value || 0), 0);
      res.json({
        fecha,
        resumen: Object.entries(insumos).map(([insumo, cantidad]) => ({ insumo, cantidad: Number(cantidad.toFixed(3)) })).sort((a, b) => a.insumo.localeCompare(b.insumo)),
        totalGeneral: Number(totalGeneral.toFixed(3)),
        productos: resumen
      });
    });
  });
});

app.get('/api/admin/inventario/compra-dia/excel', (req, res) => {
  const fecha = String(req.query.fecha || '').trim();
  if (!fecha) {
    return res.status(400).json({ error: 'Se requiere una fecha para exportar la compra del día.' });
  }

  db.all(`
    SELECT p.id as pedido_id, d.producto_nombre, d.cantidad
    FROM pedidos p
    INNER JOIN detalles_pedido d ON d.pedido_id = p.id
    WHERE p.fecha_recoge = ?
  `, [fecha], (err, filas) => {
    if (err) return res.status(500).json({ error: err.message });

    const resumen = {};
    (filas || []).forEach((fila) => {
      const nombreRaw = fila.producto_nombre || '';
      const nombreNormalizado = normalizarProducto(nombreRaw);
      const formulaId = Object.entries(FORMULAS_INVENTARIO_PRODUCTOS)
        .find(([nombre, id]) => normalizarProducto(nombre) === nombreNormalizado || nombreNormalizado.includes(normalizarProducto(nombre)) || normalizarProducto(nombre).includes(nombreNormalizado))?.[1];
      if (!formulaId) return;
      resumen[formulaId] = (resumen[formulaId] || 0) + Number(fila.cantidad || 0);
    });

    const ids = Object.keys(resumen);
    if (ids.length === 0) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Compra del día');
      sheet.addRow(['Fecha', fecha]);
      sheet.addRow([]);
      sheet.addRow(['No hay pedidos para esta fecha.']);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="compra-dia-${fecha}.xlsx"`);
      return workbook.xlsx.write(res).then(() => res.end());
    }

    const placeholders = ids.map(() => '?').join(',');
    db.all(`SELECT id, nombre, categoria, cantidad_base, formula FROM formulas_inventario WHERE id IN (${placeholders})`, ids, (errFormulas, formulas) => {
      if (errFormulas) return res.status(500).json({ error: errFormulas.message });
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Compra del día');
      sheet.addRow(['Fecha', fecha]);
      sheet.addRow([]);
      sheet.addRow(['Producto', 'Cantidad pedida', 'Base', 'Insumos necesarios']);

      (formulas || []).forEach((formulaItem) => {
        const cantidadTotal = resumen[formulaItem.id] || 0;
        const formula = formulaItem.formula ? JSON.parse(formulaItem.formula) : {};
        const base = Number(formulaItem.cantidad_base || 100);
        const factor = Number(cantidadTotal) / base;
        const requeridos = {};
        Object.entries(formula).forEach(([insumo, valor]) => {
          requeridos[insumo] = Number((Number(valor) * factor).toFixed(3));
        });
        const insumoText = Object.entries(requeridos).map(([insumo, cantidad]) => `${insumo}: ${cantidad}`).join(' | ');
        sheet.addRow([formulaItem.nombre, cantidadTotal, base, insumoText]);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="compra-dia-${fecha}.xlsx"`);
      workbook.xlsx.write(res).then(() => res.end());
    });
  });
});

app.post('/api/admin/inventario/stock', (req, res) => {
  const { id, nombre, stock, unidad } = req.body || {};
  if (!id || !nombre || stock === undefined) {
    return res.status(400).json({ error: 'Faltan datos para actualizar inventario.' });
  }

  db.run(`INSERT OR REPLACE INTO stock_inventario (id, nombre, stock, unidad, actualizado_en)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`, [id, nombre, Number(stock), String(unidad || 'kg')], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id, stock: Number(stock) });
  });
});

app.put('/api/admin/pedidos/:id/estado', (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado) return res.status(400).json({ error: 'Estado requerido' });

  db.run(`UPDATE pedidos SET estado = ? WHERE id = ?`, [estado, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ success: true, id: Number(id), estado });
  });
});

app.delete('/api/admin/pedidos/:id', (req, res) => {
  const { id } = req.params;

  db.run('BEGIN TRANSACTION');

  db.run(`DELETE FROM detalles_pedido WHERE pedido_id = ?`, [id], (err) => {
    if (err) {
      db.run('ROLLBACK');
      return res.status(500).json({ error: err.message });
    }

    db.run(`DELETE FROM pedidos WHERE id = ?`, [id], function (errDelete) {
      if (errDelete) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: errDelete.message });
      }

      if (this.changes === 0) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      db.run('COMMIT', (errorCommit) => {
        if (errorCommit) {
          return res.status(500).json({ error: errorCommit.message });
        }

        res.json({ success: true, id: Number(id) });
      });
    });
  });
});

// Endpoint: Obtener Datos de Producción del Día
app.get('/api/admin/produccion', (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });

  // La plantilla siempre muestra las mismas 47 filas fijas (igual que el papel de la dueña),
  // sin importar si un producto tuvo pedidos ese día o no.
  const listaProductos = PRODUCTOS_COCINA;

  db.all(`SELECT id, cliente_nombre, tipo_cliente FROM pedidos WHERE fecha_recoge = ? AND estado <> 'Pendiente de verificación de pago' ORDER BY id ASC`, [fecha], (err, clientes) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(
      `SELECT p.id as pedido_id, dp.producto_nombre, dp.cantidad, dp.paquetes 
       FROM detalles_pedido dp 
       JOIN pedidos p ON dp.pedido_id = p.id 
       WHERE p.fecha_recoge = ? AND p.estado <> 'Pendiente de verificación de pago'`,
      [fecha],
      (err, detalles) => {
        if (err) return res.status(500).json({ error: err.message });

        // Clave del arreglo: producto_nombre pasa a ser el nombre CANÓNICO
        // (el mismo que aparece en PRODUCTOS_COCINA), así el frontend puede
        // comparar por igualdad exacta sin preocuparse por los alias.
        const detallesFiltrados = (detalles || [])
          .map((det) => {
            const nombreCanonico = resolverNombreCocina(det.producto_nombre) ||
              PRODUCTOS_COCINA_EXTRA.find((producto) => normalizarProducto(producto) === normalizarProducto(det.producto_nombre));
            return { ...det, nombre_canonico: nombreCanonico || det.producto_nombre };
          })
          .filter((det) => det.nombre_canonico)
          .map((det) => ({
            pedido_id: det.pedido_id,
            producto_nombre: det.nombre_canonico,
            producto_nombre_original: det.producto_nombre,
            cantidad: det.cantidad,
            paquetes: det.paquetes ? JSON.parse(det.paquetes) : {}
          }));

        res.json({
          fecha: fecha,
          productos: listaProductos,
          clientes: clientes || [],
          detalles: detallesFiltrados || []
        });
      }
    );
  });
});

// Endpoint: Descargar Excel
app.get('/api/admin/exportar-excel', (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).send('Fecha requerida');

  // 47 filas fijas, igual que el papel de la dueña (no depende de lo que se pidió ese día)
  const listaProductos = PRODUCTOS_COCINA;

  db.all(`SELECT id, cliente_nombre FROM pedidos WHERE fecha_recoge = ? AND estado <> 'Pendiente de verificación de pago' ORDER BY id ASC`, [fecha], async (err, clientes) => {
      if (err) return res.status(500).send(err.message);
      const listaClientes = clientes || [];

      db.all(
        `SELECT p.id as pedido_id, dp.producto_nombre, dp.cantidad, dp.paquetes 
         FROM detalles_pedido dp 
         JOIN pedidos p ON dp.pedido_id = p.id 
         WHERE p.fecha_recoge = ? AND p.estado <> 'Pendiente de verificación de pago'`,
        [fecha],
        async (err, detalles) => {
          if (err) return res.status(500).send(err.message);
          // nombre canónico (resuelve alias) para que el emparejo con la fila sea exacto
          const listaDetalles = (detalles || [])
            .map((det) => ({ ...det, producto_nombre: resolverNombreCocina(det.producto_nombre) }))
            .filter((det) => det.producto_nombre)
            .map((det) => ({ ...det, paquetes: det.paquetes ? JSON.parse(det.paquetes) : {} }));

          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Producción');

          worksheet.getCell('A1').value = `FECHA: ${fecha}`;
          worksheet.getCell('A1').font = { bold: true };

          listaClientes.forEach((cli, idx) => {
            const colNum = idx + 2;
            const cell = worksheet.getCell(1, colNum);
            cell.value = cli.cliente_nombre.toUpperCase();
            cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center' };
            cell.font = { bold: true, color: { argb: 'FFCC0000' } };
          });

          const colTotalIdx = Math.max(listaClientes.length + 2, 19);
          const cellTotalHeader = worksheet.getCell(1, colTotalIdx);
          cellTotalHeader.value = 'Total';
          cellTotalHeader.font = { bold: true };

          listaProductos.forEach((prodNombre, pIdx) => {
            const rowNum = pIdx + 2;
            worksheet.getCell(rowNum, 1).value = prodNombre;
            worksheet.getCell(rowNum, 1).font = { bold: true };

            listaClientes.forEach((cli, cIdx) => {
              const colNum = cIdx + 2;
              const cantidadTotal = listaDetalles
                .filter(d => d.pedido_id === cli.id && d.producto_nombre === prodNombre)
                .reduce((sum, d) => sum + (d.cantidad || 0), 0);
              if (cantidadTotal > 0) {
                worksheet.getCell(rowNum, colNum).value = cantidadTotal;
                worksheet.getCell(rowNum, colNum).font = { color: { argb: 'FFCC0000' }, bold: true };
              }
            });

            const colStartLetter = 'B';
            const colEndLetter = worksheet.getColumn(colTotalIdx - 1).letter;
            worksheet.getCell(rowNum, colTotalIdx).value = { formula: `SUM(${colStartLetter}${rowNum}:${colEndLetter}${rowNum})` };
            worksheet.getCell(rowNum, colTotalIdx).font = { bold: true };
          });

          const rowFinal = listaProductos.length + 2;
          const colTotalLetter = worksheet.getColumn(colTotalIdx).letter;
          worksheet.getCell(rowFinal, colTotalIdx).value = { formula: `SUM(${colTotalLetter}2:${colTotalLetter}${rowFinal - 1})` };
          worksheet.getCell(rowFinal, colTotalIdx).font = { bold: true };

          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=Produccion_${fecha}.xlsx`);
          await workbook.xlsx.write(res);
          res.end();
        }
      );
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor D'chelis ejecutándose en http://localhost:${PORT}`));
