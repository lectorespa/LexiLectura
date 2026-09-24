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

// =========================================================================
//  LÓGICA DE VISIBILIDAD DE CAPAS
// =========================================================================

// Añade un canal alfa a un color hexadecimal (#RRGGBB) para obtener una versión suave,
// usada como fondo. Si el valor no es un hex de 6 dígitos, se devuelve tal cual.
function tintarColor(hex, alfaHex = '26') {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return `${hex}${alfaHex}`;
}

// Pinta un span con el color de su(s) categoría(s) real(es): un color sólido si solo
// tiene una capa activa, o un reparto a partes iguales de todos los colores implicados
// cuando el span solapa varias categorías, para que ambas anotaciones sigan siendo
// visualmente identificables en vez de fundirse en un azul genérico único.
function aplicarEstiloDeCapas(word, capas) {
  if (!capas.length) {
    word.style.background = '';
    word.style.borderBottomWidth = '';
    word.style.borderBottomStyle = '';
    word.style.borderBottomColor = '';
    word.style.borderImage = '';
    return;
  }

  if (capas.length === 1) {
    const color = capas[0].color;
    word.style.background = tintarColor(color);
    word.style.borderImage = 'none';
    word.style.borderBottomWidth = '2.5px';
    word.style.borderBottomStyle = 'solid';
    word.style.borderBottomColor = color;
  } else {
    const n = capas.length;
    const paradasFondo = capas
      .map((c, i) => `${tintarColor(c.color)} ${(i * 100) / n}%, ${tintarColor(c.color)} ${((i + 1) * 100) / n}%`)
      .join(', ');
    const paradasBorde = capas
      .map((c, i) => `${c.color} ${(i * 100) / n}%, ${c.color} ${((i + 1) * 100) / n}%`)
      .join(', ');
    word.style.background = `linear-gradient(90deg, ${paradasFondo})`;
    word.style.borderBottomWidth = '3px';
    word.style.borderBottomStyle = 'solid';
    word.style.borderBottomColor = 'transparent';
    word.style.borderImage = `linear-gradient(90deg, ${paradasBorde}) 1`;
  }
}

function renderActiveLayers(activeLayersSet) {
  const words = document.querySelectorAll('.interactive-word, [data-node], [data-nodes]');

  words.forEach(word => {
    const nodeIds = (word.dataset.nodes || word.dataset.node || '').trim().split(/\s+/).filter(Boolean);

    // Capas de los nodos que ESTE span tiene realmente disponibles ahora mismo: existen en
    // la obra y, si son de vocabulario, no están ocultos por el nivel de lectura actual.
    // Así, una capa oculta por nivel nunca pinta ni cuenta como "activa" en el span.
    const capasVisibles = [];
    const vistos = new Set();
    nodeIds.forEach(id => {
      const nodo = obraActiva?.interactiveNodes?.[id];
      if (!nodo || esNodoOcultoPorVocabulario(nodo, word)) return;
      const capaObj = resolverCapa(nodo.type || nodo.category);
      if (capaObj && !vistos.has(capaObj.id)) {
        vistos.add(capaObj.id);
        capasVisibles.push(capaObj);
      }
    });

    // De esas, cuáles siguen activas según el filtro de categorías (chips "Vocabulario",
    // "Sintaxis", etc.): si el usuario desactiva una categoría, esa capa deja de contar
    // aunque el span comparta otra categoría que sí siga activa.
    const capasActivas = capasVisibles.filter(capa => activeLayersSet.has(capa.id));

    if (capasActivas.length > 0) {
      word.classList.remove('layer-disabled');
      word.classList.add('is-highlighted');
      aplicarEstiloDeCapas(word, capasActivas);
    } else {
      word.classList.add('layer-disabled');
      word.classList.remove('is-highlighted');
      aplicarEstiloDeCapas(word, []);
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

// Nivel de vocabulario de un nodo concreto: el propio nodo manda; si no lo indica,
// se recurre al atributo data-vocab-level del span (compatibilidad con ediciones antiguas).
function nivelVocabDeNodo(nodo, el) {
  return nodo?.vocabLevel || el?.getAttribute('data-vocab-level') || 'B1';
}

// ¿Debe ocultarse ESTE nodo (no el span entero) en el nivel de lectura actual?
// Solo aplica a nodos de la categoría "vocabulary"; el resto de categorías nunca se ocultan así.
function esNodoOcultoPorVocabulario(nodo, el) {
  if (!nodo || nivelLecturaActual !== 'deep') return false;
  const capa = resolverCapa(nodo.type || nodo.category);
  if (!capa || capa.id !== 'vocabulary') return false;
  const nivel = nivelVocabDeNodo(nodo, el);
  return nivel === 'B1' || nivel === 'B2';
}

function aplicarFiltroVocabularioPorNivel() {
  if (!obraActiva) return;

  // Un span puede llevar varios nodos solapados (p. ej. vocabulario + sintaxis). Solo se
  // desactiva por completo cuando TODOS sus nodos son de vocabulario y están ocultos en este
  // nivel; si conserva algún nodo de otra categoría (o de vocabulario en un nivel visible),
  // el span sigue activo y esa anotación sigue siendo consultable.
  document.querySelectorAll('[data-node], [data-nodes]').forEach(el => {
    const nodeIds = (el.getAttribute('data-nodes') || el.getAttribute('data-node') || '').trim().split(/\s+/).filter(Boolean);
    if (!nodeIds.length) return;

    const nodos = nodeIds.map(id => obraActiva.interactiveNodes?.[id]).filter(Boolean);
    if (!nodos.length) return;

    const todosOcultos = nodos.every(nodo => esNodoOcultoPorVocabulario(nodo, el));
    el.classList.toggle('vocab-hidden-in-deep', todosOcultos);
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
  actualizarBotonExportar();

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
  renderizarPieAnotacionIA(datosObra.meta);
}

// Pie con el motor de IA y la fecha/hora en que se anotó la edición. Se guarda en
// meta.iaProveedor / meta.iaFecha (fecha en ISO), así que viaja con el JSON descargado y con
// el HTML autónomo, y vuelve a mostrarse al recargar esa edición más adelante.
function renderizarPieAnotacionIA(meta) {
  const pie = document.getElementById('edition-ia-footer');
  if (!pie) return;

  if (!meta?.iaProveedor || !meta?.iaFecha) {
    pie.hidden = true;
    pie.textContent = '';
    return;
  }

  const fecha = new Date(meta.iaFecha);
  const fechaTexto = Number.isNaN(fecha.getTime())
    ? meta.iaFecha
    : fecha.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

  pie.hidden = false;
  pie.textContent = `Anotado con ${meta.iaProveedor} el ${fechaTexto}.`;
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

  // Se excluyen: los nodos que no existan, los de vocabulario ocultos en el nivel actual, y
  // los cuya categoría esté desactivada en el filtro de capas. Así, si el span solapa una
  // categoría desactivada (o vocabulario oculto por nivel) con otra que sigue activa, el
  // clic abre directamente esa otra categoría en vez de ofrecer también la que no debería
  // ser consultable ahora mismo.
  const nodosDetectados = nodeIds
    .map(id => ({ id, data: obraActiva?.interactiveNodes?.[id] }))
    .filter(item => {
      if (!item.data || esNodoOcultoPorVocabulario(item.data, target)) return false;
      const capa = resolverCapa(item.data.type || item.data.category);
      return capa && activeLayersSet.has(capa.id);
    });

  if (nodosDetectados.length === 1) {
    abrirModalAnotacion(nodosDetectados[0].data);
  } else if (nodosDetectados.length > 1) {
    mostrarMenuSolapamiento(nodosDetectados, e.clientX, e.clientY);
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
  // Tamaño objetivo de cada fragmento según el motor.
  CHUNK_CHARS: { gemini: 2000, groq: 1500 },
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

function dividirEnFragmentos(texto, max = IA_CONFIG.CHUNK_CHARS.groq) {
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
        proveedor: estado.proveedor,
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
      // Un JSON inválido rara vez se arregla dividiendo: solo un nivel, para no gastar cuota.
      const maxProf = err.codigo === 'SALIDA_INVALIDA' ? 1 : IA_CONFIG.MAX_SPLIT_DEPTH;
      const partes = dividible && profundidad < maxProf ? subdividir(texto) : null;
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

const NOMBRES_MOTOR = { gemini: 'Gemini Flash', groq: 'Groq' };

function mensajeAmigable(err) {
  if (!(err instanceof ErrorAnotacion)) return err?.message || String(err);
  if (err.codigo === 'RED') {
    return `No se pudo conectar con el servidor de anotación.\n\nAbre ${BACKEND_URL} en el navegador: debería mostrar {"ok":true,...}. ` +
      `Si no es así, el problema está en el despliegue de Vercel (ruta, variables de entorno o build), no en tu texto.\n\n(${err.detalle})`;
  }
  const base = err.detalle ? `${err.message}\n(${err.detalle})` : err.message;
  const otroMotor = ['CONFIG', 'LIMITE', 'MODELOS_NO_DISPONIBLES', 'BLOQUEADO', 'SALIDA_INVALIDA', 'TPM_INSUFICIENTE'];
  return otroMotor.includes(err.codigo)
    ? `${base}\n\nPuedes probar con otro de los botones de anotación.`
    : base;
}

// --- Orquestador: lo que ejecutan los botones "Anotar con …" ---

async function generarAnotacionConIA(proveedor = 'gemini') {
  const plainText = document.getElementById('plain-text-input')?.value.trim();
  const botones = Array.from(document.querySelectorAll('[data-proveedor]'));
  const btn = botones.find((b) => b.dataset.proveedor === proveedor) || { textContent: '', disabled: false };

  if (!IA_CONFIG.CHUNK_CHARS[proveedor]) {
    alert(`Motor de anotación desconocido: ${proveedor}`);
    return;
  }
  if (!plainText) {
    alert('Por favor, pega un texto plano antes de generar la anotación.');
    return;
  }

  const etiquetas = botones.map((b) => [b, b.textContent]);
  const fragmentos = dividirEnFragmentos(plainText, IA_CONFIG.CHUNK_CHARS[proveedor]);
  const estado = {
    proveedor,
    resultados: [],
    total: fragmentos.length,
    alProgreso: (parte, total) => { btn.textContent = `⏳ Anotando parte ${parte} de ${total}…`; },
    alResultado: () => renderizarTextoAnotado(unirResultados(estado.resultados)), // se ve el avance
  };

  try {
    botones.forEach((b) => { b.disabled = true; }); // un solo motor a la vez
    btn.disabled = true;
    for (const f of fragmentos) await anotarFragmento(f, estado, 0);

    // Resultado final con el motor y la fecha/hora de anotación, para el pie de la edición.
    const resultadoFinal = unirResultados(estado.resultados);
    resultadoFinal.meta = {
      ...resultadoFinal.meta,
      iaProveedor: NOMBRES_MOTOR[proveedor] || proveedor,
      iaFecha: new Date().toISOString(),
    };
    renderizarTextoAnotado(resultadoFinal);

    alert(`¡Texto anotado correctamente con ${NOMBRES_MOTOR[proveedor] || proveedor}!`);

    // Tras cerrar el aviso, se sube la pantalla para que el filtro de categorías y el texto
    // queden arriba, sin necesidad de bajar manualmente para empezar a leer.
    document.getElementById('category-filters-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error('Error al generar anotaciones:', error);
    const hechas = estado.resultados.length;
    alert(
      `No se pudo procesar el texto (${NOMBRES_MOTOR[proveedor] || proveedor}): ${mensajeAmigable(error)}` +
      (hechas ? `\n\nSe anotaron ${hechas} parte(s) antes del fallo; el resultado parcial está en pantalla.` : ''),
    );
  } finally {
    etiquetas.forEach(([b, texto]) => { b.textContent = texto; b.disabled = false; });
    btn.disabled = false;
  }
}

// =========================================================================
//  DESCARGA DE UN HTML AUTÓNOMO (edición anotada + visor en un solo archivo)
// =========================================================================
// El archivo descargado contiene: el HTML del visor (sin los paneles de edición), el CSS y el JS
// incrustados, y la edición anotada como JSON. Se abre con doble clic, sin servidor ni conexión.
// (Solo las imágenes de Wikipedia/Commons del modal y el audio remoto, si lo hay, necesitan internet.)

const EXPORT_CONFIG = {
  MAX_ASSET_BYTES: 800 * 1024,           // recursos del CSS (fuentes, imágenes) mayores no se incrustan
  MAX_TOTAL_ASSET_BYTES: 6 * 1024 * 1024, // tope del total de recursos incrustados
  FETCH_TIMEOUT_MS: 15000,
  MAX_IMPORT_DEPTH: 3,
};

class ErrorExport extends Error {
  constructor(codigo, mensaje, extra = {}) {
    super(mensaje);
    this.name = 'ErrorExport';
    this.codigo = codigo;
    Object.assign(this, extra);
  }
}

// --- Utilidades ---

function nombreArchivoSeguro(titulo, extension = 'html') {
  const base = String(titulo || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/g, '');
  return `${base || 'edicion-anotada'}.${extension}`;
}

function nombreDeUrl(url) {
  try {
    return decodeURIComponent(new URL(url, document.baseURI).pathname.split('/').pop() || '');
  } catch (_) {
    return String(url).split('/').pop();
  }
}

async function fetchConLimite(url) {
  const ctrl = new AbortController();
  const temporizador = setTimeout(() => ctrl.abort(), EXPORT_CONFIG.FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp;
  } finally {
    clearTimeout(temporizador);
  }
}

const blobADataUri = (blob) => new Promise((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(lector.result);
  lector.onerror = () => reject(lector.error);
  lector.readAsDataURL(blob);
});

const leerArchivoLocal = (archivo) => new Promise((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(String(lector.result));
  lector.onerror = () => reject(lector.error);
  lector.readAsText(archivo);
});

// Busca un archivo elegido a mano: por nombre exacto o, si solo hay uno de esa extensión, por extensión
// (así sirve "app-29.js" aunque el visor pida "app.js").
function buscarLocal(nombre, locales) {
  if (locales[nombre] !== undefined) return locales[nombre];
  const extension = ((nombre.match(/\.[a-z0-9]+$/i) || [''])[0]).toLowerCase();
  if (!extension) return undefined;
  const candidatos = Object.keys(locales).filter((n) => n.toLowerCase().endsWith(extension));
  return candidatos.length === 1 ? locales[candidatos[0]] : undefined;
}

async function reemplazarAsync(texto, regex, fn) { // regex con flag g
  const coincidencias = [...texto.matchAll(regex)];
  const reemplazos = await Promise.all(coincidencias.map((m) => fn(m)));
  let salida = '';
  let cursor = 0;
  coincidencias.forEach((m, i) => {
    salida += texto.slice(cursor, m.index) + reemplazos[i];
    cursor = m.index + m[0].length;
  });
  return salida + texto.slice(cursor);
}

// --- CSS: incrusta @import y url() (fuentes, imágenes) como data URI ---

const RE_IMPORT = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);/gi;
const RE_URL = /url\(\s*(['"]?)(?!data:|#|about:|blob:)([^'")]+?)\1\s*\)/gi;

async function recursoComoDataUri(url, estado) {
  if (estado.cache.has(url)) return estado.cache.get(url);
  const promesa = (async () => {
    if (estado.bytes >= EXPORT_CONFIG.MAX_TOTAL_ASSET_BYTES) return null;
    try {
      const blob = await (await fetchConLimite(url)).blob();
      if (blob.size > EXPORT_CONFIG.MAX_ASSET_BYTES || estado.bytes + blob.size > EXPORT_CONFIG.MAX_TOTAL_ASSET_BYTES) return null;
      estado.bytes += blob.size;
      return await blobADataUri(blob);
    } catch (_) {
      return null;
    }
  })();
  estado.cache.set(url, promesa);
  return promesa;
}

async function inlinarCss(css, base, estado, profundidad = 0) {
  css = await reemplazarAsync(css, RE_IMPORT, async (m) => {
    const ruta = m[2] || m[4];
    const medios = (m[5] || '').trim();
    let absoluta;
    try { absoluta = new URL(ruta, base).href; } catch (_) { return m[0]; }
    if (estado.importados.has(absoluta)) return ''; // ya incluido (evita ciclos y duplicados)
    estado.importados.add(absoluta);

    const sentencia = `@import url("${absoluta}")${medios ? ` ${medios}` : ''};`;
    if (profundidad >= EXPORT_CONFIG.MAX_IMPORT_DEPTH) { estado.importsFallidos.push(sentencia); return ''; }
    try {
      const texto = await (await fetchConLimite(absoluta)).text();
      const interior = await inlinarCss(texto, absoluta, estado, profundidad + 1);
      return medios ? `@media ${medios} {\n${interior}\n}` : interior;
    } catch (_) {
      estado.avisos.add(absoluta);
      estado.importsFallidos.push(sentencia); // se "sube" al principio: un @import solo vale antes de otras reglas
      return '';
    }
  });

  return reemplazarAsync(css, RE_URL, async (m) => {
    let absoluta;
    try { absoluta = new URL(m[2].trim(), base).href; } catch (_) { return m[0]; }
    const dataUri = await recursoComoDataUri(absoluta, estado);
    if (dataUri) return `url("${dataUri}")`;
    estado.avisos.add(absoluta); // no cabe o no se pudo leer: URL absoluta (funciona con conexión)
    return `url("${absoluta}")`;
  });
}

// --- Recopilación de las hojas de estilo y los scripts de la página ---

async function recopilarCss(locales) {
  const partes = [];
  const faltan = [];
  const puedeFetch = location.protocol !== 'file:';

  for (const nodo of document.querySelectorAll('link[rel~="stylesheet"], style')) {
    if (nodo.tagName === 'STYLE') { partes.push({ css: nodo.textContent || '', base: document.baseURI }); continue; }
    const href = nodo.href;
    const nombre = nombreDeUrl(href);
    let css = null;

    if (puedeFetch) { try { css = await (await fetchConLimite(href)).text(); } catch (_) { /* siguiente opción */ } }
    if (css === null) { const local = buscarLocal(nombre, locales); if (local !== undefined) css = local; }
    if (css === null) { try { css = Array.from(nodo.sheet.cssRules).map((r) => r.cssText).join('\n'); } catch (_) { /* file:// o CORS */ } }
    if (css === null) { faltan.push(nombre); continue; }

    const medio = (nodo.getAttribute('media') || '').trim();
    partes.push({ css: medio && medio !== 'all' ? `@media ${medio} {\n${css}\n}` : css, base: href });
  }
  return { partes, faltan };
}

async function recopilarScripts(locales) {
  const partes = [];
  const faltan = [];
  const puedeFetch = location.protocol !== 'file:';

  for (const nodo of document.querySelectorAll('script[src]')) {
    if (!/^(https?|file):/i.test(nodo.src)) continue; // extensiones del navegador, etc.
    const nombre = nombreDeUrl(nodo.src);
    let js = null;

    if (puedeFetch) { try { js = await (await fetchConLimite(nodo.src)).text(); } catch (_) { /* siguiente opción */ } }
    if (js === null) { const local = buscarLocal(nombre, locales); if (local !== undefined) js = local; }
    if (js === null) { faltan.push(nombre); continue; }
    partes.push(js);
  }
  return { partes, faltan };
}

// --- Construcción del HTML autónomo ---

const escaparJsonParaHtml = (texto) => texto
  .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

async function construirHtmlAutonomo(locales = {}) {
  if (!obraActiva) throw new ErrorExport('SIN_OBRA', 'No hay ninguna edición cargada.');

  const hojas = await recopilarCss(locales);
  const scripts = await recopilarScripts(locales);
  const faltan = [...hojas.faltan, ...scripts.faltan];
  if (faltan.length) throw new ErrorExport('FALTAN_ARCHIVOS', `No se pudieron leer: ${faltan.join(', ')}`, { faltan });

  // CSS con fuentes e imágenes incrustadas
  const estado = { cache: new Map(), bytes: 0, importados: new Set(), importsFallidos: [], avisos: new Set() };
  const trozosCss = [];
  for (const hoja of hojas.partes) trozosCss.push(await inlinarCss(hoja.css, hoja.base, estado));
  const css = [...estado.importsFallidos, ...trozosCss].join('\n\n');

  // Plantilla = la página actual sin los paneles de edición ni el estado dinámico
  const raiz = document.documentElement.cloneNode(true);
  const q = (sel) => raiz.querySelector(sel);
  raiz.querySelectorAll('script, link[rel~="stylesheet"], style, [data-export-omit], .overlap-selector-popup').forEach((n) => n.remove());
  const comentarios = []; // los comentarios de los paneles retirados quedarían sueltos: fuera todos
  for (const it = document.createNodeIterator(raiz, NodeFilter.SHOW_COMMENT); it.nextNode();) comentarios.push(it.referenceNode);
  comentarios.forEach((c) => c.remove());
  ['#plain-text-input', '#btn-clear-plain-text', '#selector-obras', '#btn-export-html', '#btn-export-json', '[data-proveedor]']
    .forEach((sel) => raiz.querySelectorAll(sel).forEach((n) => n.remove())); // red de seguridad

  ['#text-stanzas', '#category-filter-bar', '#doc-author', '#doc-period', '#doc-year',
    '#modal-category', '#modal-title', '#modal-definition', '#modal-content', '#modal-links', '#modal-image-caption']
    .forEach((sel) => { const n = q(sel); if (n) n.innerHTML = ''; });
  raiz.querySelectorAll('#modal-category, #modal-title, #modal-content').forEach((n) => n.removeAttribute('style'));
  const modal = q('#annotation-modal');
  if (modal) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); }
  const envoltorioImg = q('#modal-image-wrapper');
  if (envoltorioImg) { envoltorioImg.classList.add('hidden'); envoltorioImg.classList.remove('is-loading'); }
  const enlaces = q('#modal-links');
  if (enlaces) enlaces.classList.add('hidden');
  const img = q('#modal-image');
  if (img) { img.setAttribute('src', ''); img.setAttribute('style', 'display:none;'); }
  const cuerpo = q('body');
  if (cuerpo) cuerpo.removeAttribute('style');

  const titulo = obraActiva.meta?.title || 'Edición anotada interactiva';
  const tituloDoc = q('#doc-title');
  if (tituloDoc) tituloDoc.textContent = titulo;
  const etiquetaTitulo = q('title');
  if (etiquetaTitulo) etiquetaTitulo.textContent = titulo;
  const idioma = String(obraActiva.meta?.lang || '');
  if (/^[a-z]{2,3}(-[A-Za-z0-9]+)?$/.test(idioma)) raiz.setAttribute('lang', idioma);

  // CSS, datos, scripts del visor y arranque
  const crear = (tag, texto, atributos = {}) => {
    const el = document.createElement(tag);
    Object.entries(atributos).forEach(([k, v]) => el.setAttribute(k, v));
    el.textContent = texto;
    return el;
  };
  q('head').appendChild(crear('style', css.replace(/<\/style/gi, '<\\/style')));

  const datos = escaparJsonParaHtml(JSON.stringify({ obra: obraActiva, nivel: nivelLecturaActual }));
  cuerpo.appendChild(crear('script', datos, { type: 'application/json', id: 'datos-obra' }));
  scripts.partes.forEach((js) => cuerpo.appendChild(crear('script', js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'))));
  cuerpo.appendChild(crear('script', `(function () {
  var paquete = JSON.parse(document.getElementById('datos-obra').textContent);
  document.addEventListener('DOMContentLoaded', function () {
    nivelLecturaActual = paquete.nivel || 'short';
    renderizarTextoAnotado(paquete.obra);
  });
})();`));

  raiz.insertBefore(document.createComment(` Edición anotada autónoma «${titulo.replace(/--/g, '- -')}» — generada el ${new Date().toISOString().slice(0, 10)} `), q('head'));

  return {
    html: `<!DOCTYPE html>\n${raiz.outerHTML}`,
    nombre: nombreArchivoSeguro(titulo),
    avisos: [...estado.avisos],
  };
}

function descargarArchivo(nombre, contenido, tipo = 'text/html;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

// --- Interfaz del botón ---

function actualizarBotonExportar() {
  const boton = document.getElementById('btn-export-html');
  const botonJson = document.getElementById('btn-export-json');
  const estado = document.getElementById('export-status');
  if (boton) boton.disabled = !obraActiva;
  if (botonJson) botonJson.disabled = !obraActiva;
  if (estado) {
    estado.textContent = obraActiva
      ? `Edición lista para descargar: «${obraActiva.meta?.title || 'Sin título'}».`
      : 'Anota o carga una edición para poder descargarla.';
  }
}

async function exportarHtmlAutonomo(locales = {}) {
  const boton = document.getElementById('btn-export-html');
  const estado = document.getElementById('export-status');
  const panel = document.getElementById('export-fallback');
  const mensaje = document.getElementById('export-fallback-msg');

  if (!obraActiva) {
    alert('Primero anota o carga una edición para poder descargarla.');
    return;
  }

  const etiqueta = boton ? boton.textContent : '';
  if (boton) { boton.disabled = true; boton.textContent = '⏳ Preparando el HTML…'; }

  try {
    const { html, nombre, avisos } = await construirHtmlAutonomo(locales);
    descargarArchivo(nombre, html);
    if (panel) panel.hidden = true;
    const kb = Math.round(new Blob([html]).size / 1024);
    if (estado) {
      estado.textContent = `Descargado «${nombre}» (${kb} KB).` + (avisos.length
        ? ` ${avisos.length} recurso(s) externo(s) del CSS no se pudieron incrustar y seguirán cargándose desde internet.`
        : '');
    }
  } catch (err) {
    if (err instanceof ErrorExport && err.codigo === 'FALTAN_ARCHIVOS') {
      if (mensaje) {
        mensaje.textContent = `El navegador no me deja leer automáticamente ${err.faltan.join(' y ')} (¿abres el visor desde el disco?). ` +
          'Selecciona esos archivos aquí (puedes elegir varios a la vez) y se descargará el HTML.';
      }
      if (panel) panel.hidden = false;
      if (estado) estado.textContent = 'Falta un paso: selecciona los archivos indicados.';
    } else {
      console.error('Error al exportar:', err);
      alert(`No se pudo generar el HTML autónomo: ${err.message}`);
    }
  } finally {
    if (boton) { boton.textContent = etiqueta; boton.disabled = !obraActiva; }
  }
}

// --- Descarga de la edición anotada como archivo .json ---

function descargarJsonAnotado() {
  const estado = document.getElementById('export-status');

  if (!obraActiva) {
    alert('Primero anota o carga una edición para poder descargarla.');
    return;
  }

  try {
    const nombre = nombreArchivoSeguro(obraActiva.meta?.title, 'json');
    const json = JSON.stringify(obraActiva, null, 2);
    descargarArchivo(nombre, json, 'application/json;charset=utf-8');
    if (estado) {
      const kb = Math.max(1, Math.round(new Blob([json]).size / 1024));
      estado.textContent = `Descargado «${nombre}» (${kb} KB).`;
    }
  } catch (err) {
    console.error('Error al descargar el JSON:', err);
    alert(`No se pudo generar el archivo JSON: ${err.message}`);
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

  // Limpiar el cajetín de texto plano (no toca la edición anotada que ya esté en pantalla)
  document.getElementById('btn-clear-plain-text')?.addEventListener('click', () => {
    const cajetin = document.getElementById('plain-text-input');
    if (!cajetin) return;
    cajetin.value = '';
    cajetin.focus();
  });

  // Descarga del HTML autónomo (y selector de archivos de respaldo si el navegador no deja leerlos)
  document.getElementById('btn-export-html')?.addEventListener('click', () => exportarHtmlAutonomo());
  // Descarga del JSON de la edición anotada actual
  document.getElementById('btn-export-json')?.addEventListener('click', () => descargarJsonAnotado());
  document.getElementById('export-archivos-locales')?.addEventListener('change', async (e) => {
    const locales = {};
    for (const archivo of Array.from(e.target.files || [])) locales[archivo.name] = await leerArchivoLocal(archivo);
    e.target.value = '';
    await exportarHtmlAutonomo(locales);
  });
  actualizarBotonExportar();

  // Botones de anotación con IA: cada uno lleva data-proveedor="gemini" | "groq"
  document.querySelectorAll('[data-proveedor]').forEach((boton) => {
    boton.addEventListener('click', () => generarAnotacionConIA(boton.dataset.proveedor));
  });

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
});
