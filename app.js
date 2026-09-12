/**
 * Visor de Lectura Intermitente e Interactiva para Ediciones Críticas
 * Incluye: precarga de imágenes, estado de carga (skeleton/placeholder),
 * selector de niveles duales (short/deep), accesibilidad ARIA y filtrado de medios.
 */

// Leer la URL (ej: visor.html?file=egloga_1.json)

const urlParams = new URLSearchParams(window.location.search);
const jsonFile = urlParams.get('file') || 'default.json'; // valor por defecto

async function inicializarVisor() {
  const response = await fetch(`./obras/${filename}`);
  const data = await response.json();
  renderizarVisor(data);
}

inicializarVisor();

const LEVEL_CONFIG = {
  short: {
    label: "Modo Lectura Rápida",
    className: "short-mode"
  },
  deep: {
    label: "Modo Edición Crítica",
    className: "deep-mode"
  }
};

const STOPWORDS = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","en","con",
  "por","para","que","al","lo","y","o","a","e","i","su","sus","es","son",
  "se","si","no","muy","más","menos","como","cuando","donde","cual",
  "cuyo","cuya","cuyos","cuyas","este","esta","estos","estas","ese","esa",
  "esos","esas","aquel","aquella","aquellos","aquellas","aquello",
  "mío","tuyo","suyo","nuestro","vuestro","me","te","le","nos","os","les",
  "mi","tu","ha","han","fue","ser","era","será","the","of","in","on","at","with","and","or","an"
]);

class InteractiveReaderApp {
  constructor() {
    this.data = null;
    this.activeCategories = new Set(['author', 'period', 'vocabulary', 'culture', 'syntax', 'analysis']);
    this.currentAnnotationLevel = 'short';
    this.currentImageFetchController = null;
    
    this.defaultCategoryTranslations = {
      es: { author: 'Autor', period: 'Época', vocabulary: 'Vocabulario', culture: 'Cultura', syntax: 'Sintaxis', analysis: 'Análisis' },
      en: { author: 'Author', period: 'Period', vocabulary: 'Vocabulary', culture: 'Culture', syntax: 'Syntax', analysis: 'Analysis' }
    };

    this.sampleData = {
      meta: {
        title: "Égloga I (Fragmento)",
        author: "Garcilaso de la Vega",
        authorNodeId: "node_garcilaso",
        period: "Renacimiento Siglo de Oro",
        periodNodeId: "node_renacimiento",
        year: "1543",
        lang: "es"
      },
      categoryLabels: {
        author: "Autor",
        period: "Época",
        vocabulary: "Vocabulario",
        culture: "Cultura",
        syntax: "Sintaxis",
        analysis: "Análisis Métrico"
      },
      stanzas: [
        "<p>El <span class=\"interactive-word\" data-node=\"node_garcilaso\" data-category=\"author\">salir de un monte</span> con el <span class=\"interactive-word\" data-node=\"node_sol\" data-category=\"vocabulary\">Apolo</span> Febo,<br>al encender del día la <span class=\"interactive-word\" data-node=\"node_luz\" data-category=\"culture\">clara antorcha</span>,<br>reverdece el campo y renueva el mundo.</p>",
        "<p>Saliendo del monte el <span class=\"interactive-word\" data-node=\"node_pastor\" data-category=\"analysis\">dulce lamentar</span> de dos pastores,<br><span class=\"interactive-word\" data-node=\"node_salicio\" data-category=\"author\">Salicio</span> juntamente y <span class=\"interactive-word\" data-node=\"node_nemoroso\" data-category=\"author\">Nemoroso</span>,<br>he de cantar sus quejas y amores.</p>"
      ],
      interactiveNodes: {
        node_garcilaso: {
          type: "author",
          category: "author",
          label: "Garcilaso de la Vega",
          title: "Garcilaso de la Vega",
          definition: "Poeta y militar español del Renacimiento (1501-1536).",
          content: "<p>Junto a Juan Boscán, introdujo el verso endecasílabo y las formas petrarquistas en la poesía española del Siglo de Oro.</p>",
          annotations: {
            short: {
              definition: "Poeta y militar español del Renacimiento (1501-1536).",
              content: "<p>Introdujo el verso endecasílabo y las formas petrarquistas en la poesía española.</p>"
            },
            deep: {
              definition: "Máximo exponente de la lírica renacentista castellana de adopción petrarquista.",
              content: "<p>Junto a <em>Juan Boscán</em>, aclimató la métrica italiana (endecasílabos, sonetos, liras) renovando la poesía del Siglo de Oro.</p>"
            }
          },
          wikipediaArticle: "Garcilaso_de_la_Vega",
          visualConceptType: "portrait",
          imageSearchQuery: "Garcilaso de la Vega portrait",
          imageDescription: "Retrato histórico de Garcilaso de la Vega",
          imageVisualKeywords: ["Garcilaso de la Vega", "poeta renacentista"],
          youtubeSearchQuery: "Garcilaso de la Vega Egloga 1 explicacion"
        },
        node_renacimiento: {
          type: "period",
          category: "period",
          label: "Renacimiento Siglo de Oro",
          title: "Renacimiento Siglo de Oro",
          definition: "Movimiento cultural e intelectual europeo (ss. XV-XVI).",
          content: "<p>Se caracteriza por la asimilación de las formas métricas italianas y el redescubrimiento del humanismo clásico.</p>",
          annotations: {
            short: {
              definition: "Movimiento cultural e intelectual europeo (ss. XV-XVI).",
              content: "<p>Se caracteriza por la asimilación de las formas métricas italianas y el humanismo.</p>"
            },
            deep: {
              definition: "Periodo de florecimiento artístico y literario influido por el humanismo italiano.",
              content: "<p>Supuso un cambio de paradigma estético con el redescubrimiento de los clásicos y la centralidad del ser humano.</p>"
            }
          },
          wikipediaArticle: "Renacimiento_español",
          visualConceptType: "artwork",
          imageSearchQuery: "Renacimiento espanol arte",
          imageDescription: "Pintura del Renacimiento español",
          imageVisualKeywords: ["Renacimiento espanol", "arte renacentista"],
          youtubeSearchQuery: "Renacimiento espanol literatura"
        },
        node_sol: {
          type: "vocabulary",
          category: "vocabulary",
          label: "Apolo Febo",
          title: "Febo / Apolo",
          definition: "Dios del Sol y de la poesía en la mitología grecolatina.",
          content: "<p>'Febo' es una metonimia habitual para referirse a la luz solar y la inspiración poética.</p>",
          wikipediaArticle: "Apolo",
          visualConceptType: "artwork",
          imageSearchQuery: "Apolo estatua",
          imageDescription: "Estatua clásica del dios Apolo",
          imageVisualKeywords: ["Apolo dios", "Apolo escultura"],
          youtubeSearchQuery: "Apolo mitologia griega"
        },
        node_luz: {
          type: "culture",
          category: "culture",
          label: "clara antorcha",
          title: "Clara Antorcha",
          definition: "Metáfora clasicista referente al sol despuntando en el horizonte.",
          content: "<p>Estructura metafórica refinada propia de la égloga donde la antorcha simboliza el astro solar iluminando la naturaleza.</p>",
          wikipediaArticle: "Soria",
          locationAnchor: "Soria",
          visualConceptType: "landscape",
          imageSearchQuery: "Soria panorama paisaje vista general",
          imageDescription: "Vista general del paisaje de Soria",
          imageVisualKeywords: ["Soria panorama", "vista general Soria", "Soria campo"],
          youtubeSearchQuery: "Renacimiento español literatura"
        },
        node_pastor: {
          type: "analysis",
          category: "analysis",
          label: "dulce lamentar",
          title: "Lamentar de dos pastores",
          definition: "Tópico de la égloga pastoril.",
          content: "<p>Diálogo estilizado entre Salicio y Nemoroso que dramatiza el dolor amoroso en un marco natural idealizado (<em>locus amoenus</em>).</p>",
          wikipediaArticle: "Égloga",
          visualConceptType: "artwork",
          imageSearchQuery: "pastores bucolica pintura",
          imageDescription: "Pintura bucólica con pastores en el campo",
          imageVisualKeywords: ["pastores bucolica", "égloga"],
          youtubeSearchQuery: "Egloga literatura analisis"
        }
      }
    };

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.jsonInput = document.getElementById('json-input');
    this.btnLoadJson = document.getElementById('btn-load-json');
    this.btnSampleJson = document.getElementById('btn-sample-json');
    this.btnClearJson = document.getElementById('btn-clear-json');

    this.annotationLevelSelect = document.getElementById('annotation-level-select');
    this.levelIndicatorBadge = document.getElementById('levelIndicatorBadge');

    this.docTitle = document.getElementById('doc-title');
    this.docAuthor = document.getElementById('doc-author');
    this.docPeriod = document.getElementById('doc-period');
    this.docYear = document.getElementById('doc-year');
    this.stanzasContainer = document.getElementById('text-stanzas');
    this.categoryFilterBar = document.getElementById('category-filter-bar');
    this.btnSelectAll = document.getElementById('btn-select-all-cats');
    this.btnDeselectAll = document.getElementById('btn-deselect-all-cats');

    this.modal = document.getElementById('annotation-modal');
    this.modalCategory = document.getElementById('modal-category');
    this.modalTitle = document.getElementById('modal-title');
    this.modalImgWrapper = document.getElementById('modal-image-wrapper');
    this.modalImg = document.getElementById('modal-image');
    this.modalCaption = document.getElementById('modal-image-caption');
    this.modalDefinition = document.getElementById('modal-definition');
    this.modalContent = document.getElementById('modal-content');
    this.modalLinksContainer = document.getElementById('modal-links');
    this.modalCloseBtn = document.getElementById('modal-close-btn');

    this.lastFocusedElement = null;
  }

  bindEvents() {
    if (this.btnLoadJson) this.btnLoadJson.addEventListener('click', () => this.parseAndRenderFromInput());
    if (this.btnSampleJson) {
      this.btnSampleJson.addEventListener('click', () => {
        if (this.jsonInput) this.jsonInput.value = JSON.stringify(this.sampleData, null, 2);
        this.data = this.sampleData;
        this.render();
      });
    }

    if (this.btnClearJson) {
      this.btnClearJson.addEventListener('click', () => {
        if (this.jsonInput) this.jsonInput.value = '';
        this.data = null;
        if (this.stanzasContainer) {
          this.stanzasContainer.innerHTML = `<p class="loading-state">Cajetín limpiado. Pega una nueva estructura JSON arriba para visualizar el texto.</p>`;
        }
        if (this.docTitle) this.docTitle.textContent = 'Edición Crítica';
        if (this.docAuthor) this.docAuthor.innerHTML = '';
        if (this.docPeriod) this.docPeriod.innerHTML = '';
        if (this.docYear) this.docYear.textContent = '';
      });
    }

    if (this.annotationLevelSelect) {
      this.annotationLevelSelect.addEventListener('change', (e) => {
        this.setAnnotationLevel(e.target.value);
      });
    }

    document.querySelectorAll('.level-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const selectedLevel = e.target.getAttribute('data-level');
        document.querySelectorAll('.level-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.setAnnotationLevel(selectedLevel);
      });
    });

    if (this.modalCloseBtn) this.modalCloseBtn.addEventListener('click', () => this.closeModal());
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (this.modal && !this.modal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          this.closeModal();
        } else if (e.key === 'Tab') {
          this.handleModalTab(e);
        }
      }
    });

    if (this.btnSelectAll) this.btnSelectAll.addEventListener('click', () => this.setAllCategories(true));
    if (this.btnDeselectAll) this.btnDeselectAll.addEventListener('click', () => this.setAllCategories(false));

    const triggerNode = (target) => {
      if (!target) return;
      const category = target.getAttribute('data-category');
      if (category && !this.activeCategories.has(category)) return;
      if (target.classList.contains('level-disabled') || target.classList.contains('category-disabled')) return;

      const nodeId = target.getAttribute('data-node');
      this.handleNodeClick(nodeId, target);
    };

    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-node]');
      if (target) triggerNode(target);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target.closest('[data-node]');
        if (target) {
          e.preventDefault();
          triggerNode(target);
        }
      }
    });
  }

  setAnnotationLevel(level) {
    this.currentAnnotationLevel = level;
    this.updateLevelBadge(level);
    this.applyCategoryFilters();
  }

  updateLevelBadge(currentLevel) {
    if (!this.levelIndicatorBadge) return;
    const config = LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG.short;
    this.levelIndicatorBadge.textContent = config.label;
    this.levelIndicatorBadge.classList.remove('short-mode', 'deep-mode');
    this.levelIndicatorBadge.classList.add(config.className);
  }

  handleModalTab(e) {
    const focusableElements = this.modal.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }

  parseAndRenderFromInput() {
    if (!this.jsonInput) return;
    const rawVal = this.jsonInput.value.trim();
    if (!rawVal) {
      alert('Por favor, pega una estructura JSON en el cajetín.');
      return;
    }

    try {
      this.data = JSON.parse(rawVal);
      this.render();
    } catch (err) {
      alert('Error de formato en el JSON: ' + err.message);
    }
  }

  render() {
    if (!this.data) return;

    if (this.data.meta) {
      if (this.docTitle) this.docTitle.textContent = this.data.meta.title || 'Edición Crítica';
      this.renderMetaItem(this.docAuthor, this.data.meta.author, 'author', this.data.meta.authorNodeId || this.data.meta.authorNode || 'node_author');
      this.renderMetaItem(this.docPeriod, this.data.meta.period, 'period', this.data.meta.periodNodeId || this.data.meta.periodNode || 'node_period');
      if (this.docYear) this.docYear.textContent = this.data.meta.year ? `(${this.data.meta.year})` : '';
    }

    if (this.stanzasContainer) {
      let rawStanzas = '';
      if (Array.isArray(this.data.stanzas)) {
        rawStanzas = this.data.stanzas.join('');
      } else if (typeof this.data.stanzas === 'string') {
        rawStanzas = this.data.stanzas;
      }
      this.stanzasContainer.innerHTML = this.sanitizeHtml(rawStanzas);
    }

    this.renderCategoryFilters();
    this.updateLevelBadge(this.currentAnnotationLevel);
    this.applyCategoryFilters();
  }

  sanitizeHtml(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const allowedTags = new Set(['P', 'SPAN', 'BR', 'EM', 'STRONG', 'B', 'I', 'DIV']);
    const allowedAttrs = new Set(['data-node', 'data-category', 'data-level', 'class', 'id', 'role', 'tabindex', 'aria-label', 'aria-haspopup']);

    const cleanNode = (node) => {
      const children = Array.from(node.childNodes);
      children.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!allowedTags.has(child.tagName)) {
            const textNode = doc.createTextNode(child.textContent);
            node.replaceChild(textNode, child);
          } else {
            Array.from(child.attributes).forEach(attr => {
              if (!allowedAttrs.has(attr.name.toLowerCase())) {
                child.removeAttribute(attr.name);
              }
            });
            cleanNode(child);
          }
        }
      });
    };

    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  renderMetaItem(containerEl, textValue, categoryKey, explicitNodeId) {
    if (!containerEl) return;
    if (!textValue) {
      containerEl.innerHTML = '';
      return;
    }

    const nodeId = this.findNodeIdForMeta(textValue, categoryKey, explicitNodeId);
    if (nodeId) {
      const nodeData = this.data.interactiveNodes ? this.data.interactiveNodes[nodeId] : null;
      const levelAttr = nodeData && nodeData.level ? `data-level="${nodeData.level}"` : '';
      const catLabel = this.getCategoryLabel(categoryKey);
      containerEl.innerHTML = `<span data-node="${nodeId}" data-category="${categoryKey}" ${levelAttr} role="button" tabindex="0" aria-label="${this.escapeHtml(textValue)} (${catLabel})">${this.escapeHtml(textValue)}</span>`;
    } else {
      containerEl.textContent = textValue;
    }
  }

  findNodeIdForMeta(textValue, categoryKey, explicitNodeId) {
    if (!this.data || !this.data.interactiveNodes) return null;
    if (explicitNodeId && this.data.interactiveNodes[explicitNodeId]) return explicitNodeId;
    if (this.data.interactiveNodes[textValue]) return textValue;

    const entries = Object.entries(this.data.interactiveNodes);
    const titleMatch = entries.find(([id, node]) => {
      const cat = node.category || node.type;
      return cat === categoryKey && (
        (node.title && textValue.toLowerCase().includes(node.title.toLowerCase())) ||
        (node.label && textValue.toLowerCase().includes(node.label.toLowerCase()))
      );
    });
    if (titleMatch) return titleMatch[0];

    const categoryMatch = entries.find(([id, node]) => (node.category || node.type) === categoryKey);
    return categoryMatch ? categoryMatch[0] : null;
  }

  getCategoryLabel(categoryKey) {
    if (!categoryKey) return 'Anotación';
    if (this.data && this.data.categoryLabels && this.data.categoryLabels[categoryKey]) {
      return this.data.categoryLabels[categoryKey];
    }
    const lang = (this.data && this.data.meta && this.data.meta.lang) || 'es';
    const langDict = this.defaultCategoryTranslations[lang] || this.defaultCategoryTranslations['es'];
    return langDict[categoryKey] || categoryKey.toUpperCase();
  }

  renderCategoryFilters() {
    if (!this.categoryFilterBar) return;
    const presentCategories = new Set();
    if (this.data && this.data.interactiveNodes) {
      Object.values(this.data.interactiveNodes).forEach(node => {
        const cat = node.category || node.type;
        if (cat) presentCategories.add(cat);
      });
    }

    if (presentCategories.size === 0) {
      ['author', 'period', 'vocabulary', 'culture', 'syntax', 'analysis'].forEach(c => presentCategories.add(c));
    }

    this.categoryFilterBar.innerHTML = '';
    presentCategories.forEach(catKey => {
      const label = this.getCategoryLabel(catKey);
      const isActive = this.activeCategories.has(catKey);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `filter-chip ${isActive ? 'active' : 'inactive'}`;
      chip.setAttribute('data-category', catKey);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      chip.innerHTML = `<span class="chip-dot"></span><span>${label}</span>`;
      chip.addEventListener('click', () => this.toggleCategory(catKey));
      this.categoryFilterBar.appendChild(chip);
    });
  }

  toggleCategory(categoryKey) {
    if (this.activeCategories.has(categoryKey)) {
      this.activeCategories.delete(categoryKey);
    } else {
      this.activeCategories.add(categoryKey);
    }
    this.updateCategoryFilterUI();
    this.applyCategoryFilters();
  }

  setAllCategories(activate) {
    if (!this.data || !this.data.interactiveNodes) return;
    if (activate) {
      Object.values(this.data.interactiveNodes).forEach(node => {
        const cat = node.category || node.type;
        if (cat) this.activeCategories.add(cat);
      });
    } else {
      this.activeCategories.clear();
    }
    this.updateCategoryFilterUI();
    this.applyCategoryFilters();
  }

  updateCategoryFilterUI() {
    if (!this.categoryFilterBar) return;
    const chips = this.categoryFilterBar.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      const cat = chip.getAttribute('data-category');
      const isActive = this.activeCategories.has(cat);
      chip.className = `filter-chip ${isActive ? 'active' : 'inactive'}`;
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  applyCategoryFilters() {
    const interactiveElements = document.querySelectorAll('[data-node]');
    interactiveElements.forEach(el => {
      const cat = el.getAttribute('data-category');
      const nodeId = el.getAttribute('data-node');

      const categoryDisabled = cat && !this.activeCategories.has(cat);
      if (categoryDisabled) {
        el.classList.add('category-disabled');
        el.removeAttribute('role');
        el.removeAttribute('tabindex');
        el.removeAttribute('aria-label');
      } else {
        el.classList.remove('category-disabled');
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        const nodeData = this.data && this.data.interactiveNodes ? this.data.interactiveNodes[nodeId] : null;
        const titleText = nodeData ? nodeData.title || nodeData.label || el.textContent : el.textContent;
        const catLabel = this.getCategoryLabel(cat);
        el.setAttribute('aria-label', `${titleText} (${catLabel})`);
      }
    });
  }

  handleNodeClick(nodeId, triggerElement) {
    if (!this.data || !this.data.interactiveNodes) return;
    const nodeData = this.data.interactiveNodes[nodeId];
    if (!nodeData) return;

    this.lastFocusedElement = triggerElement;
    this.openModal(nodeData);
  }

  async openModal(nodeData) {
    if (!this.modal) return;

    if (this.currentImageFetchController) {
      this.currentImageFetchController.abort();
    }
    this.currentImageFetchController = new AbortController();

    const catKey = nodeData.category || nodeData.type || 'analysis';
    const translatedCatName = this.getCategoryLabel(catKey);

    if (this.modalCategory) {
      this.modalCategory.textContent = translatedCatName;
      this.modalCategory.setAttribute('data-category', catKey);
    }

    const rawTitle = nodeData.title || nodeData.label || 'Anotación';
    if (this.modalTitle) this.modalTitle.textContent = rawTitle;

    let definitionText = '';
    let contentText = '';

    if (nodeData.annotations) {
      const activeAnnotation = nodeData.annotations[this.currentAnnotationLevel] || nodeData.annotations['short'] || nodeData.annotations['deep'];
      if (activeAnnotation) {
        definitionText = activeAnnotation.definition || nodeData.definition || '';
        contentText = activeAnnotation.content || nodeData.content || '';
      }
    } else {
      definitionText = nodeData.definition || '';
      contentText = nodeData.content || '';
    }

    if (this.modalDefinition) {
      this.modalDefinition.textContent = definitionText;
      this.modalDefinition.style.display = definitionText ? 'block' : 'none';
    }
    if (this.modalContent) {
      this.modalContent.innerHTML = contentText || '';
    }

    // Muestra el Skeleton / Placeholder inmediatamente al abrir el modal
    this.showImagePlaceholder("Buscando y cargando imagen representativa...");
    this.renderExternalLinks(nodeData);

    this.modal.classList.remove('hidden');
    if (this.modalCloseBtn) this.modalCloseBtn.focus();

    await this.resolveAndDisplayImage(nodeData, this.currentImageFetchController.signal);
  }

  closeModal() {
    if (!this.modal) return;

    if (this.currentImageFetchController) {
      this.currentImageFetchController.abort();
      this.currentImageFetchController = null;
    }

    this.modal.classList.add('hidden');
    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      this.lastFocusedElement.focus();
    }
  }

  renderExternalLinks(nodeData) {
    if (!this.modalLinksContainer) return;

    const lang = nodeData.wikiLang || (this.data && this.data.meta && this.data.meta.lang) || 'es';
    const wikiArticle = nodeData.wikipediaArticle || nodeData.wikiArticle || nodeData.wiki;
    const wikiUrl = wikiArticle ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(wikiArticle.trim().replace(/\s+/g, '_'))}` : null;
    
    const ytQuery = nodeData.youtubeSearchQuery || nodeData.youtubeQuery || nodeData.youtube;
    const ytUrl = ytQuery ? `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}` : null;

    let html = '';
    if (wikiUrl) {
      html += `<a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="link-item">🌐 Leer en Wikipedia: "${this.escapeHtml(wikiArticle)}"</a>`;
    }
    if (ytUrl) {
      html += `<a href="${ytUrl}" target="_blank" rel="noopener noreferrer" class="link-item">▶️ Buscar vídeos en YouTube: "${this.escapeHtml(ytQuery)}"</a>`;
    }

    this.modalLinksContainer.innerHTML = html;
    this.modalLinksContainer.classList.toggle('hidden', !html);
  }

  // =========================================================================
  //  SKELETON, PRECARGA Y GESTIÓN DE PLACEHOLDERS
  // =========================================================================

  showImagePlaceholder(message = "Cargando imagen...") {
    if (!this.modalImgWrapper) return;
    this.modalImgWrapper.classList.remove('hidden');
    this.modalImgWrapper.classList.add('is-loading');
    
    if (this.modalImg) {
      this.modalImg.style.display = 'none';
      this.modalImg.src = '';
    }
    if (this.modalCaption) {
      this.modalCaption.textContent = message;
    }
  }

  preloadImage(src, signal = null) {
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

  async showImageWithPreload(src, caption, sourceBadge = null, signal = null) {
    try {
      await this.preloadImage(src, signal);
      if (signal && signal.aborted) return;

      if (this.modalImgWrapper && this.modalImg) {
        this.modalImgWrapper.classList.remove('is-loading');
        this.modalImg.src = src;
        this.modalImg.alt = caption || 'Imagen representativa';
        this.modalImg.style.display = 'block';

        if (this.modalCaption) {
          const badgeText = sourceBadge ? `[${sourceBadge}] ` : '';
          this.modalCaption.textContent = `${badgeText}${caption || ''}`;
        }
      }
    } catch (err) {
      if (!signal || !signal.aborted) {
        this.hideImage();
      }
    }
  }

  showImage(src, caption, sourceBadge = null) {
    this.showImageWithPreload(src, caption, sourceBadge, this.currentImageFetchController?.signal);
  }

  hideImage() {
    if (this.modalImgWrapper) {
      this.modalImgWrapper.classList.add('hidden');
      this.modalImgWrapper.classList.remove('is-loading');
    }
    if (this.modalImg) {
      this.modalImg.src = '';
      this.modalImg.style.display = 'none';
    }
    if (this.modalCaption) this.modalCaption.textContent = '';
  }

  // =========================================================================
  //  MOTOR DE BÚSQUEDA Y FILTRADO AVANZADO DE IMÁGENES
  // =========================================================================

  extractKeywords(query, maxN = 3) {
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

  normalizeMediaTitle(title) {
    if (!title) return "";
    return title.replace(/^File:/i, "").replace(/\.[a-zA-Z0-9]{2,5}$/, "").replace(/_/g, " ");
  }

  isMapOrDiagram(str) {
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

  isDocumentOrScan(str) {
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

  isFaunaFloraOrMacro(str) {
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

  isUnrelatedGeography(str, targetLocation = null) {
    if (!str) return false;
    const s = str.toLowerCase();

    const foreignGeographies = [
      'portugal', 'portuguese', 'porto', 'lisboa', 'alentejo', 'algarve',
      'italy', 'italia', 'italian', 'france', 'francia', 'french',
      'greece', 'grecia', 'turkey', 'turquia', 'morocco', 'marruecos',
      'mexico', 'argentina', 'chile', 'peru', 'brazil', 'brasil'
    ];

    if (targetLocation && targetLocation.toLowerCase().includes('soria')) {
      const unrelatedSpanishRegions = ['andalucia', 'galicia', 'canarias', 'baleares', 'catalunya', 'asturias'];
      if (unrelatedSpanishRegions.some(region => s.includes(region))) return true;
    }

    return foreignGeographies.some(geo => s.includes(geo));
  }

  isValidForConceptType(identifier, conceptType, targetLocation = null) {
    if (!identifier) return false;
    const lower = identifier.toLowerCase();

    if (this.isDocumentOrScan(lower)) return false;

    if (conceptType === 'landscape') {
      if (this.isMapOrDiagram(lower)) return false;
      if (this.isFaunaFloraOrMacro(lower)) return false;
      if (this.isUnrelatedGeography(lower, targetLocation)) return false;

      const portraitKeywords = ['portrait', 'retrato', 'man', 'woman', 'profile', 'face', 'bust'];
      if (portraitKeywords.some(kw => lower.includes(kw))) return false;

    } else if (conceptType === 'artwork') {
      if (this.isMapOrDiagram(lower)) return false;

    } else if (conceptType === 'portrait' || conceptType === 'author') {
      if (this.isMapOrDiagram(lower)) return false;
      if (this.isFaunaFloraOrMacro(lower)) return false;

      const nonPortraitKeywords = ['landscape', 'paisaje', 'flag', 'bandera', 'coat of arms', 'escudo'];
      if (nonPortraitKeywords.some(kw => lower.includes(kw))) return false;
    }

    return true;
  }

  pickRelevant(candidates, query, conceptType = null, targetLocation = null) {
    const queryTokens = this.extractKeywords(query, 20);
    
    if (targetLocation) {
      const locLower = targetLocation.toLowerCase();
      const locMatch = candidates.find(c => {
        const normTitle = this.normalizeMediaTitle(c.title || "").toLowerCase();
        const fullRef = `${normTitle} ${c.url || ''}`;
        return normTitle.includes(locLower) && this.isValidForConceptType(fullRef, conceptType, targetLocation);
      });
      if (locMatch) return locMatch;
    }

    for (const c of candidates) {
      const normTitle = this.normalizeMediaTitle(c.title || "");
      const fullRef = `${normTitle} ${c.url || ''}`;

      if (!this.isValidForConceptType(fullRef, conceptType, targetLocation)) continue;

      if (queryTokens.length === 0) return c;

      const titleTokens = new Set(this.extractKeywords(normTitle, 20));
      if (queryTokens.some(t => titleTokens.has(t))) return c;
    }

    if (conceptType) {
      return candidates.find(c => this.isValidForConceptType(`${c.title || ''} ${c.url || ''}`, conceptType, targetLocation)) || null;
    }

    return candidates[0] || null;
  }

  async fetchWikipediaRestImage(title, lang, conceptType = null, targetLocation = null, signal = null) {
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

      const isConceptValid = this.isValidForConceptType(`${src} ${data.title || ''}`, conceptType, targetLocation);
      if (!isConceptValid) return null;

      return { url: src, source: `Wikipedia (${lang.toUpperCase()})`, title: data.title };
    } catch (e) {
      return null;
    }
  }

  async fetchWikipediaAllImages(article, lang, conceptType = null, targetLocation = null, signal = null) {
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
        .filter(t => this.isValidForConceptType(t, conceptType, targetLocation));

      const results = [];
      for (const t of titles.slice(0, 8)) {
        if (signal && signal.aborted) break;
        const imgUrl = await this.fetchCommonsFilePath(t, signal);
        if (imgUrl && this.isValidForConceptType(imgUrl, conceptType, targetLocation)) {
          results.push({ url: imgUrl, source: `Wikipedia Images (${lang.toUpperCase()})`, title: t });
        }
      }
      return results;
    } catch (e) {
      return [];
    }
  }

  async fetchCommonsFilePath(fileTitle, signal = null) {
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

  async commonsFullTextSearch(query, conceptType = null, signal = null) {
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

  async openverseSearch(query, signal = null) {
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

  async resolveAndDisplayImage(nodeData, signal = null) {
    const captionText = nodeData.imageDescription || nodeData.caption || nodeData.label || nodeData.title || '';
    const categoryKey = nodeData.category || nodeData.type;
    const conceptType = nodeData.visualConceptType || (categoryKey === 'author' ? 'portrait' : null);
    const locationAnchor = nodeData.locationAnchor || (nodeData.wikipediaArticle === "Soria" ? "Soria" : null);

    const directUrl = nodeData.imageUrl || nodeData.image || (nodeData.media && nodeData.media.type === 'image' ? nodeData.media.url : null);
    if (directUrl && typeof directUrl === 'string' && directUrl.trim() !== '') {
      await this.showImageWithPreload(directUrl, captionText, "Enlace directo", signal);
      return;
    }

    const primaryLang = nodeData.wikiLang || (this.data && this.data.meta && this.data.meta.lang) || 'es';
    const wikiArticle = nodeData.wikipediaArticle || nodeData.wikiArticle || nodeData.wiki;

    if (wikiArticle) {
      let res = await this.fetchWikipediaRestImage(wikiArticle, primaryLang, conceptType, locationAnchor, signal);
      if (signal && signal.aborted) return;
      if (res && this.isTechnicallyValidImage(res.url)) {
        await this.showImageWithPreload(res.url, captionText || res.title, res.source, signal);
        return;
      }

      if (primaryLang !== 'en') {
        res = await this.fetchWikipediaRestImage(wikiArticle, 'en', conceptType, locationAnchor, signal);
        if (signal && signal.aborted) return;
        if (res && this.isTechnicallyValidImage(res.url)) {
          await this.showImageWithPreload(res.url, captionText || res.title, res.source, signal);
          return;
        }
      }

      const internalImgs = await this.fetchWikipediaAllImages(wikiArticle, primaryLang, conceptType, locationAnchor, signal);
      if (signal && signal.aborted) return;
      if (internalImgs.length > 0) {
        await this.showImageWithPreload(internalImgs[0].url, captionText || internalImgs[0].title, internalImgs[0].source, signal);
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
        `${locationPrefix}${this.extractKeywords(searchQuery, 3).join(" ")}`,
        keywords[0] ? `${locationPrefix}${keywords[0]}` : null,
        keywords[1] ? `${locationPrefix}${keywords[1]}` : null
      ];
    }

    queries = queries.filter(q => q && typeof q === 'string' && q.trim().length > 0);

    for (const q of queries) {
      if (signal && signal.aborted) return;
      const candidates = await this.commonsFullTextSearch(q, conceptType, signal);
      const match = this.pickRelevant(candidates, searchQuery || q, conceptType, locationAnchor);
      if (match && this.isTechnicallyValidImage(match.url)) {
        await this.showImageWithPreload(match.url, captionText || match.title, match.source, signal);
        return;
      }
    }

    for (const q of queries) {
      if (signal && signal.aborted) return;
      const candidates = await this.openverseSearch(q, signal);
      const match = this.pickRelevant(candidates, searchQuery || q, conceptType, locationAnchor);
      if (match && this.isTechnicallyValidImage(match.url)) {
        await this.showImageWithPreload(match.url, captionText || match.title, match.source, signal);
        return;
      }
    }

    if (!signal || !signal.aborted) {
      this.hideImage();
    }
  }

  isTechnicallyValidImage(url) {
    if (!url || typeof url !== 'string') return false;
    const lowerUrl = url.toLowerCase();
    const forbiddenExtensions = ['.svg', '.pdf', '.tiff', '.djvu'];
    const forbiddenTerms = ['commons-logo', 'wikinews-logo', 'symbol_question', 'edit-clear', 'icon', 'logo_of', 'p_phoneme'];

    if (forbiddenExtensions.some(ext => lowerUrl.endsWith(ext))) return false;
    if (forbiddenTerms.some(term => lowerUrl.includes(term))) return false;
    return true;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new InteractiveReaderApp();
});