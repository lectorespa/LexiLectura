// api/generar.js — Vercel Function (Edge)
// Anota un fragmento de texto con un modelo de OpenRouter y devuelve el JSON del visor.
//
// PROTOCOLO DE RESPUESTA (clave para que el navegador no corte la conexión)
//   · Toda petición POST válida recibe HTTP 200, Content-Type: application/json.
//   · El cuerpo son espacios en blanco (latido, JSON válido) + UN objeto JSON final:
//       éxito → { meta, interactiveNodes, stanzas }
//       fallo → { error, codigo, detalles }
//   · Los errores de configuración / petición (antes de generar) usan su código HTTP
//     habitual (400, 413, 500) y también llevan siempre cabeceras CORS.
//
// Nada que pueda fallar ocurre fuera del try/catch: así el navegador siempre recibe
// una respuesta con CORS y puede mostrar el motivo real en lugar de "Load failed".

import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../lib/prompt.js';

export const config = { runtime: 'edge' };

// Los IDs ":free" de OpenRouter cambian con frecuencia. Sobrescríbelos sin tocar código
// con la variable de entorno OPENROUTER_MODELS (lista separada por comas, en orden de preferencia).
const MODELOS_POR_DEFECTO = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free', // router de OpenRouter: elige un modelo gratuito disponible
];

function leerAjustes() {
  const env = process.env;
  return {
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    modelos: (env.OPENROUTER_MODELS || MODELOS_POR_DEFECTO.join(','))
      .split(',').map((s) => s.trim()).filter(Boolean),
    maxTokens: Number(env.MAX_TOKENS) || 8000,
    maxCaracteres: Number(env.MAX_INPUT_CHARS) || 6000,
    // '*' = cualquier origen (comportamiento actual). Cuando todo funcione, restringe:
    // ALLOWED_ORIGINS=https://lectorespa.github.io
    origenes: (env.ALLOWED_ORIGINS || 'https://lectorespa.github.io').split(',').map((s) => s.trim()).filter(Boolean),
    presupuestoMs: 270_000, // Edge permite 300 s de streaming: dejamos margen
    inactividadMs: 75_000, // sin recibir ni un token durante este tiempo → probar otro modelo
    latidoMs: 8_000,
  };
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function cabecerasCors(req, ajustes) {
  const origen = req.headers.get('origin') || '';
  let permitido = '*';
  if (!ajustes.origenes.includes('*')) {
    permitido = ajustes.origenes.includes(origen) ? origen : ajustes.origenes[0] || 'null';
  }
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function respuestaJson(status, objeto, cors) {
  return new Response(JSON.stringify(objeto), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function errorConCodigo(codigo, mensaje) {
  const e = new Error(mensaje);
  e.codigo = codigo;
  return e;
}

function construirMensajeUsuario(textoPlano, parte, totalPartes, contexto) {
  let extra = '';
  if (totalPartes > 1) {
    extra += `\nMODO FRAGMENTO: este texto es la parte ${parte} de ${totalPartes} de una obra más larga que se anota por partes. Anota ÚNICAMENTE este fragmento; no resumas ni comentes el resto. Los identificadores de nodo (node_1, node_2…) pueden repetirse entre partes: se renumeran al unirlas.`;
    if (parte > 1) {
      extra += ` NO generes los nodos node_author ni node_period (ya existen en la parte 1). En "meta" repite exactamente estos valores: ${JSON.stringify(contexto || {})}.`;
    }
  }
  return `TEXTO A ANALIZAR:\n"""\n${textoPlano}\n"""${extra}`;
}

// Extrae el objeto JSON aunque el modelo lo envuelva en ```json, añada texto o razonamiento.
function extraerJson(texto) {
  let t = String(texto)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const ini = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  if (ini === -1 || fin <= ini) throw errorConCodigo('JSON_INVALIDO', 'La respuesta no contiene un objeto JSON.');
  t = t.slice(ini, fin + 1);
  try {
    return JSON.parse(t);
  } catch (_) {
    try {
      return JSON.parse(t.replace(/,\s*([}\]])/g, '$1')); // coma final típica de los LLM
    } catch (e2) {
      throw errorConCodigo('JSON_INVALIDO', `JSON mal formado: ${e2.message}`);
    }
  }
}

function validarAnotacion(d) {
  const mal = (m) => { throw errorConCodigo('JSON_INVALIDO', m); };
  if (!d || typeof d !== 'object' || Array.isArray(d)) mal('La respuesta no es un objeto.');
  if (!d.meta || typeof d.meta !== 'object') mal('Falta "meta".');
  if (!d.interactiveNodes || typeof d.interactiveNodes !== 'object' || !Object.keys(d.interactiveNodes).length) {
    mal('Falta "interactiveNodes" o está vacío.');
  }
  if (!Array.isArray(d.stanzas) || !d.stanzas.length || d.stanzas.some((s) => typeof s !== 'string')) {
    mal('Falta "stanzas" o no es un array de cadenas.');
  }
}

// ---------------------------------------------------------------------------
// Llamada a un modelo (streaming interno, con temporizador de inactividad)
// ---------------------------------------------------------------------------

async function pedirAlModelo(client, modelo, mensajes, ajustes, limite, senalCliente) {
  const ctrl = new AbortController();
  let motivo = null;
  const abortar = (m) => { motivo = m; ctrl.abort(); };
  if (senalCliente) {
    if (senalCliente.aborted) throw errorConCodigo('CANCELADO', 'Petición cancelada por el cliente.');
    senalCliente.addEventListener('abort', () => abortar('cliente'), { once: true });
  }

  let temporizador;
  const rearmar = () => {
    clearTimeout(temporizador);
    const espera = Math.max(1000, Math.min(ajustes.inactividadMs, limite - Date.now()));
    temporizador = setTimeout(() => abortar('inactividad'), espera);
  };

  rearmar();
  try {
    const flujo = await client.chat.completions.create(
      {
        model: modelo,
        messages: mensajes,
        stream: true,
        temperature: 0.3,
        max_tokens: ajustes.maxTokens,
        // Sin response_format: muchos proveedores gratuitos no lo soportan y el
        // parser de arriba ya tolera bloques ```json y texto alrededor.
      },
      { signal: ctrl.signal },
    );

    let texto = '';
    let fin = null;
    for await (const trozo of flujo) {
      rearmar();
      if (trozo.error) throw errorConCodigo('PROVEEDOR', trozo.error.message || 'Error del proveedor durante la generación.');
      const eleccion = trozo.choices?.[0];
      if (eleccion?.delta?.content) texto += eleccion.delta.content;
      if (eleccion?.finish_reason) fin = eleccion.finish_reason;
    }

    if (fin === 'length') throw errorConCodigo('TRUNCADO', 'La respuesta superó el máximo de tokens y quedó cortada.');
    if (fin === 'error') throw errorConCodigo('PROVEEDOR', 'El proveedor terminó la generación con error.');
    if (!texto.trim()) throw errorConCodigo('VACIO', 'El modelo devolvió una respuesta vacía.');
    return texto;
  } catch (err) {
    if (ctrl.signal.aborted) {
      if (motivo === 'inactividad') {
        throw errorConCodigo('TIEMPO', `El modelo no envió datos durante ${Math.round(ajustes.inactividadMs / 1000)} s.`);
      }
      throw errorConCodigo('CANCELADO', 'Petición cancelada.');
    }
    throw err;
  } finally {
    clearTimeout(temporizador);
  }
}

// ---------------------------------------------------------------------------
// Respaldo entre modelos: falla el modelo O falla su salida → siguiente modelo
// ---------------------------------------------------------------------------

async function generarConRespaldo(mensajes, ajustes, senalCliente, referer) {
  const client = new OpenAI({
    apiKey: ajustes.apiKey,
    baseURL: ajustes.baseURL,
    maxRetries: 0, // los reintentos los gestionamos nosotros (cambiando de modelo)
    defaultHeaders: { 'HTTP-Referer': referer, 'X-Title': 'Edicion Interactiva Anotada' },
  });

  const limite = Date.now() + ajustes.presupuestoMs;
  const fallos = [];
  let todosLimite = true;
  let algunaSalidaInvalida = false;

  for (const modelo of ajustes.modelos) {
    if (limite - Date.now() < 20_000) break; // ya no da tiempo a otro intento

    try {
      const texto = await pedirAlModelo(client, modelo, mensajes, ajustes, limite, senalCliente);
      const datos = extraerJson(texto);
      validarAnotacion(datos);
      console.log(`[generar] OK con ${modelo}`);
      return datos;
    } catch (err) {
      const codigo = err.codigo || (err.status ? `HTTP_${err.status}` : 'DESCONOCIDO');
      console.warn(`[generar] ${modelo} falló (${codigo}): ${err.message}`);
      fallos.push(`${modelo} → ${codigo}: ${err.message}`);

      if (codigo === 'CANCELADO') throw err;
      if (codigo === 'TRUNCADO') throw err; // otro modelo tampoco cabrá: que el cliente divida el texto
      if (err.status !== 429) todosLimite = false;
      if (['JSON_INVALIDO', 'VACIO'].includes(codigo)) algunaSalidaInvalida = true;
    }
  }

  const detalles = fallos.join(' | ').slice(0, 700);
  if (fallos.length && todosLimite) {
    throw Object.assign(
      errorConCodigo('LIMITE', 'Se ha alcanzado el límite de uso de los modelos gratuitos de OpenRouter.'),
      { detalles },
    );
  }
  if (algunaSalidaInvalida) {
    throw Object.assign(errorConCodigo('SALIDA_INVALIDA', 'Los modelos no devolvieron un JSON válido para este fragmento.'), { detalles });
  }
  throw Object.assign(
    errorConCodigo('MODELOS_NO_DISPONIBLES', 'Ningún modelo configurado respondió. Revisa OPENROUTER_MODELS y la clave.'),
    { detalles: detalles || 'Sin intentos (tiempo agotado).' },
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req) {
  let cors = { 'Access-Control-Allow-Origin': '*' };
  try {
    const ajustes = leerAjustes();
    cors = cabecerasCors(req, ajustes);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Comprobación de salud: abre /api/generar en el navegador para diagnosticar.
    if (req.method === 'GET') {
      return respuestaJson(200, {
        ok: true,
        servicio: 'lexi-lectura/generar',
        apiKeyConfigurada: Boolean(ajustes.apiKey),
        modelosConfigurados: ajustes.modelos.length,
      }, cors);
    }

    if (req.method !== 'POST') {
      return respuestaJson(405, { error: 'Método no permitido. Utiliza POST.', codigo: 'METODO' }, cors);
    }

    if (!ajustes.apiKey) {
      return respuestaJson(500, {
        error: 'El servidor no tiene configurada la clave OPENROUTER_API_KEY.',
        codigo: 'CONFIG',
        detalles: 'Añádela en Vercel → Settings → Environment Variables (entorno Production) y vuelve a desplegar.',
      }, cors);
    }

    let cuerpo;
    try {
      cuerpo = await req.json();
    } catch (_) {
      return respuestaJson(400, { error: 'El cuerpo de la petición debe ser JSON válido.', codigo: 'PETICION' }, cors);
    }

    const textoPlano = typeof cuerpo?.textoPlano === 'string' ? cuerpo.textoPlano.trim() : '';
    if (!textoPlano) {
      return respuestaJson(400, { error: 'El parámetro "textoPlano" es obligatorio.', codigo: 'PETICION' }, cors);
    }
    if (textoPlano.length > ajustes.maxCaracteres) {
      return respuestaJson(413, {
        error: `El fragmento tiene ${textoPlano.length} caracteres; el máximo por petición es ${ajustes.maxCaracteres}.`,
        codigo: 'TEXTO_LARGO',
      }, cors);
    }

    const totalPartes = Number.isInteger(cuerpo.totalPartes) && cuerpo.totalPartes > 0 ? cuerpo.totalPartes : 1;
    const parte = Number.isInteger(cuerpo.parte) && cuerpo.parte > 0 ? cuerpo.parte : 1;
    const contexto = cuerpo.contexto && typeof cuerpo.contexto === 'object' ? cuerpo.contexto : null;

    const mensajes = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: construirMensajeUsuario(textoPlano, parte, totalPartes, contexto) },
    ];
    const referer = req.headers.get('origin') || 'https://lectorespa.github.io/LexiLectura/';

    const enc = new TextEncoder();
    const flujo = new ReadableStream({
      async start(controller) {
        let cerrado = false;
        const enviar = (t) => {
          if (cerrado) return;
          try { controller.enqueue(enc.encode(t)); } catch (_) { cerrado = true; }
        };

        enviar(' '); // primer byte inmediato (Edge exige empezar a responder antes de 25 s)
        const latido = setInterval(() => enviar(' '), ajustes.latidoMs);

        try {
          const resultado = await generarConRespaldo(mensajes, ajustes, req.signal, referer);
          enviar(JSON.stringify(resultado));
        } catch (err) {
          console.error('[generar] error final:', err.codigo, err.message);
          enviar(JSON.stringify({
            error: err.message || 'Error procesando el texto.',
            codigo: err.codigo || 'SERVIDOR',
            detalles: err.detalles || '',
          }));
        } finally {
          clearInterval(latido);
          try { controller.close(); } catch (_) { /* ya cerrado */ }
          cerrado = true;
        }
      },
    });

    return new Response(flujo, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[generar] error inesperado:', error);
    return respuestaJson(500, {
      error: 'Error interno del servidor.',
      codigo: 'SERVIDOR',
      detalles: error?.message || String(error),
    }, cors);
  }
}
