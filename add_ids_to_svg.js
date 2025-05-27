const fs = require('fs');

// Lee el archivo SVG en la misma carpeta que este script
const svgPath = 'world.svg';
const outputPath = 'world-with-ids.svg';

// Lee el SVG como texto
let svg = fs.readFileSync(svgPath, 'utf8');

// Busca elementos SVG con class="Pais" y les agrega un id basado en la clase
svg = svg.replace(
  /(<(path|polygon|g|rect|circle|ellipse)\s+[^>]*?)class="([^"]+)"([^>]*)(?<!id="[^"]+")/g,
  (match, before, tag, className, after) => {
    // Convierte el nombre de la clase a id: elimina espacios, minúsculas, etc.
    const id = className.trim().toLowerCase().replace(/\s+/g, '_');
    // Si ya tiene id, no lo modifica
    if (/id="/.test(match)) return match;
    return `${before}id="${id}" class="${className}"${after}`;
  }
);

// Escribe el SVG modificado a un nuevo archivo
fs.writeFileSync(outputPath, svg, 'utf8');
console.log(`SVG actualizado y guardado como ${outputPath}`);