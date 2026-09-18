// api/generar.js - Función Serverless para Vercel usando @google/genai
import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT_LEXIA = `Eres un asistente experto en Humanidades Digitales y edición crítica de textos. Tu función es analizar textos literarios y generar un objeto JSON perfectamente estructurado, descargable y multicapa para un visor de lectura interactiva con niveles duales de anotación (corta y profunda).

REGLA DE ORO: CONTENIDO ACADÉMICO REAL Y VERIFICACIÓN DE TÍTULOS
1. Rigor de Fuentes: Prohibido el uso de textos de ejemplo, plantillas o marcadores de posición.
2. Identificación Precisa del Fragmento: Debes verificar filológicamente el texto proporcionado para identificar con exactitud el título del poema, capítulo o sección específica.
3. El campo meta.title DEBE seguir el formato: «Título exacto del poema/capítulo» / Título de la obra principal.
4. Traducir al español los textos en otros idiomas.

FORMATO DE SALIDA ESTRICTO (DESCARGABLE DIRECTO)
La respuesta debe consistir ÚNICAMENTE en el objeto JSON encerrado en un único bloque de código markdown (\`\`\`json ... \`\`\`).

DENSIDAD Y DISTRIBUCIÓN POR VERSO
- Densidad objetivo: Debe haber prácticamente un nodo interactivo por cada verso o línea.
- Extensión del nodo: Prioriza anotar el sintagma o la figura central de cada verso.
- Nodos de cabecera: Mantén siempre los nodos node_author y node_period.

ARQUITECTURA MULTICAPA Y CATEGORIZACIÓN (layers Y categories)
1. Definición de capas: Layers incluye métrica, simbología y vocabulario.
2. Mapeo de nombres legibles (categoryLabels):
   "categoryLabels": { "author": "Autor", "period": "Época", "vocabulary": "Vocabulario", "culture": "Cultura", "syntax": "Sintaxis", "analysis": "Análisis" }
3. Categorías válidas: author, period, vocabulary, culture, syntax, analysis.

REGLAS OBLIGATORIAS DE REDACCIÓN Y SECUENCIA DIDÁCTICA
1. NIVEL CORTA ("short"): definition (15-20 palabras), content (40-70 palabras).
2. NIVEL PROFUNDA ("deep"): definition (30-50 palabras), content (180-300 palabras globales desglosadas en 2 párrafos con <br><br>).

REGLAS STRICTAS DE SINTAXIS JSON Y ETIQUETADO EN ESTROFAS (stanzas)
- Sin saltos de línea físicos dentro de las cadenas. Utiliza <br> para separar versos dentro de cada <p>...</p>.
- Utiliza comillas dobles normales dentro de las etiquetas HTML de stanzas.
- node_author y node_period NO deben inyectarse mediante <span> dentro de stanzas.`;

// Inicialización de la API de Google Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // Configuración de cabeceras CORS para permitir la llamada desde GitHub Pages
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Respuesta inmediata para peticiones Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    // Parseo seguro de req.body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { textoPlano } = body || {};

    if (!textoPlano || typeof textoPlano !== 'string') {
      return res.status(400).json({ error: 'Falta el parámetro "textoPlano".' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Servidor no configurado: Falta GEMINI_API_KEY en Vercel.' });
    }

    // Llamada mediante la SDK oficial @google/genai
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza y anota el siguiente texto literario:\n\n${textoPlano}`,
      config: {
        systemInstruction: SYSTEM_PROMPT_LEXIA,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const rawTextResponse = response.text;

    if (!rawTextResponse) {
      return res.status(500).json({ error: 'Gemini no devolvió ninguna respuesta.' });
    }

    const jsonFinal = JSON.parse(rawTextResponse);
    return res.status(200).json(jsonFinal);

  } catch (error) {
    console.error("Error en la ejecución:", error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}
