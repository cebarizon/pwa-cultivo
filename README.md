# PWA - KC868 Wi-Fi Setup

## O que este app faz
- Conecta na placa por Web Bluetooth (BLE).
- Lê status atual do Wi-Fi automaticamente (polling a cada 15s).
- Mostra alerta quando o Wi-Fi estiver sem configuracao ou com falha.
- Mostra dois estados de interface:
  - Wi-Fi configurado: exibe SSID atual e botao para limpar configuracao.
  - Wi-Fi nao configurado: exibe formulario para configurar SSID/senha.
- Envia SSID/senha para a placa.
- Limpa credenciais salvas.

## Seguranca BLE
- Pareamento BLE com passkey fixa: `123456`.
- O SO/navegador pode solicitar confirmacao durante o pareamento.

## UUIDs usados (iguais ao firmware)
- Service: `6f28d1a0-8f8d-4e35-b0d5-8e8d21d16a00`
- RX write: `6f28d1a1-8f8d-4e35-b0d5-8e8d21d16a00`
- TX notify/read: `6f28d1a2-8f8d-4e35-b0d5-8e8d21d16a00`

## Protocolo JSON
Comandos enviados para RX:

```json
{"cmd":"get_status"}
{"cmd":"set_wifi","ssid":"MinhaRede","pass":"MinhaSenha"}
{"cmd":"test_wifi"}
{"cmd":"clear_wifi"}
{"cmd":"ping"}
```

Mensagens recebidas em TX (exemplos):

```json
{"type":"status","wifiConfigured":true,"wifiState":"connected","ssid":"MinhaRede","ip":"192.168.1.25"}
{"type":"result","action":"set_wifi","ok":true,"detail":"credentials_saved"}
```

## Como rodar
1. Grave o firmware na placa.
2. Sirva a pasta `pwa` com um servidor local.
3. Abra no Chrome/Edge em `http://localhost:<porta>`.
4. Clique em `Conectar Bluetooth` e selecione `KC868-A6-Setup`.
5. Informe passkey `123456` quando solicitado.
6. Preencha SSID/senha e clique `Salvar e Conectar`.

## Exemplo de servidor local
Se tiver Node.js:

```bash
npx serve pwa
```

## Compatibilidade
- Recomendado: Chrome/Edge (desktop e Android).
- iOS/Safari pode nao suportar Web Bluetooth para esse fluxo.
