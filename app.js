function cargarReservas() {
  try {
    var d = localStorage.getItem("karaoke_reservas");
    if (d) return JSON.parse(d);
  } catch(e) {}
  return [];
}
function guardarReservas() {
  try { localStorage.setItem("karaoke_reservas", JSON.stringify(reservas)); } catch(e) {}
}
function toast(msg, type) {
  var c = document.getElementById("toast-container");
  var t = document.createElement("div");
  t.className = "toast " + (type || "info");
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(function(){ t.style.opacity="0"; t.style.transform="translateX(40px)"; t.style.transition=".3s"; setTimeout(function(){ t.remove(); }, 300); }, 3000);
}
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function formatFecha(f) {
  if (!f) return "-";
  var d = new Date(f.replace(" ","T"));
  if (isNaN(d)) return f;
  return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}) + " " + d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
}
function nowISO() {
  var d = new Date();
  var pad = function(n){ return String(n).padStart(2,"0"); };
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+" "+pad(d.getHours())+":"+pad(d.getMinutes())+":"+pad(d.getSeconds());
}

var reservas = cargarReservas();
var nextId = reservas.length > 0 ? Math.max.apply(null, reservas.map(function(r){ return r.id; })) + 1 : 1;
var editingId = null;
var deletingId = null;
var detailId = null;
var currentPage = 1;
var PAGE_SIZE = 10;

function countUp(id, target, duration) {
  var el = document.getElementById(id);
  if (!el) return;
  var start = 0;
  var range = target - start;
  var startTime = null;
  duration = duration || 800;
  el.textContent = 0;
  if (target === 0) return;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + range * ease);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

function updateStats() {
  var total = reservas.length;
  var hoy = new Date().toISOString().slice(0,10);
  var hoyCount = 0, totalAmigos = 0;
  for (var i=0; i<reservas.length; i++) {
    if (reservas[i].fecha && reservas[i].fecha.startsWith(hoy)) hoyCount++;
    if (reservas[i].amigos && reservas[i].amigos.trim()) {
      totalAmigos += reservas[i].amigos.split(",").map(function(a){return a.trim();}).filter(Boolean).length;
    }
  }
  var promedio = total > 0 ? ((totalAmigos + total)/total).toFixed(1) : 0;
  var presentes = 0, enEspera = 0;
  for (var j=0; j<reservas.length; j++) {
    var r = reservas[j];
    var personas = [r.nombre];
    if (r.amigos && r.amigos.trim()) {
      r.amigos.split(",").map(function(a){return a.trim();}).filter(Boolean).forEach(function(a){ personas.push(a); });
    }
    for (var k=0; k<personas.length; k++) {
      var key = "p" + k;
      if (r.estados && r.estados[key] === "presente") presentes++;
      else enEspera++;
    }
  }
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-amigos").textContent = totalAmigos + total;
  document.getElementById("stat-promedio").textContent = promedio;
  countUp("stat-presentes", presentes);
  countUp("stat-espera", enEspera);
  document.getElementById("badge-total").textContent = total + (total===1?" reserva":" reservas");
}

function getFiltered() {
  var q = document.getElementById("search-input").value.toLowerCase().trim();
  if (!q) return reservas;
  return reservas.filter(function(r) {
    return r.nombre.toLowerCase().indexOf(q)>=0 || r.telefono.toLowerCase().indexOf(q)>=0 || (r.amigos||"").toLowerCase().indexOf(q)>=0;
  });
}

function renderTable() {
  var filtered = getFiltered().slice().sort(function(a,b){
    var va = new Date(a.fecha||""), vb = new Date(b.fecha||"");
    return va - vb;
  });
  var total = filtered.length;
  var totalPages = Math.max(1, Math.ceil(total/PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  var start = (currentPage-1)*PAGE_SIZE;
  var page = filtered.slice(start, start+PAGE_SIZE);
  var cards = document.getElementById("cards");

  if (page.length === 0) {
    cards.innerHTML = '<div class="empty-state"><span class="empty-icon">&#127925;</span>No se encontraron reservas</div>';
  } else {
    var html = "";
    for (var i=0; i<page.length; i++) {
      var r = page[i];
      var num = start + i + 1;
      var amigosArr = r.amigos ? r.amigos.split(",").map(function(a){return a.trim();}).filter(Boolean) : [];
      var estados = r.estados || {};
      // Titular
      var titularKey = "p0";
      var titularEstado = estados[titularKey] === "presente";
      var titularBtn = '<button class="btn ' + (titularEstado ? "btn-success" : "btn-warning") + ' btn-sm-estado" onclick="togglePersona(' + r.id + ',\'p0\')">' + (titularEstado ? "&#10003;" : "&#9201;") + '</button>';

      // Amigos
      var amigosHtml = "";
      if (amigosArr.length > 0) {
        for (var j=0; j<amigosArr.length; j++) {
          var pKey = "p" + (j+1);
          var pEstado = estados[pKey] === "presente";
          var pBtn = '<button class="btn ' + (pEstado ? "btn-success" : "btn-warning") + ' btn-sm-estado" onclick="togglePersona(' + r.id + ',\'' + pKey + '\')">' + (pEstado ? "&#10003;" : "&#9201;") + '</button>';
          amigosHtml += '<div class="amigo-row">' + pBtn + ' ' + escHtml(amigosArr[j]) + '</div>';
        }
      } else {
        amigosHtml = '<span style="color:var(--muted);font-size:.8rem">Sin amigos registrados</span>';
      }
      html += '<div class="reserva-card">';
      html += '<div class="card-top">';
      html += '<div><div class="card-nombre">' + titularBtn + ' Reserva de ' + escHtml(r.nombre) + '</div>';
      html += '<div class="card-fecha">&#128197; ' + formatFecha(r.fecha) + '</div></div>';
      html += '<span class="card-num">#' + num + '</span></div>';
      html += '<div class="card-body">';
      html += '<div class="card-field"><span class="card-field-icon">&#128222;</span>';
      html += '<div><div class="card-field-label">Telefono</div>';
      html += '<div class="card-field-value">' + escHtml(r.telefono) + '</div></div></div>';
      html += '<div class="card-field"><span class="card-field-icon">&#128101;</span>';
      html += '<div><div class="card-field-label">Amigos (' + amigosArr.length + ')</div>';
      html += '<div class="amigos-list">' + amigosHtml + '</div></div></div>';
      html += '</div>';
      html += '<div class="card-footer">';
      html += '<button class="btn btn-outline btn-sm" onclick="openDetail(' + r.id + ')">&#128065; Ver</button>';
      html += '<button class="btn btn-success btn-sm" onclick="openModal(' + r.id + ')">&#9999;&#65039; Editar</button>';
      html += '<button class="btn btn-danger btn-sm" onclick="openConfirm(' + r.id + ')">&#128465; Eliminar</button>';
      html += '</div></div>';
    }
    cards.innerHTML = html;
  }

  document.getElementById("page-info").textContent = total===0 ? "Sin resultados" : "Mostrando "+(start+1)+"-"+Math.min(start+PAGE_SIZE,total)+" de "+total;
  var pageBtns = document.getElementById("page-btns");
  pageBtns.innerHTML = "";
  function addBtn(label, pg, disabled, active) {
    var b = document.createElement("button");
    b.className = "page-btn" + (active?" active":"");
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = (function(p){ return function(){ currentPage=p; renderTable(); }; })(pg);
    pageBtns.appendChild(b);
  }
  addBtn("<", currentPage-1, currentPage===1, false);
  for (var p=1; p<=totalPages; p++) addBtn(p, p, false, p===currentPage);
  addBtn(">", currentPage+1, currentPage===totalPages, false);
  updateStats();
  renderCharts();
}

function openModal(id) {
  editingId = id || null;
  document.getElementById("modal-icon").textContent = id ? "E" : "M";
  document.getElementById("modal-title").textContent = id ? "Editar Reserva" : "Nueva Reserva";
  if (id) {
    var r = null;
    for (var i=0; i<reservas.length; i++) { if (reservas[i].id===id) { r=reservas[i]; break; } }
    if (!r) return;
    document.getElementById("f-nombre").value = r.nombre;
    document.getElementById("f-telefono").value = r.telefono;
    document.getElementById("f-amigos").value = r.amigos || "";
  } else {
    document.getElementById("f-nombre").value = "";
    document.getElementById("f-telefono").value = "";
    document.getElementById("f-amigos").value = "";
  }
  document.getElementById("modal-overlay").classList.add("open");
  setTimeout(function(){ document.getElementById("f-nombre").focus(); }, 100);
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  editingId = null;
}

function saveReserva() {
  var nombre = document.getElementById("f-nombre").value.trim();
  var telefono = document.getElementById("f-telefono").value.trim();
  var amigos = document.getElementById("f-amigos").value.trim();
  if (!nombre) { toast("El nombre es obligatorio", "error"); return; }
  if (!telefono) { toast("El telefono es obligatorio", "error"); return; }
  var fecha = nowISO();
  if (editingId) {
    for (var i=0; i<reservas.length; i++) {
      if (reservas[i].id===editingId) {
        reservas[i].nombre = nombre;
        reservas[i].telefono = telefono;
        reservas[i].amigos = amigos;
        break;
      }
    }
    toast("Reserva actualizada", "success");
  } else {
    reservas.push({id:nextId++, fecha:fecha, nombre:nombre, telefono:telefono, amigos:amigos, estado:"espera"});
    toast("Nueva reserva agregada", "success");
  }
  closeModal();
  guardarReservas();
  renderTable();
  exportExcel();
}

function openDetail(id) {
  detailId = id;
  var r = null;
  for (var i=0; i<reservas.length; i++) { if (reservas[i].id===id) { r=reservas[i]; break; } }
  if (!r) return;
  document.getElementById("detail-title").textContent = r.nombre;
  var amigosArr = r.amigos ? r.amigos.split(",").map(function(a){return a.trim();}).filter(Boolean) : [];
  var chips = "";
  for (var j=0; j<amigosArr.length; j++) {
    chips += '<div class="amigo-row">&#128100; ' + escHtml(amigosArr[j]) + '</div>';
  }
  if (!chips) chips = '<span style="color:var(--muted)">Sin amigos</span>';
  document.getElementById("detail-body").innerHTML =
    '<div class="form-group"><label>Fecha y Hora</label><div style="padding:10px 14px;background:var(--input-bg);border-radius:10px;border:1px solid var(--border);color:var(--muted)">' + formatFecha(r.fecha) + '</div></div>' +
    '<div class="form-row"><div class="form-group"><label>Nombre</label><div style="padding:10px 14px;background:var(--input-bg);border-radius:10px;border:1px solid var(--border);color:#e879f9;font-weight:700">' + escHtml(r.nombre) + '</div></div>' +
    '<div class="form-group"><label>Telefono</label><div style="padding:10px 14px;background:var(--input-bg);border-radius:10px;border:1px solid var(--border);color:#a78bfa;font-family:monospace">' + escHtml(r.telefono) + '</div></div></div>' +
    '<div class="form-group"><label>Amigos (' + amigosArr.length + ')</label><div class="amigos-list">' + chips + '</div></div>';
  document.getElementById("detail-overlay").classList.add("open");
}

function closeDetail() { document.getElementById("detail-overlay").classList.remove("open"); detailId = null; }
function editFromDetail() { var id = detailId; closeDetail(); openModal(id); }

function openConfirm(id) {
  deletingId = id;
  var r = null;
  for (var i=0; i<reservas.length; i++) { if (reservas[i].id===id) { r=reservas[i]; break; } }
  if (r) document.getElementById("confirm-desc").textContent = 'Se eliminara la reserva de "' + r.nombre + '". Esta accion no se puede deshacer.';
  document.getElementById("confirm-overlay").classList.add("open");
}
function closeConfirm() { document.getElementById("confirm-overlay").classList.remove("open"); deletingId = null; }
function confirmDelete() {
  if (deletingId === null) return;
  var nombre = "";
  var nuevas = [];
  for (var i=0; i<reservas.length; i++) {
    if (reservas[i].id === deletingId) { nombre = reservas[i].nombre; }
    else { nuevas.push(reservas[i]); }
  }
  reservas = nuevas;
  closeConfirm();
  guardarReservas();
  renderTable();
  toast('Reserva de "' + nombre + '" eliminada', "info");
}

function togglePersona(reservaId, personaKey) {
  for (var i=0; i<reservas.length; i++) {
    if (reservas[i].id === reservaId) {
      if (!reservas[i].estados) reservas[i].estados = {};
      reservas[i].estados[personaKey] = reservas[i].estados[personaKey] === "presente" ? "espera" : "presente";
      break;
    }
  }
  guardarReservas();
  renderTable();
}

function exportExcel() {
  if (typeof XLSX === "undefined") { toast("Libreria Excel no disponible", "error"); return; }
  var data = [["Marca temporal","Nombre y Apellido","Nro de Telefono de Contacto","Amigos"]];
  for (var i=0; i<reservas.length; i++) {
    data.push([reservas[i].fecha, reservas[i].nombre, reservas[i].telefono, reservas[i].amigos]);
  }
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{wch:22},{wch:28},{wch:24},{wch:60}];
  XLSX.utils.book_append_sheet(wb, ws, "Reservas");
  XLSX.writeFile(wb, "KaraokeDeRo_Reservas_" + new Date().toISOString().slice(0,10) + ".xlsx");
  toast("Excel exportado", "success");
}

function importExcel(event) {
  var file = event.target.files[0];
  if (!file) return;
  toast("Leyendo archivo...", "info");
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, {type:"binary", cellDates:true});
      var ws = wb.Sheets[wb.SheetNames[0]];
      var allRows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
      if (!allRows || allRows.length < 2) { toast("El archivo no tiene datos", "error"); return; }
      var headers = allRows[0];
      var iF=0, iN=1, iT=2, iA=3;
      for (var h=0; h<headers.length; h++) {
        var hh = String(headers[h]).toLowerCase();
        if (hh.indexOf("temporal")>=0 || hh.indexOf("fecha")>=0) iF=h;
        if (hh.indexOf("nombre")>=0) iN=h;
        if (hh.indexOf("tel")>=0) iT=h;
        if (hh.indexOf("amigo")>=0 || hh.indexOf("venis")>=0) iA=h;
      }
      var nuevas = [];
      for (var i=1; i<allRows.length; i++) {
        var row = allRows[i];
        if (!row || row.length===0) continue;
        var nombre = String(row[iN]||"").trim();
        if (!nombre) continue;
        var fechaRaw = row[iF];
        var fecha = fechaRaw instanceof Date ? fechaRaw.toISOString().replace("T"," ").slice(0,19) : String(fechaRaw||"");
        nuevas.push({id:nextId++, fecha:fecha, nombre:nombre, telefono:String(row[iT]||"").trim(), amigos:String(row[iA]||"").trim(), estado:"espera"});
      }
      if (nuevas.length===0) { toast("No se encontraron reservas validas", "error"); return; }
      reservas = reservas.concat(nuevas);
      currentPage = 1;
      guardarReservas();
      renderTable();
      toast(nuevas.length + " reservas importadas", "success");
    } catch(err) {
      toast("Error: " + err.message, "error");
    }
    event.target.value = "";
  };
  reader.readAsBinaryString(file);
}

document.getElementById("imp").addEventListener("change", function(e){ importExcel(e); });
document.addEventListener("keydown", function(e) {
  if (e.key==="Escape") { closeModal(); closeConfirm(); closeDetail(); }
});

renderTable();

// ── GRÁFICOS ──────────────────────────────────────────────────────────────────
var chartDona = null;
var chartDias = null;
var chartHoras = null;

function renderCharts() {
  if (typeof Chart === "undefined") return;

  // Calcular datos
  var presentes = 0, enEspera = 0;
  for (var i=0; i<reservas.length; i++) {
    var r = reservas[i];
    var personas = [r.nombre];
    if (r.amigos && r.amigos.trim()) {
      r.amigos.split(",").map(function(a){return a.trim();}).filter(Boolean).forEach(function(a){ personas.push(a); });
    }
    for (var k=0; k<personas.length; k++) {
      if (r.estados && r.estados["p"+k] === "presente") presentes++;
      else enEspera++;
    }
  }

  var diasMap = {};
  for (var i=0; i<reservas.length; i++) {
    var fecha = reservas[i].fecha ? reservas[i].fecha.slice(0,10) : "Sin fecha";
    diasMap[fecha] = (diasMap[fecha] || 0) + 1;
  }
  var diasKeys = Object.keys(diasMap).sort();
  var diasVals = diasKeys.map(function(k){ return diasMap[k]; });
  var diasLabels = diasKeys.map(function(k){
    if (k === "Sin fecha") return k;
    var d = new Date(k + "T00:00:00");
    return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"});
  });

  var horasMap = {};
  for (var i=0; i<reservas.length; i++) {
    var f = reservas[i].fecha || "";
    var hora = f.length >= 13 ? f.slice(11,13) + ":00" : "Sin hora";
    horasMap[hora] = (horasMap[hora] || 0) + 1;
  }
  var horasKeys = Object.keys(horasMap).sort();
  var horasVals = horasKeys.map(function(k){ return horasMap[k]; });

  var total = presentes + enEspera;
  var pct = total > 0 ? Math.round(presentes/total*100) : 0;

  var scaleOpts = {
    x: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(255,255,255,0.05)" } },
    y: { ticks: { color: "#9ca3af", stepSize: 1 }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true }
  };

  // Dona
  var ctxDona = document.getElementById("chart-dona");
  if (ctxDona) {
    if (chartDona) {
      chartDona.data.datasets[0].data = [presentes || 0.001, enEspera || 0.001];
      chartDona.update("none");
    } else {
      chartDona = new Chart(ctxDona, {
        type: "doughnut",
        data: {
          labels: ["Presentes", "En Espera"],
          datasets: [{
            data: [presentes || 0.001, enEspera || 0.001],
            backgroundColor: ["rgba(34,197,94,0.8)", "rgba(245,158,11,0.8)"],
            borderColor: ["#22c55e", "#f59e0b"],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { color: "#9ca3af", padding: 16, font: { size: 12 } } }
          },
          cutout: "65%"
        },
        plugins: [{
          id: "centerText",
          afterDraw: function(chart) {
            var ctx2 = chart.ctx;
            var cx = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
            var cy = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
            ctx2.save();
            ctx2.textAlign = "center";
            ctx2.textBaseline = "middle";
            ctx2.fillStyle = "#e879f9";
            ctx2.font = "bold 28px Segoe UI";
            ctx2.fillText(pct + "%", cx, cy - 8);
            ctx2.fillStyle = "#9ca3af";
            ctx2.font = "12px Segoe UI";
            ctx2.fillText("presentes", cx, cy + 14);
            ctx2.restore();
          }
        }]
      });
    }
  }

  // Barras por día
  var ctxDias = document.getElementById("chart-dias");
  if (ctxDias) {
    if (chartDias) {
      chartDias.data.labels = diasLabels;
      chartDias.data.datasets[0].data = diasVals;
      chartDias.update("none");
    } else {
      chartDias = new Chart(ctxDias, {
        type: "bar",
        data: {
          labels: diasLabels,
          datasets: [{ label: "Reservas", data: diasVals, backgroundColor: "rgba(192,38,211,0.7)", borderColor: "#c026d3", borderWidth: 2, borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: scaleOpts }
      });
    }
  }

  // Barras por hora
  var ctxHoras = document.getElementById("chart-horas");
  if (ctxHoras) {
    if (chartHoras) {
      chartHoras.data.labels = horasKeys;
      chartHoras.data.datasets[0].data = horasVals;
      chartHoras.update("none");
    } else {
      chartHoras = new Chart(ctxHoras, {
        type: "bar",
        data: {
          labels: horasKeys,
          datasets: [{ label: "Reservas", data: horasVals, backgroundColor: "rgba(34,197,94,0.7)", borderColor: "#22c55e", borderWidth: 2, borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: scaleOpts }
      });
    }
  }
}
