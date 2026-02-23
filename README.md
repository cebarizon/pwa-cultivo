# PWA - KC868 Wi-Fi Setup

## O que este app faz
- Conecta na placa por Web Bluetooth (BLE).
- Lê status atual do Wi-Fi.
- Envia SSID/senha para a placa.
- Testa conexão Wi-Fi.
- Limpa credenciais salvas.

## UUIDs usados (iguais ao firmware)
- Service: `6f28d1a0-8f8d-4e35-b0d5-8e8d21d16a00`
- RX write: `6f28d1a1-8f8d-4e35-b0d5-8e8d21d16a00`
- TX notify/read: `6f28d1a2-8f8d-4e35-b0d5-8e8d21d16a00`

## Como rodar
1. Grave o firmware da placa.
2. Sirva a pasta `pwa` com um servidor local.
3. Abra no Chrome/Edge em `http://localhost:<porta>`.
4. Clique em `Conectar Bluetooth` e selecione `KC868-A6-Setup`.
5. Preencha SSID/senha e clique `Salvar e Conectar`.

## Exemplo de servidor local
Se tiver Node.js:

```bash
npx serve pwa
```

## Compatibilidade
- Recomendado: Chrome/Edge (desktop e Android).
- iOS/Safari pode não suportar Web Bluetooth para esse fluxo.
