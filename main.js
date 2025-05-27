let socket, username, regiones, generales, paises;
let perfil = null;

function nombrePais(id) {
  if (!paises || !paises[id]) return id;
  return paises[id].nombre || id;
}

window.showGame = function() {
  username = localStorage.getItem('rr-username');
  document.getElementById('gameArea').innerHTML = `
    <nav id="mainNav">
      <span class="nav-logo">
        <img src="https://cdn-icons-png.flaticon.com/512/657/657406.png" style="height:32px;width:32px;vertical-align:middle;">
        Conquista LATAM
      </span>
      <button class="nav-btn" id="btnMapa">Mapa</button>
      <button class="nav-btn" id="btnPerfil">Perfil</button>
      <button class="nav-btn nav-logout" onclick="logout()">Salir</button>
      <span class="nav-user">👤 ${username}</span>
    </nav>
    <div id="vistaMapa" style="display:block;">
      <div id="mensajes"></div>
      <div id="svgContainer"></div>
      <div id="regionSeleccionada"></div>
      <div id="combateResumen"></div>
      <ul id="listaRegiones"></ul>
      <div id="contextMenu"></div>
    </div>
    <div id="vistaPerfil" style="display:none;">
      <div class="perfil-box">
        <div style="text-align:center;">
          <img id="perfilFoto" src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="Foto de perfil" style="width:110px;height:110px;border-radius:50%;border:3px solid #e4ba56;margin-bottom:10px;">
          <input type="file" id="inputPerfilFoto" accept="image/*" style="display:block;margin:10px auto;">
        </div>
        <h2>Perfil de <span id="perfilNombre"></span></h2>
        <p><b>Especialidad:</b> <span id="perfilEspecialidad"></span></p>
        <h4>Regiones controladas:</h4>
        <ul id="perfilListaRegiones"></ul>
        <h4>Otros datos:</h4>
        <ul id="perfilOtrosDatos"></ul>
      </div>
    </div>
  `;

  document.getElementById('btnMapa').onclick = function() {
    document.getElementById('vistaMapa').style.display = "block";
    document.getElementById('vistaPerfil').style.display = "none";
  };
  document.getElementById('btnPerfil').onclick = function() {
    document.getElementById('vistaMapa').style.display = "none";
    document.getElementById('vistaPerfil').style.display = "block";
    mostrarPerfil();
  };

  iniciarSocketsYMapa();
  setupPerfilFoto();
};

function iniciarSocketsYMapa() {
  socket = io();
  socket.emit('register', username);

  fetch('world.svg')
    .then(res => res.text())
    .then(svgText => {
      document.getElementById('svgContainer').innerHTML = svgText;
      let svgElement = document.querySelector('#svgContainer svg');
      svgElement.setAttribute('width', '1200');
      svgElement.setAttribute('height', '700');
      if (window.svgPanZoom) window.svgPanZoom(svgElement, { zoomEnabled: true, controlIconsEnabled: true });

      socket.on('init', ({ regiones: r, generales: g, paises: p }) => {
        regiones = r; generales = g; paises = p;
        renderMapa(); renderListaRegiones();
      });
      socket.on('update', ({ regiones: r, generales: g, paises: p, resumenCombate }) => {
        regiones = r; generales = g; if (p) paises = p;
        renderMapa(); renderListaRegiones();
        if (resumenCombate) renderCombateResumen(resumenCombate);
      });
    });

  socket.on('mensaje', txt => {
    document.getElementById('mensajes').textContent = txt;
    setTimeout(() => { document.getElementById('mensajes').textContent = ""; }, 5000);
  });

  socket.on('perfil', p => {
    perfil = p;
    mostrarPerfil();
  });
}

function renderMapa() {
  let allPaths = document.querySelectorAll('#svgContainer svg [id]');
  allPaths.forEach(pais => {
    const id = pais.id;
    if (!regiones || !regiones[id]) {
      pais.style.fill = '#cccccc';
      pais.style.stroke = '#222';
      pais.onclick = null;
      pais.style.cursor = "";
      pais.style.filter = "";
      return;
    }
    let color = regiones[id].color || '#FFD700';
    pais.style.fill = color;
    pais.style.stroke = '#222';
    if (regiones[id].owner && username && regiones[id].owner.trim().toLowerCase() === username.trim().toLowerCase()) {
      pais.style.filter = "drop-shadow(0 0 6px #00eb85)";
    } else {
      pais.style.filter = "";
    }
    pais.onclick = (e) => seleccionarRegion(id, e);
    pais.style.cursor = "pointer";

    // --- MENÚ CONTEXTUAL MODERNO (click derecho) ---
    if (!pais._ctxMenuListenerAdded) {
      pais.addEventListener('contextmenu', function(evt) {
        evt.preventDefault();
        mostrarMenuPaisContextual(id, evt);
      });
      pais._ctxMenuListenerAdded = true;
    }
    // --- FIN MENÚ CONTEXTUAL MODERNO ---
  });
}
let regionActiva = null;
function seleccionarRegion(rid, evt) {
  regionActiva = rid;
  const reg = regiones[rid];
  let html = `<h3>${nombrePais(rid)}</h3>
    <p><b>Terreno:</b> ${reg.terreno || "?"}</p>
    <p><b>Dueño:</b> ${reg.owner || "?"}</p>
    <p><b>Tropas:</b> ${reg.tropas || 0}</p>
    <p><b>Población:</b> ${reg.poblacion ? reg.poblacion.toLocaleString() : "?"}</p>`;
  document.getElementById('regionSeleccionada').innerHTML = html;
  showContextMenu(rid, evt);
}
function renderListaRegiones() {
  let ul = document.getElementById('listaRegiones');
  ul.innerHTML = "";
  for (let rid in regiones) {
    let reg = regiones[rid];
    let li = document.createElement('li');
    li.innerHTML = `<b>${nombrePais(rid)}</b>: ${reg.tropas || 0} inf (Dueño: ${reg.owner || "?"})`;
    ul.appendChild(li);
  }
}
function showContextMenu(rid, evt) {
  let menu = document.getElementById('contextMenu');
  let reg = regiones[rid];
  let html = "";
  if (reg.owner && username && reg.owner.trim().toLowerCase() === username.trim().toLowerCase()) {
    html += `<button onclick="mostrarReclutar('${rid}')">Reclutar infantería</button>`;
    html += `<button onclick="mostrarAtaque('${rid}')">Atacar desde aquí</button>`;
  }
  if (html) {
    menu.innerHTML = html;
    menu.style.display = 'block';
    menu.style.left = (evt.clientX + 10) + "px";
    menu.style.top = (evt.clientY + 10) + "px";
  } else {
    menu.style.display = 'none';
  }
  document.body.onclick = function(e) {
    if (!menu.contains(e.target)) menu.style.display = 'none';
  };
}
function mostrarReclutar(rid) {
  let reg = regiones[rid];
  const maximo = Math.floor((reg.poblacion || 0) * 0.05) - (reg.tropas || 0);
  let html = `<form id="formReclutar">
    <input type="number" id="inputReclutar" min="1" max="${maximo}" value="1" />
    <small>Máximo reclutable: ${maximo}</small>
    <button type="submit">Reclutar</button>
  </form>`;
  document.getElementById('contextMenu').innerHTML = html;
  document.getElementById('formReclutar').onsubmit = function(e) {
    e.preventDefault();
    let cantidad = parseInt(document.getElementById('inputReclutar').value);
    socket.emit('reclutar', { region: rid, cantidad });
    document.getElementById('contextMenu').style.display = 'none';
  };
}
function mostrarAtaque(origen) {
  let opciones = Object.keys(regiones)
    .filter(rid => rid !== origen && regiones[rid].owner !== username);
  let html = `<form id="formAtaque">
    <label>Región objetivo:
      <select id="selDestino">
        ${opciones.map(rid => `<option value="${rid}">${nombrePais(rid)}</option>`).join("")}
      </select>
    </label>
    <label>Tropas a enviar:
      <input type="number" id="inputAtaqueTropas" min="1" max="${regiones[origen].tropas}" value="1"/>
    </label>
    <button type="submit">Atacar</button>
  </form>`;
  document.getElementById('contextMenu').innerHTML = html;
  document.getElementById('formAtaque').onsubmit = function(e) {
    e.preventDefault();
    let destino = document.getElementById('selDestino').value;
    let tropas = parseInt(document.getElementById('inputAtaqueTropas').value);
    socket.emit('atacarRegion', { origen, destino, tropas });
    document.getElementById('contextMenu').style.display = 'none';
  };
}
function renderCombateResumen(combate) {
  let html = `<h3>Resumen del combate</h3>
  <p><b>${combate.atacante}</b> atacó desde <b>${nombrePais(combate.origen)}</b> a <b>${nombrePais(combate.destino)}</b> defendido por <b>${combate.defensor}</b>.</p>
  <p>Fuerza atacante: <b>${combate.fuerzaAtacante}</b> | Fuerza defensor: <b>${combate.fuerzaDefensor}</b></p>
  <ul>
    <li>Bajas atacante: ${combate.bajasAtacante}</li>
    <li>Bajas defensor: ${combate.bajasDefensor}</li>
    <li><b>Ganador: ${combate.ganador}</b></li>
  </ul>`;
  document.getElementById('combateResumen').innerHTML = html;
}

// --- PERFIL Y FOTO ---
function mostrarPerfil() {
  if (!perfil) {
    socket.emit('pedirPerfil');
    document.getElementById('perfilNombre').textContent = username;
    document.getElementById('perfilEspecialidad').textContent = 'Cargando...';
    document.getElementById('perfilListaRegiones').innerHTML = '<li>Cargando...</li>';
    document.getElementById('perfilOtrosDatos').innerHTML = '';
    document.getElementById('perfilFoto').src = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    return;
  }
  document.getElementById('perfilNombre').textContent = perfil.username;
  document.getElementById('perfilEspecialidad').textContent = perfil.especialidad || "N/A";
  let ul = document.getElementById('perfilListaRegiones');
  ul.innerHTML = "";
  if (perfil.regiones) {
    for (let rid of perfil.regiones) {
      let li = document.createElement('li');
      li.textContent = `${nombrePais(rid)} - ${perfil.tropas && perfil.tropas[rid] ? perfil.tropas[rid] : 0} infantería`;
      ul.appendChild(li);
    }
  } else {
    ul.innerHTML = "<li>Ninguna</li>";
  }
  let otros = document.getElementById('perfilOtrosDatos');
  otros.innerHTML = `
    <li>Puntos: ${perfil.puntos || 0}</li>
    <li>Regiones conquistadas: ${perfil.regiones ? perfil.regiones.length : 0}</li>
    <li>General: ${perfil.general || perfil.especialidad || "?"}</li>
  `;
  document.getElementById('perfilFoto').src = perfil.fotoURL || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
}

// --- Subida de foto perfil ---
function setupPerfilFoto() {
  const input = document.getElementById('inputPerfilFoto');
  if (!input) return;
  input.onchange = function() {
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById('perfilFoto').src = e.target.result;
      };
      reader.readAsDataURL(input.files[0]);
      const formData = new FormData();
      formData.append('foto', input.files[0]);
      formData.append('username', localStorage.getItem('rr-username'));
      fetch('/api/upload-foto', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.url) {
          document.getElementById('perfilFoto').src = data.url;
          socket.emit('pedirPerfil');
        }
      });
    }
  };
}

// =============== MENÚ CONTEXTUAL MODERNO (click derecho) ===============
function mostrarMenuPaisContextual(paisId, evt) {
  let menu = document.getElementById('menuPais');
  if (menu) menu.remove();
  menu = document.createElement('div');
  menu.id = 'menuPais';
  menu.style.position = 'absolute';
  menu.style.background = '#fff';
  menu.style.border = '1px solid #222';
  menu.style.borderRadius = '7px';
  menu.style.boxShadow = '0 4px 14px #0002';
  menu.style.padding = '1em';
  menu.style.zIndex = 1000;
  menu.style.minWidth = '180px';
  menu.style.left = (evt.clientX + 10) + 'px';
  menu.style.top = (evt.clientY + 10) + 'px';
  menu.innerHTML = `
    <h4 style="margin:0 0 0.7em 0;font-size:1.2em;text-align:center;">
      ${nombrePais(paisId)}
    </h4>
    <button onclick="alert('Ver información de ${nombrePais(paisId)}')">Ver información</button>
    <button onclick="alert('Atacar país: ${nombrePais(paisId)}')">Atacar país</button>
    <button onclick="cerrarMenuPais()">Cerrar</button>
  `;
  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', cerrarMenuPaisClickFuera, { once: true });
  }, 10);
}

function cerrarMenuPais() {
  let menu = document.getElementById('menuPais');
  if (menu) menu.remove();
}
function cerrarMenuPaisClickFuera(e) {
  let menu = document.getElementById('menuPais');
  if (menu && !menu.contains(e.target)) menu.remove();
}
window.cerrarMenuPais = cerrarMenuPais;