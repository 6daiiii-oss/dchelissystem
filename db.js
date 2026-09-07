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

  db.all(`PRAGMA table_info(productos)`, [], (err, columns) => {
    if (err || !columns) return;
    const nombres = columns.map((col) => col.name);
    if (!nombres.includes('precio_x25')) db.run(`ALTER TABLE productos ADD COLUMN precio_x25 REAL`);
    if (!nombres.includes('precio_x50')) db.run(`ALTER TABLE productos ADD COLUMN precio_x50 REAL`);
    if (!nombres.includes('precio_x100')) db.run(`ALTER TABLE productos ADD COLUMN precio_x100 REAL`);
    if (!nombres.includes('precio_unidad')) db.run(`ALTER TABLE productos ADD COLUMN precio_unidad REAL`);
  });

  db.run(`CREATE TABLE IF NOT EXISTS formulas_inventario (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    unidad TEXT NOT NULL DEFAULT 'unidad',
    cantidad_base INTEGER NOT NULL DEFAULT 100,
    formula TEXT NOT NULL DEFAULT '{}',
    descripcion TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_inventario (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    stock REAL NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'kg',
    actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
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
    dedicatoria TEXT DEFAULT '',
    foto_torta TEXT DEFAULT '',
    estado TEXT DEFAULT 'Registrado',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.all(`PRAGMA table_info(pedidos)`, [], (err, columns) => {
    if (!err && columns) {
      if (!columns.some((col) => col.name === 'estado')) {
        db.run(`ALTER TABLE pedidos ADD COLUMN estado TEXT DEFAULT 'Registrado'`);
      }
      if (!columns.some((col) => col.name === 'dedicatoria')) {
        db.run(`ALTER TABLE pedidos ADD COLUMN dedicatoria TEXT DEFAULT ''`);
      }
      if (!columns.some((col) => col.name === 'foto_torta')) {
        db.run(`ALTER TABLE pedidos ADD COLUMN foto_torta TEXT DEFAULT ''`);
      }
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
    ['dulce_alfajorcito_choco', 'Alfajorcito de Chocolate', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_alfajorcito_manjar', 'Alfajorcito de Manjar', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_biscotelas', 'Biscotelas', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_brownies', 'Brownies', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_budin', 'Budin', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_cisne', 'Cisne', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_cocaditas', 'Cocaditas', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_conitos_manjar', 'Conitos de Manjar', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_donitas', 'Donitas', 'Bocaditos Dulces', 76.0, 25.0, 45.0, 76.0, null],
    ['dulce_kekito_zanahoria', 'Kekito de Zanahoria', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_merenguitos', 'Merenguitos', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_mil_hojas', 'Mil Hojas', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mini_muffin', 'Mini Muffin', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mousse_fresa', 'Mousse de Fresa', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mousse_maracuya', 'Mousse de Maracuyá', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mousse_lucuma', 'Mousse de Lúcuma', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_niditos_amor', 'Niditos de Amor', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_orejitas', 'Orejitas', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_panuelitos_manjar', 'Pañuelitos de Manjar', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_pastelito_choclo', 'Pastelito de Choclo', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_piononitos', 'Piononitos', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_piononitos_chantilly', 'Piononitos de Chantilly', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_pye_limon', 'Pye de Limón', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_pye_manzana', 'Pye de Manzana', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_pye_pina', 'Pye de Piña', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_relampago_choco', 'Relámpago de Chocolate', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_coco', 'Tartaleta de Coco', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_tartaleta_durazno', 'Tartaleta de Durazno', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_fresa', 'Tartaleta de Fresa', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_sauco', 'Tartaleta de Sauco', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_lucuma', 'Tartaleta de Lúcuma', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_guanabana', 'Tartaleta de Guanabana', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tortita_choco', 'Tortita de Chocolate', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tortita_helada', 'Tortita Helada', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tortita_selva_negra', 'Tortita Selva Negra', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tortita_tres_leches', 'Tortita Tres Leches', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_trufas', 'Trufas', 'Bocaditos Dulces', 76.0, 22.0, 35.0, 70.0, null],
    ['dulce_trufa_blanca', 'Trufa blanca', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],

    // --- BOCADITOS SALADOS ---
    ['salado_pizzitas', 'Pizzitas', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_empanaditas_aji_gallina', 'Empanaditas de Aji de Gallina', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_empanaditas_aceituna', 'Empanaditas de Aceituna', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_empanaditas_carne', 'Empanaditas de Carne', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_empanaditas_jamon', 'Empanaditas de Jamón', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_empanaditas_pollo', 'Empanaditas de Pollo', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_empanaditas_queso', 'Empanaditas de Queso', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_empanaditas_mixtas', 'Empanaditas Mixtas', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_enrollado_acelga', 'Enrollado de Acelga', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_enrollado_hotdog', 'Enrollado de Hot Dog', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],
    ['salado_soufle_alcachofa', 'Soufle de Alcachofa', 'Bocaditos Salados', 80.0, 22.0, 40.0, 80.0, null],

    // --- SANDWICHITOS ---
    ['sw_asado', 'Sandwich de Asado', 'Sandwichitos', 160.0, 40.0, 80.0, 160.0, null],
    ['sw_croissant_pollo', 'Croissant con Pollo', 'Sandwichitos', 160.0, 40.0, 80.0, 160.0, null],
    ['sw_lomito', 'Sandwich de Lomito', 'Sandwichitos', 160.0, 40.0, 80.0, 160.0, null],
    ['sw_petipan_pollo_durazno', 'Petipan de pollo c/durazno', 'Sandwichitos', 160.0, 40.0, 80.0, 160.0, null],
    ['sw_petipan_pollo_pina', 'Petipan de pollo c/piña', 'Sandwichitos', 160.0, 40.0, 80.0, 160.0, null],
    ['sw_salchicha_nortena', 'Sandwich de Salchicha norteña', 'Sandwichitos', 140.0, 40.0, 70.0, 140.0, null],
    ['sw_petipan_pollo', 'Petipan de Pollo', 'Sandwichitos', 140.0, 40.0, 70.0, 140.0, null],
    ['sw_caprece', 'Caprece Mozz/Alb/Tomate', 'Sandwichitos', 120.0, 35.0, 60.0, 120.0, null],
    ['sw_hamburguesita', 'Sandwich Hamburguesita', 'Sandwichitos', 120.0, 35.0, 60.0, 120.0, null],
    ['sw_croissant_mixto', 'Croissant Mixto', 'Sandwichitos', 100.0, 28.0, 50.0, 100.0, null],
    ['sw_butifarras', 'Butifarras', 'Sandwichitos', 100.0, 28.0, 50.0, 100.0, null],

    // --- TORTA CHANTILLY ---
    ['torta_chantilly_foto', 'Torta Chantilly - Foto', 'Torta Chantilly', 15.0, null, null, null, 15.0],
    ['torta_chantilly_30', 'Torta Chantilly (30 Porciones aprox)', 'Torta Chantilly', 70.0, null, null, null, 70.0],
    ['torta_chantilly_60', 'Torta Chantilly (60 Porciones aprox)', 'Torta Chantilly', 90.0, null, null, null, 90.0],
    ['torta_chantilly_90', 'Torta Chantilly (90 Porciones aprox)', 'Torta Chantilly', 130.0, null, null, null, 130.0],

    // --- MINI TRIPLES ---
    ['triple_jamon_queso', 'Triple de Jamón y queso', 'Mini Triples', 120.0, 30.0, 60.0, 120.0, null],
    ['triple_palta_tomate_huevo', 'Triple palta, tomate, huevo', 'Mini Triples', 140.0, 45.0, 75.0, 140.0, null],
    ['triple_pollo_jamon_queso', 'Triple pollo, jamón, queso', 'Mini Triples', 130.0, 40.0, 70.0, 130.0, null],
    ['triple_pollo_durazno', 'Triple pollo con durazno', 'Mini Triples', 140.0, 45.0, 75.0, 140.0, null],
    ['triple_espinaca_queso_crema', 'Triple espinaca y queso crema', 'Mini Triples', 130.0, 40.0, 70.0, 130.0, null],
    ['triple_mermelada_queso_crema', 'Triple mermelada y queso crema', 'Mini Triples', 130.0, 40.0, 70.0, 130.0, null],
    ['triple_pollo_lomo_ahumado', 'Triple pollo y lomo ahumado', 'Mini Triples', 130.0, 40.0, 70.0, 130.0, null],
    ['triple_pollo_tocino', 'Triple pollo y tocino', 'Mini Triples', 130.0, 40.0, 70.0, 130.0, null],
    ['triple_pollo_aceituna', 'Triple pollo con aceituna', 'Mini Triples', 130.0, 40.0, 70.0, 130.0, null],
    ['triple_pollo_pina', 'Triple pollo con piña', 'Mini Triples', 140.0, 45.0, 75.0, 140.0, null],
    ['triple_pollo_pecanas_jamon', 'Triple pollo, pecanas y jamón', 'Mini Triples', 130.0, 40.0, 70.0, 130.0, null],

    // --- PIQUEOS ---
    ['piqueo_brochetas_pollo', 'Brochetas de pollo', 'Piqueos', 260.0, 70.0, 130.0, 260.0, null],
    ['piqueo_alitas_bouchet', 'Alitas bouchet', 'Piqueos', 260.0, 70.0, 130.0, 260.0, null],
    ['piqueo_guindones_tocino', 'Guindones c/tocino', 'Piqueos', 140.0, 40.0, 70.0, 140.0, null],
    ['piqueo_enrollado_jamon_esparragos', 'Enrollado de jamón c/esparragos', 'Piqueos', 80.0, 30.0, 40.0, 80.0, null],
    ['piqueo_hojarascas_aji_gallina', 'Hojarascas de ají de gallina', 'Piqueos', 80.0, 30.0, 40.0, 80.0, null],
    ['piqueo_piononitos_espinaca', 'Piononitos de espinaca', 'Piqueos', 80.0, 30.0, 40.0, 80.0, null],
    ['piqueo_tequenos_guacamole', 'Tequeños con guacamole', 'Piqueos', 100.0, 30.0, 50.0, 100.0, null],
    ['piqueo_voulevans_jamon', 'Voulevans de jamón', 'Piqueos', 80.0, 30.0, 40.0, 80.0, null],
    ['piqueo_voulevans_tocino', 'Voulevans de tocino', 'Piqueos', 80.0, 30.0, 40.0, 80.0, null],
    ['piqueo_canapes_jamon_pina_durazno', 'Canapés jamón, piña, durazno', 'Piqueos', 80.0, 30.0, 40.0, 80.0, null],

    // --- PASTELES FAMILIARES ---
    ['fam_crema_volteada', 'Crema Volteada', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_mousse_fresa', 'Mousse de Fresa', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_mousse_maracuya', 'Mousse de Maracuyá', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_pastel_acelga', 'Pastel de Acelga', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_torta_tres_leches', 'Torta Tres Leches', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_pye_manzana', 'Pye de Manzana', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_pye_limon', 'Pye de Limón', 'Pasteles Familiares', 60.0, null, null, null, 60.0],
    ['fam_torta_choco', 'Torta de Chocolate', 'Pasteles Familiares', 45.0, null, null, null, 45.0],
    ['fam_torta_helada', 'Torta Helada', 'Pasteles Familiares', 45.0, null, null, null, 45.0],
    ['fam_torta_selva_negra', 'Torta Selva Negra', 'Pasteles Familiares', 45.0, null, null, null, 45.0],
    ['fam_torta_chantilly', 'Torta de Chantilly', 'Pasteles Familiares', 40.0, null, null, null, 40.0],
    ['fam_keke_pasas', 'Keke de Pasas', 'Pasteles Familiares', 16.0, null, null, null, 16.0],
    ['fam_keke_vainilla', 'Keke de Vainilla', 'Pasteles Familiares', 16.0, null, null, null, 16.0],
    ['fam_keke_marmol', 'Keke Marmolado', 'Pasteles Familiares', 16.0, null, null, null, 16.0],
    ['fam_keke_castana', 'Keke de Castaña', 'Pasteles Familiares', 16.0, null, null, null, 16.0],

    // --- EXTRAS PARA TORTAS CHANTILLY ---
    ['extra_torta_chocolate', 'Extra: Chocolate', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_selva_negra', 'Extra: Selva Negra', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_helada', 'Extra: Torta Helada', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_mousse_fresa', 'Extra: Mousse de Fresa', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_mousse_maracuya', 'Extra: Mousse de Maracuyá', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_pye_manzana', 'Extra: Pye de Manzana', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_pye_limon', 'Extra: Pye de Limón', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_keke_pasas', 'Extra: Keke de Pasas', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_keke_vainilla', 'Extra: Keke de Vainilla', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_keke_marmol', 'Extra: Keke Marmolado', 'Extras para tortas', 10.0, null, null, null, 10.0],
    ['extra_torta_keke_castana', 'Extra: Keke de Castaña', 'Extras para tortas', 10.0, null, null, null, 10.0],

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

  const preciosActualizados = productosIniciales.map((producto) => {
    const copia = [...producto];
    const actualizar = (indice, equivalencias) => {
      if (copia[indice] !== null && equivalencias[copia[indice]] !== undefined) {
        copia[indice] = equivalencias[copia[indice]];
      }
    };
    if (copia[7] === null) actualizar(3, { 70: 76 });
    actualizar(4, { 19: 22 });
    actualizar(5, { 35: 40 });
    if (copia[7] === null) actualizar(6, { 70: 76 });
    actualizar(7, {});
    return copia;
  });

  const stmt = db.prepare(`INSERT OR REPLACE INTO productos VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  preciosActualizados.forEach(p => stmt.run(p));
  stmt.finalize();
  db.run(`DELETE FROM productos WHERE id IN (
    'dulce_mousse_fresa_maracuya_lucuma', 'fam_mousse_fresa_maracuya', 'fam_pye_manzana_limon',
    'fam_keke_variado', 'torta_chantilly_30_35', 'torta_chantilly_80', 'torta_chantilly_tres_leches',
    'torta_chantilly_adicional', 'dulce_tartaleta_durazno_fresa', 'dulce_tartaleta_sauco_lucuma',
    'dulce_tortita_helada_selva'
  )`);

  const formulasBase = [
    {
      id: 'formula_sandwich_asado',
      nombre: '100 Sandwich de Asado',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Asado de pejerrey': 1, 'Lechuga': 0.333 }),
      descripcion: 'Fórmula general para 100 unidades.'
    },
    {
      id: 'formula_croissant_pollo',
      nombre: '100 Croissant con Pollo',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 1.5, 'Mayonesa': 0.25 }),
      descripcion: '100 croissant pollo = 1 pechuga y media, 1/4 de bolsa de 2kg de mayonesa.'
    },
    {
      id: 'formula_sandwich_lomito',
      nombre: '100 Sandwich de Lomito',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Lomito clientes': 1, 'Lomito casino': 1.25, 'Cebolla': 0.75 }),
      descripcion: 'Fórmula para 100 unidades del sandwich de lomito.'
    },
    {
      id: 'formula_petipan_pollo_durazno',
      nombre: '100 Petipan de pollo c/durazno',
      categoria: 'Sandwichitos',
      unidad: 'unidad',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 1.5, 'Durazno': 4 }),
      descripcion: '1 pechuga y media de pollo, 4 rodajas de durazno por cada 100.'
    },
    {
      id: 'formula_petipan_pollo_pina',
      nombre: '100 Petipan de pollo c/piña',
      categoria: 'Sandwichitos',
      unidad: 'unidad',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 1.5, 'Piña': 4 }),
      descripcion: '1 pechuga y media de pollo, 4 rodajas de piña por cada 100.'
    },
    {
      id: 'formula_sandwich_salchicha_nortena',
      nombre: '100 Sandwich de Salchicha norteña',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Huevo': 1, 'Salchicha': 1.3 }),
      descripcion: '100 sandwich salchicha norteña = 1 kilo de huevo, 1.3kg de salchicha.'
    },
    {
      id: 'formula_petipan_pollo',
      nombre: '100 Petipan de Pollo',
      categoria: 'Sandwichitos',
      unidad: 'unidad',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 2, 'Mayonesa': 0.25 }),
      descripcion: 'Base de producción para petipan de pollo.'
    },
    {
      id: 'formula_caprece_mozzarella',
      nombre: '100 Caprece Mozzarella con Tomate y Albaca',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Tomate': 1.25, 'Albaca': 0.15 }),
      descripcion: '1 kilo 1/4 de tomate y 150g de albaca por cada 100.'
    },
    {
      id: 'formula_sandwich_hamburguesita',
      nombre: '100 Sandwich Hamburguesita',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Hamburguesa': 3, 'Lechuga': 0.333 }),
      descripcion: '3kg de hamburguesa y 1/3 de 1/4 de lechuga por cada 100.'
    },
    {
      id: 'formula_croissant_mixto',
      nombre: '100 Croissant Mixto',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Jamón': 0.475, 'Queso': 0.475 }),
      descripcion: '475 gramos de jamón y 475 gramos de queso por cada 100.'
    },
    {
      id: 'formula_butifarras',
      nombre: '100 Butifarras',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Lechuga': 0.333 }),
      descripcion: 'Fórmula base para butifarras por cada 100.'
    },
    {
      id: 'formula_triple_jamon_queso',
      nombre: '100 Triple Jamón y Queso',
      categoria: 'Mini Triples',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Jamón': 0.25, 'Queso': 0.25 }),
      descripcion: 'Necesidad estándar del triple clásico.'
    },
    {
      id: 'formula_triple_palta_tomate_huevo',
      nombre: '100 Triple palta tomate huevo',
      categoria: 'Mini Triples',
      unidad: 'unidad',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Palta': 3, 'Tomate': 1, 'Huevo': 0.5 }),
      descripcion: '3 paltas medianas, 1 kilo de tomate y huevo por cada 100.'
    },
    {
      id: 'formula_triple_pollo_durazno',
      nombre: '100 Triple pollo con durazno',
      categoria: 'Mini Triples',
      unidad: 'lata',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 1.5, 'Durazno': 2 }),
      descripcion: '2 latas de durazno y 1 pechuga y media por cada 100.'
    },
    {
      id: 'formula_triple_pollo_pina',
      nombre: '100 Triple pollo con piña',
      categoria: 'Mini Triples',
      unidad: 'lata',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 1.5, 'Piña': 1.5 }),
      descripcion: '1.5 latas de piña y 1 pechuga y media por cada 100.'
    },
    {
      id: 'formula_triple_pollo_pecana_jamon',
      nombre: '100 Triple pollo pecana y jamon',
      categoria: 'Mini Triples',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pecana': 0.2, 'Jamón': 0.1 }),
      descripcion: '200 gramos de pecana por cada 100.'
    },
    {
      id: 'formula_triple_pollo_jamon_queso',
      nombre: '100 Triple pollo jamon y queso',
      categoria: 'Mini Triples',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Jamón': 0.25, 'Queso': 0.25 }),
      descripcion: 'Base para triple de pollo, jamón y queso por cada 100.'
    },
    {
      id: 'formula_triple_espinaca_queso_crema',
      nombre: '100 Triple espinaca queso crema',
      categoria: 'Mini Triples',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Espinaca': 1.25, 'Queso crema': 1 }),
      descripcion: '1 kilo 1/4 de espinaca, 1 kilo de queso crema por cada 100.'
    },
    {
      id: 'formula_triple_mermelada_queso_crema',
      nombre: '100 Triple mermelada queso crema',
      categoria: 'Mini Triples',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Mermelada': 0.5, 'Queso crema': 0.75 }),
      descripcion: '1/2kg mermelada y 3/4 kilo de queso crema por cada 100.'
    },
    {
      id: 'formula_triple_pollo_lomo_ahumado',
      nombre: '100 Triple pollo con lomo ahumado',
      categoria: 'Mini Triples',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 1.5, 'Lomo ahumado': 0.4 }),
      descripcion: '1 pechuga y media y 400 gramos de lomo ahumado por cada 100.'
    },
    {
      id: 'formula_triple_pollo_tocino',
      nombre: '100 Triple pollo con tocino',
      categoria: 'Mini Triples',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 1.5, 'Tocino': 0.5 }),
      descripcion: '1 pechuga y media y 500 gramos de tocino por cada 100.'
    },
    {
      id: 'formula_triple_pollo_aceituna',
      nombre: '100 Triple pollo con aceituna',
      categoria: 'Mini Triples',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Pechuga': 1.5, 'Aceituna': 0.3 }),
      descripcion: '1 pechuga y media y 300 gramos de aceituna por cada 100.'
    },
    {
      id: 'formula_pan_hamburguesita',
      nombre: '100 Sandwich Hamburguesita',
      categoria: 'Sandwichitos',
      unidad: 'kg',
      cantidad_base: 100,
      formula: JSON.stringify({ 'Hamburguesa': 3, 'Lechuga': 0.333 }),
      descripcion: 'Proyección de para hamburguesita en 100 uds.'
    }
  ];

  const stmtFormulas = db.prepare(`INSERT OR REPLACE INTO formulas_inventario VALUES (?, ?, ?, ?, ?, ?, ?)`);
  formulasBase.forEach((formula) => stmtFormulas.run(
    formula.id,
    formula.nombre,
    formula.categoria,
    formula.unidad,
    formula.cantidad_base,
    formula.formula,
    formula.descripcion
  ));
  stmtFormulas.finalize();

  const stockInicial = [
    ['pollo_base', 'Pollo', 0, 'kg'],
    ['pechuga', 'Pechuga', 0, 'kg'],
    ['harina', 'Harina', 0, 'kg'],
    ['mayonesa', 'Mayonesa', 0, 'kg'],
    ['tomate', 'Tomate', 0, 'kg'],
    ['lechuga', 'Lechuga', 0, 'kg'],
    ['jamon', 'Jamón', 0, 'kg'],
    ['queso', 'Queso', 0, 'kg'],
    ['durazno', 'Durazno', 0, 'lata'],
    ['piña', 'Piña', 0, 'lata']
  ];

  const stmtStock = db.prepare(`INSERT OR REPLACE INTO stock_inventario VALUES (?, ?, ?, ?, ?)`);
  stockInicial.forEach(([id, nombre, stock, unidad]) => stmtStock.run(id, nombre, stock, unidad, new Date().toISOString()));
  stmtStock.finalize();
});

module.exports = db;