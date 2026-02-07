import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cron from 'node-cron';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

const SCHEDULE_FILE = path.join(__dirname, 'schedule.json');

// Helper: format date as YYYY-MM-DD
const formatDate = (d) => d.toISOString().slice(0,10);

// Helper: spanish weekday name
const weekdayName = (d) => {
  const names = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  return names[d.getDay()];
};

// Read schedule from file (if exists)
const readSchedule = () => {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return [];
    const raw = fs.readFileSync(SCHEDULE_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('readSchedule error', err);
    return [];
  }
};

const writeSchedule = (data) => {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// Build message text (<=160 chars) using template
const buildMessage = (nombre, pickupDate) => {
  const d = new Date(pickupDate);
  const dayName = weekdayName(d);
  // dd/mm/yyyy
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const dateText = `${dd}/${mm}/${yyyy}`;
  const msg = `Hospital Domingo Luciani - Proyecto Zoriak. Sr(a). ${nombre}, su resultado ya est\u00E1 disponible. Puede retirarlo el ${dayName} ${dateText}. Traer c\u00E9dula.`;
  // ensure <=160
  return msg.length <= 160 ? msg : msg.slice(0,157) + '...';
};

// Send batch: prefer local Android gateway (ANDROID_GATEWAY_URL), fallback to api.smstext.app
const sendSmsBatch = async (items) => {
  const apiKey = process.env.SMS_TOKEN;
  const localUrl = process.env.ANDROID_GATEWAY_URL;

  // Prepare common payloads
  const localPayload = { pacientes: items.map(i => ({ telefono: i.telefono, nombreCompleto: i.nombre || '', text: i.text })) };
  const remotePayload = items.map(i => ({ mobile: i.telefono, text: i.text }));

  // Try local gateway first if configured
  if (localUrl) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const resp = await fetch(localUrl, { method: 'POST', headers, body: JSON.stringify(localPayload) });
      const text = await resp.text();
      if (resp.ok) return { ok: true, via: 'local', status: resp.status, body: text };
      // if not ok, return that response so caller can inspect
      return { ok: false, via: 'local', status: resp.status, body: text };
    } catch (err) {
      console.warn('local gateway POST failed, will try token-as-query fallback or remote service', err.message || err);
      // try token as query param (some local gateways expect ?token=...)
      try {
        if (!apiKey) throw err;
        const sep = localUrl.includes('?') ? '&' : '?';
        const urlWithToken = `${localUrl}${sep}token=${encodeURIComponent(apiKey)}`;
        const resp2 = await fetch(urlWithToken, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(localPayload) });
        const text2 = await resp2.text();
        if (resp2.ok) return { ok: true, via: 'local-query', status: resp2.status, body: text2 };
        return { ok: false, via: 'local-query', status: resp2.status, body: text2 };
      } catch (err2) {
        console.warn('local gateway fallback failed:', err2.message || err2);
      }
    }
  }

  // Fallback to remote API (api.smstext.app)
  try {
    if (!apiKey) throw new Error('SMS_TOKEN not configured for remote API');
    const url = 'https://api.smstext.app/push';
    const auth = Buffer.from(`apikey:${apiKey}`).toString('base64');
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify(remotePayload),
    });
    const text = await resp.text();
    return { ok: resp.ok, via: 'remote', status: resp.status, body: text };
  } catch (err) {
    console.error('sendSmsBatch remote error', err);
    return { ok: false, via: 'error', status: 0, body: String(err) };
  }
};

// Serve static built app when in production
app.use(express.static(path.join(__dirname, 'dist')));

// health
app.get('/api/health', (req, res) => res.json({ ok: true, now: new Date().toISOString() }));

// POST /api/send-sms
app.post('/api/send-sms', async (req, res) => {
  try {
    const { pacientes } = req.body;
    if (!pacientes || !Array.isArray(pacientes)) return res.status(400).json({ error: 'No hay pacientes' });

    // Prioritize Android gateway if configured
    const gatewayUrl = process.env.ANDROID_GATEWAY_URL;
    const gatewayToken = process.env.SMS_TOKEN;

    if (gatewayUrl) {
      // Send payload to Android SMS gateway
      try {
        const payload = { pacientes };
        const headers = { 'Content-Type': 'application/json' };
        if (gatewayToken) headers['Authorization'] = `Bearer ${gatewayToken}`;

        // dynamic import of fetch if needed
        const _fetch = global.fetch ? global.fetch : (await import('node-fetch')).default;
        const resp = await _fetch(gatewayUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        const text = await resp.text();
        if (!resp.ok) return res.status(502).json({ error: `Gateway error: ${text}` });
        return res.json({ mensaje: 'Enviado vía Android gateway', status: resp.status, body: text });
      } catch (err) {
        console.error('Android gateway send error', err);
        return res.status(502).json({ error: String(err) });
      }
    }

    // Fallback: Twilio (if configured)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
      const Twilio = await import('twilio');
      const client = Twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      // Send at most 100 messages to avoid throttling here (demo)
      const toSend = pacientes.slice(0, 100);
      const results = [];
      for (const p of toSend) {
        if (!p.telefono) continue;
        try {
          const msg = await client.messages.create({ body: `Hola ${p.nombreCompleto || ''}: mensaje de prueba.`, from: process.env.TWILIO_FROM, to: p.telefono });
          results.push({ id: msg.sid, to: p.telefono });
        } catch (err) {
          results.push({ error: String(err), to: p.telefono });
        }
      }
      return res.json({ mensaje: 'Mensajes enviados (Twilio)', results });
    }

    return res.status(500).json({ error: 'No hay método de envío configurado. Define ANDROID_GATEWAY_URL o credenciales Twilio.' });
  } catch (err) {
    console.error('send-sms error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Fallback to index.html for SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET' && req.headers && req.headers.accept && req.headers.accept.indexOf('text/html') !== -1) {
    return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
  return next();
});

const port = process.env.PORT || 3000;
let schedulerEnabled = false;
let scheduledTask = null;

// Generate list of pickup dates between start and end, only Mon/Tue/Wed, excluding specific dates
const generatePickupDates = (startDateStr, endDateStr, excludeDates = []) => {
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  const dates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0 Sun .. 6 Sat
    if (day >= 1 && day <= 3) { // Mon(1), Tue(2), Wed(3)
      const f = formatDate(new Date(d));
      if (!excludeDates.includes(f)) dates.push(f);
    }
  }
  return dates;
};

// POST /api/generate-schedule
// body: { pacientes: [{id?, nombreCompleto, telefono}], startDate?, endDate?, excludeDates? }
app.post('/api/generate-schedule', (req, res) => {
  try {
    const { pacientes, startDate = '2026-02-09', endDate = '2026-04-01', excludeDates = ['2026-02-17','2026-02-18'] } = req.body;
    if (!Array.isArray(pacientes) || pacientes.length === 0) return res.status(400).json({ error: 'Pacientes requeridos' });

    const pickupDates = generatePickupDates(startDate, endDate, excludeDates);
    const capacity = pickupDates.length * 90;
    if (pacientes.length > capacity) {
      return res.status(400).json({ error: `Demasiados pacientes (${pacientes.length}) para las fechas seleccionadas (capacidad ${capacity}). Reduce pacientes o amplía el rango.` });
    }

    const schedule = [];
    let dayIndex = 0;
    let slot = 0;
    for (let i = 0; i < pacientes.length; i++) {
      const date = pickupDates[dayIndex];
      const p = pacientes[i];
      const text = buildMessage(p.nombreCompleto || '', date);
      schedule.push({ id: p.id || i, nombreCompleto: p.nombreCompleto || '', telefono: p.telefono || '', scheduledDate: date, sendDate: formatDate(new Date(new Date(date + 'T00:00:00').getTime() - 24*60*60*1000)), text });
      slot++;
      if (slot >= 90) { slot = 0; dayIndex++; }
    }

    writeSchedule(schedule);
    return res.json({ mensaje: 'Schedule generado', days: pickupDates.length, capacity, assigned: schedule.length });
  } catch (err) {
    console.error('generate-schedule error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/today-batch -> returns items to send today (i.e., whose sendDate == today)
app.get('/api/today-batch', (req, res) => {
  try {
    const schedule = readSchedule();
    const today = formatDate(new Date());
    const batch = schedule.filter(s => s.sendDate === today);
    return res.json({ date: today, count: batch.length, batch });
  } catch (err) {
    console.error('today-batch error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/broadcast -> send a non-personalized broadcast to a list of phones
// body: { phones: ["+5841..."], message?: string, dryRun?: boolean }
app.post('/api/broadcast', async (req, res) => {
  try {
    const { phones, message, dryRun = true } = req.body || {};
    if (!phones || !Array.isArray(phones) || phones.length === 0) return res.status(400).json({ error: 'phones array required' });
    const max = 90;
    const list = phones.slice(0, max);
    const defaultMsg = message || 'Hospital Domingo Luciani - Proyecto Zoriak. Su resultado ya está disponible. Por favor, pase a retirarlo el Lunes. Traer cédula.';
    const items = list.map(p => ({ telefono: p, text: defaultMsg }));
    if (dryRun) return res.json({ mensaje: 'Dry run - broadcast no enviado', count: items.length, items });

    const result = await sendSmsBatch(items);
    // log
    const logFile = path.join(__dirname, 'send-log.json');
    let logs = [];
    try { if (fs.existsSync(logFile)) logs = JSON.parse(fs.readFileSync(logFile,'utf8')||'[]'); } catch(e){}
    logs.push({ date: formatDate(new Date()), type: 'broadcast', result, count: items.length });
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    return res.json({ mensaje: 'Broadcast ejecutado', result, count: items.length });
  } catch (err) {
    console.error('broadcast error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/export-broadcast?date=YYYY-MM-DD&limit=90
// Returns plain text with the broadcast message and a list of phone numbers (one per line)
app.get('/api/export-broadcast', (req, res) => {
  try {
    const date = req.query.date || formatDate(new Date());
    const limit = parseInt(req.query.limit || '90', 10);
    const schedule = readSchedule();
    const targets = schedule.filter(s => s.scheduledDate === date).map(s => s.telefono).filter(Boolean).slice(0, limit);
    if (!targets || targets.length === 0) return res.status(404).type('text/plain').send('No targets for date: ' + date);
    const defaultMsg = 'Hospital Domingo Luciani - Proyecto Zoriak. Su resultado ya está disponible. Por favor, pase a retirarlo el Lunes. Traer cédula.';
    const lines = [];
    lines.push('MESSAGE:');
    lines.push(defaultMsg);
    lines.push('');
    lines.push('NUMBERS:');
    targets.forEach(t => lines.push(t));
    const out = lines.join('\n');
    res.type('text/plain').send(out);
  } catch (err) {
    console.error('export-broadcast error', err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /broadcast-link -> HTML page with button to open SMS app prefilled with up to 90 numbers
app.get('/broadcast-link', (req, res) => {
  try {
    const date = req.query.date || formatDate(new Date(Date.now() + 24*60*60*1000)); // default: tomorrow's scheduledDate
    const limit = parseInt(req.query.limit || '90', 10);
    const schedule = readSchedule();
    const targets = schedule.filter(s => s.scheduledDate === date).map(s => s.telefono).filter(Boolean).slice(0, limit);
    const defaultMsg = 'Hospital Domingo Luciani - Proyecto Zoriak. Su resultado ya est\u00E1 disponible. Por favor, pase a retirarlo el Lunes. Traer c\u00E9dula.';

    // split into batches of 30
    const batchSize = 30;
    const batches = [];
    for (let i = 0; i < targets.length; i += batchSize) batches.push(targets.slice(i, i + batchSize));

    let html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Broadcast link</title></head><body style="font-family:Arial,sans-serif;padding:20px;">';
    html += `<h2>Enviar broadcast</h2><p>Fecha objetivo: <strong>${date}</strong></p><p>Números totales: <strong>${targets.length}</strong> (máx ${limit})</p>`;
    if (targets.length === 0) {
      html += `<p>No se encontraron números para ${date}.</p>`;
    } else {
      html += '<p>Se han dividido los destinatarios en los siguientes lotes de hasta 30 números. Pulsa un botón para abrir la app de SMS con ese lote.</p>';
      batches.forEach((batch, idx) => {
        const start = idx * batchSize + 1;
        const end = idx * batchSize + batch.length;
        const numbersComma = batch.join(',');
        const smsHref = `sms:${numbersComma}?body=${encodeURIComponent(defaultMsg)}`;
        html += `<div style="margin-bottom:12px;">
          <a href="${smsHref}" style="display:inline-block;padding:10px 14px;background:#007bff;color:white;border-radius:6px;text-decoration:none;margin-right:8px;">Abrir SMS lote ${idx+1} (${start}-${end})</a>
          <button onclick="copyNums(${idx})" style="padding:8px 12px">Copiar lote ${idx+1}</button>
          <div style="margin-top:6px"><small>${start} - ${end} (${batch.length} números)</small></div>
          <textarea id="nums-${idx}" style="width:100%;height:80px;margin-top:6px">${batch.join('\n')}</textarea>
        </div>`;
      });
      html += `<p>Nota: algunos teléfonos limitan la cantidad de destinatarios que aceptan vía URI. Si un lote no se abre, usa el botón "Copiar lote" y pégalos manualmente en la app de mensajería.</p>`;
      html += `<script>function copyNums(i){const t=document.getElementById('nums-'+i).value;navigator.clipboard.writeText(t).then(()=>alert('Números copiados del lote '+(i+1))).catch(()=>alert('No se pudo copiar automáticamente. Seleccione y copie manualmente.'))}</script>`;
    }
    html += '</body></html>';
    res.type('html').send(html);
  } catch (err) {
    console.error('broadcast-link error', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/force-send -> { dryRun: true|false }
app.post('/api/force-send', async (req, res) => {
  try {
    const { dryRun = true } = req.body || {};
    const schedule = readSchedule();
    const today = formatDate(new Date());
    const toSend = schedule.filter(s => s.sendDate === today).map(s => ({ telefono: s.telefono, text: s.text }));
    if (toSend.length === 0) return res.json({ mensaje: 'No hay mensajes para enviar hoy', count: 0 });
    if (dryRun) return res.json({ mensaje: 'Dry run - no enviado', count: toSend.length, items: toSend });

    // perform send using sendSmsBatch, which does its own fetch handling
    const result = await sendSmsBatch(toSend);
    // log
    const logEntry = { date: today, result, count: toSend.length };
    const logFile = path.join(__dirname, 'send-log.json');
    let logs = [];
    try { if (fs.existsSync(logFile)) logs = JSON.parse(fs.readFileSync(logFile,'utf8')||'[]'); } catch(e){}
    logs.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    return res.json({ mensaje: 'Envío ejecutado', result, count: toSend.length });
  } catch (err) {
    console.error('force-send error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Scheduler control endpoints
app.post('/api/enable-scheduler', (req, res) => {
  if (schedulerEnabled) return res.json({ mensaje: 'Scheduler ya activado' });
  // Schedule at 07:00 every day
  scheduledTask = cron.schedule('0 7 * * *', async () => {
    try {
      console.log('Cron triggered at 07:00 - preparing to send messages for tomorrow');
      const schedule = readSchedule();
      const tomorrow = formatDate(new Date(Date.now() + 24*60*60*1000));
      const toSend = schedule.filter(s => s.scheduledDate === tomorrow).map(s => ({ telefono: s.telefono, text: s.text }));
      if (toSend.length === 0) { console.log('No messages to send for', tomorrow); return; }
      const result = await sendSmsBatch(toSend);
      const logFile = path.join(__dirname, 'send-log.json');
      let logs = [];
      try { if (fs.existsSync(logFile)) logs = JSON.parse(fs.readFileSync(logFile,'utf8')||'[]'); } catch(e){}
      logs.push({ date: tomorrow, result, count: toSend.length, auto: true });
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
      console.log('Auto-send result', result);
    } catch (err) { console.error('cron send error', err); }
  });
  schedulerEnabled = true;
  return res.json({ mensaje: 'Scheduler activado - se enviará a las 07:00 diariamente' });
});

app.post('/api/disable-scheduler', (req, res) => {
  if (!schedulerEnabled) return res.json({ mensaje: 'Scheduler ya desactivado' });
  if (scheduledTask) { scheduledTask.stop(); scheduledTask = null; }
  schedulerEnabled = false;
  return res.json({ mensaje: 'Scheduler desactivado' });
});

app.listen(port, () => console.log(`Server listening on ${port}`));
