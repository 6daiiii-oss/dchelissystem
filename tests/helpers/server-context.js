const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function serverContext() {
  const routes = {};
  const context = { routes, console, Buffer, URL, Date, process: { env: { ADMIN_SESSION_SECRET: 'test' } } };
  context.require = name => name === 'express' ? (() => ({ set() {}, get(url, ...handlers) { routes[url] = handlers.at(-1); } }))
    : name === 'cors' ? (() => {}) : name === 'bcryptjs' ? { hashSync: () => '' }
    : name === './db' ? {} : name.startsWith('./') ? require(path.join(root, name)) : require(name);
  vm.createContext(context);
  vm.runInContext(source.split('// Middlewares')[0], context);
  const start = source.indexOf("app.get('/api/admin/produccion'");
  vm.runInContext(source.slice(start, source.indexOf('\nconst PORT =', start)), context);
  return context;
}

module.exports = { serverContext };
