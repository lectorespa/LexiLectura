/**
 * LexiLectura - Módulo de carga del catálogo y selección de obras
 */

// 1. Carga catalogo.json y puebla el elemento <select id="selector-obras">
async function cargarMenuObras() {
  const select = document.getElementById('selector-obras');
  if (!select) return;

  try {
    const response = await fetch('catalogo.json');
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    
    const catalogo = await response.json();

    // Resetear el selector manteniendo la opción por defecto
    select.innerHTML = '<option value="">-- Selecciona una obra --</option>';

    catalogo.forEach(item => {
      const option = document.createElement('option');
      
      // Soporta cadenas ("obra1.json") u objetos ({ titulo: "...", archivo: "..." })
      const nombreArchivo = typeof item === 'string' ? item : item.archivo;
      const tituloDisplay = typeof item === 'string' ? item.replace(/\.json$/i, '') : item.titulo;

      // Garantiza la ruta relativa hacia la carpeta /textos/
      const rutaRelativa = nombreArchivo.startsWith('textos/') 
        ? nombreArchivo 
        : `textos/${nombreArchivo}`;

      option.value = rutaRelativa;
      option.textContent = tituloDisplay;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error al obtener catalogo.json:', error);
  }
}

// 2. Escucha la selección de una obra y la envía al visor de textos
function inicializarEventosSelector() {
  const select = document.getElementById('selector-obras');
  if (!select) return;

  select.addEventListener('change', async (event) => {
    const rutaArchivo = event.target.value;
    if (!rutaArchivo) return;

    try {
      const response = await fetch(rutaArchivo);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      
      const datosObraAnotada = await response.json();
      
      // Llamada al visor: asegura que el nombre coincida con tu función de renderizado
      if (typeof renderizarTextoAnotado === 'function') {
        renderizarTextoAnotado(datosObraAnotada);
      } else {
        console.warn('La función de renderizado (renderizarTextoAnotado) no está definida aún.');
      }

    } catch (error) {
      console.error(`Error al cargar la obra desde ${rutaArchivo}:`, error);
    }
  });
}

// 3. Asignación al ciclo de vida del DOM
document.addEventListener('DOMContentLoaded', () => {
  cargarMenuObras();
  inicializarEventosSelector();
});
