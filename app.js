const BLE_SERVICE_UUID = "6f28d1a0-8f8d-4e35-b0d5-8e8d21d16a00";
const BLE_RX_CHAR_UUID = "6f28d1a1-8f8d-4e35-b0d5-8e8d21d16a00"; // write
const BLE_TX_CHAR_UUID = "6f28d1a2-8f8d-4e35-b0d5-8e8d21d16a00"; // notify/read

const connectBtn = document.getElementById("connectBtn");
const statusBtn = document.getElementById("statusBtn");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const clearBtn = document.getElementById("clearBtn");
const wifiForm = document.getElementById("wifiForm");
const ssidInput = document.getElementById("ssid");
const passwordInput = document.getElementById("password");
const bleState = document.getElementById("bleState");
const logBox = document.getElementById("logBox");
const statusBox = document.getElementById("statusBox");

let bleDevice;
let bleServer;
let rxCharacteristic;
let txCharacteristic;

function appendLog(message) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${message}\n`;
  logBox.textContent += line;
  logBox.scrollTop = logBox.scrollHeight;
}

function setConnectedState(connected) {
  statusBtn.disabled = !connected;
  saveBtn.disabled = !connected;
  testBtn.disabled = !connected;
  clearBtn.disabled = !connected;
  bleState.textContent = connected ? "Conectado via BLE" : "Desconectado";
}

async function writeCommand(command) {
  if (!rxCharacteristic) throw new Error("RX characteristic indisponível");
  const payload = new TextEncoder().encode(command);
  await rxCharacteristic.writeValue(payload);
  appendLog(`TX > ${command}`);
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function renderStatus(obj) {
  statusBox.textContent = JSON.stringify(obj, null, 2);
  if (obj && obj.ssid) {
    ssidInput.value = obj.ssid;
  }
}

function onBleNotify(event) {
  const raw = new TextDecoder().decode(event.target.value);
  appendLog(`RX < ${raw}`);
  const msg = parseJsonSafe(raw);
  if (!msg) return;
  if (msg.type === "status") renderStatus(msg);
}

async function connectBle() {
  if (!navigator.bluetooth) {
    throw new Error("Seu navegador não suporta Web Bluetooth");
  }

  bleDevice = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: "KC868-A6" }],
    optionalServices: [BLE_SERVICE_UUID]
  });

  bleDevice.addEventListener("gattserverdisconnected", () => {
    appendLog("BLE desconectado");
    setConnectedState(false);
  });

  bleServer = await bleDevice.gatt.connect();
  const service = await bleServer.getPrimaryService(BLE_SERVICE_UUID);
  rxCharacteristic = await service.getCharacteristic(BLE_RX_CHAR_UUID);
  txCharacteristic = await service.getCharacteristic(BLE_TX_CHAR_UUID);

  await txCharacteristic.startNotifications();
  txCharacteristic.addEventListener("characteristicvaluechanged", onBleNotify);

  setConnectedState(true);
  appendLog(`Conectado ao dispositivo: ${bleDevice.name || "sem nome"}`);
  await writeCommand("GET_STATUS");
}

async function clearWifi() {
  const ok = window.confirm("Remover SSID/senha salvos da placa?");
  if (!ok) return;
  await writeCommand("CLEAR_WIFI");
}

connectBtn.addEventListener("click", async () => {
  try {
    connectBtn.disabled = true;
    await connectBle();
  } catch (error) {
    appendLog(`Erro de conexão: ${error.message}`);
  } finally {
    connectBtn.disabled = false;
  }
});

statusBtn.addEventListener("click", async () => {
  try {
    await writeCommand("GET_STATUS");
  } catch (error) {
    appendLog(`Erro: ${error.message}`);
  }
});

testBtn.addEventListener("click", async () => {
  try {
    await writeCommand("TEST_WIFI");
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
    appendLog("SSID obrigatório");
    return;
  }

  const cmd = `SET_WIFI;ssid=${ssid};pass=${pass}`;
  try {
    await writeCommand(cmd);
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

setConnectedState(false);
