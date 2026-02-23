const BLE_SERVICE_UUID = "6f28d1a0-8f8d-4e35-b0d5-8e8d21d16a00";
const BLE_RX_CHAR_UUID = "6f28d1a1-8f8d-4e35-b0d5-8e8d21d16a00";
const BLE_TX_CHAR_UUID = "6f28d1a2-8f8d-4e35-b0d5-8e8d21d16a00";
const POLL_MS = 15000;
const WIFI_OK_STATES = new Set(["connected", "idle"]);

const connectBtn = document.getElementById("connectBtn");
const statusBtn = document.getElementById("statusBtn");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const clearBtn = document.getElementById("clearBtn");
const wifiForm = document.getElementById("wifiForm");
const ssidInput = document.getElementById("ssid");
const passwordInput = document.getElementById("password");
const bleState = document.getElementById("bleState");
const wifiAlert = document.getElementById("wifiAlert");
const logBox = document.getElementById("logBox");
const statusBox = document.getElementById("statusBox");

let bleDevice;
let bleServer;
let rxCharacteristic;
let txCharacteristic;
let pollTimer;
let alertShown = false;

function appendLog(message) {
  const time = new Date().toLocaleTimeString();
  logBox.textContent += `[${time}] ${message}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function showWifiAlert(message) {
  wifiAlert.textContent = message;
  wifiAlert.classList.remove("hidden");
}

function hideWifiAlert() {
  wifiAlert.textContent = "";
  wifiAlert.classList.add("hidden");
}

function updateConnectedState(connected) {
  statusBtn.disabled = !connected;
  saveBtn.disabled = !connected;
  testBtn.disabled = !connected;
  clearBtn.disabled = !connected;
  bleState.textContent = connected ? "Conectado via BLE" : "Desconectado";
  if (!connected) {
    stopStatusPolling();
    hideWifiAlert();
    alertShown = false;
  }
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function encodeCommand(payload) {
  return new TextEncoder().encode(JSON.stringify(payload));
}

async function writeCommand(payload) {
  if (!rxCharacteristic) throw new Error("RX characteristic indisponivel");
  const json = JSON.stringify(payload);
  await rxCharacteristic.writeValue(encodeCommand(payload));
  appendLog(`TX > ${json}`);
}

function shouldWarnStatus(status) {
  if (!status || status.type !== "status") return false;
  if (!status.wifiConfigured) return true;
  return !WIFI_OK_STATES.has(status.wifiState);
}

function statusWarningMessage(status) {
  if (!status.wifiConfigured) {
    return "Wi-Fi nao configurado. Informe SSID e senha para continuar.";
  }
  return `Wi-Fi com problema (${status.wifiState}). Reconfigure a rede para voltar a operar.`;
}

function renderStatus(status) {
  statusBox.textContent = JSON.stringify(status, null, 2);
  if (status.ssid) ssidInput.value = status.ssid;

  if (shouldWarnStatus(status)) {
    const message = statusWarningMessage(status);
    showWifiAlert(message);
    if (!alertShown) {
      alertShown = true;
      window.alert(message);
    }
  } else {
    hideWifiAlert();
    alertShown = false;
  }
}

function onBleNotify(event) {
  const raw = new TextDecoder().decode(event.target.value);
  appendLog(`RX < ${raw}`);
  const msg = parseJsonSafe(raw);
  if (!msg) return;
  if (msg.type === "status") renderStatus(msg);
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
    if (rxCharacteristic) {
      writeCommand({ cmd: "get_status" }).catch((error) => {
        appendLog(`Erro no poll: ${error.message}`);
      });
    }
  }, POLL_MS);
}

async function connectBle() {
  if (!navigator.bluetooth) {
    throw new Error("Seu navegador nao suporta Web Bluetooth");
  }

  bleDevice = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: "KC868-A6" }],
    optionalServices: [BLE_SERVICE_UUID]
  });

  bleDevice.addEventListener("gattserverdisconnected", () => {
    appendLog("BLE desconectado");
    updateConnectedState(false);
    rxCharacteristic = null;
    txCharacteristic = null;
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
  await writeCommand({ cmd: "get_status" });
}

async function clearWifi() {
  const ok = window.confirm("Remover SSID/senha salvos da placa?");
  if (!ok) return;
  await writeCommand({ cmd: "clear_wifi" });
}

connectBtn.addEventListener("click", async () => {
  try {
    connectBtn.disabled = true;
    await connectBle();
  } catch (error) {
    appendLog(`Erro de conexao: ${error.message}`);
  } finally {
    connectBtn.disabled = false;
  }
});

statusBtn.addEventListener("click", async () => {
  try {
    await writeCommand({ cmd: "get_status" });
  } catch (error) {
    appendLog(`Erro: ${error.message}`);
  }
});

testBtn.addEventListener("click", async () => {
  try {
    await writeCommand({ cmd: "test_wifi" });
  } catch (error) {
    appendLog(`Erro: ${error.message}`);
  }
});

clearBtn.addEventListener("click", async () => {
  try {
    await clearWifi();
  } catch (error) {
    appendLog(`Erro: ${error.message}`);
  }
});

wifiForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const ssid = ssidInput.value.trim();
  const pass = passwordInput.value;
  if (!ssid) {
    appendLog("SSID obrigatorio");
    return;
  }

  try {
    await writeCommand({ cmd: "set_wifi", ssid, pass });
  } catch (error) {
    appendLog(`Erro: ${error.message}`);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      appendLog(`Falha ao registrar SW: ${err.message}`);
    });
  });
}

updateConnectedState(false);
