/**
 * LexiLectura - Módulo principal de carga, renderizado e interacción
 */

// Estado global
let obraActiva = null;
let nivelLecturaActual = 'short';

// ==========================================
// DICCIONARIO Y NORMALIZACIÓN DE CAPAS
// ==========================================

const CAPAS_CATALOGO = {
  author:     { id: 'author',     label: 'Autoría',                  color: '#8E44AD' },
  period:     { id: 'period',     label: 'Época y Contexto',         color: '#2980B9' },
  vocabulary: { id: 'vocabulary', label: 'Vocabulario',              color: '#F39C12' },
  culture:    { id: 'culture',    label: 'Cultura y Sociedad',        color: '#27AE60' },
  syntax:     { id: 'syntax',     label: 'Métrica y Sintaxis',        color: '#E67E22' },
  analysis:   { id: 'analysis',   label: 'Análisis e Interpretación', color: '#C0392B' }
};

// Aliases para resolver nombres en español o identificadores legacy
const ALIAS_CAPAS = {
  'autor': 'author', 'autoría': 'author', 'autoria': 'author',
  'periodo': 'period', 'época': 'period', 'epoca': 'period', 'contexto': 'period', 'época y contexto': 'period',
  'vocabulario': 'vocabulary', 'vocabulario_lexico': 'vocabulary', 'léxico': 'vocabulary', 'lexico': 'vocabulary',
  'cultura': 'culture', 'sociedad': 'culture', 'cultura y sociedad': 'culture',
  'sintaxis': 'syntax', 'métrica': 'syntax', 'metrica': 'syntax', 'métrica_retorica': 'syntax', 'metrica_retorica': 'syntax', 'métrica y sintaxis': 'syntax', 'recursos': 'syntax',
  'análisis': 'analysis', 'analisis': 'analysis', 'interpretación': 'analysis', 'interpretacion': 'analysis', 'análisis e interpretación': 'analysis'
};

function resolverCapa(val) {
  if (!val) return null;
  const str = String(val).trim().toLowerCase();
  const key = ALIAS_CAPAS[str] || str;
  return CAPAS_CATALOGO[key] || { id: key, label: String(val), color: '#4A90E2' };
}

// JSON de ejemplo por si catalogo.json o el servidor fallan
const EJEMPLO_JSON = {
  "meta": {
    "title": "Cantar de mio Cid (Fragmento)",
    "author": "Anónimo",
    "authorNodeId": "node_author",
    "period": "Medieval",
    "periodNodeId": "node_period",
    "year": "1200",
    "lang": "es"
  },
  "interactiveNodes": {
    "node_author": {
      "type": "author",
      "category": "Autor",
      "title": "Autor Anónimo",
      "annotations": {
        "short": { "definition": "Autor desconocido del Mío Cid.", "content": "Obra cumbre del cantar de gesta hispánico." },
        "deep": { "definition": "Tradición juglaresca mester de juglaría.", "content": "Composición de transmisión oral preservada en manuscrito." }
      }
    },
    "node_1": {
      "type": "syntax",
      "category": "Sintaxis",
      "title": "De los sus ojos",
      "annotations": {
        "short": { "definition": "Pleonasmo emotivo.", "content": "Enfatiza el dolor del desierto y el destierro." },
        "deep": { "definition": "Fórmula juglaresca épica.", "content": "Recurso expresivo para cautivar a la audiencia mediante la emoción visual." }
      }
    }
  },
  "stanzas": [
    "<p>De los sus ojos <span class=\"interactive-word\" data-node=\"node_1\" tabindex=\"0\" role=\"button\">tan fuemente llorando</span>,<br>tornaba la cabeza i estábalos mirando.</p>"
  ]
};

// ==========================================
// 1. CARGA DEL CATÁLOGO
// ==========================================

async function cargarMenuObras() {
  const select = document.getElementById('selector-obras');
  if (!select) return;

  try {
    const response = await fetch('catalogo.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: No se encontró catalogo.json en la raíz`);
    }
    
    let catalogo = await response.json();

    if (!Array.isArray(catalogo)) {
      catalogo = catalogo.obras || catalogo.catalogo || catalogo.items || [];
    }

    if (!Array.isArray(catalogo) || catalogo.length === 0) {
      select.innerHTML = '<option value="">-- Catálogo vacío o formato no válido --</option>';
      return;
    }

    select.innerHTML = '<option value="">-- Selecciona una obra --</option>';

    catalogo.forEach(item => {
      const option = document.createElement('option');
      const nombreArchivo = typeof item === 'string' ? item : (item.archivo || item.url || item.file);
      const tituloDisplay = typeof item === 'string' ? item.replace(/\.json$/i, '') : (item.titulo || item.title || nombreArchivo);

      if (!nombreArchivo) return;

      const rutaRelativa = nombreArchivo.startsWith('textos/') 
        ? nombreArchivo 
        : `textos/${nombreArchivo}`;

      option.value = rutaRelativa;
      option.textContent = tituloDisplay;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error al cargar catalogo.json:', error);
    select.innerHTML = `<option value="">-- Error: ${error.message} --</option>`;
  }
}


// Botones de selección masiva de categorías
const btnSelectAll = document.getElementById('btn-select-all-cats');
const btnDeselectAll = document.getElementById('btn-deselect-all-cats');

if (btnSelectAll) {
  btnSelectAll.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-chip').forEach(btn => {
      btn.classList.add('active');
      btn.style.opacity = '1';
      alternarVisibilidadCapa(btn.dataset.layerId, true);
    });
  });
}

if (btnDeselectAll) {
  btnDeselectAll.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-chip').forEach(btn => {
      btn.classList.remove('active');
      btn.style.opacity = '0.4';
      alternarVisibilidadCapa(btn.dataset.layerId, false);
    });
  });
}

// ==========================================
// 2. RENDERIZADO DE LA OBRA Y FILTROS
// ==========================================

function renderizarTextoAnotado(datosObra) {
  if (!datosObra) return;
  obraActiva = datosObra;

  // 2.1 Metadatos
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

  // 2.2 Textarea
  const jsonInput = document.getElementById('json-input');
  if (jsonInput && document.activeElement !== jsonInput) {
    jsonInput.value = JSON.stringify(datosObra, null, 2);
  }

  // 2.3 Generar Filtros de Categorías
  renderizarFiltrosCategorias(datosObra);

  // 2.4 Estrofas
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

  const capasPresentes = new Map();

  // Escanea interactiveNodes para extraer y resolver todas las categorías activas
  if (datosObra.interactiveNodes) {
    Object.values(datosObra.interactiveNodes).forEach(nodo => {
      const capaObj = resolverCapa(nodo.type || nodo.category || nodo.layerId || nodo.layer);
      if (capaObj && !capasPresentes.has(capaObj.id)) {
        capasPresentes.set(capaObj.id, capaObj);
      }
    });
  }

  // Compatibilidad con la propiedad legacy "layers"
  if (Array.isArray(datosObra.layers)) {
    datosObra.layers.forEach(l => {
      const capaObj = resolverCapa(l.layerId || l.id || l.label);
      if (capaObj && !capasPresentes.has(capaObj.id)) {
        capasPresentes.set(capaObj.id, capaObj);
      }
    });
  }

  if (capasPresentes.size === 0) return;

  // Renderizar botones en la barra de filtros
  capasPresentes.forEach((capa) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary filter-chip active';
    btn.style.borderLeft = `4px solid ${capa.color}`;
    btn.textContent = capa.label;
    btn.dataset.layerId = capa.id;

    btn.addEventListener('click', () => {
      const isActive = btn.classList.toggle('active');
      btn.style.opacity = isActive ? '1' : '0.4';
      alternarVisibilidadCapa(capa.id, isActive);
    });

    bar.appendChild(btn);
  });
}

function alternarVisibilidadCapa(capaId, visible) {
  if (!obraActiva) return;

  const elementos = document.querySelectorAll('[data-node]');
  elementos.forEach(el => {
    const nodeId = el.getAttribute('data-node');
    const nodo = obraActiva.interactiveNodes?.[nodeId];
    
    const rawCapa = el.getAttribute('data-layer') || nodo?.type || nodo?.category || nodo?.layerId || nodo?.layer;
    const capaObj = resolverCapa(rawCapa);
    
    if (capaObj?.id === capaId || rawCapa === capaId) {
      el.classList.toggle('layer-disabled', !visible);
    }
  });
}

// ==========================================
// 3. MODAL DE ANOTACIONES (Imagen y Vídeos)
// ==========================================

function abrirModalAnotacion(datosNodo) {
  const modal = document.getElementById('annotation-modal');
  if (!modal || !datosNodo) return;

  const modalCat = document.getElementById('modal-category');
  const modalTitle = document.getElementById('modal-title');
  
  const capaObj = resolverCapa(datosNodo.type || datosNodo.category);
  if (modalCat) modalCat.textContent = capaObj ? capaObj.label : (datosNodo.category || datosNodo.type || 'Anotación');
  if (modalTitle) modalTitle.textContent = datosNodo.title || datosNodo.label || '';

  const anotacion = datosNodo.annotations?.[nivelLecturaActual] || datosNodo.annotations?.short || {};
  const modalDef = document.getElementById('modal-definition');
  const modalContent = document.getElementById('modal-content');

  if (modalDef) modalDef.innerHTML = anotacion.definition || '';
  if (modalContent) modalContent.innerHTML = anotacion.content || '';

  // 3.1 Procesar Imagen
  const imgWrapper = document.getElementById('modal-image-wrapper');
  const imgElem = document.getElementById('modal-image') || imgWrapper?.querySelector('img');
  const imgCaption = document.getElementById('modal-image-caption') || imgWrapper?.querySelector('figcaption, p');

  const urlImagen = datosNodo.imageUrl || datosNodo.image || datosNodo.mediaUrl || datosNodo.img || anotacion.imageUrl || anotacion.image;
  const captionImagen = datosNodo.imageCaption || datosNodo.caption || datosNodo.alt || anotacion.imageCaption || '';

  if (imgWrapper && urlImagen) {
    if (imgElem) imgElem.src = urlImagen;
    if (imgCaption) imgCaption.textContent = captionImagen;
    imgWrapper.classList.remove('hidden');
  } else if (imgWrapper) {
    imgWrapper.classList.add('hidden');
  }

  // 3.2 Procesar Enlaces (YouTube y Wikipedia)
  const modalLinks = document.getElementById('modal-links');
  if (modalLinks) {
    let htmlEnlaces = '';

    // YouTube
    const youtubeRef = datosNodo.youtubeUrl || datosNodo.youtube || datosNodo.videoUrl || datosNodo.youtubeId || anotacion.youtubeUrl || anotacion.youtube;
    if (youtubeRef) {
      let urlYt = youtubeRef;
      if (!urlYt.startsWith('http://') && !urlYt.startsWith('https://')) {
        urlYt = `https://www.youtube.com/watch?v=${youtubeRef}`;
      }
      htmlEnlaces += `<a href="${urlYt}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary youtube-link">▶ Ver en YouTube ↗</a> `;
    }

    // Wikipedia
    const wikiRef = datosNodo.wikipediaArticle || datosNodo.wikiUrl || datosNodo.wikipedia || anotacion.wikipediaArticle;
    if (wikiRef) {
      let urlWiki = wikiRef;
      if (!urlWiki.startsWith('http://') && !urlWiki.startsWith('https://')) {
        const wikiLang = datosNodo.wikiLang || 'es';
        urlWiki = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(wikiRef)}`;
      }
      htmlEnlaces += `<a href="${urlWiki}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary wiki-link">🌐 Ver en Wikipedia ↗</a>`;
    }

    if (htmlEnlaces.trim() !== '') {
      modalLinks.innerHTML = htmlEnlaces;
      modalLinks.classList.remove('hidden');
    } else {
      modalLinks.classList.add('hidden');
    }
  }

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
// 4. EVENTOS DE BOTONES E INTERFAZ
// ==========================================

function inicializarEventos() {
  // Selector desplegable
  const selectObras = document.getElementById('selector-obras');
  if (selectObras) {
    selectObras.addEventListener('change', async (e) => {
      const ruta = e.target.value;
      if (!ruta) return;
      try {
        const res = await fetch(ruta);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderizarTextoAnotado(data);
      } catch (err) {
        alert(`No se pudo cargar el archivo "${ruta}". Revisa que exista en la carpeta /textos/.`);
        console.error(err);
      }
    });
  }

  // Botón "Renderizar Obra"
  const btnLoadJson = document.getElementById('btn-load-json');
  if (btnLoadJson) {
    btnLoadJson.addEventListener('click', () => {
      const jsonInput = document.getElementById('json-input');
      if (!jsonInput || !jsonInput.value.trim()) {
        alert('Pega un JSON válido en el cuadro de texto antes de renderizar.');
        return;
      }
      try {
        const data = JSON.parse(jsonInput.value);
        renderizarTextoAnotado(data);
      } catch (e) {
        alert('El texto pegado contiene errores de sintaxis JSON.');
        console.error(e);
      }
    });
  }

  // Botón "Cargar Ejemplo"
  const btnSampleJson = document.getElementById('btn-sample-json');
  if (btnSampleJson) {
    btnSampleJson.addEventListener('click', () => {
      renderizarTextoAnotado(EJEMPLO_JSON);
    });
  }

  // Botón "Limpiar"
  const btnClearJson = document.getElementById('btn-clear-json');
  if (btnClearJson) {
    btnClearJson.addEventListener('click', () => {
      const jsonInput = document.getElementById('json-input');
      if (jsonInput) jsonInput.value = '';
      const stanzas = document.getElementById('text-stanzas');
      if (stanzas) stanzas.innerHTML = '<p class="loading-state">Carga una obra usando el desplegable o pegando un JSON.</p>';
      obraActiva = null;
    });
  }

  // Selector de Nivel (Básica / Crítica)
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
        levelBadge.textContent = nivelLecturaActual === 'deep' ? 'Modo Edición Crítica' : 'Modo Lectura Básica';
        levelBadge.className = `level-badge ${nivelLecturaActual}-mode`;
      }
    });
  });

  // Delegación de clics para nodos interactivos
  document.addEventListener('click', (e) => {
    const targetNodo = e.target.closest('[data-node]');
    if (!targetNodo) return;

    const nodeId = targetNodo.getAttribute('data-node');
    if (!nodeId || !obraActiva || !obraActiva.interactiveNodes) return;

    const datosNodo = obraActiva.interactiveNodes[nodeId];
    if (datosNodo) abrirModalAnotacion(datosNodo);
  });

  // Eventos Modal
  const modalCloseBtn = document.getElementById('modal-close-btn');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', cerrarModal);

  const modalOverlay = document.getElementById('annotation-modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) cerrarModal();
    });
  }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  cargarMenuObras();
  inicializarEventos();
});
