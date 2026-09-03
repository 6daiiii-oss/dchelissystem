const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'dchelis.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. Tabla de catálogo de productos
  db.run(`CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    precio REAL NOT NULL DEFAULT 0,
    precio_x25 REAL,
    precio_x50 REAL,
    precio_x100 REAL,
    precio_unidad REAL
  )`);

  // 2. Tabla de pedidos con registro automático de fecha y hora
  db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    tipo_cliente TEXT NOT NULL,
    cliente_nombre TEXT NOT NULL,
    celular TEXT NOT NULL,
    monto_total REAL NOT NULL,
    adelanto REAL NOT NULL,
    metodo_pago TEXT NOT NULL,
    fecha_recoge TEXT NOT NULL,
    hora_recoge TEXT NOT NULL,
    estado TEXT DEFAULT 'Registrado',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.all(`PRAGMA table_info(pedidos)`, [], (err, columns) => {
    if (!err && columns && !columns.some((col) => col.name === 'estado')) {
      db.run(`ALTER TABLE pedidos ADD COLUMN estado TEXT DEFAULT 'Registrado'`);
    }
  });

  // 3. Tabla de detalle de pedidos
  db.run(`CREATE TABLE IF NOT EXISTS detalles_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    producto_nombre TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    paquetes TEXT DEFAULT '{}',
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
  )`);

  db.all(`PRAGMA table_info(detalles_pedido)`, [], (err, columns) => {
    if (!err && columns && !columns.some((col) => col.name === 'paquetes')) {
      db.run(`ALTER TABLE detalles_pedido ADD COLUMN paquetes TEXT DEFAULT '{}'`);
    }
  });

  // Matriz completa de productos según imágenes
  // Formato: [id, nombre, categoria, precio, precio_x25, precio_x50, precio_x100, precio_unidad]
  const productosIniciales = [
    // --- BOCADITOS DULCES ---
    ['dulce_alfajorcito_choco', 'Alfajorcito de Chocolate', 'Bocaditos Dulces', 70.0, 20.0, 35.0, 70.0, null],
    ['dulce_alfajorcito_manjar', 'Alfajorcito de Manjar', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_biscotelas', 'Biscotelas', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_brownies', 'Brownies', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_budin', 'Budin', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_cisne', 'Cisne', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_cocaditas', 'Cocaditas', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_conitos_manjar', 'Conitos de Manjar', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_donitas', 'Donitas', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_kekito_zanahoria', 'Kekito de Zanahoria', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_merenguitos', 'Merenguitos', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_mil_hojas', 'Mil Hojas', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_mini_muffin', 'Mini Muffin', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mousse_fresa_maracuya_lucuma', 'Mousse de Fresa, Maracuya o Lucuma', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_niditos_amor', 'Niditos de Amor', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_orejitas', 'Orejitas', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_panuelitos_manjar', 'Pañuelitos de Manjar', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_pastelito_choclo', 'Pastelito de Choclo', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_piononitos', 'Piononitos', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_piononitos_chantilly', 'Piononitos de Chantilly', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_pye_limon', 'Pye de Limón', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_pye_manzana', 'Pye de Manzana', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_pye_pina', 'Pye de Piña', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_relampago_choco', 'Relámpago de Chocolate', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_tartaleta_coco', 'Tartaleta de Coco', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_tartaleta_durazno_fresa', 'Tartaleta de Durazno o fresa', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_tartaleta_sauco_lucuma', 'Tartaleta de Sauco o Lúcuma', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_tartaleta_guanabana', 'Tartaleta de Guanabana', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_tortita_choco', 'Tortita de Chocolate', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_tortita_helada_selva', 'Tortita Helada o Selva Negra', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_tortita_tres_leches', 'Tortita Tres Leches', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],
    ['dulce_trufas', 'Trufas', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_trufa_blanca', 'Trufa blanca', 'Bocaditos Dulces', 80.0, 22.0, 42.0, 80.0, null],

    // --- BOCADITOS SALADOS ---
    ['salado_pizzitas', 'Pizzitas', 'Bocaditos Salados', 80.0, 22.0, 42.0, 80.0, null],
    ['salado_empanaditas_aji_gallina', 'Empanaditas de Aji de Gallina', 'Bocaditos Salados', 80.0, 22.0, 42.0, 80.0, null],
    ['salado_empanaditas_aceituna', 'Empanaditas de Aceituna', 'Bocaditos Salados', 70.0, 19.0, 35.0, 70.0, null],
    ['salado_empanaditas_carne', 'Empanaditas de Carne', 'Bocaditos Salados', 70.0, 19.0, 35.0, 70.0, null],
    ['salado_empanaditas_jamon', 'Empanaditas de Jamón', 'Bocaditos Salados', 70.0, 19.0, 35.0, 70.0, null],
    ['salado_empanaditas_pollo', 'Empanaditas de Pollo', 'Bocaditos Salados', 70.0, 19.0, 35.0, 70.0, null],
    ['salado_empanaditas_queso', 'Empanaditas de Queso', 'Bocaditos Salados', 70.0, 19.0, 35.0, 70.0, null],
    ['salado_empanaditas_mixtas', 'Empanaditas Mixtas', 'Bocaditos Salados', 70.0, 19.0, 35.0, 70.0, null],
    ['salado_enrollado_acelga', 'Enrollado de Acelga', 'Bocaditos Salados', 80.0, 22.0, 42.0, 80.0, null],
    ['salado_enrollado_hotdog', 'Enrollado de Hot Dog', 'Bocaditos Salados', 70.0, 19.0, 35.0, 70.0, null],
    ['salado_soufle_alcachofa', 'Soufle de Alcachofa', 'Bocaditos Salados', 80.0, 22.0, 42.0, 80.0, null],

    // --- SANDWICHITOS ---
    ['sw_asado', 'Sandwich de Asado', 'Sandwichitos', 140.0, 40.0, 70.0, 140.0, null],
    ['sw_croissant_pollo', 'Croissant con Pollo', 'Sandwichitos', 140.0, 40.0, 70.0, 140.0, null],
    ['sw_lomito', 'Sandwich de Lomito', 'Sandwichitos', 140.0, 40.0, 70.0, 140.0, null],
    ['sw_petipan_pollo_durazno', 'Petipan de pollo c/durazno', 'Sandwichitos', 140.0, 40.0, 70.0, 140.0, null],
    ['sw_petipan_pollo_pina', 'Petipan de pollo c/piña', 'Sandwichitos', 140.0, 40.0, 70.0, 140.0, null],
    ['sw_salchicha_nortena', 'Sandwich de Salchicha norteña', 'Sandwichitos', 120.0, 38.0, 60.0, 120.0, null],
    ['sw_petipan_pollo', 'Petipan de Pollo', 'Sandwichitos', 120.0, 38.0, 60.0, 120.0, null],
    ['sw_caprece', 'Caprece Mozz/Alb/Tomate', 'Sandwichitos', 110.0, 35.0, 58.0, 110.0, null],
    ['sw_hamburguesita', 'Sandwich Hamburguesita', 'Sandwichitos', 110.0, 35.0, 58.0, 110.0, null],
    ['sw_croissant_mixto', 'Croissant Mixto', 'Sandwichitos', 100.0, 28.0, 50.0, 100.0, null],
    ['sw_butifarras', 'Butifarras', 'Sandwichitos', 100.0, 28.0, 50.0, 100.0, null],

    // --- TORTA CHANTILLY ---
    ['torta_chantilly_foto', 'Torta Chantilly - Foto', 'Torta Chantilly', 15.0, null, null, null, 15.0],
    ['torta_chantilly_30_35', 'Torta Chantilly (30-35 Porciones aprox)', 'Torta Chantilly', 70.0, null, null, null, 70.0],
    ['torta_chantilly_60', 'Torta Chantilly (60 Porciones aprox)', 'Torta Chantilly', 90.0, null, null, null, 90.0],
    ['torta_chantilly_80', 'Torta Chantilly (80 Porciones aprox)', 'Torta Chantilly', 130.0, null, null, null, 130.0],
    ['torta_chantilly_tres_leches', 'Torta Chantilly Tres Leches (35 Porciones aprox)', 'Torta Chantilly', 120.0, null, null, null, 120.0],
    ['torta_chantilly_adicional', 'Torta Chantilly Chocolate o Selva Negra (adicional)', 'Torta Chantilly', 10.0, null, null, null, 10.0],

    // --- MINI TRIPLES ---
    ['triple_jamon_queso', 'Triple de Jamón y queso', 'Mini Triples', 100.0, 28.0, 50.0, 100.0, null],
    ['triple_palta_tomate_huevo', 'Triple palta, tomate, huevo', 'Mini Triples', 130.0, 45.0, 65.0, 130.0, null],
    ['triple_pollo_jamon_queso', 'Triple pollo, jamón, queso', 'Mini Triples', 118.0, 35.0, 59.0, 118.0, null],
    ['triple_pollo_durazno', 'Triple pollo con durazno', 'Mini Triples', 130.0, 45.0, 65.0, 130.0, null],
    ['triple_espinaca_queso_crema', 'Triple espinaca y queso crema', 'Mini Triples', 118.0, 35.0, 59.0, 118.0, null],
    ['triple_mermelada_queso_crema', 'Triple mermelada y queso crema', 'Mini Triples', 110.0, 35.0, 59.0, 110.0, null],
    ['triple_pollo_lomo_ahumado', 'Triple pollo y lomo ahumado', 'Mini Triples', 118.0, 35.0, 59.0, 118.0, null],
    ['triple_pollo_tocino', 'Triple pollo y tocino', 'Mini Triples', 118.0, 35.0, 59.0, 118.0, null],
    ['triple_pollo_aceituna', 'Triple pollo con aceituna', 'Mini Triples', 118.0, 35.0, 59.0, 118.0, null],
    ['triple_pollo_pina', 'Triple pollo con piña', 'Mini Triples', 130.0, 45.0, 65.0, 130.0, null],
    ['triple_pollo_pecanas_jamon', 'Triple pollo, pecanas y jamón', 'Mini Triples', 120.0, 40.0, 60.0, 120.0, null],

    // --- PIQUEOS ---
    ['piqueo_brochetas_pollo', 'Brochetas de pollo', 'Piqueos', 240.0, 70.0, 120.0, 240.0, null],
    ['piqueo_alitas_bouchet', 'Alitas bouchet', 'Piqueos', 240.0, 70.0, 120.0, 240.0, null],
    ['piqueo_guindones_tocino', 'Guindones c/tocino', 'Piqueos', 100.0, 30.0, 50.0, 100.0, null],
    ['piqueo_enrollado_jamon_esparragos', 'Enrollado de jamón c/espárragos', 'Piqueos', 65.0, 25.0, 35.0, 65.0, null],
    ['piqueo_hojarascas_aji_gallina', 'Hojarascas de ají de gallina', 'Piqueos', 65.0, 25.0, 35.0, 65.0, null],
    ['piqueo_piononitos_espinaca', 'Piononitos de espinaca', 'Piqueos', 60.0, 20.0, 30.0, 60.0, null],
    ['piqueo_tequenos_guacamole', 'Tequeños con guacamole', 'Piqueos', 80.0, 28.0, 42.0, 80.0, null],
    ['piqueo_voulevans_jamon', 'Voulevans de jamón', 'Piqueos', 65.0, 25.0, 35.0, 65.0, null],
    ['piqueo_voulevans_tocino', 'Voulevans de tocino', 'Piqueos', 65.0, 25.0, 35.0, 65.0, null],
    ['piqueo_canapes_jamon_pina_durazno', 'Canapés jamón, piña, durazno', 'Piqueos', 65.0, 25.0, 35.0, 65.0, null],

    // --- PASTELES FAMILIARES ---
    ['fam_crema_volteada', 'Crema Volteada', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_mousse_fresa_maracuya', 'Mousse de Fresa, Maracuya', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_pastel_acelga', 'Pastel de Acelga', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_torta_tres_leches', 'Torta Tres Leches', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_pye_manzana_limon', 'Pye de Manzana - Limón', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_torta_choco', 'Torta de Chocolate', 'Pasteles Familiares', 45.0, null, null, null, 45.0],
    ['fam_torta_helada', 'Torta Helada', 'Pasteles Familiares', 45.0, null, null, null, 45.0],
    ['fam_torta_selva_negra', 'Torta Selva Negra', 'Pasteles Familiares', 45.0, null, null, null, 45.0],
    ['fam_torta_chantilly', 'Torta de Chantilly', 'Pasteles Familiares', 40.0, null, null, null, 40.0],
    ['fam_keke_variado', 'Keke de pasas-Vainilla-Marmol-Castaña', 'Pasteles Familiares', 16.0, null, null, null, 16.0],

    // --- PAN GOURMET ---
    ['gourmet_mini_aceituna', 'Mini Aceituna', 'Pan Gourmet', 35.0, 12.0, 24.0, 35.0, null],
    ['gourmet_mini_arabe', 'Mini Arabe', 'Pan Gourmet', 32.0, 11.0, 22.0, 32.0, null],
    ['gourmet_mini_ciabatta', 'Mini Ciabatta', 'Pan Gourmet', 32.0, 11.0, 22.0, 32.0, null],
    ['gourmet_mini_croissant', 'Mini Croissant', 'Pan Gourmet', 50.0, 15.0, 30.0, 50.0, null],
    ['gourmet_mini_frances', 'Mini Francés', 'Pan Gourmet', 30.0, 9.0, 18.0, 30.0, null],
    ['gourmet_mini_hamburguesa', 'Mini Hamburguesa', 'Pan Gourmet', 32.0, 11.0, 22.0, 32.0, null],
    ['gourmet_mini_hotdog', 'Mini Hot Dog', 'Pan Gourmet', 30.0, 9.0, 18.0, 30.0, null],
    ['gourmet_mini_integral', 'Mini Integral', 'Pan Gourmet', 32.0, 11.0, 22.0, 32.0, null],
    ['gourmet_mini_jamon', 'Mini Jamón', 'Pan Gourmet', 40.0, 12.0, 24.0, 40.0, null],
    ['gourmet_petipan', 'Petipan', 'Pan Gourmet', 30.0, 9.0, 18.0, 30.0, null],
    ['gourmet_hamburguesa_grande', 'Hamburguesa grande', 'Pan Gourmet', 0.80, null, null, null, 0.80],
    ['gourmet_croissant_grande', 'Croissant grande', 'Pan Gourmet', 1.50, null, null, null, 1.50],

    // --- PAN ESPECIAL ---
    ['esp_pan_molde_pullman', 'Pan de Molde (Pullman)', 'Pan Especial', 18.0, null, null, null, 18.0],
    ['esp_pan_molde_integral', 'Pan de Molde Integral', 'Pan Especial', 19.0, null, null, null, 19.0],
    ['esp_pan_molde_marmoleado', 'Pan de Molde Marmoleado', 'Pan Especial', 20.0, null, null, null, 20.0],
    ['esp_pan_molde_color', 'Pan de Molde de Color', 'Pan Especial', 21.0, null, null, null, 21.0],
    ['esp_pan_molde_blanco_chico', 'Pan de Molde Blanco chico', 'Pan Especial', 10.0, null, null, null, 10.0],
    ['esp_pan_molde_integral_chico', 'Pan de Molde Integral chico', 'Pan Especial', 11.0, null, null, null, 11.0]
  ];

  const stmt = db.prepare(`INSERT OR REPLACE INTO productos VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  productosIniciales.forEach(p => stmt.run(p));
  stmt.finalize();
});

module.exports = db;