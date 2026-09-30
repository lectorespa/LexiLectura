# Idiomas de la interfaz

`strings.json` es la única fuente de verdad: `_idiomas` define los idiomas disponibles
(código, nombre nativo, nombre en español, si es de derecha a izquierda) y cada código
(`es`, `en`, `fr`…) tiene el diccionario de esa lengua. `es` es la fuente: si a otro idioma
le falta una clave, la interfaz cae automáticamente al texto en español (nunca se queda
con un hueco en blanco).

## Añadir un texto nuevo a la interfaz

1. Añade la clave solo en `es`, con su texto.
2. Usa `data-i18n="tu.clave"` en el HTML (o `data-i18n-placeholder` / `data-i18n-title` /
   `data-i18n-aria-label` según el atributo), o `t('tu.clave')` desde JavaScript.
3. Ejecuta el script de traducción (abajo) para rellenar el resto de idiomas. No hace falta
   traducir nada a mano.

## Añadir un idioma nuevo

Añade una entrada a `_idiomas` con su código, nombre nativo, nombre en español y si es RTL,
y una entrada `"codigo": {}` vacía al final del archivo. Ejecuta el script de traducción y
listo: no hay que tocar el HTML, los selectores se rellenan solos.

## Traducir automáticamente lo que falte

```
GEMINI_API_KEY=tu_clave node i18n/actualizar-traducciones.mjs
```

Opciones:
- `--proveedor=groq` — usa Groq en vez de Gemini (necesita `GROQ_API_KEY`).
- `--idiomas=fr,de,ja` — solo esos idiomas.
- `--forzar` — retraduce todas las claves, no solo las que faltan (útil si has reescrito
  algo en español y quieres que se actualice en el resto de idiomas).

El script guarda el archivo tras cada idioma, así que un fallo a mitad no pierde el trabajo
ya hecho.
