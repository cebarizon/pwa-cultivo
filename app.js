let device;
let serverBLE;

const SERVICE_UUID = "12345678-1234-1234-1234-123456789abc";
const SSID_UUID = "abcd1234-1234-1234-1234-abcdef123456";
const PASS_UUID = "abcd1234-1234-1234-1234-abcdef654321";

function saveIP(){
  const ip = document.getElementById("ip").value;
  localStorage.setItem("ip", ip);
  alert("IP salvo!");
}

async function connectBLE(){

  try{

    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "ESP32" }],
      optionalServices: [SERVICE_UUID]
    });

    serverBLE = await device.gatt.connect();

    const service = await serverBLE.getPrimaryService(SERVICE_UUID);

    const ssidChar = await service.getCharacteristic(SSID_UUID);
    const passChar = await service.getCharacteristic(PASS_UUID);

    let ssid = prompt("Nome do WiFi:");
    let pass = prompt("Senha:");

    await ssidChar.writeValue(new TextEncoder().encode(ssid));
    await passChar.writeValue(new TextEncoder().encode(pass));

    alert("WiFi enviado!");

  }catch(e){
    alert("Erro BLE: " + e);
  }
}

async function toggleRelay(){

  const ip = localStorage.getItem("ip");

  if(!ip){
    alert("Informe IP primeiro");
    return;
  }

  await fetch(`http://${ip}/on`);
}
