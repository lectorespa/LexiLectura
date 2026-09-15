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


/**
 * Renderiza una obra en el DOM basándose en el esquema JSON multicapa de LexiLectura
 * @param {Object} datosObra - Objeto JSON con meta, stanzas e interactiveNodes
 */
function renderizarTextoAnotado(datosObra) {
  const contenedor = document.getElementById('visor-texto'); // Asegúrate de que este ID coincida con tu HTML
  if (!contenedor) {
    console.error('No se encontró el contenedor principal (#visor-texto).');
    return;
  }

  // 1. Limpieza del contenedor
  contenedor.innerHTML = '';

  // 2. Renderizado de Cabecera y Metadatos (meta)
  if (datosObra.meta) {
    const header = document.createElement('header');
    header.className = 'obra-header';

    const titulo = document.createElement('h1');
    titulo.className = 'obra-titulo';
    titulo.textContent = datosObra.meta.title || 'Sin título';
    header.appendChild(titulo);

    // Subtítulo con autor, período y año (con vinculación a sus nodos interactivos)
    const metaInfo = document.createElement('div');
    metaInfo.className = 'obra-meta-info';
    
    let htmlMeta = '';
    if (datosObra.meta.author) {
      htmlMeta += `<span class="meta-link" data-node="${datosObra.meta.authorNodeId}">${datosObra.meta.author}</span>`;
    }
    if (datosObra.meta.period) {
      htmlMeta += ` | <span class="meta-link" data-node="${datosObra.meta.periodNodeId}">${datosObra.meta.period}</span>`;
    }
    if (datosObra.meta.year) {
      htmlMeta += ` (${datosObra.meta.year})`;
    }
    metaInfo.innerHTML = htmlMeta;
    header.appendChild(metaInfo);

    // Reproductor de audio si existe audioUrl
    if (datosObra.meta.audioUrl) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = datosObra.meta.audioUrl;
      audio.className = 'obra-audio';
      header.appendChild(audio);
    }

    contenedor.appendChild(header);
  }

  // 3. Renderizado del Texto y Estrofas (stanzas)
  const cuerpoTexto = document.createElement('article');
  cuerpoTexto.className = 'obra-cuerpo';

  if (Array.isArray(datosObra.stanzas)) {
    datosObra.stanzas.forEach(estrofaHtml => {
      const estrofaContainer = document.createElement('div');
      estrofaContainer.className = 'estrofa';
      // Inyección del HTML de la estrofa (contiene los spans interactivos)
      estrofaContainer.innerHTML = estrofaHtml;
      cuerpoTexto.appendChild(estrofaContainer);
    });
  }

  contenedor.appendChild(cuerpoTexto);

  // 4. Delegación de eventos para la interacción con los nodos anotados
  inicializarEventosNodos(contenedor, datosObra);
}

/**
 * Escucha los clics en elementos anotados y recupera la información del nodo interactivo
 */
function inicializarEventosNodos(contenedor, datosObra) {
  contenedor.addEventListener('click', (event) => {
    const elementoAnotado = event.target.closest('[data-node]');
    if (!elementoAnotado) return;

    const nodeId = elementoAnotado.getAttribute('data-node');
    const datosNodo = datosObra.interactiveNodes?.[nodeId];

    if (datosNodo) {
      mostrarDetalleAnotacion(datosNodo);
    } else {
      console.warn(`No se encontraron datos para el nodo: ${nodeId}`);
    }
  });
}

/**
 * Función encargada de desplegar la anotación en tu panel lateral o modal
 */
function mostrarDetalleAnotacion(datosNodo) {
  // Conecta este punto con el panel lateral de tu interfaz (por ejemplo, actualizando el DOM de un sidebar)
  console.log('Información del nodo seleccionado:', datosNodo);
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
