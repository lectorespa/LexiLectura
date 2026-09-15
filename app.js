/**
 * Visor de Lectura Intermitente e Interactiva para Ediciones Críticas
 * Soporta esquemas JSON simples y avanzados multicapa (layers).
 */

const LEVEL_CONFIG = {
  short: {
    label: "Modo Lectura Básica",
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
      layers: [
        { layerId: "metrica_retorica", label: "Métrica y Recursos Estilísticos", color: "#4A90E2", defaultActive: true },
        { layerId: "simbologia_contexto", label: "Simbología y Contexto Cultural", color: "#2ECC71", defaultActive: true },
        { layerId: "vocabulario_lexico", label: "Vocabulario y Léxico", color: "#F39C12", defaultActive: true }
      ],
      stanzas: [
        "<p>El <span class=\"interactive-word\" data-node=\"node_garcilaso\" data-layer=\"simbologia_contexto\" data-category=\"author\">salir de un monte</span> con el <span class=\"interactive-word\" data-node=\"node_sol\" data-layer=\"vocabulario_lexico\" data-category=\"vocabulary\">Apolo</span> Febo,<br>al encender del día la <span class=\"interactive-word\" data-node=\"node_luz\" data-layer=\"simbologia_contexto\" data-category=\"culture\">clara antorcha</span>,<br>reverdece el campo y renueva el mundo.</p>",
        "<p>Saliendo del monte el <span class=\"interactive-word\" data-node=\"node_pastor\" data-layer=\"metrica_retorica\" data-category=\"analysis\">dulce lamentar</span> de dos pastores,<br><span class=\"interactive-word\" data-node=\"node_salicio\" data-layer=\"simbologia_contexto\" data-category=\"author\">Salicio</span> juntamente y <span class=\"interactive-word\" data-node=\"node_nemoroso\" data-layer=\"simbologia_contexto\" data-category=\"author\">Nemoroso</span>,<br>he de cantar sus quejas y amores.</p>"
      ],
      interactiveNodes: {
        node_garcilaso: {
          layerId: "simbologia_contexto",
          type: "author",
          category: "author",
          label: "Garcilaso de la Vega",
          title: "Garcilaso de la Vega",
          definition: "Poeta y militar español del Renacimiento (1501-1536).",
          content: "<p>Junto a Juan Boscán, introdujo el verso endecasílabo y las formas petrarquistas en la poesía española del Siglo de Oro.</p>",
          annotations: {
            short: {
              definition: "Poeta y militar español del Renacimiento (1501-1536).",
              content: "Introdujo el verso endecasílabo y las formas petrarquistas en la poesía española."
            },
            deep: {
              definition: "Máximo exponente de la lírica renacentista castellana de adopción petrarquista.",
              content: "Junto a <em>Juan Boscán</em>, aclimató la métrica italiana (endecasílabos, sonetos, liras) renovando la poesía del Siglo de Oro."
            }
          },
          wikipediaArticle: "Garcilaso_de_la_Vega",
          wikiLang: "es",
          visualConceptType: "portrait",
          imageSearchQuery: "Garcilaso de la Vega portrait",
          imageDescription: "Retrato histórico de Garcilaso de la Vega",
          imageVisualKeywords: ["Garcilaso de la Vega", "poeta renacentista"],
          youtubeSearchQuery: "Garcilaso de la Vega Egloga 1 explicacion"
        },
        node_renacimiento: {
          layerId: "simbologia_contexto",
          type: "period",
          category: "period",
          label: "Renacimiento Siglo de Oro",
          title: "Renacimiento Siglo de Oro",
          definition: "Movimiento cultural e intelectual europeo (ss. XV-XVI).",
          content: "<p>Se caracteriza por la asimilación de las formas métricas italianas y el redescubrimiento del humanismo clásico.</p>",
          annotations: {
            short: {
              definition: "Movimiento cultural e intelectual europeo (ss. XV-XVI).",
              content: "Se caracteriza por la asimilación de las formas métricas italianas y el humanismo."
            },
            deep: {
              definition: "Periodo de florecimiento artístico y literario influido por el humanismo italiano.",
              content: "Supuso un cambio de paradigma estético con el redescubrimiento de los clásicos y la centralidad del ser humano."
            }
          },
          wikipediaArticle: "Renacimiento_español",
          wikiLang: "es",
          visualConceptType: "artwork",
          imageSearchQuery: "Renacimiento espanol arte",
          imageDescription: "Pintura del Renacimiento español",
          imageVisualKeywords: ["Renacimiento espanol", "arte renacentista"],
          youtubeSearchQuery: "Renacimiento espanol literatura"
        },
        node_sol: {
          layerId: "vocabulario_lexico",
          type: "vocabulary",
          category: "vocabulary",
          label: "Apolo Febo",
          title: "Febo / Apolo",
          definition: "Dios del Sol y de la poesía en la mitología grecolatina.",
          content: "<p>'Febo' es una metonimia habitual para referirse a la luz solar y la inspiración poética.</p>",
          wikipediaArticle: "Apolo",
          wikiLang: "es",
          visualConceptType: "artwork",
          imageSearchQuery: "Apolo estatua",
          imageDescription: "Estatua clásica del dios Apolo",
          imageVisualKeywords: ["Apolo dios", "Apolo escultura"],
          youtubeSearchQuery: "Apolo mitologia griega"
        },
        node_luz: {
          layerId: "simbologia_contexto",
          type: "culture",
          category: "culture",
          label: "clara antorcha",
          title: "Clara Antorcha",
          definition: "Metáfora clasicista referente al sol despuntando en el horizonte.",
          content: "<p>Estructura metafórica refinada propia de la égloga donde la antorcha simboliza el astro solar iluminando la naturaleza.</p>",
          wikipediaArticle: "Soria",
          wikiLang: "es",
          locationAnchor: "Soria",
          visualConceptType: "landscape",
          imageSearchQuery: "Soria panorama paisaje vista general",
          imageDescription: "Vista general del paisaje de Soria",
          imageVisualKeywords: ["Soria panorama", "vista general Soria", "Soria campo"],
          youtubeSearchQuery: "Renacimiento español literatura"
        },
        node_pastor: {
          layerId: "metrica_retorica",
          type: "analysis",
          category: "analysis",
          label: "dulce lamentar",
          title: "Lamentar de dos pastores",
          definition: "Tópico de la égloga pastoril.",
          content: "<p>Diálogo estilizado entre Salicio y Nemoroso que dramatiza el dolor amoroso en un marco natural idealizado (<em>locus amoenus</em>).</p>",
          wikipediaArticle: "Égloga",
          wikiLang: "es",
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
          this.stanzasContainer.innerHTML = `<p class="loading-state">Cajetín limpiado. Selecciona una obra del catálogo o pega una estructura JSON arriba.</p>`;
        }
        if (this.docTitle) this.docTitle.textContent = 'Edición Crítica';
        if (this.docAuthor) this.docAuthor.innerHTML = '';
        if (this.docPeriod) this.docPeriod.innerHTML = '';
        if (this.docYear) this.docYear.textContent = '';
      });
    }

    document.querySelectorAll('.level-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const selectedLevel = e.target.getAttribute('data-level');
        document.querySelectorAll('.level-btn').forEach(btn => {
          btn.classList.remove('active');
          btn.setAttribute('aria-checked', 'false');
        });
        e.target.classList.add('active');
        e.target.setAttribute('aria-checked', 'true');
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
    if (!rawVal) return;

    try {
      this.data = JSON.parse(rawVal);
      this.render();
    } catch (err) {
      console.error("Error al parsear el código JSON:", err);
      alert('Error de formato en el JSON: ' + err.message);
    }
  }

  render() {
    if (!this.data) return;

    // Inyectar variables de color de capas en CSS si existen
    if (Array.isArray(this.data.layers)) {
      this.data.layers.forEach(layer => {
        if (layer.layerId && layer.color) {
          document.documentElement.style.setProperty(`--layer-${layer.layerId}`, layer.color);
        }
      });
    }

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
    const allowedTags = new Set(['P', 'SPAN', 'BR', 'EM', 'STRONG', 'B', 'I', 'DIV', 'HEADER', 'FOOTER', 'SECTION', 'ARTICLE']);
    const allowedAttrs = new Set([
      'data-node', 
      'data-category', 
      'data-layer', 
      'data-level', 
      'class', 
      'id', 
      'role', 
      'tabindex', 
      'aria-label', 
      'aria-haspopup'
    ]);

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
      const layerAttr = nodeData && nodeData.layerId ? `data-layer="${nodeData.layerId}"` : '';
      const catLabel = this.getCategoryLabel(categoryKey);
      containerEl.innerHTML = `<span data-node="${nodeId}" data-category="${categoryKey}" ${layerAttr} ${levelAttr} role="button" tabindex="0" aria-label="${this.escapeHtml(textValue)} (${catLabel})">${this.escapeHtml(textValue)}</span>`;
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

    this.showImagePlaceholder("Buscando y cargando imagen representativa...");
    this.renderExternalLinks(nodeData);

    this.modal.classList.remove('hidden');
    this.modal.setAttribute('aria-hidden', 'false');
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
    this.modal.setAttribute('aria-hidden', 'true');
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

    if (lower.includes('icon') || lower.includes('logo') || lower.includes('stub') || lower.includes('flag_of')) {
      if (conceptType !== 'flag' && conceptType !== 'symbol') return false;
    }

    if (this.isMapOrDiagram(lower) && conceptType !== 'map') return false;
    if (this.isDocumentOrScan(lower) && conceptType !== 'document') return false;
    if (this.isFaunaFloraOrMacro(lower) && conceptType !== 'nature' && conceptType !== 'botany') return false;
    if (this.isUnrelatedGeography(lower, targetLocation)) return false;

    switch (conceptType) {
      case 'portrait':
        return !this.isMapOrDiagram(lower) && !this.isDocumentOrScan(lower);
      case 'landscape':
        return !this.isMapOrDiagram(lower) && !this.isDocumentOrScan(lower) && !this.isFaunaFloraOrMacro(lower);
      case 'artwork':
        return !this.isMapOrDiagram(lower) && !this.isDocumentOrScan(lower);
      case 'map':
        return this.isMapOrDiagram(lower);
      default:
        return true;
    }
  }

  // =========================================================================
  //  RESOLUCIÓN DE IMÁGENES MEDIANTE WIKIPEDIA / WIKIMEDIA API
  // =========================================================================

  async resolveAndDisplayImage(nodeData, signal) {
    const directUrl = nodeData.imageUrl || nodeData.image || nodeData.img;
    if (directUrl) {
      const caption = nodeData.imageDescription || nodeData.title || nodeData.label;
      await this.showImageWithPreload(directUrl, caption, 'Directa', signal);
      return;
    }

    const lang = nodeData.wikiLang || (this.data && this.data.meta && this.data.meta.lang) || 'es';
    const wikiArticle = nodeData.wikipediaArticle || nodeData.wikiArticle || nodeData.wiki;

    if (wikiArticle) {
      try {
        const wikiImage = await this.fetchWikipediaImage(wikiArticle, lang, signal);
        if (wikiImage && this.isValidForConceptType(wikiImage.title || wikiImage.url, nodeData.visualConceptType, nodeData.locationAnchor)) {
          const caption = nodeData.imageDescription || nodeData.title || nodeData.label;
          await this.showImageWithPreload(wikiImage.url, caption, 'Wikipedia', signal);
          return;
        }
      } catch (err) {
        if (signal.aborted) return;
      }
    }

    const searchQuery = nodeData.imageSearchQuery || nodeData.title || nodeData.label;
    if (searchQuery) {
      try {
        const commonsImage = await this.searchCommonsImage(searchQuery, nodeData, signal);
        if (commonsImage) {
          const caption = nodeData.imageDescription || this.normalizeMediaTitle(commonsImage.title);
          await this.showImageWithPreload(commonsImage.url, caption, 'Wikimedia Commons', signal);
          return;
        }
      } catch (err) {
        if (signal.aborted) return;
      }
    }

    if (!signal.aborted) {
      this.hideImage();
    }
  }

  async fetchWikipediaImage(article, lang = 'es', signal = null) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(article)}&prop=pageimages&pithumbsize=800&format=json&origin=*`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    for (const pageId in pages) {
      const page = pages[pageId];
      if (page.thumbnail?.source) {
        return {
          url: page.thumbnail.source,
          title: page.title || article
        };
      }
    }
    return null;
  }

  async searchCommonsImage(query, nodeData, signal = null) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=10&format=json&origin=*`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const searchResults = data.query?.search;
    if (!searchResults || searchResults.length === 0) return null;

    const validResults = searchResults.filter(item => 
      this.isValidForConceptType(item.title, nodeData.visualConceptType, nodeData.locationAnchor)
    );

    if (validResults.length === 0) return null;

    const bestTitle = validResults[0].title;
    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(bestTitle)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
    
    const infoRes = await fetch(infoUrl, { signal });
    if (!infoRes.ok) return null;
    const infoData = await infoRes.json();
    const pages = infoData.query?.pages;
    if (!pages) return null;

    for (const pId in pages) {
      const imgInfo = pages[pId].imageinfo?.[0];
      if (imgInfo) {
        return {
          url: imgInfo.thumburl || imgInfo.url,
          title: bestTitle
        };
      }
    }

    return null;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.readerApp = new InteractiveReaderApp();
});
