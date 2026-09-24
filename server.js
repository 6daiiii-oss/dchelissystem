const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const db = require('./db');
const { extraerPedidosCasino } = require('./casino-production');
const { unirCronogramasCasino } = require('./casino-archive');
const { resolverPetipanNombre, resolverCiabattaNombre, filtrarItemsEmbalaje, grupoProductoProduccion } = require('./public/production-classification');

const app = express();

const bcrypt = require('bcryptjs');

app.set('trust proxy', 1);

const ADMIN_COOKIE = 'dchelis_admin_session';
const COLLAB_COOKIE = 'dchelis_collaborator_session';
const SESSION_MS = 60 * 60 * 1000;
const SESSION_SECRET = String(process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(48).toString('hex'));
const LOGIN_ATTEMPTS = new Map();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 12);

if (!process.env.ADMIN_SESSION_SECRET) {
  console.warn('SEGURIDAD: ADMIN_SESSION_SECRET no está configurado. Se usará un secreto temporal y las sesiones se cerrarán al reiniciar.');
}

function dbGetAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
  });
}

function dbAllAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

function dbRunAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes || 0 });
    });
  });
}

function resolverProductoProduccion(nombre) {
  return resolverNombreCocina(nombre)
    || PRODUCTOS_COCINA_EXTRA.find((producto) => normalizarProducto(producto) === normalizarProducto(nombre))
    || nombre;
}

async function cargarCasinosProduccion(fecha) {
  const cronogramas = await dbAllAsync(`
    SELECT id, datos_json FROM casino_cronogramas
    WHERE fecha_inicio <= ? AND fecha_fin >= ?
    ORDER BY id DESC
  `, [fecha, fecha]);
  for (const row of cronogramas) {
    let datos;
    try { datos = JSON.parse(row.datos_json); } catch { continue; }
    if (!Array.isArray(datos?.dias) || !datos.dias.some((dia) => dia.fecha === fecha)) continue;
    const resultado = extraerPedidosCasino(datos, fecha, resolverProductoProduccion);
    resultado.clientes.forEach((cliente) => { cliente.cronograma_casino_id = row.id; });
    return resultado;
  }
  return { clientes: [], detalles: [] };
}

function inicioSemanaCasino(fechaIso) {
  const fecha = new Date(`${fechaIso}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return '';
  const dia = fecha.getUTCDay();
  const retroceso = dia === 0 ? 6 : dia - 1;
  fecha.setUTCDate(fecha.getUTCDate() - retroceso);
  return fecha.toISOString().slice(0, 10);
}

async function sincronizarPedidosCasinoCronograma(cronogramaId, datos) {
  if (!cronogramaId || !Array.isArray(datos?.dias)) return 0;
  let creados = 0;

  for (const dia of datos.dias) {
    if (!dia?.fecha) continue;
    const casinos = Array.isArray(dia.casinos) && dia.casinos.length ? dia.casinos : (datos.casinos || []);
    for (const casinoOriginal of casinos) {
      const casino = String(casinoOriginal || '').trim();
      if (!casino) continue;

      const items = (dia.productos || []).map((producto) => ({
        producto_nombre: resolverProductoProduccion(producto?.nombre || ''),
        cantidad: Number(producto?.por_casino?.[casino] || 0)
      })).filter((item) => item.producto_nombre && Number.isFinite(item.cantidad) && item.cantidad > 0);
      if (!items.length) continue;

      const casinoUid = `cronograma:${cronogramaId}:${dia.fecha}:${normalizarProducto(casino)}`;
      const existente = await dbGetAsync(`SELECT id FROM pedidos WHERE casino_uid = ? LIMIT 1`, [casinoUid]);
      if (existente) continue;

      const hash = crypto.createHash('sha1').update(casinoUid).digest('hex').slice(0, 8).toUpperCase();
      const codigo = `CAS-${String(dia.fecha).replace(/-/g, '')}-${hash}`;
      const pedido = await dbRunAsync(`
        INSERT INTO pedidos (
          codigo, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago,
          fecha_recoge, hora_recoge, dedicatoria, foto_torta, tipo_comprobante, numero_documento,
          nro_operacion, estado, fecha_emision, origen, cronograma_casino_id,
          casino_nombre, casino_semana, casino_uid
        ) VALUES (?, 'Casino', ?, 'CASINO', 0, 0, 'Cuenta Casino', ?, '12:00', '', '', '', '', '',
                  'Registrado', CURRENT_TIMESTAMP, 'casino', ?, ?, ?, ?)
      `, [codigo, casino, dia.fecha, Number(cronogramaId), casino, inicioSemanaCasino(dia.fecha), casinoUid]);

      let pedidoId = pedido.lastID;
      if (!pedidoId) {
        const fila = await dbGetAsync(`SELECT id FROM pedidos WHERE casino_uid = ? LIMIT 1`, [casinoUid]);
        pedidoId = fila?.id;
      }
      if (!pedidoId) continue;

      for (const item of items) {
        await dbRunAsync(
          `INSERT INTO detalles_pedido (pedido_id, producto_nombre, cantidad, subtotal, paquetes, foto_torta)
           VALUES (?, ?, ?, 0, '{}', '')`,
          [pedidoId, item.producto_nombre, item.cantidad]
        );
      }
      creados += 1;
    }
  }
  return creados;
}

async function construirCronogramaCasinoDesdePedidos() {
  const rows = await dbAllAsync(`
    SELECT p.id, p.cliente_nombre, p.casino_nombre, p.fecha_recoge, p.cronograma_casino_id,
           dp.producto_nombre, dp.cantidad
    FROM pedidos p
    JOIN detalles_pedido dp ON dp.pedido_id = p.id
    WHERE p.origen = 'casino'
      AND COALESCE(p.estado, 'Registrado') <> 'Cancelado'
    ORDER BY p.fecha_recoge ASC, p.id ASC, dp.id ASC
  `);
  if (!rows.length) return null;

  const dias = new Map();
  const casinos = new Set();
  for (const row of rows) {
    const fecha = String(row.fecha_recoge || '');
    if (!fecha) continue;
    const casino = String(row.casino_nombre || row.cliente_nombre || 'Casino').trim();
    if (!dias.has(fecha)) {
      const fechaObj = new Date(`${fecha}T12:00:00Z`);
      dias.set(fecha, {
        fecha,
        dia: Number.isNaN(fechaObj.getTime()) ? '' : diaFechaCasino(fechaObj),
        casinos: new Set(),
        productos: new Map()
      });
    }
    const dia = dias.get(fecha);
    dia.casinos.add(casino);
    casinos.add(casino);

    const nombre = resolverProductoProduccion(row.producto_nombre) || row.producto_nombre;
    const clave = normalizarProducto(nombre);
    if (!clave) continue;
    if (!dia.productos.has(clave)) {
      dia.productos.set(clave, {
        nombre,
        grupo: grupoProductoCasino(nombre) === 'extra' ? 'extra' : 'principal',
        por_casino: {},
        total: 0
      });
    }
    const producto = dia.productos.get(clave);
    const cantidad = Number(row.cantidad || 0);
    if (!(cantidad > 0)) continue;
    producto.por_casino[casino] = Number(producto.por_casino[casino] || 0) + cantidad;
    producto.total += cantidad;
  }

  const diasOrdenados = [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((dia) => ({
    fecha: dia.fecha,
    dia: dia.dia,
    casinos: [...dia.casinos],
    productos: [...dia.productos.values()].sort((a, b) => {
      if (a.grupo !== b.grupo) return a.grupo === 'principal' ? -1 : 1;
      const lista = a.grupo === 'extra' ? PRODUCTOS_COCINA_EXTRA : PRODUCTOS_COCINA;
      const mapa = new Map(lista.map((nombre, indice) => [normalizarProducto(nombre), indice]));
      const ai = mapa.get(normalizarProducto(a.nombre)) ?? 9999;
      const bi = mapa.get(normalizarProducto(b.nombre)) ?? 9999;
      return ai - bi || String(a.nombre).localeCompare(String(b.nombre), 'es');
    })
  }));

  return {
    id: 'pedidos-casino',
    nombre_archivo: 'Cronogramas persistentes',
    fecha_inicio: diasOrdenados[0]?.fecha || '',
    fecha_fin: diasOrdenados.at(-1)?.fecha || '',
    casinos: [...casinos],
    dias: diasOrdenados
  };
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function signSession(payload) {
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  for (const item of cookies) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return '';
}

function verifySignedSession(req, cookieName) {
  const token = readCookie(req, cookieName);
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.uid || Number(payload.exp || 0) <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function resolveSessionUser(req, cookieName, allowedRoles) {
  const session = verifySignedSession(req, cookieName);
  if (!session) return null;

  const user = await dbGetAsync(
    `SELECT id, usuario, nombre, rol, activo FROM usuarios WHERE id = ? LIMIT 1`,
    [Number(session.uid)]
  );
  if (!user || !user.activo || !allowedRoles.includes(String(user.rol))) return null;
  return user;
}

async function resolveStaffUser(req) {
  return await resolveSessionUser(req, ADMIN_COOKIE, ['admin'])
    || await resolveSessionUser(req, COLLAB_COOKIE, ['colaborador', 'admin']);
}

function sameOriginRequest(req) {
  const origin = String(req.get('origin') || '').trim();
  if (!origin) return true;
  const expectedOrigin = String(process.env.ADMIN_ORIGIN || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return origin.replace(/\/$/, '') === expectedOrigin;
}

async function requireAdminAuth(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const user = await resolveSessionUser(req, ADMIN_COOKIE, ['admin']);
    if (!user) return res.status(401).json({ error: 'Sesión administrativa requerida.' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOriginRequest(req)) {
      return res.status(403).json({ error: 'Origen no autorizado.' });
    }
    req.authUser = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'No se pudo validar la sesión.' });
  }
}

async function requireStaffAuth(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const user = await resolveStaffUser(req);
    if (!user) return res.status(401).json({ error: 'Sesión requerida.' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOriginRequest(req)) {
      return res.status(403).json({ error: 'Origen no autorizado.' });
    }
    req.authUser = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'No se pudo validar la sesión.' });
  }
}

async function protectDigitacionOrigin(req, res, next) {
  if (String(req.body?.origen || '').trim().toLowerCase() !== 'digitacion') return next();
  try {
    const user = await resolveStaffUser(req);
    if (!user) return res.status(401).json({ error: 'Sesión requerida para registrar pedidos por digitación.' });
    req.authUser = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'No se pudo validar la sesión.' });
  }
}

function adminSecurityHeaders(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function loginRateKey(req, scope) {
  return `${scope}:${String(req.ip || req.socket?.remoteAddress || 'unknown')}`;
}

function checkLoginRate(req, scope) {
  const key = loginRateKey(req, scope);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const previous = LOGIN_ATTEMPTS.get(key) || { count: 0, resetAt: now + windowMs };
  const current = previous.resetAt <= now ? { count: 0, resetAt: now + windowMs } : previous;
  if (current.count >= maxAttempts) return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  return { allowed: true, key, state: current };
}

function registerFailedLogin(key, state) {
  LOGIN_ATTEMPTS.set(key, { count: state.count + 1, resetAt: state.resetAt });
}

function clearLoginRate(req, scope) {
  LOGIN_ATTEMPTS.delete(loginRateKey(req, scope));
}

function buildSessionCookie(req, cookieName, token, maxAgeSeconds) {
  const secure = req.secure || process.env.NODE_ENV === 'production';
  const attributes = [
    `${cookieName}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

async function authenticateUser(req, res, roles, cookieName, rateScope) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sameOriginRequest(req)) return res.status(403).json({ error: 'Origen no autorizado.' });

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  const rate = checkLoginRate(req, rateScope);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' });
  }

  const usuario = String(req.body?.usuario || '').trim();
  const password = String(req.body?.password || '');
  const user = usuario
    ? await dbGetAsync(
        `SELECT id, usuario, nombre, password_hash, rol, activo FROM usuarios WHERE LOWER(usuario) = LOWER(?) LIMIT 1`,
        [usuario]
      )
    : null;

  const passwordOk = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  if (!user || !user.activo || !allowedRoles.includes(String(user.rol)) || !passwordOk) {
    registerFailedLogin(rate.key, rate.state);
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  }

  clearLoginRate(req, rateScope);
  await dbRunAsync(`UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]).catch(() => {});

  const expiresAt = Date.now() + SESSION_MS;
  const token = signSession({
    uid: Number(user.id),
    sub: user.usuario,
    name: user.nombre,
    role: user.rol,
    exp: expiresAt,
    nonce: crypto.randomBytes(12).toString('hex')
  });

  res.setHeader('Set-Cookie', buildSessionCookie(req, cookieName, token, Math.floor(SESSION_MS / 1000)));
  return res.json({ ok: true, usuario: user.usuario, nombre: user.nombre, rol: user.rol, expira: expiresAt });
}

function clearSessionCookie(req, res, cookieName) {
  res.setHeader('Set-Cookie', buildSessionCookie(req, cookieName, '', 0));
}

function normalizarEstadoPedido(estado) {
  if (!estado) return 'Registrado';
  return String(estado).trim() === 'Pagado' ? 'Registrado' : String(estado).trim();
}

function validarComprobante(tipo, numero) {
  const comprobante = String(tipo || '').trim().toLowerCase();
  const documento = String(numero || '').trim();
  if (!comprobante && !documento) return true;
  if (comprobante === 'boleta') return /^\d{8}$/.test(documento);
  if (comprobante === 'factura') return /^\d{11}$/.test(documento);
  return false;
}


function sumarDiasIso(fechaIso, dias = 1) {
  const match = String(fechaIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const fecha = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  fecha.setUTCDate(fecha.getUTCDate() + Number(dias || 0));
  return fecha.toISOString().slice(0, 10);
}

function instanteLima(fechaIso, hora = '08:00') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaIso || '')) || !/^\d{2}:\d{2}$/.test(String(hora || ''))) return null;
  const fecha = new Date(`${fechaIso}T${hora}:00-05:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function esUrgentePorEmision(fechaHoja, pedido = {}) {
  if (String(pedido.fecha_recoge || '') !== String(fechaHoja || '')) return false;

  const fechaAnterior = sumarDiasIso(fechaHoja, -1);
  const desde = instanteLima(fechaAnterior, '08:00');
  const hasta = instanteLima(fechaHoja, '08:00');
  if (!desde || !hasta) return false;

  const valorEmision = pedido.fecha_emision || pedido.fecha_registro;
  if (!valorEmision) return false;
  const emision = valorEmision instanceof Date ? valorEmision : new Date(valorEmision);
  if (Number.isNaN(emision.getTime())) return false;

  return emision.getTime() >= desde.getTime() && emision.getTime() <= hasta.getTime();
}

function firmaDetallesPedido(detalles = []) {
  const acumulado = new Map();
  (Array.isArray(detalles) ? detalles : []).forEach((item) => {
    const nombre = normalizarProducto(item?.producto_nombre || '');
    const cantidad = Number(item?.cantidad || 0);
    if (!nombre || !(cantidad > 0)) return;
    acumulado.set(nombre, Number(acumulado.get(nombre) || 0) + cantidad);
  });
  return [...acumulado.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([nombre, cantidad]) => `${nombre}::${Number(cantidad.toFixed(3))}`)
    .join('|');
}

function similitudDetallesPedido(a = [], b = []) {
  const mapa = (detalles) => {
    const m = new Map();
    (detalles || []).forEach((item) => {
      const nombre = normalizarProducto(item?.producto_nombre || '');
      const cantidad = Number(item?.cantidad || 0);
      if (!nombre || !(cantidad > 0)) return;
      m.set(nombre, Number(m.get(nombre) || 0) + cantidad);
    });
    return m;
  };
  const ma = mapa(a);
  const mb = mapa(b);
  const claves = new Set([...ma.keys(), ...mb.keys()]);
  if (!claves.size) return 0;
  let coincidencias = 0;
  let total = 0;
  claves.forEach((clave) => {
    const qa = Number(ma.get(clave) || 0);
    const qb = Number(mb.get(clave) || 0);
    coincidencias += Math.min(qa, qb);
    total += Math.max(qa, qb);
  });
  return total > 0 ? coincidencias / total : 0;
}

async function buscarPedidoDuplicado({ celular, fecha_recoge, hora_recoge, detalles, excluir_id = null }) {
  const telefono = String(celular || '').replace(/\D/g, '');
  if (!telefono || !fecha_recoge || !hora_recoge || !Array.isArray(detalles) || !detalles.length) return null;

  const params = [telefono, String(fecha_recoge), String(hora_recoge)];
  let sql = `
    SELECT id, codigo, cliente_nombre, celular, fecha_recoge, hora_recoge
    FROM pedidos
    WHERE REGEXP_REPLACE(COALESCE(celular, ''), '[^0-9]', '', 'g') = ?
      AND fecha_recoge = ?
      AND hora_recoge = ?
      AND COALESCE(estado, 'Registrado') <> 'Cancelado'
      AND COALESCE(origen, 'pg') <> 'casino'
  `;
  if (excluir_id) {
    sql += ' AND id <> ?';
    params.push(Number(excluir_id));
  }
  sql += ' ORDER BY id DESC LIMIT 8';

  const candidatos = await dbAllAsync(sql, params);
  const firmaNueva = firmaDetallesPedido(detalles);

  for (const pedido of candidatos) {
    const existentes = await dbAllAsync(
      `SELECT producto_nombre, cantidad FROM detalles_pedido WHERE pedido_id = ? ORDER BY id ASC`,
      [pedido.id]
    );
    const firmaExistente = firmaDetallesPedido(existentes);
    const similitud = similitudDetallesPedido(detalles, existentes);
    if (firmaNueva && firmaNueva === firmaExistente) {
      return { ...pedido, tipo_coincidencia: 'exacta', similitud: 1 };
    }
    if (similitud >= 0.78) {
      return { ...pedido, tipo_coincidencia: 'similar', similitud: Number(similitud.toFixed(2)) };
    }
  }
  return null;
}

const PRODUCTOS_TORTAS = [
  'Torta Chantilly - Foto',
  'Torta Chantilly (30 Porciones aprox)',
  'Torta Chantilly (60 Porciones aprox)',
  'Torta Chantilly (90 Porciones aprox)',
  'Torta de Chantilly',
  'Torta Mousse de Fresa',
  'Torta Mousse de Maracuyá',
  'Torta Tres Leches',
  'Torta Pye de Manzana',
  'Torta Pye de Limón',
  'Torta de Chocolate',
  'Torta Helada',
  'Torta Selva Negra'
];

const PRODUCTOS_COCINA = [
  'Torta Chantilly - Foto', 'Torta Chantilly (30 Porciones aprox)', 'Torta Chantilly (60 Porciones aprox)', 'Torta Chantilly (90 Porciones aprox)',
  'Torta de Chantilly', 'Torta Mousse de Fresa', 'Torta Mousse de Maracuyá', 'Torta Tres Leches', 'Torta Pye de Manzana',
  'Torta Pye de Limón', 'Torta de Chocolate', 'Torta Helada', 'Torta Selva Negra',
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
  'Pan de Molde Blanco chico', 'Pan de Molde Integral chico', 'Baguetina', 'Mini Francés', 'Mini Croissant',
  'Pan de Hamburguesa', 'Mini Arabe', 'Mini Ciabatta', 'Mini Integral', 'Mini Jamón', 'Mini Hot Dog', 'Mini Aceituna'
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
  'TARTALETA DURAZNO': ['TARTALETA DURAZNO', 'TARTALETA DE DURAZNO'],
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
  const petipan = resolverPetipanNombre(nombre);
  if (petipan) return petipan;
  const ciabatta = resolverCiabattaNombre(nombre);
  if (ciabatta) return ciabatta;
  const valor = normalizarProducto(nombre);
  if (!valor) return null;

  const tortaExacta = PRODUCTOS_TORTAS.find((producto) => normalizarProducto(producto) === valor);
  if (tortaExacta) return tortaExacta;

  if (valor === 'TORTA TRES LECHES' || valor === 'TORTA DE TRES LECHES') return 'Torta Tres Leches';

  const extraExacto = PRODUCTOS_COCINA_EXTRA.find((producto) => normalizarProducto(producto) === valor);
  if (extraExacto) return extraExacto;

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


const CASINO_DIAS_ALIAS = Object.fromEntries(Object.entries({
  L: 'LUNES', LUN: 'LUNES', LUNES: 'LUNES',
  M: 'MARTES', MAR: 'MARTES', MARTES: 'MARTES',
  X: 'MIERCOLES', MI: 'MIERCOLES', MIE: 'MIERCOLES', MIER: 'MIERCOLES', MIERCOLES: 'MIERCOLES',
  J: 'JUEVES', JUE: 'JUEVES', JUEVES: 'JUEVES',
  V: 'VIERNES', VIE: 'VIERNES', VIERNES: 'VIERNES',
  S: 'SABADO', SAB: 'SABADO', SABADO: 'SABADO',
  D: 'DOMINGO', DOM: 'DOMINGO', DOMINGO: 'DOMINGO'
}).map(([clave, valor]) => [normalizarProducto(clave), valor]));

function resolverDiaCasino(valor) {
  const clave = normalizarProducto(valor).replace(/\bDIAS?\b/g, '').trim();
  return CASINO_DIAS_ALIAS[clave] || '';
}

const CASINO_MESES = {
  ENE: 0, ENERO: 0, FEB: 1, FEBRERO: 1, MAR: 2, MARZO: 2, ABR: 3, ABRIL: 3,
  MAY: 4, MAYO: 4, JUN: 5, JUNIO: 5, JUL: 6, JULIO: 6, AGO: 7, AGOSTO: 7,
  SEP: 8, SET: 8, SEPT: 8, SETIEMBRE: 8, SEPTIEMBRE: 8, OCT: 9, OCTUBRE: 9,
  NOV: 10, NOVIEMBRE: 10, DIC: 11, DICIEMBRE: 11
};

function contextoFechaCasinoHoja(hoja, anterior = {}) {
  const textos = [String(hoja?.name || '')];
  for (let fila = 1; fila <= Math.min(5, hoja.rowCount || 0); fila += 1) {
    for (let columna = 1; columna <= Math.min(4, hoja.columnCount || 0); columna += 1) {
      const valor = valorCeldaCasino(hoja.getCell(fila, columna));
      if (valor !== null && valor !== undefined && !(valor instanceof Date)) textos.push(String(valor));
      if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        textos.push(String(valor.getFullYear()));
        textos.push(Object.keys(CASINO_MESES).find((mes) => CASINO_MESES[mes] === valor.getMonth()) || '');
      }
    }
  }
  const unido = normalizarProducto(textos.join(' '));
  const anioExplicito = unido.match(/\b(20\d{2})\b/);
  let mes = null;
  for (const [nombre, indice] of Object.entries(CASINO_MESES)) {
    if (new RegExp(`(?:^|\\s)${nombre}(?:\\s|$)`).test(unido)) {
      mes = indice;
      break;
    }
  }
  let anio = anioExplicito ? Number(anioExplicito[1]) : Number(anterior.anio || new Date().getFullYear());
  if (!anioExplicito && Number.isInteger(mes) && Number.isInteger(anterior.mes) && mes < anterior.mes - 6) anio += 1;
  return { anio, mes: Number.isInteger(mes) ? mes : (Number.isInteger(anterior.mes) ? anterior.mes : null) };
}

function nombreCasinoDesdeHoja(hoja, filaCabecera) {
  const candidatos = [
    valorCeldaCasino(hoja.getCell(filaCabecera, 1)),
    valorCeldaCasino(hoja.getCell(1, 1)),
    hoja.name
  ].map((valor) => String(valor || '').replace(/\s+/g, ' ').trim()).filter(Boolean);

  for (const candidatoOriginal of candidatos) {
    let candidato = candidatoOriginal.replace(/[→]/g, ' ').trim();
    const clave = normalizarProducto(candidato);
    if (!clave || /^(DIAS?|FECHAS?|ARTICULO|PAN|TIPO)$/.test(clave)) continue;
    candidato = candidato.replace(/\bCRONOGRAMA\b.*$/i, '').trim();
    candidato = candidato.replace(/\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SETIEMBRE|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE|ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SET|SEP|OCT|NOV|DIC)\b.*$/i, '').trim();
    candidato = candidato.replace(/\b(20\d{2}|MODIF(?:ICADO)?|CORREGIDO|RECTIF(?:ICADO)?|ADIC(?:IONAL)?)\b.*$/i, '').trim();
    if (candidato) return candidato;
  }
  return String(hoja.name || 'Casino').trim();
}

const CASINO_PETIPAN_VARIANTES = Object.fromEntries(Object.entries({
  'PETIPAN': 'Petipan',
  'PETIPAN CON POLLO': 'Petipan de Pollo',
  'PETIPAN POLLO': 'Petipan de Pollo',
  'PETIPAN DE POLLO': 'Petipan de Pollo',
  'PETIPAN POLLO CON DURAZNO': 'Petipan de pollo c/durazno',
  'PETIPAN POLLO DURAZNO': 'Petipan de pollo c/durazno',
  'PETIPAN DE POLLO C DURAZNO': 'Petipan de pollo c/durazno',
  'PETIPAN POLLO CON PINA': 'Petipan de pollo c/piña',
  'PETIPAN POLLO PINA': 'Petipan de pollo c/piña',
  'PETIPAN DE POLLO C PINA': 'Petipan de pollo c/piña',
  'PETIPAN CON JAMON': 'Petipan con jamón',
  'PETIPAN CON HOT DOG': 'Petipan con hot dog',
  'PETIPAN CON LOMITO': 'Petipan con lomito',
  'PETIPAN HAMBURGUESA QUESO': 'Petipan hamburguesa queso',
  'PETIPAN JAMON QUESO': 'Petipan jamón queso',
  'PETIPAN MECHADA': 'Petipan mechada',
  'PETIPAN POLLO CAMPESINO': 'Petipan pollo campesino',
  'PETIPAN POLLO CON APIO': 'Petipan pollo con apio',
  'PETIPAN POLLO CON PECANAS': 'Petipan pollo con pecanas',
  'PETIPAN POLLO CRISPY': 'Petipan pollo crispy'
}).map(([clave, valor]) => [normalizarProducto(clave), valor]));

function resolverVariantePetipanCasino(nombre) {
  const variante = resolverPetipanNombre(nombre);
  if (variante) return variante;
  const limpio = String(nombre || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const clave = normalizarProducto(limpio);
  if (!clave || !/^PETIPAN(?:\s|$)/.test(clave)) return null;

  if (CASINO_PETIPAN_VARIANTES[clave]) return CASINO_PETIPAN_VARIANTES[clave];

  // Cualquier sabor/relleno no catalogado se conserva como un ítem independiente.
  // Nunca se colapsa una variante de PETIPAN al producto genérico "Petipan".
  return limpio;
}

const CASINO_ALIAS_EXACTOS = Object.fromEntries(Object.entries({
  'PAN CIABATTA CHICO X 100UND': 'Mini Ciabatta',
  'PAN PETIPAN CHICO X 100UND': 'Petipan',
  'PAN PULLMAN 10 TAPAS': 'Pan de Molde (Pullman)',
  'PAN PULLMAN 10 TAPAS INTEGRAL': 'Pan de Molde Integral',
  'PULMAN BLANCO': 'Pan de Molde (Pullman)',
  'PULLMAN BLANCO': 'Pan de Molde (Pullman)',
  'PULMAN MARMOLEADO': 'Pan de Molde Marmoleado',
  'PULLMAN MARMOLEADO': 'Pan de Molde Marmoleado',
  'MINNI PETIPAN': 'Petipan',
  'MINI PETIPAN': 'Petipan',
  'MINNI CROISANT': 'Mini Croissant',
  'MINNI CROISSANT': 'Mini Croissant',
  'MINI CROISANT': 'Mini Croissant',
  'MINNI CIABATTA': 'Mini Ciabatta',
  'MINNI HAMBURGUESA': 'Pan de Hamburguesa',
  'MINNI BAGUETINO': 'Baguetina',
  'MINI BAGUETINO': 'Baguetina',
  'MINNI FRANCES': 'Mini Francés',
  'PIONO': 'PIONONO',
  'NIDO DE AMOR': 'NIDITOS',
  'NIDOS DE AMOR': 'NIDITOS',
  'ALFAJORES': 'ALFAJOR',
  'OREJAS': 'OREJITAS',
  'ALFAJORES CHOCOLATE': 'ALFAJOR CHOCOLATE',
  'PAN BAGUETTE MINI': 'Baguetina',
  'PAN CIABATTA MINI': 'Mini Ciabatta',
  'PAN CROISSANT MINI': 'Mini Croissant',
  'PAN FRANCES MINI': 'Mini Francés',
  'PAN ARABE MINI': 'Mini Arabe',
  'PAN PARA HOT DOG MINI': 'Mini Hot Dog',
  'PAN HOT DOG MINI': 'Mini Hot Dog',
  'PAN HAMBURGUESITA': 'Pan de Hamburguesa',
  'PAN HAMBURGUESA MINI': 'Pan de Hamburguesa',
  'EMPANADITAS DE QUESO': 'EMPANADA QUESO',
  'EMPANADITA DE QUESO': 'EMPANADA QUESO',
  'FRANCES POLLO PINA': 'Petipan de pollo c/piña',
  'FRANCES POLLO DURAZNO': 'Petipan de pollo c/durazno',
  'FRANCES POLLO CLASICO': 'Petipan de Pollo',
  'FRANCES ASADO': 'Sandwich de Asado',
  'FRANCES LOMITO': 'Sandwich de Lomito',
  'FRANCES HAMBURGUESA': 'Sandwich Hamburguesita',
  'TRIPLE POLLO C ACEITUNA': 'Triple pollo con aceituna',
  'TRIPLE POLLO CON ACEITUNA': 'Triple pollo con aceituna',
  'TRIPLE POLLO C PINA': 'Triple pollo con piña',
  'TRIPLE POLLO CON PINA': 'Triple pollo con piña',
  'TRIPLE POLLO TOCINO': 'Triple pollo y tocino',
  'TRIPLE JAMON QUESO': 'Triple de Jamón y queso',
  'TRIPLE POLLO JAMON QUESO': 'Triple pollo, jamón y queso',
  'TRIPLE PALTA TOMATE HUEVO': 'Triple palta, tomate, huevo'
}).map(([clave, valor]) => [normalizarProducto(clave), valor]));

function valorCeldaCasino(cell) {
  const valor = cell?.value;
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    if (Object.prototype.hasOwnProperty.call(valor, 'result')) return valor.result;
    if (Array.isArray(valor.richText)) return valor.richText.map((item) => item.text || '').join('');
    if (Object.prototype.hasOwnProperty.call(valor, 'text')) return valor.text;
    if (Object.prototype.hasOwnProperty.call(valor, 'hyperlink')) return valor.text || '';
  }
  return valor;
}

function numeroCasino(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor !== 'string') return 0;
  const limpio = valor.replace(/\u00a0/g, '').replace(',', '.').trim();
  if (!limpio) return 0;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : 0;
}

function fechaExcelCasino(valor, anioReferencia = new Date().getFullYear(), mesReferencia = null) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return new Date(Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate()));
  }

  if (typeof valor === 'number' && Number.isFinite(valor) && valor > 20000 && valor < 80000) {
    const milisegundos = Date.UTC(1899, 11, 30) + Math.round(valor * 86400000);
    return new Date(milisegundos);
  }
  if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 1 && valor <= 31 && Number.isInteger(mesReferencia)) {
    return new Date(Date.UTC(Number(anioReferencia), mesReferencia, Number(valor)));
  }

  const textoOriginal = String(valor ?? '').trim();
  if (!textoOriginal) return null;
  const texto = normalizarProducto(textoOriginal);

  if (/^\d{1,2}$/.test(texto) && Number.isInteger(mesReferencia)) {
    const dia = Number(texto);
    if (dia >= 1 && dia <= 31) return new Date(Date.UTC(Number(anioReferencia), mesReferencia, dia));
  }

  let match = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (match) {
    let anio = Number(match[3]);
    if (anio < 100) anio += 2000;
    return new Date(Date.UTC(anio, Number(match[2]) - 1, Number(match[1])));
  }

  match = texto.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  match = texto.match(/^(\d{1,2})[\s\/-]+([A-Z]+)(?:[\s\/-]+(\d{2,4}))?$/);
  if (match) {
    const mes = CASINO_MESES[match[2]];
    if (mes !== undefined) {
      let anio = match[3] ? Number(match[3]) : Number(anioReferencia);
      if (anio < 100) anio += 2000;
      return new Date(Date.UTC(anio, mes, Number(match[1])));
    }
  }

  return null;
}

function isoFechaCasino(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return '';
  const yyyy = fecha.getUTCFullYear();
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function diaFechaCasino(fecha) {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return dias[fecha.getUTCDay()] || '';
}

function resolverNombreCasino(nombre, pan = '', tipo = '') {
  const combinado = [pan, tipo].filter(Boolean).join(' ').trim();
  const candidatos = [combinado, nombre].filter(Boolean);

  for (const candidato of candidatos) {
    const clave = normalizarProducto(candidato);
    if (!clave) continue;

    // PETIPAN necesita identidad por relleno/sabor. Se resuelve antes que los
    // aliases generales para impedir que "PETIPAN POLLO CRISPY", por ejemplo,
    // termine agrupado simplemente como "Petipan".
    const petipan = resolverVariantePetipanCasino(candidato);
    if (petipan) return petipan;

    if (CASINO_ALIAS_EXACTOS[clave]) return CASINO_ALIAS_EXACTOS[clave];
    const resuelto = resolverNombreCocina(candidato);
    if (resuelto) return resuelto;
  }

  const limpio = String(nombre || combinado || '').replace(/\s+/g, ' ').trim();
  return limpio || 'Producto sin nombre';
}

function grupoProductoCasino(nombre, categoria = '', esFormatoPanTipo = false) {
  const clave = normalizarProducto(nombre);
  if (PRODUCTOS_COCINA_EXTRA.some((item) => normalizarProducto(item) === clave)) return 'extra';
  if (PRODUCTOS_COCINA.some((item) => normalizarProducto(item) === clave)) return 'principal';

  const grupoCompartido = grupoProductoProduccion(nombre, normalizarProducto);
  if (grupoCompartido !== 'Bocaditos') return 'extra';

  const contexto = normalizarProducto(`${categoria} ${nombre}`);
  if (
    esFormatoPanTipo ||
    /\b(PAN|TRIPLE|SANDWICH|SANGUCHE|PETIPAN|CROISSANT|HAMBURGUESA|HOT DOG|BAGUET|CIABATTA|FRANCES|PIQUEO)\b/.test(contexto)
  ) return 'extra';

  return 'principal';
}

function huellaCronogramaCasino(datos) {
  const dias = (Array.isArray(datos?.dias) ? datos.dias : [])
    .map((dia) => ({
      fecha: String(dia?.fecha || ''),
      productos: (Array.isArray(dia?.productos) ? dia.productos : [])
        .map((producto) => ({
          nombre: normalizarProducto(resolverProductoProduccion(producto?.nombre || '') || producto?.nombre || ''),
          por_casino: Object.entries(producto?.por_casino || {})
            .map(([casino, cantidad]) => [normalizarProducto(casino), Number(cantidad || 0)])
            .filter(([, cantidad]) => Number.isFinite(cantidad) && cantidad > 0)
            .sort((a, b) => a[0].localeCompare(b[0], 'es'))
        }))
        .filter((producto) => producto.nombre && producto.por_casino.length)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }))
    .filter((dia) => dia.fecha && dia.productos.length)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return crypto.createHash('sha256').update(JSON.stringify(dias)).digest('hex');
}

async function procesarCronogramaCasinos(buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);

  const diasMap = new Map();
  const casinosOrden = [];
  const advertencias = [];
  const productosNoReconocidos = new Set();

  let contextoCronologico = { anio: null, mes: null };

  libro.worksheets.forEach((hoja) => {
    const contextoHoja = contextoFechaCasinoHoja(hoja, contextoCronologico);
    if (Number.isInteger(contextoHoja.mes)) contextoCronologico = contextoHoja;

    const limiteFilasCabecera = Math.min(Math.max(hoja.rowCount, 1), 15);
    let filaCabecera = 0;

    for (let fila = 1; fila <= limiteFilasCabecera; fila += 1) {
      let diasDetectados = 0;
      for (let columna = 1; columna <= hoja.columnCount; columna += 1) {
        if (resolverDiaCasino(valorCeldaCasino(hoja.getCell(fila, columna)))) diasDetectados += 1;
      }
      if (diasDetectados >= 3) {
        filaCabecera = fila;
        break;
      }
    }

    const casino = filaCabecera ? nombreCasinoDesdeHoja(hoja, filaCabecera) : String(hoja.name || '').trim();
    if (!filaCabecera) {
      advertencias.push(`${casino || hoja.name}: no se encontró una fila de días reconocible.`);
      return;
    }
    if (!casinosOrden.includes(casino)) casinosOrden.push(casino);

    let columnaArticulo = 0;
    let columnaPan = 0;
    let columnaTipo = 0;
    const columnasDia = [];

    for (let columna = 1; columna <= hoja.columnCount; columna += 1) {
      const encabezado = normalizarProducto(valorCeldaCasino(hoja.getCell(filaCabecera, columna)));
      if (encabezado === 'ARTICULO' || encabezado === 'ITEM' || encabezado === 'PRODUCTO') columnaArticulo = columna;
      if (encabezado === 'PAN') columnaPan = columna;
      if (encabezado === 'TIPO') columnaTipo = columna;
      const dia = resolverDiaCasino(encabezado);
      if (dia) columnasDia.push({ columna, encabezado: dia });
    }

    if (!columnaArticulo && !(columnaPan && columnaTipo) && columnasDia.length) {
      const primeraColumnaDia = Math.min(...columnasDia.map((item) => item.columna));
      if (primeraColumnaDia > 1) columnaArticulo = 1;
    }

    if (!columnaArticulo && !(columnaPan && columnaTipo)) {
      advertencias.push(`${casino}: no se encontró la columna de artículos.`);
      return;
    }

    const filaFechas = filaCabecera + 1;
    let anioReferencia = Number(contextoHoja.anio || new Date().getFullYear());
    let mesReferencia = Number.isInteger(contextoHoja.mes) ? contextoHoja.mes : null;

    for (const item of columnasDia) {
      const valorFecha = valorCeldaCasino(hoja.getCell(filaFechas, item.columna));
      const fecha = fechaExcelCasino(valorFecha, anioReferencia, mesReferencia);
      if (fecha && (valorFecha instanceof Date || (typeof valorFecha === 'number' && valorFecha > 20000) || /\d{4}/.test(String(valorFecha)))) {
        anioReferencia = fecha.getUTCFullYear();
        mesReferencia = fecha.getUTCMonth();
        break;
      }
    }

    const fechasColumnas = columnasDia
      .map((item) => {
        const fecha = fechaExcelCasino(valorCeldaCasino(hoja.getCell(filaFechas, item.columna)), anioReferencia, mesReferencia);
        if (!fecha) return null;
        const fechaIso = isoFechaCasino(fecha);
        if (!diasMap.has(fechaIso)) {
          diasMap.set(fechaIso, {
            fecha: fechaIso,
            dia: diaFechaCasino(fecha),
            casinos: new Set(),
            productos: new Map()
          });
        }
        return { ...item, fecha, fechaIso };
      })
      .filter(Boolean);

    if (!fechasColumnas.length) {
      advertencias.push(`${casino}: se encontraron días, pero no fechas válidas.`);
      return;
    }

    let categoriaActual = '';
    const esFormatoPanTipo = !columnaArticulo && columnaPan && columnaTipo;
    const columnaCategoria = columnaArticulo > 1 ? columnaArticulo - 1 : 0;

    for (let fila = filaFechas + 1; fila <= hoja.rowCount; fila += 1) {
      if (columnaCategoria) {
        const categoria = String(valorCeldaCasino(hoja.getCell(fila, columnaCategoria)) ?? '').replace(/\u00a0/g, ' ').trim();
        if (categoria) categoriaActual = categoria;
      }

      const pan = columnaPan ? String(valorCeldaCasino(hoja.getCell(fila, columnaPan)) ?? '').replace(/\u00a0/g, ' ').trim() : '';
      const tipo = columnaTipo ? String(valorCeldaCasino(hoja.getCell(fila, columnaTipo)) ?? '').replace(/\u00a0/g, ' ').trim() : '';
      const nombreOriginal = columnaArticulo
        ? String(valorCeldaCasino(hoja.getCell(fila, columnaArticulo)) ?? '').replace(/\u00a0/g, ' ').trim()
        : [pan, tipo].filter(Boolean).join(' ').trim();

      if (!nombreOriginal) continue;
      const claveOriginal = normalizarProducto(nombreOriginal);
      if (
        !claveOriginal ||
        claveOriginal === 'ITEM' ||
        claveOriginal.includes('TOTAL CANTIDAD') ||
        claveOriginal.includes('TOTAL SEMANAL') ||
        claveOriginal.includes('TOTAL GASTO') ||
        claveOriginal.includes('#REF')
      ) continue;

      const cantidadesFila = fechasColumnas.map(({ columna, fechaIso }) => ({
        fechaIso,
        cantidad: numeroCasino(valorCeldaCasino(hoja.getCell(fila, columna)))
      }));
      const tieneCantidad = cantidadesFila.some((item) => item.cantidad > 0);
      if (!tieneCantidad) {
        if (/\b(BOCADITOS?|DULCES?|SALADOS?|PANES?|SANDWICH|SANGUCHE|TRIPLES?|PIQUEOS?|KEKES?|TORTAS?)\b/.test(claveOriginal)) {
          categoriaActual = nombreOriginal;
        }
        continue;
      }

      const nombreProducto = resolverNombreCasino(nombreOriginal, pan, tipo);
      const grupo = grupoProductoCasino(nombreProducto, categoriaActual, esFormatoPanTipo);
      const reconocido = resolverVariantePetipanCasino([pan, tipo].filter(Boolean).join(' '))
        || resolverVariantePetipanCasino(nombreOriginal)
        || resolverNombreCocina(nombreOriginal)
        || CASINO_ALIAS_EXACTOS[normalizarProducto(nombreOriginal)]
        || CASINO_ALIAS_EXACTOS[normalizarProducto([pan, tipo].filter(Boolean).join(' '))];
      if (!reconocido && nombreProducto === nombreOriginal) productosNoReconocidos.add(nombreOriginal);

      cantidadesFila.forEach(({ fechaIso, cantidad }) => {
        if (!(cantidad > 0)) return;

        const dia = diasMap.get(fechaIso);
        dia.casinos.add(casino);

        const claveProducto = normalizarProducto(nombreProducto) || nombreProducto;
        if (!dia.productos.has(claveProducto)) {
          dia.productos.set(claveProducto, {
            nombre: nombreProducto,
            grupo,
            por_casino: {},
            total: 0
          });
        }

        const producto = dia.productos.get(claveProducto);
        producto.por_casino[casino] = Number(producto.por_casino[casino] || 0) + cantidad;
        producto.total += cantidad;
        if (producto.grupo !== 'extra' && grupo === 'extra') producto.grupo = 'extra';
      });
    }
  });

  const ordenPrincipal = new Map(PRODUCTOS_COCINA.map((nombre, indice) => [normalizarProducto(nombre), indice]));
  const ordenExtra = new Map(PRODUCTOS_COCINA_EXTRA.map((nombre, indice) => [normalizarProducto(nombre), indice]));

  const ordenarProductosCasino = (a, b) => {
    if (a.grupo !== b.grupo) return a.grupo === 'principal' ? -1 : 1;
    const mapa = a.grupo === 'extra' ? ordenExtra : ordenPrincipal;
    const ai = mapa.has(normalizarProducto(a.nombre)) ? mapa.get(normalizarProducto(a.nombre)) : 9999;
    const bi = mapa.has(normalizarProducto(b.nombre)) ? mapa.get(normalizarProducto(b.nombre)) : 9999;
    if (ai !== bi) return ai - bi;
    return String(a.nombre).localeCompare(String(b.nombre), 'es');
  };

  const dias = [...diasMap.values()]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((dia) => ({
      fecha: dia.fecha,
      dia: dia.dia,
      casinos: casinosOrden.filter((casino) => dia.casinos.has(casino)),
      productos: [...dia.productos.values()]
        .filter((producto) => Number(producto.total || 0) > 0)
        .sort(ordenarProductosCasino)
    }));

  return {
    casinos: casinosOrden,
    dias,
    advertencias,
    productos_no_reconocidos: [...productosNoReconocidos].sort((a, b) => a.localeCompare(b, 'es'))
  };
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(['/admin', '/admin.html', '/api/admin', '/colaboradores', '/colaboradores.html', '/api/colaboradores'], adminSecurityHeaders);
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

// Seguridad de administradores y colaboradores
app.post('/api/admin/auth/login', async (req, res) => {
  try {
    return await authenticateUser(req, res, ['admin'], ADMIN_COOKIE, 'admin');
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

app.get('/api/admin/auth/session', requireAdminAuth, (req, res) => {
  return res.json({
    authenticated: true,
    usuario: req.authUser.usuario,
    nombre: req.authUser.nombre,
    rol: req.authUser.rol
  });
});

app.post('/api/admin/auth/logout', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!sameOriginRequest(req)) return res.status(403).json({ error: 'Origen no autorizado.' });
  clearSessionCookie(req, res, ADMIN_COOKIE);
  return res.json({ ok: true });
});

app.post('/api/colaboradores/auth/login', async (req, res) => {
  try {
    return await authenticateUser(req, res, ['colaborador', 'admin'], COLLAB_COOKIE, 'colaborador');
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

app.get('/api/colaboradores/auth/session', async (req, res) => {
  try {
    const user = await resolveSessionUser(req, COLLAB_COOKIE, ['colaborador', 'admin']);
    if (!user) return res.status(401).json({ authenticated: false });
    return res.json({ authenticated: true, usuario: user.usuario, nombre: user.nombre, rol: user.rol });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo validar la sesión.' });
  }
});

app.post('/api/colaboradores/auth/logout', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!sameOriginRequest(req)) return res.status(403).json({ error: 'Origen no autorizado.' });
  clearSessionCookie(req, res, COLLAB_COOKIE);
  return res.json({ ok: true });
});

app.get('/api/admin/usuarios', requireAdminAuth, async (req, res) => {
  try {
    const usuarios = await dbAllAsync(`
      SELECT id, usuario, nombre, rol, activo, ultimo_login, creado_en, actualizado_en
      FROM usuarios
      ORDER BY CASE WHEN rol = 'admin' THEN 0 ELSE 1 END, nombre ASC, usuario ASC
    `);
    return res.json({ usuarios });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudieron cargar los usuarios.' });
  }
});

app.post('/api/admin/usuarios', requireAdminAuth, async (req, res) => {
  try {
    const usuario = String(req.body?.usuario || '').trim();
    const nombre = String(req.body?.nombre || '').trim();
    const password = String(req.body?.password || '');
    const rol = String(req.body?.rol || '').trim().toLowerCase();

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(usuario)) {
      return res.status(400).json({ error: 'El usuario debe tener entre 3 y 40 caracteres y solo usar letras, números, punto, guion o guion bajo.' });
    }
    if (nombre.length < 2 || nombre.length > 80) return res.status(400).json({ error: 'Ingresa un nombre válido.' });
    if (!['admin', 'colaborador'].includes(rol)) return res.status(400).json({ error: 'Rol no válido.' });
    if (password.length < 10) return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres.' });

    const existing = await dbGetAsync(`SELECT id FROM usuarios WHERE LOWER(usuario) = LOWER(?) LIMIT 1`, [usuario]);
    if (existing) return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await dbRunAsync(
      `INSERT INTO usuarios (usuario, nombre, password_hash, rol, activo, actualizado_en)
       VALUES (?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)`,
      [usuario, nombre, passwordHash, rol]
    );
    return res.status(201).json({ ok: true, id: result.lastID });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

app.put('/api/admin/usuarios/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Usuario no válido.' });

    const target = await dbGetAsync(`SELECT id, usuario, nombre, rol, activo FROM usuarios WHERE id = ? LIMIT 1`, [id]);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const nombre = String(req.body?.nombre ?? target.nombre).trim();
    const rol = String(req.body?.rol ?? target.rol).trim().toLowerCase();
    const activo = req.body?.activo === undefined ? Boolean(target.activo) : Boolean(req.body.activo);
    const password = String(req.body?.password || '');

    if (nombre.length < 2 || nombre.length > 80) return res.status(400).json({ error: 'Ingresa un nombre válido.' });
    if (!['admin', 'colaborador'].includes(rol)) return res.status(400).json({ error: 'Rol no válido.' });
    if (password && password.length < 10) return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres.' });

    if (Number(req.authUser.id) === id && (rol !== 'admin' || !activo)) {
      return res.status(400).json({ error: 'No puedes quitarte tus propios permisos de administrador ni desactivar tu cuenta.' });
    }

    if (target.rol === 'admin' && target.activo && (rol !== 'admin' || !activo)) {
      const admins = await dbGetAsync(`SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'admin' AND activo = TRUE`);
      if (Number(admins?.total || 0) <= 1) {
        return res.status(400).json({ error: 'Debe existir al menos un administrador activo.' });
      }
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      await dbRunAsync(
        `UPDATE usuarios SET nombre = ?, rol = ?, activo = ?, password_hash = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
        [nombre, rol, activo, passwordHash, id]
      );
    } else {
      await dbRunAsync(
        `UPDATE usuarios SET nombre = ?, rol = ?, activo = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
        [nombre, rol, activo, id]
      );
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
  }
});

app.get('/api/admin/casinos/cronograma', requireAdminAuth, async (req, res) => {
  try {
    const rows = await dbAllAsync(`
      SELECT id, nombre_archivo, fecha_inicio, fecha_fin, datos_json, creado_en
      FROM casino_cronogramas
      ORDER BY id DESC
    `);

    // Compatibilidad: cronogramas importados antes de esta versión se convierten
    // una sola vez en pedidos Casino persistentes.
    for (const row of rows) {
      const existente = await dbGetAsync(`SELECT 1 AS existe FROM pedidos WHERE origen = 'casino' AND cronograma_casino_id = ? LIMIT 1`, [row.id]);
      if (existente) continue;
      let datos;
      try { datos = JSON.parse(row.datos_json); } catch { continue; }
      await sincronizarPedidosCasinoCronograma(row.id, datos);
    }

    const cronogramaPedidos = await construirCronogramaCasinoDesdePedidos();
    const cronograma = cronogramaPedidos || unirCronogramasCasino(rows);
    return res.json({
      existe: Boolean(cronograma),
      cronograma,
      importaciones: rows.map(({ datos_json, ...meta }) => meta)
    });
  } catch (error) {
    console.error('Error cargando cronograma persistente:', error);
    return res.status(500).json({ error: 'No se pudo cargar el cronograma de casinos.' });
  }
});

app.post('/api/admin/casinos/procesar-excel', requireAdminAuth, async (req, res) => {
  let transaccion = false;
  try {
    const archivoBase64 = String(req.body?.archivo_base64 || '').trim();
    const nombreArchivo = String(req.body?.nombre_archivo || '').trim();

    if (!archivoBase64) return res.status(400).json({ error: 'Selecciona un archivo Excel.' });
    if (nombreArchivo && !/\.xlsx$/i.test(nombreArchivo)) {
      return res.status(400).json({ error: 'El cronograma debe estar en formato .xlsx.' });
    }

    const base64Limpio = archivoBase64.includes(',') ? archivoBase64.split(',').pop() : archivoBase64;
    const buffer = Buffer.from(base64Limpio, 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'El archivo Excel está vacío o no es válido.' });
    if (buffer.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'El archivo supera el límite de 6 MB.' });

    const resultado = await procesarCronogramaCasinos(buffer);
    if (!resultado.dias.length) return res.status(400).json({ error: 'No se encontraron días válidos en el cronograma.' });

    // La identidad se basa en el contenido interpretado, no en los bytes del XLSX.
    // Así el mismo cronograma reexportado por Excel no duplica pedidos.
    const huella = huellaCronogramaCasino(resultado);
    const importacionesExistentes = await dbAllAsync(`
      SELECT id, huella, nombre_archivo, fecha_inicio, fecha_fin, datos_json
      FROM casino_cronogramas
      ORDER BY id DESC
    `);
    let existente = importacionesExistentes.find((row) => row.huella === huella) || null;
    if (!existente) {
      existente = importacionesExistentes.find((row) => {
        try { return huellaCronogramaCasino(JSON.parse(row.datos_json)) === huella; }
        catch { return false; }
      }) || null;
    }
    if (existente) {
      return res.status(409).json({
        error: 'Este cronograma ya fue importado anteriormente.',
        cronograma_existente: {
          id: existente.id,
          nombre_archivo: existente.nombre_archivo,
          fecha_inicio: existente.fecha_inicio,
          fecha_fin: existente.fecha_fin
        }
      });
    }

    const fechaInicio = resultado.dias[0]?.fecha || '';
    const fechaFin = resultado.dias.at(-1)?.fecha || fechaInicio;
    await dbRunAsync('BEGIN TRANSACTION');
    transaccion = true;

    const cronograma = await dbRunAsync(
      `INSERT INTO casino_cronogramas (huella, nombre_archivo, fecha_inicio, fecha_fin, datos_json)
       VALUES (?, ?, ?, ?, ?)`,
      [huella, nombreArchivo || 'Cronograma.xlsx', fechaInicio, fechaFin, JSON.stringify(resultado)]
    );

    const pedidosCreados = await sincronizarPedidosCasinoCronograma(cronograma.lastID, resultado);

    await dbRunAsync('COMMIT');
    transaccion = false;

    return res.json({
      ok: true,
      nombre_archivo: nombreArchivo || 'Cronograma.xlsx',
      cronograma_id: cronograma.lastID,
      pedidos_casino_creados: pedidosCreados,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      ...resultado
    });
  } catch (error) {
    if (transaccion) await dbRunAsync('ROLLBACK').catch(() => {});
    console.error('Error procesando cronograma de casinos:', error);
    return res.status(400).json({ error: 'No se pudo importar el Excel. Verifica que conserve el formato del cronograma de casinos.' });
  }
});

// Ruta principal para servir la interfaz web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/colaboradores', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'colaboradores.html'));
});

app.get('/colaboradores.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'colaboradores.html'));
});

// Endpoint: Obtener Catálogo de Productos
app.get('/api/productos', (req, res) => {
  db.all(`SELECT id, nombre, categoria, precio, precio_x25, precio_x50, precio_x100, precio_unidad FROM productos ORDER BY categoria ASC, nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

function buildMacrodroidEventFromPayload(payload = {}) {
  return {
    event: 'dchelis_pedido',
    codigo: payload.codigo || 'PEDIDO',
    tipo: payload.tipo || 'explode',
    ttlSeconds: Number(payload.ttlSeconds || payload.ttl || 600),
    nombre: payload.nombre || '',
    apellido: payload.apellido || '',
    telefono: payload.telefono || '',
    monto: payload.monto || payload.monto_total || 0,
    createdAt: new Date().toISOString()
  };
}

async function emitMacrodroid(req, res) {
  const payload = req.body && Object.keys(req.body).length ? req.body : req.query || {};
  const url = process.env.MACRODROID_URL;
  const event = buildMacrodroidEventFromPayload(payload);

  if (!url) {
    return res.json({
      ok: true,
      dryRun: true,
      mode: 'macrodroid-disabled',
      event,
      signal: event.tipo,
      code: event.codigo,
      ttlSeconds: event.ttlSeconds,
      waitingForPayment: true
    });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

    const text = await response.text().catch(() => '');
    return res.json({ ok: response.ok, status: response.status, code: event.codigo, macrodroid: text || 'ok', signal: event.tipo, mode: 'macrodroid-live', waitingForPayment: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Macrodroid no respondió', detail: error.message });
  }
}

app.get('/api/macrodroid/emit', emitMacrodroid);
app.post('/api/macrodroid/emit', emitMacrodroid);

app.get('/api/macrodroid/callback', (req, res) => {
  const payload = req.query || {};
  const codigo = String(payload.codigo || payload.pedido || '').trim();
  const nroOperacion = String(payload.nro_operacion || payload.numero_operacion || payload.op || '').trim();
  const monto = Number(payload.monto || payload.monto_total || 0);

  if (!codigo) {
    return res.status(400).json({ ok: false, error: 'Falta codigo de pedido en la señal de Macrodroid.' });
  }

  db.run(`UPDATE pedidos SET estado = 'Registrado', registrado_en = CURRENT_TIMESTAMP, nro_operacion = COALESCE(NULLIF(?, ''), nro_operacion) WHERE codigo = ? AND estado IN ('Pendiente de verificación de pago', 'Registrado')`, [nroOperacion || '', codigo], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Pedido no encontrado o ya no está pendiente.' });
    return res.json({ ok: true, codigo, estado: 'Registrado', monto, mode: 'macrodroid-callback' });
  });
});

app.post('/api/macrodroid/callback', (req, res) => {
  const payload = req.body || {};
  const codigo = String(payload.codigo || payload.pedido || '').trim();
  const nroOperacion = String(payload.nro_operacion || payload.numero_operacion || payload.op || '').trim();
  const monto = Number(payload.monto || payload.monto_total || 0);

  if (!codigo) {
    return res.status(400).json({ ok: false, error: 'Falta codigo de pedido en la señal de Macrodroid.' });
  }

  db.run(`UPDATE pedidos SET estado = 'Registrado', registrado_en = CURRENT_TIMESTAMP, nro_operacion = COALESCE(NULLIF(?, ''), nro_operacion) WHERE codigo = ? AND estado IN ('Pendiente de verificación de pago', 'Registrado')`, [nroOperacion || '', codigo], function (err) {
    if (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Pedido no encontrado o ya no está pendiente.' });
    }

    return res.json({ ok: true, codigo, estado: 'Registrado', monto, mode: 'macrodroid-callback' });
  });
});

app.get('/api/pedidos/estado/:codigo', (req, res) => {
  const codigo = req.params.codigo;
  if (!codigo) {
    return res.status(400).json({ ok: false, error: 'Falta el codigo del pedido.' });
  }

  db.get(`SELECT codigo, estado, metodo_pago, monto_total, adelanto FROM pedidos WHERE codigo = ?`, [codigo], (err, row) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!row) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });
    const estado = normalizarEstadoPedido(row.estado);
    return res.json({ ok: true, codigo: row.codigo, estado, metodo_pago: row.metodo_pago, monto_total: row.monto_total, adelanto: row.adelanto });
  });
});

// Endpoint para registrar un nuevo pedido y asegurar su visualización en producción
app.post('/api/pedidos', protectDigitacionOrigin, async (req, res) => {
  const { tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, dedicatoria, foto_torta, tipo_comprobante, numero_documento, origen, detalles } = req.body;

  if (String(origen || '').toLowerCase() === 'casino') {
    return res.status(400).json({ error: 'Los pedidos de casino se cargan desde el cronograma de Casinos.' });
  }

  if (!validarComprobante(tipo_comprobante, numero_documento)) {
    return res.status(400).json({ error: 'La boleta requiere DNI de 8 dígitos y la factura requiere RUC de 11 dígitos.' });
  }

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: 'El pedido debe incluir al menos un detalle.' });
  }

  if (!req.body?.confirmar_duplicado && String(origen || '').toLowerCase() !== 'casino') {
    try {
      const duplicado = await buscarPedidoDuplicado({ celular, fecha_recoge, hora_recoge, detalles });
      if (duplicado) {
        return res.status(409).json({
          error: `Posible pedido duplicado (${duplicado.tipo_coincidencia}). Confirma antes de registrarlo nuevamente.`,
          duplicado: true,
          coincidencia: duplicado
        });
      }
    } catch (error) {
      console.warn('No se pudo verificar duplicados:', error.message);
    }
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const pagoPendiente = String(metodo_pago || '').includes('verificación pendiente');
    // Digitación es un registro interno válido aunque el adelanto sea 0.
    // El saldo se representa con los montos, no ocultando el pedido como "Pendiente de pago".
    const estadoInicial = pagoPendiente ? 'Pendiente de verificación de pago' : 'Registrado';
    const origenPedido = String(origen || '').trim().toLowerCase() === 'digitacion' ? 'digitacion' : 'web';
    const queryPedido = `INSERT INTO pedidos (codigo, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, dedicatoria, foto_torta, tipo_comprobante, numero_documento, nro_operacion, estado, fecha_emision, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;

    const fechaCodigo = String(fecha_recoge || '').replace(/-/g, '');
    const sufijoUnico = crypto.randomBytes(4).toString('hex').toUpperCase();
    const codigoPedido = `PED-${fechaCodigo}-${sufijoUnico}`;
    db.run(queryPedido, [codigoPedido, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, String(dedicatoria || '').trim(), String(foto_torta || ''), String(tipo_comprobante || '').trim(), String(numero_documento || '').trim(), '', estadoInicial, origenPedido], function (err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      const pedidoId = this.lastID;
      const queryDetalle = `INSERT INTO detalles_pedido (pedido_id, producto_nombre, cantidad, subtotal, paquetes, foto_torta) VALUES (?, ?, ?, ?, ?, ?)`;
      const stmt = db.prepare(queryDetalle);
      detalles.forEach((det) => {
        const paquetes = det.paquetes && typeof det.paquetes === 'object' ? JSON.stringify(det.paquetes) : '{}';
        stmt.run(pedidoId, det.producto_nombre, det.cantidad, det.subtotal, paquetes, String(det.foto_torta || ''));
      });

      stmt.finalize(async (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        db.run('COMMIT', async (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const url = process.env.MACRODROID_URL;
          if (url) {
            try {
              const [nombre, ...restApellido] = String(cliente_nombre || '').trim().split(/\s+/);
              const apellido = restApellido.join(' ');
              await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'dchelis_pedido',
                  codigo: codigoPedido,
                  tipo: 'explode',
                  ttlSeconds: 600,
                  nombre,
                  apellido,
                  telefono: celular,
                  monto: Number(monto_total || adelanto || 0)
                })
              });
            } catch (e) {
              console.warn('Macrodroid signal ignored:', e.message);
            }
          }

          return res.status(201).json({ message: 'Pedido registrado con éxito', id: pedidoId, codigo: codigoPedido });
        });
      });
    });
  });
});

app.post('/api/pedidos/:codigo/cancelar', (req, res) => {
  const codigo = String(req.params.codigo || '').trim();
  if (!codigo) return res.status(400).json({ ok: false, error: 'Código de pedido requerido.' });

  db.run(`UPDATE pedidos SET estado = 'Cancelado' WHERE codigo = ? AND estado = 'Pendiente de verificación de pago'`, [codigo], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Pedido no encontrado o ya confirmado.' });
    return res.json({ ok: true, codigo, estado: 'Cancelado' });
  });
});

function eliminarPedidosSinPago() {
  db.serialize(() => {
    db.run(`DELETE FROM detalles_pedido WHERE pedido_id IN (
      SELECT id FROM pedidos
      WHERE estado = 'Pendiente de verificación de pago'
        AND datetime(fecha_registro) <= datetime('now', '-5 minutes')
    )`);
    db.run(`DELETE FROM pedidos
      WHERE estado = 'Pendiente de verificación de pago'
        AND datetime(fecha_registro) <= datetime('now', '-5 minutes')`, (err) => {
      if (err) console.error('No se pudieron limpiar pedidos sin pago:', err.message);
    });
  });
}

eliminarPedidosSinPago();
setInterval(eliminarPedidosSinPago, 60 * 1000);

function eliminarPedidosRegistradosAntiguos() {
  db.serialize(() => {
    db.run(`DELETE FROM detalles_pedido WHERE pedido_id IN (
      SELECT id FROM pedidos
      WHERE COALESCE(estado, 'Registrado') IN ('Pendiente de pago', 'Despachado (D''chelis)')
        AND COALESCE(registrado_en, fecha_registro) < (CURRENT_TIMESTAMP - INTERVAL '1 year')
    )`);
    db.run(`DELETE FROM pedidos
      WHERE COALESCE(estado, 'Registrado') IN ('Pendiente de pago', 'Despachado (D''chelis)')
        AND COALESCE(registrado_en, fecha_registro) < (CURRENT_TIMESTAMP - INTERVAL '1 year')`, (err) => {
      if (err) console.error('No se pudieron limpiar pedidos antiguos del historial:', err.message);
    });
  });
}

eliminarPedidosRegistradosAntiguos();
setInterval(eliminarPedidosRegistradosAntiguos, 60 * 60 * 1000);

// Endpoint exclusivo de Casinos: evita mezclar o descargar pedidos Casino en Pedidos Generales.
app.get('/api/admin/casinos/pedidos', requireAdminAuth, async (req, res) => {
  try {
    const desde = String(req.query.desde || '').trim();
    const hasta = String(req.query.hasta || '').trim();
    const casino = String(req.query.casino || '').trim();

    if (!desde || !hasta || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || desde > hasta) {
      return res.status(400).json({ error: 'Rango de fechas inválido.' });
    }
    if (!casino) return res.status(400).json({ error: 'Casino requerido.' });

    const pedidos = await dbAllAsync(`
      SELECT id, codigo, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago,
             fecha_recoge, hora_recoge, dedicatoria, foto_torta, tipo_comprobante, numero_documento,
             estado, fecha_registro, fecha_emision, origen, cronograma_casino_id,
             casino_nombre, casino_semana, registrado_en, despachado_por
      FROM pedidos
      WHERE origen = 'casino'
        AND fecha_recoge >= ?
        AND fecha_recoge <= ?
        AND LOWER(TRIM(COALESCE(NULLIF(casino_nombre, ''), cliente_nombre))) = LOWER(TRIM(?))
        AND COALESCE(estado, 'Registrado') <> 'Cancelado'
      ORDER BY fecha_recoge ASC, hora_recoge ASC, id ASC
    `, [desde, hasta, casino]);

    if (!pedidos.length) return res.json({ pedidos: [] });

    const ids = pedidos.map((pedido) => Number(pedido.id));
    const placeholders = ids.map(() => '?').join(',');
    const detalles = await dbAllAsync(`
      SELECT pedido_id, producto_nombre, cantidad, subtotal, paquetes, foto_torta
      FROM detalles_pedido
      WHERE pedido_id IN (${placeholders})
      ORDER BY pedido_id ASC, id ASC
    `, ids);

    const porId = new Map(pedidos.map((pedido) => [Number(pedido.id), {
      ...pedido,
      estado: normalizarEstadoPedido(pedido.estado),
      detalles: []
    }]));

    for (const detalle of detalles || []) {
      const pedido = porId.get(Number(detalle.pedido_id));
      if (!pedido) continue;
      pedido.detalles.push({
        producto_nombre: detalle.producto_nombre,
        cantidad: detalle.cantidad,
        subtotal: detalle.subtotal,
        paquetes: detalle.paquetes ? JSON.parse(detalle.paquetes) : {},
        foto_torta: detalle.foto_torta || ''
      });
    }

    return res.json({ pedidos: [...porId.values()] });
  } catch (error) {
    console.error('Error cargando pedidos de Casino:', error);
    return res.status(500).json({ error: 'No se pudieron cargar los pedidos del casino.' });
  }
});

// Endpoint: Obtener Pedidos Generales
app.get('/api/admin/pedidos', requireAdminAuth, (req, res) => {
  const resumen = req.query.resumen === '1';
  const desde = req.query.desde;
  const hasta = req.query.hasta;
  if ((desde && !hasta) || (!desde && hasta) ||
      (desde && (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || desde > hasta))) {
    return res.status(400).json({ error: 'Rango de fechas inválido.' });
  }
  const rango = desde && hasta ? ' AND fecha_recoge >= ? AND fecha_recoge <= ?' : '';
  const parametros = rango ? [desde, hasta] : [];
  db.all(`
        SELECT id, codigo, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago,
          fecha_recoge, hora_recoge, dedicatoria, ${resumen ? "CASE WHEN COALESCE(foto_torta, '') <> '' THEN 1 ELSE 0 END AS tiene_foto_torta" : 'foto_torta'}, tipo_comprobante, numero_documento, estado, fecha_registro, fecha_emision, origen, cronograma_casino_id, casino_nombre, casino_semana, registrado_en, despachado_por
    FROM pedidos
    WHERE COALESCE(origen, 'pg') <> 'casino'
      AND COALESCE(estado, 'Registrado') NOT IN ('Pendiente de pago', 'Despachado (D''chelis)')${rango}
    ORDER BY fecha_recoge ASC, hora_recoge ASC, id ASC
  `, parametros, (err, pedidos) => {
    if (err) return res.status(500).json({ error: err.message });

    const responder = (hayMas) => {
      const pedidosFinales = pedidos.map((pedido) => ({
        ...pedido,
        estado: normalizarEstadoPedido(pedido.estado),
        detalles: []
      }));
      if (!pedidosFinales.length) return res.json({ pedidos: [], hayMas });

      const pedidosPorId = new Map(pedidosFinales.map((pedido) => [pedido.id, pedido]));
      const placeholders = pedidosFinales.map(() => '?').join(', ');
      db.all(`
        SELECT pedido_id, producto_nombre, cantidad, subtotal, paquetes, ${resumen ? "CASE WHEN COALESCE(foto_torta, '') <> '' THEN 1 ELSE 0 END AS tiene_foto_torta" : 'foto_torta'}
        FROM detalles_pedido
        WHERE pedido_id IN (${placeholders})
        ORDER BY pedido_id ASC, id ASC
      `, pedidosFinales.map((pedido) => pedido.id), (errDetalle, detalles) => {
        if (errDetalle) return res.status(500).json({ error: errDetalle.message });
        for (const { pedido_id, ...item } of detalles || []) {
          pedidosPorId.get(pedido_id).detalles.push({
            ...item,
            paquetes: item.paquetes ? JSON.parse(item.paquetes) : {}
          });
        }
        res.json({ pedidos: pedidosFinales, hayMas });
      });
    };

    if (!rango) return responder(false);
    db.get(`SELECT 1 AS existe FROM pedidos
      WHERE COALESCE(origen, 'pg') <> 'casino'
        AND COALESCE(estado, 'Registrado') NOT IN ('Pendiente de pago', 'Despachado (D''chelis)')
        AND fecha_recoge > ? LIMIT 1`, [hasta], (errorMas, siguiente) => {
      if (errorMas) return res.status(500).json({ error: errorMas.message });
      responder(Boolean(siguiente));
    });
  });
});

// Endpoint: Obtener Historial de Pedidos
app.get('/api/admin/historial-pedidos', requireAdminAuth, (req, res) => {
  const resumen = req.query.resumen === '1';
  const limite = 50;
  const offset = Number(req.query.offset || 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) {
    return res.status(400).json({ error: 'Posición inválida.' });
  }
  const buscar = String(req.query.buscar || '').trim().slice(0, 100)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const condicionBusqueda = buscar ? `
      AND translate(lower(cliente_nombre), 'áéíóúüñ', 'aeiouun') LIKE ?` : '';
  const parametros = buscar ? [`%${buscar}%`, limite + 1, offset] : [limite + 1, offset];
  db.all(`
    SELECT id, codigo, tipo_cliente, cliente_nombre, celular, monto_total, adelanto, metodo_pago,
      fecha_recoge, hora_recoge, dedicatoria, ${resumen ? "CASE WHEN COALESCE(foto_torta, '') <> '' THEN 1 ELSE 0 END AS tiene_foto_torta" : 'foto_torta'}, tipo_comprobante, numero_documento, estado, fecha_registro, fecha_emision, origen, cronograma_casino_id, casino_nombre, casino_semana, registrado_en, despachado_por
    FROM pedidos
    WHERE COALESCE(origen, 'pg') <> 'casino'
      AND COALESCE(estado, 'Registrado') IN ('Pendiente de pago', 'Despachado (D''chelis)')
      AND COALESCE(registrado_en, fecha_registro) >= (CURRENT_TIMESTAMP - INTERVAL '1 year')
      ${condicionBusqueda}
    ORDER BY fecha_recoge DESC, hora_recoge DESC, id DESC
    LIMIT ? OFFSET ?
  `, parametros, (err, pedidos) => {
    if (err) return res.status(500).json({ error: err.message });
    const hayMas = pedidos.length > limite;
    const pedidosFinales = pedidos.slice(0, limite).map((pedido) => ({
      ...pedido,
      estado: normalizarEstadoPedido(pedido.estado),
      detalles: []
    }));
    if (!pedidosFinales.length) return res.json({ pedidos: [], hayMas });

    const pedidosPorId = new Map(pedidosFinales.map((pedido) => [pedido.id, pedido]));
    const placeholders = pedidosFinales.map(() => '?').join(', ');
      db.all(`
        SELECT pedido_id, producto_nombre, cantidad, subtotal, paquetes, ${resumen ? "CASE WHEN COALESCE(foto_torta, '') <> '' THEN 1 ELSE 0 END AS tiene_foto_torta" : 'foto_torta'}
        FROM detalles_pedido
        WHERE pedido_id IN (${placeholders})
        ORDER BY pedido_id ASC, id ASC
      `, pedidosFinales.map((pedido) => pedido.id), (errDetalle, detalles) => {
        if (errDetalle) return res.status(500).json({ error: errDetalle.message });
        for (const { pedido_id, ...item } of detalles || []) {
          pedidosPorId.get(pedido_id).detalles.push({
            ...item,
            paquetes: item.paquetes ? JSON.parse(item.paquetes) : {}
          });
        }
        res.json({ pedidos: pedidosFinales, hayMas });
      });
  });
});

app.get('/api/admin/pedidos/:id/fotos', requireAdminAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Pedido inválido.' });
  db.get('SELECT foto_torta FROM pedidos WHERE id = ?', [id], (error, pedido) => {
    if (error) return res.status(500).json({ error: error.message });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
    db.all('SELECT foto_torta FROM detalles_pedido WHERE pedido_id = ? ORDER BY id ASC', [id], (errorDetalles, detalles) => {
      if (errorDetalles) return res.status(500).json({ error: errorDetalles.message });
      res.json({ foto_torta: pedido.foto_torta || '', fotos_detalles: detalles.map((item) => item.foto_torta || '') });
    });
  });
});

// Vista de solo lectura para el personal de despacho. No expone acciones de
// edición, eliminación, teléfonos ni importes de los clientes.
app.get('/api/colaboradores/salidas', requireStaffAuth, (req, res) => {
  const fecha = String(req.query.fecha || new Date().toISOString().slice(0, 10)).trim();
  db.all(`
    SELECT p.id, p.codigo, p.cliente_nombre, p.origen, p.fecha_recoge, p.hora_recoge, p.estado,
           d.producto_nombre, d.cantidad, d.paquetes
    FROM pedidos p
    LEFT JOIN detalles_pedido d ON d.pedido_id = p.id
    WHERE p.fecha_recoge = ?
      AND COALESCE(p.estado, 'Registrado') NOT IN ('Pendiente de verificación de pago', 'Pendiente de pago', 'Despachado (D''chelis)')
    ORDER BY p.hora_recoge ASC, p.id ASC, d.id ASC
  `, [fecha], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const pedidos = new Map();
    (rows || []).forEach((row) => {
      if (!pedidos.has(row.id)) {
        pedidos.set(row.id, {
          id: row.id, codigo: row.codigo, cliente_nombre: row.cliente_nombre, origen: row.origen || 'pg',
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

app.get('/api/admin/inventario', requireAdminAuth, (req, res) => {
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

app.post('/api/admin/inventario/calcular', requireAdminAuth, (req, res) => {
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

app.get('/api/admin/inventario/compra-dia', requireAdminAuth, (req, res) => {
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

app.get('/api/admin/inventario/compra-dia/excel', requireAdminAuth, (req, res) => {
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

app.post('/api/admin/inventario/stock', requireAdminAuth, (req, res) => {
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

app.put('/api/admin/pedidos/:id/estado', requireStaffAuth, (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado) return res.status(400).json({ error: 'Estado requerido' });

  const estadoNormalizado = String(estado).trim();
  if (req.authUser?.rol === 'colaborador' && !['Listo para despacho', "Despachado (D'chelis)"].includes(estadoNormalizado)) {
    return res.status(403).json({ error: 'El colaborador no tiene permiso para asignar ese estado.' });
  }

  const colaborador = estadoNormalizado === "Despachado (D'chelis)"
    ? String(req.authUser?.nombre || req.authUser?.usuario || '').trim()
    : '';
  db.run(`UPDATE pedidos
    SET estado = ?,
        registrado_en = CASE WHEN ? IN ('Pendiente de pago', 'Despachado (D''chelis)') THEN CURRENT_TIMESTAMP ELSE NULL END,
        despachado_por = CASE WHEN ? = 'Despachado (D''chelis)' THEN ? ELSE '' END
    WHERE id = ?`, [estadoNormalizado, estadoNormalizado, estadoNormalizado, colaborador, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ success: true, id: Number(id), estado });
  });
});

app.put('/api/admin/pedidos/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const pedido = req.body || {};
  const clienteNombre = String(pedido.cliente_nombre || '').trim();
  const celular = String(pedido.celular || '').trim();
  const fechaRecoge = String(pedido.fecha_recoge || '').trim();
  const horaRecoge = String(pedido.hora_recoge || '').trim();
  const metodoPago = String(pedido.metodo_pago || 'Efectivo').trim();
  const tipoComprobante = String(pedido.tipo_comprobante || '').trim();
  const numeroDocumento = String(pedido.numero_documento || '').trim();
  const dedicatoria = String(pedido.dedicatoria || '').trim();
  const fotoTorta = String(pedido.foto_torta || '').trim();
  const fechaEmision = String(pedido.fecha_emision || '').trim();
  const detalles = Array.isArray(pedido.detalles) ? pedido.detalles : [];

  if (!validarComprobante(tipoComprobante, numeroDocumento)) {
    return res.status(400).json({ error: 'La boleta requiere DNI de 8 dígitos y la factura requiere RUC de 11 dígitos.' });
  }

  if (!clienteNombre || !celular || !fechaRecoge || !horaRecoge) {
    return res.status(400).json({ error: 'Faltan datos obligatorios del pedido.' });
  }

  if (!detalles.length) {
    return res.status(400).json({ error: 'El pedido debe tener al menos un item.' });
  }

  const montoTotal = Number(
    pedido.monto_total !== undefined && pedido.monto_total !== null
      ? pedido.monto_total
      : detalles.reduce((suma, item) => suma + Number(item.subtotal || 0), 0)
  );
  const adelanto = Number(pedido.adelanto || 0);

  if (!Number.isFinite(montoTotal) || montoTotal < 0) {
    return res.status(400).json({ error: 'El monto total no es válido.' });
  }

  if (adelanto > montoTotal) {
    return res.status(400).json({ error: 'El monto pagado no puede ser mayor que el total del pedido.' });
  }

  if (!pedido.confirmar_duplicado) {
    try {
      const duplicado = await buscarPedidoDuplicado({
        celular,
        fecha_recoge: fechaRecoge,
        hora_recoge: horaRecoge,
        detalles,
        excluir_id: id
      });
      if (duplicado) {
        return res.status(409).json({
          error: `Posible pedido duplicado (${duplicado.tipo_coincidencia}). Confirma antes de guardar.`,
          duplicado: true,
          coincidencia: duplicado
        });
      }
    } catch (error) {
      console.warn('No se pudo verificar duplicados al editar:', error.message);
    }
  }

  db.run('BEGIN TRANSACTION');

  db.run(`UPDATE pedidos SET
    cliente_nombre = ?,
    celular = ?,
    monto_total = ?,
    adelanto = ?,
    metodo_pago = ?,
    tipo_comprobante = ?,
    numero_documento = ?,
    fecha_recoge = ?,
    hora_recoge = ?,
    dedicatoria = ?,
    foto_torta = ?,
    fecha_emision = COALESCE(NULLIF(?, ''), fecha_emision, CURRENT_TIMESTAMP)
    WHERE id = ?`, [clienteNombre, celular, montoTotal, adelanto, metodoPago, tipoComprobante, numeroDocumento, fechaRecoge, horaRecoge, dedicatoria, fotoTorta, fechaEmision, id], function (err) {
    if (err) {
      db.run('ROLLBACK');
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      db.run('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    db.run(`DELETE FROM detalles_pedido WHERE pedido_id = ?`, [id], (errDelete) => {
      if (errDelete) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: errDelete.message });
      }

      const stmt = db.prepare(`INSERT INTO detalles_pedido (pedido_id, producto_nombre, cantidad, subtotal, paquetes, foto_torta) VALUES (?, ?, ?, ?, ?, ?)`);
      detalles.forEach((item) => {
        const nombre = String(item.producto_nombre || '').trim();
        const cantidad = Number(item.cantidad || 0);
        const subtotal = Number(item.subtotal || 0);
        if (!nombre || cantidad <= 0) return;
        const paquetes = item.paquetes && typeof item.paquetes === 'object' ? JSON.stringify(item.paquetes) : '{}';
        stmt.run(id, nombre, cantidad, subtotal, paquetes, String(item.foto_torta || ''));
      });

      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: finalizeErr.message });
        }

        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            return res.status(500).json({ error: commitErr.message });
          }
          return res.json({ success: true, id: Number(id), monto_total: montoTotal, adelanto, restante: Math.max(0, montoTotal - adelanto) });
        });
      });
    });
  });
});

app.delete('/api/admin/pedidos/:id', requireAdminAuth, (req, res) => {
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

// Endpoint: ventana diaria de producción/embalaje (15:00 del día elegido a 15:00 del siguiente)
app.get('/api/admin/produccion', requireAdminAuth, async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim();
    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
    const fechaSiguiente = sumarDiasIso(fecha, 1);
    if (!fechaSiguiente) return res.status(400).json({ error: 'Fecha inválida' });

    const clientesBase = await dbAllAsync(`
      SELECT id, codigo, cliente_nombre, tipo_cliente, origen, fecha_recoge, hora_recoge,
             fecha_emision, fecha_registro, cronograma_casino_id
      FROM pedidos
      WHERE (
        (fecha_recoge = ? AND hora_recoge >= '15:00')
        OR
        (fecha_recoge = ? AND hora_recoge < '15:00')
      )
        AND COALESCE(estado, 'Registrado') NOT IN ('Pendiente de verificación de pago', 'Cancelado')
      ORDER BY fecha_recoge ASC, hora_recoge ASC, id ASC
    `, [fecha, fechaSiguiente]);

    const clientes = clientesBase
      .map((pedido) => ({ ...pedido, es_urgente: esUrgentePorEmision(fecha, pedido) }))
      .sort((a, b) =>
        Number(Boolean(b.es_urgente)) - Number(Boolean(a.es_urgente))
        || String(a.fecha_recoge || '').localeCompare(String(b.fecha_recoge || ''))
        || String(a.hora_recoge || '').localeCompare(String(b.hora_recoge || ''))
        || Number(a.id) - Number(b.id)
      );

    const ids = clientes.map((item) => Number(item.id)).filter(Boolean);
    let detalles = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const rows = await dbAllAsync(
        `SELECT p.id AS pedido_id, p.origen, p.tipo_cliente, p.fecha_recoge, p.hora_recoge,
                p.fecha_emision, p.fecha_registro,
                dp.producto_nombre, dp.cantidad, dp.paquetes, dp.foto_torta
         FROM detalles_pedido dp
         JOIN pedidos p ON dp.pedido_id = p.id
         WHERE p.id IN (${placeholders})
         ORDER BY p.id ASC, dp.id ASC`,
        ids
      );

      detalles = (rows || []).map((det) => {
        const resuelto = resolverProductoProduccion(det.producto_nombre);
        return {
          pedido_id: det.pedido_id,
          origen: det.origen || 'pg',
          tipo_cliente: det.tipo_cliente || 'Cliente',
          fecha_recoge: det.fecha_recoge,
          hora_recoge: det.hora_recoge,
          es_urgente: esUrgentePorEmision(fecha, det),
          producto_nombre: resuelto,
          producto_nombre_original: det.producto_nombre,
          cantidad: Number(det.cantidad || 0),
          paquetes: det.paquetes ? JSON.parse(det.paquetes) : {},
          foto_torta: det.foto_torta || ''
        };
      });
    }

    const clientesEmbalajeBase = await dbAllAsync(`
      SELECT id, codigo, cliente_nombre, tipo_cliente, origen, fecha_recoge, hora_recoge,
             fecha_emision, fecha_registro, cronograma_casino_id
      FROM pedidos
      WHERE fecha_recoge = ?
        AND COALESCE(estado, 'Registrado') NOT IN ('Pendiente de verificación de pago', 'Cancelado')
      ORDER BY hora_recoge ASC, id ASC
    `, [fecha]);

    const clientesEmbalaje = clientesEmbalajeBase
      .map((pedido) => ({ ...pedido, es_urgente: esUrgentePorEmision(fecha, pedido) }))
      .sort((a, b) =>
        Number(Boolean(b.es_urgente)) - Number(Boolean(a.es_urgente))
        || String(a.hora_recoge || '').localeCompare(String(b.hora_recoge || ''))
        || Number(a.id) - Number(b.id)
      );

    const idsEmbalaje = clientesEmbalaje.map((item) => Number(item.id)).filter(Boolean);
    let detallesEmbalaje = [];
    if (idsEmbalaje.length) {
      const placeholders = idsEmbalaje.map(() => '?').join(',');
      const rows = await dbAllAsync(
        `SELECT p.id AS pedido_id, p.origen, p.tipo_cliente, p.fecha_recoge, p.hora_recoge,
                p.fecha_emision, p.fecha_registro,
                dp.producto_nombre, dp.cantidad, dp.paquetes, dp.foto_torta
         FROM detalles_pedido dp
         JOIN pedidos p ON dp.pedido_id = p.id
         WHERE p.id IN (${placeholders})
         ORDER BY p.id ASC, dp.id ASC`,
        idsEmbalaje
      );

      detallesEmbalaje = (rows || []).map((det) => ({
        pedido_id: det.pedido_id,
        origen: det.origen || 'pg',
        tipo_cliente: det.tipo_cliente || 'Cliente',
        fecha_recoge: det.fecha_recoge,
        hora_recoge: det.hora_recoge,
        es_urgente: esUrgentePorEmision(fecha, det),
        producto_nombre: resolverProductoProduccion(det.producto_nombre),
        producto_nombre_original: det.producto_nombre,
        cantidad: Number(det.cantidad || 0),
        paquetes: det.paquetes ? JSON.parse(det.paquetes) : {},
        foto_torta: det.foto_torta || ''
      }));
    }

    return res.json({
      fecha,
      fecha_siguiente: fechaSiguiente,
      ventana: { desde: `${fecha} 15:00`, hasta: `${fechaSiguiente} 15:00` },
      productos: PRODUCTOS_COCINA,
      clientes,
      detalles,
      embalaje: {
        fecha,
        clientes: clientesEmbalaje,
        detalles: detallesEmbalaje
      }
    });
  } catch (error) {
    console.error('Error cargando producción:', error);
    return res.status(500).json({ error: 'No se pudo cargar la ventana de producción.' });
  }
});

// Endpoint para recibir la notificación desde MacroDroid / Yape
app.post('/api/yape-webhook', (req, res) => {
  const payload = req.body || {};
  const texto = String(payload.texto_notificacion || payload.notificacion || payload.text || '').trim();
  const codigo = String(payload.codigo || payload.codigoPedido || payload.codigo_pedido || payload.pedido || payload.pedido_codigo || '').trim();
  const nroOperacion = String(payload.nro_operacion || payload.numero_operacion || payload.op || payload.operacion || payload.nroOperacion || '').trim();
  const monto = Number(payload.monto || payload.monto_total || payload.total || 0);
  const tipo = String(payload.tipo || payload.event || payload.signal || '').trim();
  const origen = String(payload.origen || payload.source || '').trim();

  console.log('🔔 WEBHOOK RECIBIDO:', {
    codigo,
    nroOperacion,
    monto,
    tipo,
    origen,
    payload_completo: payload,
    tiene_texto: !!texto,
    tiene_codigo: !!codigo,
    tiene_nroOperacion: !!nroOperacion
  });

  if (!texto && !codigo && !nroOperacion) {
    console.log('❌ RECHAZO: No se recibió texto, codigo ni nro_operacion');
    return res.status(400).json({ error: 'No se recibió texto de notificación ni codigo de pedido ni nro_operacion.' });
  }

  const responder = (pedido, message) => {
    if (!pedido) {
      return res.status(404).json({ ok: false, status: 'not_found', message: message || 'No se encontró pedido coincidente' });
    }

    return res.json({ ok: true, codigo: pedido.codigo || codigo, estado: 'Registrado', nro_operacion: pedido.nro_operacion || nroOperacion || '', monto, tipo, origen, mode: 'yape-webhook' });
  };

  // ESTRATEGIA: Si viene nro_operacion (de MacroDroid), usar eso primero
  // porque es más simple que pasar el código dinámicamente por variables
  if (nroOperacion && !codigo) {
    console.log('🔍 Buscando pedido por NRO_OPERACION (estrategia MacroDroid):', nroOperacion);
    return db.get(`SELECT id, codigo, estado, monto_total, adelanto FROM pedidos WHERE estado IN ('Pendiente de verificación de pago', 'Registrado') ORDER BY id DESC LIMIT 1`, [], (err, pedido) => {
      if (err) {
        console.log('❌ Error en SELECT:', err.message);
        return res.status(500).json({ error: err.message });
      }
      if (!pedido) {
        console.log('❌ No hay pedidos pendientes en la base de datos');
        return res.status(404).json({ ok: false, error: 'No hay pedidos pendientes.' });
      }
      console.log('✅ Pedido pendiente encontrado:', pedido.codigo, '- Actualizando con nro_operacion:', nroOperacion);
      return db.run(`UPDATE pedidos SET estado = 'Registrado', registrado_en = CURRENT_TIMESTAMP, nro_operacion = ? WHERE id = ?`, [nroOperacion, pedido.id], function (updateErr) {
        if (updateErr) {
          console.log('❌ Error en UPDATE:', updateErr.message);
          return res.status(500).json({ ok: false, error: updateErr.message });
        }
        console.log('✅ Pedido actualizado exitosamente');
        return responder(pedido);
      });
    });
  }

  // Si viene código (formato antiguo o manual), usar eso
  if (codigo) {
    console.log('🔍 Buscando pedido por CODIGO:', codigo);
    return db.run(`UPDATE pedidos SET estado = 'Registrado', registrado_en = CURRENT_TIMESTAMP, nro_operacion = COALESCE(NULLIF(?, ''), nro_operacion) WHERE codigo = ? AND estado IN ('Pendiente de verificación de pago', 'Registrado')`, [nroOperacion || '', codigo], function (err) {
      if (err) {
        console.log('❌ Error en UPDATE:', err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log('✅ UPDATE ejecutado, filas afectadas:', this.changes);
      if (this.changes === 0) {
        console.log('⚠️ 0 filas afectadas, verificando si el pedido existe...');
        return db.get(`SELECT id, codigo, estado, monto_total, adelanto FROM pedidos WHERE codigo = ? LIMIT 1`, [codigo], (lookupErr, pedido) => {
          if (lookupErr) {
            console.log('❌ Error en SELECT:', lookupErr.message);
            return res.status(500).json({ error: lookupErr.message });
          }
          if (!pedido) {
            console.log('❌ PEDIDO NO ENCONTRADO con codigo:', codigo);
            return res.status(404).json({ ok: false, error: 'Pedido no encontrado o ya no está pendiente.', codigo, nro_operacion: nroOperacion, tipo, origen });
          }
          console.log('⚠️ Pedido existe pero estado no es editable:', pedido.estado);
          return responder(pedido, 'Pedido coincidente encontrado, pero el estado no permite pagarlo desde webhook.');
        });
      }
      console.log('✅ Pedido actualizado exitosamente, obteniendo detalles...');
      return db.get(`SELECT id, codigo, estado, monto_total, adelanto FROM pedidos WHERE codigo = ? LIMIT 1`, [codigo], (lookupErr, pedido) => {
        if (lookupErr) {
          console.log('❌ Error en SELECT final:', lookupErr.message);
          return res.status(500).json({ error: lookupErr.message });
        }
        return responder(pedido, 'Pedido no encontrado en la confirmación del webhook.');
      });
    });
  }
  if (texto) {
    const textoBusqueda = texto || '';
    const opMatch = textoBusqueda.match(/(?:operaci[oó]n|op\.?)\s*:?\s*(\d+)/i) || textoBusqueda.match(/\b\d{6,10}\b/);
    const nroFromText = opMatch ? (opMatch[1] || opMatch[0]) : '';
    const montoMatch = textoBusqueda.match(/S\/\s*([\d\.]+)/i);
    const montoFromText = montoMatch ? parseFloat(montoMatch[1]) : null;

    if (nroFromText) {
      return db.get(`SELECT id, codigo, estado, monto_total, adelanto FROM pedidos WHERE nro_operacion = ? AND estado IN ('Pendiente de verificación de pago', 'Registrado') LIMIT 1`, [nroFromText], (err, pedido) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!pedido) return res.status(404).json({ ok: false, status: 'not_found', message: 'No se encontró pedido coincidente con la operación extraída del texto.' });
        return db.run(`UPDATE pedidos SET estado = 'Registrado', registrado_en = CURRENT_TIMESTAMP, nro_operacion = COALESCE(NULLIF(?, ''), nro_operacion) WHERE id = ?`, [nroFromText, pedido.id], function (updateErr) {
          if (updateErr) return res.status(500).json({ ok: false, error: updateErr.message });
          return responder(pedido, 'Pedido confirmado por texto de operación.');
        });
      });
    }
  }

  return res.status(404).json({ ok: false, status: 'not_found', message: 'No se encontró pedido coincidente' });
});

// Hoja de embalaje en Excel: urgentes a la izquierda, normales a la derecha y casinos al extremo derecho.
app.get('/api/admin/exportar-excel', requireAdminAuth, async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim();
    if (!fecha) return res.status(400).send('Fecha requerida');
    const clientesBase = await dbAllAsync(`
      SELECT id, cliente_nombre, origen, fecha_recoge, hora_recoge, fecha_emision, fecha_registro
      FROM pedidos
      WHERE fecha_recoge = ?
        AND COALESCE(estado, 'Registrado') NOT IN ('Pendiente de verificación de pago', 'Cancelado')
      ORDER BY hora_recoge, id
    `, [fecha]);
    const clientes = clientesBase
      .map((pedido) => ({ ...pedido, es_urgente: esUrgentePorEmision(fecha, pedido) }))
      .sort((a, b) =>
        Number(Boolean(b.es_urgente)) - Number(Boolean(a.es_urgente))
        || String(a.hora_recoge || '').localeCompare(String(b.hora_recoge || ''))
        || Number(a.id) - Number(b.id)
      );

    const ids = clientes.map((c) => c.id);
    let detalles = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      detalles = await dbAllAsync(
        `SELECT dp.pedido_id, dp.producto_nombre, dp.cantidad
         FROM detalles_pedido dp WHERE dp.pedido_id IN (${placeholders})`,
        ids
      );
      detalles = detalles.map((det) => ({
        ...det,
        producto_nombre: resolverProductoProduccion(det.producto_nombre)
      }));
    }

    const workbook = new ExcelJS.Workbook();
    const visibles = filtrarItemsEmbalaje(detalles, (nombre) => nombre, normalizarProducto);
    const grupos = [
      { nombre: 'Embalaje', filtro: (nombre) => grupoProductoProduccion(nombre, normalizarProducto) !== 'Panes' },
      { nombre: 'Panes', filtro: (nombre) => grupoProductoProduccion(nombre, normalizarProducto) === 'Panes' }
    ];

    for (const grupo of grupos) {
      const datosGrupo = visibles.filter((det) => grupo.filtro(det.producto_nombre));
      if (grupo.nombre === 'Panes' && !datosGrupo.length) continue;
      const idClientes = new Set(datosGrupo.map((det) => Number(det.pedido_id)));
      const clientesGrupo = clientes.filter((cli) => idClientes.has(Number(cli.id)));
      const porProducto = new Map();
      for (const det of datosGrupo) {
        const clave = normalizarProducto(det.producto_nombre);
        if (!porProducto.has(clave)) porProducto.set(clave, { nombre: det.producto_nombre, porCliente: new Map() });
        const fila = porProducto.get(clave);
        const id = Number(det.pedido_id);
        fila.porCliente.set(id, (fila.porCliente.get(id) || 0) + Number(det.cantidad || 0));
      }
      const ordenGrupos = new Map([
        ['Bocaditos', 0],
        ['Sándwiches', 1],
        ['Triples', 2],
        ['Piqueos', 3],
        ['Panes', 4]
      ]);
      const ordenCatalogo = new Map(
        [...PRODUCTOS_COCINA, ...PRODUCTOS_COCINA_EXTRA]
          .map((nombre, indice) => [normalizarProducto(nombre), indice])
      );
      const productosGrupo = [...porProducto.values()].sort((a, b) => {
        const grupoA = grupoProductoProduccion(a.nombre, normalizarProducto);
        const grupoB = grupoProductoProduccion(b.nombre, normalizarProducto);
        const rangoA = ordenGrupos.get(grupoA) ?? 99;
        const rangoB = ordenGrupos.get(grupoB) ?? 99;
        const ordenA = ordenCatalogo.get(normalizarProducto(a.nombre)) ?? 9999;
        const ordenB = ordenCatalogo.get(normalizarProducto(b.nombre)) ?? 9999;
        return rangoA - rangoB || ordenA - ordenB || a.nombre.localeCompare(b.nombre, 'es');
      });
      const worksheet = workbook.addWorksheet(grupo.nombre, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });
      worksheet.getCell('A1').value = `${grupo.nombre.toUpperCase()} · RECOJOS ${fecha}`;
      worksheet.getCell('A1').font = { bold: true, size: 12 };

      clientesGrupo.forEach((cli, idx) => {
        const cell = worksheet.getCell(2, idx + 2);
        cell.value = `${String(cli.cliente_nombre || '').toUpperCase()}${cli.origen === 'casino' ? ' · CASINO' : ''}`;
        cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center' };
        cell.font = { bold: true, color: { argb: cli.es_urgente ? 'FFCC0000' : 'FF111111' } };
      });

      const colTotalIdx = Math.max(clientesGrupo.length + 2, 3);
      worksheet.getCell(2, colTotalIdx).value = 'TOTAL';
      worksheet.getCell(2, colTotalIdx).font = { bold: true };
      productosGrupo.forEach((producto, pIdx) => {
        const rowNum = pIdx + 3;
        worksheet.getCell(rowNum, 1).value = producto.nombre;
        worksheet.getCell(rowNum, 1).font = { bold: true };
        clientesGrupo.forEach((cli, cIdx) => {
          const cantidad = producto.porCliente.get(Number(cli.id)) || 0;
          if (cantidad > 0) {
            const cell = worksheet.getCell(rowNum, cIdx + 2);
            cell.value = cantidad;
            cell.font = { bold: true, color: { argb: cli.es_urgente ? 'FFCC0000' : 'FF111111' } };
          }
        });
        const desde = worksheet.getColumn(2).letter;
        const hasta = worksheet.getColumn(colTotalIdx - 1).letter;
        worksheet.getCell(rowNum, colTotalIdx).value = { formula: `SUM(${desde}${rowNum}:${hasta}${rowNum})` };
        worksheet.getCell(rowNum, colTotalIdx).font = { bold: true };
      });
      worksheet.getColumn(1).width = 30;
      for (let i = 2; i <= colTotalIdx; i += 1) worksheet.getColumn(i).width = i === colTotalIdx ? 10 : 8;
      worksheet.getRow(2).height = 115;
      worksheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Embalaje_${fecha}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exportando embalaje:', error);
    if (!res.headersSent) res.status(500).send('No se pudo generar la hoja de embalaje.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor D'chelis ejecutándose en http://localhost:${PORT}`));
