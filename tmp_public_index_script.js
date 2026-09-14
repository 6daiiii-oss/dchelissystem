
// En GitHub Pages define window.DCHELIS_API_URL en config.js con la URL pública
// del servidor Node instalado en la PC o en un hosting. Sin servidor no existe
// una base de datos donde registrar pedidos.
const API_BASE = String(window.DCHELIS_API_URL || localStorage.getItem('dchelis_api_url') || '').replace(/\/$/, '');
const apiUrl = (path) => API_BASE ? `${API_BASE}${path}` : path;
const productosIniciales = [
    // --- BOCADITOS DULCES ---
    ['dulce_alfajorcito_choco', 'Alfajorcito de Chocolate', 'Bocaditos Dulces', 70.0, 20.0, 35.0, 70.0, null],
    ['dulce_alfajorcito_manjar', 'Alfajorcito de Manjar', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_biscotelas', 'Biscotelas', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_brownies', 'Brownies', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_budin', 'Budin', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_cisne', 'Cisne', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_cocaditas', 'Cocaditas', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_conitos_manjar', 'Conitos de Manjar', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_donitas', 'Donitas', 'Bocaditos Dulces', 76.0, 25.0, 45.0, 76.0, null],
    ['dulce_kekito_zanahoria', 'Kekito de Zanahoria', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_merenguitos', 'Merenguitos', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_mil_hojas', 'Mil Hojas', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mini_muffin', 'Mini Muffin', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mousse_fresa', 'Mousse de Fresa', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mousse_maracuya', 'Mousse de Maracuyá', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_mousse_lucuma', 'Mousse de Lúcuma', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_niditos_amor', 'Niditos de Amor', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_orejitas', 'Orejitas', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_panuelitos_manjar', 'Pañuelitos de Manjar', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_pastelito_choclo', 'Pastelito de Choclo', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_piononitos', 'Piononitos', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_piononitos_chantilly', 'Piononitos de Chantilly', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_pye_limon', 'Pye de Limón', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_pye_manzana', 'Pye de Manzana', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_pye_pina', 'Pye de Piña', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_relampago_choco', 'Relámpago de Chocolate', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_coco', 'Tartaleta de Coco', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
    ['dulce_tartaleta_durazno', 'Tartaleta de Durazno', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_fresa', 'Tartaleta de Fresa', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_sauco', 'Tartaleta de Sauco', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_lucuma', 'Tartaleta de Lúcuma', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tartaleta_guanabana', 'Tartaleta de Guanabana', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tortita_choco', 'Tortita de Chocolate', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tortita_helada', 'Tortita Helada', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tortita_selva_negra', 'Tortita Selva Negra', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_tortita_tres_leches', 'Tortita Tres Leches', 'Bocaditos Dulces', 85.0, 25.0, 45.0, 85.0, null],
    ['dulce_trufas', 'Trufas', 'Bocaditos Dulces', 70.0, 19.0, 35.0, 70.0, null],
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
    ['test', 'test', 'Pruebas', 0.10, null, null, null, 0.10],
    ['prueba_macrodroid_010', 'Prueba MacroDroid 0.10', 'Pruebas', 0.10, null, null, null, 0.10],

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
  actualizar(3, { 70: 76 });
  actualizar(4, { 19: 22 });
  actualizar(5, { 35: 40 });
  actualizar(6, { 70: 76 });
  actualizar(7, {});
  return copia;
});

// Mapeo automático de la estructura de matriz a objetos internos legibles
let productos = preciosActualizados.map((p, index) => {
  const [id, nombre, categoria, p100, p25, p50, ref100, precioFijo] = p;
  let obj = { id: index + 1, codigo: id, nombre, categoria };
  if (precioFijo !== null) {
    obj.precio = precioFijo;
  } else {
    obj.precios = {
      x100: ref100 !== null ? ref100 : p100,
      x50: p50,
      x25: p25
    };
  }
  return obj;
});

async function cargarProductosDesdeApi() {
  try {
    const response = await fetch(apiUrl('/api/productos'));
    if (!response.ok) throw new Error(`API productos status ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return;

    productos = rows.map((row, index) => {
      const producto = {
        id: index + 1,
        codigo: row.id,
        nombre: row.nombre,
        categoria: row.categoria
      };

      if (row.precio !== undefined && row.precio !== null) {
        producto.precio = Number(row.precio);
      } else {
        producto.precios = {
          x100: Number(row.precio_x100 ?? row.precio ?? 0),
          x50: Number(row.precio_x50 ?? 0),
          x25: Number(row.precio_x25 ?? 0)
        };
      }

      return producto;
    });
  } catch (error) {
    console.warn('No se pudo cargar el catálogo desde /api/productos; usando fallback local.', error);
  }
}

const pricing = typeof DchelisPricing !== 'undefined' ? DchelisPricing : null;
function mostrarError(msj, foco = null) {
  const box = document.getElementById('floatingError');
  if (!box) return;
  box.textContent = msj;
  box.classList.add('visible');
  if (foco) {
    const elemento = typeof foco === 'string' ? document.getElementById(foco) : foco;
    if (elemento) {
      elemento.classList.add('danger-flash');
      setTimeout(() => elemento.classList.remove('danger-flash'), 450);
    }
  }
  setTimeout(() => box.classList.remove('visible'), 2600);
}

let cantidades = {};
let paquetesPorProducto = {};
let datosPedidoActual = {};
let fotoTortaData = '';
let categoriaFiltroActual = "todos";
let yapeOrderInFlight = false;

const CART_KEY = 'dchelis_cart_v1';

const CATEGORIAS_UNIDAD = ['Torta Chantilly', 'Pasteles Familiares', 'Pan Especial', 'Extras para tortas'];
const CATEGORIAS_MINIMO_25 = ['Bocaditos Dulces', 'Bocaditos Salados', 'Sandwichitos', 'Mini Triples', 'Piqueos', 'Pan Gourmet'];
const CAT_BOCADITO = ['Bocaditos Dulces', 'Bocaditos Salados'];
const CAT_SANDWICH = ['Sandwichitos', 'Mini Triples', 'Piqueos'];

function obtenerPaquetesProducto(id) {
  if (!paquetesPorProducto[id]) paquetesPorProducto[id] = {};
  return paquetesPorProducto[id];
}

function reconstruirCantidadDesdePaquetes(id) {
  const paquetes = obtenerPaquetesProducto(id);
  cantidades[id] = Object.entries(paquetes).reduce((total, [tamano, cantidad]) => {
    const valor = Number(tamano) || 0;
    const cant = Number(cantidad) || 0;
    return total + (valor * cant);
  }, 0);
  return cantidades[id];
}

function actualizarPaquete(id, tamano, delta) {
  const paquetes = obtenerPaquetesProducto(id);
  const nuevoValor = (Number(paquetes[tamano]) || 0) + delta;

  if (nuevoValor <= 0) {
    delete paquetes[tamano];
  } else {
    paquetes[tamano] = nuevoValor;
  }

  reconstruirCantidadDesdePaquetes(id);
  return cantidades[id];
}

document.addEventListener('DOMContentLoaded', async () => {
  restaurarCarritoDesdeLocalStorage();
  await cargarProductosDesdeApi();
  generarBotonesCategorias();
  renderizarCatalogo();
  generarOpcionesHora();
  renderResumenCompra();
  document.getElementById('productSearch')?.addEventListener('input', renderizarCatalogo);
  document.getElementById('cliFotoTorta')?.addEventListener('change', async (event) => {
    const archivo = event.target.files?.[0];
    const preview = document.getElementById('cliFotoTortaPreview');
    if (!archivo) {
      fotoTortaData = '';
      if (preview) preview.style.display = 'none';
      return;
    }
    try {
      fotoTortaData = await comprimirFotoTorta(archivo);
      if (preview) {
        preview.src = fotoTortaData;
        preview.style.display = 'block';
      }
    } catch (error) {
      fotoTortaData = '';
      event.target.value = '';
      alert('No se pudo leer la foto seleccionada. Prueba con otra imagen.');
    }
  });
  const hoy = new Date().toISOString().split('T')[0];
  const inputFecha = document.getElementById('cliFecha');
  if (inputFecha) inputFecha.setAttribute('min', hoy);
});

function comprimirFotoTorta(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => reject(new Error('Formato de imagen no válido'));
      imagen.onload = () => {
        const maximo = 1600;
        const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(imagen.width * escala));
        canvas.height = Math.max(1, Math.round(imagen.height * escala));
        canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      imagen.src = String(lector.result || '');
    };
    lector.readAsDataURL(archivo);
  });
}

function renderResumenCompra() {
const contenedor = document.getElementById('resumenPedido');
if (!contenedor) return;

const items = obtenerItemsCarrito();

if (!items.length) {
  contenedor.style.display = 'none';
  contenedor.innerHTML = '';
  return;
}

const texto = items.map((item) => `${item.cantidad} • ${item.producto.nombre}`).join('<br>');
contenedor.style.display = 'block';
contenedor.innerHTML = `<strong>Pedido actual:</strong><br>${texto}`;
}

function persistCart() {
  localStorage.setItem(CART_KEY, JSON.stringify({ cantidades, paquetesPorProducto }));
}

function restaurarCarritoDesdeLocalStorage() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.cantidades) {
      cantidades = { ...cantidades, ...parsed.cantidades };
    }
    if (parsed && parsed.paquetesPorProducto) {
      paquetesPorProducto = parsed.paquetesPorProducto;
    }
  } catch (error) {
    console.warn('No se pudo restaurar el carrito desde localStorage', error);
  }
}

function obtenerItemsCarrito() {
  return productos
    .map((producto) => ({ producto, cantidad: Math.max(0, Number(cantidades[producto.id]) || 0) }))
    .filter((item) => item.cantidad > 0);
}

function renderizarCarritoCheckout() {
  const contenedor = document.getElementById('checkoutCart');
  if (!contenedor) return;
  const items = obtenerItemsCarrito();
  if (!items.length) {
    contenedor.style.display = 'none';
    contenedor.innerHTML = '';
    return;
  }
  contenedor.style.display = 'block';
  contenedor.innerHTML = `
    <strong>Revisa tu pedido</strong>
    <div style="margin-top:8px; display:grid; gap:7px;">
      ${items.map(({ producto, cantidad }) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <span>${cantidad} • ${producto.nombre} • ${calcularSubtotal(producto, cantidad).toFixed(2)}</span>
          <button type="button" class="btn-action" style="flex:0 0 auto; padding:5px 9px;" onclick="eliminarItemCarrito(${producto.id})">Eliminar</button>
        </div>
      `).join('')}
    </div>
  `;
}

function eliminarItemCarrito(id) {
  cantidades[id] = 0;
  delete paquetesPorProducto[id];
  renderizarCatalogo();
  renderResumenCompra();
  actualizarBarraCarrito();
  renderizarCarritoCheckout();
  if (!obtenerItemsCarrito().length) cerrarModal('modalDatos');
}

function generarOpcionesHora() {
  const selector = document.getElementById('cliHora');
  if (!selector) return;

  for (let minutos = 8 * 60; minutos <= 19 * 60 + 30; minutos += 30) {
    const horas = Math.floor(minutos / 60);
    const minutosTexto = String(minutos % 60).padStart(2, '0');
    const periodo = horas < 12 ? 'a. m.' : 'p. m.';
    const hora12 = horas % 12 || 12;
    const opcion = document.createElement('option');
    opcion.value = `${String(horas).padStart(2, '0')}:${minutosTexto}`;
    opcion.textContent = `${hora12}:${minutosTexto} ${periodo}`;
    selector.appendChild(opcion);
  }
}

function generarBotonesCategorias() {
  const nav = document.getElementById('categoryNav');
  const categoriasUnicas = [...new Set(productos.map(p => p.categoria))];
  
  categoriasUnicas.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.innerText = cat;
    btn.onclick = (e) => filtrarCategoria(cat, btn);
    nav.appendChild(btn);
  });
}

function filtrarCategoria(cat, btn) {
  categoriaFiltroActual = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderizarCatalogo();
}

function normalizarTexto(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function obtenerTextoPrecio(prod) {
  if (prod.precio !== undefined) {
    return `Precio unitario: <strong>S/. ${prod.precio.toFixed(2)}</strong>`;
  }
  if (prod.precios && prod.precios.x100 !== undefined) {
    return `Ciento (100u): <strong>S/. ${prod.precios.x100.toFixed(2)}</strong>`;
  }
  return `Precio no disponible`;
}

function esCategoriaUnidad(categoria) {
  return CATEGORIAS_UNIDAD.includes(categoria);
}

function requiereMinimo25(prod) {
  return CATEGORIAS_MINIMO_25.includes(prod?.categoria);
}

function renderizarCatalogo() {
  const container = document.getElementById('catalogGrid');
  if (!container) return;
  container.innerHTML = '';

  const busqueda = normalizarTexto(document.getElementById('productSearch')?.value || '');

  const filtrados = productos.filter(p => {
    const coincideCategoria = categoriaFiltroActual === 'todos' || p.categoria === categoriaFiltroActual;
    const coincideBusqueda = !busqueda || normalizarTexto(`${p.nombre} ${p.categoria}`).includes(busqueda);
    return coincideCategoria && coincideBusqueda;
  });

  const ayuda = document.getElementById('catalogHelp');
  if (ayuda) ayuda.textContent = filtrados.length
    ? `${filtrados.length} opciones disponibles${busqueda ? ' para tu búsqueda' : ''}.`
    : 'No encontramos ese producto. Prueba con otra palabra.';

  filtrados.forEach(prod => {
    cantidades[prod.id] = cantidades[prod.id] || 0;
    const esUnidad = esCategoriaUnidad(prod.categoria);
    const minimo25 = requiereMinimo25(prod);
    const card = document.createElement('div');
    card.className = `product-card${prod.categoria === 'Extras para tortas' ? ' is-extra' : ''}`;
    card.innerHTML = `
      <div>
        <span class="card-category-badge">${prod.categoria}</span>
        <h3 class="product-title">${prod.nombre}</h3>
        <div class="product-price-info">${obtenerTextoPrecio(prod)}</div>
        <div class="product-subtotal" id="subtotal-${prod.id}">S/. ${calcularSubtotal(prod, cantidades[prod.id]).toFixed(2)}</div>
      </div>
      <div class="controls-wrapper">
        <div class="stepper-row">
          <button class="btn-step-main" type="button" onclick="modificarCantidad(${prod.id}, ${minimo25 ? -25 : -1})">${minimo25 ? '-25' : '-1'}</button>
          ${esUnidad
            ? `<span class="qty-display" id="qty-${prod.id}">${cantidades[prod.id]}</span>`
            : `<input type="number" class="qty-input" id="qty-input-${prod.id}" min="0" step="1" value="${cantidades[prod.id]}" onchange="establecerCantidadExacta(${prod.id}, this.value)" onblur="establecerCantidadExacta(${prod.id}, this.value)">`
          }
          <button class="btn-step-main" type="button" onclick="modificarCantidad(${prod.id}, ${minimo25 ? 25 : 1})">${minimo25 ? '+25' : '+1'}</button>
        </div>
        ${esUnidad ? '' : `
        <div class="preset-row">
          <button class="btn-action" type="button" onclick="modificarCantidad(${prod.id}, 25)">+25</button>
          <button class="btn-action" type="button" onclick="modificarCantidad(${prod.id}, 50)">+50</button>
          <button class="btn-action" type="button" onclick="modificarCantidad(${prod.id}, 100)">+100</button>
        </div>`}
      </div>
    `;
    container.appendChild(card);
  });
}

function obtenerPreciosProducto(prod) {
  if (pricing && typeof pricing.obtenerPreciosProducto === 'function') return pricing.obtenerPreciosProducto(prod);

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

function calcularSubtotal(prod, cant) {
  if (pricing && typeof pricing.calcularSubtotal === 'function') {
    return pricing.calcularSubtotal(prod, cant);
  }

  if (cant <= 0) return 0;
  if (prod && prod.precio !== undefined && prod.precio !== null && !prod.precios) {
    return Number((cant * Number(prod.precio)).toFixed(2));
  }

  const precios = obtenerPreciosProducto(prod);
  const tienePaquetes = [precios.x25, precios.x50, precios.x100].some((valor) => Number(valor || 0) > 0);
  if (!tienePaquetes && prod.precio !== undefined && prod.precio !== null && Number(prod.precio) > 0) {
    return Number((cant * Number(prod.precio)).toFixed(2));
  }

  if (cant >= 75 && precios.x100 > 0) {
    return Number((cant * (precios.x100 / 100)).toFixed(2));
  }

  let total = 0;
  let restante = cant;
  const paquetes = [
    { tamano: 100, precio: precios.x100 },
    { tamano: 50, precio: precios.x50 },
    { tamano: 25, precio: precios.x25 }
  ];

  paquetes.forEach(({ tamano, precio }) => {
    if (!(precio > 0)) return;
    const cantidadPaquetes = Math.floor(restante / tamano);
    if (cantidadPaquetes > 0) {
      total += cantidadPaquetes * Number(precio);
      restante -= cantidadPaquetes * tamano;
    }
  });

  if (restante > 0) {
    if (precios.precioUnitario > 0) {
      total += restante * precios.precioUnitario;
    } else if (Number(prod.precio || 0) > 0) {
      total += restante * Number(prod.precio);
    }
  }

  return Number(total.toFixed(2));
}

function actualizarCarritoYUI() {
  persistCart();
  renderResumenCompra();
  actualizarBarraCarrito();
}

function modificarCantidad(id, delta) {
  const prod = productos.find(p => p.id === id);
  if (!prod) return;

  if (prod.categoria === 'Extras para tortas' && !hayTortaChantillySeleccionada()) {
    mostrarError('Primero selecciona una Torta Chantilly.', 'cliFotoTortaGroup');
    return;
  }

  if (requiereMinimo25(prod) && Math.abs(delta) < 25) delta = delta < 0 ? -25 : 25;

  if ([25, 50, 100].includes(Math.abs(delta))) {
    const tamano = Math.abs(delta);
    actualizarPaquete(id, tamano, delta > 0 ? 1 : -1);
  } else {
    const nueva = (Number(cantidades[id]) || 0) + delta;
    cantidades[id] = nueva < 0 ? 0 : nueva;
    paquetesPorProducto[id] = {};
  }

  const subtotal = calcularSubtotal(prod, cantidades[id]);
  const elemQty = document.getElementById(`qty-${id}`);
  const elemInput = document.getElementById(`qty-input-${id}`);
  const elemSub = document.getElementById(`subtotal-${id}`);
  if (elemQty) elemQty.innerText = cantidades[id];
  if (elemInput) elemInput.value = cantidades[id];
  if (elemSub) elemSub.innerText = `S/. ${subtotal.toFixed(2)}`;
  actualizarCarritoYUI();
}

function establecerCantidadExacta(id, valor) {
  const prod = productos.find(p => p.id === id);
  if (!prod) return;
  const cantidadIngresada = Math.max(0, Math.floor(Number(valor) || 0));
  const cantidad = requiereMinimo25(prod) && cantidadIngresada > 0
    ? Math.max(25, cantidadIngresada)
    : cantidadIngresada;
  cantidades[id] = cantidad;
  paquetesPorProducto[id] = {};
  const input = document.getElementById(`qty-input-${id}`);
  const subtotal = document.getElementById(`subtotal-${id}`);
  if (input) input.value = cantidad;
  if (subtotal) subtotal.innerText = `S/. ${calcularSubtotal(prod, cantidad).toFixed(2)}`;
  persistCart();
  renderResumenCompra();
  actualizarBarraCarrito();
}

function establecerPaquete(id, tamano) {
  const prod = productos.find(p => p.id === id);
  if (!prod) return;

  paquetesPorProducto[id] = { [tamano]: 1 };
  reconstruirCantidadDesdePaquetes(id);

  const subtotal = calcularSubtotal(prod, cantidades[id]);
  const elemQty = document.getElementById(`qty-${id}`);
  const elemSub = document.getElementById(`subtotal-${id}`);
  if (elemQty) elemQty.innerText = cantidades[id];
  if (elemSub) elemSub.innerText = `S/. ${subtotal.toFixed(2)}`;
  persistCart();
  renderResumenCompra();
  actualizarBarraCarrito();
}

function calcularTotalGlobal() {
  let total = 0;
  let bocaditos = 0;
  obtenerItemsCarrito().forEach(({ producto, cantidad }) => {
    bocaditos += cantidad;
    total += calcularSubtotal(producto, cantidad);
  });
  return { total, bocaditos };
}

function actualizarBarraCarrito() {
  const { total, bocaditos } = calcularTotalGlobal();
  document.getElementById('cartCount').innerText = `${bocaditos} ítems seleccionados`;
  document.getElementById('cartTotal').innerText = `S/. ${total.toFixed(2)}`;
}

function abrirModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function cerrarModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

function mostrarInlineError(msj, campo = null) {
  const caja = document.getElementById('checkoutErrors');
  if (!caja) {
    mostrarError(msj, campo || 'checkoutErrors');
    return;
  }
  caja.textContent = msj;
  caja.style.display = 'block';
  caja.classList.add('visible');
  if (campo) {
    const target = typeof campo === 'string' ? document.getElementById(campo) : campo;
    if (target) {
      target.classList.add('danger-flash');
      setTimeout(() => target.classList.remove('danger-flash'), 420);
    }
  }
}

function limpiarInlineError() {
  const caja = document.getElementById('checkoutErrors');
  if (caja) {
    caja.textContent = '';
    caja.style.display = 'none';
    caja.classList.remove('visible');
  }
}

function iniciarCheckout() {
  limpiarInlineError();
  const { bocaditos } = calcularTotalGlobal();
  if (bocaditos === 0) {
    mostrarInlineError('Selecciona al menos un producto antes de continuar.', 'cartCount');
    return;
  }
  const hayExtras = productos.some((producto) => producto.categoria === 'Extras para tortas' && (cantidades[producto.id] || 0) > 0);
  if (hayExtras && !hayTortaChantillySeleccionada()) {
    mostrarInlineError('Los extras deben acompañar una Torta Chantilly.', 'catalogGrid');
    return;
  }
  actualizarCampoDedicatoria();
  renderizarCarritoCheckout();
  abrirModal('modalDatos');
}

function hayTortaChantillySeleccionada() {
  return productos.some((producto) =>
    producto.categoria === 'Torta Chantilly' && (cantidades[producto.id] || 0) > 0
  );
}

function actualizarCampoDedicatoria() {
  const campo = document.getElementById('cliDedicatoria');
  if (!campo) return;
  const hayTorta = productos.some((producto) =>
    (cantidades[producto.id] || 0) > 0 && producto.categoria === 'Torta Chantilly'
  );
  campo.closest('.form-group').style.display = hayTorta ? 'block' : 'none';
  if (!hayTorta) campo.value = '';
  const fotoGroup = document.getElementById('cliFotoTortaGroup');
  const fotoInput = document.getElementById('cliFotoTorta');
  if (fotoGroup) fotoGroup.style.display = hayTorta ? 'block' : 'none';
  if (fotoInput) fotoInput.required = hayTorta;
}

function validarHorarioAtencion() {
  const fechaVal = document.getElementById('cliFecha').value;
  const horaVal = document.getElementById('cliHora').value;
  const errElem = document.getElementById('errHorario');

  if (!fechaVal || !horaVal) return false;

  const [year, month, day] = fechaVal.split('-').map(Number);
  const [hours, minutes] = horaVal.split(':').map(Number);
  const fechaObj = new Date(year, month - 1, day, hours, minutes);
  const diaSemana = fechaObj.getDay(); 
  const minutosTotales = hours * 60 + minutes;

  let esValido = false;
  if (diaSemana >= 1 && diaSemana <= 6) {
    esValido = minutosTotales >= 480 && minutosTotales <= 1199;
  } else if (diaSemana === 0) {
    esValido = minutosTotales >= 480 && minutosTotales <= 659;
  }

  if (errElem) {
    errElem.style.display = esValido ? 'none' : 'block';
  }

  const soloSandwiches = productos
    .filter((producto) => (cantidades[producto.id] || 0) > 0)
    .every((producto) => CAT_SANDWICH.includes(producto.categoria));
  const ahora = new Date();
  const fechaPedido = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const fechaSeleccionada = new Date(year, month - 1, day, hours, minutes);
  const fechaMinima = new Date(fechaPedido);
  fechaMinima.setDate(fechaMinima.getDate() + 1);
  fechaMinima.setHours(soloSandwiches ? 8 : (ahora.getHours() < 8 ? 8 : 17), soloSandwiches ? 0 : 0, 0, 0);
  const fueraDeCorte = soloSandwiches
    ? ahora.getHours() >= 22
    : ahora.getHours() >= 8;
  if (!fueraDeCorte && !soloSandwiches) fechaMinima.setHours(8, 0, 0, 0);
  const cumpleAnticipacion = fechaSeleccionada >= fechaMinima;
  const anticipacion = document.getElementById('errAnticipacion');
  if (anticipacion) {
    anticipacion.textContent = soloSandwiches
      ? 'Los pedidos de sandwichitos, triples y piqueos se atienden desde las 8:00 a. m. del día siguiente.'
      : (fueraDeCorte
        ? 'Después de las 8:00 a. m., estos pedidos pasan a prepararse desde las 5:00 p. m. del día siguiente.'
        : 'Los pedidos realizados antes de las 8:00 a. m. se atienden desde las 8:00 a. m. del día siguiente.');
    anticipacion.style.display = cumpleAnticipacion ? 'none' : 'block';
  }
  return esValido && cumpleAnticipacion;
}

function procesarDatosCliente(e) {
  e.preventDefault();
  limpiarInlineError();

  const nombre = document.getElementById('cliNombre').value.trim();
  const apellido = document.getElementById('cliApellido').value.trim();
  const telefono = document.getElementById('cliTelefono').value.trim();

  if (!nombre || !apellido || !telefono) {
    mostrarInlineError('Falta nombre, apellido o teléfono.', 'cliNombre');
    return;
  }

  if (!validarHorarioAtencion()) {
    mostrarInlineError('Elige una hora válida y respeta la anticipación mínima.', 'cliHora');
    return;
  }

  if (hayTortaChantillySeleccionada() && !fotoTortaData) {
    mostrarInlineError('Selecciona una foto de referencia para la torta Chantilly.', 'cliFotoTorta');
    return;
  }

  const { total } = calcularTotalGlobal();
  const adelanto = Number(document.getElementById('cliAdelanto').value || 0);
  if (!Number.isFinite(adelanto) || adelanto < 0 || adelanto > total) {
    mostrarInlineError('El adelanto debe ser un monto entre S/. 0.00 y el total.', 'cliAdelanto');
    return;
  }

  if (adelanto < total * 0.5) {
    mostrarInlineError('El adelanto mínimo es al menos el 50% del total.', 'cliAdelanto');
    return;
  }
  datosPedidoActual.cliente = {
    nombre: document.getElementById('cliNombre').value,
    apellido: document.getElementById('cliApellido').value,
    telefono: document.getElementById('cliTelefono').value,
    fecha: document.getElementById('cliFecha').value,
    hora: document.getElementById('cliHora').value,
    dedicatoria: document.getElementById('cliDedicatoria')?.value.trim() || '',
    foto_torta: fotoTortaData
  };
  datosPedidoActual.monto = total;
  datosPedidoActual.adelanto = adelanto;

  document.getElementById('yapeMonto').innerText = `Pagar ahora: S/. ${adelanto.toFixed(2)}`;
  document.getElementById('yapeSaldo').innerText = adelanto < total ? `Saldo al recoger: S/. ${(total - adelanto).toFixed(2)}` : 'Pedido pagado en su totalidad.';
  const qrData = encodeURIComponent(`YAPE|PASTELERIA_DCHELIS|946227035|S/.${adelanto.toFixed(2)}`);
  document.getElementById('yapeQR').src = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${qrData}`;

  cerrarModal('modalDatos');
  abrirModal('modalYape');
}

async function esperarPagoMacrodroid(codigoPedido, maxSeconds = 600) {
  const started = Date.now();
  let estado = 'Pendiente de verificación de pago';

  while (Date.now() - started < maxSeconds * 1000) {
    try {
      const respuesta = await fetch(apiUrl(`/api/pedidos/estado/${encodeURIComponent(codigoPedido)}`), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (respuesta.ok) {
        const data = await respuesta.json().catch(() => ({}));
        estado = String(data.estado || estado);
        if (estado === 'Pagado') {
          return true;
        }
      }
    } catch (error) {
      console.warn('Polling de Macrodroid pago:', error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

async function confirmarPagoYape(e) {
  e.preventDefault();

  if (yapeOrderInFlight) return;

  const form = e.currentTarget;
  const submitButton = document.getElementById('yapeSubmit');
  const codOp = document.getElementById('yapeCodigoOp').value.trim();
  if (!codOp || codOp.length < 6) {
    mostrarInlineError('Ingresa un número de operación Yape válido.', 'yapeCodigoOp');
    return;
  }

  yapeOrderInFlight = true;
  if (submitButton) submitButton.disabled = true;
  const loader = document.getElementById('yapeLoadingScreen');
  if (loader) loader.classList.add('visible');

  datosPedidoActual.codigoOperacion = codOp;
  const fechaCodigo = datosPedidoActual.cliente.fecha.replace(/-/g, '');
  const sufijoTemporal = `${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  datosPedidoActual.idPedido = `PED-${fechaCodigo}-${sufijoTemporal}`;
  datosPedidoActual.items = obtenerItemsCarrito()
    .map(({ producto, cantidad }) => ({
      nombre: producto.nombre,
      cantidad,
      subtotal: calcularSubtotal(producto, cantidad),
      paquetes: obtenerPaquetesProducto(producto.id)
    }));

  const payload = {
    codigo: datosPedidoActual.idPedido,
    tipo_cliente: 'Particular',
    cliente_nombre: `${datosPedidoActual.cliente.nombre} ${datosPedidoActual.cliente.apellido}`.trim(),
    celular: datosPedidoActual.cliente.telefono,
    monto_total: datosPedidoActual.monto,
    adelanto: datosPedidoActual.adelanto,
    metodo_pago: `Yape - operación ${codOp} (verificación pendiente)`,
    nro_operacion: codOp,
    fecha_recoge: datosPedidoActual.cliente.fecha,
    hora_recoge: datosPedidoActual.cliente.hora,
    dedicatoria: datosPedidoActual.cliente.dedicatoria || '',
    foto_torta: fotoTortaData || '',
    detalles: datosPedidoActual.items.map(({ nombre, cantidad, subtotal, paquetes }) => ({
      producto_nombre: nombre,
      cantidad,
      subtotal,
      paquetes: paquetes || {}
    }))
  };

  try {
    const response = await fetch(apiUrl('/api/pedidos'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `No se pudo guardar el pedido (${response.status}).`);
    }

    if (data.codigo) datosPedidoActual.idPedido = data.codigo;
    datosPedidoActual.dbId = data.id;

    await fetch(apiUrl('/api/macrodroid/emit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: datosPedidoActual.idPedido,
        tipo: 'explode',
        ttl: 600,
        nombre: datosPedidoActual.cliente.nombre,
        apellido: datosPedidoActual.cliente.apellido,
        telefono: datosPedidoActual.cliente.telefono,
        monto: datosPedidoActual.adelanto
      })
    }).catch(() => {});

    const yaPago = await esperarPagoMacrodroid(datosPedidoActual.idPedido, 600);
    if (!yaPago) {
      throw new Error('El cliente aún no verificó el pago con Macrodroid.');
    }

    guardarEnControlProduccion(datosPedidoActual);
    cerrarModal('modalYape');
    prepararBoletaHTML();
    abrirModal('modalFinal');
  } catch (error) {
    const ayudaApi = !API_BASE && location.hostname.endsWith('github.io')
      ? ' Esta página está en GitHub Pages y necesita configurar la URL del servidor de pedidos en config.js.'
      : '';
    alert((error.message || 'Ocurrió un error al registrar el pedido.') + ayudaApi);
  } finally {
    if (loader) loader.classList.remove('visible');
    yapeOrderInFlight = false;
    if (submitButton) submitButton.disabled = false;
  }
}

function guardarEnControlProduccion(pedido) {
  const historial = JSON.parse(localStorage.getItem('pedidos_produccion') || '[]');
  historial.push({
    ...pedido,
    estado: 'Pendiente',
    fechaRegistro: new Date().toLocaleString('es-PE')
  });
  localStorage.setItem('pedidos_produccion', JSON.stringify(historial));
}

function prepararBoletaHTML() {
  const clienteInfo = document.getElementById('boletaClienteInfo');
  const resumenVenta = document.getElementById('boletaResumenVenta');
  const itemsContainer = document.getElementById('boletaItems');
  const totalContainer = document.getElementById('boletaMontoTotal');

  if (clienteInfo) {
    clienteInfo.innerHTML = `
      <p><strong>Código:</strong> ${datosPedidoActual.idPedido}</p>
      <p><strong>Cliente:</strong> ${datosPedidoActual.cliente.nombre} ${datosPedidoActual.cliente.apellido}</p>
      <p><strong>Teléfono:</strong> ${datosPedidoActual.cliente.telefono}</p>
      <p><strong>Fecha/Hora Recojo:</strong> ${datosPedidoActual.cliente.fecha} ${datosPedidoActual.cliente.hora}</p>
       <p><strong>N° Operación Yape:</strong> ${datosPedidoActual.codigoOperacion}</p>
       ${datosPedidoActual.cliente.dedicatoria ? `<p><strong>Dedicatoria:</strong> ${datosPedidoActual.cliente.dedicatoria}</p>` : ''}
    `;
  }

  if (resumenVenta) {
    const totalBocaditos = (datosPedidoActual.items || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    resumenVenta.innerHTML = `
      <strong>Reporte de venta:</strong> ${totalBocaditos} bocaditos • ${datosPedidoActual.items.length} líneas registradas
    `;
  }

  if (itemsContainer) {
    itemsContainer.innerHTML = datosPedidoActual.items.map(it => `
      <tr>
        <td>${it.cantidad}</td>
        <td>${it.nombre}${Object.keys(it.paquetes || {}).length ? `<br><small>${Object.entries(it.paquetes).map(([tamano, cantidad]) => `${cantidad} paquete(s) de ${tamano}`).join(' + ')}</small>` : ''}</td>
        <td>S/. ${Number(it.subtotal || 0).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  if (totalContainer) {
    totalContainer.innerHTML = `Total Pagado: S/. ${datosPedidoActual.monto.toFixed(2)}`;
  }
}

async function descargarBoletaPDF() {
  if (!datosPedidoActual.items || datosPedidoActual.items.length === 0) {
    alert('No hay información del pedido para generar la boleta.');
    return;
  }

  if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
    alert('No se pudo cargar el generador de PDF. Revisa la conexión a internet y recarga la página.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margen = 14;
  const ancho = pdf.internal.pageSize.getWidth();
  const cliente = datosPedidoActual.cliente || {};
  const nombreCliente = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
  const totalBocaditos = datosPedidoActual.items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

  pdf.setTextColor(0, 92, 39);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text("PASTELERIA D'CHELIS", ancho / 2, 18, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Comprobante de pedido y confirmacion de pago', ancho / 2, 24, { align: 'center' });
  pdf.setDrawColor(0, 92, 39);
  pdf.line(margen, 28, ancho - margen, 28);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
  const datos = [
    ['Codigo:', datosPedidoActual.idPedido],
    ['Cliente:', nombreCliente],
    ['Telefono:', cliente.telefono],
    ['Fecha/Hora de recojo:', `${cliente.fecha || '-'} ${cliente.hora || ''}`],
    ['Operacion Yape:', datosPedidoActual.codigoOperacion],
    ['Dedicatoria:', cliente.dedicatoria || '-']
  ];
  let y = 37;
  datos.forEach(([etiqueta, valor]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(etiqueta, margen, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(valor || '-'), margen + 39, y);
    y += 6;
  });

  pdf.setFillColor(238, 247, 238);
  pdf.roundedRect(margen, y + 1, ancho - margen * 2, 10, 2, 2, 'F');
  pdf.setTextColor(0, 92, 39);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Reporte de venta: ${totalBocaditos} bocaditos`, margen + 4, y + 7.5);
  y += 18;

  const filas = datosPedidoActual.items.map((item) => {
    const paquetes = Object.entries(item.paquetes || {})
      .map(([tamano, cantidad]) => `${cantidad} paquete(s) de ${tamano}`)
      .join(' + ');
    return [
      String(item.cantidad || 0),
      paquetes ? `${item.nombre}\n${paquetes}` : item.nombre,
      `S/. ${Number(item.subtotal || 0).toFixed(2)}`
    ];
  });

  pdf.autoTable({
    startY: y,
    margin: { left: margen, right: margen },
    head: [['Cant.', 'Descripcion', 'Subtotal']],
    body: filas,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, textColor: [15, 23, 42] },
    headStyles: { fillColor: [238, 247, 238], textColor: [0, 92, 39], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 20, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 30, halign: 'right' } }
  });

  const finalY = pdf.lastAutoTable.finalY + 10;
  pdf.setTextColor(0, 92, 39);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(`Total pagado: S/. ${Number(datosPedidoActual.monto || 0).toFixed(2)}`, ancho - margen, finalY, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Presente esta boleta al retirar su pedido. Muchas gracias por su preferencia.', ancho / 2, 286, { align: 'center' });
  pdf.save(`Boleta_${datosPedidoActual.idPedido}.pdf`);
}

function cerrarTodoYReiniciar() {
  cantidades = {};
  paquetesPorProducto = {};
  datosPedidoActual = {};
  fotoTortaData = '';
  const fotoInput = document.getElementById('cliFotoTorta');
  const fotoPreview = document.getElementById('cliFotoTortaPreview');
  if (fotoInput) fotoInput.value = '';
  if (fotoPreview) {
    fotoPreview.src = '';
    fotoPreview.style.display = 'none';
  }
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  renderizarCatalogo();
  actualizarBarraCarrito();
}
