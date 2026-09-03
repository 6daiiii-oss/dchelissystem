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

function normalizarProducto(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[´`]/g, '')
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

  for (const [clave, aliases] of Object.entries(PRODUCTOS_COCINA_ALIASES)) {
    if (aliases.some((alias) => normalizarProducto(alias) === valor)) return clave;
  }

  for (const [clave, aliases] of Object.entries(PRODUCTOS_COCINA_ALIASES)) {
    const claveNormalizada = normalizarProducto(clave);
    const aliasCoincide = aliases.some((alias) => {
      const aliasNormalizado = normalizarProducto(alias);
      return valor.includes(aliasNormalizado) || aliasNormalizado.includes(valor)
        || valor.includes(claveNormalizada) || claveNormalizada.includes(valor);
    });
    if (aliasCoincide) return clave;
  }

  return null;
}

// Middlewares
app.use(cors());
app.use(express.json());
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
      estado TEXT DEFAULT 'Registrado',
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.all(`PRAGMA table_info(pedidos)`, [], (err, columns) => {
    if (err) return console.error('Error verificando columnas de pedidos:', err.message);
    const hasEstado = columns && columns.some(col => col.name === 'estado');
    if (!hasEstado) {
      db.run(`ALTER TABLE pedidos ADD COLUMN estado TEXT DEFAULT 'Registrado'`);
    }
  });

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
  db.all(`SELECT id, nombre, categoria, precio FROM productos ORDER BY categoria ASC, nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Endpoint para registrar un nuevo pedido y asegurar su visualización en producción
app.post('/api/pedidos', (req, res) => {
  const { tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, detalles } = req.body;

    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ error: 'El pedido debe incluir al menos un detalle.' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const queryPedido = `INSERT INTO pedidos (codigo, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registrado')`;

        const fechaCodigo = String(fecha_recoge || '').replace(/-/g, '');
        const sufijoUnico = crypto.randomBytes(4).toString('hex').toUpperCase();
        const codigoPedido = `PED-${fechaCodigo}-${sufijoUnico}`;
        db.run(queryPedido, [codigoPedido, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge], function(err) {
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
           fecha_recoge, hora_recoge, estado, fecha_registro
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

  db.all(`SELECT id, cliente_nombre, tipo_cliente FROM pedidos WHERE fecha_recoge = ? ORDER BY id ASC`, [fecha], (err, clientes) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(
      `SELECT p.id as pedido_id, dp.producto_nombre, dp.cantidad, dp.paquetes 
       FROM detalles_pedido dp 
       JOIN pedidos p ON dp.pedido_id = p.id 
       WHERE p.fecha_recoge = ?`,
      [fecha],
      (err, detalles) => {
        if (err) return res.status(500).json({ error: err.message });

        // Clave del arreglo: producto_nombre pasa a ser el nombre CANÓNICO
        // (el mismo que aparece en PRODUCTOS_COCINA), así el frontend puede
        // comparar por igualdad exacta sin preocuparse por los alias.
        const detallesFiltrados = (detalles || [])
          .map((det) => ({ ...det, nombre_canonico: resolverNombreCocina(det.producto_nombre) }))
          .filter((det) => det.nombre_canonico)
          .map((det) => ({
            pedido_id: det.pedido_id,
            producto_nombre: det.nombre_canonico,       // <- ya canónico
            producto_nombre_original: det.producto_nombre, // <- por si lo necesitas mostrar
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

  db.all(`SELECT id, cliente_nombre FROM pedidos WHERE fecha_recoge = ? ORDER BY id ASC`, [fecha], async (err, clientes) => {
      if (err) return res.status(500).send(err.message);
      const listaClientes = clientes || [];

      db.all(
        `SELECT p.id as pedido_id, dp.producto_nombre, dp.cantidad, dp.paquetes 
         FROM detalles_pedido dp 
         JOIN pedidos p ON dp.pedido_id = p.id 
         WHERE p.fecha_recoge = ?`,
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