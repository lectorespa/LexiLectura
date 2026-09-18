// api/generar.js - Función Serverless para Vercel / Node.js

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

export default async function handler(req, res) {
  // Configuración de cabeceras CORS (Permite llamadas desde tu sitio en GitHub Pages)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responder inmediatamente a la verificación del navegador (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const { textoPlano } = req.body;

    if (!textoPlano || typeof textoPlano !== 'string') {
      return res.status(400).json({ error: 'Falta el parámetro "textoPlano".' });
    }

    // La API Key se obtiene de las variables de entorno del servidor
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Servidor no configurado: Falta GEMINI_API_KEY en Vercel.' });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT_LEXIA }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `Analiza y anota el siguiente texto literario:\n\n${textoPlano}` }]
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.2
      }
    };

    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      return res.status(geminiResponse.status).json({ error: errorData.error?.message || 'Error en Gemini' });
    }

    const data = await geminiResponse.json();
    const rawTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawTextResponse) {
      return res.status(500).json({ error: 'Gemini no devolvió ninguna respuesta.' });
    }

    const jsonFinal = JSON.parse(rawTextResponse);
    return res.status(200).json(jsonFinal);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}
