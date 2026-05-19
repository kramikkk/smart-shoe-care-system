# Firmware

ESP32 firmware for the Smart Shoe Care System. Two boards work together over ESP-NOW: the main controller manages all hardware (motors, relays, payment, WebSocket), and the camera board handles shoe image capture and AI classification.

---

## Board Overview

| Board | Folder | Chip | Role |
|-------|--------|------|------|
| SSCM_MAIN | `SSCM_MAIN/` | ESP32-DevKitC | Main controller |
| SSCM_CAM | `SSCM_CAM/` | ESP32-CAM (AI-Thinker) | Shoe camera + classification |

---

## Hardware — SSCM_MAIN

| Component | Model | Qty | Notes |
|-----------|-------|-----|-------|
| Microcontroller | ESP32-DevKitC | 1 | Main controller |
| Relay Module | 8-Channel 5V | 1 | Controls appliances |
| Servo Motor | MG995 | 2 | Dual synchronized (brush arm) |
| DC Motor Driver | DRV8871 | 2 | Side brush motors |
| Stepper Driver | TB6600 | 2 | NEMA11 linear actuators |
| Top Linear Actuator | NEMA11 | 1 | 480mm stroke, 10 steps/mm |
| Side Linear Actuator | Double NEMA11 | 1 | 100mm stroke, 200 steps/mm |
| RGB LED Strip | WS2812B / NeoPixel | 1 | Addressable LED strip |
| Coin Acceptor | Multi-coin | 1 | 1, 5, 10, 20 PHP |
| Bill Acceptor | Multi-bill | 1 | 20, 50, 100 PHP |

### Relay channel map

| Channel | Relay | Hardware |
|---------|-------|----------|
| 1 | RELAY_1 | Bill Acceptor Power |
| 2 | RELAY_2 | Coin Slot Power |
| 3 | RELAY_3 | Blower Fan |
| 4 | RELAY_4 | PTC Heater |
| 5 | RELAY_5 | Bottom Exhaust |
| 6 | RELAY_6 | Diaphragm Pump |
| 7 | RELAY_7 | Mist Maker |
| 8 | RELAY_8 | UVC Light |

---

## Hardware — SSCM_CAM

| Component | Model | Notes |
|-----------|-------|-------|
| Camera Module | ESP32-CAM (AI-Thinker) | Captures shoe JPEG |

---

## Communication Protocols

```
Backend ◄──── WebSocket ────► SSCM_MAIN
                                  │
                               ESP-NOW
                                  │
                              SSCM_CAM
                                  │
                         HTTP POST /api/device/[id]/classify
                                  │
                              Backend → Gemini API
```

- **WebSocket** — SSCM_MAIN connects to the Next.js backend for service commands, status updates, and payment events.
- **ESP-NOW** — SSCM_MAIN and SSCM_CAM communicate peer-to-peer over WiFi without a router (low-latency, no internet required).
- **HTTP POST** — SSCM_CAM sends a raw JPEG to the backend's classify endpoint with an `X-Group-Token` header.

---

## Shoe Classification Flow

1. Backend sends `classify` command to SSCM_MAIN via WebSocket.
2. SSCM_MAIN forwards the command to SSCM_CAM via ESP-NOW.
3. SSCM_CAM captures a JPEG and HTTP POSTs it to `/api/device/[mainId]/classify`.
4. Backend calls Gemini 2.0 Flash and parses `{ shoeType, confidence, condition }`.
5. Backend broadcasts `classification-result` to the kiosk UI via WebSocket.
6. SSCM_CAM sends `CAM_STATUS_API_HANDLED (6)` ACK to SSCM_MAIN via ESP-NOW.
7. SSCM_MAIN clears `classificationPending`.

> Edge Impulse was evaluated but replaced with the Gemini API due to a tensor arena crash on the ESP32-S3.

---

## CAM Status Codes

| Code | Constant | Meaning |
|------|----------|---------|
| 0 | OK | Success |
| 1 | ERROR | General error |
| 2 | TIMEOUT | Request timed out |
| 3 | BUSY | Camera busy |
| 4 | NOT_READY | Camera not initialised |
| 5 | LOW_CONFIDENCE | Classification confidence below threshold |
| 6 | API_HANDLED | Gemini classify HTTP call sent successfully |

---

## File Structure

### SSCM_MAIN/

| File | Purpose |
|------|---------|
| `SSCM_MAIN.ino` | Entry point — `setup()` and `loop()`, initialises all subsystems |
| `commands.ino` | Serial command parser — dispatches to motor/relay/LED handlers |
| `espnow.ino` | ESP-NOW peer management, send/receive with SSCM_CAM |
| `leds.ino` | WS2812B NeoPixel control, preset and custom RGB |
| `motors.ino` | Servo, DC motor (DRV8871), and stepper motor (TB6600) control |
| `pairing.ino` | Device pairing handshake with the backend |
| `payment.ino` | Coin and bill acceptor interrupts, money state machine |
| `relays.ino` | 8-channel relay switching helpers |
| `sensors.ino` | Sensor polling (temperature, limit switches, etc.) |
| `service.ino` | Cleaning/drying/sterilization service workflow state machine |
| `websocket.ino` | WebSocket client — connect, reconnect, message dispatch |
| `wifi.ino` | WiFi provisioning and credential storage |
| `COMMANDS.md` | Full serial command reference |

### SSCM_CAM/

| File | Purpose |
|------|---------|
| `SSCM_CAM.ino` | Entry point — `setup()` and `loop()` |
| `camera.ino` | Camera initialisation and JPEG capture |
| `classification.ino` | HTTP POST to backend classify endpoint |
| `espnow.ino` | ESP-NOW receive (commands from SSCM_MAIN) and send (status ACK) |
| `server.ino` | Local HTTP server for diagnostics |
| `system.ino` | System info, restart, health |
| `wifi.ino` | WiFi credential sync via ESP-NOW broadcast from SSCM_MAIN |

---

## Serial Command Reference

All commands are sent at **115200 baud** via the Arduino Serial Monitor. Commands are **case-sensitive**, **uppercase**, and **no spaces**.

### System

| Command | Description |
|---------|-------------|
| `STATUS` | Print full device status |
| `RESET_WIFI` | Clear WiFi credentials and restart |
| `RESET_PAIRING` | Clear pairing status and restart |
| `RESET_MONEY` | Reset all money counters |

### Relays

`RELAY_<N>_ON` / `RELAY_<N>_OFF` for N = 1–8. `RELAY_ALL_OFF` turns off all channels.

### Servo Motors

| Command | Description |
|---------|-------------|
| `SERVO_<DEG>` | Move to 0–180°. Right servo is automatically mirrored. |
| `SERVO_DEMO` | Run 0° → 90° → 180° demo sequence |

### DC Motors

`MOTOR_LEFT_<SPEED>`, `MOTOR_RIGHT_<SPEED>`, `MOTOR_<SPEED>` — speed range: -255 (full reverse) to 255 (full forward). Also `MOTOR_BRAKE` and `MOTOR_COAST`.

### Stepper Motor 1 — Top Linear (480mm stroke, 10 steps/mm)

| Command | Example | Description |
|---------|---------|-------------|
| `STEPPER1_SPEED_<N>` | `STEPPER1_SPEED_400` | Set speed (1–800 steps/sec) |
| `STEPPER1_MM_<N>` | `STEPPER1_MM_200` | Move by mm (negative = retract) |
| `STEPPER1_GOTO_<N>` | `STEPPER1_GOTO_0` | Move to absolute step position |
| `STEPPER1_HOME` | | Reset position counter to 0 |
| `STEPPER1_STOP` | | Emergency stop |
| `STEPPER1_INFO` | | Print position and speed |

### Stepper Motor 2 — Side Linear (100mm stroke, 200 steps/mm, 1/16 microstep)

Same pattern: `STEPPER2_SPEED_<N>`, `STEPPER2_MM_<N>`, `STEPPER2_GOTO_<N>`, `STEPPER2_HOME`, `STEPPER2_STOP`.

### RGB LEDs

`RGB_WHITE`, `RGB_BLUE`, `RGB_GREEN`, `RGB_VIOLET`, `RGB_OFF`, `RGB_CUSTOM_<R>_<G>_<B>` (0–255 each).

### Camera / Classification

| Command | Description |
|---------|-------------|
| `CAM_BROADCAST` | Send WiFi credentials to SSCM_CAM via ESP-NOW |
| `CAM_CLASSIFY` | Request a shoe classification |

See [`SSCM_MAIN/COMMANDS.md`](SSCM_MAIN/COMMANDS.md) for the full reference including diagnostic commands.

---

## Setup

### Requirements

- **Arduino IDE** 2.x
- **ESP32 board package** — install via Boards Manager: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
- **Libraries** (install via Library Manager):
  - `AsyncTCP`
  - `ESP Async WebServer`
  - `ArduinoWebsockets`
  - `Adafruit NeoPixel`
  - `AccelStepper`

### WiFi & Pairing

WiFi credentials for SSCM_MAIN are entered via the serial command `RESET_WIFI` which triggers the built-in provisioning flow. Once connected, the board pairs with the backend using `RESET_PAIRING`. SSCM_CAM receives its credentials from SSCM_MAIN via `CAM_BROADCAST` over ESP-NOW — no separate configuration needed.
