// ── UTILIDADES ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatFecha(f) {
  if (!f) return "-";
  var d = new Date(f.replace(" ","T"));
  if (isNaN(d)) return f;
  return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}) + " " +
         d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
}

function nowISO() {
  var d = new Date();
  var p = function(n){ return String(n).padStart(2,"0"); };
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes())+":"+p(d.getSeconds());
}

function toast(msg, type) {
  var c = document.getElementById("toast-container");
  var t = document.createElement("div");
  t.className = "toast " + (type||"info");
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(function(){
    t.style.opacity = "0"; t.style.transform = "translateX(40px)"; t.style.transition = ".3s";
    setTimeout(function(){ t.remove(); }, 300);
  }, 3000);
}

function countUp(id, target) {
  var el = document.getElementById(id);
  if (!el) return;
  var start = 0, duration = 700, startTime = null;
  el.textContent = 0;
  if (target === 0) return;
  function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

// ── DATOS ─────────────────────────────────────────────────────────────────────
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

var reservas = cargarReservas();
var nextId = reservas.length > 0 ? Math.max.apply(null, reservas.map(function(r){ return r.id; })) + 1 : 1;
var editingId = null;
var deletingId = null;
var detailId = null;
var currentPage = 1;
var PAGE_SIZE = 10;

// ── ESTADÍSTICAS ──────────────────────────────────────────────────────────────
function calcStats() {
  var total = reservas.length;
  var totalPersonas = 0, presentes = 0, enEspera = 0;
  for (var i = 0; i < reservas.length; i++) {
    var r = reservas[i];
    var amigosArr = r.amigos ? r.amigos.split(",").map(function(a){ return a.trim(); }).filter(Boolean) : [];
    var personas = amigosArr.length + 1;
    totalPersonas += personas;
    for (var k = 0; k < personas; k++) {
      if (r.estados && r.estados["p"+k] === "presente") presentes++;
      else enEspera++;
    }
  }
  return { total: total, totalPersonas: totalPersonas, presentes: presentes, enEspera: enEspera,
           promedio: total > 0 ? (totalPersonas/total).toFixed(1) : "0" };
}

function updateStats() {
  var s = calcStats();
  document.getElementById("stat-total").textContent = s.total;
  document.getElementById("stat-asistentes").textContent = s.totalPersonas;
  document.getElementById("stat-promedio").textContent = s.promedio;
  countUp("stat-presentes", s.presentes);
  countUp("stat-espera", s.enEspera);
  document.getElementById("badge-total").textContent = s.total + (s.total === 1 ? " reserva" : " reservas");
}

// ── FILTRO Y ORDEN ────────────────────────────────────────────────────────────
function getFiltered() {
  var q = document.getElementById("search-input").value.toLowerCase().trim();
  if (!q) return reservas;
  return reservas.filter(function(r) {
    return r.nombre.toLowerCase().indexOf(q) >= 0 ||
           r.telefono.toLowerCase().indexOf(q) >= 0 ||
           (r.amigos||"").toLowerCase().indexOf(q) >= 0;
  });
}

function getSorted(arr) {
  return arr.slice().sort(function(a, b) {
    return new Date(a.fecha||"") - new Date(b.fecha||"");
  });
}

// ── RENDER TABLA ──────────────────────────────────────────────────────────────
function renderTable() {
  var filtered = getSorted(getFiltered());
  var total = filtered.length;
  var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  var start = (currentPage - 1) * PAGE_SIZE;
  var page = filtered.slice(start, start + PAGE_SIZE);
  var cards = document.getElementById("cards");

  if (page.length === 0) {
    cards.innerHTML = '<div class="empty-state"><span class="empty-icon">&#127925;</span>No se encontraron reservas</div>';
  } else {
    var html = "";
    for (var i = 0; i < page.length; i++) {
      var r = page[i];
      var num = start + i + 1;
      var amigosArr = r.amigos ? r.amigos.split(",").map(function(a){ return a.trim(); }).filter(Boolean) : [];
      var estados = r.estados || {};

      // Botón estado titular
      var t0 = estados["p0"] === "presente";
      var titularBtn = '<button class="btn-estado ' + (t0 ? "btn-success" : "btn-warning") + '" onclick="togglePersona(' + r.id + ',\'p0\')">' + (t0 ? "&#10003;" : "&#9201;") + '</button>';

      // Amigos
      var amigosHtml = "";
      if (amigosArr.length > 0) {
        for (var j = 0; j < amigosArr.length; j++) {
          var pk = "p" + (j+1);
          var pe = estados[pk] === "presente";
          var pBtn = '<button class="btn-estado ' + (pe ? "btn-success" : "btn-warning") + '" onclick="togglePersona(' + r.id + ',\'' + pk + '\')">' + (pe ? "&#10003;" : "&#9201;") + '</button>';
          amigosHtml += '<div class="amigo-row">' + pBtn + ' ' + esc(amigosArr[j]) + '</div>';
        }
      } else {
        amigosHtml = '<span style="color:var(--muted);font-size:.78rem">Sin amigos registrados</span>';
      }

      html += '<div class="reserva-card">';
      html += '<div class="card-top">';
      html += '<div style="width:100%">';
      html += '<div class="card-fecha" style="margin-bottom:5px">&#128197; ' + formatFecha(r.fecha) + '</div>';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">';
      html += '<div class="card-nombre">' + titularBtn + ' Reserva de ' + esc(r.nombre) + '</div>';
      html += '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0">';
      html += '<span style="font-size:.65rem;color:var(--muted);white-space:nowrap">Mesa</span>';
      html += '<input type="text" value="' + esc(r.mesa||'') + '" placeholder="#" ';
      html += 'onchange="updateMesa(' + r.id + ',this.value)" ';
      html += 'style="width:48px;background:rgba(255,255,255,.07);border:1px solid var(--border);border-radius:6px;padding:3px 6px;color:var(--text);font-size:.8rem;text-align:center;outline:none"/>';
      html += '</div></div></div>';
      html += '<span class="card-num" style="flex-shrink:0">#' + num + '</span></div>';
      html += '<div class="card-body">';
      html += '<div class="card-field"><span class="card-field-icon">&#128222;</span>';
      html += '<div><div class="card-field-label">Teléfono</div><div class="card-field-value">' + esc(r.telefono) + '</div></div></div>';
      html += '<div class="card-field"><span class="card-field-icon">&#128101;</span>';
      html += '<div><div class="card-field-label">Amigos (' + amigosArr.length + ')</div>';
      html += '<div class="amigos-list">' + amigosHtml + '</div></div></div>';
      html += '</div>';
      html += '<div class="card-footer">';
      html += '<button class="btn btn-outline btn-sm" onclick="openDetail(' + r.id + ')">&#128065; Ver</button>';
      html += '<button class="btn btn-wa btn-sm" onclick="enviarWhatsApp(' + r.id + ')">&#128172; WhatsApp</button>';
      html += '<button class="btn btn-success btn-sm" onclick="openModal(' + r.id + ')">&#9999;&#65039; Editar</button>';
      html += '<button class="btn btn-danger btn-sm" onclick="openConfirm(' + r.id + ')">&#128465; Eliminar</button>';
      html += '</div></div>';
    }
    cards.innerHTML = html;
  }

  // Paginación
  document.getElementById("page-info").textContent = total === 0 ? "Sin resultados" :
    "Mostrando " + (start+1) + "-" + Math.min(start+PAGE_SIZE, total) + " de " + total;
  var pageBtns = document.getElementById("page-btns");
  pageBtns.innerHTML = "";
  function addBtn(label, pg, disabled, active) {
    var b = document.createElement("button");
    b.className = "page-btn" + (active ? " active" : "");
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = (function(p){ return function(){ currentPage = p; renderTable(); }; })(pg);
    pageBtns.appendChild(b);
  }
  addBtn("<", currentPage-1, currentPage===1, false);
  for (var p = 1; p <= totalPages; p++) addBtn(p, p, false, p===currentPage);
  addBtn(">", currentPage+1, currentPage===totalPages, false);

  updateStats();
  renderCharts();
}

// ── MODAL NUEVA/EDITAR ────────────────────────────────────────────────────────
function openModal(id) {
  editingId = id || null;
  document.getElementById("modal-icon").textContent = id ? "\u270f\ufe0f" : "\ud83c\udfa4";
  document.getElementById("modal-title").textContent = id ? "Editar Reserva" : "Nueva Reserva";
  if (id) {
    var r = reservas.find(function(x){ return x.id === id; });
    if (!r) return;
    document.getElementById("f-nombre").value = r.nombre;
    document.getElementById("f-telefono").value = r.telefono;
    document.getElementById("f-amigos").value = r.amigos || "";
  } else {
    document.getElementById("f-nombre").value = "";
    document.getElementById("f-telefono").value = "";
    document.getElementById("f-amigos").value = "";
  }
  document.getElementById("modal-form").classList.add("open");
  setTimeout(function(){ document.getElementById("f-nombre").focus(); }, 100);
}

function closeModal() {
  document.getElementById("modal-form").classList.remove("open");
  editingId = null;
}

function saveReserva() {
  var nombre = document.getElementById("f-nombre").value.trim();
  var telefono = document.getElementById("f-telefono").value.trim();
  var amigos = document.getElementById("f-amigos").value.trim();
  if (!nombre) { toast("El nombre es obligatorio", "error"); return; }
  if (!telefono) { toast("El teléfono es obligatorio", "error"); return; }
  if (editingId) {
    var idx = reservas.findIndex(function(r){ return r.id === editingId; });
    if (idx !== -1) { reservas[idx].nombre = nombre; reservas[idx].telefono = telefono; reservas[idx].amigos = amigos; }
    toast("Reserva actualizada", "success");
  } else {
    reservas.push({ id: nextId++, fecha: nowISO(), nombre: nombre, telefono: telefono, amigos: amigos, estados: {}, mesa: '' });
    toast("Nueva reserva agregada", "success");
  }
  closeModal();
  guardarReservas();
  renderTable();
  exportExcel();
}

// ── ACTUALIZAR MESA ──────────────────────────────────────────────────────────
function updateMesa(id, valor) {
  var r = reservas.find(function(x){ return x.id === id; });
  if (r) { r.mesa = valor.trim(); guardarReservas(); }
}

// ── TOGGLE ESTADO PERSONA ─────────────────────────────────────────────────────
function togglePersona(reservaId, personaKey) {
  var r = reservas.find(function(x){ return x.id === reservaId; });
  if (!r) return;
  if (!r.estados) r.estados = {};
  r.estados[personaKey] = r.estados[personaKey] === "presente" ? "espera" : "presente";
  guardarReservas();
  renderTable();
}

// ── MODAL DETALLE ─────────────────────────────────────────────────────────────
function openDetail(id) {
  detailId = id;
  var r = reservas.find(function(x){ return x.id === id; });
  if (!r) return;
  document.getElementById("detail-title").textContent = r.nombre;
  var amigosArr = r.amigos ? r.amigos.split(",").map(function(a){ return a.trim(); }).filter(Boolean) : [];
  var chips = amigosArr.map(function(a){
    return '<div class="amigo-row">&#128100; ' + esc(a) + '</div>';
  }).join("") || '<span style="color:var(--muted)">Sin amigos</span>';
  document.getElementById("detail-body").innerHTML =
    '<div class="form-group"><label>Fecha y Hora</label><div style="padding:9px 12px;background:var(--input-bg);border-radius:10px;border:1px solid var(--border);color:var(--muted)">' + formatFecha(r.fecha) + '</div></div>' +
    '<div class="form-row"><div class="form-group"><label>Nombre</label><div style="padding:9px 12px;background:var(--input-bg);border-radius:10px;border:1px solid var(--border);color:#e879f9;font-weight:700">' + esc(r.nombre) + '</div></div>' +
    '<div class="form-group"><label>Teléfono</label><div style="padding:9px 12px;background:var(--input-bg);border-radius:10px;border:1px solid var(--border);color:#a78bfa;font-family:monospace">' + esc(r.telefono) + '</div></div></div>' +
    '<div class="form-group"><label>Amigos (' + amigosArr.length + ')</label><div class="amigos-list">' + chips + '</div></div>';
  document.getElementById("modal-detail").classList.add("open");
}

function closeDetail() { document.getElementById("modal-detail").classList.remove("open"); detailId = null; }
function editFromDetail() { var id = detailId; closeDetail(); openModal(id); }

// ── MODAL CONFIRMAR ELIMINAR ──────────────────────────────────────────────────
function openConfirm(id) {
  deletingId = id;
  var r = reservas.find(function(x){ return x.id === id; });
  if (r) document.getElementById("confirm-desc").textContent = 'Se eliminará la reserva de "' + r.nombre + '". Esta acción no se puede deshacer.';
  document.getElementById("modal-confirm").classList.add("open");
}

function closeConfirm() { document.getElementById("modal-confirm").classList.remove("open"); deletingId = null; }

function confirmDelete() {
  if (deletingId === null) return;
  var r = reservas.find(function(x){ return x.id === deletingId; });
  reservas = reservas.filter(function(x){ return x.id !== deletingId; });
  closeConfirm();
  guardarReservas();
  renderTable();
  toast('Reserva de "' + (r ? r.nombre : "") + '" eliminada', "info");
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────────
function enviarWhatsApp(id) {
  var r = reservas.find(function(x){ return x.id === id; });
  if (!r) return;
  var tel = r.telefono.replace(/[^0-9]/g, "");
  if (!tel) { toast("No hay número de teléfono registrado", "error"); return; }
  if (tel.length <= 10) tel = "549" + tel;
  var amigosArr = r.amigos ? r.amigos.split(",").map(function(a){ return a.trim(); }).filter(Boolean) : [];
  var nl = "\n";
  var eventoFecha = document.getElementById("evento-fecha").value;
  var eventoHora = document.getElementById("evento-hora").value;
  var eventoStr = "";
  if (eventoFecha) {
    var d = new Date(eventoFecha + "T00:00:00");
    eventoStr = d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
  }
  if (eventoHora) eventoStr += (eventoStr ? " a las " : "") + eventoHora + "hs";
  var partes = [
    "Hola " + r.nombre + "!",
    "Tu reserva en *KaraokeDeRo* esta confirmada!"
  ];
  if (eventoStr) partes.push("", "Fecha del evento: " + eventoStr);
  if (amigosArr.length > 0) partes.push("Grupo: " + amigosArr.join(", "));
  partes.push("", "Te esperamos!");
  var url = "https://wa.me/" + tel + "?text=" + encodeURIComponent(partes.join(nl));
  window.open(url, "_blank");
}

// ── EXPORTAR EXCEL ────────────────────────────────────────────────────────────
function exportExcel() {
  if (typeof XLSX === "undefined") { toast("Librería Excel no disponible", "error"); return; }
  var data = [["Marca temporal","Nombre y Apellido","Nro de Teléfono de Contacto","Amigos"]];
  for (var i = 0; i < reservas.length; i++) {
    data.push([reservas[i].fecha, reservas[i].nombre, reservas[i].telefono, reservas[i].amigos||""]);
  }
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{wch:22},{wch:28},{wch:24},{wch:60}];
  XLSX.utils.book_append_sheet(wb, ws, "Reservas");
  XLSX.writeFile(wb, "KaraokeDeRo_Reservas_" + new Date().toISOString().slice(0,10) + ".xlsx");
  toast("Excel exportado correctamente", "success");
}

// ── IMPORTAR EXCEL ────────────────────────────────────────────────────────────
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
      for (var h = 0; h < headers.length; h++) {
        var hh = String(headers[h]).toLowerCase();
        if (hh.indexOf("temporal")>=0 || hh.indexOf("fecha")>=0) iF=h;
        if (hh.indexOf("nombre")>=0) iN=h;
        if (hh.indexOf("tel")>=0) iT=h;
        if (hh.indexOf("amigo")>=0 || hh.indexOf("venis")>=0) iA=h;
      }
      var nuevas = [];
      for (var i = 1; i < allRows.length; i++) {
        var row = allRows[i];
        var nombre = String(row[iN]||"").trim();
        if (!nombre) continue;
        var fechaRaw = row[iF];
        var fecha = fechaRaw instanceof Date ? fechaRaw.toISOString().replace("T"," ").slice(0,19) : String(fechaRaw||"");
        nuevas.push({id:nextId++, fecha:fecha, nombre:nombre, telefono:String(row[iT]||"").trim(), amigos:String(row[iA]||"").trim(), estados:{}});
      }
      if (nuevas.length === 0) { toast("No se encontraron reservas válidas", "error"); return; }
      reservas = reservas.concat(nuevas);
      currentPage = 1;
      guardarReservas();
      renderTable();
      toast(nuevas.length + " reservas importadas correctamente", "success");
    } catch(err) {
      toast("Error al importar: " + err.message, "error");
    }
    event.target.value = "";
  };
  reader.readAsBinaryString(file);
}

// ── GRÁFICOS ──────────────────────────────────────────────────────────────────
var chartDona = null, chartDias = null, chartHoras = null;

function renderCharts() {
  if (typeof Chart === "undefined") return;
  var s = calcStats();
  var presentes = s.presentes, enEspera = s.enEspera;
  var total = presentes + enEspera;
  var pct = total > 0 ? Math.round(presentes/total*100) : 0;

  var diasMap = {}, horasMap = {};
  for (var i = 0; i < reservas.length; i++) {
    var f = reservas[i].fecha || "";
    var dia = f.slice(0,10) || "Sin fecha";
    diasMap[dia] = (diasMap[dia]||0) + 1;
    var hora = f.length >= 13 ? f.slice(11,13) + ":00" : "Sin hora";
    horasMap[hora] = (horasMap[hora]||0) + 1;
  }
  var diasKeys = Object.keys(diasMap).sort();
  var diasLabels = diasKeys.map(function(k){
    if (k === "Sin fecha") return k;
    var d = new Date(k + "T00:00:00");
    return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"});
  });
  var diasVals = diasKeys.map(function(k){ return diasMap[k]; });
  var horasKeys = Object.keys(horasMap).sort();
  var horasVals = horasKeys.map(function(k){ return horasMap[k]; });

  var scaleOpts = {
    x: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(255,255,255,0.05)" } },
    y: { ticks: { color: "#9ca3af", stepSize: 1 }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true }
  };

  // Dona
  var ctxDona = document.getElementById("chart-dona");
  if (ctxDona) {
    if (chartDona) {
      chartDona.data.datasets[0].data = [presentes||0.001, enEspera||0.001];
      chartDona.update("none");
    } else {
      chartDona = new Chart(ctxDona, {
        type: "doughnut",
        data: {
          labels: ["Presentes","En Espera"],
          datasets: [{ data: [presentes||0.001, enEspera||0.001], backgroundColor: ["rgba(34,197,94,.8)","rgba(245,158,11,.8)"], borderColor: ["#22c55e","#f59e0b"], borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: "65%",
          plugins: { legend: { position: "bottom", labels: { color: "#9ca3af", padding: 14, font: { size: 11 } } } }
        },
        plugins: [{
          id: "centerText",
          afterDraw: function(chart) {
            var ctx2 = chart.ctx;
            var cx = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left)/2;
            var cy = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top)/2;
            ctx2.save();
            ctx2.textAlign = "center"; ctx2.textBaseline = "middle";
            ctx2.fillStyle = "#e879f9"; ctx2.font = "bold 26px Segoe UI";
            ctx2.fillText(pct + "%", cx, cy - 7);
            ctx2.fillStyle = "#9ca3af"; ctx2.font = "11px Segoe UI";
            ctx2.fillText("presentes", cx, cy + 12);
            ctx2.restore();
          }
        }]
      });
    }
  }

  // Barras días
  var ctxDias = document.getElementById("chart-dias");
  if (ctxDias) {
    if (chartDias) {
      chartDias.data.labels = diasLabels;
      chartDias.data.datasets[0].data = diasVals;
      chartDias.update("none");
    } else {
      chartDias = new Chart(ctxDias, {
        type: "bar",
        data: { labels: diasLabels, datasets: [{ label: "Reservas", data: diasVals, backgroundColor: "rgba(192,38,211,.7)", borderColor: "#c026d3", borderWidth: 2, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: scaleOpts }
      });
    }
  }

  // Barras horas
  var ctxHoras = document.getElementById("chart-horas");
  if (ctxHoras) {
    if (chartHoras) {
      chartHoras.data.labels = horasKeys;
      chartHoras.data.datasets[0].data = horasVals;
      chartHoras.update("none");
    } else {
      chartHoras = new Chart(ctxHoras, {
        type: "bar",
        data: { labels: horasKeys, datasets: [{ label: "Reservas", data: horasVals, backgroundColor: "rgba(34,197,94,.7)", borderColor: "#22c55e", borderWidth: 2, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: scaleOpts }
      });
    }
  }
}

// ── EXPORTAR PDF ──────────────────────────────────────────────────────────────
function exportPDF() {
  if (typeof window.jspdf === "undefined") { toast("Librería PDF no disponible", "error"); return; }
  toast("Generando PDF...", "info");
  var doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var pageW = 210, margin = 14, y = 0;

  // Encabezado
  doc.setFillColor(13,13,26);
  doc.rect(0,0,pageW,28,"F");
  doc.setTextColor(232,121,249); doc.setFontSize(20); doc.setFont("helvetica","bold");
  doc.text("KaraokeDeRo", margin, 12);
  doc.setTextColor(156,163,175); doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text("Reporte de Reservas", margin, 19);
  var fechaHoy = new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
  doc.text("Generado: " + fechaHoy, pageW-margin, 19, {align:"right"});
  y = 36;

  // Resumen
  var s = calcStats();
  doc.setTextColor(232,121,249); doc.setFontSize(11); doc.setFont("helvetica","bold");
  doc.text("Resumen General", margin, y); y += 6;
  var pct = s.totalPersonas > 0 ? Math.round(s.presentes/s.totalPersonas*100) : 0;
  var stats = [
    ["Total Reservas", s.total],
    ["Total Asistentes", s.totalPersonas],
    ["Prom. por Grupo", s.promedio],
    ["Presentes", s.presentes + " (" + pct + "%)"],
    ["En Espera", s.enEspera + " (" + (100-pct) + "%)"]
  ];
  var colW = (pageW - margin*2) / stats.length;
  stats.forEach(function(st, idx) {
    var x = margin + idx * colW;
    doc.setFillColor(22,22,42); doc.roundedRect(x, y, colW-2, 16, 2, 2, "F");
    doc.setTextColor(232,121,249); doc.setFont("helvetica","bold"); doc.setFontSize(11);
    doc.text(String(st[1]), x+(colW-2)/2, y+7, {align:"center"});
    doc.setTextColor(156,163,175); doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.text(st[0], x+(colW-2)/2, y+13, {align:"center"});
  });
  y += 24;

  // Gráficos
  doc.setTextColor(232,121,249); doc.setFontSize(11); doc.setFont("helvetica","bold");
  doc.text("Estadisticas y Graficos", margin, y); y += 4;
  var chartIds = ["chart-dona","chart-dias","chart-horas"];
  var chartTitles = ["Presentes vs En Espera","Reservas por Dia","Reservas por Hora"];
  var chartW = (pageW - margin*2 - 8) / 3;

  function captureChart(idx) {
    if (idx >= chartIds.length) { finalizarPDF(); return; }
    var canvas = document.getElementById(chartIds[idx]);
    if (!canvas) { captureChart(idx+1); return; }
    html2canvas(canvas, {backgroundColor:"#16162a", scale:2}).then(function(c) {
      var imgData = c.toDataURL("image/png");
      var x = margin + idx * (chartW+4);
      doc.setFillColor(22,22,42); doc.roundedRect(x, y, chartW, chartW*0.75+8, 2, 2, "F");
      doc.setTextColor(156,163,175); doc.setFontSize(7);
      doc.text(chartTitles[idx], x+chartW/2, y+5, {align:"center"});
      doc.addImage(imgData, "PNG", x+1, y+7, chartW-2, chartW*0.75-2);
      captureChart(idx+1);
    });
  }

  function finalizarPDF() {
    y += chartW*0.75 + 14;
    doc.setTextColor(232,121,249); doc.setFontSize(11); doc.setFont("helvetica","bold");
    doc.text("Detalle de Reservas", margin, y); y += 6;
    var cols = ["#","Nombre","Teléfono","Fecha","Amigos","Estado"];
    var colWidths = [8,40,28,30,52,20];
    doc.setFillColor(26,0,48); doc.rect(margin, y, pageW-margin*2, 7, "F");
    doc.setTextColor(232,121,249); doc.setFontSize(8); doc.setFont("helvetica","bold");
    var cx = margin;
    cols.forEach(function(col, i){ doc.text(col, cx+2, y+5); cx += colWidths[i]; });
    y += 7;
    reservas.forEach(function(r, idx) {
      if (y > 270) { doc.addPage(); y = 14; }
      var amigosArr = r.amigos ? r.amigos.split(",").map(function(a){ return a.trim(); }).filter(Boolean) : [];
      var totalP = amigosArr.length + 1, pres = 0;
      for (var k=0; k<totalP; k++) { if (r.estados && r.estados["p"+k]==="presente") pres++; }
      doc.setFillColor(idx%2===0?22:28, idx%2===0?22:28, idx%2===0?42:52);
      doc.rect(margin, y, pageW-margin*2, 6, "F");
      doc.setTextColor(241,240,255); doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
      var vals = [String(idx+1), r.nombre.slice(0,22), r.telefono.slice(0,16), (r.fecha||"").slice(0,16), (r.amigos||"Sin amigos").slice(0,28), pres+"/"+totalP+" pres."];
      cx = margin;
      vals.forEach(function(v, i){ doc.text(v, cx+2, y+4.5); cx += colWidths[i]; });
      y += 6;
    });
    doc.setTextColor(156,163,175); doc.setFontSize(7);
    doc.text("KaraokeDeRo - Reporte generado el " + fechaHoy, pageW/2, 290, {align:"center"});
    doc.save("KaraokeDeRo_Reporte_" + new Date().toISOString().slice(0,10) + ".pdf");
    toast("PDF generado correctamente", "success");
  }

  captureChart(0);
}

// ── EVENTOS ───────────────────────────────────────────────────────────────────
document.getElementById("btn-import").addEventListener("click", function(){ document.getElementById("imp").click(); });
document.getElementById("imp").addEventListener("change", function(e){ importExcel(e); });
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") { closeModal(); closeConfirm(); closeDetail(); }
});

// ── EVENTO FECHA/HORA ────────────────────────────────────────────────────────
function cargarEvento() {
  try {
    var ev = localStorage.getItem("karaoke_evento");
    if (ev) {
      var obj = JSON.parse(ev);
      if (obj.fecha) document.getElementById("evento-fecha").value = obj.fecha;
      if (obj.hora) document.getElementById("evento-hora").value = obj.hora;
    }
  } catch(e) {}
}

function guardarEvento() {
  var fecha = document.getElementById("evento-fecha").value;
  var hora = document.getElementById("evento-hora").value;
  try { localStorage.setItem("karaoke_evento", JSON.stringify({fecha:fecha, hora:hora})); } catch(e) {}
}

document.getElementById("evento-fecha").addEventListener("change", guardarEvento);
document.getElementById("evento-hora").addEventListener("change", guardarEvento);

// ── INIT ──────────────────────────────────────────────────────────────────────
cargarEvento();
renderTable();
