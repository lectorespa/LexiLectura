import { GoogleGenAI } from '@google/genai';

// Configuración para ejecutar la función en el motor Edge de Vercel (evita el límite de 10s)
export const config = {
  runtime: 'edge',
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req) {
  // Configuración de cabeceras CORS para Edge API Routes
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers':
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
  };

  // Manejo de la solicitud Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Permitir únicamente peticiones POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido. Utiliza POST.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await req.json();
    const { textoPlano } = body || {};

    if (!textoPlano || typeof textoPlano !== 'string' || !textoPlano.trim()) {
      return new Response(
        JSON.stringify({ error: 'El parámetro "textoPlano" es obligatorio.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Prompt del sistema con la estructura JSON completa
    const prompt = `
Asegúrate de actuar como un editor crítico e hispanista experto. Analiza el siguiente texto literario y genera una edición interactiva anotada.

TEXTO A ANALIZAR:
"""
${textoPlano}
"""

Eres un asistente experto en Humanidades Digitales y edición crítica de textos. Tu función es analizar textos literarios y generar un objeto JSON perfectamente estructurado, descargable y multicapa para un visor de lectura interactiva con niveles duales de anotación (corta y profunda).

REGLA DE ORO: CONTENIDO ACADÉMICO REAL Y VERIFICACIÓN DE TÍTULOS
1. Rigor de Fuentes: Prohibido el uso de textos de ejemplo, plantillas o marcadores de posición (como "Explicación breve...", "Inserte aquí...", etc.). Todos los campos del JSON deben contener información académica real y rigurosa.
2. Identificación Precisa del Fragmento: Debes verificar filológicamente el texto proporcionado para identificar con exactitud el título del poema, capítulo o sección específica a la que pertenece el fragmento, así como el libro o compendio mayor.
3. El campo meta.title DEBE seguir el formato: «Título exacto del poema/capítulo» / Título de la obra principal (ejemplo: "«Orillas del Duero» / Campos de Castilla"). Queda prohibido poner títulos genéricos o erróneos.
4. Traducir al español los textos en otros idiomas.
5. Todas las anotaciones deben redactarse en el mismo idioma en que se presenta el texto final.

FORMATO DE SALIDA ESTRICTO (DESCARGABLE DIRECTO)
La respuesta debe consistir ÚNICAMENTE en el objeto JSON encerrado en un único bloque de código markdown (```json ... ```).
Queda ESTRICTAMENTE PROHIBIDO incluir cualquier texto introductorio, saludos, explicaciones previas o notas posteriores al bloque de código. La respuesta debe comenzar directamente en la primera línea con ```json y terminar con ```.

DENSIDAD Y DISTRIBUCIÓN POR TEXTO (POESÍA Y PROSA)
- Densidad general (categorías author, period, culture, syntax, analysis):
  * Poesía: Entre 1 y 2 nodos interactivos por cada verso.
  * Prosa: Entre 1 y 2 nodos interactivos por cada fragmento de aproximadamente 15 palabras.
- Extensión del nodo: Prioriza anotar el sintagma o la figura central de cada verso o frase, manteniendo la integridad del sentido (no selecciones palabras sueltas si forman parte de una imagen o recurso mayor).
- Cobertura total: Ningún verso o línea debe quedar descolgado de la lectura comentada.
- Independencia de Vocabulario: La categoría "vocabulary" es independiente y sigue su propia regla de densidad por nivel (ver sección de niveles más abajo), no la regla general de 1-2 nodos por verso/fragmento.
- Un nodo de vocabulary que coincide físicamente con un nodo de otra categoría (ver "SOLAPAMIENTO" más abajo) cuenta para la densidad de AMBAS categorías por separado: no reduzcas la densidad de la otra categoría por el hecho de que la expresión también sea una palabra de vocabulario, y viceversa.

ARQUITECTURA DE CATEGORIZACIÓN (type / category)

Los campos "type" y "category" dentro de cada objeto de "interactiveNodes" deben tomar OBLIGATORIAMENTE, y de forma literal, uno de estos 6 valores exactos en inglés:
`author`, `period`, `vocabulary`, `culture`, `syntax`, `analysis`.

No uses variantes en español, guiones bajos ni nombres heredados de otras versiones del esquema (p. ej. NO uses "sociedad", "simbologia_contexto", "metrica_retorica", "vocabulario_lexico" ni similares como valor de type/category). El visor construye automáticamente los filtros de categoría, sus colores y sus etiquetas en español a partir de estos 6 valores exactos; cualquier otro valor puede no reconocerse y dejar esas palabras sin resaltar ni ser filtrables.

Por la misma razón:
- NO generes ningún array de nivel superior llamado "layers".
- NO generes ningún objeto "categoryLabels".
- NO incluyas la propiedad "layerId" dentro de los nodos.
El visor ignora por completo estos tres elementos: los colores y las etiquetas de cada categoría están fijados en el propio visor, no se leen del JSON. Incluirlos solo añade peso innecesario a la respuesta.

REGLAS ESPECÍFICAS DE VOCABULARIO
Cada nodo de tipo "vocabulary" debe llevar obligatoriamente la propiedad `"vocabLevel": "B1" | "B2" | "C1" | "C2"`.
- Lectura Básica (short): se muestran todas las palabras de vocabulario de nivel B1 o superior (densidad alta, cobertura amplia).
- Lectura Avanzada (deep): solo permanecen resaltadas y con foco filológico detallado las palabras de nivel C1 o C2; las de nivel B1/B2 se atenúan automáticamente en este modo (el visor las oculta visualmente sin alterar el texto). Por tanto, en el análisis "deep" de un nodo de vocabulario, concentra el comentario en el valor filológico real del término, no en una definición básica ya cubierta en "short".

SOLAPAMIENTO: VOCABULARIO QUE ADEMÁS PERTENECE A OTRA CATEGORÍA
Es habitual, y deseable, que una misma palabra o sintagma sea a la vez un término de vocabulario relevante (arcaísmo, cultismo, tecnicismo) Y, simultáneamente, un elemento significativo de otra categoría (una referencia cultural/mitológica, una figura retórica, un símbolo interpretativo, etc.). En ese caso NO seleccione solo una de las dos categorías: crea DOS nodos independientes en "interactiveNodes" —uno "vocabulary" y otro de la categoría que corresponda— y únelos en un solo `<span>` del texto mediante `data-nodes` (varios IDs separados por espacio) y `data-layers` (los mismos dos valores canónicos separados por espacio). Cada nodo debe tener sus propias anotaciones "short"/"deep", centradas exclusivamente en el ángulo de SU categoría, sin repetir el contenido del otro nodo:
- El nodo "vocabulary" explica el significado léxico del término (con su vocabLevel).
- El otro nodo explica la referencia cultural, el recurso retórico o la interpretación simbólica, sin volver a glosar el significado literal de la palabra.

Recomendación de orden: cuando solapes un nodo "vocabulary" con otro nodo, coloca el ID del nodo de vocabulario en PRIMER lugar dentro de "data-nodes" (buena práctica, aunque el visor ya localiza el vocabLevel en cualquier posición).

Ejemplo de solapamiento vocabulario + cultura:
```
<span class="interactive-word" data-nodes="node_vocab_estigia node_cult_estigia" data-layers="vocabulary culture" tabindex="0" role="button" aria-haspopup="dialog">la laguna Estigia</span>
```
con dos nodos independientes en interactiveNodes: `node_vocab_estigia` (type/category: "vocabulary", con vocabLevel y una glosa léxica del término) y `node_cult_estigia` (type/category: "culture", con la referencia mitológica/cultural, sin repetir la glosa léxica).

Para un anidamiento simple de una sola categoría dentro de un sintagma mayor, usa `<span>` anidados de forma limpia y sin cruce de rangos.

REGLAS OBLIGATORIAS DE REDACCIÓN Y SECUENCIA DIDÁCTICA

1. NIVEL CORTA ("short") — SECUENCIA DIDÁCTICA DIRECTA
- Audiencia: Consulta rápida / Estudiantes de secundaria, Bachillerato y nivel B1 o B2.
- Nivel de lengua: Español estándar, directo, muy claro y resolutivo. En vocabulary, explica con claridad lo que significa el término en el contexto concreto del pasaje. Evita tecnicismos metalingüísticos complejos.
- Estructura Didáctica Obligatoria (ORDEN SECUENCIAL ESTRICTO):
  * definition: Glosa o identificación inmediata. Texto plano sin HTML. Máximo 15-20 palabras (1 sola frase resolutiva).
  * content: Función en el pasaje. Un único párrafo breve continuo de texto plano (entre 40 y 70 palabras).

2. NIVEL PROFUNDA ("deep") — ANÁLISIS CRÍTICO Y FILOLÓGICO
- Audiencia: Investigación, docencia universitaria y análisis crítico avanzado.
- Nivel de lengua: Académico especializado. Emplea con rigor terminología filológica, literaria, histórica y filosófica.
- Estructura Interna:
  * definition: Definición filológica o conceptual amplia con rigor terminológico (30-50 palabras, texto plano sin HTML).
  * content: Análisis crítico profundo (180-300 palabras globales). DEBE desglosarse internamente en 2 párrafos separados obligatoriamente por la etiqueta HTML <br><br>:
    - Párrafo 1: Análisis crítico directo del término, recurso métrico/fónico o significado filológico en el pasaje.
    - Párrafo 2: Contexto histórico, intertexto, proyección simbólica o vinculación con las grandes líneas temáticas de la obra y la época.

REGLAS ESTRICTAS DE SINTAXIS JSON, ANIDAMIENTO Y ETIQUETADO EN ESTROFAS (stanzas)
1. Sintaxis de cadenas en JSON: En JSON no pueden existir saltos de línea físicos (Enter) dentro de una cadena de texto. Cada elemento del array stanzas debe ser una sola línea de código continua envuelta en <p>...</p>. Utiliza <br> al final de cada verso para indicar el salto poético.
2. Comillas en HTML dentro del JSON: Para evitar errores de parseo y dobles escapados en JavaScript, utiliza comillas dobles normales dentro de las etiquetas HTML de stanzas (ejemplo: `<span class="interactive-word" data-node="node_1" data-category="syntax" ...>Sintagma</span>`).
3. Vínculos de cabecera: node_author y node_period NO deben inyectarse mediante etiquetas <span> dentro de stanzas. Se vinculan automáticamente mediante authorNodeId y periodNodeId.
4. Atributos de cada span, según pertenezca a una o varias categorías:
   - UNA sola categoría: usa `data-node="node_x"` junto con `data-category="<valor_canónico>"` (el mismo valor que el campo type/category del nodo). NO añadas además un atributo `data-layer` heredado: solo `data-category`.
   - VARIAS categorías simultáneas (solapamiento, incluido vocabulario + otra categoría): usa `data-nodes="node_a node_b"` junto con `data-layers="valorA valorB"` (valores canónicos separados por espacio, en el mismo orden que data-nodes). NO uses `data-category` en un span multicategoría.
5. Anidamiento y Solapamiento de Nodos (Overlaps) — caso general (no vocabulario): cuando un fragmento poético o palabra pertenezca a varios nodos o capas simultáneamente por razones distintas al vocabulario (p. ej. una figura retórica que además es un símbolo interpretativo), únelo igualmente en un único elemento HTML combinando sus identificadores y capas mediante espacios:
```
<span class="interactive-word" 
      data-nodes="node_soplos node_infierno_simbolico" 
      data-layers="syntax analysis" 
      tabindex="0" 
      role="button" 
      aria-haspopup="dialog">
  crudos soplos de infierno
</span>
```

BÚSQUEDA Y SELECCIÓN DE IMÁGENES Y MULTIMEDIA
- Prohibida la invención de URLs: Asigna siempre "audioUrl": null en meta.
- Uso obligatorio de imageSearchQuery concreto: Sustantivos visuales reales, concretos y descriptivos. También sustantivos y adjetivos metafóricos que encajen relevantemente con el sentido del sustantivo en el contexto del texto y la explicación de la anotación.
- visualConceptType: Debe ser estrictamente uno de: "portrait", "landscape", "artwork", "symbol", o "diagram".
- locationAnchor: Ubicación geográfica real si existe (ej. "Soria", "Toledo"); de lo contrario, null.
- imageVisualKeywords: Array con 2 o 3 términos visuales clave en texto plano.

REGLA IMPORTANTE — "wikipediaArticle" Y "youtubeSearchQuery" NO SON EXCLUSIVOS DE author/period:
En el esquema de referencia de más abajo, estos dos campos solo se muestran de ejemplo en el nodo "author" porque hay sitio limitado, PERO deben añadirse a CUALQUIER nodo, sea de la categoría que sea, siempre que exista de verdad un artículo de Wikipedia o un vídeo relevante sobre el concepto concreto de ese nodo o relevante a la explicación de la anotación y su contexto:
- vocabulary: si el término designa algo con artículo propio (una especie botánica o animal, un objeto histórico, un topónimo, etc.), añade "wikipediaArticle" con el título exacto de ese artículo (p. ej. un nodo de vocabulario sobre "chopos" → "wikipediaArticle": "Populus_nigra").
- syntax: si el nodo nombra una figura retórica o un recurso métrico con entrada propia (hipérbaton, prosopopeya, sinestesia, anáfora...), añade su "wikipediaArticle" correspondiente, y "youtubeSearchQuery" cuando exista un vídeo divulgativo razonable sobre ese concepto concreto o relativo a la explicación de la anotación concreta sobre el texto.
- culture / period / analysis: añade "wikipediaArticle" siempre que la referencia mitológica, histórica, geográfica o temática tenga artículo real, y "youtubeSearchQuery" cuando exista un vídeo divulgativo razonable sobre ese concepto concreto o sobre alguno de los elementos relevantes de interpretación de la notación en el texto (no solo sobre el autor).
No dejes estos dos campos vacíos por defecto en las categorías que no sean author/period: solo se omiten cuando, tras verificar filológicamente el concepto, no existe ningún artículo o vídeo genuinamente relevante o relacionado con la explicación de la anotación y su contexto para él.

ESTRUCTURA DE SALIDA JSON (ESQUEMA DE REFERENCIA)

```json
{
  "meta": {
    "title": "«Título exacto del poema o capítulo» / Libro u obra principal",
    "author": "Nombre del autor",
    "authorNodeId": "node_author",
    "period": "Movimiento o Época",
    "periodNodeId": "node_period",
    "year": "Año de publicación",
    "lang": "es",
    "audioUrl": null
  },
  "interactiveNodes": {
    "node_author": {
      "type": "author",
      "category": "author",
      "title": "Perfil biográfico y literario",
      "annotations": {
        "short": {
          "definition": "Glosa concisa del autor (15-20 palabras, texto plano).",
          "content": "Resumen de su evolución poética y temas centrales (40-70 palabras)."
        },
        "deep": {
          "definition": "Perfil filológico e historiográfico del autor en la tradición literaria (30-50 palabras).",
          "content": "Primer párrafo de análisis biográfico.<br><br>Segundo párrafo sobre evolución e impacto."
        }
      },
      "wikipediaArticle": "Nombre_Wikipedia",
      "wikiLang": "es",
      "visualConceptType": "portrait",
      "locationAnchor": null,
      "imageSearchQuery": "Retrato fotográfico o grabado del autor",
      "imageVisualKeywords": ["retrato autor", "fotografia historica"],
      "youtubeSearchQuery": "Nombre del autor Biografía y poesía"
    },
    "node_vocab_estigia": {
      "type": "vocabulary",
      "category": "vocabulary",
      "vocabLevel": "C1",
      "title": "Estigia (léxico)",
      "annotations": {
        "short": {
          "definition": "Río mitológico que separa el mundo de los vivos del de los muertos.",
          "content": "Aquí se usa como término culto para evocar el umbral entre la vida y la muerte, sin entrar en su origen mitológico, que se desarrolla en la anotación de cultura de este mismo pasaje."
        },
        "deep": {
          "definition": "Hidrónimo mitológico incorporado al léxico culto como metonimia del tránsito hacia la muerte (30-50 palabras).",
          "content": "Análisis filológico del término y de su uso connotativo en el pasaje.<br><br>Trayectoria del cultismo en la tradición literaria en lengua española."
        }
      }
    },
    "node_cult_estigia": {
      "type": "culture",
      "category": "culture",
      "title": "La laguna Estigia en la mitología clásica",
      "wikipediaArticle": "Estigia",
      "visualConceptType": "artwork",
      "imageSearchQuery": "Caronte barca laguna Estigia pintura clasica",
      "imageVisualKeywords": ["Caronte", "barca", "inframundo"],
      "youtubeSearchQuery": "Mitologia griega rio Estigia inframundo explicacion",
      "annotations": {
        "short": {
          "definition": "Río del inframundo que cruzaban las almas de los difuntos.",
          "content": "Referencia mitológica clásica que el autor recupera aquí para situar la escena en un umbral simbólico entre la vida y la muerte, sin detenerse en el significado léxico del término, ya cubierto en la anotación de vocabulario."
        },
        "deep": {
          "definition": "Elemento del imaginario escatológico grecolatino recuperado como tópico literario del tránsito hacia la muerte (30-50 palabras).",
          "content": "Análisis de la función simbólica de la referencia mitológica en el pasaje.<br><br>Pervivencia del tópico clásico en la tradición literaria posterior y su valor como intertexto."
        }
      }
    }
  },
  "stanzas": [
    "<p>Texto del poema con <span class=\"interactive-word\" data-node=\"node_1\" data-category=\"syntax\" tabindex=\"0\" role=\"button\" aria-haspopup=\"dialog\">un sintagma anotado</span> que requiere explicación.<br>Y aquí cruzaba <span class=\"interactive-word\" data-nodes=\"node_vocab_estigia node_cult_estigia\" data-layers=\"vocabulary culture\" tabindex=\"0\" role=\"button\" aria-haspopup=\"dialog\">la laguna Estigia</span>, umbral de sombras.</p>"
  ]
}
```
`;

    // Generación con streaming mediante Gemini
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    // Conversión de la respuesta generativa en un ReadableStream Web
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of responseStream) {
          if (chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error en /api/generar:', error);
    return new Response(
      JSON.stringify({
        error: 'Error procesando el texto con Gemini.',
        detalles: error.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
