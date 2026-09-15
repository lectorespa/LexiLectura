/**
 * Visor de Ediciones Críticas e Interactivas - Lógica Principal
 */

let obraActiva = null;
let nivelLecturaActual = 'short';

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
      "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Cantar_de_mio_Cid_f._1r.jpg/320px-Cantar_de_mio_Cid_f._1r.jpg",
      "imageCaption": "Manuscrito del Cantar de mio Cid (f. 1r)",
      "wikipediaArticle": "Cantar_de_mio_Cid",
      "youtubeUrl": "https://www.youtube.com/results?search_query=Cantar+de+mio+Cid+analisis+literario",
      "annotations": {
        "short": { "definition": "Autor desconocido del Mío Cid.", "content": "Obra cumbre del cantar de gesta hispánico." },
        "deep": { "definition": "Tradición juglaresca mester de juglaría.", "content": "Composición de transmisión oral preservada en manuscrito." }
      }
    },
    "node_period": {
      "type": "period",
      "category": "period",
      "title": "Contexto Medieval (Siglo XII-XIII)",
      "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Reconquista_1200.svg/320px-Reconquista_1200.svg.png",
      "imageCaption": "Península Ibérica hacia el año 1200",
      "wikipediaArticle": "Literatura_espa%C3%B1ola_del_Medievo",
      "youtubeUrl": "https://www.youtube.com/results?search_query=Contexto+historico+Cantar+de+mio+Cid",
      "annotations": {
        "short": { "definition": "Época de consolidación del castellano.", "content": "Contexto de Reconquista y difusión oral por medio de la juglaría." },
        "deep": { "definition": "Mester de juglaría y sociedad feudal.", "content": "Refleja los valores de honor, lealtad y vasallaje propios de la Edad Media hispánica." }
      }
    },
    "node_1": {
      "type": "syntax",
      "category": "syntax",
      "title": "De los sus ojos",
      "imageUrl": "",
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

  // 1. Encabezados y Metadatos
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

  // 2. Sincronizar el Área de Texto
  const jsonInput = document.getElementById('json-input');
  if (jsonInput && document.activeElement !== jsonInput) {
    jsonInput.value = JSON.stringify(datosObra, null, 2);
  }

  // 3. Renderizar Filtros
  renderizarFiltrosCategorias(datosObra);

  // 4. Renderizar Estrofas
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

function abrirModalAnotacion(datosNodo) {
  const modal = document.getElementById('annotation-modal');
  if (!modal || !datosNodo) return;

  const modalCat = document.getElementById('modal-category');
  const modalTitle = document.getElementById('modal-title');
  
  const capaObj = resolverCapa(datosNodo.type || datosNodo.category);
  const colorCategoria = capaObj ? capaObj.color : '#4A90E2';

  // --- FASE 2: Aplicación de color dinámico por categoría ---
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

  // --- FASE 3: Renderizado de imágenes con fallback ---
  const imgWrapper = document.getElementById('modal-image-wrapper');
  const imgElem = document.getElementById('modal-image');
  const imgCaption = document.getElementById('modal-image-caption');

  const urlImagen = datosNodo.imageUrl || datosNodo.image || anotacion.imageUrl;
  const captionImagen = datosNodo.imageCaption || datosNodo.imageDescription || anotacion.imageCaption || '';

  if (imgWrapper && urlImagen) {
    if (imgElem) {
      imgElem.src = urlImagen;
      imgElem.alt = captionImagen || datosNodo.title || 'Imagen explicativa';
      imgElem.style.display = 'block';
      imgElem.onerror = () => {
        imgWrapper.classList.add('hidden');
      };
    }
    if (imgCaption) imgCaption.textContent = captionImagen;
    imgWrapper.classList.remove('hidden');
  } else if (imgWrapper) {
    imgWrapper.classList.add('hidden');
  }

  // --- FASE 3: Renderizado de enlaces a Wikipedia y YouTube ---
  const modalLinks = document.getElementById('modal-links');
  if (modalLinks) {
    let htmlEnlaces = '';
    
    // Wikipedia
    const wikiRef = datosNodo.wikipediaArticle || datosNodo.wikipedia;
    if (wikiRef) {
      let urlWiki = wikiRef.startsWith('http') ? wikiRef : `https://${datosNodo.wikiLang || 'es'}.wikipedia.org/wiki/${encodeURIComponent(wikiRef)}`;
      htmlEnlaces += `<a href="${urlWiki}" target="_blank" rel="noopener noreferrer" class="link-item wiki-link">🌐 Ver en Wikipedia ↗</a>`;
    }

    // YouTube
    let urlYoutube = datosNodo.youtubeUrl;
    if (!urlYoutube && datosNodo.youtubeSearchQuery) {
      urlYoutube = `https://www.youtube.com/results?search_query=${encodeURIComponent(datosNodo.youtubeSearchQuery)}`;
    }

    if (urlYoutube) {
      htmlEnlaces += `<a href="${urlYoutube}" target="_blank" rel="noopener noreferrer" class="link-item youtube-link" style="color: #FF0000; font-weight: bold; margin-left: 10px;">📺 Ver en YouTube ↗</a>`;
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
}

function cerrarModal() {
  const modal = document.getElementById('annotation-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}

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
    const targetNodo = e.target.closest('[data-node]');
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
});
