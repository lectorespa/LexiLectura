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

    // Generación con streaming mediante Gemini
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash',
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
