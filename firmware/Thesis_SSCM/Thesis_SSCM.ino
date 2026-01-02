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
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <DHT.h>
#include <ESP32Servo.h>

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

/* ===================== 8-CHANNEL RELAY ===================== */
#define RELAY_1_PIN 6   // Channel 1: Bill Acceptor
#define RELAY_2_PIN 7   // Channel 2: Coin Slot
#define RELAY_3_PIN 15  // Channel 3: Centrifugal Blower Fan
#define RELAY_4_PIN 16  // Channel 4: PTC Ceramic Heater
#define RELAY_5_PIN 17  // Channel 5: Bottom Exhaust
#define RELAY_6_PIN 18  // Channel 6: Diaphragm Pump
#define RELAY_7_PIN 8   // Channel 7: Ultrasonic Mist Maker
#define RELAY_8_PIN 3   // Channel 8: UVC Light

// Most relay modules are active LOW (LOW = ON, HIGH = OFF)
#define RELAY_ON HIGH
#define RELAY_OFF LOW

bool relay1State = false;  // Bill Acceptor
bool relay2State = false;  // Coin Slot
bool relay3State = false;  // Centrifugal Blower Fan
bool relay4State = false;  // PTC Ceramic Heater
bool relay5State = false;  // Bottom Exhaust
bool relay6State = false;  // Diaphragm Pump
bool relay7State = false;  // Ultrasonic Mist Maker
bool relay8State = false;  // UVC Light

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

    String request = "";
    unsigned long timeout = millis();

    while (client.connected() && millis() - timeout < 1000) {
        if (client.available()) {
            request += client.readString();
            break;
        }
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
            Serial.println("[WebSocket] Connected to server");
            wsConnected = true;

            // Subscribe to device updates
            String subscribeMsg = "{\"type\":\"subscribe\",\"deviceId\":\"" + deviceId + "\"}";
            webSocket.sendTXT(subscribeMsg);
            Serial.println("[WebSocket] Sent subscription: " + subscribeMsg);
            break;
        }

        case WStype_TEXT: {
            Serial.printf("[WebSocket] Received: %s\n", payload);

            // Parse JSON response
            String message = String((char*)payload);

            if (message.indexOf("\"type\":\"subscribed\"") != -1) {
                Serial.println("[WebSocket] Successfully subscribed to device updates");

                // Send initial status update immediately after subscribing
                String statusMsg = "{\"type\":\"status-update\",\"deviceId\":\"" + deviceId + "\"}";
                webSocket.sendTXT(statusMsg);
                Serial.println("[WebSocket] Sent initial status update");
            }
            else if (message.indexOf("\"type\":\"status-ack\"") != -1) {
                // Acknowledgment of status update with paired status sync
                if (message.indexOf("\"success\":true") != -1) {
                    Serial.println("[WebSocket] Status update acknowledged");

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
                // Frontend entered payment page - enable payment system
                paymentEnabled = true;
                Serial.println("\n=== PAYMENT SYSTEM ENABLED ===");
                Serial.println("Ready to accept coins and bills");
                Serial.println("===============================\n");
            }
            else if (message.indexOf("\"type\":\"disable-payment\"") != -1) {
                // Frontend left payment page - disable payment system
                paymentEnabled = false;
                Serial.println("\n=== PAYMENT SYSTEM DISABLED ===");
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
                        Serial.println("[WebSocket] Relay control: CH" + String(channel) + " -> " + (state ? "ON" : "OFF"));
                    } else {
                        Serial.println("[WebSocket] Invalid relay channel: " + String(channel));
                    }
                } else {
                    Serial.println("[WebSocket] Invalid relay-control message format");
                }
            }
            break;
        }

        case WStype_ERROR: {
            Serial.println("[WebSocket] Error occurred");
            wsConnected = false;
            break;
        }
    }
}

void connectWebSocket() {
    if (!wifiConnected || wsConnected) return;

    // Include deviceId as query parameter for server authentication
    String wsPath = "/api/ws?deviceId=" + deviceId;

    Serial.println("[WebSocket] Connecting to ws://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + wsPath);
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

    Serial.println("[DHT22] Temperature: " + String(currentTemperature) + "°C");
    Serial.println("[DHT22] Humidity: " + String(currentHumidity) + "%");
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
    Serial.println("[WebSocket] Sent sensor data: " + sensorMsg);
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
        Serial.println("[Atomizer Level] No echo received (timeout)");
        Serial.println("[Atomizer Level] Check: 1) Wiring 2) 5V power 3) Level shifter 4) Object in range");
        return false;
    }
    
    // Calculate distance: duration in microseconds, speed of sound = 343 m/s
    // distance = (duration / 2) / 29.1 cm (or duration * 0.034 / 2)
    int distance = (duration * 0.034) / 2;
    
    // Validate range (JSN-SR20-Y1: 2cm to 500cm)
    if (distance < 2 || distance > 500) {
        Serial.println("[Atomizer Level] Out of valid range: " + String(distance) + " cm");
        return false;
    }
    
    currentAtomizerDistance = distance;
    Serial.println("[Atomizer Level] Distance to liquid: " + String(currentAtomizerDistance) + " cm (pulse: " + String(duration) + " us)");
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
        Serial.println("[Foam Level] No echo received (timeout)");
        Serial.println("[Foam Level] Check: 1) Wiring 2) 5V power 3) Level shifter 4) Object in range");
        return false;
    }
    
    // Calculate distance: duration in microseconds, speed of sound = 343 m/s
    // distance = (duration / 2) / 29.1 cm (or duration * 0.034 / 2)
    int distance = (duration * 0.034) / 2;
    
    // Validate range (JSN-SR20-Y1: 2cm to 500cm)
    if (distance < 2 || distance > 500) {
        Serial.println("[Foam Level] Out of valid range: " + String(distance) + " cm");
        return false;
    }
    
    currentFoamDistance = distance;
    Serial.println("[Foam Level] Distance to foam: " + String(currentFoamDistance) + " cm (pulse: " + String(duration) + " us)");
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
    Serial.println("[WebSocket] Sent distance data: " + distanceMsg);
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

/* ===================== COIN SLOT INTERRUPT HANDLER ===================== */
void IRAM_ATTR handleCoinPulse() {
    // Only accept pulses when payment is enabled (on payment page)
    if (!paymentEnabled) {
        return;
    }

    unsigned long currentTime = millis();

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
    Serial.println("  CH1 (GPIO 6):  Bill Acceptor");
    Serial.println("  CH2 (GPIO 7):  Coin Slot");
    Serial.println("  CH3 (GPIO 15): Centrifugal Blower Fan");
    Serial.println("  CH4 (GPIO 16): PTC Ceramic Heater");
    Serial.println("  CH5 (GPIO 17): Bottom Exhaust");
    Serial.println("  CH6 (GPIO 18): Diaphragm Pump");
    Serial.println("  CH7 (GPIO 8):  Ultrasonic Mist Maker");
    Serial.println("  CH8 (GPIO 3):  UVC Light");
    Serial.println("All relays set to OFF\n");

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
    delay(10);

    // Handle WebSocket - MUST call loop() even when not connected for handshake
    webSocket.loop();

    // Update servo positions for smooth non-blocking movement (dual servos)
    updateServoPositions();

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
                Serial.println("[WebSocket] Sent coin event: " + coinMsg);
            } else {
                Serial.println("[WebSocket] Not sending coin event - device not paired or not connected");
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
                Serial.println("[WebSocket] Sent bill event: " + billMsg);
            } else {
                Serial.println("[WebSocket] Not sending bill event - device not paired or not connected");
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
            Serial.println("Left:  0° → 90° → 180°");
            Serial.println("Right: 180° → 90° → 0° (mirrored)");
            Serial.println("Watch the smooth slow mirrored movement!");

            // Move to 0 first (left=0°, right=180°)
            setServoPositions(0);
            delay(2000);

            // Move to 90 degrees (left=90°, right=90°)
            setServoPositions(90);
            delay(2500);

            // Move to 180 degrees (left=180°, right=0°)
            setServoPositions(180);

            Serial.println("Demo sequence started! Servos will complete movement");
            Serial.println("Movement is fully non-blocking - main loop continues running");
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
        Serial.println("[WebSocket] Sent status update: " + statusMsg);
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

        // Read both ultrasonic sensors
        bool atomizerSuccess = readAtomizerLevel();
        delay(50);  // Small delay between readings to avoid interference
        bool foamSuccess = readFoamLevel();

        // Send data via WebSocket if at least one reading was successful
        if ((atomizerSuccess || foamSuccess) && wsConnected) {
            sendUltrasonicDataViaWebSocket();
        }
    }
}
