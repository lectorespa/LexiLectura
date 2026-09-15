/**
 * LexiLectura - Módulo principal de carga, renderizado e interacción
 */

// Estado global de la obra activa para acceso rápido desde eventos
let obraActiva = null;

// ==========================================
// 1. CARGA DEL CATÁLOGO Y SELECTOR DE OBRAS
// ==========================================

async function cargarMenuObras() {
  const select = document.getElementById('selector-obras');
  if (!select) return;

  try {
    const response = await fetch('catalogo.json');
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    
    const catalogo = await response.json();

    select.innerHTML = '<option value="">-- Selecciona una obra --</option>';

    catalogo.forEach(item => {
      const option = document.createElement('option');
      const nombreArchivo = typeof item === 'string' ? item : item.archivo;
      const tituloDisplay = typeof item === 'string' ? item.replace(/\.json$/i, '') : item.titulo;

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
      renderizarTextoAnotado(datosObraAnotada);

    } catch (error) {
      console.error(`Error al cargar la obra desde ${rutaArchivo}:`, error);
    }
  });
}

// ==========================================
// 2. RENDERIZADO DEL TEXTO Y METADATOS
// ==========================================

function renderizarTextoAnotado(datosObra) {
  const contenedor = document.getElementById('visor-texto');
  if (!contenedor) {
    console.error('No se encontró el elemento #visor-texto en el DOM.');
    return;
  }

  // Guardar referencia en el estado
  obraActiva = datosObra;

  // Limpiar contenido previo
  contenedor.innerHTML = '';

  // 2.1 Cabecera y Metadatos (meta)
  if (datosObra.meta) {
    const header = document.createElement('header');
    header.className = 'obra-header';

    const titulo = document.createElement('h1');
    titulo.className = 'obra-titulo';
    titulo.textContent = datosObra.meta.title || 'Título no especificado';
    header.appendChild(titulo);

    const metaInfo = document.createElement('div');
    metaInfo.className = 'obra-meta-info';
    
    const partesMeta = [];
    if (datosObra.meta.author) {
      partesMeta.push(`<span class="meta-link" data-node="${datosObra.meta.authorNodeId || ''}" tabindex="0" role="button">${datosObra.meta.author}</span>`);
    }
    if (datosObra.meta.period) {
      partesMeta.push(`<span class="meta-link" data-node="${datosObra.meta.periodNodeId || ''}" tabindex="0" role="button">${datosObra.meta.period}</span>`);
    }
    if (datosObra.meta.year) {
      partesMeta.push(`<span>${datosObra.meta.year}</span>`);
    }
    metaInfo.innerHTML = partesMeta.join(' | ');
    header.appendChild(metaInfo);

    if (datosObra.meta.audioUrl) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = datosObra.meta.audioUrl;
      audio.className = 'obra-audio';
      header.appendChild(audio);
    }

    contenedor.appendChild(header);
  }

  // 2.2 Cuerpo del Texto y Estrofas (stanzas)
  const cuerpoTexto = document.createElement('article');
  cuerpoTexto.className = 'obra-cuerpo';

  if (Array.isArray(datosObra.stanzas) && datosObra.stanzas.length > 0) {
    datosObra.stanzas.forEach(estrofaHtml => {
      const estrofaContainer = document.createElement('div');
      estrofaContainer.className = 'estrofa';
      estrofaContainer.innerHTML = estrofaHtml;
      cuerpoTexto.appendChild(estrofaContainer);
    });
  } else {
    const mensajeVacio = document.createElement('p');
    mensajeVacio.className = 'obra-vacia';
    mensajeVacio.textContent = 'Esta obra no contiene estrofas disponibles.';
    cuerpoTexto.appendChild(mensajeVacio);
  }

  contenedor.appendChild(cuerpoTexto);
}

// ==========================================
// 3. GESTIÓN DE EVENTOS E INTERACCIÓN
// ==========================================

function inicializarEventosVisor() {
  const contenedor = document.getElementById('visor-texto');
  if (!contenedor) return;

  // Manejo centralizado de clics (Delegación de eventos)
  contenedor.addEventListener('click', (event) => {
    procesarInteraccionNodo(event.target);
  });

  // Manejo de accesibilidad mediante teclado (Enter / Espacio)
  contenedor.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (procesarInteraccionNodo(event.target)) {
        event.preventDefault();
      }
    }
  });
}

function procesarInteraccionNodo(targetElement) {
  const elementoAnotado = targetElement.closest('[data-node]');
  if (!elementoAnotado) return false;

  const nodeId = elementoAnotado.getAttribute('data-node');
  if (!nodeId || !obraActiva || !obraActiva.interactiveNodes) return false;

  const datosNodo = obraActiva.interactiveNodes[nodeId];

  if (datosNodo) {
    mostrarDetalleAnotacion(datosNodo);
    return true;
  } else {
    console.warn(`No se encontró configuración para el nodo: "${nodeId}"`);
    return false;
  }
}

function mostrarDetalleAnotacion(datosNodo) {
  // Conectar con el panel lateral o modal de la interfaz
  console.log('Nodo interactivo seleccionado:', datosNodo);
}

// ==========================================
// 4. CICLO DE VIDA DEL DOM
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  cargarMenuObras();
  inicializarEventosSelector();
  inicializarEventosVisor(); // Inicializa la escucha de eventos una sola vez
});
