import { GoogleGenAI } from '@google/genai';

// Pasar la clave explícitamente desde las variables de entorno de Vercel
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // 1. Configuración de cabeceras CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const { textoPlano } = req.body;

    if (!textoPlano || typeof textoPlano !== 'string' || !textoPlano.trim()) {
      return res.status(400).json({ error: 'El parámetro "textoPlano" es obligatorio.' });
    }

    const prompt = `
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
`;

    // 2. Generación con modelo estándar
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    // 3. Limpieza de bloques de código Markdown antes de parsear
    const rawText = response.text || '';
    const cleanedText = rawText.replace(/```json\s*|```/g, '').trim();
    const jsonFinal = JSON.parse(cleanedText);

    return res.status(200).json(jsonFinal);

  } catch (error) {
    console.error('Error en /api/generar:', error);
    return res.status(500).json({
      error: 'Error procesando el texto con Gemini.',
      detalles: error.message || String(error)
    });
  }
}
