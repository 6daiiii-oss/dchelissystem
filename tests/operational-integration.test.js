// Opt-in, isolated PostgreSQL validation; never runs against a production URL.
// Run with CASINO_SOURCE_XLSX and DCHELIS_TEST_DATABASE_URL (localhost only).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const ExcelJS = require('exceljs');
const { Pool } = require('pg');
const enabled = process.env.CASINO_SOURCE_XLSX && process.env.DCHELIS_TEST_DATABASE_URL;
const pause = ms => new Promise(r => setTimeout(r, ms));
const text = cell => { const v = cell.value; return v == null ? '' : String(v.richText ? v.richText.map(t => t.text).join('') : v.result ?? v); };
const dateOf = v => v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'number'
  ? new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10)
  : /^\d{1,2}-sep$/i.test(String(v)) ? `2026-09-${String(v).split('-')[0].padStart(2, '0')}` : null;

function sourceCells(book) {
  const rows = [];
  for (const sheet of book.worksheets) {
    let columns = [], nameColumn = 0, panColumn = 0, typeColumn = 0;
    for (let r = 1; r <= sheet.rowCount; r++) {
      const values = Array.from({ length: sheet.columnCount + 1 }, (_, c) => c ? text(sheet.getCell(r, c)).trim() : '');
      const days = values.map((v, c) => /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)$/i.test(v) ? c : 0).filter(Boolean);
      if (days.length >= 3) {
        nameColumn = values.findIndex(v => /^(articulo|artículo|item|producto)$/i.test(v));
        panColumn = values.findIndex(v => /^pan$/i.test(v)); typeColumn = values.findIndex(v => /^tipo$/i.test(v));
        if (nameColumn < 1 && panColumn < 1 && typeColumn > 0) nameColumn = typeColumn;
        columns = days.map(c => { const raw = sheet.getCell(r + 1, c).value; const date = dateOf(raw?.result ?? raw); assert.ok(date, `Fecha explícita ${sheet.name}, ${r + 1}, ${c}`); return [c, date]; });
        r++; continue;
      }
      if (!columns.length) continue;
      const name = (nameColumn > 0 ? text(sheet.getCell(r, nameColumn)) : [panColumn, typeColumn].filter(c => c > 0).map(c => text(sheet.getCell(r, c))).join(' ')).replace(/\u00a0/g, ' ').trim();
      if (!name || /TOTAL|#REF/i.test(name)) continue;
      for (const [c, date] of columns) {
        const raw = sheet.getCell(r, c).value;
        const qty = Number(raw?.result ?? raw ?? 0);
        if (qty > 0) rows.push([sheet.name, date, name, qty, r]);
      }
    }
  }
  return rows;
}
const sort = rows => rows.map(JSON.stringify).sort();
const previous = date => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

test('Excel completo → PostgreSQL → HP/HE/HPE sin faltantes, sobrantes ni filas heredadas de una revisión', { skip: !enabled, timeout: 90000 }, async t => {
  const url = new URL(process.env.DCHELIS_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'La prueba exige PostgreSQL local aislado');
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  t.after(() => pool.end());
  const existing = await pool.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='pedidos'");
  assert.equal(Number(existing.rows[0].n), 0, 'Exige una base de datos vacía; no altera datos existentes');
  const password = crypto.randomBytes(24).toString('hex');
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url.toString(), PORT: '3133', TZ: 'America/Lima', ADMIN_USERNAME: 'auditoria', ADMIN_PASSWORD: password, ADMIN_SESSION_SECRET: crypto.randomBytes(48).toString('hex') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
  t.after(async () => { child.kill('SIGTERM'); await Promise.race([new Promise(r => child.once('exit', r)), pause(2000)]); });
  const origin = 'http://127.0.0.1:3133';
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) assert.fail(logs);
    try { if ((await fetch(`${origin}/`)).ok) break; } catch {}
    await pause(100);
  }
  assert.ok((await fetch(`${origin}/`)).ok, logs);
  const login = await fetch(`${origin}/api/admin/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ usuario: 'auditoria', password }) });
  assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie').split(';')[0];
  const headers = { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin };
  const buffer = fs.readFileSync(process.env.CASINO_SOURCE_XLSX);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer); const expected = sourceCells(book);
  const importBook = async bytes => {
    const response = await fetch(`${origin}/api/admin/casinos/procesar-excel`, { method: 'POST', headers, body: JSON.stringify({ nombre_archivo: 'Auditoria-Octubre.xlsx', archivo_base64: Buffer.from(bytes).toString('base64') }) });
    return { status: response.status, data: await response.json() };
  };
  const result = await importBook(buffer); assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.celdas_importadas, expected.length);
  const stored = await pool.query(`SELECT dp.id, p.casino_nombre, p.fecha_recoge, dp.producto_nombre,
    dp.producto_nombre_fuente, dp.casino_clave_fuente, dp.categoria_operativa, dp.cantidad
    FROM detalles_pedido dp JOIN pedidos p ON p.id=dp.pedido_id WHERE p.cronograma_casino_id=$1`, [result.data.cronograma_id]);
  assert.deepEqual(sort(stored.rows.map(r => [r.casino_nombre, r.fecha_recoge, r.producto_nombre, Number(r.cantidad), Number(r.casino_clave_fuente.split('::').at(-1))])), sort(expected));
  assert.ok(stored.rows.every(r => r.producto_nombre === r.producto_nombre_fuente));
  const hpeGroups = new Set(['Triples', 'Sándwiches', 'Piqueos']);
  const dates = new Set(stored.rows.flatMap(r => [r.fecha_recoge, previous(r.fecha_recoge)]));
  const dataFor = async date => {
    const res = await fetch(`${origin}/api/admin/produccion?fecha=${date}`, { headers });
    assert.equal(res.status, 200); return res.json();
  };
  const tuple = r => [Number(r.detalle_id ?? r.id), r.producto_nombre, Number(r.cantidad), r.fecha_recoge];
  for (const date of [...dates].sort()) {
    const data = await dataFor(date);
    const hp = stored.rows.filter(r => !hpeGroups.has(r.categoria_operativa) && previous(r.fecha_recoge) === date);
    const hpe = stored.rows.filter(r => hpeGroups.has(r.categoria_operativa) && r.fecha_recoge === date);
    assert.deepEqual(sort(data.detalles.map(tuple)), sort(hp.map(tuple)), `HP ${date}`);
    assert.deepEqual(data.embalaje.detalles, data.detalles, `HE y HP ${date}`);
    assert.deepEqual(sort(data.produccion_embalaje.detalles.map(tuple)), sort(hpe.map(tuple)), `HPE ${date}`);
  }
  const duplicate = await importBook(buffer); assert.equal(duplicate.status, 409);
  assert.equal((await pool.query('SELECT COUNT(*) AS n FROM detalles_pedido')).rows[0].n, String(expected.length));
  const oct = await dataFor('2026-10-05');
  const excel = await fetch(`${origin}/api/admin/exportar-excel?fecha=2026-10-05`, { headers }); assert.equal(excel.status, 200);
  const exported = new ExcelJS.Workbook(); await exported.xlsx.load(Buffer.from(await excel.arrayBuffer()));
  assert.equal(exported.getWorksheet('Detalle de pedidos').rowCount - 1, oct.embalaje.detalles.length);
  // Remove all cells for one casino/date in a revision: old quantities must not revive.
  const target = expected.find(r => r[1] === '2026-10-06'); assert.ok(target);
  const sheet = book.getWorksheet(target[0]);
  for (let r = 1; r <= sheet.rowCount; r++) for (let c = 1; c <= sheet.columnCount; c++) {
    const raw = sheet.getCell(r, c).value;
    if (dateOf(raw?.result ?? raw) === target[1]) for (let row = r + 1; row <= sheet.rowCount; row++) sheet.getCell(row, c).value = null;
  }
  const revision = await importBook(await book.xlsx.writeBuffer()); assert.equal(revision.status, 200, JSON.stringify(revision.data));
  const revised = sourceCells(book); assert.equal(revision.data.celdas_importadas, revised.length);
  for (const date of ['2026-10-05', '2026-10-06']) {
    const data = await dataFor(date);
    const clients = [...data.clientes, ...data.produccion_embalaje.clientes];
    assert.ok(!clients.some(c => c.casino_nombre === target[0] && c.fecha_recoge === target[1]), `Revisión vacía ${target[0]} ${date}`);
  }
  const tarde = await pool.query(`INSERT INTO pedidos (codigo, cliente_nombre, tipo_cliente, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, fecha_emision, origen, estado)
    VALUES ('AUD-TARDE', 'Prueba de corte', 'Cliente', '999999999', 0, 0, 'Prueba local', '2026-10-06', '09:00', '2026-10-05 22:00:00', 'pg', 'Registrado') RETURNING id`);
  const temprano = await pool.query(`INSERT INTO pedidos (codigo, cliente_nombre, tipo_cliente, celular, monto_total, adelanto, metodo_pago, fecha_recoge, hora_recoge, fecha_emision, origen, estado)
    VALUES ('AUD-TEMPRANO', 'Prueba anterior al corte', 'Cliente', '999999999', 0, 0, 'Prueba local', '2026-10-06', '21:00', '2026-10-05 12:59:59', 'pg', 'Registrado') RETURNING id`);
  await pool.query(`INSERT INTO detalles_pedido (pedido_id, producto_nombre, categoria_operativa, cantidad, subtotal)
    VALUES ($1, 'BOCADITO PRUEBA TARDE', 'Bocaditos', 25, 0), ($1, 'PAN PRUEBA TARDE', 'Panes', 30, 0),
           ($2, 'BOCADITO PRUEBA TEMPRANO', 'Bocaditos', 20, 0)`, [tarde.rows[0].id, temprano.rows[0].id]);
  const dia5 = await dataFor('2026-10-05'), dia6 = await dataFor('2026-10-06');
  assert.ok(dia5.detalles.some(d => d.producto_nombre === 'PAN PRUEBA TARDE' && d.cantidad === 30));
  assert.ok(!dia6.detalles.some(d => d.producto_nombre === 'PAN PRUEBA TARDE'));
  assert.ok(dia6.detalles.some(d => d.producto_nombre === 'BOCADITO PRUEBA TARDE' && d.cantidad === 25 && d.es_urgente));
  assert.ok(!dia5.detalles.some(d => d.producto_nombre === 'BOCADITO PRUEBA TARDE'));
  assert.ok(dia5.detalles.some(d => d.producto_nombre === 'BOCADITO PRUEBA TEMPRANO' && d.cantidad === 20));
  assert.deepEqual(dia5.detalles, dia5.embalaje.detalles); assert.deepEqual(dia6.detalles, dia6.embalaje.detalles);
  assert.doesNotMatch(logs, /syntax error|Error inicializando|No se pudieron limpiar/);
  console.log(`Integración: ${expected.length} celdas, ${book.worksheets.length} hojas, ${dates.size} fechas operativas, duplicado y revisión vacía verificados.`);
  // Credentials stay in this process; the browser check uses the established session only.
  if (process.env.DCHELIS_BROWSER_AUDIT) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    t.after(() => browser.close());
    const context = await browser.newContext(); await context.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: origin }]);
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', dialog => { errors.push(dialog.message()); dialog.dismiss(); });
    await page.goto(`${origin}/produccion`);
    await page.locator('#settingsBtn').click();
    await page.locator('#settingsMenu').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-theme-choice="dark"]').getAttribute('aria-checked'), 'false');
    await page.locator('[data-theme-choice="dark"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.locator('#settingsMenu').isVisible(), false);
    await page.locator('#settingsBtn').click();
    await page.locator('[data-theme-choice="light"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    assert.equal(await page.locator('#settingsMenu').isVisible(), false);
    await page.locator('#panel-produccion').waitFor({ state: 'visible' });
    await page.locator('#fecha_filtro').fill('2026-10-06'); await page.locator('#actualizarCocinaBtn').click();
    await page.waitForFunction(() => !document.querySelector('#actualizarCocinaBtn').disabled);
    assert.equal(await page.locator('#fecha_filtro').inputValue(), '2026-10-06');
    const expectedHpe = (await dataFor('2026-10-06')).produccion_embalaje.detalles;
    const actualHpe = await page.locator('#hojaDistribucionCocina .distribution-item').evaluateAll(items => items.map(item => [item.querySelector('span').textContent.trim(), Number(item.querySelector('strong').textContent)]));
    assert.deepEqual(sort(actualHpe), sort(expectedHpe.map(d => [d.producto_nombre.toUpperCase(), d.cantidad])));

    await page.locator('[data-tab="embalaje"]').click();
    await page.locator('#panel-embalaje').waitFor({ state: 'visible' });
    await page.locator('#fecha_embalaje').fill('2026-10-05'); await page.locator('#actualizarEmbalajeBtn').click();
    await page.waitForFunction(() => !document.querySelector('#actualizarEmbalajeBtn').disabled);
    assert.ok((await page.locator('#hojaProduccion').innerText()).includes('PRODUCTO'));
    await page.locator('#settingsBtn').click();
    await page.locator('[data-theme-choice="dark"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    const totalBox = page.locator('#hojaProduccion td.pack-cell').first();
    assert.ok(await totalBox.locator('.pack-badge').count(), 'cada total debe tener su recuadro dentro de la celda TOTAL');
    const totalBoxStyle = await totalBox.evaluate(cell => ({
      background: getComputedStyle(cell).backgroundColor,
      border: getComputedStyle(cell).borderTopColor,
      badgeBorder: getComputedStyle(cell.querySelector('.pack-badge')).borderTopColor
    }));
    assert.notEqual(totalBoxStyle.background, 'rgb(19, 28, 23)', 'la celda TOTAL debe conservar fondo destacado en tema oscuro');
    assert.equal(totalBoxStyle.border, 'rgb(167, 94, 81)');
    assert.equal(totalBoxStyle.badgeBorder, 'rgb(167, 94, 81)');
    const normalQty = page.locator('#hojaProduccion td.qty-cell.kitchen-normal:not(.kitchen-casino)').first();
    if (await normalQty.count()) assert.equal(await normalQty.evaluate(cell => getComputedStyle(cell).color), 'rgb(237, 244, 239)');
    await page.locator('#settingsBtn').click();
    await page.locator('[data-theme-choice="light"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    const expectedHe = (await dataFor('2026-10-05')).embalaje.detalles;
    const actualHe = await page.locator('#hojaProduccion tbody').evaluateAll(bodies => {
      const totals = new Map();
      for (const body of bodies) {
        let category = '';
        for (const row of body.querySelectorAll('tr')) {
          if (row.classList.contains('embalaje-group-row')) { category = row.textContent.trim(); continue; }
          const name = row.querySelector('td.prod-col')?.textContent.trim();
          if (!name) continue;
          const key = JSON.stringify([name, category]);
          const qty = [...row.querySelectorAll('td.qty-cell')].reduce((sum, cell) => sum + Number(cell.textContent), 0);
          totals.set(key, (totals.get(key) || 0) + qty);
        }
      }
      return [...totals.entries()].sort();
    });
    const expectedTotals = new Map();
    for (const row of expectedHe) {
      const nombre = ['EMPANADITA DE CARNE', 'EMPANADITAS DE CARNE', 'EMPANADAS DE CARNE', 'EMPANADA DE CARNE'].includes(row.producto_nombre.toUpperCase())
        && row.categoria_operativa.toUpperCase() === 'BOCADITOS' ? 'EMPANADA CARNE' : row.producto_nombre;
      const key = JSON.stringify([nombre, row.categoria_operativa.toUpperCase()]);
      expectedTotals.set(key, (expectedTotals.get(key) || 0) + row.cantidad);
    }
    assert.deepEqual(actualHe, [...expectedTotals.entries()].sort());
    const barrancoEmpanada = await page.locator('#hojaProduccion tr').filter({ has: page.locator('td.prod-col', { hasText: /^EMPANADA CARNE$/ }) }).evaluateAll(rows => {
      for (const row of rows) {
        const headers = [...row.closest('table').querySelectorAll('thead th.client-header')].map(cell => cell.textContent.trim());
        const barranco = headers.findIndex(name => name === 'BARRANCO');
        if (barranco >= 0) return row.children[barranco + 1]?.textContent.trim() || '';
      }
      return '';
    });
    assert.equal(barrancoEmpanada, '20', 'Barranco debe figurar en la fila consolidada de empanada de carne');
    assert.equal(await page.locator('#panel-produccion').isVisible(), false);
    assert.equal(await page.locator('#fecha_filtro').inputValue(), '2026-10-06');
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.body.classList.add('printing-cocina', 'printing-embalaje'));
    assert.equal(await page.locator('#panel-embalaje').isVisible(), true); assert.equal(await page.locator('#panel-produccion').isVisible(), false);
    await page.evaluate(() => { document.body.classList.remove('printing-embalaje'); document.body.classList.add('printing-distribucion'); });
    assert.equal(await page.locator('#panel-produccion').isVisible(), true); assert.equal(await page.locator('#panel-embalaje').isVisible(), false);
    assert.equal(await page.locator('#productionPaperWrapper').isVisible(), false);
    assert.equal(await page.locator('#distributionPaperWrapper').isVisible(), true);
    await page.evaluate(() => { document.body.classList.remove('printing-distribucion'); document.body.classList.add('printing-produccion'); });
    assert.equal(await page.locator('#productionPaperWrapper').isVisible(), true);
    assert.equal(await page.locator('#distributionPaperWrapper').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('Chromium: páginas independientes, fechas, carga de hojas e impresiones HE/HPE verificadas.');
  }
});
