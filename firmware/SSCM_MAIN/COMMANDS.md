# Thesis_SSCM Firmware - Serial Commands Reference

This document lists all available Serial commands for the Smart Shoe Care Machine (SSCM) firmware.

## System Commands

### WiFi & Network
| Command | Description |
|---------|-------------|
| `RESET_WIFI` | Clear saved WiFi credentials and restart |
| `RESET_PAIRING` | Clear device pairing status, generate new pairing code, and restart |

### Device Status
| Command | Description |
|---------|-------------|
| `STATUS` | Display device status (ID, WiFi, WebSocket, pairing, money, sensors, motors) |
| `RESET_MONEY` | Reset all money counters to 0 PHP |

## Relay Control (8-Channel Module)

### Individual Relay Control
| Command | Description | Hardware |
|---------|-------------|----------|
| `RELAY_1_ON` | Turn on Relay 1 | Bill Acceptor Power |
| `RELAY_1_OFF` | Turn off Relay 1 | |
| `RELAY_2_ON` | Turn on Relay 2 | Coin Slot Power |
| `RELAY_2_OFF` | Turn off Relay 2 | |
| `RELAY_3_ON` | Turn on Relay 3 | Blower Fan |
| `RELAY_3_OFF` | Turn off Relay 3 | |
| `RELAY_4_ON` | Turn on Relay 4 | PTC Heater |
| `RELAY_4_OFF` | Turn off Relay 4 | |
| `RELAY_5_ON` | Turn on Relay 5 | Bottom Exhaust |
| `RELAY_5_OFF` | Turn off Relay 5 | |
| `RELAY_6_ON` | Turn on Relay 6 | Diaphragm Pump |
| `RELAY_6_OFF` | Turn off Relay 6 | |
| `RELAY_7_ON` | Turn on Relay 7 | Mist Maker |
| `RELAY_7_OFF` | Turn off Relay 7 | |
| `RELAY_8_ON` | Turn on Relay 8 | UVC Light |
| `RELAY_8_OFF` | Turn off Relay 8 | |

### All Relays
| Command | Description |
|---------|-------------|
| `RELAY_ALL_OFF` | Turn off all 8 relays |

## Servo Motors (Dual MG995)

| Command | Description | Left Servo | Right Servo |
|---------|-------------|------------|-------------|
| `SERVO_0` | Move to 0° position | 0° | 180° (mirrored) |
| `SERVO_90` | Move to 90° position | 90° | 90° |
| `SERVO_180` | Move to 180° position | 180° | 0° (mirrored) |
| `SERVO_X` | Move to X° position (0-180) | X° | 180-X° |
| `SERVO_DEMO` | Run demo sequence (0°→90°→180°) | Smooth movement | Mirrored movement |

**Note:** Servos move smoothly and non-blocking. Right servo is automatically mirrored.

## DC Motors (Dual DRV8871)

### Left Motor
| Command | Description |
|---------|-------------|
| `MOTOR_LEFT_255` | Full forward (max speed) |
| `MOTOR_LEFT_128` | Half forward |
| `MOTOR_LEFT_-255` | Full reverse |
| `MOTOR_LEFT_-128` | Half reverse |
| `MOTOR_LEFT_0` | Stop |
| `MOTOR_LEFT_BRAKE` | Apply brake |
| `MOTOR_LEFT_COAST` | Coast to stop |

### Right Motor
| Command | Description |
|---------|-------------|
| `MOTOR_RIGHT_255` | Full forward (max speed) |
| `MOTOR_RIGHT_128` | Half forward |
| `MOTOR_RIGHT_-255` | Full reverse |
| `MOTOR_RIGHT_-128` | Half reverse |
| `MOTOR_RIGHT_0` | Stop |
| `MOTOR_RIGHT_BRAKE` | Apply brake |
| `MOTOR_RIGHT_COAST` | Coast to stop |

### Both Motors (Same Speed)
| Command | Description |
|---------|-------------|
| `MOTOR_255` | Both motors full forward |
| `MOTOR_-255` | Both motors full reverse |
| `MOTOR_0` | Both motors stop |
| `MOTOR_BRAKE` | Both motors brake |
| `MOTOR_COAST` | Both motors coast |

**Speed Range:** -255 (full reverse) to 255 (full forward)

## Stepper Motor 1 (Top Linear Actuator - NEMA11)

### Movement Commands
| Command | Description | Example |
|---------|-------------|---------|
| `STEPPER1_SPEED_X` | Set speed (1-800 steps/sec) | `STEPPER1_SPEED_800` (80mm/s max) |
| `STEPPER1_MOVE_X` | Move relative steps | `STEPPER1_MOVE_2000` (move +2000 steps) |
| `STEPPER1_MOVE_-X` | Move relative steps (negative) | `STEPPER1_MOVE_-1000` (move -1000 steps) |
| `STEPPER1_GOTO_X` | Move to absolute position | `STEPPER1_GOTO_0` (return to home) |
| `STEPPER1_MM_X` | Move by millimeters | `STEPPER1_MM_480` (move +480mm) |
| `STEPPER1_MM_-X` | Move by millimeters (negative) | `STEPPER1_MM_-150` (move -150mm) |
| `STEPPER1_STOP` | Emergency stop | |
| `STEPPER1_HOME` | Reset position to 0 | |

### Diagnostic Commands
| Command | Description |
|---------|-------------|
| `STEPPER1_TEST_MANUAL` | Step 10 times rapidly (test driver response) |
| `STEPPER1_TEST_PINS` | Test pin output (use oscilloscope) |
| `STEPPER1_TEST_PULSE` | Send 100 rapid pulses (verify TB6600 driver) |
| `STEPPER1_INFO` | Show position, speed, and moving status |
| `STEPPER1_ENABLE` | Show enable status (always enabled) |
| `STEPPER1_DISABLE` | Show enable status (always enabled) |

### Specifications
- **Type:** NEMA11 Linear Actuator
- **Steps per mm:** 10 steps/mm (20mm lead screw pitch)
- **Max Speed:** 800 steps/sec (80mm/s)
- **Stroke Length:** 480mm
- **Microstepping:** FULL STEP (fastest)
- **Enable:** ALWAYS ENABLED (ENA+ hardwired to GND)

## Stepper Motor 2 (Side Linear Actuator - Double NEMA11)

### Movement Commands
| Command | Description | Example |
|---------|-------------|---------|
| `STEPPER2_SPEED_X` | Set speed (1-24000 steps/sec) | `STEPPER2_SPEED_24000` (120mm/s max) |
| `STEPPER2_MOVE_X` | Move relative steps | `STEPPER2_MOVE_2000` (move +2000 steps) |
| `STEPPER2_MOVE_-X` | Move relative steps (negative) | `STEPPER2_MOVE_-1000` (move -1000 steps) |
| `STEPPER2_GOTO_X` | Move to absolute position | `STEPPER2_GOTO_0` (return to home) |
| `STEPPER2_MM_X` | Move by millimeters | `STEPPER2_MM_100` (move +100mm) |
| `STEPPER2_MM_-X` | Move by millimeters (negative) | `STEPPER2_MM_-50` (move -50mm) |
| `STEPPER2_STOP` | Emergency stop | |
| `STEPPER2_HOME` | Reset position to 0 | |

### Diagnostic Commands
| Command | Description |
|---------|-------------|
| `STEPPER2_ENABLE` | Show enable status (always enabled) |
| `STEPPER2_DISABLE` | Show enable status (always enabled) |

### Specifications
- **Type:** Double NEMA11 Linear Actuator (synchronized)
- **Steps per mm:** 200 steps/mm
- **Max Speed:** 24000 steps/sec (120mm/s)
- **Stroke Length:** 100mm
- **Microstepping:** 1/16 microstep
- **Enable:** ALWAYS ENABLED (ENA+ hardwired to GND)

## RGB LED Strip (WS2812B / NeoPixel)

### Preset Colors
| Command | Description | Color |
|---------|-------------|-------|
| `RGB_WHITE` | Turn on white light | Full white |
| `RGB_BLUE` | Turn on blue light | Full blue |
| `RGB_GREEN` | Turn on green light | Full green |
| `RGB_VIOLET` | Turn on violet light | Violet/purple |
| `RGB_OFF` | Turn off all LEDs | Off |

### Custom Colors
| Command | Description | Example |
|---------|-------------|---------|
| `RGB_CUSTOM_R_G_B` | Set custom RGB color (0-255 each) | `RGB_CUSTOM_255_0_0` (red) |
| | | `RGB_CUSTOM_255_128_0` (orange) |
| | | `RGB_CUSTOM_0_255_255` (cyan) |

**Format:** `RGB_CUSTOM_[RED]_[GREEN]_[BLUE]` where each value is 0-255

## ESP32-CAM Commands (Classification)

| Command | Description |
|---------|-------------|
| `CAM_BROADCAST` | Broadcast WiFi credentials to ESP32-CAM via ESP-NOW |
| `CAM_CLASSIFY` | Request shoe classification via WebSocket |

**Note:** ESP32-CAM must be powered on and running for these commands to work.

## Command Format Rules

1. **All commands are case-sensitive** (use UPPERCASE)
2. **No spaces** in commands
3. **Use underscores** to separate parts: `COMMAND_PART_VALUE`
4. **Negative numbers** use minus sign: `STEPPER1_MM_-150`
5. **Decimal numbers** use period: `STEPPER1_MM_25.5`

## Examples

### Quick Start Sequence
```
STATUS                    # Check device status
RELAY_3_ON               # Turn on blower fan
STEPPER1_SPEED_400       # Set stepper1 to 40mm/s
STEPPER1_MM_100          # Move stepper1 forward 100mm
SERVO_90                 # Move servos to center position
RGB_WHITE                # Turn on white LED
```

### Emergency Stop All
```
STEPPER1_STOP
STEPPER2_STOP
MOTOR_BRAKE
RELAY_ALL_OFF
RGB_OFF
```

### Return to Home Position
```
STEPPER1_HOME
STEPPER2_HOME
SERVO_0
```

## Notes

- All motor movements are **non-blocking** - other processes continue running
- Stepper motors are **always enabled** (holding torque always active)
- Use `STATUS` command to check current positions before moving
- Serial baud rate: **115200**
- Servo movements are **smooth and gradual** (15ms update interval)
- DC motors support **PWM speed control** (0-255)

## Hardware Specifications Summary

| Component | Model | Quantity | Notes |
|-----------|-------|----------|-------|
| Microcontroller | ESP32-DevKitC | 1 | Main controller |
| Relay Module | 8-Channel 5V | 1 | Controls appliances |
| Stepper Driver | TB6600 | 2 | NEMA11 linear actuators |
| DC Motor Driver | DRV8871 | 2 | Dual motors |
| Servo Motor | MG995 | 2 | Dual synchronized |
| RGB LED | WS2812B/NeoPixel | 1 strip | Addressable LEDs |
| Coin Acceptor | Multi-coin | 1 | 1, 5, 10, 20 PHP |
| Bill Acceptor | Multi-bill | 1 | 20, 50, 100 PHP |
| ESP32-CAM | AI-Thinker | 1 | Shoe classification |

---

**Firmware Version:** Thesis_SSCM v2.0  
**Last Updated:** January 2026
