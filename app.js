const BLE_SERVICE_UUID = "6f28d1a0-8f8d-4e35-b0d5-8e8d21d16a00";
const BLE_RX_CHAR_UUID = "6f28d1a1-8f8d-4e35-b0d5-8e8d21d16a00";
const BLE_TX_CHAR_UUID = "6f28d1a2-8f8d-4e35-b0d5-8e8d21d16a00";
const POLL_MS = 15000;

const connectBtn = document.getElementById("connectBtn");
const syncClockBtn = document.getElementById("syncClockBtn");
const unpairBtn = document.getElementById("unpairBtn");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const wifiForm = document.getElementById("wifiForm");
const ssidInput = document.getElementById("ssid");
const passwordInput = document.getElementById("password");
const wifiConfiguredBox = document.getElementById("wifiConfiguredBox");
const wifiConfigBox = document.getElementById("wifiConfigBox");
const configuredSsid = document.getElementById("configuredSsid");
const bleState = document.getElementById("bleState");
const clockState = document.getElementById("clockState");
const clockBadge = document.getElementById("clockBadge");
const wifiAlert = document.getElementById("wifiAlert");
const loadingBox = document.getElementById("loadingBox");
const statusBox = document.getElementById("statusBox");

const irrigationRows = document.getElementById("irrigationRows");
const addIrrigationRowBtn = document.getElementById("addIrrigationRowBtn");
const clearIrrigationRowsBtn = document.getElementById("clearIrrigationRowsBtn");
const saveIrrigationBtn = document.getElementById("saveIrrigationBtn");
const oxygenationLeadInput = document.getElementById("oxygenationLeadInput");
const saveOxygenationLeadBtn = document.getElementById("saveOxygenationLeadBtn");
const manualIrrigationMinutes = document.getElementById("manualIrrigationMinutes");
const startManualIrrigationBtn = document.getElementById("startManualIrrigationBtn");
const hum1Value = document.getElementById("hum1Value");
const hum2Value = document.getElementById("hum2Value");

const phValue = document.getElementById("phValue");
const ecAbsValue = document.getElementById("ecAbsValue");
const ecRelValue = document.getElementById("ecRelValue");
const a1Value = document.getElementById("a1Value");
const a2Value = document.getElementById("a2Value");
const zeroEcBtn = document.getElementById("zeroEcBtn");
const manualOxyMinutes = document.getElementById("manualOxyMinutes");
const startManualOxyBtn = document.getElementById("startManualOxyBtn");

const socketCards = document.getElementById("socketCards");

let bleDevice;
let bleServer;
let rxCharacteristic;
let txCharacteristic;
let pollTimer;
let pendingTimer = null;
const chunkBuffer = new Map();
let lastStatus = null;

const socketState = Array.from({ length: 4 }, (_, idx) => ({
  index: idx + 1,
  enabled: false,
  rows: []
}));

function appendLog(message) {
  void message;
}

function showWifiAlert(message) {
  wifiAlert.textContent = message;
  wifiAlert.classList.remove("hidden");
}

function hideWifiAlert() {
  wifiAlert.textContent = "";
  wifiAlert.classList.add("hidden");
}

function setLoading(message) {
  loadingBox.textContent = message;
  loadingBox.classList.remove("hidden");
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    clearLoading();
    appendLog("Operação demorou mais que o esperado");
  }, 30000);
}

function clearLoading() {
  loadingBox.textContent = "";
  loadingBox.classList.add("hidden");
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function updateConnectedState(connected) {
  connectBtn.classList.toggle("hidden", connected);
  syncClockBtn.disabled = !connected;
  unpairBtn.disabled = !connected;
  saveBtn.disabled = !connected;
  clearBtn.disabled = !connected;
  addIrrigationRowBtn.disabled = !connected;
  clearIrrigationRowsBtn.disabled = !connected;
  saveIrrigationBtn.disabled = !connected;
  saveOxygenationLeadBtn.disabled = !connected;
  startManualIrrigationBtn.disabled = !connected;
  zeroEcBtn.disabled = !connected;
  startManualOxyBtn.disabled = !connected;
  bleState.textContent = connected ? "Conectado via BLE" : "Desconectado";

  const socketButtons = document.querySelectorAll("[data-socket-action]");
  socketButtons.forEach((btn) => {
    btn.disabled = !connected;
  });

  const removeButtons = document.querySelectorAll(".irr-remove-row, .socket-remove-row");
  removeButtons.forEach((btn) => {
    btn.disabled = !connected;
  });
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryReassembleChunk(raw) {
  if (!raw.startsWith("__PART__|")) return raw;

  const p1 = raw.indexOf("|", 9);
  if (p1 < 0) return null;
  const p2 = raw.indexOf("|", p1 + 1);
  if (p2 < 0) return null;
  const p3 = raw.indexOf("|", p2 + 1);
  if (p3 < 0) return null;

  const msgId = raw.substring(9, p1);
  const index = Number(raw.substring(p1 + 1, p2));
  const total = Number(raw.substring(p2 + 1, p3));
  const payload = raw.substring(p3 + 1);
  if (!msgId || !index || !total) return null;

  let bucket = chunkBuffer.get(msgId);
  if (!bucket) {
    bucket = { total, parts: new Array(total).fill("") };
    chunkBuffer.set(msgId, bucket);
  }
  if (bucket.total !== total || index < 1 || index > total) return null;
  bucket.parts[index - 1] = payload;

  const complete = bucket.parts.every((p) => p.length > 0);
  if (!complete) return null;

  chunkBuffer.delete(msgId);
  return bucket.parts.join("");
}

async function writeCommand(payload) {
  if (!rxCharacteristic) throw new Error("RX characteristic indisponível");
  const json = JSON.stringify(payload);
  await rxCharacteristic.writeValue(new TextEncoder().encode(json));
  appendLog(`TX > ${json}`);
}

function renderWifiMode(status) {
  const wifiActive = Boolean(status.wifiConfigured) && status.wifiState === "connected";
  if (status.ssid) ssidInput.value = status.ssid;

  if (wifiActive) {
    wifiConfiguredBox.classList.remove("hidden");
    wifiConfigBox.classList.add("hidden");
    configuredSsid.textContent = status.ssid || "(SSID não informado)";
  } else {
    wifiConfiguredBox.classList.add("hidden");
    wifiConfigBox.classList.remove("hidden");
  }

  if (!status.wifiConfigured) {
    showWifiAlert("Wi-Fi não configurado. Configure para habilitar sincronismo de hora.");
    return;
  }
  if (status.wifiState !== "connected") {
    showWifiAlert(`Wi-Fi não está ativo (${status.wifiState}). Reconfigure a rede.`);
    return;
  }
  hideWifiAlert();
}

function renderTank(status) {
  const tank = status.tank || {};
  hum1Value.textContent = `${Number(tank.hum1 || 0).toFixed(1)} %`;
  hum2Value.textContent = `${Number(tank.hum2 || 0).toFixed(1)} %`;
  phValue.textContent = Number(tank.ph || 0).toFixed(2);
  ecAbsValue.textContent = Number(tank.ecAbs || 0).toFixed(3);
  ecRelValue.textContent = Number(tank.ecRel || 0).toFixed(3);
  a1Value.textContent = Number(tank.a1V || 0).toFixed(3);
  a2Value.textContent = Number(tank.a2V || 0).toFixed(3);
}

function createIrrigationRow(start = "00:00", minutes = 1, enabled = true) {
  const row = document.createElement("div");
  row.className = "irrigation-row";
  row.innerHTML = `
    <div class="field">
      <label>Hora inicial</label>
      <input type="time" value="${start}" class="irr-start" />
    </div>
    <div class="field">
      <label>Tempo de rega (min)</label>
      <input type="number" min="0" max="720" value="${minutes}" class="irr-minutes" />
    </div>
    <label class="socket-enable irrigation-active">
      <input type="checkbox" class="irr-enabled" ${enabled ? "checked" : ""}/> ativo
    </label>
    <button type="button" class="secondary irr-remove-row">Remover horário</button>
  `;
  return row;
}

function renderIrrigationRows(entries = []) {
  irrigationRows.innerHTML = "";
  const list = entries.slice(0, 24);
  if (!list.length) {
    irrigationRows.appendChild(createIrrigationRow("00:00", 1, false));
    return;
  }
  list.forEach((entry) => {
    irrigationRows.appendChild(
      createIrrigationRow(entry.start || "00:00", Number(entry.minutes || 0), Boolean(entry.enabled))
    );
  });
}

function collectIrrigationRows() {
  const starts = Array.from(irrigationRows.querySelectorAll(".irr-start"));
  const minutes = Array.from(irrigationRows.querySelectorAll(".irr-minutes"));
  const enabled = Array.from(irrigationRows.querySelectorAll(".irr-enabled"));
  const out = [];

  for (let i = 0; i < starts.length && i < 24; i += 1) {
    const start = starts[i].value || "00:00";
    const mins = Number(minutes[i].value || 0);
    out.push({
      index: i + 1,
      enabled: Boolean(enabled[i].checked),
      start,
      minutes: Math.max(0, Math.min(720, mins))
    });
  }
  return out;
}

function createSocketRow(row = {}) {
  const tr = document.createElement("tr");
  const safeTitle = String(row.title || "").replace(/"/g, "&quot;");
  tr.innerHTML = `
    <td>
      <label class="socket-cell-label">Nome</label>
      <input type="text" class="socket-title-input" maxlength="32" value="${safeTitle}" placeholder="Nome" />
    </td>
    <td>
      <label class="socket-cell-label">Hora inicial</label>
      <input type="time" class="socket-start-input" value="${row.start || "00:00"}" />
    </td>
    <td>
      <label class="socket-cell-label">Hora final</label>
      <input type="time" class="socket-end-input" value="${row.end || "00:00"}" />
    </td>
    <td><label class="socket-enable"><input type="checkbox" class="socket-row-enabled" ${row.enabled ? "checked" : ""}/> ativo</label></td>
    <td><button type="button" class="secondary socket-remove-row">Remover horário</button></td>
  `;
  return tr;
}

function renderSocketCards() {
  socketCards.innerHTML = "";

  socketState.forEach((socket) => {
    const card = document.createElement("div");
    card.className = "socket-card";
    card.dataset.socket = String(socket.index);
    card.innerHTML = `
      <div class="socket-title">
        <span class="socket-badge">Tomada ${socket.index}</span>
        <label class="socket-enable">
          <input type="checkbox" class="socket-enabled-main" ${socket.enabled ? "checked" : ""} />
          habilitar tomada
        </label>
      </div>
      <table class="tbl">
        <thead>
          <tr><th>Nome</th><th>Hora inicial</th><th>Hora final</th><th>Ativo</th><th>Ação</th></tr>
        </thead>
        <tbody class="socket-rows"></tbody>
      </table>
      <div class="row">
        <button type="button" data-socket-action="add" data-socket="${socket.index}" disabled>Adicionar horário</button>
        <button type="button" class="secondary" data-socket-action="clear" data-socket="${socket.index}" disabled>Limpar horários</button>
        <button type="button" data-socket-action="save" data-socket="${socket.index}" disabled>Salvar tomada ${socket.index}</button>
      </div>
    `;

    const tbody = card.querySelector(".socket-rows");
  const list = (socket.rows || []).slice(0, 24);
  if (!list.length) {
    tbody.appendChild(createSocketRow({ title: "", start: "00:00", end: "00:00", enabled: false }));
  } else {
    list.forEach((row) => tbody.appendChild(createSocketRow(row)));
  }

    socketCards.appendChild(card);
  });
}

function syncSocketStateFromConfig(config) {
  const sockets = config.sockets || {};
  const enabled = Array.isArray(sockets.enabled) ? sockets.enabled : [false, false, false, false];
  const map = [sockets.s1 || [], sockets.s2 || [], sockets.s3 || [], sockets.s4 || []];

  socketState.forEach((socket, idx) => {
    socket.enabled = Boolean(enabled[idx]);
    socket.rows = Array.isArray(map[idx]) ? map[idx].slice(0, 24) : [];
  });
}

function collectSocketRows(socketIndex) {
  const card = socketCards.querySelector(`.socket-card[data-socket="${socketIndex}"]`);
  if (!card) return { enabled: false, rows: [] };

  const enabledMain = card.querySelector(".socket-enabled-main");
  const titles = Array.from(card.querySelectorAll(".socket-title-input"));
  const starts = Array.from(card.querySelectorAll(".socket-start-input"));
  const ends = Array.from(card.querySelectorAll(".socket-end-input"));
  const enabledRows = Array.from(card.querySelectorAll(".socket-row-enabled"));

  const rows = [];
  for (let i = 0; i < titles.length && i < 24; i += 1) {
    rows.push({
      index: i + 1,
      title: titles[i].value || "",
      start: starts[i].value || "00:00",
      end: ends[i].value || "00:00",
      enabled: Boolean(enabledRows[i].checked)
    });
  }

  return {
    enabled: Boolean(enabledMain.checked),
    rows
  };
}

function updateClockLabel(clock) {
  if (clockBadge) {
    clockBadge.classList.remove("clock-ok", "clock-pending", "clock-unsynced");
  }
  if (!clock || !clock.synced) {
    if (clock && clock.ntpPending) {
      clockState.textContent = "Relogio nao sincronizado (aguardando NTP)";
      if (clockBadge) {
        clockBadge.textContent = "NTP pendente";
        clockBadge.classList.add("clock-pending");
      }
      return;
    }
    clockState.textContent = "Relogio nao sincronizado";
    if (clockBadge) {
      clockBadge.textContent = "Nao sincronizado";
      clockBadge.classList.add("clock-unsynced");
    }
    return;
  }
  const sourceMap = {
    ntp: "NTP",
    rtc: "RTC",
    manual: "Manual",
    persisted: "Persistido"
  };
  const sourceLabel = sourceMap[clock.source] || "Indefinido";
  const pendingSuffix = clock.ntpPending ? " | NTP pendente" : "";
  clockState.textContent = `Hora da placa: ${clock.time} (${sourceLabel})${pendingSuffix}`;
  if (clockBadge) {
    if (clock.ntpPending) {
      clockBadge.textContent = "NTP pendente";
      clockBadge.classList.add("clock-pending");
    } else {
      clockBadge.textContent = "Sincronizado";
      clockBadge.classList.add("clock-ok");
    }
  }
}

function renderStatus(status) {
  lastStatus = status;
  if (statusBox) statusBox.textContent = JSON.stringify(status, null, 2);
  renderWifiMode(status);
  renderTank(status);
  updateClockLabel(status.clock);
}

function renderFullConfig(config) {
  const irrigation = config.irrigation || {};
  oxygenationLeadInput.value = String(Number(irrigation.oxygenationLeadMin || 0));
  renderIrrigationRows(Array.isArray(irrigation.entries) ? irrigation.entries : []);
  syncSocketStateFromConfig(config);
  renderSocketCards();
  updateConnectedState(Boolean(rxCharacteristic));
}

function onBleNotify(event) {
  const incoming = new TextDecoder().decode(event.target.value);
  handleIncomingBlePayload(incoming);
}

function handleIncomingBlePayload(incoming) {
  appendLog(`RX < ${incoming}`);
  const raw = tryReassembleChunk(incoming);
  if (raw === null) return;

  const msg = parseJsonSafe(raw);
  if (!msg) return;
  if (msg.type === "status") {
    renderStatus(msg);
    clearLoading();
  }
  if (msg.type === "full_config") {
    renderFullConfig(msg);
    clearLoading();
  }
  if (msg.type === "result") {
    if (msg.action === "set_clock" && msg.ok) {
      clockState.textContent = "Relógio sincronizado (atualizando...)";
    } else if (msg.action === "set_clock" && !msg.ok) {
      clockState.textContent = "Falha ao sincronizar relógio";
    } else if (msg.action === "sync_clock_ntp" && !msg.ok) {
      clockState.textContent = "NTP indisponível, tentando RTC/manual...";
    } else if (msg.action === "sync_clock_rtc" && !msg.ok) {
      clockState.textContent = "RTC indisponível, aplicando hora manual...";
    }
    clearLoading();
  }
}

async function readTxOnce() {
  if (!txCharacteristic) return;
  try {
    const value = await txCharacteristic.readValue();
    const incoming = new TextDecoder().decode(value);
    if (incoming) handleIncomingBlePayload(incoming);
  } catch (error) {
    appendLog(`Erro leitura TX: ${error.message}`);
  }
}

async function requestStatus() {
  await writeCommand({ cmd: "get_status" });
  setTimeout(() => { readTxOnce(); }, 140);
}

async function requestFullConfig() {
  await writeCommand({ cmd: "get_full_config" });
  setTimeout(() => { readTxOnce(); }, 220);
}

function stopStatusPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startStatusPolling() {
  stopStatusPolling();
  pollTimer = setInterval(() => {
    if (!rxCharacteristic) return;
    requestStatus().catch((error) => appendLog(`Erro no poll: ${error.message}`));
  }, POLL_MS);
}

function browserTimeHHMM() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function browserDayNumber() {
  const now = new Date();
  const localMs = now.getTime() - now.getTimezoneOffset() * 60000;
  return Math.floor(localMs / 86400000);
}

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncClock() {
  const time = browserTimeHHMM();
  const day = browserDayNumber();
  appendLog(`Sincronizando hora (NTP > RTC > manual) ${time} (dia ${day})`);

  await writeCommand({ cmd: "sync_clock_ntp" });
  await delayMs(220);
  await readTxOnce();
  await requestStatus();
  if (lastStatus?.clock?.synced && lastStatus.clock.source === "ntp") return;

  await writeCommand({ cmd: "sync_clock_rtc" });
  await delayMs(220);
  await readTxOnce();
  await requestStatus();
  if (lastStatus?.clock?.synced && lastStatus.clock.source === "rtc") return;

  await writeCommand({ cmd: "set_clock", time, day: String(day) });
  await delayMs(140);
  await readTxOnce();
}

async function connectBle() {
  if (!navigator.bluetooth) throw new Error("Seu navegador não suporta Web Bluetooth");

  bleDevice = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: "KC868-A6" }],
    optionalServices: [BLE_SERVICE_UUID]
  });

  bleDevice.addEventListener("gattserverdisconnected", () => {
    appendLog("BLE desconectado");
    rxCharacteristic = null;
    txCharacteristic = null;
    updateConnectedState(false);
    stopStatusPolling();
  });

  bleServer = await bleDevice.gatt.connect();
  const service = await bleServer.getPrimaryService(BLE_SERVICE_UUID);
  rxCharacteristic = await service.getCharacteristic(BLE_RX_CHAR_UUID);
  txCharacteristic = await service.getCharacteristic(BLE_TX_CHAR_UUID);

  await txCharacteristic.startNotifications();
  txCharacteristic.addEventListener("characteristicvaluechanged", onBleNotify);

  updateConnectedState(true);
  startStatusPolling();
  appendLog(`Conectado ao dispositivo: ${bleDevice.name || "sem nome"}`);
  setLoading("Sincronizando hora e status...");
  await syncClock();
  await requestStatus();
  await requestFullConfig();
}

function disconnectBle() {
  if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
  rxCharacteristic = null;
  txCharacteristic = null;
  updateConnectedState(false);
  stopStatusPolling();
}

async function saveIrrigationSchedule() {
  const rows = collectIrrigationRows();
  setLoading("Salvando programação de irrigação...");
  await writeCommand({ cmd: "clear_irrigation_entries" });
  for (const row of rows) {
    await writeCommand({
      cmd: "set_irrigation_entry",
      index: String(row.index),
      enabled: row.enabled ? "true" : "false",
      start: row.start,
      minutes: String(row.minutes)
    });
  }
  await requestStatus();
  await requestFullConfig();
}

async function saveSocket(socketIndex) {
  const data = collectSocketRows(socketIndex);
  setLoading(`Salvando tomada ${socketIndex}...`);
  await writeCommand({
    cmd: "set_socket_enabled",
    socket: String(socketIndex),
    enabled: data.enabled ? "true" : "false"
  });
  await writeCommand({ cmd: "clear_socket_entries", socket: String(socketIndex) });
  for (const row of data.rows) {
    await writeCommand({
      cmd: "set_socket_entry",
      socket: String(socketIndex),
      index: String(row.index),
      enabled: row.enabled ? "true" : "false",
      title: row.title,
      start: row.start,
      end: row.end
    });
  }
  await requestStatus();
  await requestFullConfig();
}

connectBtn.addEventListener("click", async () => {
  try {
    connectBtn.disabled = true;
    await connectBle();
  } catch (error) {
    clearLoading();
    appendLog(`Erro de conexão: ${error.message}`);
  } finally {
    connectBtn.disabled = false;
  }
});

syncClockBtn.addEventListener("click", async () => {
  try {
    setLoading("Sincronizando relógio...");
    await syncClock();
    await requestStatus();
  } catch (error) {
    clearLoading();
    clockState.textContent = "Falha ao sincronizar relógio";
    appendLog(`Erro: ${error.message}`);
  }
});

unpairBtn.addEventListener("click", () => {
  disconnectBle();
  window.alert("Sessão BLE encerrada. Para remover o pareamento, exclua o dispositivo nas configurações Bluetooth do sistema.");
});

wifiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ssid = ssidInput.value.trim();
  const pass = passwordInput.value;
  if (!ssid) return;
  try {
    setLoading("Salvando Wi-Fi...");
    await writeCommand({ cmd: "set_wifi", ssid, pass });
  } catch (error) {
    clearLoading();
    appendLog(`Erro: ${error.message}`);
  }
});

clearBtn.addEventListener("click", async () => {
  if (!window.confirm("Remover configuração Wi-Fi da placa?")) return;
  try {
    setLoading("Limpando Wi-Fi...");
    await writeCommand({ cmd: "clear_wifi" });
  } catch (error) {
    clearLoading();
    appendLog(`Erro: ${error.message}`);
  }
});

addIrrigationRowBtn.addEventListener("click", () => {
  const count = irrigationRows.querySelectorAll(".irrigation-row").length;
  if (count >= 24) {
    window.alert("Limite de 24 horários atingido.");
    return;
  }
  irrigationRows.appendChild(createIrrigationRow("00:00", 1, false));
});

clearIrrigationRowsBtn.addEventListener("click", async () => {
  if (!window.confirm("Limpar horários da irrigação na tela?")) return;
  irrigationRows.innerHTML = "";
  irrigationRows.appendChild(createIrrigationRow("00:00", 1, false));
  try {
    await saveIrrigationSchedule();
  } catch (error) {
    clearLoading();
    appendLog(`Erro: ${error.message}`);
  }
});

irrigationRows.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const removeBtn = target.closest(".irr-remove-row");
  if (!removeBtn) return;

  const rows = irrigationRows.querySelectorAll(".irrigation-row");
  if (rows.length <= 1) {
    window.alert("Mantenha pelo menos 1 horário de irrigação.");
    return;
  }

  const row = removeBtn.closest(".irrigation-row");
  if (row) row.remove();
});

saveIrrigationBtn.addEventListener("click", async () => {
  try {
    await saveIrrigationSchedule();
  } catch (error) {
    clearLoading();
    appendLog(`Erro: ${error.message}`);
  }
});

saveOxygenationLeadBtn.addEventListener("click", async () => {
  const minutes = Number(oxygenationLeadInput.value || 0);
  try {
    setLoading("Salvando tempo de oxigenação...");
    await writeCommand({ cmd: "set_oxygenation_lead", minutes: String(minutes) });
  } catch (error) {
    clearLoading();
    appendLog(`Erro: ${error.message}`);
  }
});

startManualIrrigationBtn.addEventListener("click", async () => {
  const minutes = Number(manualIrrigationMinutes.value || 0);
  try {
    setLoading("Acionando irrigação manual...");
    await writeCommand({ cmd: "start_manual_irrigation", minutes: String(minutes) });
  } catch (error) {
    clearLoading();
    appendLog(`Erro: ${error.message}`);
  }
});

zeroEcBtn.addEventListener("click", async () => {
  try {
    setLoading("Zerando EC relativa...");
    await writeCommand({ cmd: "zero_ec_relative" });
  } catch (error) {
    clearLoading();
    appendLog(`Erro: ${error.message}`);
  }
});

startManualOxyBtn.addEventListener("click", async () => {
  const minutes = Number(manualOxyMinutes.value || 0);
  try {
    setLoading("Acionando oxigenação manual...");
    await writeCommand({ cmd: "start_manual_oxygenation", minutes: String(minutes) });
  } catch (error) {
    clearLoading();
    appendLog(`Erro: ${error.message}`);
  }
});

socketCards.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const removeBtn = target.closest(".socket-remove-row");
  if (removeBtn) {
    const card = removeBtn.closest(".socket-card");
    if (!card) return;
    const rows = card.querySelectorAll(".socket-rows tr");
    if (rows.length <= 1) {
      window.alert("Mantenha pelo menos 1 horário por tomada.");
      return;
    }
    const row = removeBtn.closest("tr");
    if (row) row.remove();
    return;
  }

  const action = target.dataset.socketAction;
  const socket = Number(target.dataset.socket || 0);
  if (!action || !socket) return;

  if (action === "add") {
    const card = socketCards.querySelector(`.socket-card[data-socket="${socket}"]`);
    if (!card) return;
    const tbody = card.querySelector(".socket-rows");
    if (!tbody) return;
    const count = tbody.querySelectorAll("tr").length;
    if (count >= 24) {
      window.alert("Limite de 24 linhas atingido.");
      return;
    }
    tbody.appendChild(createSocketRow({ title: "", start: "00:00", end: "00:00", enabled: false }));
    return;
  }

  if (action === "clear") {
    const card = socketCards.querySelector(`.socket-card[data-socket="${socket}"]`);
    if (!card) return;
    if (!window.confirm(`Limpar horários da tomada ${socket} na tela?`)) return;
    const tbody = card.querySelector(".socket-rows");
    if (!tbody) return;
    tbody.innerHTML = "";
    tbody.appendChild(createSocketRow({ title: "", start: "00:00", end: "00:00", enabled: false }));
    try {
      await saveSocket(socket);
    } catch (error) {
      clearLoading();
      appendLog(`Erro: ${error.message}`);
    }
    return;
  }

  if (action === "save") {
    try {
      await saveSocket(socket);
    } catch (error) {
      clearLoading();
      appendLog(`Erro: ${error.message}`);
    }
  }
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));
    btn.classList.add("active");
    const pane = document.getElementById(btn.dataset.tab || "");
    if (pane) pane.classList.add("active");
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      appendLog(`Falha ao registrar SW: ${err.message}`);
    });
  });
}

renderIrrigationRows([]);
renderSocketCards();
updateConnectedState(false);
