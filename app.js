/**
 * LexiLectura - Módulo principal de carga, renderizado e interacción
 */

// Estado global de la aplicación
let obraActiva = null;
let nivelLecturaActual = 'short'; // 'short' o 'deep'

// ==========================================
// 1. CARGA DEL CATÁLOGO Y DESPLEGABLE
// ==========================================

async function cargarMenuObras() {
  const select = document.getElementById('selector-obras');
  if (!select) return;

  try {
    const response = await fetch('catalogo.json');
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    
    const catalogo = await response.json();

    select.innerHTML = '<option value="">-- Cargar obra anotada --</option>';

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

// ==========================================
// 2. RENDERIZADO PRINCIPAL DE LA OBRA
// ==========================================

function renderizarTextoAnotado(datosObra) {
  if (!datosObra) return;
  obraActiva = datosObra;

  // 2.1 Actualizar Metadatos en la Cabecera
  const docTitle = document.getElementById('doc-title');
  const docAuthor = document.getElementById('doc-author');
  const docPeriod = document.getElementById('doc-period');
  const docYear = document.getElementById('doc-year');

  if (docTitle) docTitle.textContent = datosObra.meta?.title || 'Sin título';

  if (docAuthor) {
    const autorNombre = datosObra.meta?.author || '';
    const autorNodo = datosObra.meta?.authorNodeId;
    docAuthor.innerHTML = autorNodo 
      ? `<span class="meta-link" data-node="${autorNodo}" tabindex="0" role="button">${autorNombre}</span>` 
      : autorNombre;
  }

  if (docPeriod) {
    const periodoNombre = datosObra.meta?.period || '';
    const periodoNodo = datosObra.meta?.periodNodeId;
    docPeriod.innerHTML = periodoNombre 
      ? ` | <span class="meta-link" data-node="${periodoNodo}" tabindex="0" role="button">${periodoNombre}</span>` 
      : (periodoNombre ? ` | ${periodoNombre}` : '');
  }

  if (docYear) {
    docYear.textContent = datosObra.meta?.year ? ` (${datosObra.meta.year})` : '';
  }

  // 2.2 Sincronizar el Textarea si está vacío o difiere
  const jsonInput = document.getElementById('json-input');
  if (jsonInput) {
    jsonInput.value = JSON.stringify(datosObra, null, 2);
  }

  // 2.3 Renderizar Filtros de Categorías / Capas
  renderizarFiltrosCategorias(datosObra);

  // 2.4 Renderizar Estrofas en #text-stanzas
  const contenedorEstrofas = document.getElementById('text-stanzas');
  if (!contenedorEstrofas) return;

  contenedorEstrofas.innerHTML = '';

  if (Array.isArray(datosObra.stanzas) && datosObra.stanzas.length > 0) {
    datosObra.stanzas.forEach(estrofaHtml => {
      const estrofaDiv = document.createElement('div');
      estrofaDiv.className = 'estrofa-block';
      estrofaDiv.innerHTML = estrofaHtml;
      contenedorEstrofas.appendChild(estrofaDiv);
    });
  } else {
    contenedorEstrofas.innerHTML = '<p class="empty-state">No hay estrofas disponibles en esta obra.</p>';
  }
}

function renderizarFiltrosCategorias(datosObra) {
  const bar = document.getElementById('category-filter-bar');
  if (!bar) return;
  bar.innerHTML = '';

  if (Array.isArray(datosObra.layers)) {
    datosObra.layers.forEach(layer => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary filter-chip active';
      btn.style.borderColor = layer.color || '#ccc';
      btn.textContent = layer.label || layer.layerId;
      btn.dataset.layerId = layer.layerId;

      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        // Alternar visibilidad visual de las marcas de esta capa
        const spans = document.querySelectorAll(`[data-layer="${layer.layerId}"]`);
        spans.forEach(span => span.classList.toggle('layer-disabled', !btn.classList.contains('active')));
      });

      bar.appendChild(btn);
    });
  }
}

// ==========================================
// 3. GESTIÓN DE LA VENTANA MODAL Y NIVELES
// ==========================================

function abrirModalAnotacion(datosNodo) {
  const modal = document.getElementById('annotation-modal');
  if (!modal || !datosNodo) return;

  // Categoria y Título
  const modalCat = document.getElementById('modal-category');
  const modalTitle = document.getElementById('modal-title');
  if (modalCat) modalCat.textContent = datosNodo.category || datosNodo.type || 'Anotación';
  if (modalTitle) modalTitle.textContent = datosNodo.title || datosNodo.label || '';

  // Definición y Contenido según el nivel seleccionado (short / deep)
  const anotacion = datosNodo.annotations?.[nivelLecturaActual] || datosNodo.annotations?.short || {};
  const modalDef = document.getElementById('modal-definition');
  const modalContent = document.getElementById('modal-content');

  if (modalDef) modalDef.innerHTML = anotacion.definition || '';
  if (modalContent) modalContent.innerHTML = anotacion.content || '';

  // Imagen
  const imgWrapper = document.getElementById('modal-image-wrapper');
  const img = document.getElementById('modal-image');
  const imgCaption = document.getElementById('modal-image-caption');

  if (datosNodo.imageSearchQuery || datosNodo.imageDescription) {
    if (imgWrapper) imgWrapper.classList.remove('hidden');
    if (imgCaption) imgCaption.textContent = datosNodo.imageDescription || '';
    if (img) {
      // Si tienes URL directa o búsqueda
      if (datosNodo.imageUrl) {
        img.src = datosNodo.imageUrl;
        img.style.display = 'block';
      } else {
        img.style.display = 'none';
      }
      img.alt = datosNodo.imageDescription || 'Imagen ilustrativa';
    }
  } else if (imgWrapper) {
    imgWrapper.classList.add('hidden');
  }

  // Enlaces externos (Wikipedia)
  const modalLinks = document.getElementById('modal-links');
  if (modalLinks) {
    if (datosNodo.wikipediaArticle) {
      const wikiLang = datosNodo.wikiLang || 'es';
      const wikiUrl = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(datosNodo.wikipediaArticle)}`;
      modalLinks.innerHTML = `<a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Ver en Wikipedia ↗</a>`;
      modalLinks.classList.remove('hidden');
    } else {
      modalLinks.classList.add('hidden');
    }
  }

  // Mostrar modal
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function cerrarModal() {
  const modal = document.getElementById('annotation-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}

// ==========================================
// 4. INICIALIZACIÓN DE EVENTOS DEL DOM
// ==========================================

function inicializarEventos() {
  // Selector de Obras (Select)
  const selectObras = document.getElementById('selector-obras');
  if (selectObras) {
    selectObras.addEventListener('change', async (e) => {
      const ruta = e.target.value;
      if (!ruta) return;
      try {
        const res = await fetch(ruta);
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        const data = await res.json();
        renderizarTextoAnotado(data);
      } catch (err) {
        console.error('Error al cargar la obra seleccionada:', err);
      }
    });
  }

  // Botón "Renderizar Obra" (desde Textarea)
  const btnLoadJson = document.getElementById('btn-load-json');
  if (btnLoadJson) {
    btnLoadJson.addEventListener('click', () => {
      const jsonInput = document.getElementById('json-input');
      if (!jsonInput || !jsonInput.value.trim()) {
        alert('Por favor, pega una estructura JSON en el cuadro de texto.');
        return;
      }
      try {
        const data = JSON.parse(jsonInput.value);
        renderizarTextoAnotado(data);
      } catch (e) {
        alert('Error de sintaxis en el JSON. Revisa el formato pegado.');
        console.error(e);
      }
    });
  }

  // Botón "Limpiar"
  const btnClearJson = document.getElementById('btn-clear-json');
  if (btnClearJson) {
    btnClearJson.addEventListener('click', () => {
      const jsonInput = document.getElementById('json-input');
      if (jsonInput) jsonInput.value = '';
      const stanzas = document.getElementById('text-stanzas');
      if (stanzas) stanzas.innerHTML = '<p class="loading-state">Carga una obra pegando el JSON arriba o usando el desplegable.</p>';
      obraActiva = null;
    });
  }

  // Cambio de Nivel de Lectura (short / deep)
  const levelBtns = document.querySelectorAll('.level-btn');
  const levelBadge = document.getElementById('levelIndicatorBadge');

  levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      levelBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');

      nivelLecturaActual = btn.dataset.level || 'short';

      if (levelBadge) {
        if (nivelLecturaActual === 'deep') {
          levelBadge.textContent = 'Modo Edición Crítica';
          levelBadge.className = 'level-badge deep-mode';
        } else {
          levelBadge.textContent = 'Modo Lectura Básica';
          levelBadge.className = 'level-badge short-mode';
        }
      }
    });
  });

  // Delegación de eventos para Nodos Interactivos (Clics en texto y cabecera)
  document.addEventListener('click', (e) => {
    const targetNodo = e.target.closest('[data-node]');
    if (!targetNodo) return;

    const nodeId = targetNodo.getAttribute('data-node');
    if (!nodeId || !obraActiva || !obraActiva.interactiveNodes) return;

    const datosNodo = obraActiva.interactiveNodes[nodeId];
    if (datosNodo) {
      abrirModalAnotacion(datosNodo);
    }
  });

  // Eventos para cerrar la Modal
  const modalCloseBtn = document.getElementById('modal-close-btn');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', cerrarModal);

  const modalOverlay = document.getElementById('annotation-modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) cerrarModal();
    });
  }
}

// ==========================================
// 5. INICIO DE LA APLICACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  cargarMenuObras();
  inicializarEventos();
});  } catch (error) {
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
