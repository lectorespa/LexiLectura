const fs = require('fs');
const path = require('path');

const textosDir = './textos';
const outputFile = './catalogo.json';

if (!fs.existsSync(textosDir)) {
  console.log('El directorio /textos no existe.');
  fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
  process.exit(0);
}

const files = fs.readdirSync(textosDir).filter(file => file.endsWith('.json'));

const catalog = files.map(file => {
  try {
    const filePath = path.join(textosDir, file);
    let rawData = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    const data = JSON.parse(rawData);

    return {
      file: file,
      title: data.meta?.title || data.meta?.titulo || data.title || file,
      author: data.meta?.author || data.meta?.autor || data.author || ''
    };
  } catch (err) {
    console.error(`Error procesando ${file}:`, err);
    return {
      file: file,
      title: file,
      author: ''
    };
  }
});

// IMPORTANTE: Se guarda como JSON plano válido, sin "window.OBRAS_CATALOGO ="
fs.writeFileSync(outputFile, JSON.stringify(catalog, null, 2), 'utf-8');
console.log(`Catálogo generado con ${catalog.length} obras en ${outputFile}`);
