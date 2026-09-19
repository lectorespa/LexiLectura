import OpenAI from 'openai';

export const config = {
  runtime: 'edge',
};

// Inicialización para OpenRouter
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com', // Opcional: Tu web o repo para aparecer en el ranking de OpenRouter
    'X-Title': 'Edicion Interactiva Anotada', // Opcional: Nombre de tu aplicación
  },
});

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers':
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido. Utiliza POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { textoPlano } = body || {};

    if (!textoPlano || typeof textoPlano !== 'string' || !textoPlano.trim()) {
      return new Response(
        JSON.stringify({ error: 'El parámetro "textoPlano" es obligatorio.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemInstruction = `




    const userContent = `TEXTO A ANALIZAR:\n"""\n${textoPlano}\n"""`;

    // Lista de modelos gratuitos en OpenRouter (ordenados por preferencia)
    const freeModels = [
      'deepseek/deepseek-chat:free',          // DeepSeek V3 Gratis
      'meta-llama/llama-3.3-70b-instruct:free', // Llama 3.3 70B Gratis
      'deepseek/deepseek-r1:free',            // DeepSeek R1 Gratis
    ];

    let responseStream;
    let lastError;

    // Bucle para intentar con los modelos de la lista si uno falla por saturación (429/503)
    for (const model of freeModels) {
      try {
        responseStream = await client.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userContent },
          ],
          stream: true,
          temperature: 0.3,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
        });

        console.log(`Petición iniciada con éxito usando el modelo: ${model}`);
        break; // Si tiene éxito, sale del bucle
      } catch (err) {
        console.warn(`Falló el modelo ${model}. Probando siguiente modelo de respaldo...`, err.message);
        lastError = err;
      }
    }

    if (!responseStream) {
      throw lastError || new Error('Ningún modelo gratuito de OpenRouter está disponible en este momento.');
    }

    // Conversión del Stream de OpenAI/OpenRouter a ReadableStream Web
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of responseStream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            controller.enqueue(encoder.encode(text));
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
        error: 'Error procesando el texto con OpenRouter.',
        detalles: error.message || String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
    
