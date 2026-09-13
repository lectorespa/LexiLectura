const urlParams = new URLSearchParams(window.location.search);
const jsonFile = urlParams.get('file') || 'default.json';

async function inicializarVisor() {
  if (!jsonFile || jsonFile === 'default.json') return;
  try {
    // Elimina prefijos repetidos para evitar el error 404
    const cleanFile = jsonFile.replace(/^textos\//i, '');
    const response = await fetch(`./textos/${cleanFile}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (window.app) {
      window.app.data = data;
      window.app.render();
    }
  } catch (err) {
    console.error("Error al cargar el JSON inicial:", err);
  }
}

document.addEventListener('DOMContentLoaded', inicializarVisor);