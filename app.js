/**
 * Visor de Ediciones Críticas e Interactivas - Lógica Principal con Motor de Imágenes Avanzado
 */

// URL de la función desplegada en Vercel / backend
const BACKEND_URL = 'https://lexi-lectura.vercel.app/api/generar';

let obraActiva = null;
let nivelLecturaActual = 'short';
let currentImageFetchController = null;
const activeLayersSet = new Set(); // Estado global de capas activas

const CAPAS_CATALOGO = {
  author:     { id: 'author',     label: 'Autoría',                  color: '#8E44AD' },
  period:     { id: 'period',     label: 'Época y Contexto',         color: '#2980B9' },
  vocabulary: { id: 'vocabulary', label: 'Vocabulario',              color: '#F39C12' },
  culture:    { id: 'culture',    label: 'Cultura y Sociedad',        color: '#27AE60' },
  syntax:     { id: 'syntax',     label: 'Métrica y Sintaxis',        color: '#E67E22' },
  analysis:   { id: 'analysis',   label: 'Análisis e Interpretación', color: '#C0392B' }
};

const ALIAS_CAPAS = {
  'autor': 'author', 'autoría': 'author', 'autoria': 'author',
  'periodo': 'period', 'época': 'period', 'epoca': 'period', 'contexto': 'period', 'época y contexto': 'period',
  'vocabulario': 'vocabulary', 'vocabulario_lexico': 'vocabulary', 'léxico': 'vocabulary', 'lexico': 'vocabulary',
  'cultura': 'culture', 'sociedad': 'culture', 'cultura y sociedad': 'culture',
  'cultura_sociedad': 'culture', 'simbologia_contexto': 'culture', 'simbología_contexto': 'culture',
  'sintaxis': 'syntax', 'métrica': 'syntax', 'metrica': 'syntax', 'métrica_retorica': 'syntax', 'metrica_retorica': 'syntax',
  'análisis': 'analysis', 'analisis': 'analysis', 'interpretación': 'analysis'
};

function resolverCapa(val) {
  if (!val) return null;
  const str = String(val).trim().toLowerCase();
  const key = ALIAS_CAPAS[str] || str;
  return CAPAS_CATALOGO[key] || { id: key, label: String(val), color: '#4A90E2' };
}

const STOPWORDS = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","en","con",
  "por","para","que","al","lo","y","o","a","e","i","su","sus","es","son",
  "se","si","no","muy","más","menos","como","cuando","donde","cual",
  "cuyo","cuya","cuyos","cuyas","este","esta","estos","estas","ese","esa",
  "esos","esas","aquel","aquella","aquellos","aquellas","aquello",
  "mío","tuyo","suyo","nuestro","vuestro","me","te","le","nos","os","les",
  "mi","tu","ha","han","fue","ser","era","será","the","of","in","on","at","with","and","or","an"
]);

// Estructura integrada con soporte para data-nodes y data-layers
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
      "category": "author",
      "title": "Autor Anónimo",
      "wikipediaArticle": "Cantar_de_mio_Cid",
      "visualConceptType": "artwork",
      "imageSearchQuery": "Cantar de mio Cid manuscrito",
      "annotations": {
        "short": { "definition": "Autor desconocido del Mío Cid.", "content": "Obra cumbre del cantar de gesta hispánico." },
        "deep": { "definition": "Tradición juglaresca mester de juglaría.", "content": "Composición de transmisión oral preservada en manuscrito." }
      }
    },
    "node_period": {
      "type": "period",
      "category": "period",
      "title": "Contexto Medieval (Siglo XII-XIII)",
      "wikipediaArticle": "Literatura_espa%C3%B1ola_del_Medievo",
      "visualConceptType": "landscape",
      "imageSearchQuery": "Reconquista Espana mapa medieval",
      "annotations": {
        "short": { "definition": "Época de consolidación del castellano.", "content": "Contexto de Reconquista y difusión oral por medio de la juglaría." },
        "deep": { "definition": "Mester de juglaría y sociedad feudal.", "content": "Refleja los valores de honor, lealtad y vasallaje propios de la Edad Media hispánica." }
      }
    },
    "node_1": {
      "type": "syntax",
      "category": "syntax",
      "title": "De los sus ojos",
      "youtubeSearchQuery": "Pleonasmo recursos literarios Mio Cid",
      "annotations": {
        "short": { "definition": "Pleonasmo emotivo.", "content": "Enfatiza el dolor del desierto y el destierro." },
        "deep": { "definition": "Fórmula juglaresca épica.", "content": "Recurso expresivo para cautivar a la audiencia mediante la emoción visual." }
      }
    },
    "node_sintaxis": {
      "type": "syntax",
      "category": "syntax",
      "title": "Paredro sintáctico / Hipérbaton",
      "annotations": {
        "short": { "definition": "Estructura sintáctica bimembre.", "content": "Explicación de la estructura sintáctica de la frase y alteración del orden habitual." },
        "deep": { "definition": "Recurso retórico estilístico.", "content": "Análisis profundo de la alteración sintáctica orientada al ritmo de recitación épica." }
      }
    },
    "node_vocab": {
      "type": "vocabulary",
      "category": "vocabulary",
      "title": "Llorando (Glosario)",
      "annotations": {
        "short": { "definition": "Expresión del llanto en la épica.", "content": "Definición del verbo y notas léxicas del Cantar." },
        "deep": { "definition": "Semántica del llanto heroico.", "content": "Uso del léxico del llanto para humanizar al héroe en el mester de juglaría." }
      }
    },
    "node_vocab_1": {
      "type": "vocabulary",
      "category": "vocabulary",
      "title": "Tornar la cabeza",
      "annotations": {
        "short": { "definition": "Girar la mirada atrás.", "content": "Nota léxica sobre la expresión de despedida y nostalgia." },
        "deep": { "definition": "Expresión idiomatica medieval.", "content": "Gesto expresivo que representa el desapego físico de la patria." }
      }
    },
    "node_cultura_2": {
      "type": "culture",
      "category": "culture",
      "title": "Gesto del héroe",
      "annotations": {
        "short": { "definition": "Simbolismo del dolor del héroe.", "content": "Nota sobre la gestualidad en la épica medieval y el llanto público." },
        "deep": { "definition": "Antropología de las emociones medievales.", "content": "Manifestación exteriorizada del honor mancillado según los códigos feudales." }
      }
    }
  },
  "stanzas": [
    "<p><span class=\"interactive-word\" data-nodes=\"node_1 node_sintaxis node_vocab\" data-layers=\"syntax vocabulary\" tabindex=\"0\" role=\"button\">De los sus ojos tan fuemente llorando</span>,<br><span class=\"interactive-word\" data-nodes=\"node_vocab_1 node_cultura_2\" data-layers=\"vocabulary culture\" tabindex=\"0\" role=\"button\">tornaba la cabeza i estábalos mirando</span>.</p>"
  ]
};

// =========================================================================
//  LÓGICA DE VISIBILIDAD DE CAPAS
// =========================================================================

function renderActiveLayers(activeLayersSet) {
  const words = document.querySelectorAll('.interactive-word, [data-node], [data-nodes]');

  words.forEach(word => {
    const rawLayers = word.dataset.layers || word.dataset.layer || word.getAttribute('data-category') || '';
    const wordLayers = rawLayers.trim().split(/\s+/).map(l => {
      const resolved = resolverCapa(l);
      return resolved ? resolved.id : l;
    });

    const hasActiveLayer = wordLayers.some(layer => activeLayersSet.has(layer));

    if (hasActiveLayer) {
      word.classList.remove('layer-disabled');
      word.classList.add('is-highlighted');

      const primaryLayer = wordLayers.find(layer => activeLayersSet.has(layer)) || wordLayers[0];
      const capaObj = resolverCapa(primaryLayer);
      if (capaObj) {
        word.style.setProperty('--current-layer-color', capaObj.color);
      }
    } else {
      word.classList.add('layer-disabled');
      word.classList.remove('is-highlighted');
    }
  });
}

function alternarVisibilidadCapa(capaId, visible) {
  if (visible) {
    activeLayersSet.add(capaId);
  } else {
    activeLayersSet.delete(capaId);
  }
  renderActiveLayers(activeLayersSet);
}

function aplicarFiltroVocabularioPorNivel() {
  if (!obraActiva) return;

  const nodosVocabulario = document.querySelectorAll('[data-category="vocabulary"], [data-layers*="vocabulary"]');

  nodosVocabulario.forEach(el => {
    const nodeIds = (el.getAttribute('data-nodes') || el.getAttribute('data-node') || '').trim().split(/\s+/);
    let vocabLevel = el.getAttribute('data-vocab-level');
    if (!vocabLevel) {
      for (const id of nodeIds) {
        const nodoCandidato = obraActiva.interactiveNodes?.[id];
        if (nodoCandidato?.vocabLevel) {
          vocabLevel = nodoCandidato.vocabLevel;
          break;
        }
      }
    }
    vocabLevel = vocabLevel || 'B1';

    if (nivelLecturaActual === 'deep') {
      if (vocabLevel === 'B1' || vocabLevel === 'B2') {
        el.classList.add('vocab-hidden-in-deep');
      } else {
        el.classList.remove('vocab-hidden-in-deep');
      }
    } else {
      el.classList.remove('vocab-hidden-in-deep');
    }
  });
}

async function cargarMenuObras() {
  const select = document.getElementById('selector-obras');
  if (!select) return;

  try {
    const response = await fetch('catalogo.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    let catalogo = await response.json();
    if (!Array.isArray(catalogo)) {
      catalogo = catalogo.obras || catalogo.catalogo || catalogo.items || [];
    }

    if (catalogo.length === 0) return;

    select.innerHTML = '<option value="">-- Selecciona una obra --</option>';
    catalogo.forEach(item => {
      const option = document.createElement('option');
      const nombreArchivo = typeof item === 'string' ? item : (item.archivo || item.url || item.file);
      const tituloDisplay = typeof item === 'string' ? item.replace(/\.json$/i, '') : (item.titulo || item.title || nombreArchivo);

      if (!nombreArchivo) return;
      const rutaRelativa = nombreArchivo.startsWith('textos/') ? nombreArchivo : `textos/${nombreArchivo}`;

      option.value = rutaRelativa;
      option.textContent = tituloDisplay;
      select.appendChild(option);
    });
  } catch (error) {
    console.warn('No se pudo cargar catalogo.json automáticamente.');
  }
}

function renderizarTextoAnotado(datosObra) {
  if (!datosObra) return;
  obraActiva = datosObra;
  activeLayersSet.clear();

  const docTitle = document.getElementById('doc-title');
  const docAuthor = document.getElementById('doc-author');
  const docPeriod = document.getElementById('doc-period');
  const docYear = document.getElementById('doc-year');

  if (docTitle) docTitle.textContent = datosObra.meta?.title || 'Sin título';

  if (docAuthor) {
    const autorNombre = datosObra.meta?.author || '';
    const autorNodo = datosObra.meta?.authorNodeId;
    docAuthor.innerHTML = autorNodo 
      ? `<span class="meta-link" data-node="${autorNodo}" data-category="author" tabindex="0" role="button">${autorNombre}</span>` 
      : autorNombre;
  }

  if (docPeriod) {
    const periodoNombre = datosObra.meta?.period || '';
    const periodoNodo = datosObra.meta?.periodNodeId;
    docPeriod.innerHTML = periodoNombre 
      ? ` | <span class="meta-link" data-node="${periodoNodo}" data-category="period" tabindex="0" role="button">${periodoNombre}</span>` 
      : (periodoNombre ? ` | ${periodoNombre}` : '');
  }

  if (docYear) {
    docYear.textContent = datosObra.meta?.year ? ` (${datosObra.meta.year})` : '';
  }

  const jsonInput = document.getElementById('json-input');
  if (jsonInput) {
    jsonInput.value = JSON.stringify(datosObra, null, 2);
  }

  renderizarFiltrosCategorias(datosObra);

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

    contenedorEstrofas.querySelectorAll('[data-node], [data-nodes]').forEach(el => {
      const rawNodes = el.getAttribute('data-nodes') || el.getAttribute('data-node') || '';
      const nodeIds = rawNodes.trim().split(/\s+/);

      const capasEncontradas = new Set();
      nodeIds.forEach(id => {
        const nodo = datosObra.interactiveNodes?.[id];
        if (nodo) {
          const capaObj = resolverCapa(nodo.type || nodo.category);
          if (capaObj) capasEncontradas.add(capaObj.id);
        }
      });

      if (capasEncontradas.size > 0) {
        el.setAttribute('data-layers', Array.from(capasEncontradas).join(' '));
      }
    });
  } else {
    contenedorEstrofas.innerHTML = '<p class="empty-state">No hay estrofas disponibles en esta estructura.</p>';
  }

  if (datosObra.interactiveNodes) {
    Object.values(datosObra.interactiveNodes).forEach(nodo => {
      const capaObj = resolverCapa(nodo.type || nodo.category);
      if (capaObj) activeLayersSet.add(capaObj.id);
    });
  }
  renderActiveLayers(activeLayersSet);
  aplicarFiltroVocabularioPorNivel();
}

function renderizarFiltrosCategorias(datosObra) {
  const bar = document.getElementById('category-filter-bar');
  if (!bar) return;
  bar.innerHTML = '';

  const capasPresentes = new Map();

  if (datosObra.interactiveNodes) {
    Object.values(datosObra.interactiveNodes).forEach(nodo => {
      const capaObj = resolverCapa(nodo.type || nodo.category);
      if (capaObj && !capasPresentes.has(capaObj.id)) {
        capasPresentes.set(capaObj.id, capaObj);
      }
    });
  }

  capasPresentes.forEach((capa) => {
    const btn = document.createElement('button');
    btn.className = 'btn filter-chip active';
    btn.textContent = capa.label;
    btn.dataset.layerId = capa.id;
    btn.dataset.category = capa.id;
    btn.style.borderColor = capa.color;

    btn.addEventListener('click', () => {
      const isActive = btn.classList.toggle('active');
      btn.classList.toggle('inactive', !isActive);
      alternarVisibilidadCapa(capa.id, isActive);
    });

    bar.appendChild(btn);
  });
}

async function abrirModalAnotacion(datosNodo) {
  const modal = document.getElementById('annotation-modal');
  if (!modal || !datosNodo) return;

  if (currentImageFetchController) {
    currentImageFetchController.abort();
  }
  currentImageFetchController = new AbortController();

  const modalCat = document.getElementById('modal-category');
  const modalTitle = document.getElementById('modal-title');
  
  const capaObj = resolverCapa(datosNodo.type || datosNodo.category);
  const colorCategoria = capaObj ? capaObj.color : '#4A90E2';

  if (modalCat) {
    modalCat.textContent = capaObj ? capaObj.label : (datosNodo.category || 'Anotación');
    modalCat.setAttribute('data-category', capaObj?.id || '');
    modalCat.style.backgroundColor = colorCategoria;
    modalCat.style.color = '#FFFFFF';
    modalCat.style.padding = '4px 8px';
    modalCat.style.borderRadius = '4px';
  }
  if (modalTitle) {
    modalTitle.textContent = datosNodo.title || '';
    modalTitle.style.color = colorCategoria;
  }

  const anotacion = datosNodo.annotations?.[nivelLecturaActual] || datosNodo.annotations?.short || {
    definition: datosNodo.text || '',
    content: datosNodo.text || ''
  };

  const modalDef = document.getElementById('modal-definition');
  const modalContent = document.getElementById('modal-content');

  if (modalDef) modalDef.innerHTML = anotacion.definition || '';
  if (modalContent) {
    modalContent.innerHTML = anotacion.content || '';
    modalContent.style.borderLeft = `3px solid ${colorCategoria}`;
    modalContent.style.paddingLeft = '10px';
  }

  showImagePlaceholder("Buscando y cargando imagen representativa...");

  const modalLinks = document.getElementById('modal-links');
  if (modalLinks) {
    let htmlEnlaces = '';
    const wikiRef = datosNodo.wikipediaArticle || datosNodo.wikipedia;
    if (wikiRef) {
      let urlWiki = wikiRef.startsWith('http') ? wikiRef : `https://${datosNodo.wikiLang || obraActiva?.meta?.lang || 'es'}.wikipedia.org/wiki/${encodeURIComponent(wikiRef)}`;
      htmlEnlaces += `<a href="${urlWiki}" target="_blank" rel="noopener noreferrer" class="link-item wiki-link">🌐 Más información en Wikipedia ↗</a>`;
    }

    let urlYoutube = datosNodo.youtubeUrl;
    if (!urlYoutube && datosNodo.youtubeSearchQuery) {
      urlYoutube = `https://www.youtube.com/results?search_query=${encodeURIComponent(datosNodo.youtubeSearchQuery)}`;
    }

    if (urlYoutube) {
      htmlEnlaces += `<a href="${urlYoutube}" target="_blank" rel="noopener noreferrer" class="link-item youtube-link" style="color: #FF0000; font-weight: bold; margin-left: 10px;">📺 Más información en YouTube ↗</a>`;
    }

    if (htmlEnlaces !== '') {
      modalLinks.innerHTML = htmlEnlaces;
      modalLinks.classList.remove('hidden');
    } else {
      modalLinks.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  await resolveAndDisplayImage(datosNodo, currentImageFetchController.signal);
}

function cerrarModal() {
  if (currentImageFetchController) {
    currentImageFetchController.abort();
    currentImageFetchController = null;
  }
  const modal = document.getElementById('annotation-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}

// =========================================================================
//  GESTIÓN DE CLICS CON CAPAS SOLAPADAS O ANIDADAS
// =========================================================================

document.addEventListener('click', (e) => {
  if (e.target.closest('#annotation-modal') || e.target.closest('.overlap-selector-popup')) {
    return;
  }

  const target = e.target.closest('.interactive-word, [data-node], [data-nodes], .meta-link');
  if (!target) {
    cerrarSelectorSolapamiento();
    return;
  }

  const rawNodeIds = target.dataset.nodes || target.dataset.node || target.getAttribute('data-node') || '';
  const nodeIds = rawNodeIds.trim().split(/\s+/).filter(Boolean);

  cerrarSelectorSolapamiento();

  if (nodeIds.length === 0) return;

  if (nodeIds.length === 1) {
    const nodo = obraActiva?.interactiveNodes?.[nodeIds[0]];
    if (nodo) abrirModalAnotacion(nodo);
  } else {
    const nodosDetectados = nodeIds
      .map(id => ({ id, data: obraActiva?.interactiveNodes?.[id] }))
      .filter(item => item.data !== undefined);

    if (nodosDetectados.length === 1) {
      abrirModalAnotacion(nodosDetectados[0].data);
    } else if (nodosDetectados.length > 1) {
      mostrarMenuSolapamiento(nodosDetectados, e.clientX, e.clientY);
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cerrarSelectorSolapamiento();
  }
});

function mostrarMenuSolapamiento(nodos, x, y) {
  cerrarSelectorSolapamiento();

  const popup = document.createElement('div');
  popup.className = 'overlap-selector-popup';
  popup.style.position = 'fixed';
  popup.style.zIndex = '9999';
  popup.style.background = '#FFFFFF';
  popup.style.border = '1px solid #CCC';
  popup.style.borderRadius = '8px';
  popup.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  popup.style.padding = '8px 0';
  popup.style.minWidth = '220px';
  popup.style.maxWidth = '320px';

  const title = document.createElement('div');
  title.style.padding = '4px 12px 8px 12px';
  title.style.fontSize = '11px';
  title.style.fontWeight = 'bold';
  title.style.color = '#666';
  title.style.textTransform = 'uppercase';
  title.style.borderBottom = '1px solid #EEE';
  title.style.marginBottom = '4px';
  title.textContent = 'Selecciona la capa a consultar:';
  popup.appendChild(title);

  nodos.forEach(item => {
    const capaObj = typeof resolverCapa === 'function' ? resolverCapa(item.data.type || item.data.category) : null;
    const btn = document.createElement('button');
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.padding = '8px 12px';
    btn.style.border = 'none';
    btn.style.background = 'transparent';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '13px';
    btn.style.lineHeight = '1.3';
    
    const badgeColor = capaObj?.color || '#4A90E2';
    btn.innerHTML = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${badgeColor}; margin-right:8px; flex-shrink:0;"></span>
                     <div>
                       <span style="font-size:11px; color:#777; display:block;">${capaObj?.label || 'Anotación'}</span>
                       <strong>${item.data.title || item.id}</strong>
                     </div>`;

    btn.addEventListener('mouseenter', () => btn.style.background = '#F0F4F8');
    btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      cerrarSelectorSolapamiento();
      abrirModalAnotacion(item.data);
    });

    popup.appendChild(btn);
  });

  document.body.appendChild(popup);

  const rect = popup.getBoundingClientRect();
  let posX = x + 10;
  let posY = y + 10;

  if (posX + rect.width > window.innerWidth) {
    posX = Math.max(10, x - rect.width - 5);
  }
  if (posY + rect.height > window.innerHeight) {
    posY = Math.max(10, y - rect.height - 5);
  }

  popup.style.left = `${posX}px`;
  popup.style.top = `${posY}px`;
}

function cerrarSelectorSolapamiento() {
  const prev = document.querySelector('.overlap-selector-popup');
  if (prev) prev.remove();
}

// =========================================================================
//  MOTOR DE BÚSQUEDA, FILTRADO Y GESTIÓN DE IMÁGENES
// =========================================================================

function showImagePlaceholder(message = "Cargando imagen...") {
  const modalImgWrapper = document.getElementById('modal-image-wrapper');
  const modalImg = document.getElementById('modal-image');
  const modalCaption = document.getElementById('modal-image-caption');

  if (!modalImgWrapper) return;
  modalImgWrapper.classList.remove('hidden');
  modalImgWrapper.classList.add('is-loading');
  
  if (modalImg) {
    modalImg.style.display = 'none';
    modalImg.src = '';
  }
  if (modalCaption) {
    modalCaption.textContent = message;
  }
}

function preloadImage(src, signal = null) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error("URL inválida"));
    
    const img = new Image();
    const onAbort = () => {
      img.src = '';
      reject(new Error("Carga abortada"));
    };

    if (signal) {
      if (signal.aborted) return reject(new Error("Carga abortada"));
      signal.addEventListener('abort', onAbort, { once: true });
    }

    img.onload = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve(src);
    };

    img.onerror = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error("Error al descargar la imagen"));
    };

    img.src = src;
  });
}

async function showImageWithPreload(src, caption, sourceBadge = null, signal = null) {
  const modalImgWrapper = document.getElementById('modal-image-wrapper');
  const modalImg = document.getElementById('modal-image');
  const modalCaption = document.getElementById('modal-image-caption');

  try {
    await preloadImage(src, signal);
    if (signal && signal.aborted) return;

    if (modalImgWrapper && modalImg) {
      modalImgWrapper.classList.remove('is-loading');
      modalImg.src = src;
      modalImg.alt = caption || 'Imagen representativa';
      modalImg.style.display = 'block';

      if (modalCaption) {
        const badgeText = sourceBadge ? `[${sourceBadge}] ` : '';
        modalCaption.textContent = `${badgeText}${caption || ''}`;
      }
    }
  } catch (err) {
    if (!signal || !signal.aborted) {
      showNoImageAvailable();
    }
  }
}

function showNoImageAvailable() {
  const modalImgWrapper = document.getElementById('modal-image-wrapper');
  const modalImg = document.getElementById('modal-image');
  const modalCaption = document.getElementById('modal-image-caption');

  if (modalImgWrapper) {
    modalImgWrapper.classList.remove('is-loading', 'hidden');
  }
  if (modalImg) {
    modalImg.src = '';
    modalImg.style.display = 'none';
  }
  if (modalCaption) {
    modalCaption.textContent = 'No se ha encontrado ninguna imagen suficientemente relacionada con esta anotación.';
  }
}

function extractKeywords(query, maxN = 3) {
  if (!query) return [];
  const words = query.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s,;]+/)
    .filter(w => w.length > 2)
    .filter(w => !STOPWORDS.has(w))
    .filter(w => !/^\d+$/.test(w));
  const seen = new Set();
  return words.filter(w => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  }).slice(0, maxN);
}

function normalizeMediaTitle(title) {
  if (!title) return "";
  return title.replace(/^File:/i, "").replace(/\.[a-zA-Z0-9]{2,5}$/, "").replace(/_/g, " ");
}

function isMapOrDiagram(str) {
  if (!str) return false;
  const s = str.toLowerCase();
  const mapKeywords = [
    'map', 'mapa', 'location', 'locator', 'ubicacion', 'situacion', 
    'posicion', 'in_spain', 'in_espana', 'in_castile', 'provincias_de', 
    'provinces_of', 'administrative', 'locator_map', 'outline', 'vector',
    'espana_loc', 'spain_loc', 'municipio', 'comarca', 'plan of', 'chart',
    'harbour', 'nautical', 'survey', 'cadastral', 'atlas', 'cartography',
    'topographical', 'portolan', 'diagram', 'route', 'plano'
  ];
  return mapKeywords.some(kw => s.includes(kw));
}

function isDocumentOrScan(str) {
  if (!str) return false;
  const s = str.toLowerCase();
  const docKeywords = [
    'cover', 'binding', 'encuadernacion', 'manuscrito', 'manuscript', 
    'page', 'folio', 'scan', 'book', 'libro', 'tapa', 'lomo', 'hoja', 
    'document', 'archival', 'paper', 'papel', 'text', 'texto', 'frontispiece',
    'title_page', 'codex', 'incunabula'
  ];
  return docKeywords.some(kw => s.includes(kw));
}

function isFaunaFloraOrMacro(str) {
  if (!str) return false;
  const s = str.toLowerCase();
  const biologicalKeywords = [
    'flower', 'flor', 'flores', 'macro', 'close-up', 'closeup', 'plant', 
    'planta', 'leaf', 'hoja', 'thistle', 'cardo', 'echinops', 'bloom', 
    'botanical', 'pollen', 'petal', 'petalo', 'stem', 'tallo', 'specimen',
    'fauna', 'animal', 'reptile', 'reptil', 'lizard', 'lagartija', 'lagarto',
    'lacerta', 'psammodromus', 'gecko', 'snake', 'serpiente', 'bird', 'pajaro', 
    'ave', 'insect', 'insecto', 'beetle', 'escarabajo', 'butterfly', 'mariposa', 
    'wildlife', 'caterpillar', 'oruga', 'wasp', 'avispa', 'bee', 'abeja'
  ];
  return biologicalKeywords.some(kw => s.includes(kw));
}

function isUnrelatedGeography(str, targetLocation = null) {
  if (!str) return false;
  const s = str.toLowerCase();

  const foreignGeographies = [
    'portugal', 'portuguese', 'porto', 'lisboa', 'alentejo', 'algarve',
    'italy', 'italia', 'italian', 'france', 'francia', 'french',
    'greece', 'grecia', 'turkey', 'turquia', 'morocco', 'marruecos',
    'mexico', 'argentina', 'chile', 'peru', 'brazil', 'brasil'
  ];

  return foreignGeographies.some(geo => s.includes(geo));
}

function isValidForConceptType(identifier, conceptType, targetLocation = null) {
  if (!identifier) return false;
  const lower = identifier.toLowerCase();

  if (isDocumentOrScan(lower)) return false;

  if (conceptType === 'landscape') {
    if (isMapOrDiagram(lower)) return false;
    if (isFaunaFloraOrMacro(lower)) return false;
    if (isUnrelatedGeography(lower, targetLocation)) return false;

    const portraitKeywords = ['portrait', 'retrato', 'man', 'woman', 'profile', 'face', 'bust'];
    if (portraitKeywords.some(kw => lower.includes(kw))) return false;

  } else if (conceptType === 'artwork') {
    if (isMapOrDiagram(lower)) return false;

  } else if (conceptType === 'portrait' || conceptType === 'author') {
    if (isMapOrDiagram(lower)) return false;
    if (isFaunaFloraOrMacro(lower)) return false;

    const nonPortraitKeywords = ['landscape', 'paisaje', 'flag', 'bandera', 'coat of arms', 'escudo'];
    if (nonPortraitKeywords.some(kw => lower.includes(kw))) return false;
  }

  return true;
}

function pickRelevant(candidates, query, conceptType = null, targetLocation = null) {
  const queryTokens = extractKeywords(query, 20);
  
  if (targetLocation) {
    const locLower = targetLocation.toLowerCase();
    const locMatch = candidates.find(c => {
      const normTitle = normalizeMediaTitle(c.title || "").toLowerCase();
      const fullRef = `${normTitle} ${c.url || ''}`;
      return normTitle.includes(locLower) && isValidForConceptType(fullRef, conceptType, targetLocation);
    });
    if (locMatch) return locMatch;
  }

  for (const c of candidates) {
    const normTitle = normalizeMediaTitle(c.title || "");
    const fullRef = `${normTitle} ${c.url || ''}`;

    if (!isValidForConceptType(fullRef, conceptType, targetLocation)) continue;
    if (queryTokens.length === 0) return c;

    const titleTokens = new Set(extractKeywords(normTitle, 20));
    if (queryTokens.some(t => titleTokens.has(t))) return c;
  }

  if (conceptType) {
    return candidates.find(c => isValidForConceptType(`${c.title || ''} ${c.url || ''}`, conceptType, targetLocation)) || null;
  }

  return candidates[0] || null;
}

async function fetchWikipediaRestImage(title, lang, conceptType = null, targetLocation = null, signal = null) {
  if (!title) return null;
  const cleanTitle = title.trim().replace(/\s+/g, '_');
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`;
  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.type === 'disambiguation') return null;
    
    const src = data.originalimage?.source || data.thumbnail?.source;
    if (!src) return null;

    if (!isValidForConceptType(`${src} ${data.title || ''}`, conceptType, targetLocation)) return null;

    return { url: src, source: `Wikipedia (${lang.toUpperCase()})`, title: data.title };
  } catch (e) {
    return null;
  }
}

async function fetchWikipediaAllImages(article, lang, conceptType = null, targetLocation = null, signal = null) {
  if (!article) return [];
  const cleanTitle = article.trim().replace(/\s+/g, '_');
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", prop: "images", titles: cleanTitle, imlimit: "20"
  });
  try {
    const resp = await fetch(`${api}?${params}`, { signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    const page = Object.values(data.query?.pages || {})[0];
    if (!page || !page.images) return [];

    const forbidden = ["logo","icon","commons","wiki","button","flag","coat_of_arms","p_phoneme","red_pog","symbol"];
    const titles = page.images.map(img => img.title)
      .filter(t => !/\.(svg|ogg|ogv|pdf|tif|tiff)$/i.test(t))
      .filter(t => !forbidden.some(b => t.toLowerCase().includes(b)))
      .filter(t => isValidForConceptType(t, conceptType, targetLocation));

    const results = [];
    for (const t of titles.slice(0, 8)) {
      if (signal && signal.aborted) break;
      const imgUrl = await fetchCommonsFilePath(t, signal);
      if (imgUrl && isValidForConceptType(imgUrl, conceptType, targetLocation)) {
        results.push({ url: imgUrl, source: `Wikipedia Images (${lang.toUpperCase()})`, title: t });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

async function fetchCommonsFilePath(fileTitle, signal = null) {
  const api = "https://commons.wikimedia.org/w/api.php";
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", titles: fileTitle, prop: "imageinfo", iiprop: "url", iiurlwidth: "500"
  });
  try {
    const resp = await fetch(`${api}?${params}`, { signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    const page = Object.values(data.query?.pages || {})[0];
    return page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || null;
  } catch (e) {
    return null;
  }
}

async function commonsFullTextSearch(query, conceptType = null, signal = null) {
  if (!query) return [];
  const api = "https://commons.wikimedia.org/w/api.php";
  
  let queryExtension = "-filetype:pdf -incategory:\"Books\"";
  if (conceptType === 'landscape') {
    queryExtension += " -incategory:\"Maps\" -incategory:\"Charts\" -incategory:\"Flora\" -incategory:\"Flowers\" -incategory:\"Plants\" -incategory:\"Fauna\" -incategory:\"Animals\" -incategory:\"Reptiles\" -incategory:\"Insects\" -incategory:\"Macro photography\"";
  } else if (conceptType === 'artwork') {
    queryExtension += " -incategory:\"Maps\" -incategory:\"Charts\" -incategory:\"Plans\"";
  } else if (conceptType === 'portrait' || conceptType === 'author') {
    queryExtension += " -incategory:\"Maps\" -incategory:\"Flora\" -incategory:\"Fauna\"";
  }

  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", 
    gsrsearch: `${query} ${queryExtension}`,
    gsrnamespace: "6", gsrlimit: "10", prop: "imageinfo", iiprop: "url|mime|size", iiurlwidth: "500"
  });
  try {
    const resp = await fetch(`${api}?${params}`, { signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    const pages = Object.values(data.query?.pages || {});
    return pages
      .filter(p => p.imageinfo && p.imageinfo[0])
      .filter(p => {
        const ii = p.imageinfo[0];
        if (!(ii.mime || "").startsWith("image/")) return false;
        const title = (p.title || "").toLowerCase();
        const bad = ["logo","icon","button","arrow","commons-logo","wiki","flag","coat_of_arms"];
        return !bad.some(b => title.includes(b));
      })
      .map(p => ({
        url: p.imageinfo[0].thumburl || p.imageinfo[0].url,
        source: "Wikimedia Commons",
        title: p.title
      }));
  } catch (e) {
    return [];
  }
}

async function openverseSearch(query, signal = null) {
  if (!query) return [];
  try {
    const resp = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=10`, { signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || []).map(r => ({
      url: r.url,
      source: "Openverse",
      title: r.title || ""
    }));
  } catch (e) {
    return [];
  }
}

async function resolveAndDisplayImage(nodeData, signal = null) {
  const captionText = nodeData.imageCaption || nodeData.imageDescription || nodeData.caption || nodeData.label || nodeData.title || '';
  const categoryKey = nodeData.category || nodeData.type;
  const conceptType = nodeData.visualConceptType || (categoryKey === 'author' ? 'portrait' : null);
  const locationAnchor = nodeData.locationAnchor || null;

  const directUrl = nodeData.imageUrl || nodeData.image || (nodeData.media && nodeData.media.type === 'image' ? nodeData.media.url : null);
  if (directUrl && typeof directUrl === 'string' && directUrl.trim() !== '') {
    await showImageWithPreload(directUrl, captionText, "Enlace directo", signal);
    return;
  }

  const primaryLang = nodeData.wikiLang || obraActiva?.meta?.lang || 'es';
  const wikiArticle = nodeData.wikipediaArticle || nodeData.wikiArticle || nodeData.wiki;

  if (wikiArticle) {
    let res = await fetchWikipediaRestImage(wikiArticle, primaryLang, conceptType, locationAnchor, signal);
    if (signal && signal.aborted) return;
    if (res && isTechnicallyValidImage(res.url)) {
      await showImageWithPreload(res.url, captionText || res.title, res.source, signal);
      return;
    }

    if (primaryLang !== 'en') {
      res = await fetchWikipediaRestImage(wikiArticle, 'en', conceptType, locationAnchor, signal);
      if (signal && signal.aborted) return;
      if (res && isTechnicallyValidImage(res.url)) {
        await showImageWithPreload(res.url, captionText || res.title, res.source, signal);
        return;
      }
    }

    const internalImgs = await fetchWikipediaAllImages(wikiArticle, primaryLang, conceptType, locationAnchor, signal);
    if (signal && signal.aborted) return;
    if (internalImgs.length > 0) {
      await showImageWithPreload(internalImgs[0].url, captionText || internalImgs[0].title, internalImgs[0].source, signal);
      return;
    }
  }

  const searchQuery = nodeData.imageSearchQuery || '';
  const keywords = Array.isArray(nodeData.imageVisualKeywords) ? nodeData.imageVisualKeywords : [];

  let queries = [];
  if (conceptType === 'portrait' || conceptType === 'author') {
    const personName = (categoryKey === 'author' && obraActiva?.meta?.author)
      ? obraActiva.meta.author
      : (nodeData.title || nodeData.label || searchQuery);
    queries = [
      `${personName} portrait`,
      `${personName} painting`,
      `${personName} engraving`,
      searchQuery
    ];
  } else {
    const locationPrefix = locationAnchor ? `${locationAnchor} ` : '';
    queries = [
      searchQuery,
      `${locationPrefix}${extractKeywords(searchQuery, 3).join(" ")}`,
      keywords[0] ? `${locationPrefix}${keywords[0]}` : null,
      keywords[1] ? `${locationPrefix}${keywords[1]}` : null
    ];
  }

  queries = queries.filter(q => q && typeof q === 'string' && q.trim().length > 0);

  for (const q of queries) {
    if (signal && signal.aborted) return;
    const candidates = await commonsFullTextSearch(q, conceptType, signal);
    const match = pickRelevant(candidates, searchQuery || q, conceptType, locationAnchor);
    if (match && isTechnicallyValidImage(match.url)) {
      await showImageWithPreload(match.url, captionText || match.title, match.source, signal);
      return;
    }
  }

  for (const q of queries) {
    if (signal && signal.aborted) return;
    const candidates = await openverseSearch(q, signal);
    const match = pickRelevant(candidates, searchQuery || q, conceptType, locationAnchor);
    if (match && isTechnicallyValidImage(match.url)) {
      await showImageWithPreload(match.url, captionText || match.title, match.source, signal);
      return;
    }
  }

  if (!signal || !signal.aborted) {
    showNoImageAvailable();
  }
}

function isTechnicallyValidImage(url) {
  if (!url || typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();
  const forbiddenExtensions = ['.svg', '.pdf', '.tiff', '.djvu'];
  const forbiddenTerms = ['commons-logo', 'wikinews-logo', 'symbol_question', 'edit-clear', 'icon', 'logo_of', 'p_phoneme'];

  if (forbiddenExtensions.some(ext => lowerUrl.endsWith(ext))) return false;
  if (forbiddenTerms.some(term => lowerUrl.includes(term))) return false;
  return true;
}

// =========================================================================
//  ANOTACIÓN CON IA — robusta: fragmentos + reintentos + división adaptativa
// =========================================================================

const IA_CONFIG = {
  CHUNK_CHARS: 800,      // tamaño objetivo de cada fragmento enviado al modelo
  MIN_CHUNK_CHARS: 200,  // por debajo de esto ya no se subdivide
  MAX_SPLIT_DEPTH: 2,    // cuántas veces se puede subdividir un fragmento que falla
  TIMEOUT_MS: 295000,    // corte del lado cliente por petición
  RED_REINTENTOS: 1,     // reintentos ante fallo de red / conexión cortada
};

class ErrorAnotacion extends Error {
  constructor(codigo, mensaje, detalle = '') {
    super(mensaje);
    this.name = 'ErrorAnotacion';
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- División del texto (respeta estrofas y párrafos; sin lookbehind, por Safari antiguo) ---

function partirUnidad(unidad, max) {
  if (unidad.length <= max) return [unidad];
  const lineas = unidad.split('\n').map((l) => l.trim()).filter(Boolean);
  const usaLineas = lineas.length > 1;
  const piezas = usaLineas
    ? lineas
    : (unidad.match(/[^.!?…]+[.!?…]+["'»”)\]]*\s*|[^.!?…]+$/g) || [unidad]).map((s) => s.trim()).filter(Boolean);
  const sep = usaLineas ? '\n' : ' ';
  const salida = [];
  let actual = '';
  const volcar = () => { if (actual) { salida.push(actual); actual = ''; } };

  for (let pieza of piezas) {
    while (pieza.length > max) { // pieza aislada demasiado larga: corte duro en un espacio
      volcar();
      let corte = pieza.lastIndexOf(' ', max);
      if (corte < max / 2) corte = max;
      salida.push(pieza.slice(0, corte).trim());
      pieza = pieza.slice(corte).trim();
    }
    if (!pieza) continue;
    if (actual && actual.length + sep.length + pieza.length > max) volcar();
    actual = actual ? actual + sep + pieza : pieza;
  }
  volcar();
  return salida;
}

function dividirEnFragmentos(texto, max = IA_CONFIG.CHUNK_CHARS) {
  const unidades = String(texto)
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((u) => u.trim())
    .filter(Boolean)
    .flatMap((u) => partirUnidad(u, max));

  const fragmentos = [];
  let actual = '';
  for (const u of unidades) {
    if (actual && actual.length + 2 + u.length > max) { fragmentos.push(actual); actual = ''; }
    actual = actual ? actual + '\n\n' + u : u;
  }
  if (actual) fragmentos.push(actual);
  return fragmentos;
}

// Divide un fragmento que ha fallado en ~2 mitades. Devuelve null si ya no se puede.
function subdividir(texto) {
  if (texto.length <= IA_CONFIG.MIN_CHUNK_CHARS) return null;
  const objetivo = Math.max(IA_CONFIG.MIN_CHUNK_CHARS, Math.ceil(texto.length / 2) + 50);
  const partes = dividirEnFragmentos(texto, objetivo);
  return partes.length > 1 ? partes : null;
}

// --- Llamada al backend ---

async function pedirAnotacion(payload) {
  const ctrl = new AbortController();
  const temporizador = setTimeout(() => ctrl.abort(), IA_CONFIG.TIMEOUT_MS);
  try {
    let resp;
    try {
      resp = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
        cache: 'no-store',
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new ErrorAnotacion('TIEMPO', 'El servidor tardó demasiado en responder.');
      // Safari: "Load failed" · Chrome: "Failed to fetch" · Firefox: "NetworkError…"
      throw new ErrorAnotacion('RED', 'No se pudo conectar con el servidor de anotación.', `${e.name}: ${e.message}`);
    }

    let bruto;
    try {
      bruto = await resp.text();
    } catch (e) {
      if (ctrl.signal.aborted) throw new ErrorAnotacion('TIEMPO', 'El servidor tardó demasiado en responder.');
      throw new ErrorAnotacion('CORTE', 'Se interrumpió la conexión mientras el servidor generaba la respuesta.', `${e.name}: ${e.message}`);
    }

    let datos = null;
    try { datos = JSON.parse(bruto); } catch (_) { /* no es JSON */ }

    if (!datos) {
      throw new ErrorAnotacion(
        resp.ok ? 'RESPUESTA_INVALIDA' : 'HTTP',
        resp.ok ? 'El servidor devolvió una respuesta que no es JSON.' : `El servidor respondió HTTP ${resp.status}.`,
        bruto.slice(0, 200),
      );
    }
    if (datos.error) throw new ErrorAnotacion(datos.codigo || 'SERVIDOR', datos.error, datos.detalles || '');
    if (!resp.ok) throw new ErrorAnotacion('HTTP', `El servidor respondió HTTP ${resp.status}.`);
    return datos;
  } finally {
    clearTimeout(temporizador);
  }
}

// Anota un fragmento; ante fallos reintenta o lo divide en dos y lo procesa por partes.
async function anotarFragmento(texto, estado, profundidad) {
  let reintentosRed = 0;
  for (;;) {
    const parte = estado.resultados.length + 1;
    estado.alProgreso(parte, estado.total);
    try {
      const resultado = await pedirAnotacion({
        textoPlano: texto,
        parte,
        totalPartes: estado.total,
        contexto: estado.resultados[0]?.meta || null,
      });
      estado.resultados.push(resultado);
      estado.alResultado();
      return;
    } catch (err) {
      const esRed = ['RED', 'CORTE', 'TIEMPO'].includes(err.codigo);
      if (esRed && reintentosRed < IA_CONFIG.RED_REINTENTOS) {
        reintentosRed++;
        await esperar(2500);
        continue;
      }
      const dividible = ['TRUNCADO', 'SALIDA_INVALIDA', 'CORTE', 'TIEMPO'].includes(err.codigo);
      const partes = dividible && profundidad < IA_CONFIG.MAX_SPLIT_DEPTH ? subdividir(texto) : null;
      if (!partes) throw err;
      console.warn(`[LexiLectura] "${err.codigo}" con ${texto.length} caracteres: se divide en ${partes.length} partes.`);
      estado.total += partes.length - 1;
      for (const p of partes) await anotarFragmento(p, estado, profundidad + 1);
      return;
    }
  }
}

// --- Unión de resultados: renumera nodos para que no choquen entre partes ---

function unirResultados(resultados) {
  const base = resultados[0];
  const nodos = {};
  const estrofas = [];
  const idsFijos = new Set(['node_author', 'node_period', base.meta?.authorNodeId, base.meta?.periodNodeId].filter(Boolean));

  resultados.forEach((res, i) => {
    const mapa = {};
    Object.entries(res.interactiveNodes || {}).forEach(([id, nodo]) => {
      if (idsFijos.has(id)) {
        if (i === 0) nodos[id] = nodo; // autor y época solo de la parte 1
        return;
      }
      const nuevo = `p${i + 1}_${id}`;
      mapa[id] = nuevo;
      nodos[nuevo] = nodo;
    });

    const reescribir = (html) => html.replace(
      /data-(nodes?)=(["'])([^"']*)\2/g,
      (_m, attr, q, ids) => `data-${attr}=${q}${ids.trim().split(/\s+/).map((id) => mapa[id] || id).join(' ')}${q}`,
    );
    (res.stanzas || []).forEach((h) => estrofas.push(reescribir(h)));
  });

  return { ...base, interactiveNodes: nodos, stanzas: estrofas };
}

// --- Mensajes de error comprensibles ---

function mensajeAmigable(err) {
  if (!(err instanceof ErrorAnotacion)) return err?.message || String(err);
  const url = BACKEND_URL;
  switch (err.codigo) {
    case 'RED':
      return `No se pudo conectar con el servidor de anotación.\n\nAbre ${url} en el navegador: debería mostrar {"ok":true,...}. ` +
        `Si no es así, el problema está en el despliegue de Vercel (ruta, variables de entorno o build), no en tu texto.\n\n(${err.detalle})`;
    case 'CONFIG':
      return `${err.message}\n${err.detalle}`;
    case 'LIMITE':
      return 'Se ha alcanzado el límite de los modelos gratuitos de OpenRouter (20 peticiones/minuto y 50/día sin créditos). ' +
        'Espera al reinicio diario (00:00 UTC), espera un minuto o añade créditos a tu cuenta.';
    case 'MODELOS_NO_DISPONIBLES':
      return `${err.message}\n${err.detalle}`;
    default:
      return err.detalle ? `${err.message} (${err.detalle})` : err.message;
  }
}

// --- Orquestador: lo que ejecuta el botón "Anotar texto automáticamente" ---

async function generarAnotacionConIA() {
  const plainText = document.getElementById('plain-text-input')?.value.trim();
  const btn = document.getElementById('btn-generate-gemini');

  if (!plainText) {
    alert('Por favor, pega un texto plano antes de generar la anotación.');
    return;
  }

  const fragmentos = dividirEnFragmentos(plainText);
  const estado = {
    resultados: [],
    total: fragmentos.length,
    alProgreso: (parte, total) => { btn.textContent = `⏳ Anotando parte ${parte} de ${total}…`; },
    alResultado: () => renderizarTextoAnotado(unirResultados(estado.resultados)), // se ve el avance
  };

  try {
    btn.disabled = true;
    for (const f of fragmentos) await anotarFragmento(f, estado, 0);

    const acordeon = document.querySelector('.json-accordion-container');
    if (acordeon) acordeon.removeAttribute('open');
    alert('¡Texto anotado correctamente!');
  } catch (error) {
    console.error('Error al generar anotaciones:', error);
    const hechas = estado.resultados.length;
    alert(
      `No se pudo procesar el texto: ${mensajeAmigable(error)}` +
      (hechas ? `\n\nSe anotaron ${hechas} parte(s) antes del fallo; el resultado parcial está en pantalla.` : ''),
    );
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Anotar texto automáticamente';
  }
}

// =========================================================================
//  INICIALIZACIÓN DE EVENTOS
// =========================================================================

function inicializarEventos() {
  const levelBtns = document.querySelectorAll('.level-btn');
  const levelBadge = document.getElementById('levelIndicatorBadge');

  levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      levelBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      nivelLecturaActual = btn.dataset.level || 'short';
      
      if (levelBadge) {
        levelBadge.textContent = nivelLecturaActual === 'deep' 
          ? 'Modo Edición Crítica (Vocabulario C1+)' 
          : 'Modo Lectura Básica (Vocabulario B1+)';
      }

      aplicarFiltroVocabularioPorNivel();
    });
  });

  const selectObras = document.getElementById('selector-obras');
  selectObras?.addEventListener('change', async (e) => {
    const ruta = e.target.value;
    if (!ruta) return;
    try {
      const resp = await fetch(ruta);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const datos = await resp.json();
      renderizarTextoAnotado(datos);
    } catch (err) {
      alert(`Error al cargar la obra seleccionada (${ruta}): ${err.message}`);
    }
  });

  document.getElementById('btn-load-json')?.addEventListener('click', () => {
    const jsonInput = document.getElementById('json-input');
    if (!jsonInput || !jsonInput.value.trim()) {
      alert('Pega un JSON válido antes de procesar.');
      return;
    }
    try {
      const data = JSON.parse(jsonInput.value);
      renderizarTextoAnotado(data);
    } catch (e) {
      alert('Error de sintaxis en el JSON pegado. Revisa comas y comillas.');
    }
  });

  document.getElementById('btn-sample-json')?.addEventListener('click', () => {
    renderizarTextoAnotado(EJEMPLO_JSON);
    const acordeon = document.querySelector('.json-accordion-container');
    if (acordeon) acordeon.setAttribute('open', 'true');
  });

  document.getElementById('btn-clear-json')?.addEventListener('click', () => {
    const jsonInput = document.getElementById('json-input');
    if (jsonInput) jsonInput.value = '';
    const stanzas = document.getElementById('text-stanzas');
    if (stanzas) stanzas.innerHTML = '<p class="loading-state">Carga una obra o pega un JSON arriba.</p>';
    obraActiva = null;
    activeLayersSet.clear();
  });

  // Integración con IA (fragmentos + reintentos): ver generarAnotacionConIA()
  document.getElementById('btn-generate-gemini')?.addEventListener('click', generarAnotacionConIA);

  document.getElementById('btn-select-all-cats')?.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-chip').forEach(btn => {
      btn.classList.add('active');
      btn.classList.remove('inactive');
      activeLayersSet.add(btn.dataset.layerId);
    });
    renderActiveLayers(activeLayersSet);
  });

  document.getElementById('btn-deselect-all-cats')?.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-chip').forEach(btn => {
      btn.classList.remove('active');
      btn.classList.add('inactive');
    });
    activeLayersSet.clear();
    renderActiveLayers(activeLayersSet);
  });

  document.getElementById('modal-close-btn')?.addEventListener('click', cerrarModal);
  document.getElementById('annotation-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'annotation-modal') cerrarModal();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cargarMenuObras();
  inicializarEventos();

  const btnUploadLocal = document.getElementById('btn-upload-local');
  const inputFileLocal = document.getElementById('local-json-file');

  if (btnUploadLocal && inputFileLocal) {
    btnUploadLocal.addEventListener('click', (e) => {
      e.preventDefault(); 
      inputFileLocal.click();
    });

    inputFileLocal.addEventListener('change', (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;

      const lector = new FileReader();
      lector.onload = (eventoFichero) => {
        try {
          const datos = JSON.parse(eventoFichero.target.result);
          renderizarTextoAnotado(datos);

          const acordeon = document.querySelector('.json-accordion-container');
          if (acordeon) acordeon.removeAttribute('open');
        } catch (err) {
          alert('El archivo seleccionado no contiene un JSON válido.');
        }
      };
      lector.readAsText(archivo);
      inputFileLocal.value = '';
    });
  }
});
