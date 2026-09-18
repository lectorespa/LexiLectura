import { GoogleGenAI } from '@google/genai';

// Inicializa el cliente de Gemini (detecta automáticamente GEMINI_API_KEY desde Vercel)
const ai = new GoogleGenAI();

export default async function handler(req, res) {
  // 1. Permitir únicamente peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const { textoPlano } = req.body;

    if (!textoPlano  typeof textoPlano !== 'string'  !textoPlano.trim()) {
      return res.status(400).json({ error: 'El parámetro "textoPlano" es obligatorio.' });
    }

    // 2. Prompt del sistema para estructurar la edición crítica en JSON
    const prompt = 
Asegúrate de actuar como un editor crítico e hispanista experto. Analiza el siguiente texto literario y genera una edición interactiva anotada.

TEXTO A ANALIZAR:
"""
${textoPlano}
"""

ESTRUCTURA DE SALIDA ESPERADA:
Debes responder ÚNICAMENTE con un objeto JSON válido acorde al siguiente esquema estricto:

{
  "meta": {
    "title": "Título identificativo de la obra o fragmento",
    "author": "Nombre del autor o Anónimo",
    "authorNodeId": "node_author",
    "period": "Época o movimiento literario",
    "periodNodeId": "node_period",
    "year": "Año o siglo estimado",
    "lang": "es"
  },
  "interactiveNodes": {
    "node_author": {
      "type": "author",
      "category": "author",
      "title": "Nombre del Autor",
      "wikipediaArticle": "Título_Artículo_Wikipedia",
      "visualConceptType": "portrait",
      "imageSearchQuery": "Consulta para búsqueda de retrato o imagen del autor",
      "annotations": {
        "short": { "definition": "Resumen bio-bibliográfico breve.", "content": "Información clave sobre el autor y su estilo." },
        "deep": { "definition": "Análisis bio-bibliográfico avanzado.", "content": "Contexto histórico-literario detallado e influencias." }
      }
    },
    "node_period": {
      "type": "period",
      "category": "period",
      "title": "Contexto Histórico / Época",
      "wikipediaArticle": "Título_Artículo_Wikipedia",
      "visualConceptType": "landscape",
      "imageSearchQuery": "Consulta para búsqueda de imagen histórica",
      "annotations": {
        "short": { "definition": "Resumen contextual de la época.", "content": "Aspectos socioculturales dominantes." },
        "deep": { "definition": "Análisis histórico-filosófico profundo.", "content": "Estructuras de pensamiento y condicionantes históricos." }
      }
    },
    "node_1": {
      "type": "vocabulary",
      "category": "vocabulary",
      "title": "Concepto o expresión anotada",
      "annotations": {
        "short": { "definition": "Definición accesible (B1+).", "content": "Explicación directa del significado o recurso." },
        "deep": { "definition": "Análisis crítico/filológico (C1+).", "content": "Etimología, uso retórico o valor simbólico en la obra." }
      }
    }
  },
  "stanzas": [
    "<p>Texto con <span class=\\"interactive-word\\" data-nodes=\\"node_1\\" data-layers=\\"vocabulary\\" tabindex=\\"0\\" role=\\"button\\">palabras anotadas</span> en formato HTML.</p>"
  ]
}

REGLAS DE ANOTACIÓN LITERARIA:
1. Las categorías válidas para nodos son: 'author', 'period', 'vocabulary', 'culture', 'syntax', 'analysis'.
2. Envuelve los fragmentos anotados en 'stanzas' con etiquetas: <span class="interactive-word" data-nodes="ID_NODO" data-layers="CATEGORIA" tabindex="0" role="button">palabra</span>.
3. Si un fragmento tiene múltiples capas solapadas, separa las IDs y categorías por espacios dentro del HTML (ejemplo: data-nodes="node_1 node_2" data-layers="vocabulary syntax").
4. Genera entre 3 y 8 nodos interactivos distribuidos entre las categorías léxicas, sintácticas o culturales.
;

    // 3. Llamada al modelo Gemini imponiendo salida JSON estructurada
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonFinal = JSON.parse(response.text);


return res.status(200).json(jsonFinal);

  } catch (error) {
    console.error('Error en /api/generar:', error);
    return res.status(500).json({
      error: 'Error interno al procesar el texto con Gemini.',
      detalles: error.message
    });
  }
}
