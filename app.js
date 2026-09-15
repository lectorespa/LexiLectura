/**
 * Visor de Ediciones Críticas e Interactivas - Lógica Principal con Motor de Imágenes Avanzado
 */

let obraActiva = null;
let nivelLecturaActual = 'short';
let currentImageFetchController = null;

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
    }
  },
  "stanzas": [
    "<p>De los sus ojos <span class=\"interactive-word\" data-node=\"node_1\" tabindex=\"0\" role=\"button\">tan fuemente llorando</span>,<br>tornaba la cabeza i estábalos mirando.</p>"
  ]
};

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
  if (jsonInput && document.activeElement !== jsonInput) {
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

    contenedorEstrofas.querySelectorAll('[data-node]').forEach(el => {
      const nodeId = el.getAttribute('data-node');
      const nodo = datosObra.interactiveNodes?.[nodeId];
      if (nodo) {
        const capaObj = resolverCapa(nodo.type || nodo.category);
        if (capaObj) el.setAttribute('data-category', capaObj.id);
      }
    });
  } else {
    contenedorEstrofas.innerHTML = '<p class="empty-state">No hay estrofas disponibles en esta estructura.</p>';
  }
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

function alternarVisibilidadCapa(capaId, visible) {
  if (!obraActiva) return;

  const elementos = document.querySelectorAll('[data-node]');
  elementos.forEach(el => {
    const nodeId = el.getAttribute('data-node');
    const nodo = obraActiva.interactiveNodes?.[nodeId];
    const rawCapa = el.getAttribute('data-category') || nodo?.type || nodo?.category;
    const capaObj = resolverCapa(rawCapa);
    
    if (capaObj?.id === capaId || rawCapa === capaId) {
      el.classList.toggle('layer-disabled', !visible);
    }
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

  const anotacion = datosNodo.annotations?.[nivelLecturaActual] || datosNodo.annotations?.short || {};
  const modalDef = document.getElementById('modal-definition');
  const modalContent = document.getElementById('modal-content');

  if (modalDef) modalDef.innerHTML = anotacion.definition || '';
  if (modalContent) {
    modalContent.innerHTML = anotacion.content || '';
    modalContent.style.borderLeft = `3px solid ${colorCategoria}`;
    modalContent.style.paddingLeft = '10px';
  }

  // Mostrar placeholder inicial de carga de imagen
  showImagePlaceholder("Buscando y cargando imagen representativa...");

  // Renderizar enlaces externos (Wikipedia y YouTube)
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

  // Ejecutar motor avanzado de resolución de imagen asíncrona
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
      hideImage();
    }
  }
}

function hideImage() {
  const modalImgWrapper = document.getElementById('modal-image-wrapper');
  const modalImg = document.getElementById('modal-image');
  const modalCaption = document.getElementById('modal-image-caption');

  if (modalImgWrapper) {
    modalImgWrapper.classList.add('hidden');
    modalImgWrapper.classList.remove('is-loading');
  }
  if (modalImg) {
    modalImg.src = '';
    modalImg.style.display = 'none';
  }
  if (modalCaption) modalCaption.textContent = '';
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
    const personName = nodeData.title || nodeData.label || searchQuery;
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

  // --- RESPALDO DE SEGURIDAD PARA GITHUB PAGES ---
  // Si las APIs externas fallan por CORS o red, se asigna una imagen temática segura
  const fallbackUrls = {
    artwork: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Blanco_y_Negro_-_Generacion_del_98.jpg/500px-Blanco_y_Negro_-_Generacion_del_98.jpg",
    landscape: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Castilian_landscape_near_Sig%C3%BCenza.jpg/500px-Castilian_landscape_near_Sig%C3%BCenza.jpg"
  };
  
  const fallbackSrc = fallbackUrls[conceptType] || fallbackUrls.landscape;
  if (!signal || !signal.aborted) {
    await showImageWithPreload(fallbackSrc, captionText || "Imagen ilustrativa del período", "Archivo histórico (Respaldo)", signal);
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
//  INICIALIZACIÓN DE EVENTOS
// =========================================================================

function inicializarEventos() {
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
        alert('No se pudo cargar el archivo local. Revisa el servidor web o usa el cajetín JSON.');
      }
    });
  }

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
  });

  document.getElementById('btn-clear-json')?.addEventListener('click', () => {
    const jsonInput = document.getElementById('json-input');
    if (jsonInput) jsonInput.value = '';
    const stanzas = document.getElementById('text-stanzas');
    if (stanzas) stanzas.innerHTML = '<p class="loading-state">Carga una obra o pega un JSON arriba.</p>';
    obraActiva = null;
  });

  document.getElementById('btn-select-all-cats')?.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-chip').forEach(btn => {
      btn.classList.add('active');
      btn.classList.remove('inactive');
      alternarVisibilidadCapa(btn.dataset.layerId, true);
    });
  });

  document.getElementById('btn-deselect-all-cats')?.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-chip').forEach(btn => {
      btn.classList.remove('active');
      btn.classList.add('inactive');
      alternarVisibilidadCapa(btn.dataset.layerId, false);
    });
  });

  const levelBtns = document.querySelectorAll('.level-btn');
  const levelBadge = document.getElementById('levelIndicatorBadge');

  levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      levelBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      nivelLecturaActual = btn.dataset.level || 'short';
      if (levelBadge) {
        levelBadge.textContent = nivelLecturaActual === 'deep' ? 'Modo Edición Crítica' : 'Modo Lectura Básica';
      }
    });
  });

  document.addEventListener('click', (e) => {
    const targetNodo = e.target.closest('[data-node], .meta-link');
    if (!targetNodo) return;

    const nodeId = targetNodo.getAttribute('data-node');
    if (!nodeId || !obraActiva || !obraActiva.interactiveNodes) return;

    const datosNodo = obraActiva.interactiveNodes[nodeId];
    if (datosNodo) abrirModalAnotacion(datosNodo);
  });

  document.getElementById('modal-close-btn')?.addEventListener('click', cerrarModal);
  document.getElementById('annotation-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'annotation-modal') cerrarModal();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cargarMenuObras();
  inicializarEventos();

  // --- Conectar el botón visible con el input de archivo oculto ---
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
          
          if (typeof renderizarTextoAnotado === 'function') {
            renderizarTextoAnotado(datos);
          } else if (typeof cargarEstructuraJSON === 'function') {
            cargarEstructuraJSON(datos);
          }

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
