// Requiere: Node.js + Express + Multer + Socket.IO
const express = require('express');
const multer  = require('multer');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = 3000;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const USERS_DB = path.join(__dirname, 'users.json');
if (!fs.existsSync(USERS_DB)) fs.writeFileSync(USERS_DB, '{}', 'utf-8');

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const username = req.body.username || req.query.username || 'anonimo';
    cb(null, username + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage: storage });

// --- Carga países y regiones dinámicamente según tu SVG (Simplemaps usa 3 letras) ---
const simplemaps_country_names = require('./simplemaps_country_names.json'); // archivo generado con { "usa": {nombre: "Estados Unidos"}, ... }

let paises = simplemaps_country_names;

// Inicialización de ejemplo para regiones (puedes cargar de archivo o base de datos real)
let regiones = {};
let generales = {};

for (const pid in paises) {
  regiones[pid] = {
    owner: null,
    tropas: 0,
    color: "#cccccc",
    terreno: "Llanura",
    poblacion: 1000000 + Math.floor(Math.random() * 10000000)
  };
}

// --- Express STATIC ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.json());

// --- API para subir foto de perfil ---
app.post('/api/upload-foto', upload.single('foto'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
  const username = req.body.username;
  if (!username) return res.status(400).json({ ok: false, error: 'Missing username' });

  let users = {};
  try { users = JSON.parse(fs.readFileSync(USERS_DB)); } catch(e) {}
  users[username] = users[username] || {};
  users[username].fotoURL = '/uploads/' + req.file.filename;
  fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));

  res.json({ ok: true, url: '/uploads/' + req.file.filename });
});

// --- API para obtener datos de usuario (incluyendo foto) ---
app.get('/api/user/:username', (req, res) => {
  let users = {};
  try { users = JSON.parse(fs.readFileSync(USERS_DB)); } catch(e) {}
  const user = users[req.params.username];
  let gameUser = generales[req.params.username];
  let out = { username: req.params.username, ...user };
  if (gameUser) {
    out = { ...out, ...gameUser };
  }
  res.json(out);
});

// --- SOCKET.IO JUEGO ---
io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('register', (username) => {
    currentUser = username;
    // Si el general no existe, asigna una región libre
    if (!generales[username]) {
      const regionesLibres = Object.keys(regiones).filter(r => !regiones[r].owner);
      if (regionesLibres.length > 0) {
        const regionNueva = regionesLibres[0];
        regiones[regionNueva].owner = username;
        regiones[regionNueva].tropas = 2;
        regiones[regionNueva].color = "#3ca7d3";
        generales[username] = {
          especialidad: regiones[regionNueva].terreno || "Llanura",
          puntos: 0,
          regiones: [regionNueva],
          tropas: { [regionNueva]: 2 }
        };
      } else {
        generales[username] = { especialidad: "Llanura", puntos: 0, regiones: [], tropas: {} };
      }
    }
    socket.emit('init', { regiones, generales, paises });
    sendPerfil(socket, username);
  });

  socket.on('reclutar', ({ region, cantidad }) => {
    if (!regiones[region]) return;
    if (regiones[region].owner !== currentUser) return;
    const maximo = Math.floor(regiones[region].poblacion * 0.05) - regiones[region].tropas;
    if (cantidad < 1 || cantidad > maximo) return;
    regiones[region].tropas += cantidad;
    if (!generales[currentUser].tropas) generales[currentUser].tropas = {};
    generales[currentUser].tropas[region] = regiones[region].tropas;
    if (!generales[currentUser].regiones.includes(region)) generales[currentUser].regiones.push(region);
    io.emit('update', { regiones, generales, paises });
    sendPerfil(socket, currentUser);
  });

  socket.on('atacarRegion', ({ origen, destino, tropas }) => {
    if (!regiones[origen] || !regiones[destino]) return;
    if (regiones[origen].owner !== currentUser) return;
    if (regiones[origen].tropas < tropas || tropas < 1) return;
    let win = Math.random() < 0.5;
    let resumenCombate = {
      atacante: currentUser,
      defensor: regiones[destino].owner,
      origen, destino,
      fuerzaAtacante: tropas,
      fuerzaDefensor: regiones[destino].tropas,
      bajasAtacante: win ? 1 : tropas,
      bajasDefensor: win ? regiones[destino].tropas : 1,
      ganador: win ? currentUser : regiones[destino].owner
    };
    if (win) {
      regiones[destino].owner = currentUser;
      regiones[destino].tropas = tropas - 1;
      regiones[origen].tropas -= tropas;
      regiones[destino].color = regiones[origen].color;
      if (!generales[currentUser].regiones.includes(destino)) generales[currentUser].regiones.push(destino);
      if (!generales[currentUser].tropas) generales[currentUser].tropas = {};
      generales[currentUser].tropas[destino] = regiones[destino].tropas;
    } else {
      regiones[origen].tropas -= tropas;
    }
    io.emit('update', { regiones, generales, paises, resumenCombate });
    sendPerfil(socket, currentUser);
  });

  socket.on('pedirPerfil', () => {
    sendPerfil(socket, currentUser);
  });
});

function sendPerfil(socket, username) {
  let users = {};
  try { users = JSON.parse(fs.readFileSync(USERS_DB)); } catch(e) {}
  let user = users[username] || {};
  let gameUser = generales[username] || {};
  socket.emit('perfil', { username, ...user, ...gameUser });
}

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});