// api/generar.js — Vercel Function (Edge)
// Anota un fragmento de texto con OpenRouter, Gemini o Groq y devuelve el JSON del visor.
// El proveedor se elige con el campo "proveedor" del cuerpo: "openrouter" (por defecto) | "gemini" | "groq".
//
// PROTOCOLO DE RESPUESTA (clave para que el navegador no corte la conexión)
//   · Toda petición POST válida recibe HTTP 200, Content-Type: application/json.
//   · El cuerpo son espacios en blanco (latido, JSON válido) + UN objeto JSON final:
//       éxito → { meta, interactiveNodes, stanzas }
//       fallo → { error, codigo, detalles }
//   · Los errores de configuración / petición (antes de generar) usan su código HTTP
//     habitual (400, 413, 500) y también llevan siempre cabeceras CORS.
//
// Gemini se llama por REST con fetch (sin @google/genai): así no hay dependencias
// incompatibles con Edge.

import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../lib/prompt.js';

export const config = { runtime: 'edge' };

const VERSION = '2026-09-19-d'; // súbela al cambiar el archivo: aparece en GET /api/generar

// Los IDs cambian con frecuencia. Sobrescríbelos SIN tocar código con variables de entorno
// (IDs separados por comas, en orden de preferencia):
//   OPENROUTER_MODELS → lista vigente: https://openrouter.ai/collections/free-models
//   GEMINI_MODELS     → lista vigente: https://ai.google.dev/gemini-api/docs/models
//   GROQ_MODELS       → lista vigente: https://console.groq.com/docs/models
// Ojo: cada intento cuenta para los límites de cuota, así que no conviene una lista larga.
const MODELOS_OPENROUTER = [
  'deepseek/deepseek-v4-flash-0731:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'thinkingmachines/inkling:free',
];
const MODELOS_GEMINI = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
const MODELOS_GROQ = ['deepseek-r1-distill-qwen-32b', 'openai/gpt-oss-120b'];

function leerAjustes() {
  const env = process.env;
  const lista = (valor, porDefecto) => (valor || porDefecto.join(','))
    .split(',').map((s) => s.trim()).filter(Boolean);
  const nivelPensamiento = env.GEMINI_THINKING_LEVEL === undefined ? 'low' : env.GEMINI_THINKING_LEVEL.trim();
  const esfuerzoGroq = env.GROQ_REASONING_EFFORT === undefined ? 'low' : env.GROQ_REASONING_EFFORT.trim();

  return {
    // '*' = cualquier origen. Cuando todo funcione, restringe:
    // ALLOWED_ORIGINS=https://lectorespa.github.io
    origenes: (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean),
    maxCaracteres: Number(env.MAX_INPUT_CHARS) || 6000,
    presupuestoMs: 270_000, // Edge permite 300 s de streaming: dejamos margen
    inactividadMs: 75_000, // sin recibir datos durante este tiempo → probar otro modelo
    latidoMs: 8_000,
    proveedores: {
      openrouter: {
        nombre: 'OpenRouter',
        claveEnv: 'OPENROUTER_API_KEY',
        modelosEnv: 'OPENROUTER_MODELS',
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        modelos: lista(env.OPENROUTER_MODELS, MODELOS_OPENROUTER),
        temperature: 0.7,
        top_p: 0.95,
        presence_penalty: 0.4,
        frequency_penalty: 0.2,
        maxTokens: Number(env.MAX_TOKENS) || 8000,
      },
      gemini: {
        nombre: 'Gemini',
        claveEnv: 'GEMINI_API_KEY',
        modelosEnv: 'GEMINI_MODELS',
        apiKey: env.GEMINI_API_KEY,
        baseURL: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
        modelos: lista(env.GEMINI_MODELS, MODELOS_GEMINI),
        temperature: 0.7,
        top_p: 0.95,
        presence_penalty: 0.4,
        frequency_penalty: 0.2,
        maxTokens: Number(env.GEMINI_MAX_TOKENS) || 32000,
        // 'low' por defecto: más rápido y barato. Vacío u 'off' = no enviar thinkingConfig.
        thinkingLevel: nivelPensamiento.toLowerCase() === 'off' ? '' : nivelPensamiento,
      },
      groq: {
        nombre: 'Groq',
        claveEnv: 'GROQ_API_KEY',
        modelosEnv: 'GROQ_MODELS',
        apiKey: env.GROQ_API_KEY,
        baseURL: env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
        modelos: lista(env.GROQ_MODELS, MODELOS_GROQ),
        temperature: 0.7,
        top_p: 0.95,
        presence_penalty: 0.4,
        frequency_penalty: 0.2,
        maxTokens: Number(env.GROQ_MAX_TOKENS) || 16000, // se recorta solo si tu plan tiene poco TPM
        // Solo para gpt-oss: 'low' por defecto. Vacío u 'off' = no enviar reasoning_effort.
        esfuerzoRazonamiento: esfuerzoGroq.toLowerCase() === 'off' ? '' : esfuerzoGroq,
      },
    },
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

// Convierte una "estrofa" en HTML aunque el modelo la haya devuelto como objeto o array anidado.
function aTextoHtml(item) {
  if (typeof item === 'string') return item;
  if (Array.isArray(item)) return item.map(aTextoHtml).filter(Boolean).join('');
  if (item && typeof item === 'object') {
    for (const k of ['html', 'text', 'texto', 'content', 'contenido', 'p']) {
      if (typeof item[k] === 'string') return item[k];
    }
  }
  return '';
}

// Valida y corrige desviaciones frecuentes de los modelos (stanzas como cadena, como objetos,
// interactiveNodes como array…). Si no es recuperable, el error dice QUÉ recibió.
function normalizarAnotacion(d) {
  const mal = (m) => { throw errorConCodigo('JSON_INVALIDO', m); };
  if (Array.isArray(d) && d.length === 1) d = d[0];
  if (!d || typeof d !== 'object' || Array.isArray(d)) mal('La respuesta no es un objeto JSON.');
  const claves = Object.keys(d).join(', ') || '(ninguna)';

  if (!d.meta || typeof d.meta !== 'object') mal(`Falta "meta". Claves recibidas: ${claves}.`);

  let nodos = d.interactiveNodes;
  if (Array.isArray(nodos)) {
    nodos = Object.fromEntries(nodos.filter((n) => n && n.id).map((n) => [n.id, n]));
  }
  if (!nodos || typeof nodos !== 'object' || !Object.keys(nodos).length) {
    mal(`Falta "interactiveNodes" o está vacío. Claves recibidas: ${claves}.`);
  }

  let bruto = d.stanzas ?? d.stanza ?? d.estrofas;
  if (typeof bruto === 'string') bruto = [bruto];
  const estrofas = Array.isArray(bruto) ? bruto.map(aTextoHtml).map((x) => x.trim()).filter(Boolean) : [];
  if (!estrofas.length) {
    mal(`Falta "stanzas" utilizable (tipo recibido: ${Array.isArray(bruto) ? 'array' : typeof bruto}). Claves recibidas: ${claves}.`);
  }

  return { ...d, interactiveNodes: nodos, stanzas: estrofas };
}

// ---------------------------------------------------------------------------
// Control de tiempo común: inactividad, presupuesto total y cancelación del cliente
// ---------------------------------------------------------------------------

async function conControlDeTiempo(ajustes, limite, senalCliente, tarea) {
  const ctrl = new AbortController();
  let motivo = null;
  const abortar = (m) => { motivo = m; ctrl.abort(); };
  if (senalCliente) {
    if (senalCliente.aborted) throw errorConCodigo('CANCELADO', 'Petición cancelada por el cliente.');
    senalCliente.addEventListener('abort', () => abortar('cliente'), { once: true });
  }

  let temporizador;
  const latir = () => { // llamar cada vez que llegan datos
    clearTimeout(temporizador);
    const espera = Math.max(1000, Math.min(ajustes.inactividadMs, limite - Date.now()));
    temporizador = setTimeout(() => abortar('inactividad'), espera);
  };

  latir();
  try {
    return await tarea(ctrl.signal, latir);
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
// Proveedores con API compatible con OpenAI (OpenRouter y Groq): streaming interno
// ---------------------------------------------------------------------------

async function pedirAOpenAICompat(client, modelo, prompt, senal, latir, opciones) {
  const flujo = await client.chat.completions.create(
    {
      model: modelo,
      messages: [
        { role: 'system', content: prompt.sistema },
        { role: 'user', content: prompt.usuario },
      ],
      stream: true,
      temperature: opciones.temperature,
      ...opciones.tokens, // { max_tokens } (OpenRouter) o { max_completion_tokens } (Groq)
      ...opciones.extra,
    },
    { signal: senal },
  );

  let texto = '';
  let fin = null;
  let modeloReal = modelo;
  for await (const trozo of flujo) {
    latir();
    if (trozo.model) modeloReal = trozo.model;
    if (trozo.error) throw errorConCodigo('PROVEEDOR', trozo.error.message || 'Error del proveedor durante la generación.');
    const eleccion = trozo.choices?.[0];
    if (eleccion?.delta?.content) texto += eleccion.delta.content; // el razonamiento (delta.reasoning) se ignora
    if (eleccion?.finish_reason) fin = eleccion.finish_reason;
  }

  if (fin === 'length') throw errorConCodigo('TRUNCADO', 'La respuesta superó el máximo de tokens y quedó cortada.');
  if (fin === 'error') throw errorConCodigo('PROVEEDOR', 'El proveedor terminó la generación con error.');
  if (!texto.trim()) throw errorConCodigo('VACIO', 'El modelo devolvió una respuesta vacía.');
  return { texto, modeloReal };
}

// OpenRouter: sin response_format (muchos proveedores gratuitos no lo soportan; el parser
// ya tolera bloques ```json y texto alrededor).
function pedirAOpenRouter(client, prov, modelo, prompt, senal, latir) {
  return pedirAOpenAICompat(client, modelo, prompt, senal, latir, {
    temperature: 0.7,
    tokens: { max_tokens: prov.maxTokens },
    extra: {},
  });
}

// ---------------------------------------------------------------------------
// Proveedor: Groq (mismo cliente OpenAI + gestión de sus límites de tokens/minuto)
// ---------------------------------------------------------------------------

const MIN_TOKENS_SALIDA_GROQ = 1200; // por debajo no compensa: la anotación no cabría

const dormir = (ms, senal, latir) => new Promise((resolve, reject) => {
  const alAbortar = () => { clearTimeout(t); reject(new Error('Espera cancelada.')); };
  const t = setTimeout(() => { senal.removeEventListener('abort', alAbortar); latir(); resolve(); }, ms);
  if (senal.aborted) { alAbortar(); return; }
  senal.addEventListener('abort', alAbortar, { once: true });
  latir(); // reinicia el temporizador de inactividad mientras esperamos
});

// Extrae del error de Groq: límite, usado, pedido y si el tope es diario o por minuto.
function leerLimiteGroq(err) {
  const msg = String(err?.message || '');
  const conUsado = msg.match(/Limit\s+(\d+)[,\s]+Used\s+(\d+)[,\s]+Requested\s+(\d+)/i);
  const sinUsado = msg.match(/Limit\s+(\d+)[,\s]+Requested\s+(\d+)/i);
  return {
    limite: conUsado ? Number(conUsado[1]) : sinUsado ? Number(sinUsado[1]) : null,
    pedido: conUsado ? Number(conUsado[3]) : sinUsado ? Number(sinUsado[2]) : null,
    esDiario: /per day|\((?:TPD|RPD)\)/i.test(msg),
  };
}

// Milisegundos a esperar antes de reintentar un 429 por minuto (null = no merece la pena).
function esperaSugeridaGroq(err) {
  let seg = Number(err?.headers?.['retry-after']);
  if (!Number.isFinite(seg)) {
    const tras = String(err?.message || '').split(/try again in/i)[1] || '';
    const trozos = [...tras.matchAll(/(\d+(?:\.\d+)?)\s*(ms|h|m|s)\b/gi)];
    if (trozos.length) {
      const unidad = { ms: 0.001, s: 1, m: 60, h: 3600 };
      seg = trozos.reduce((a, [, n, u]) => a + Number(n) * unidad[u.toLowerCase()], 0);
    }
  }
  if (!Number.isFinite(seg)) seg = 10; // 429 sin datos: espera prudente
  return seg > 60 ? null : Math.ceil(seg * 1000) + 500;
}

// Solo los gpt-oss aceptan reasoning_effort / include_reasoning; con otros modelos no se envía nada.
function extrasGroq(prov, modelo) {
  if (!/^openai\/gpt-oss/i.test(modelo)) return {};
  return { ...(prov.esfuerzoRazonamiento ? { reasoning_effort: prov.esfuerzoRazonamiento } : {}), include_reasoning: false };
}

async function pedirAGroq(client, prov, modelo, prompt, senal, latir) {
  let maxTokens = prov.maxTokens;
  let conExtras = true;
  let esperas = 0;
  let pedidoAnterior = Infinity;

  for (let intento = 0; intento < 5; intento++) {
    try {
      return await pedirAOpenAICompat(client, modelo, prompt, senal, latir, {
        temperature: 0.7, // rango recomendado por Groq para modelos de razonamiento: 0.5-0.7
        tokens: { max_completion_tokens: maxTokens }, // por defecto Groq usa solo 1024
        extra: conExtras ? extrasGroq(prov, modelo) : {},
      });
    } catch (err) {
      // 1) parámetro de razonamiento no soportado por ese modelo → reintento sin él
      if (err.status === 400 && conExtras && /reasoning/i.test(err.message) && Object.keys(extrasGroq(prov, modelo)).length) {
        console.warn(`[generar] ${modelo} rechazó los parámetros de razonamiento; se reintenta sin ellos.`);
        conExtras = false;
        continue;
      }

      if (err.status === 413 || err.status === 429) {
        const info = leerLimiteGroq(err);
        if (info.esDiario) throw err;

        // 2) la petición sola ya supera el tope por minuto de tu plan → recortar la salida máxima
        if (info.limite && info.pedido && info.pedido > info.limite) {
          const nuevo = maxTokens - (info.pedido - info.limite) - 256;
          const sinProgreso = info.pedido >= pedidoAnterior;
          if (nuevo < MIN_TOKENS_SALIDA_GROQ || sinProgreso) {
            throw Object.assign(errorConCodigo('TPM_INSUFICIENTE',
              `La petición (prompt + salida) necesita unos ${info.pedido} tokens y el límite por minuto de tu plan de Groq es ${info.limite}. `
              + 'Con ese límite este prompt no cabe: pasa al plan Developer de Groq o usa otro motor.'), { detalles: String(err.message).slice(0, 300) });
          }
          console.warn(`[generar] Groq: max_completion_tokens ${maxTokens} → ${nuevo} (límite ${info.limite}, pedido ${info.pedido}).`);
          pedidoAnterior = info.pedido;
          maxTokens = nuevo;
          continue;
        }

        // 3) tope por minuto ocupado por peticiones anteriores → esperar y reintentar
        if (err.status === 429 && esperas < 2) {
          const ms = esperaSugeridaGroq(err);
          if (ms !== null) {
            esperas++;
            console.warn(`[generar] Groq: límite por minuto; espera de ${ms} ms.`);
            await dormir(ms, senal, latir);
            continue;
          }
        }
      }

      if (err.codigo === 'TRUNCADO' && maxTokens < prov.maxTokens) {
        err.detalles = `max_completion_tokens se redujo a ${maxTokens} por el límite de tokens/minuto de tu plan de Groq.`;
      }
      throw err;
    }
  }
  throw errorConCodigo('PROVEEDOR', 'Groq: demasiados reintentos.');
}

// ---------------------------------------------------------------------------
// Proveedor 2: Gemini (REST + SSE con fetch, sin SDK)
// ---------------------------------------------------------------------------

function errorHttpGemini(status, cuerpo) {
  let mensaje = String(cuerpo || '').slice(0, 300);
  try {
    const j = JSON.parse(cuerpo);
    if (j?.error?.message) mensaje = `${j.error.status || ''} ${j.error.message}`.trim().slice(0, 300);
  } catch (_) { /* cuerpo no JSON */ }
  const e = new Error(`HTTP ${status}: ${mensaje}`);
  e.status = status;
  return e;
}

async function pedirAGemini(prov, modelo, prompt, senal, latir) {
  const url = `${prov.baseURL}/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`;
  const construirCuerpo = (conPensamiento) => ({
    systemInstruction: { parts: [{ text: prompt.sistema }] },
    contents: [{ role: 'user', parts: [{ text: prompt.usuario }] }],
    generationConfig: {
      // Sin temperature/topP/topK: Google los da por obsoletos en los modelos Gemini 3.
      maxOutputTokens: prov.maxTokens,
      responseMimeType: 'application/json',
      ...(conPensamiento && prov.thinkingLevel ? { thinkingConfig: { thinkingLevel: prov.thinkingLevel } } : {}),
    },
  });
  const enviar = (conPensamiento) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': prov.apiKey },
    body: JSON.stringify(construirCuerpo(conPensamiento)),
    signal: senal,
  });

  let resp = await enviar(true);
  if (resp.status === 400 && prov.thinkingLevel) {
    // Algunos modelos no admiten ese nivel de razonamiento: se reintenta sin thinkingConfig.
    const cuerpo = await resp.text();
    if (!/thinking/i.test(cuerpo)) throw errorHttpGemini(resp.status, cuerpo);
    console.warn(`[generar] ${modelo} rechazó thinkingLevel="${prov.thinkingLevel}"; se reintenta sin él.`);
    resp = await enviar(false);
  }
  if (!resp.ok) throw errorHttpGemini(resp.status, await resp.text());
  if (!resp.body) throw errorConCodigo('PROVEEDOR', 'Gemini respondió sin cuerpo.');

  let texto = '';
  let fin = null;
  let bloqueo = null;
  let modeloReal = modelo;

  const procesarEvento = (evento) => {
    const datos = evento.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
    if (!datos) return;
    let d;
    try { d = JSON.parse(datos); } catch (_) { return; }
    if (d.error) throw errorConCodigo('PROVEEDOR', d.error.message || 'Error de Gemini durante la generación.');
    if (d.modelVersion) modeloReal = d.modelVersion;
    if (d.promptFeedback?.blockReason) bloqueo = `prompt bloqueado (${d.promptFeedback.blockReason})`;
    const cand = d.candidates?.[0];
    for (const p of cand?.content?.parts || []) {
      if (typeof p.text === 'string' && !p.thought) texto += p.text; // se ignoran los "pensamientos"
    }
    if (cand?.finishReason) fin = cand.finishReason;
  };

  const lector = resp.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    latir();
    buffer += decodificador.decode(value, { stream: true });
    let i;
    while ((i = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const evento = buffer.slice(0, i);
      buffer = buffer.slice(i).replace(/^\r?\n\r?\n/, '');
      procesarEvento(evento);
    }
  }
  if (buffer.trim()) procesarEvento(buffer);

  if (bloqueo && !texto) throw errorConCodigo('BLOQUEADO', `Gemini bloqueó la petición: ${bloqueo}.`);
  if (fin === 'MAX_TOKENS') throw errorConCodigo('TRUNCADO', 'La respuesta superó el máximo de tokens y quedó cortada.');
  if (fin && fin !== 'STOP') {
    throw errorConCodigo('BLOQUEADO', `Gemini detuvo la generación (finishReason: ${fin}), p. ej. por filtros de seguridad o de recitación.`);
  }
  if (!texto.trim()) throw errorConCodigo('VACIO', 'Gemini devolvió una respuesta vacía.');
  return { texto, modeloReal };
}

// ---------------------------------------------------------------------------
// Respaldo entre modelos: falla el modelo O falla su salida → siguiente modelo
// ---------------------------------------------------------------------------

async function generarConRespaldo(proveedorId, prompt, ajustes, senalCliente, referer) {
  const prov = ajustes.proveedores[proveedorId];
  const client = proveedorId === 'gemini'
    ? null
    : new OpenAI({
      apiKey: prov.apiKey,
      baseURL: prov.baseURL,
      maxRetries: 0, // los reintentos los gestionamos nosotros (cambiando de modelo)
      ...(proveedorId === 'openrouter'
        ? { defaultHeaders: { 'HTTP-Referer': referer, 'X-Title': 'Edicion Interactiva Anotada' } }
        : {}),
    });

  const limite = Date.now() + ajustes.presupuestoMs;
  const fallos = [];
  let todosLimite = true;
  let algunaSalidaInvalida = false;
  let algunBloqueo = false;

  for (const modelo of prov.modelos) {
    if (limite - Date.now() < 20_000) break; // ya no da tiempo a otro intento

    let modeloReal = modelo;
    let muestra = '';
    try {
      const salida = await conControlDeTiempo(ajustes, limite, senalCliente, (senal, latir) => {
        if (proveedorId === 'gemini') return pedirAGemini(prov, modelo, prompt, senal, latir);
        if (proveedorId === 'groq') return pedirAGroq(client, prov, modelo, prompt, senal, latir);
        return pedirAOpenRouter(client, prov, modelo, prompt, senal, latir);
      });
      modeloReal = salida.modeloReal;
      muestra = salida.texto.slice(0, 300);
      const datos = normalizarAnotacion(extraerJson(salida.texto));
      console.log(`[generar] OK con ${prov.nombre}/${modeloReal}`);
      return datos;
    } catch (err) {
      const codigo = err.codigo || (err.status ? `HTTP_${err.status}` : 'DESCONOCIDO');
      console.warn(`[generar] ${prov.nombre}/${modelo} falló (${codigo}): ${err.message}`);
      if (muestra) console.warn(`[generar] inicio de la salida recibida: ${muestra}`);
      const etiqueta = modeloReal !== modelo ? `${modelo} [${modeloReal}]` : modelo;
      fallos.push(`${etiqueta} → ${codigo}: ${err.message}`);

      if (codigo === 'CANCELADO') throw err;
      if (codigo === 'TRUNCADO') throw err; // otro modelo tampoco cabrá: que el cliente divida el texto
      if (codigo === 'TPM_INSUFICIENTE') throw err; // el tope es del plan, no del modelo
      if (err.status !== 429) todosLimite = false;
      if (['JSON_INVALIDO', 'VACIO'].includes(codigo)) algunaSalidaInvalida = true;
      if (codigo === 'BLOQUEADO') algunBloqueo = true;
    }
  }

  const detalles = fallos.join(' | ').slice(0, 700);
  if (fallos.length && todosLimite) {
    throw Object.assign(
      errorConCodigo('LIMITE', {
        gemini: 'Se ha alcanzado el límite de uso de la API de Gemini (cuota diaria o por minuto).',
        groq: 'Se ha alcanzado el límite de uso de Groq (peticiones o tokens por minuto/día de tu plan).',
      }[proveedorId] || 'Se ha alcanzado el límite de uso de los modelos gratuitos de OpenRouter (20 peticiones/minuto; 50/día sin créditos comprados).'),
      { detalles },
    );
  }
  if (algunaSalidaInvalida) {
    throw Object.assign(errorConCodigo('SALIDA_INVALIDA', 'Los modelos no devolvieron un JSON válido para este fragmento.'), { detalles });
  }
  if (algunBloqueo) {
    throw Object.assign(errorConCodigo('BLOQUEADO', `${prov.nombre} bloqueó la respuesta para este fragmento.`), { detalles });
  }
  throw Object.assign(
    errorConCodigo('MODELOS_NO_DISPONIBLES', `Ningún modelo de ${prov.nombre} respondió. Revisa ${prov.modelosEnv} y ${prov.claveEnv}.`),
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
        version: VERSION,
        proveedores: Object.fromEntries(Object.entries(ajustes.proveedores).map(([id, p]) => [
          id, { apiKeyConfigurada: Boolean(p.apiKey), modelos: p.modelos },
        ])),
      }, cors);
    }

    if (req.method !== 'POST') {
      return respuestaJson(405, { error: 'Método no permitido. Utiliza POST.', codigo: 'METODO' }, cors);
    }

    let cuerpo;
    try {
      cuerpo = await req.json();
    } catch (_) {
      return respuestaJson(400, { error: 'El cuerpo de la petición debe ser JSON válido.', codigo: 'PETICION' }, cors);
    }

    const proveedorId = cuerpo?.proveedor === undefined ? 'openrouter' : String(cuerpo.proveedor);
    const prov = ajustes.proveedores[proveedorId];
    if (!prov) {
      return respuestaJson(400, {
        error: `Proveedor no válido: "${proveedorId}". Usa "openrouter", "gemini" o "groq".`,
        codigo: 'PETICION',
      }, cors);
    }

    if (!prov.apiKey) {
      return respuestaJson(500, {
        error: `El servidor no tiene configurada la clave ${prov.claveEnv} (necesaria para ${prov.nombre}).`,
        codigo: 'CONFIG',
        detalles: `Añádela en Vercel → Settings → Environment Variables (entorno Production) y vuelve a desplegar.`,
      }, cors);
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

    const prompt = {
      sistema: SYSTEM_PROMPT,
      usuario: construirMensajeUsuario(textoPlano, parte, totalPartes, contexto),
    };
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
          const resultado = await generarConRespaldo(proveedorId, prompt, ajustes, req.signal, referer);
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
