/*
 * Smart Shoe Care Machine - WiFi & Pairing with WebSocket
 * Firmware with WiFi configuration and real-time device pairing via WebSocket
 *
 * Required Libraries:
 * - WiFi (built-in with ESP32)
 * - HTTPClient (built-in with ESP32)
 * - Preferences (built-in with ESP32)
 * - WebSocketsClient (by Markus Sattler) - Install via Library Manager
 * - DHT sensor library (by Adafruit) - Install via Library Manager
 * - Adafruit Unified Sensor - Install via Library Manager
 * - ESP32Servo (by Kevin Harrington) - Install via Library Manager
 * - Adafruit NeoPixel (by Adafruit) - Install via Library Manager
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <Adafruit_NeoPixel.h>

/* ===================== WIFI ===================== */
Preferences prefs;

WiFiServer wifiServer(80);
bool wifiConnected = false;
bool softAPStarted = false;
unsigned long wifiStartTime = 0;
unsigned long lastWiFiRetry = 0;

#define WIFI_TIMEOUT 60000        // 1 minute
#define WIFI_RETRY_INTERVAL 5000  // Retry every 5 seconds

/* ===================== WEBSOCKET ===================== */
WebSocketsClient webSocket;
bool wsConnected = false;
unsigned long lastWsReconnect = 0;
const unsigned long WS_RECONNECT_INTERVAL = 5000; // Try to reconnect every 5 seconds

/* ===================== STATUS UPDATE ===================== */
unsigned long lastStatusUpdate = 0;
const unsigned long STATUS_UPDATE_INTERVAL = 60000; // Update status every 1 minute

/* ===================== COIN SLOT ===================== */
#define COIN_SLOT_PIN 5
volatile unsigned long lastCoinPulseTime = 0;
volatile unsigned int currentCoinPulses = 0;
unsigned int totalCoinPesos = 0;
const unsigned long COIN_PULSE_DEBOUNCE_TIME = 100;     // 100ms between pulses (increased for noise immunity)
const unsigned long COIN_COMPLETE_TIMEOUT = 300;        // 300ms to confirm coin insertion complete

/* ===================== BILL ACCEPTOR ===================== */
#define BILL_PULSE_PIN 4
volatile unsigned long lastBillPulseTime = 0;
volatile unsigned int currentBillPulses = 0;
unsigned int totalBillPesos = 0;
unsigned int totalPesos = 0;  // Combined total (coins + bills)
const unsigned long BILL_PULSE_DEBOUNCE_TIME = 100;     // 100ms between pulses (increased for noise immunity)
const unsigned long BILL_COMPLETE_TIMEOUT = 300;        // 300ms to confirm bill insertion complete

/* ===================== PAYMENT CONTROL ===================== */
bool paymentEnabled = false;  // Only accept payments when explicitly enabled from frontend
unsigned long paymentEnableTime = 0;  // Timestamp when payment relay was turned on
const unsigned long PAYMENT_STABILIZATION_DELAY = 3000;  // 3 second delay after relay turns on

/* ===================== 8-CHANNEL RELAY ===================== */
#define RELAY_1_PIN 3   // Channel 1: Bill + Coin (combined power for both acceptors)
#define RELAY_2_PIN 8   // Channel 2: Solenoid Lock
#define RELAY_3_PIN 18  // Channel 3: Centrifugal Blower Fan
#define RELAY_4_PIN 17  // Channel 4: PTC Ceramic Heater
#define RELAY_5_PIN 16  // Channel 5: Bottom Exhaust
#define RELAY_6_PIN 15  // Channel 6: Diaphragm Pump
#define RELAY_7_PIN 7   // Channel 7: Ultrasonic Mist Maker
#define RELAY_8_PIN 6   // Channel 8: UVC Light

// Most relay modules are active LOW (LOW = ON, HIGH = OFF)
#define RELAY_ON HIGH
#define RELAY_OFF LOW

bool relay1State = false;  // Bill + Coin (combined power for both acceptors)
bool relay2State = false;  // Solenoid Lock
bool relay3State = false;  // Centrifugal Blower Fan
bool relay4State = false;  // PTC Ceramic Heater
bool relay5State = false;  // Bottom Exhaust
bool relay6State = false;  // Diaphragm Pump
bool relay7State = false;  // Ultrasonic Mist Maker
bool relay8State = false;  // UVC Light

/* ===================== SERVICE CONTROL ===================== */
bool serviceActive = false;
unsigned long serviceStartTime = 0;
unsigned long serviceDuration = 0;  // Duration in milliseconds
String currentCareType = "";
String currentShoeType = "";
String currentServiceType = "";
const unsigned long SERVICE_STATUS_UPDATE_INTERVAL = 1000;  // Send updates every second
unsigned long lastServiceStatusUpdate = 0;

/* ===================== CLEANING SERVICE STATE ===================== */
// Cleaning mode: Stepper moves 0 → 480mm → 0 while diaphragm pump runs
const long CLEANING_MAX_POSITION = 4800;  // 480mm * 10 steps/mm = 4800 steps
int cleaningPhase = 0;  // 0: not cleaning, 1: moving to max, 2: returning to 0

/* ===================== DHT22 TEMPERATURE & HUMIDITY SENSOR ===================== */
#define DHT_PIN 9
#define DHT_TYPE DHT22

DHT dht(DHT_PIN, DHT_TYPE);

int currentTemperature = 0;
int currentHumidity = 0;
unsigned long lastDHTRead = 0;
const unsigned long DHT_READ_INTERVAL = 5000;  // Read every 5 seconds

/* ===================== JSN-SR20-Y1 ULTRASONIC DISTANCE SENSORS ===================== */
// Sensor 1: Atomizer Level
#define ATOMIZER_TRIG_PIN 10
#define ATOMIZER_ECHO_PIN 11

// Sensor 2: Foam Level
#define FOAM_TRIG_PIN 12
#define FOAM_ECHO_PIN 13

int currentAtomizerDistance = 0;  // Atomizer liquid level in cm
int currentFoamDistance = 0;      // Foam level in cm
unsigned long lastUltrasonicRead = 0;
const unsigned long ULTRASONIC_READ_INTERVAL = 5000;  // Read every 5 seconds

/* ===================== SERVO MOTORS (MG995) - TWO SERVOS ===================== */
#define SERVO_LEFT_PIN 14   // GPIO 14 for left servo (0° → 180°)
#define SERVO_RIGHT_PIN 19  // GPIO 19 for right servo (180° → 0°)

Servo servoLeft;   // Left servo: moves from 0° to 180°
Servo servoRight;  // Right servo: moves from 180° to 0° (mirrored)

int currentLeftPosition = 0;    // Current position of left servo (0-180)
int currentRightPosition = 180; // Current position of right servo (starts at 180)
int targetLeftPosition = 0;     // Target position for left servo
int targetRightPosition = 180;  // Target position for right servo
bool servosMoving = false;      // Are servos currently moving
unsigned long lastServoUpdate = 0;
const unsigned long SERVO_UPDATE_INTERVAL = 15;  // Update servos every 15ms for smooth slow movement

/* ===================== DRV8871 DC MOTOR DRIVERS - DUAL MOTORS ===================== */
// Left DC Motor
#define MOTOR_LEFT_IN1_PIN 20   // GPIO 20 - Left motor IN1
#define MOTOR_LEFT_IN2_PIN 21   // GPIO 21 - Left motor IN2

// Right DC Motor
#define MOTOR_RIGHT_IN1_PIN 47  // GPIO 47 - Right motor IN1
#define MOTOR_RIGHT_IN2_PIN 48  // GPIO 48 - Right motor IN2

// PWM configuration for motor speed control
const int MOTOR_PWM_FREQ = 1000;      // 1kHz PWM frequency
const int MOTOR_PWM_RESOLUTION = 8;   // 8-bit resolution (0-255)

int currentLeftMotorSpeed = 0;   // Left motor speed (-255 to 255, negative = reverse)
int currentRightMotorSpeed = 0;  // Right motor speed (-255 to 255, negative = reverse)

/* ===================== TB6600 STEPPER MOTOR DRIVER - TOP LINEAR STEPPER ===================== */
#define STEPPER_STEP_PIN 45     // GPIO 45 - STEP/PULSE pin (PUL+/PUL-)
#define STEPPER_DIR_PIN 35      // GPIO 35 - DIRECTION pin (DIR+/DIR-)
// ENA+ hardwired to GND (motor ALWAYS ENABLED - no ESP32 control needed)

// Top Linear Stepper configuration - Optimized for NEMA11 linear actuator (max 80mm/s)
const int STEPPER_STEPS_PER_REV = 200;      // NEMA11: 1.8° step angle = 200 steps/rev (FULL STEP)
const int STEPPER_MICROSTEPS = 1;           // TB6600 FULL STEP mode (fastest, set DIP: OFF-OFF-OFF)
const int STEPPER_STEPS_PER_MM = 10;        // Lead screw: 20mm pitch (200 steps = 20mm travel)
const unsigned long STEPPER_MIN_PULSE_WIDTH = 2;  // Minimum 2us pulse (optimized for speed)

// Top Linear Stepper state
long currentStepperPosition = 0;    // Current position in steps
long targetStepperPosition = 0;     // Target position in steps
int stepperSpeed = 800;             // Speed: 800 steps/sec = 80mm/s (MAXIMUM for this motor!)
bool stepperMoving = false;         // Is stepper currently moving
unsigned long lastStepperUpdate = 0;
unsigned long stepperStepInterval = 1250;  // Microseconds between steps (calculated from speed)

/* ===================== TB6600 STEPPER MOTOR DRIVER - SIDE LINEAR STEPPER (DOUBLE) ===================== */
#define STEPPER2_STEP_PIN 36    // GPIO 36 - STEP/PULSE pin (PUL+/PUL-)
#define STEPPER2_DIR_PIN 37     // GPIO 37 - DIRECTION pin (DIR+/DIR-)
// ENA+ hardwired to GND (motor ALWAYS ENABLED - no ESP32 control needed)

// Side Linear Stepper (Double) state
long currentStepper2Position = 0;   // Current position in steps
long targetStepper2Position = 0;    // Target position in steps
int stepper2Speed = 800;            // Speed: 800 steps/sec = 80mm/s (MAXIMUM for this motor!)
bool stepper2Moving = false;        // Is stepper currently moving
unsigned long lastStepper2Update = 0;
unsigned long stepper2StepInterval = 1250;  // Microseconds between steps (calculated from speed)

/* ===================== WS2812B RGB LED STRIP (NeoPixel) ===================== */
#define RGB_DATA_PIN 38      // GPIO 38 - WS2812B data pin
#define RGB_NUM_LEDS 58      // Number of LEDs in the strip

// Create NeoPixel strip object
Adafruit_NeoPixel strip(RGB_NUM_LEDS, RGB_DATA_PIN, NEO_GRB + NEO_KHZ800);

// Current color values
int currentRed = 0;
int currentGreen = 0;
int currentBlue = 0;

/* ===================== PAIRING ===================== */
String pairingCode = "";
String deviceId = "";
bool isPaired = false;

/* ===================== BACKEND URL ===================== */
const char* BACKEND_HOST = "172.20.10.3";  // Update with your Next.js server IP
const int BACKEND_PORT = 3000;
const char* BACKEND_URL = "http://172.20.10.3:3000";

/* ===================== WIFI PORTAL HTML ===================== */
const char WIFI_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Smart Shoe Care Machine WiFi Setup</title>
  <style>
    html, body { height: 100%; margin: 0; }
    body {
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #0d9488 0%, #06b6d4 50%, #3b82f6 100%);
      color: #ffffff;
      min-height: 100vh;
    }
    .wrapper {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      width: 100%;
      max-width: 360px;
      background: rgba(255, 255,\\255, 0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    h2 {
      margin: 0 0 24px 0;
      color: #ffffff;
      font-weight: 600;
      font-size: 24px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    select, input {
      width: 100%;
      padding: 14px;
      margin: 10px 0;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      font-size: 15px;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      transition: all 0.3s ease;
    }
    select::placeholder, input::placeholder {
      color: rgba(255, 255, 255, 0.7);
    }
    select:focus, input:focus {
      outline: none;
      border: 2px solid rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.25);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
    }
    select option {
      background: #0d9488;
      color: #ffffff;
    }
    button {
      width: 100%;
      padding: 14px;
      margin-top: 20px;
      background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: bold;
      color: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
    }
    button:active {
      transform: translateY(0);
      box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <h2>Smart Shoe Care WiFi Setup</h2>
      <form method="POST">
        <select name="ssid" required>
          {{WIFI_LIST}}
        </select>
        <input name="pass" type="password" placeholder="WiFi Password" autocomplete="off">
        <button type="submit">Save & Connect</button>
      </form>
    </div>
  </div>
</body>
</html>
)rawliteral";

/* ===================== FUNCTIONS ===================== */

String getWiFiListHTML() {
    String options = "";
    int n = WiFi.scanNetworks();

    if (n <= 0) {
        options += "<option>No networks found</option>";
    } else {
        for (int i = 0; i < n; i++) {
            String ssid = WiFi.SSID(i);
            int rssi = WiFi.RSSI(i);

            // Sanitize SSID for HTML
            ssid.replace("'", "");
            ssid.replace("\"", "");
            ssid.replace("<", "");
            ssid.replace(">", "");

            options += "<option value='";
            options += ssid;
            options += "'>";
            options += ssid;
            options += " (";
            options += rssi;
            options += " dBm)</option>";
        }
    }

    WiFi.scanDelete();
    return options;
}

void startSoftAP() {
    if (softAPStarted) return;

    softAPStarted = true;

    WiFi.disconnect(true);
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP("Smart Shoe Care Machine Setup");

    Serial.println("=== SoftAP Started ===");
    Serial.print("SSID: Smart Shoe Care Machine Setup");
    Serial.print("\nIP: ");
    Serial.println(WiFi.softAPIP());
    Serial.println("======================");

    wifiServer.begin();
}

String urlDecode(String input) {
    input.replace("+", " ");
    for (int i = 0; i < input.length(); i++) {
        if (input[i] == '%' && i + 2 < input.length()) {
            String hex = input.substring(i + 1, i + 3);
            char ch = strtol(hex.c_str(), NULL, 16);
            input = input.substring(0, i) + ch + input.substring(i + 3);
        }
    }
    return input;
}

void handleWiFiPortal() {
    WiFiClient client = wifiServer.available();
    if (!client) return;

    // Wait briefly for client to send request (non-blocking with timeout)
    unsigned long timeout = millis() + 100; // 100ms timeout
    while (!client.available() && millis() < timeout) {
        delay(1);
    }

    // Read the request
    String request = "";
    if (client.available()) {
        request = client.readString();
    }

    // Check POST data
    if (request.indexOf("ssid=") != -1) {
        int ssidIndex = request.indexOf("ssid=") + 5;
        int passIndex = request.indexOf("&pass=");
        if (passIndex == -1) {
            client.stop();
            return;
        }

        String ssid = request.substring(ssidIndex, passIndex);
        String pass = request.substring(passIndex + 6);

        ssid = urlDecode(ssid);
        pass = urlDecode(pass);

        Serial.println("=== Saving WiFi Credentials ===");
        Serial.println("SSID: " + ssid);
        Serial.println("================================");

        prefs.putString("ssid", ssid);
        prefs.putString("pass", pass);

        // Build confirmation page with actual SSID
        String confirmPage = R"rawliteral(<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WiFi Saved</title>
<style>
html, body { width: 100%; height: 100%; margin: 0; }
body {
  background: linear-gradient(135deg, #0d9488 0%, #06b6d4 50%, #3b82f6 100%);
  color: #ffffff;
  font-family: Arial, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 40px;
  width: 90%;
  max-width: 360px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}
h2 {
  margin-top: 0;
  color: #ffffff;
  font-size: 28px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  margin-bottom: 20px;
}
p {
  color: rgba(255, 255, 255, 0.95);
  font-size: 16px;
  margin: 8px 0;
}
.count {
  font-size: 72px;
  font-weight: bold;
  margin: 24px 0;
  color: #10b981;
  text-shadow: 0 2px 10px rgba(16, 185, 129, 0.5);
  animation: pulse 1s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.6));
}
.hint {
  font-size: 14px;
  opacity: 0.8;
  margin-top: 20px;
  color: rgba(255, 255, 255, 0.9);
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.9; }
}
</style>
</head>
<body>
<div class="card">
  <h2>WiFi Saved</h2>
  <p>Connected to:</p>
  <p style="font-weight: bold; font-size: 18px; margin: 12px 0;">{{SSID}}</p>
  <p style="margin-top: 20px;">Device is rebooting</p>
  <p>Auto-closing in</p>
  <div class="count" id="count">15</div>
  <p>seconds</p>
  <div class="hint" id="hint">You can close this tab manually</div>
</div>
<script>
let seconds = 15;
const countEl = document.getElementById("count");
const hintEl = document.getElementById("hint");
const timer = setInterval(() => {
  seconds--;
  countEl.textContent = seconds;
  if (seconds <= 0) {
    clearInterval(timer);
    hintEl.innerHTML = "Closing now...";
    setTimeout(() => {
      window.open('about:blank', '_self');
      window.close();
      setTimeout(() => {
        hintEl.innerHTML = "You can close this tab now";
      }, 500);
    }, 500);
  }
}, 1000);
</script>
</body>
</html>
)rawliteral";

        confirmPage.replace("{{SSID}}", ssid);

        client.println("HTTP/1.1 200 OK");
        client.println("Content-Type: text/html; charset=UTF-8");
        client.println("Connection: close");
        client.println();
        client.print(confirmPage);
        client.flush();
        client.stop();

        delay(1500);
        ESP.restart();
    }
    // Serve HTML page
    else {
        client.println("HTTP/1.1 200 OK");
        client.println("Content-Type: text/html");
        client.println("Connection: close");
        client.println();
        String page = WIFI_HTML;
        page.replace("{{WIFI_LIST}}", getWiFiListHTML());
        client.print(page);
    }

    client.stop();
}

String generatePairingCode() {
    String code = "";
    for (int i = 0; i < 6; i++) {
        code += String(random(0, 10));
    }
    return code;
}

String generateDeviceId() {
    // Generate unique device ID from ESP32 chip ID
    uint64_t chipid = ESP.getEfuseMac();
    String id = "SSCM-";

    // Extract bytes from chip ID
    uint8_t byte0 = (chipid >> 0) & 0xFF;
    uint8_t byte1 = (chipid >> 8) & 0xFF;
    uint8_t byte2 = (chipid >> 16) & 0xFF;

    // Format as hex
    if (byte2 < 16) id += "0";
    id += String(byte2, HEX);
    if (byte1 < 16) id += "0";
    id += String(byte1, HEX);
    if (byte0 < 16) id += "0";
    id += String(byte0, HEX);

    id.toUpperCase();
    return id;
}

void sendDeviceRegistration() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    String url = String(BACKEND_URL) + "/api/device/register";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String payload = "{";
    payload += "\"deviceId\":\"" + deviceId + "\",";
    payload += "\"pairingCode\":\"" + pairingCode + "\"";
    payload += "}";

    Serial.println("=== Registering Device ===");
    Serial.println("URL: " + url);
    Serial.println("Payload: " + payload);

    int httpCode = http.POST(payload);

    if (httpCode > 0) {
        Serial.printf("HTTP Response: %d\n", httpCode);
        if (httpCode == 200 || httpCode == 201) {
            String response = http.getString();
            Serial.println("Response: " + response);

            // Check if device is already paired
            if (response.indexOf("\"paired\":true") != -1) {
                Serial.println("Device is already paired!");
                isPaired = true;
                prefs.putBool("paired", true);
            } else {
                Serial.println("Device registered successfully");
            }
        }
    } else {
        Serial.printf("Registration failed: %s\n", http.errorToString(httpCode).c_str());
    }
    Serial.println("==========================");

    http.end();
}

void sendStatusUpdate() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    String url = String(BACKEND_URL) + "/api/device/status";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String payload = "{";
    payload += "\"deviceId\":\"" + deviceId + "\"";
    payload += "}";

    Serial.println("=== Updating Device Status ===");
    Serial.println("URL: " + url);
    Serial.println("Payload: " + payload);

    int httpCode = http.POST(payload);

    if (httpCode > 0) {
        Serial.printf("HTTP Response: %d\n", httpCode);
        if (httpCode == 200) {
            String response = http.getString();
            Serial.println("Response: " + response);
            Serial.println("Status updated successfully");
        }
    } else {
        Serial.printf("Status update failed: %s\n", http.errorToString(httpCode).c_str());
    }
    Serial.println("==============================");

    http.end();
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED: {
            Serial.println("[WebSocket] Disconnected");
            wsConnected = false;
            break;
        }

        case WStype_CONNECTED: {
            Serial.println("[WebSocket] Connected");
            wsConnected = true;

            // Subscribe to device updates
            String subscribeMsg = "{\"type\":\"subscribe\",\"deviceId\":\"" + deviceId + "\"}";
            webSocket.sendTXT(subscribeMsg);
            break;
        }

        case WStype_TEXT: {
            // Parse JSON response
            String message = String((char*)payload);

            if (message.indexOf("\"type\":\"subscribed\"") != -1) {
                Serial.println("[WebSocket] Subscribed");

                // Send initial status update immediately after subscribing
                String statusMsg = "{\"type\":\"status-update\",\"deviceId\":\"" + deviceId + "\"}";
                webSocket.sendTXT(statusMsg);
            }
            else if (message.indexOf("\"type\":\"status-ack\"") != -1) {
                // Acknowledgment of status update with paired status sync
                if (message.indexOf("\"success\":true") != -1) {

                    // Sync paired status from database
                    bool dbPaired = (message.indexOf("\"paired\":true") != -1);

                    if (dbPaired != isPaired) {
                        Serial.println("\n=== Syncing Paired Status ===");
                        Serial.println("Local isPaired: " + String(isPaired ? "true" : "false"));
                        Serial.println("Database paired: " + String(dbPaired ? "true" : "false"));

                        if (dbPaired && !isPaired) {
                            // Database says paired, but ESP32 thinks unpaired - sync to paired
                            Serial.println("Syncing to PAIRED state");
                            isPaired = true;
                            prefs.putBool("paired", true);
                        } else if (!dbPaired && isPaired) {
                            // Database says unpaired, but ESP32 thinks paired - sync to unpaired
                            Serial.println("Syncing to UNPAIRED state - generating new code");
                            isPaired = false;
                            prefs.putBool("paired", false);
                            pairingCode = generatePairingCode();
                            Serial.println("New Pairing Code: " + pairingCode);

                            // Re-register with new pairing code
                            sendDeviceRegistration();
                        }
                        Serial.println("==============================\n");
                    }
                } else {
                    Serial.println("[WebSocket] Status update failed");
                }
            }
            else if (message.indexOf("\"type\":\"device-update\"") != -1) {
                // Check if paired
                if (message.indexOf("\"paired\":true") != -1) {
                    if (!isPaired) {
                        Serial.println("\n=== Device Paired! ===");
                        Serial.println("Received pairing confirmation via WebSocket");
                        Serial.println("======================\n");
                        isPaired = true;
                        prefs.putBool("paired", true);
                    }
                }
                else if (message.indexOf("\"paired\":false") != -1) {
                    if (isPaired) {
                        Serial.println("\n=== Device Unpaired! ===");
                        Serial.println("Device was unpaired, generating new code");
                        isPaired = false;
                        prefs.putBool("paired", false);
                        pairingCode = generatePairingCode();
                        Serial.println("Device ID: " + deviceId);
                        Serial.println("New Pairing Code: " + pairingCode);
                        Serial.println("========================\n");

                        // Re-register with new pairing code
                        sendDeviceRegistration();
                    }
                }
            }
            else if (message.indexOf("\"type\":\"enable-payment\"") != -1) {
                // Frontend enabled payment system - enable coin/bill acceptance
                paymentEnabled = true;
                paymentEnableTime = millis();  // Record when relay turned on

                // Turn ON Relay 1 (Bill + Coin power)
                digitalWrite(RELAY_1_PIN, RELAY_ON);
                relay1State = true;

                Serial.println("\n=== PAYMENT SYSTEM ENABLED ===");
                Serial.println("Relay 1 (Bill + Coin): ON");
                Serial.println("Stabilizing for " + String(PAYMENT_STABILIZATION_DELAY / 1000) + " seconds...");
                Serial.println("Will accept payments after stabilization");
                Serial.println("===============================\n");
            }
            else if (message.indexOf("\"type\":\"disable-payment\"") != -1) {
                // Frontend disabled payment system - disable coin/bill acceptance
                paymentEnabled = false;

                // Turn OFF Relay 1 (Bill + Coin power)
                digitalWrite(RELAY_1_PIN, RELAY_OFF);
                relay1State = false;

                Serial.println("\n=== PAYMENT SYSTEM DISABLED ===");
                Serial.println("Relay 1 (Bill + Coin): OFF");
                Serial.println("Ignoring coins and bills");
                Serial.println("================================\n");
                // Reset any partial coin/bill counts
                currentCoinPulses = 0;
                currentBillPulses = 0;
            }
            else if (message.indexOf("\"type\":\"relay-control\"") != -1) {
                // Parse relay control command
                // Expected format: {"type":"relay-control","channel":1,"state":true}
                int channelIndex = message.indexOf("\"channel\":");
                int stateIndex = message.indexOf("\"state\":");

                if (channelIndex != -1 && stateIndex != -1) {
                    // Extract channel number
                    int channelStart = channelIndex + 10; // length of "\"channel\":"
                    int channelEnd = message.indexOf(',', channelStart);
                    if (channelEnd == -1) channelEnd = message.indexOf('}', channelStart);
                    String channelStr = message.substring(channelStart, channelEnd);
                    channelStr.trim();
                    int channel = channelStr.toInt();

                    // Extract state
                    int stateStart = stateIndex + 8; // length of "\"state\":"
                    int stateEnd = message.indexOf('}', stateStart);
                    String stateStr = message.substring(stateStart, stateEnd);
                    stateStr.trim();
                    bool state = (stateStr.indexOf("true") != -1);

                    // Set the relay
                    if (channel >= 1 && channel <= 8) {
                        setRelay(channel, state);
                        Serial.println("[WebSocket] Relay CH" + String(channel) + " -> " + (state ? "ON" : "OFF"));
                    } else {
                        Serial.println("[WebSocket] Invalid relay CH" + String(channel));
                    }
                } else {
                    Serial.println("[WebSocket] Bad relay format");
                }
            }
            else if (message.indexOf("\"type\":\"start-service\"") != -1) {
                // Parse start-service command
                // Expected format: {"type":"start-service","deviceId":"xxx","shoeType":"mesh","serviceType":"drying","careType":"normal"}

                // Extract shoeType
                int shoeTypeIndex = message.indexOf("\"shoeType\":\"");
                String shoeType = "";
                if (shoeTypeIndex != -1) {
                    int start = shoeTypeIndex + 12; // length of "\"shoeType\":\""
                    int end = message.indexOf("\"", start);
                    shoeType = message.substring(start, end);
                }

                // Extract serviceType
                int serviceTypeIndex = message.indexOf("\"serviceType\":\"");
                String serviceType = "";
                if (serviceTypeIndex != -1) {
                    int start = serviceTypeIndex + 15; // length of "\"serviceType\":\""
                    int end = message.indexOf("\"", start);
                    serviceType = message.substring(start, end);
                }

                // Extract careType
                int careTypeIndex = message.indexOf("\"careType\":\"");
                String careType = "";
                if (careTypeIndex != -1) {
                    int start = careTypeIndex + 12; // length of "\"careType\":\""
                    int end = message.indexOf("\"", start);
                    careType = message.substring(start, end);
                }

                // Start the service (handles all service types: cleaning, drying, sterilizing)
                if (serviceType == "cleaning" || serviceType == "drying" || serviceType == "sterilizing") {
                    startService(shoeType, serviceType, careType);
                    Serial.println("[WebSocket] Start: " + serviceType + " | " + shoeType + " | " + careType);
                } else {
                    Serial.println("[WebSocket] Unknown service: " + serviceType);
                }
            }
            break;
        }

        case WStype_ERROR: {
            Serial.println("[WebSocket] Error");
            wsConnected = false;
            break;
        }
    }
}

void connectWebSocket() {
    if (!wifiConnected || wsConnected) return;

    // Include deviceId as query parameter for server authentication
    String wsPath = "/api/ws?deviceId=" + deviceId;

    Serial.println("[WebSocket] Connecting to " + String(BACKEND_HOST) + ":" + String(BACKEND_PORT));
    webSocket.begin(BACKEND_HOST, BACKEND_PORT, wsPath);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}

void connectWiFi() {
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");

    if (ssid.length() == 0) {
        Serial.println("No WiFi credentials found");
        startSoftAP();
        return;
    }

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());
    wifiStartTime = millis();

    Serial.println("=== Connecting to WiFi ===");
    Serial.println("SSID: " + ssid);
    Serial.println("==========================");
}

/* ===================== RELAY CONTROL FUNCTIONS ===================== */
void setRelay(int channel, bool state) {
    int pin;
    bool* stateVar;
    String name;

    switch(channel) {
        case 1: pin = RELAY_1_PIN; stateVar = &relay1State; name = "Bill Acceptor"; break;
        case 2: pin = RELAY_2_PIN; stateVar = &relay2State; name = "Coin Slot"; break;
        case 3: pin = RELAY_3_PIN; stateVar = &relay3State; name = "Centrifugal Blower Fan"; break;
        case 4: pin = RELAY_4_PIN; stateVar = &relay4State; name = "PTC Ceramic Heater"; break;
        case 5: pin = RELAY_5_PIN; stateVar = &relay5State; name = "Bottom Exhaust"; break;
        case 6: pin = RELAY_6_PIN; stateVar = &relay6State; name = "Diaphragm Pump"; break;
        case 7: pin = RELAY_7_PIN; stateVar = &relay7State; name = "Ultrasonic Mist Maker"; break;
        case 8: pin = RELAY_8_PIN; stateVar = &relay8State; name = "UVC Light"; break;
        default:
            Serial.println("[ERROR] Invalid relay channel: " + String(channel));
            return;
    }

    *stateVar = state;
    digitalWrite(pin, state ? RELAY_ON : RELAY_OFF);
    Serial.println("[Relay " + String(channel) + "] " + name + ": " + (state ? "ON" : "OFF"));
}

void allRelaysOff() {
    Serial.println("\n=== Turning All Relays OFF ===");
    for (int i = 1; i <= 8; i++) {
        setRelay(i, false);
    }
    Serial.println("===============================\n");
}

/* ===================== SERVICE FUNCTIONS ===================== */
void startService(String shoeType, String serviceType, String careType) {
    // Turn OFF all service-related relays and RGB before starting new service
    // This ensures clean transition between services in auto mode
    if (serviceActive) {
        Serial.println("[Service] Stopping previous service...");
        // Turn off RGB
        rgbOff();
        // Turn off all service relays (CH3-CH8)
        setRelay(3, false);  // Blower Fan
        setRelay(4, false);  // PTC Heater
        setRelay(5, false);  // Bottom Exhaust
        setRelay(6, false);  // Diaphragm Pump
        setRelay(7, false);  // Mist Maker
        setRelay(8, false);  // UVC Light
    }

    // Determine duration based on service and care type (in milliseconds)
    if (serviceType == "cleaning") {
        serviceDuration = 300000;  // Cleaning always 300 seconds (5 minutes) for all care types
    } else if (serviceType == "drying") {
        if (careType == "gentle") {
            serviceDuration = 60000;  // 60 seconds
        } else if (careType == "normal") {
            serviceDuration = 120000;  // 120 seconds
        } else if (careType == "strong") {
            serviceDuration = 180000;  // 180 seconds
        } else {
            serviceDuration = 120000;  // Default to normal (120 seconds)
        }
    } else if (serviceType == "sterilizing") {
        if (careType == "gentle") {
            serviceDuration = 60000;  // 60 seconds
        } else if (careType == "normal") {
            serviceDuration = 120000;  // 120 seconds
        } else if (careType == "strong") {
            serviceDuration = 180000;  // 180 seconds
        } else {
            serviceDuration = 120000;  // Default to normal (120 seconds)
        }
    } else {
        serviceDuration = 120000;  // Default to 120 seconds
    }

    currentShoeType = shoeType;
    currentServiceType = serviceType;
    currentCareType = careType;
    serviceActive = true;
    serviceStartTime = millis();
    lastServiceStatusUpdate = millis();

    Serial.println("\n=== SERVICE STARTED ===");
    Serial.println("Shoe Type: " + shoeType);
    Serial.println("Service Type: " + serviceType);
    Serial.println("Care Type: " + careType);
    Serial.println("Duration: " + String(serviceDuration / 1000) + " seconds");

    // Set RGB light color based on service type
    if (serviceType == "cleaning") {
        rgbBlue();  // Blue for cleaning
        Serial.println("RGB Light: BLUE");
    } else if (serviceType == "drying") {
        rgbGreen();  // Green for drying
        Serial.println("RGB Light: GREEN");
    } else if (serviceType == "sterilizing") {
        rgbViolet();  // Dark violet for sterilizing
        Serial.println("RGB Light: VIOLET");
    }

    // Turn ON relays based on service type
    if (serviceType == "cleaning") {
        // Start cleaning sequence: stepper moves 0 → 480mm → 0, diaphragm pump ON
        setRelay(6, true);  // Diaphragm Pump
        Serial.println("Relay 6 (Diaphragm Pump): ON");

        // Start stepper moving to max position
        cleaningPhase = 1;  // Phase 1: moving to max
        stepperMoveTo(CLEANING_MAX_POSITION);
        Serial.println("[Cleaning] Stepper moving to " + String(CLEANING_MAX_POSITION / 10) + "mm");
    } else if (serviceType == "drying") {
        setRelay(3, true);  // Centrifugal Blower Fan
        setRelay(4, true);  // PTC Ceramic Heater
        Serial.println("Relay 3 (Blower Fan): ON");
        Serial.println("Relay 4 (PTC Heater): ON");
    } else if (serviceType == "sterilizing") {
        setRelay(7, true);  // Ultrasonic Mist Maker
        setRelay(8, true);  // UVC Light
        Serial.println("Relay 7 (Mist Maker): ON");
        Serial.println("Relay 8 (UVC Light): ON");
    }

    Serial.println("=======================\n");

    // Send service started confirmation via WebSocket
    sendServiceStatusUpdate();
}

void stopService() {
    if (!serviceActive) return;

    serviceActive = false;

    // Turn OFF RGB light
    rgbOff();
    Serial.println("RGB Light: OFF");

    // Turn OFF relays based on service type
    if (currentServiceType == "cleaning") {
        setRelay(6, false);  // Diaphragm Pump
        // Stop stepper and return to home position
        cleaningPhase = 0;
        stepperMoveTo(0);  // Return to home
        Serial.println("[Cleaning] Returning stepper to home position");
    } else if (currentServiceType == "drying") {
        setRelay(3, false);  // Centrifugal Blower Fan
        setRelay(4, false);  // PTC Ceramic Heater
    } else if (currentServiceType == "sterilizing") {
        setRelay(7, false);  // Ultrasonic Mist Maker
        setRelay(8, false);  // UVC Light
    }

    Serial.println("\n=== SERVICE COMPLETED ===");
    Serial.println("Service Type: " + currentServiceType);
    Serial.println("All relays turned OFF");
    Serial.println("=========================\n");

    // Send completion status via WebSocket
    if (wsConnected && isPaired) {
        String msg = "{";
        msg += "\"type\":\"service-complete\",";
        msg += "\"deviceId\":\"" + deviceId + "\",";
        msg += "\"serviceType\":\"" + currentServiceType + "\",";
        msg += "\"shoeType\":\"" + currentShoeType + "\",";
        msg += "\"careType\":\"" + currentCareType + "\"";
        msg += "}";
        webSocket.sendTXT(msg);
        Serial.println("[WebSocket] Complete: " + currentServiceType);
    }

    // Clear service data
    currentShoeType = "";
    currentServiceType = "";
    currentCareType = "";
}

void handleService() {
    if (!serviceActive) return;

    unsigned long elapsed = millis() - serviceStartTime;

    // Check if service duration is complete
    if (elapsed >= serviceDuration) {
        stopService();
        return;
    }

    // Handle cleaning mode stepper movement (one round trip: 0 → max → 0)
    if (currentServiceType == "cleaning" && cleaningPhase > 0) {
        // Check if stepper reached target position
        if (!stepperMoving) {
            if (cleaningPhase == 1) {
                // Reached max position, now return to 0
                cleaningPhase = 2;
                stepperMoveTo(0);
                Serial.println("[Cleaning] Stepper at max, returning to 0");
            } else if (cleaningPhase == 2) {
                // Reached home position, stepper movement complete
                cleaningPhase = 0;  // Done with stepper movement
                setRelay(6, false);  // Turn OFF diaphragm pump
                Serial.println("[Cleaning] Stepper at home - pump OFF");
            }
        }
    }

    // Send status updates every second
    if (millis() - lastServiceStatusUpdate >= SERVICE_STATUS_UPDATE_INTERVAL) {
        lastServiceStatusUpdate = millis();
        sendServiceStatusUpdate();
    }
}

void sendServiceStatusUpdate() {
    if (!wsConnected || !isPaired) return;

    unsigned long elapsed = millis() - serviceStartTime;
    unsigned long remaining = 0;

    if (elapsed < serviceDuration) {
        remaining = (serviceDuration - elapsed) / 1000;  // Convert to seconds
    }

    int progress = (elapsed * 100) / serviceDuration;
    if (progress > 100) progress = 100;

    String msg = "{";
    msg += "\"type\":\"service-status\",";
    msg += "\"deviceId\":\"" + deviceId + "\",";
    msg += "\"serviceType\":\"" + currentServiceType + "\",";
    msg += "\"shoeType\":\"" + currentShoeType + "\",";
    msg += "\"careType\":\"" + currentCareType + "\",";
    msg += "\"active\":" + String(serviceActive ? "true" : "false") + ",";
    msg += "\"progress\":" + String(progress) + ",";
    msg += "\"timeRemaining\":" + String(remaining);
    msg += "}";

    webSocket.sendTXT(msg);
}

/* ===================== DHT22 FUNCTIONS ===================== */
bool readDHT22() {
    float temp = dht.readTemperature();  // Celsius
    float hum = dht.readHumidity();

    if (isnan(temp) || isnan(hum)) {
        Serial.println("[DHT22] Failed to read from sensor!");
        return false;  // Reading failed
    }

    currentTemperature = (int)temp;
    currentHumidity = (int)hum;

    Serial.println("[DHT22] Temp: " + String(currentTemperature) + "°C | Humidity: " + String(currentHumidity) + "%");
    return true;  // Reading successful
}

void sendDHTDataViaWebSocket() {
    // Don't send data if device is not paired
    if (!isPaired || !wsConnected) return;

    String sensorMsg = "{";
    sensorMsg += "\"type\":\"sensor-data\",";
    sensorMsg += "\"deviceId\":\"" + deviceId + "\",";
    sensorMsg += "\"temperature\":" + String(currentTemperature) + ",";
    sensorMsg += "\"humidity\":" + String(currentHumidity);
    sensorMsg += "}";

    webSocket.sendTXT(sensorMsg);
}

/* ===================== ULTRASONIC FUNCTIONS ===================== */
bool readAtomizerLevel() {
    // Manual trigger for better reliability with JSN-SR20-Y1
    digitalWrite(ATOMIZER_TRIG_PIN, LOW);
    delayMicroseconds(5);  // Ensure clean LOW state
    digitalWrite(ATOMIZER_TRIG_PIN, HIGH);
    delayMicroseconds(20); // 20us pulse (JSN-SR20-Y1 needs at least 10us)
    digitalWrite(ATOMIZER_TRIG_PIN, LOW);
    
    // Wait for echo with longer timeout (30ms = 5m max distance)
    unsigned long duration = pulseIn(ATOMIZER_ECHO_PIN, HIGH, 30000);
    
    // Check for invalid reading (0 = timeout or no echo)
    if (duration == 0) {
        Serial.println("[Atomizer] Error: No echo");
        return false;
    }

    // Calculate distance: duration in microseconds, speed of sound = 343 m/s
    // distance = (duration / 2) / 29.1 cm (or duration * 0.034 / 2)
    int distance = (duration * 0.034) / 2;

    // Validate range (JSN-SR20-Y1: 2cm to 500cm)
    if (distance < 2 || distance > 500) {
        Serial.println("[Atomizer] Out of range: " + String(distance) + " cm");
        return false;
    }

    currentAtomizerDistance = distance;
    return true;
}

bool readFoamLevel() {
    // Manual trigger for better reliability with JSN-SR20-Y1
    digitalWrite(FOAM_TRIG_PIN, LOW);
    delayMicroseconds(5);  // Ensure clean LOW state
    digitalWrite(FOAM_TRIG_PIN, HIGH);
    delayMicroseconds(20); // 20us pulse (JSN-SR20-Y1 needs at least 10us)
    digitalWrite(FOAM_TRIG_PIN, LOW);

    // Wait for echo with longer timeout (30ms = 5m max distance)
    unsigned long duration = pulseIn(FOAM_ECHO_PIN, HIGH, 30000);

    // Check for invalid reading (0 = timeout or no echo)
    if (duration == 0) {
        Serial.println("[Foam] Error: No echo");
        return false;
    }

    // Calculate distance: duration in microseconds, speed of sound = 343 m/s
    // distance = (duration / 2) / 29.1 cm (or duration * 0.034 / 2)
    int distance = (duration * 0.034) / 2;

    // Validate range (JSN-SR20-Y1: 2cm to 500cm)
    if (distance < 2 || distance > 500) {
        Serial.println("[Foam] Out of range: " + String(distance) + " cm");
        return false;
    }

    currentFoamDistance = distance;
    return true;
}

void sendUltrasonicDataViaWebSocket() {
    // Don't send data if device is not paired
    if (!isPaired || !wsConnected) return;

    String distanceMsg = "{";
    distanceMsg += "\"type\":\"distance-data\",";
    distanceMsg += "\"deviceId\":\"" + deviceId + "\",";
    distanceMsg += "\"atomizerDistance\":" + String(currentAtomizerDistance) + ",";
    distanceMsg += "\"foamDistance\":" + String(currentFoamDistance);
    distanceMsg += "}";

    webSocket.sendTXT(distanceMsg);
}

/* ===================== SERVO MOTOR CONTROL (NON-BLOCKING) - DUAL SERVOS ===================== */
// Non-blocking smooth servo movement - called every loop iteration
// Left servo: 0° → 180° | Right servo: 180° → 0° (mirrored)
void updateServoPositions() {
    if (!servosMoving) return;

    unsigned long currentTime = millis();

    // Check if it's time to update servo positions (every 15ms)
    if (currentTime - lastServoUpdate >= SERVO_UPDATE_INTERVAL) {
        lastServoUpdate = currentTime;

        bool leftReached = false;
        bool rightReached = false;

        // Update LEFT servo
        if (currentLeftPosition < targetLeftPosition) {
            currentLeftPosition++;
            servoLeft.write(currentLeftPosition);
        } else if (currentLeftPosition > targetLeftPosition) {
            currentLeftPosition--;
            servoLeft.write(currentLeftPosition);
        } else {
            leftReached = true;
        }

        // Update RIGHT servo
        if (currentRightPosition < targetRightPosition) {
            currentRightPosition++;
            servoRight.write(currentRightPosition);
        } else if (currentRightPosition > targetRightPosition) {
            currentRightPosition--;
            servoRight.write(currentRightPosition);
        } else {
            rightReached = true;
        }

        // Both servos reached target
        if (leftReached && rightReached) {
            servosMoving = false;
            Serial.println("[Servos] Reached target - Left: " + String(currentLeftPosition) + "° | Right: " + String(currentRightPosition) + "°");
        }
    }
}

// Set servo target positions - initiates non-blocking smooth movement
// leftPos: position for left servo (0-180)
// When left goes to 180°, right goes to 0° (mirrored)
void setServoPositions(int leftPos) {
    // Constrain position to 0-180 degrees
    leftPos = constrain(leftPos, 0, 180);

    // Calculate mirrored position for right servo
    int rightPos = 180 - leftPos;

    if (leftPos != currentLeftPosition || rightPos != currentRightPosition) {
        targetLeftPosition = leftPos;
        targetRightPosition = rightPos;
        servosMoving = true;
        Serial.println("[Servos] Moving - Left: " + String(currentLeftPosition) + "° → " + String(targetLeftPosition) +
                       "° | Right: " + String(currentRightPosition) + "° → " + String(targetRightPosition) + "°");
    }
}

/* ===================== DRV8871 DC MOTOR CONTROL - DUAL MOTORS ===================== */
// Set LEFT motor speed and direction
void setLeftMotorSpeed(int speed) {
    speed = constrain(speed, -255, 255);
    currentLeftMotorSpeed = speed;

    if (speed > 0) {
        ledcWrite(MOTOR_LEFT_IN1_PIN, speed);
        ledcWrite(MOTOR_LEFT_IN2_PIN, 0);
        Serial.println("[Left Motor] Forward - Speed: " + String(speed) + "/255");
    } else if (speed < 0) {
        ledcWrite(MOTOR_LEFT_IN1_PIN, 0);
        ledcWrite(MOTOR_LEFT_IN2_PIN, abs(speed));
        Serial.println("[Left Motor] Reverse - Speed: " + String(abs(speed)) + "/255");
    } else {
        ledcWrite(MOTOR_LEFT_IN1_PIN, 0);
        ledcWrite(MOTOR_LEFT_IN2_PIN, 0);
        Serial.println("[Left Motor] Stopped");
    }
}

// Set RIGHT motor speed and direction
void setRightMotorSpeed(int speed) {
    speed = constrain(speed, -255, 255);
    currentRightMotorSpeed = speed;

    if (speed > 0) {
        ledcWrite(MOTOR_RIGHT_IN1_PIN, speed);
        ledcWrite(MOTOR_RIGHT_IN2_PIN, 0);
        Serial.println("[Right Motor] Forward - Speed: " + String(speed) + "/255");
    } else if (speed < 0) {
        ledcWrite(MOTOR_RIGHT_IN1_PIN, 0);
        ledcWrite(MOTOR_RIGHT_IN2_PIN, abs(speed));
        Serial.println("[Right Motor] Reverse - Speed: " + String(abs(speed)) + "/255");
    } else {
        ledcWrite(MOTOR_RIGHT_IN1_PIN, 0);
        ledcWrite(MOTOR_RIGHT_IN2_PIN, 0);
        Serial.println("[Right Motor] Stopped");
    }
}

// Set BOTH motors to same speed (tank drive straight)
void setMotorsSameSpeed(int speed) {
    setLeftMotorSpeed(speed);
    setRightMotorSpeed(speed);
}

// Stop LEFT motor with brake
void leftMotorBrake() {
    ledcWrite(MOTOR_LEFT_IN1_PIN, 255);
    ledcWrite(MOTOR_LEFT_IN2_PIN, 255);
    currentLeftMotorSpeed = 0;
    Serial.println("[Left Motor] Brake applied");
}

// Stop RIGHT motor with brake
void rightMotorBrake() {
    ledcWrite(MOTOR_RIGHT_IN1_PIN, 255);
    ledcWrite(MOTOR_RIGHT_IN2_PIN, 255);
    currentRightMotorSpeed = 0;
    Serial.println("[Right Motor] Brake applied");
}

// Stop BOTH motors with brake
void motorsBrake() {
    leftMotorBrake();
    rightMotorBrake();
}

// Stop LEFT motor with coast
void leftMotorCoast() {
    ledcWrite(MOTOR_LEFT_IN1_PIN, 0);
    ledcWrite(MOTOR_LEFT_IN2_PIN, 0);
    currentLeftMotorSpeed = 0;
    Serial.println("[Left Motor] Coast");
}

// Stop RIGHT motor with coast
void rightMotorCoast() {
    ledcWrite(MOTOR_RIGHT_IN1_PIN, 0);
    ledcWrite(MOTOR_RIGHT_IN2_PIN, 0);
    currentRightMotorSpeed = 0;
    Serial.println("[Right Motor] Coast");
}

// Stop BOTH motors with coast
void motorsCoast() {
    leftMotorCoast();
    rightMotorCoast();
}

/* ===================== TB6600 STEPPER MOTOR CONTROL ===================== */
// NOTE: Motor is ALWAYS ENABLED (ENA+ hardwired to GND)
// No enable/disable control needed - motor always has holding torque

// Calculate step interval from speed (steps per second)
void setStepperSpeed(int stepsPerSecond) {
    if (stepsPerSecond <= 0) {
        stepperSpeed = 1;
    } else if (stepsPerSecond > 800) {
        stepperSpeed = 800;  // Max speed: 800 steps/sec = 80mm/s (motor specification limit)
    } else {
        stepperSpeed = stepsPerSecond;
    }

    // Calculate interval in microseconds
    stepperStepInterval = 1000000UL / stepperSpeed;
    Serial.println("[Top Linear] Speed: " + String(stepperSpeed) + " steps/sec = " +
                   String(stepperSpeed / STEPPER_STEPS_PER_MM) + " mm/sec");
}

// Perform a single step in the specified direction - OPTIMIZED FOR SPEED
void stepperStep(bool direction) {
    // Set direction
    digitalWrite(STEPPER_DIR_PIN, direction ? HIGH : LOW);
    delayMicroseconds(2);  // Direction setup time (TB6600 needs 2.5us min)

    // Generate step pulse (optimized timing)
    digitalWrite(STEPPER_STEP_PIN, HIGH);
    delayMicroseconds(STEPPER_MIN_PULSE_WIDTH);
    digitalWrite(STEPPER_STEP_PIN, LOW);

    // Update position
    if (direction) {
        currentStepperPosition++;
    } else {
        currentStepperPosition--;
    }
}

// Move stepper to absolute position (non-blocking - initiates movement)
void stepperMoveTo(long position) {
    // Motor is ALWAYS ENABLED (ENA+ hardwired to GND) - ready to move!

    targetStepperPosition = position;

    if (targetStepperPosition != currentStepperPosition) {
        stepperMoving = true;
        Serial.println("[Top Linear] Moving from " + String(currentStepperPosition) +
                       " to " + String(targetStepperPosition) +
                       " steps (" + String(abs(targetStepperPosition - currentStepperPosition)) + " steps)");
    } else {
        Serial.println("[Top Linear] Already at target position: " + String(targetStepperPosition));
    }
}

// Move stepper relative to current position (non-blocking)
void stepperMoveRelative(long steps) {
    targetStepperPosition = currentStepperPosition + steps;
    stepperMoveTo(targetStepperPosition);
}

// Move stepper by millimeters (non-blocking)
void stepperMoveByMM(float mm) {
    long steps = (long)(mm * STEPPER_STEPS_PER_MM);
    stepperMoveRelative(steps);
}

// Stop stepper immediately
void stepperStop() {
    targetStepperPosition = currentStepperPosition;
    stepperMoving = false;
    Serial.println("[Top Linear] Stopped at position: " + String(currentStepperPosition) + " steps");
}

// Home the stepper (reset position to zero)
void stepperHome() {
    currentStepperPosition = 0;
    targetStepperPosition = 0;
    stepperMoving = false;
    Serial.println("[Top Linear] Homed - position reset to 0");
}

// Non-blocking stepper update - called in loop()
void updateStepperPosition() {
    if (!stepperMoving) return;

    unsigned long currentMicros = micros();

    // Check if enough time has passed for the next step
    if (currentMicros - lastStepperUpdate >= stepperStepInterval) {
        lastStepperUpdate = currentMicros;

        if (currentStepperPosition < targetStepperPosition) {
            // Step forward
            stepperStep(true);
        } else if (currentStepperPosition > targetStepperPosition) {
            // Step backward
            stepperStep(false);
        } else {
            // Reached target
            stepperMoving = false;
            Serial.println("[Top Linear] Reached target position: " + String(currentStepperPosition) + " steps");
        }
    }
}

/* ===================== TB6600 STEPPER MOTOR 2 CONTROL ===================== */
// NOTE: Motor is ALWAYS ENABLED (ENA+ hardwired to GND)
// No enable/disable control needed - motor always has holding torque

// Calculate step interval from speed (steps per second)
void setStepper2Speed(int stepsPerSecond) {
    if (stepsPerSecond <= 0) {
        stepper2Speed = 1;
    } else if (stepsPerSecond > 800) {
        stepper2Speed = 800;  // Max speed: 800 steps/sec = 80mm/s (motor specification limit)
    } else {
        stepper2Speed = stepsPerSecond;
    }

    // Calculate interval in microseconds
    stepper2StepInterval = 1000000UL / stepper2Speed;
    Serial.println("[Side Linear] Speed: " + String(stepper2Speed) + " steps/sec = " +
                   String(stepper2Speed / STEPPER_STEPS_PER_MM) + " mm/sec");
}

// Perform a single step in the specified direction - OPTIMIZED FOR SPEED
void stepper2Step(bool direction) {
    // Set direction
    digitalWrite(STEPPER2_DIR_PIN, direction ? HIGH : LOW);
    delayMicroseconds(2);  // Direction setup time (TB6600 needs 2.5us min)

    // Generate step pulse (optimized timing)
    digitalWrite(STEPPER2_STEP_PIN, HIGH);
    delayMicroseconds(STEPPER_MIN_PULSE_WIDTH);
    digitalWrite(STEPPER2_STEP_PIN, LOW);

    // Update position
    if (direction) {
        currentStepper2Position++;
    } else {
        currentStepper2Position--;
    }
}

// Move stepper to absolute position (non-blocking - initiates movement)
void stepper2MoveTo(long position) {
    // Motor is ALWAYS ENABLED (ENA+ hardwired to GND) - ready to move!

    targetStepper2Position = position;

    if (targetStepper2Position != currentStepper2Position) {
        stepper2Moving = true;
        Serial.println("[Side Linear] Moving from " + String(currentStepper2Position) +
                       " to " + String(targetStepper2Position) +
                       " steps (" + String(abs(targetStepper2Position - currentStepper2Position)) + " steps)");
    } else {
        Serial.println("[Side Linear] Already at target position: " + String(targetStepper2Position));
    }
}

// Move stepper relative to current position (non-blocking)
void stepper2MoveRelative(long steps) {
    targetStepper2Position = currentStepper2Position + steps;
    stepper2MoveTo(targetStepper2Position);
}

// Move stepper by millimeters (non-blocking)
void stepper2MoveByMM(float mm) {
    long steps = (long)(mm * STEPPER_STEPS_PER_MM);
    stepper2MoveRelative(steps);
}

// Stop stepper immediately
void stepper2Stop() {
    targetStepper2Position = currentStepper2Position;
    stepper2Moving = false;
    Serial.println("[Side Linear] Stopped at position: " + String(currentStepper2Position) + " steps");
}

// Home the stepper (reset position to zero)
void stepper2Home() {
    currentStepper2Position = 0;
    targetStepper2Position = 0;
    stepper2Moving = false;
    Serial.println("[Side Linear] Homed - position reset to 0");
}

// Non-blocking stepper update - called in loop()
void updateStepper2Position() {
    if (!stepper2Moving) return;

    unsigned long currentMicros = micros();

    // Check if enough time has passed for the next step
    if (currentMicros - lastStepper2Update >= stepper2StepInterval) {
        lastStepper2Update = currentMicros;

        if (currentStepper2Position < targetStepper2Position) {
            // Step forward
            stepper2Step(true);
        } else if (currentStepper2Position > targetStepper2Position) {
            // Step backward
            stepper2Step(false);
        } else {
            // Reached target
            stepper2Moving = false;
            Serial.println("[Side Linear] Reached target position: " + String(currentStepper2Position) + " steps");
        }
    }
}

/* ===================== RGB LED STRIP CONTROL ===================== */

// Set RGB color for entire strip (0-255 for each channel)
void setRGBColor(int red, int green, int blue) {
    currentRed = constrain(red, 0, 255);
    currentGreen = constrain(green, 0, 255);
    currentBlue = constrain(blue, 0, 255);

    // Set all LEDs to the same color
    uint32_t color = strip.Color(currentRed, currentGreen, currentBlue);
    for (int i = 0; i < RGB_NUM_LEDS; i++) {
        strip.setPixelColor(i, color);
    }
    strip.show();  // Update the strip

    Serial.println("[WS2812B] Color set - R:" + String(currentRed) +
                   " G:" + String(currentGreen) +
                   " B:" + String(currentBlue));
}

// Preset colors
void rgbWhite() {
    setRGBColor(255, 255, 255);
    Serial.println("[WS2812B] WHITE");
}

void rgbBlue() {
    setRGBColor(0, 0, 255);
    Serial.println("[WS2812B] BLUE");
}

void rgbGreen() {
    setRGBColor(0, 255, 0);
    Serial.println("[WS2812B] GREEN");
}

void rgbViolet() {
    setRGBColor(238, 130, 238);  // Violet color
    Serial.println("[WS2812B] VIOLET");
}

void rgbOff() {
    setRGBColor(0, 0, 0);
    Serial.println("[WS2812B] OFF (all LEDs off)");
}

/* ===================== COIN SLOT INTERRUPT HANDLER ===================== */
void IRAM_ATTR handleCoinPulse() {
    // Only accept pulses when payment is enabled (on payment page)
    if (!paymentEnabled) {
        return;
    }

    unsigned long currentTime = millis();

    // Stabilization delay: ignore pulses for first few seconds after relay turns on
    if (currentTime - paymentEnableTime < PAYMENT_STABILIZATION_DELAY) {
        return;
    }

    // Debounce: ignore if less than COIN_PULSE_DEBOUNCE_TIME has passed
    if (currentTime - lastCoinPulseTime > COIN_PULSE_DEBOUNCE_TIME) {
        lastCoinPulseTime = currentTime;
        currentCoinPulses++;
    }
}

/* ===================== BILL ACCEPTOR INTERRUPT HANDLER ===================== */
void IRAM_ATTR handleBillPulse() {
    // Only accept pulses when payment is enabled (on payment page)
    if (!paymentEnabled) {
        return;
    }

    unsigned long currentTime = millis();

    // Stabilization delay: ignore pulses for first few seconds after relay turns on
    if (currentTime - paymentEnableTime < PAYMENT_STABILIZATION_DELAY) {
        return;
    }

    // Debounce: ignore if less than BILL_PULSE_DEBOUNCE_TIME has passed
    if (currentTime - lastBillPulseTime > BILL_PULSE_DEBOUNCE_TIME) {
        lastBillPulseTime = currentTime;
        currentBillPulses++;
    }
}

/* ===================== SETUP ===================== */
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n\n=================================");
    Serial.println("  Smart Shoe Care Machine v2.0");
    Serial.println("  WebSocket Edition");
    Serial.println("=================================\n");

    prefs.begin("sscm", false);

    // Initialize DHT22 sensor
    dht.begin();
    Serial.println("DHT22 Sensor initialized on GPIO " + String(DHT_PIN));
    Serial.println("Reading temperature and humidity every 2 seconds\n");

    // Initialize JSN-SR20-Y1 ultrasonic sensors
    pinMode(ATOMIZER_TRIG_PIN, OUTPUT);
    pinMode(ATOMIZER_ECHO_PIN, INPUT);
    digitalWrite(ATOMIZER_TRIG_PIN, LOW);
    
    pinMode(FOAM_TRIG_PIN, OUTPUT);
    pinMode(FOAM_ECHO_PIN, INPUT);
    digitalWrite(FOAM_TRIG_PIN, LOW);
    
    Serial.println("JSN-SR20-Y1 Ultrasonic Sensors initialized:");
    Serial.println("  Sensor 1 - Atomizer Level:");
    Serial.println("    TRIG Pin: GPIO " + String(ATOMIZER_TRIG_PIN));
    Serial.println("    ECHO Pin: GPIO " + String(ATOMIZER_ECHO_PIN));
    Serial.println("  Sensor 2 - Foam Level:");
    Serial.println("    TRIG Pin: GPIO " + String(FOAM_TRIG_PIN));
    Serial.println("    ECHO Pin: GPIO " + String(FOAM_ECHO_PIN));
    Serial.println("  Range: 2cm - 500cm each");
    Serial.println("  Reading distance every 5 seconds\n");

    // Initialize servo motors (Tower Pro MG995) - Dual servos
    servoLeft.attach(SERVO_LEFT_PIN);
    servoRight.attach(SERVO_RIGHT_PIN);

    servoLeft.write(0);    // Left starts at 0 degrees
    servoRight.write(180); // Right starts at 180 degrees (mirrored)

    currentLeftPosition = 0;
    currentRightPosition = 180;
    targetLeftPosition = 0;
    targetRightPosition = 180;

    Serial.println("Tower Pro MG995 Servo Motors initialized:");
    Serial.println("  Left Servo  (GPIO " + String(SERVO_LEFT_PIN) + "): Starting at 0° (moves 0° → 180°)");
    Serial.println("  Right Servo (GPIO " + String(SERVO_RIGHT_PIN) + "): Starting at 180° (moves 180° → 0°)");
    Serial.println("  Smooth slow movement (non-blocking)\n");

    // Initialize DRV8871 DC Motor Drivers (Dual Motors) with PWM
    ledcAttach(MOTOR_LEFT_IN1_PIN, MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);
    ledcAttach(MOTOR_LEFT_IN2_PIN, MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);
    ledcAttach(MOTOR_RIGHT_IN1_PIN, MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);
    ledcAttach(MOTOR_RIGHT_IN2_PIN, MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);

    // Start with both motors stopped (coast) - SAFETY: Motors will NOT run automatically
    motorsCoast();

    Serial.println("DRV8871 DC Motor Drivers initialized (Dual Motors):");
    Serial.println("  Left Motor:");
    Serial.println("    IN1 Pin: GPIO " + String(MOTOR_LEFT_IN1_PIN));
    Serial.println("    IN2 Pin: GPIO " + String(MOTOR_LEFT_IN2_PIN));
    Serial.println("  Right Motor:");
    Serial.println("    IN1 Pin: GPIO " + String(MOTOR_RIGHT_IN1_PIN));
    Serial.println("    IN2 Pin: GPIO " + String(MOTOR_RIGHT_IN2_PIN));
    Serial.println("  PWM Frequency: " + String(MOTOR_PWM_FREQ) + " Hz");
    Serial.println("  Speed Range: -255 (full reverse) to 255 (full forward)");
    Serial.println("  Both motors stopped - ONLY run when commanded\n");

    // Initialize TB6600 Stepper Motor Driver (NEMA11 Linear Stepper)
    pinMode(STEPPER_STEP_PIN, OUTPUT);
    pinMode(STEPPER_DIR_PIN, OUTPUT);
    digitalWrite(STEPPER_STEP_PIN, LOW);
    digitalWrite(STEPPER_DIR_PIN, LOW);
    // ENA+ hardwired to GND - motor ALWAYS ENABLED (no pin control needed)

    // Set initial speed
    setStepperSpeed(800);  // 800 steps/second default

    Serial.println("TOP LINEAR STEPPER initialized (TB6600 + NEMA11):");
    Serial.println("  STEP Pin:   GPIO " + String(STEPPER_STEP_PIN) + " (PUL+/PUL-)");
    Serial.println("  DIR Pin:    GPIO " + String(STEPPER_DIR_PIN) + " (DIR+/DIR-)");
    Serial.println("  ENABLE:     ENA+ hardwired to GND (ALWAYS ENABLED)");
    Serial.println("  Microsteps: 1/" + String(STEPPER_MICROSTEPS) + " (FULL STEP - fastest)");
    Serial.println("  Steps/Rev: " + String(STEPPER_STEPS_PER_REV * STEPPER_MICROSTEPS) + " steps");
    Serial.println("  Steps/mm:  " + String(STEPPER_STEPS_PER_MM));
    Serial.println("  Default Speed: " + String(stepperSpeed) + " steps/sec (80mm/s)");
    Serial.println("  Current Position: " + String(currentStepperPosition) + " steps");
    Serial.println("  Motor ALWAYS ENABLED - Ready to move!\n");

    // Initialize Side Linear Stepper (Double)
    pinMode(STEPPER2_STEP_PIN, OUTPUT);
    pinMode(STEPPER2_DIR_PIN, OUTPUT);
    digitalWrite(STEPPER2_STEP_PIN, LOW);
    digitalWrite(STEPPER2_DIR_PIN, LOW);
    // ENA+ hardwired to GND - motor ALWAYS ENABLED (no pin control needed)

    // Set initial speed
    setStepper2Speed(800);  // 800 steps/second default

    Serial.println("SIDE LINEAR STEPPER (DOUBLE) initialized (TB6600 + NEMA11):");
    Serial.println("  STEP Pin:   GPIO " + String(STEPPER2_STEP_PIN) + " (PUL+/PUL-)");
    Serial.println("  DIR Pin:    GPIO " + String(STEPPER2_DIR_PIN) + " (DIR+/DIR-)");
    Serial.println("  ENABLE:     ENA+ hardwired to GND (ALWAYS ENABLED)");
    Serial.println("  Microsteps: 1/" + String(STEPPER_MICROSTEPS) + " (FULL STEP - fastest)");
    Serial.println("  Steps/Rev: " + String(STEPPER_STEPS_PER_REV * STEPPER_MICROSTEPS) + " steps");
    Serial.println("  Steps/mm:  " + String(STEPPER_STEPS_PER_MM));
    Serial.println("  Default Speed: " + String(stepper2Speed) + " steps/sec (80mm/s)");
    Serial.println("  Current Position: " + String(currentStepper2Position) + " steps");
    Serial.println("  Motor ALWAYS ENABLED - Ready to move!\n");

    // Initialize WS2812B LED Strip (NeoPixel)
    strip.begin();           // Initialize NeoPixel strip object
    strip.setBrightness(100); // Set moderate brightness to reduce power draw (0-255)
    strip.show();            // Initialize all pixels to 'off'

    Serial.println("WS2812B LED Strip initialized (NeoPixel):");
    Serial.println("  Data Pin:    GPIO " + String(RGB_DATA_PIN));
    Serial.println("  LED Count:   " + String(RGB_NUM_LEDS) + " LEDs");
    Serial.println("  Type:        WS2812B (GRB, 800KHz)");
    Serial.println("  Brightness:  100 (reduced to prevent overload)");
    Serial.println("  Initial State: OFF (all LEDs black)\n");

    // Initialize 8-channel relay
    pinMode(RELAY_1_PIN, OUTPUT);
    pinMode(RELAY_2_PIN, OUTPUT);
    pinMode(RELAY_3_PIN, OUTPUT);
    pinMode(RELAY_4_PIN, OUTPUT);
    pinMode(RELAY_5_PIN, OUTPUT);
    pinMode(RELAY_6_PIN, OUTPUT);
    pinMode(RELAY_7_PIN, OUTPUT);
    pinMode(RELAY_8_PIN, OUTPUT);

    // Turn all relays OFF initially
    allRelaysOff();
    Serial.println("8-Channel Relay initialized:");
    Serial.println("  CH1 (GPIO 3):  Bill + Coin (auto ON when payment enabled)");
    Serial.println("  CH2 (GPIO 8):  Solenoid Lock");
    Serial.println("  CH3 (GPIO 18): Centrifugal Blower Fan");
    Serial.println("  CH4 (GPIO 17): PTC Ceramic Heater");
    Serial.println("  CH5 (GPIO 16): Bottom Exhaust");
    Serial.println("  CH6 (GPIO 15): Diaphragm Pump");
    Serial.println("  CH7 (GPIO 7):  Ultrasonic Mist Maker");
    Serial.println("  CH8 (GPIO 6):  UVC Light");
    Serial.println("All relays set to OFF");
    Serial.println("NOTE: CH1 will auto-turn ON when payment system is enabled\n");

    // Initialize coin slot pin
    pinMode(COIN_SLOT_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(COIN_SLOT_PIN), handleCoinPulse, FALLING);
    Serial.println("Coin slot initialized on GPIO 5");
    Serial.println("Supported coin denominations: 1, 5, 10, 20 pesos");

    // Initialize bill acceptor pins
    pinMode(BILL_PULSE_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(BILL_PULSE_PIN), handleBillPulse, FALLING);
    Serial.println("Bill acceptor initialized on GPIO 4");
    Serial.println("Supported bill denominations: 20, 50, 100 pesos");
    Serial.println("Bill pulse ratio: 1 pulse = 10 pesos");
    Serial.println("\n*** Payment system will be enabled when user enters payment page ***\n");

    // Load totals from preferences
    totalCoinPesos = prefs.getUInt("totalCoinPesos", 0);
    totalBillPesos = prefs.getUInt("totalBillPesos", 0);
    totalPesos = totalCoinPesos + totalBillPesos;
    Serial.println("Total coins collected: " + String(totalCoinPesos) + " PHP");
    Serial.println("Total bills collected: " + String(totalBillPesos) + " PHP");
    Serial.println("Grand total: " + String(totalPesos) + " PHP\n");

    // Initialize device ID (persistent)
    deviceId = prefs.getString("deviceId", "");
    if (deviceId.length() == 0) {
        deviceId = generateDeviceId();
        prefs.putString("deviceId", deviceId);
        Serial.println("Generated new Device ID: " + deviceId);
    } else {
        Serial.println("Loaded existing Device ID: " + deviceId);
    }

    // Debug: Print chip ID
    uint64_t chipid = ESP.getEfuseMac();
    Serial.printf("Chip ID: %04X%08X\n\n", (uint16_t)(chipid>>32), (uint32_t)chipid);

    // Check if device is paired
    isPaired = prefs.getBool("paired", false);

    // Generate pairing code if not paired
    if (!isPaired) {
        pairingCode = generatePairingCode();
        Serial.println("=== Pairing Information ===");
        Serial.println("Device ID: " + deviceId);
        Serial.println("Pairing Code: " + pairingCode);
        Serial.println("===========================\n");
    } else {
        Serial.println("Device is already paired\n");
    }

    connectWiFi();
}

/* ===================== LOOP ===================== */
void loop() {
    // NO DELAY - stepper needs maximum speed!

    // Handle WebSocket - MUST call loop() even when not connected for handshake
    webSocket.loop();

    // Update servo positions for smooth non-blocking movement (dual servos)
    updateServoPositions();

    // Update stepper motor position for non-blocking movement
    updateStepperPosition();
    updateStepper2Position();

    // Handle coin insertion with pulse counting and timeout
    if (currentCoinPulses > 0) {
        unsigned long timeSinceLastPulse = millis() - lastCoinPulseTime;

        // Check if coin insertion is complete (no new pulse for COIN_COMPLETE_TIMEOUT ms)
        if (timeSinceLastPulse >= COIN_COMPLETE_TIMEOUT) {
            // Coin insertion complete - process the value
            unsigned int coinValue = currentCoinPulses;
            totalCoinPesos += coinValue;
            totalPesos = totalCoinPesos + totalBillPesos;

            // Save totals to persistent storage
            prefs.putUInt("totalCoinPesos", totalCoinPesos);

            Serial.println("\n=== COIN INSERTED ===");
            Serial.println("Coin Value: " + String(coinValue) + " PHP");
            Serial.println("Pulses Counted: " + String(currentCoinPulses));
            Serial.println("Total Coins: " + String(totalCoinPesos) + " PHP");
            Serial.println("Grand Total: " + String(totalPesos) + " PHP");

            // Warn if unexpected denomination (but still accept it)
            if (coinValue != 1 && coinValue != 5 && coinValue != 10 && coinValue != 20) {
                Serial.println("[WARNING] Unexpected coin value: " + String(coinValue) + " PHP");
                Serial.println("[WARNING] Expected: 1, 5, 10, or 20 pesos");
                Serial.println("[WARNING] Coin was still counted");
            }
            Serial.println("=====================\n");

            // Send coin insertion event via WebSocket (only if paired)
            if (isPaired && wsConnected) {
                String coinMsg = "{\"type\":\"coin-inserted\",\"deviceId\":\"" + deviceId + "\",\"coinValue\":" + String(coinValue) + ",\"totalPesos\":" + String(totalPesos) + "}";
                webSocket.sendTXT(coinMsg);
                Serial.println("[WebSocket] Coin: " + String(coinValue) + " PHP sent");
            }

            // Reset pulse counter for next coin
            currentCoinPulses = 0;
        }
    }

    // Handle bill insertion with pulse counting and timeout
    if (currentBillPulses > 0) {
        unsigned long timeSinceLastPulse = millis() - lastBillPulseTime;

        // Check if bill insertion is complete (no new pulse for BILL_COMPLETE_TIMEOUT ms)
        if (timeSinceLastPulse >= BILL_COMPLETE_TIMEOUT) {
            // Bill insertion complete - calculate value (1 pulse = 10 pesos)
            unsigned int billValue = currentBillPulses * 10;

            // Accept all bills - process and count
            totalBillPesos += billValue;
            totalPesos = totalCoinPesos + totalBillPesos;

            // Save totals to persistent storage
            prefs.putUInt("totalBillPesos", totalBillPesos);

            Serial.println("\n=== BILL INSERTED ===");
            Serial.println("Bill Value: " + String(billValue) + " PHP");
            Serial.println("Pulses Counted: " + String(currentBillPulses) + " (x10)");
            Serial.println("Total Bills: " + String(totalBillPesos) + " PHP");
            Serial.println("Grand Total: " + String(totalPesos) + " PHP");

            // Warn if unexpected denomination (but still accept it)
            if (billValue != 20 && billValue != 50 && billValue != 100) {
                Serial.println("[WARNING] Unexpected bill value: " + String(billValue) + " PHP");
                Serial.println("[WARNING] Expected: 20, 50, or 100 pesos");
                Serial.println("[WARNING] Bill was still counted");
            }
            Serial.println("=====================\n");

            // Send bill insertion event via WebSocket (only if paired)
            if (isPaired && wsConnected) {
                String billMsg = "{\"type\":\"bill-inserted\",\"deviceId\":\"" + deviceId + "\",\"billValue\":" + String(billValue) + ",\"totalPesos\":" + String(totalPesos) + "}";
                webSocket.sendTXT(billMsg);
                Serial.println("[WebSocket] Bill: " + String(billValue) + " PHP sent");
            }

            // Reset pulse counter for next bill
            currentBillPulses = 0;
        }
    }

    // Serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd == "RESET_WIFI") {
            Serial.println("=== Clearing WiFi Credentials ===");
            prefs.remove("ssid");
            prefs.remove("pass");
            Serial.println("Restarting...");
            delay(1000);
            ESP.restart();
        }
        else if (cmd == "RESET_PAIRING") {
            Serial.println("=== Clearing Pairing Status ===");
            prefs.putBool("paired", false);
            isPaired = false;
            pairingCode = generatePairingCode();
            Serial.println("New Pairing Code: " + pairingCode);
            Serial.println("Restarting...");
            delay(1000);
            ESP.restart();
        }
        else if (cmd == "RESET_MONEY") {
            Serial.println("=== Resetting Money Counters ===");
            totalCoinPesos = 0;
            totalBillPesos = 0;
            totalPesos = 0;
            currentCoinPulses = 0;
            currentBillPulses = 0;
            prefs.putUInt("totalCoinPesos", 0);
            prefs.putUInt("totalBillPesos", 0);
            Serial.println("All counters reset to 0 PHP");
            Serial.println("================================\n");
        }
        else if (cmd == "STATUS") {
            Serial.println("\n=== Device Status ===");
            Serial.println("Device ID: " + deviceId);
            Serial.println("WiFi Connected: " + String(wifiConnected ? "Yes" : "No"));
            if (wifiConnected) {
                Serial.println("IP Address: " + WiFi.localIP().toString());
            }
            Serial.println("WebSocket: " + String(wsConnected ? "Connected" : "Disconnected"));
            Serial.println("Paired: " + String(isPaired ? "Yes" : "No"));
            if (!isPaired) {
                Serial.println("Pairing Code: " + pairingCode);
            }
            Serial.println("--- Payment Status ---");
            Serial.println("Total Coins: " + String(totalCoinPesos) + " PHP");
            Serial.println("Total Bills: " + String(totalBillPesos) + " PHP");
            Serial.println("Grand Total: " + String(totalPesos) + " PHP");
            Serial.println("Current Coin Pulses: " + String(currentCoinPulses));
            Serial.println("Current Bill Pulses: " + String(currentBillPulses));
            Serial.println("--- Relay Status ---");
            Serial.println("Relay 1 (Bill Acceptor): " + String(relay1State ? "ON" : "OFF"));
            Serial.println("Relay 2 (Coin Slot): " + String(relay2State ? "ON" : "OFF"));
            Serial.println("Relay 3 (Blower Fan): " + String(relay3State ? "ON" : "OFF"));
            Serial.println("Relay 4 (PTC Heater): " + String(relay4State ? "ON" : "OFF"));
            Serial.println("Relay 5 (Bottom Exhaust): " + String(relay5State ? "ON" : "OFF"));
            Serial.println("Relay 6 (Diaphragm Pump): " + String(relay6State ? "ON" : "OFF"));
            Serial.println("Relay 7 (Mist Maker): " + String(relay7State ? "ON" : "OFF"));
            Serial.println("Relay 8 (UVC Light): " + String(relay8State ? "ON" : "OFF"));
            Serial.println("--- DHT22 Sensor ---");
            Serial.println("Temperature: " + String(currentTemperature) + "°C");
            Serial.println("Humidity: " + String(currentHumidity) + "%");
            Serial.println("--- Ultrasonic Sensors ---");
            Serial.println("Atomizer Level: " + String(currentAtomizerDistance) + " cm");
            Serial.println("Foam Level: " + String(currentFoamDistance) + " cm");
            Serial.println("--- Servo Motors (Dual) ---");
            Serial.println("Left Servo:");
            Serial.println("  Current: " + String(currentLeftPosition) + "°");
            Serial.println("  Target:  " + String(targetLeftPosition) + "°");
            Serial.println("Right Servo:");
            Serial.println("  Current: " + String(currentRightPosition) + "°");
            Serial.println("  Target:  " + String(targetRightPosition) + "°");
            Serial.println("Moving: " + String(servosMoving ? "Yes" : "No"));
            Serial.println("--- DC Motors (DRV8871 Dual) ---");
            Serial.println("Left Motor:");
            Serial.println("  Speed: " + String(currentLeftMotorSpeed) + "/255");
            if (currentLeftMotorSpeed > 0) {
                Serial.println("  Direction: Forward");
            } else if (currentLeftMotorSpeed < 0) {
                Serial.println("  Direction: Reverse");
            } else {
                Serial.println("  Direction: Stopped");
            }
            Serial.println("Right Motor:");
            Serial.println("  Speed: " + String(currentRightMotorSpeed) + "/255");
            if (currentRightMotorSpeed > 0) {
                Serial.println("  Direction: Forward");
            } else if (currentRightMotorSpeed < 0) {
                Serial.println("  Direction: Reverse");
            } else {
                Serial.println("  Direction: Stopped");
            }
            Serial.println("--- Top Linear Stepper ---");
            Serial.println("Enabled: ALWAYS (ENA+ hardwired to GND - holding torque ON)");
            Serial.println("Current Position: " + String(currentStepperPosition) + " steps (" + String(currentStepperPosition / 10.0) + "mm)");
            Serial.println("Target Position:  " + String(targetStepperPosition) + " steps (" + String(targetStepperPosition / 10.0) + "mm)");
            Serial.println("Speed: " + String(stepperSpeed) + " steps/sec (" + String(stepperSpeed / 10) + "mm/s)");
            Serial.println("Moving: " + String(stepperMoving ? "Yes" : "No"));
            if (stepperMoving) {
                long stepsRemaining = abs(targetStepperPosition - currentStepperPosition);
                Serial.println("Steps Remaining: " + String(stepsRemaining));
            }
            Serial.println("--- Side Linear Stepper (Double) ---");
            Serial.println("Enabled: ALWAYS (ENA+ hardwired to GND - holding torque ON)");
            Serial.println("Current Position: " + String(currentStepper2Position) + " steps (" + String(currentStepper2Position / 10.0) + "mm)");
            Serial.println("Target Position:  " + String(targetStepper2Position) + " steps (" + String(targetStepper2Position / 10.0) + "mm)");
            Serial.println("Speed: " + String(stepper2Speed) + " steps/sec (" + String(stepper2Speed / 10) + "mm/s)");
            Serial.println("Moving: " + String(stepper2Moving ? "Yes" : "No"));
            if (stepper2Moving) {
                long stepsRemaining = abs(targetStepper2Position - currentStepper2Position);
                Serial.println("Steps Remaining: " + String(stepsRemaining));
            }
            Serial.println("=====================\n");
        }
        else if (cmd.startsWith("RELAY")) {
            // Commands: RELAY_1_ON, RELAY_1_OFF, RELAY_ALL_OFF
            if (cmd == "RELAY_ALL_OFF") {
                allRelaysOff();
            }
            else {
                // Parse RELAY_X_ON or RELAY_X_OFF
                int firstUnderscore = cmd.indexOf('_');
                int secondUnderscore = cmd.indexOf('_', firstUnderscore + 1);

                if (firstUnderscore != -1 && secondUnderscore != -1) {
                    String channelStr = cmd.substring(firstUnderscore + 1, secondUnderscore);
                    String action = cmd.substring(secondUnderscore + 1);

                    int channel = channelStr.toInt();
                    if (channel >= 1 && channel <= 8) {
                        if (action == "ON") {
                            setRelay(channel, true);
                        } else if (action == "OFF") {
                            setRelay(channel, false);
                        } else {
                            Serial.println("[ERROR] Unknown action: " + action);
                            Serial.println("Use: RELAY_1_ON, RELAY_1_OFF, or RELAY_ALL_OFF");
                        }
                    } else {
                        Serial.println("[ERROR] Invalid channel: " + channelStr);
                        Serial.println("Valid channels: 1-8");
                    }
                } else {
                    Serial.println("[ERROR] Invalid relay command format");
                    Serial.println("Use: RELAY_1_ON, RELAY_1_OFF, or RELAY_ALL_OFF");
                }
            }
        }
        else if (cmd == "SERVO_DEMO") {
            Serial.println("=== Running Dual Servo Demo ===");
            Serial.println("Left:  0° → 90° → 180° (smooth sequence)");
            Serial.println("Right: 180° → 90° → 0° (mirrored)");
            Serial.println("Watch the smooth slow mirrored movement!");

            // Move to 0 first (left=0°, right=180°)
            setServoPositions(0);
            // NO DELAY - servos move smoothly via updateServoPositions() in loop()

            // Move to 90 degrees (left=90°, right=90°)
            setServoPositions(90);
            // NO DELAY - servos move smoothly via updateServoPositions() in loop()

            // Move to 180 degrees (left=180°, right=0°)
            setServoPositions(180);

            Serial.println("Demo sequence started! Servos moving in real-time");
            Serial.println("Movement is fully non-blocking - all processes continue running");
            Serial.println("Use SERVO_0 to return to start position");
            Serial.println("==========================\n");
        }
        else if (cmd.startsWith("SERVO_")) {
            // Parse SERVO_XXX where XXX is angle for LEFT servo (0-180)
            // Right servo will mirror automatically
            String angleStr = cmd.substring(6);
            int angle = angleStr.toInt();

            if (angle >= 0 && angle <= 180) {
                setServoPositions(angle);
            } else {
                Serial.println("[ERROR] Invalid servo angle: " + angleStr);
                Serial.println("Valid range: 0-180 degrees");
                Serial.println("Examples: SERVO_0 (L:0°,R:180°), SERVO_90 (L:90°,R:90°), SERVO_180 (L:180°,R:0°)");
            }
        }
        else if (cmd.startsWith("MOTOR_LEFT_")) {
            // Left motor commands
            String subCmd = cmd.substring(11);  // Remove "MOTOR_LEFT_"

            if (subCmd == "BRAKE") {
                leftMotorBrake();
            } else if (subCmd == "COAST" || subCmd == "STOP") {
                leftMotorCoast();
            } else {
                int speed = subCmd.toInt();
                if (speed >= -255 && speed <= 255) {
                    setLeftMotorSpeed(speed);
                } else {
                    Serial.println("[ERROR] Invalid speed: " + subCmd);
                }
            }
        }
        else if (cmd.startsWith("MOTOR_RIGHT_")) {
            // Right motor commands
            String subCmd = cmd.substring(12);  // Remove "MOTOR_RIGHT_"

            if (subCmd == "BRAKE") {
                rightMotorBrake();
            } else if (subCmd == "COAST" || subCmd == "STOP") {
                rightMotorCoast();
            } else {
                int speed = subCmd.toInt();
                if (speed >= -255 && speed <= 255) {
                    setRightMotorSpeed(speed);
                } else {
                    Serial.println("[ERROR] Invalid speed: " + subCmd);
                }
            }
        }
        else if (cmd.startsWith("MOTOR_")) {
            // Both motors same speed commands
            String subCmd = cmd.substring(6);  // Remove "MOTOR_"

            if (subCmd == "BRAKE") {
                motorsBrake();
            } else if (subCmd == "COAST" || subCmd == "STOP") {
                motorsCoast();
            } else {
                int speed = subCmd.toInt();
                if (speed >= -255 && speed <= 255) {
                    setMotorsSameSpeed(speed);
                } else {
                    Serial.println("[ERROR] Invalid motor speed: " + subCmd);
                    Serial.println("Valid range: -255 (full reverse) to 255 (full forward)");
                    Serial.println("Examples:");
                    Serial.println("  MOTOR_255        - Both motors full forward");
                    Serial.println("  MOTOR_LEFT_255   - Left motor full forward");
                    Serial.println("  MOTOR_RIGHT_255  - Right motor full forward");
                    Serial.println("  MOTOR_LEFT_-128  - Left motor half reverse");
                    Serial.println("  MOTOR_BRAKE      - Both motors brake");
                    Serial.println("  MOTOR_LEFT_BRAKE - Left motor brake");
                    Serial.println("  MOTOR_COAST      - Both motors coast");
                }
            }
        }
        else if (cmd.startsWith("STEPPER_")) {
            // Stepper motor commands
            String subCmd = cmd.substring(8);  // Remove "STEPPER_"

            if (subCmd == "ENABLE" || subCmd == "DISABLE") {
                Serial.println("[Top Linear] Motor is ALWAYS ENABLED (ENA+ hardwired to GND)");
                Serial.println("[Top Linear] No enable/disable control available - motor always has holding torque");
                Serial.println("[Top Linear] Ready to move! Use STEPPER_MOVE_XXX or STEPPER_MM_XXX commands");
            }
            else if (subCmd == "TEST_MANUAL") {
                // Manual test: step motor 10 times slowly
                Serial.println("[Top Linear] Manual Test - stepping 10 times rapidly (non-blocking)");
                Serial.println("[Top Linear] Watch for motor movement or listen for clicking sound from driver");
                for (int i = 0; i < 10; i++) {
                    // Set direction
                    digitalWrite(STEPPER_DIR_PIN, HIGH);
                    delayMicroseconds(5);

                    // Generate step pulse
                    digitalWrite(STEPPER_STEP_PIN, HIGH);
                    delayMicroseconds(20);
                    digitalWrite(STEPPER_STEP_PIN, LOW);
                    delayMicroseconds(20);

                    Serial.println("[Top Linear] Step " + String(i + 1) + "/10");
                    // NO DELAY - rapid test to verify driver response
                }
                Serial.println("[Top Linear] Manual test complete (rapid fire)");
                Serial.println("[Top Linear] Did you hear clicking? Did motor move?");
            }
            else if (subCmd == "TEST_PINS") {
                // Test if pins are actually outputting
                Serial.println("[Top Linear] Pin Output Test (rapid pulses - non-blocking)");
                Serial.println("[Top Linear] Blinking STEP pin (GPIO " + String(STEPPER_STEP_PIN) + ") 10 times");
                Serial.println("[Top Linear] Measure with oscilloscope or logic analyzer");

                for (int i = 0; i < 10; i++) {
                    digitalWrite(STEPPER_STEP_PIN, HIGH);
                    Serial.println("[Top Linear] STEP pin HIGH (3.3V)");
                    delayMicroseconds(100);  // 100us pulse - visible on scope
                    digitalWrite(STEPPER_STEP_PIN, LOW);
                    Serial.println("[Top Linear] STEP pin LOW (0V)");
                    delayMicroseconds(100);  // 100us gap
                }

                Serial.println("[Top Linear] Pin test complete (10 rapid pulses sent)");
                Serial.println("[Top Linear] Use oscilloscope to verify - too fast for multimeter");
            }
            else if (subCmd == "TEST_PULSE") {
                // Rapid pulse test - SHORT non-blocking version
                Serial.println("[Top Linear] RAPID PULSE TEST (non-blocking)");
                Serial.println("[Top Linear] Sending 100 rapid pulses at 1000 pulses/sec");
                Serial.println("[Top Linear] TB6600 should click/buzz!");

                // Send 100 pulses rapidly (~100ms total - non-blocking)
                int pulseCount = 100;
                for (int i = 0; i < pulseCount; i++) {
                    digitalWrite(STEPPER_STEP_PIN, HIGH);
                    delayMicroseconds(20);
                    digitalWrite(STEPPER_STEP_PIN, LOW);
                    delayMicroseconds(980);  // ~1000 pulses/sec
                }

                Serial.println("[Top Linear] Sent " + String(pulseCount) + " pulses in ~100ms");
                Serial.println("[Top Linear] Did TB6600 make buzzing noise? Did motor vibrate?");
            }
            else if (subCmd == "STOP") {
                stepperStop();
            }
            else if (subCmd == "HOME") {
                stepperHome();
            }
            else if (subCmd == "INFO") {
                Serial.println("\n=== STEPPER WIRING INFO ===");
                Serial.println("Current Pin Configuration:");
                Serial.println("  STEP Pin:   GPIO " + String(STEPPER_STEP_PIN) + " → TB6600 PUL+");
                Serial.println("  DIR Pin:    GPIO " + String(STEPPER_DIR_PIN) + " → TB6600 DIR+");
                Serial.println("  ENABLE:     ENA+ → GND (HARDWIRED - motor ALWAYS enabled)");
                Serial.println("  GND:        ESP32 GND → TB6600 PUL-, DIR-, ENA-");
                Serial.println("\nCurrent Pin States:");
                Serial.println("  STEP (GPIO " + String(STEPPER_STEP_PIN) + "): " + String(digitalRead(STEPPER_STEP_PIN) ? "HIGH (3.3V)" : "LOW (0V)"));
                Serial.println("  DIR (GPIO " + String(STEPPER_DIR_PIN) + "):  " + String(digitalRead(STEPPER_DIR_PIN) ? "HIGH (3.3V)" : "LOW (0V)"));
                Serial.println("\nMotor Status:");
                Serial.println("  Enabled: ALWAYS (ENA+ hardwired to GND)");
                Serial.println("  Position: " + String(currentStepperPosition) + " steps (" + String(currentStepperPosition / 10.0) + "mm)");
                Serial.println("  Speed: " + String(stepperSpeed) + " steps/sec (" + String(stepperSpeed / 10) + "mm/s)");
                Serial.println("  Moving: " + String(stepperMoving ? "YES" : "NO"));
                Serial.println("\nMotor Specifications:");
                Serial.println("  Type: NEMA11 Linear Actuator");
                Serial.println("  Step Angle: 1.8° (200 steps/rev)");
                Serial.println("  Microstepping: FULL STEP (fastest)");
                Serial.println("  Lead Screw: 20mm pitch (10 steps/mm)");
                Serial.println("  Max Speed: 800 steps/sec = 80mm/s");
                Serial.println("  Stroke Length: 480mm");
                Serial.println("\nTB6600 DIP Switch Settings:");
                Serial.println("  SW1-SW3 (Microstep): OFF-OFF-OFF (FULL STEP)");
                Serial.println("  SW4-SW6 (Current): Set for motor current");
                Serial.println("\nTB6600 Power (separate from ESP32):");
                Serial.println("  V+/VCC: 12-48V DC (recommend 24V for this motor)");
                Serial.println("  GND: Connected to power supply AND ESP32 GND");
                Serial.println("===========================\n");
            }
            else if (subCmd.startsWith("SPEED_")) {
                // STEPPER_SPEED_XXX - set speed in steps per second
                String speedStr = subCmd.substring(6);
                int speed = speedStr.toInt();
                if (speed > 0 && speed <= 800) {
                    setStepperSpeed(speed);
                } else {
                    Serial.println("[ERROR] Invalid stepper speed: " + speedStr);
                    Serial.println("Valid range: 1-800 steps/second (motor max: 80mm/s)");
                }
            }
            else if (subCmd.startsWith("MOVE_")) {
                // STEPPER_MOVE_XXX - move relative steps
                String stepsStr = subCmd.substring(5);
                long steps = stepsStr.toInt();
                stepperMoveRelative(steps);
            }
            else if (subCmd.startsWith("GOTO_")) {
                // STEPPER_GOTO_XXX - move to absolute position
                String posStr = subCmd.substring(5);
                long position = posStr.toInt();
                stepperMoveTo(position);
            }
            else if (subCmd.startsWith("MM_")) {
                // STEPPER_MM_XXX - move by millimeters (can be negative)
                String mmStr = subCmd.substring(3);
                float mm = mmStr.toFloat();
                stepperMoveByMM(mm);
            }
            else {
                Serial.println("[ERROR] Unknown stepper command: " + cmd);
                Serial.println("\n=== STEPPER MOTOR COMMANDS ===");
                Serial.println("NOTE: Motor is ALWAYS ENABLED (ENA+ hardwired to GND)");
                Serial.println("\nMovement Commands:");
                Serial.println("  STEPPER_SPEED_XXX      - Set speed (steps/sec, 1-800 max)");
                Serial.println("  STEPPER_MOVE_XXX       - Move relative steps (can be negative)");
                Serial.println("  STEPPER_GOTO_XXX       - Move to absolute position");
                Serial.println("  STEPPER_MM_XXX         - Move by millimeters (can be negative)");
                Serial.println("  STEPPER_STOP           - Stop movement immediately");
                Serial.println("  STEPPER_HOME           - Reset position to 0");
                Serial.println("\nDiagnostic Commands:");
                Serial.println("  STEPPER_TEST_MANUAL    - Manual test: step 10 times rapidly");
                Serial.println("  STEPPER_TEST_PINS      - Test pin output (oscilloscope)");
                Serial.println("  STEPPER_TEST_PULSE     - Send rapid pulses to verify driver");
                Serial.println("  STEPPER_INFO           - Show wiring and status info");
                Serial.println("\nExamples:");
                Serial.println("  STEPPER_SPEED_800      - Set to maximum speed (80mm/s)");
                Serial.println("  STEPPER_MM_480         - Move forward 480mm (full stroke)");
                Serial.println("  STEPPER_MM_-150        - Move backward 150mm");
                Serial.println("  STEPPER_MOVE_2000      - Move forward 2000 steps");
                Serial.println("  STEPPER_GOTO_0         - Return to home position");
                Serial.println("  STEPPER_STOP           - Emergency stop");
            }
        }
        else if (cmd.startsWith("STEPPER2_")) {
            // Stepper motor 2 commands
            String subCmd = cmd.substring(9);  // Remove "STEPPER2_"

            if (subCmd == "ENABLE" || subCmd == "DISABLE") {
                Serial.println("[Side Linear] Motor is ALWAYS ENABLED (ENA+ hardwired to GND)");
                Serial.println("[Side Linear] No enable/disable control available - motor always has holding torque");
                Serial.println("[Side Linear] Ready to move! Use STEPPER2_MOVE_XXX or STEPPER2_MM_XXX commands");
            }
            else if (subCmd == "STOP") {
                stepper2Stop();
            }
            else if (subCmd == "HOME") {
                stepper2Home();
            }
            else if (subCmd.startsWith("SPEED_")) {
                // STEPPER2_SPEED_XXX - set speed in steps per second
                String speedStr = subCmd.substring(6);
                int speed = speedStr.toInt();
                if (speed > 0 && speed <= 800) {
                    setStepper2Speed(speed);
                } else {
                    Serial.println("[ERROR] Invalid stepper2 speed: " + speedStr);
                    Serial.println("Valid range: 1-800 steps/second (motor max: 80mm/s)");
                }
            }
            else if (subCmd.startsWith("MOVE_")) {
                // STEPPER2_MOVE_XXX - move relative steps (can be negative)
                String stepsStr = subCmd.substring(5);
                long steps = stepsStr.toInt();
                stepper2MoveRelative(steps);
            }
            else if (subCmd.startsWith("GOTO_")) {
                // STEPPER2_GOTO_XXX - move to absolute position
                String posStr = subCmd.substring(5);
                long position = posStr.toInt();
                stepper2MoveTo(position);
            }
            else if (subCmd.startsWith("MM_")) {
                // STEPPER2_MM_XXX - move by millimeters (can be negative)
                String mmStr = subCmd.substring(3);
                float mm = mmStr.toFloat();
                stepper2MoveByMM(mm);
            }
            else {
                Serial.println("[ERROR] Unknown stepper2 command: " + cmd);
                Serial.println("\n=== STEPPER MOTOR 2 COMMANDS ===");
                Serial.println("NOTE: Motor is ALWAYS ENABLED (ENA+ hardwired to GND)");
                Serial.println("\nMovement Commands:");
                Serial.println("  STEPPER2_SPEED_XXX     - Set speed (steps/sec, 1-800 max)");
                Serial.println("  STEPPER2_MOVE_XXX      - Move relative steps (can be negative)");
                Serial.println("  STEPPER2_GOTO_XXX      - Move to absolute position");
                Serial.println("  STEPPER2_MM_XXX        - Move by millimeters (can be negative)");
                Serial.println("  STEPPER2_STOP          - Stop movement immediately");
                Serial.println("  STEPPER2_HOME          - Reset position to 0");
                Serial.println("\nExamples:");
                Serial.println("  STEPPER2_SPEED_800     - Set to maximum speed (80mm/s)");
                Serial.println("  STEPPER2_MM_480        - Move forward 480mm (full stroke)");
                Serial.println("  STEPPER2_MM_-150       - Move backward 150mm");
                Serial.println("  STEPPER2_MOVE_2000     - Move forward 2000 steps");
                Serial.println("  STEPPER2_GOTO_0        - Return to home position");
                Serial.println("  STEPPER2_STOP          - Emergency stop");
            }
        }
        else if (cmd.startsWith("RGB_")) {
            // RGB LED Strip commands
            String subCmd = cmd.substring(4);  // Remove "RGB_"

            if (subCmd == "WHITE") {
                rgbWhite();
            }
            else if (subCmd == "BLUE") {
                rgbBlue();
            }
            else if (subCmd == "GREEN") {
                rgbGreen();
            }
            else if (subCmd == "VIOLET") {
                rgbViolet();
            }
            else if (subCmd == "OFF") {
                rgbOff();
            }
            else if (subCmd.startsWith("CUSTOM_")) {
                // RGB_CUSTOM_R_G_B - set custom color (e.g., RGB_CUSTOM_255_128_64)
                String rgbStr = subCmd.substring(7); // Remove "CUSTOM_"

                // Parse R_G_B values
                int firstUnderscore = rgbStr.indexOf('_');
                int secondUnderscore = rgbStr.indexOf('_', firstUnderscore + 1);

                if (firstUnderscore > 0 && secondUnderscore > firstUnderscore) {
                    int red = rgbStr.substring(0, firstUnderscore).toInt();
                    int green = rgbStr.substring(firstUnderscore + 1, secondUnderscore).toInt();
                    int blue = rgbStr.substring(secondUnderscore + 1).toInt();
                    setRGBColor(red, green, blue);
                } else {
                    Serial.println("[ERROR] Invalid RGB custom format. Use: RGB_CUSTOM_R_G_B");
                    Serial.println("Example: RGB_CUSTOM_255_128_64");
                }
            }
            else {
                Serial.println("[ERROR] Unknown RGB command: " + cmd);
                Serial.println("\n=== RGB LED STRIP COMMANDS ===");
                Serial.println("Preset Colors:");
                Serial.println("  RGB_WHITE        - Turn on white light");
                Serial.println("  RGB_BLUE         - Turn on blue light");
                Serial.println("  RGB_GREEN        - Turn on green light");
                Serial.println("  RGB_VIOLET       - Turn on violet light");
                Serial.println("  RGB_OFF          - Turn off all lights");
                Serial.println("\nCustom Color:");
                Serial.println("  RGB_CUSTOM_R_G_B - Set custom color (0-255 each)");
                Serial.println("\nExamples:");
                Serial.println("  RGB_WHITE        - Full white");
                Serial.println("  RGB_BLUE         - Full blue");
                Serial.println("  RGB_CUSTOM_255_0_0     - Full red");
                Serial.println("  RGB_CUSTOM_255_128_0   - Orange");
                Serial.println("  RGB_OFF          - Turn off");
            }
        }
    }

    // Handle WiFi portal
    if (softAPStarted) {
        handleWiFiPortal();
    }

    /* ================= WIFI STATE MACHINE ================= */

    // Check if WiFi disconnected during runtime
    if (wifiConnected && WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected! Attempting reconnect...");
        wifiConnected = false;
        wsConnected = false;
        wifiStartTime = millis();
        lastWiFiRetry = millis();
        connectWiFi();
        return;
    }

    if (!wifiConnected && WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        softAPStarted = false;

        wifiServer.stop();
        WiFi.softAPdisconnect(true);

        Serial.println("\n=== WiFi Connected ===");
        Serial.println("IP: " + WiFi.localIP().toString());
        Serial.println("======================\n");

        // Register device with backend if not paired (HTTP - one time)
        if (!isPaired) {
            sendDeviceRegistration();
        }

        // Connect to WebSocket for real-time updates
        connectWebSocket();
    }

    /* WiFi retry logic */
    if (!wifiConnected && !softAPStarted) {
        if (millis() - lastWiFiRetry >= WIFI_RETRY_INTERVAL) {
            lastWiFiRetry = millis();

            wl_status_t status = WiFi.status();

            if (status == WL_CONNECTED) {
                return;
            }

            if (status == WL_IDLE_STATUS) {
                Serial.println("WiFi idle, starting connection...");
                WiFi.begin(
                    prefs.getString("ssid", "").c_str(),
                    prefs.getString("pass", "").c_str()
                );
            }
            else if (status == WL_DISCONNECTED) {
                Serial.println("WiFi disconnected, retrying...");
                WiFi.begin(
                    prefs.getString("ssid", "").c_str(),
                    prefs.getString("pass", "").c_str()
                );
            }

            // Timeout fallback
            if (millis() - wifiStartTime > WIFI_TIMEOUT) {
                Serial.println("WiFi timeout → Starting SoftAP");
                prefs.remove("ssid");
                prefs.remove("pass");
                startSoftAP();
            }
        }
    }

    // Stop here if WiFi not ready
    if (!wifiConnected) {
        return;
    }

    /* ================= WEBSOCKET RECONNECTION ================= */
    if (!wsConnected && millis() - lastWsReconnect >= WS_RECONNECT_INTERVAL) {
        lastWsReconnect = millis();
        Serial.println("[WebSocket] Attempting to reconnect...");
        connectWebSocket();
    }

    /* ================= STATUS UPDATE (KEEP ALIVE) ================= */
    // Always send status updates (even when unpaired) to show device is online/offline
    if (wsConnected && millis() - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
        lastStatusUpdate = millis();

        // Send status update via WebSocket (non-blocking)
        String statusMsg = "{\"type\":\"status-update\",\"deviceId\":\"" + deviceId + "\"}";
        webSocket.sendTXT(statusMsg);
        // Silent - keep-alive doesn't need logging
    }

    /* ================= DHT22 AUTOMATIC READING ================= */
    // Only read sensors if device is paired
    if (isPaired && millis() - lastDHTRead >= DHT_READ_INTERVAL) {
        lastDHTRead = millis();

        // Read DHT22 sensor
        bool readSuccess = readDHT22();

        // Send data via WebSocket only if reading was successful
        if (readSuccess && wsConnected) {
            sendDHTDataViaWebSocket();
        }
    }

    /* ================= ULTRASONIC AUTOMATIC READING ================= */
    // Only read sensors if device is paired
    if (isPaired && millis() - lastUltrasonicRead >= ULTRASONIC_READ_INTERVAL) {
        lastUltrasonicRead = millis();

        // Read both ultrasonic sensors (non-blocking - pulseIn handles timing)
        bool atomizerSuccess = readAtomizerLevel();
        bool foamSuccess = readFoamLevel();

        // Log combined reading
        if (atomizerSuccess || foamSuccess) {
            Serial.println("[Level] Atomizer: " + String(currentAtomizerDistance) + " cm | Foam: " + String(currentFoamDistance) + " cm");
        }

        // Send data via WebSocket if at least one reading was successful
        if ((atomizerSuccess || foamSuccess) && wsConnected) {
            sendUltrasonicDataViaWebSocket();
        }
    }

    /* ================= SERVICE HANDLING ================= */
    // Handle service timer, relay control, and RGB lights
    handleService();
}
