// ──────────────────────────────────────────────
//  Estado global
// ──────────────────────────────────────────────
let records = [];
let stream = null;
let scanning = false;
let pendingData = null;
let lastQR = '';
let lastQRTime = 0;
let toastTimer;

// ──────────────────────────────────────────────
//  QR Parsing — detección flexible de campos
// ──────────────────────────────────────────────
function parseQR(raw) {
  const data = { nombres: '', apPaterno: '', apMaterno: '', codCuenta: '', carnet: '', raw };

  // 1. Intentar JSON
  try {
    const j = JSON.parse(raw);
    const lk = k => k.toLowerCase().replace(/[\s_-]/g, '');
    for (const [k, v] of Object.entries(j)) {
      const kl = lk(k);
      if (/nombre/.test(kl))         data.nombres   = v;
      else if (/paterno/.test(kl))   data.apPaterno = v;
      else if (/materno/.test(kl))   data.apMaterno = v;
      else if (/cuenta|cod/.test(kl))data.codCuenta = v;
      else if (/carnet|ci|identidad|dni/.test(kl)) data.carnet = v;
    }
    return data;
  } catch (_) {}

  // 2. Intentar pares clave=valor separados por |, \n, ;, ,
  const pairs = raw.split(/[|\n;,]+/);
  if (pairs.length > 1) {
    for (const p of pairs) {
      const m = p.match(/^([^:=]+)[:=](.*)$/);
      if (!m) continue;
      const k = m[1].trim().toLowerCase().replace(/[\s_-]/g, '');
      const v = m[2].trim();
      if (/nombre/.test(k))          data.nombres   = v;
      else if (/paterno/.test(k))    data.apPaterno = v;
      else if (/materno/.test(k))    data.apMaterno = v;
      else if (/cuenta|cod/.test(k)) data.codCuenta = v;
      else if (/carnet|ci|identidad|dni/.test(k)) data.carnet = v;
    }
    if (data.nombres || data.apPaterno || data.codCuenta || data.carnet) return data;
  }

  // 3. Texto libre
  data.raw = raw;
  return data;
}

function parsedToDisplay(d) {
  return [
    { key: 'Nombres',    val: d.nombres   || '—' },
    { key: 'Ap. Paterno',val: d.apPaterno || '—' },
    { key: 'Ap. Materno',val: d.apMaterno || '—' },
    { key: 'Cód. Cuenta',val: d.codCuenta || '—' },
    { key: 'Carnet / CI',val: d.carnet    || '—' },
    { key: 'QR Raw',     val: d.raw },
  ];
}

// ──────────────────────────────────────────────
//  Tabla
// ──────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('tbody');
  document.getElementById('count-badge').textContent =
    records.length + ' registro' + (records.length !== 1 ? 's' : '');
  document.getElementById('btn-export').disabled = records.length === 0;

  if (records.length === 0) {
    tbody.innerHTML = `<tr id="empty-row"><td colspan="8">
      <div class="empty-state"><span>📄</span>
      Aún no hay registros. Escanea un QR o sube una imagen para comenzar.</div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = records.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td contenteditable="true" oninput="editField(${i},'nombres',this)">${esc(r.nombres)}</td>
      <td contenteditable="true" oninput="editField(${i},'apPaterno',this)">${esc(r.apPaterno)}</td>
      <td contenteditable="true" oninput="editField(${i},'apMaterno',this)">${esc(r.apMaterno)}</td>
      <td contenteditable="true" oninput="editField(${i},'codCuenta',this)" class="mono">${esc(r.codCuenta)}</td>
      <td contenteditable="true" oninput="editField(${i},'carnet',this)" class="mono">${esc(r.carnet)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                 color:var(--muted);font-size:10px" title="${esc(r.raw)}">${esc(r.raw)}</td>
      <td><button class="del-btn" onclick="deleteRow(${i})">✕</button></td>
    </tr>
  `).join('');
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function editField(i, field, el) {
  records[i][field] = el.textContent.trim();
}

function deleteRow(i) {
  records.splice(i, 1);
  renderTable();
}

function clearTable() {
  if (records.length === 0) return;
  if (confirm('¿Eliminar todos los registros?')) {
    records = [];
    renderTable();
  }
}

// ──────────────────────────────────────────────
//  Agregar registros
// ──────────────────────────────────────────────
function addRecord(raw) {
  const d = parseQR(raw.trim());
  records.push(d);
  renderTable();
  showToast('✓ QR registrado');
  flashScreen();
}

function handleQRResult(raw) {
  const d = parseQR(raw.trim());
  pendingData = d;
  showParsedPreview(d);
}

function showParsedPreview(d) {
  const rows = parsedToDisplay(d);
  document.getElementById('parsed-rows').innerHTML = rows.map(r =>
    `<div class="parsed-row">
       <span class="parsed-key">${r.key}</span>
       <span class="parsed-val">${esc(r.val)}</span>
     </div>`
  ).join('');
  document.getElementById('parsed-preview').classList.add('show');
  setUploadStatus('success', '✓ QR leído — revisa los datos y confirma');
}

function confirmAdd() {
  if (!pendingData) return;
  records.push(pendingData);
  pendingData = null;
  document.getElementById('parsed-preview').classList.remove('show');
  renderTable();
  showToast('✓ Registro agregado');
  flashScreen();
}

function addManual() {
  const inp = document.getElementById('manual-text');
  const v = inp.value.trim();
  if (!v) return;
  handleQRResult(v);
  inp.value = '';
}

document.getElementById('manual-text').addEventListener('keydown', e => {
  if (e.key === 'Enter') addManual();
});

// ──────────────────────────────────────────────
//  Cámara
//  FIX: se usa 'attemptBoth' en lugar de 'dontInvert'
//  para detectar QR en cualquier condición de luz/contraste
// ──────────────────────────────────────────────
document.getElementById('btn-cam').addEventListener('click', startCamera);
document.getElementById('btn-stop').addEventListener('click', stopCamera);

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },   // FIX: mayor resolución mejora detección
        height: { ideal: 720 }
      }
    });
    const video = document.getElementById('video');
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('cam-placeholder').style.display = 'none';
    document.getElementById('scan-overlay').style.display = 'block';
    document.getElementById('btn-cam').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'block';
    setCamStatus('active', 'Escaneando…');
    scanning = true;
    video.addEventListener('loadeddata', () => requestAnimationFrame(scanFrame), { once: true });
  } catch (e) {
    setCamStatus('error', 'Sin acceso a cámara: ' + e.message);
  }
}

function stopCamera() {
  scanning = false;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  const video = document.getElementById('video');
  video.srcObject = null;
  video.style.display = 'none';
  document.getElementById('cam-placeholder').style.display = 'flex';
  document.getElementById('scan-overlay').style.display = 'none';
  document.getElementById('btn-cam').style.display = 'block';
  document.getElementById('btn-stop').style.display = 'none';
  setCamStatus('', 'Cámara inactiva');
}

function scanFrame() {
  if (!scanning) return;
  const video = document.getElementById('video');
  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(scanFrame);
    return;
  }

  const canvas = document.getElementById('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // FIX PRINCIPAL: 'attemptBoth' detecta QR normales e invertidos
  const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });

  if (code) {
    const now = Date.now();
    if (code.data !== lastQR || now - lastQRTime > 3000) {
      lastQR = code.data;
      lastQRTime = now;
      handleQRResult(code.data);
      setCamStatus('success', '✓ QR detectado');
      setTimeout(() => { if (scanning) setCamStatus('active', 'Escaneando…'); }, 2000);
    }
  }
  requestAnimationFrame(scanFrame);
}

// ──────────────────────────────────────────────
//  Subida de imagen
//  FIX: se mantiene 'attemptBoth' para mayor compatibilidad
// ──────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', function () {
  if (!this.files[0]) return;
  const file = this.files[0];
  setUploadStatus('active', 'Procesando imagen…');

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height,
        { inversionAttempts: 'attemptBoth' });
      if (code) {
        handleQRResult(code.data);
      } else {
        setUploadStatus('error', '✗ No se detectó QR en la imagen');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  this.value = '';
});

// Drag & drop
const uploadZone = document.querySelector('.upload-zone');
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.style.borderColor = 'var(--accent)';
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = '';
});
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('file-input').files = dt.files;
    document.getElementById('file-input').dispatchEvent(new Event('change'));
  }
});

// ──────────────────────────────────────────────
//  Exportar a Excel
// ──────────────────────────────────────────────
function exportExcel() {
  if (records.length === 0) return;

  const wb = XLSX.utils.book_new();
  const data = [
    ['N°', 'Nombres', 'Ap. Paterno', 'Ap. Materno', 'Cód. Cuenta', 'Carnet de Identidad']
  ];
  records.forEach((r, i) => {
    data.push([
      i + 1,
      r.nombres   || '',
      r.apPaterno || '',
      r.apMaterno || '',
      r.codCuenta || '',
      r.carnet    || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1A1E2E' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top:    { style: 'thin', color: { rgb: '4FFFB0' } },
      bottom: { style: 'thin', color: { rgb: '4FFFB0' } },
      left:   { style: 'thin', color: { rgb: '4FFFB0' } },
      right:  { style: 'thin', color: { rgb: '4FFFB0' } },
    }
  };
  ['A1','B1','C1','D1','E1','F1'].forEach(cell => {
    if (ws[cell]) ws[cell].s = headerStyle;
  });
  ws['!rows'] = [{ hpt: 36 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Registros QR');

  const d = new Date();
  const fname = `registros_qr_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, fname);
  showToast('⬇ Descargando ' + fname);
}

// ──────────────────────────────────────────────
//  Helpers UI
// ──────────────────────────────────────────────
function setCamStatus(type, msg) {
  document.getElementById('cam-dot').className = 'dot' + (type ? ' ' + type : '');
  document.getElementById('cam-status').textContent = msg;
}

function setUploadStatus(type, msg) {
  document.getElementById('upload-dot').className = 'dot' + (type ? ' ' + type : '');
  document.getElementById('upload-status').textContent = msg;
}

function flashScreen() {
  const f = document.getElementById('flash');
  f.classList.add('show');
  setTimeout(() => f.classList.remove('show'), 120);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// Init
renderTable();
