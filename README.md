# PWA - Automacao Cultivo KC868

## Visao geral
O app foi organizado em 3 abas:

1. Aba 1 - Programacao irrigacao
- Agenda de horarios (ate 24 linhas) com hora + tempo de rega.
- Tempo de oxigenacao antes da rega (rele 2).
- Irrigacao manual por minutos (rele 1).
- Exibicao dos sensores de umidade (A3 e A4 em %).

2. Aba 2 - Supervisorio tanque
- PH (A1 convertido para escala 0-14).
- EC absoluta e EC relativa (A2 + conversao EC = TDS/640).
- Botao para zerar EC relativa.
- Oxigenacao manual por minutos (rele 2).

3. Aba 3 - Tomadas adicionais
- 4 tomadas (reles 3, 4, 5 e 6).
- Cada tomada pode ser habilitada/desabilitada.
- Cada tomada possui agenda com ate 24 linhas:
  - titulo
  - hora inicio
  - hora fim
  - flag ativa

## UUIDs BLE
- Service: `6f28d1a0-8f8d-4e35-b0d5-8e8d21d16a00`
- RX write: `6f28d1a1-8f8d-4e35-b0d5-8e8d21d16a00`
- TX notify/read: `6f28d1a2-8f8d-4e35-b0d5-8e8d21d16a00`

## Comandos principais
Todos os comandos sao JSON enviados na characteristic RX.

```json
{"cmd":"get_status"}
{"cmd":"set_clock","time":"14:35"}
{"cmd":"set_wifi","ssid":"MinhaRede","pass":"MinhaSenha"}
{"cmd":"clear_wifi"}
{"cmd":"set_oxygenation_lead","minutes":"5"}
{"cmd":"start_manual_irrigation","minutes":"10"}
{"cmd":"start_manual_oxygenation","minutes":"3"}
{"cmd":"zero_ec_relative"}
{"cmd":"clear_irrigation_entries"}
{"cmd":"set_irrigation_entry","index":"1","enabled":"true","start":"07:00","minutes":"15"}
{"cmd":"set_socket_enabled","socket":"1","enabled":"true"}
{"cmd":"clear_socket_entries","socket":"1"}
{"cmd":"set_socket_entry","socket":"1","index":"1","enabled":"true","title":"Bomba","start":"08:00","end":"09:00"}
```

## Seguranca BLE
- Pareamento BLE com passkey fixa `123456`.
- O botao desconectar encerra a sessao BLE do navegador.
- Para remover pareamento de verdade, use as configuracoes Bluetooth do sistema.

## Como rodar
1. Grave o firmware na placa.
2. Sirva a pasta `pwa` com servidor local.
3. Abra no Chrome/Edge em `http://localhost:<porta>`.
4. Conecte no dispositivo `KC868-A6-Setup`.
5. Informe passkey `123456`.

Exemplo de servidor local:

```bash
npx serve pwa
```
