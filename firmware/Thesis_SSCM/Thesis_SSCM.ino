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
#include <esp_now.h>
#include <esp_wifi.h>
#include "html_pages.h"

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

/* ===================== ESP-NOW - ESP32-CAM COMMUNICATION ===================== */
// Wireless credential transfer to ESP32-CAM via ESP-NOW (no wires needed)
// CAM device ID is derived from main board: SSCM-ABC123 -> SSCM-CAM-ABC123

// Structure to send WiFi credentials to CAM
typedef struct {
  char ssid[32];
  char password[64];
  char wsHost[64];
  uint16_t wsPort;
  char deviceId[24];  // Main board's device ID
} WiFiCredentials;

WiFiCredentials camCredentials;

// Structure to receive pairing acknowledgment from CAM
typedef struct {
  char camDeviceId[24];    // CAM's own device ID (e.g., SSCM-CAM-XYZ789)
  char mainDeviceId[24];   // Echoed main board device ID (for verification)
  uint8_t ackType;         // 1 = accepted, 2 = rejected
} PairingAck;

bool espNowInitialized = false;
bool credentialsSentToCAM = false;
bool camIsReady = false;  // Track if CAM has confirmed it's ready

// Credential retry logic (for simultaneous boot timing)
unsigned long lastCredentialSendTime = 0;
const unsigned long CREDENTIAL_RETRY_INTERVAL = 5000;  // Retry every 5 seconds
int credentialSendAttempts = 0;
const int MAX_CREDENTIAL_ATTEMPTS = 6;  // Try for 30 seconds total

// CAM MAC address for direct pairing (prevents cross-device interference)
uint8_t camMacAddress[6] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
bool camMacPaired = false;
String pairedCamDeviceId = "";  // Actual CAM device ID from pairing (e.g., SSCM-CAM-D4DB1C)

// Broadcast address (only used during initial pairing discovery)
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

/* ===================== CLASSIFICATION STATE ===================== */
// Classification is now handled via WebSocket, not serial
String lastClassificationResult = "";
float lastClassificationConfidence = 0.0;
bool classificationLedOn = false;

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
// Cleaning mode phases:
// Phase 0: Not cleaning
// Phase 1: Stepper moving to max (480mm), pump ON
// Phase 2: Stepper returning to 0, pump ON
// Phase 3: Brushing clockwise (95 seconds)
// Phase 4: Brushing counter-clockwise (95 seconds)
// After 3 complete brush cycles, cleaning ends

const long CLEANING_MAX_POSITION = 4800;  // 480mm * 10 steps/mm = 4800 steps
int cleaningPhase = 0;  // Current cleaning phase (0-4)

// Brushing cycle state
// Total cleaning: 300s, Phase 1-2: ~15s, Brushing: ~285s
// 3 cycles × 2 directions = 6 phases, so 285s ÷ 6 ≈ 47.5s per direction
const unsigned long BRUSH_DURATION_MS = 47500;  // 47.5 seconds per direction
const int BRUSH_TOTAL_CYCLES = 3;               // 3 complete cycles (CW + CCW each)
const int BRUSH_MOTOR_SPEED = 200;              // Motor speed (0-255)
int brushCurrentCycle = 0;                      // Current brush cycle (1-3)
unsigned long brushPhaseStartTime = 0;          // When current brush phase started

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
const unsigned long SERVO_UPDATE_INTERVAL = 15;  // Update servos every 15ms for smooth movement

// Servo speed control for cleaning brushing phases
// Slow: 180° over entire 3 cycles (~285s) = 285000ms / 15ms / 180° ≈ 106 updates per degree
// Fast: 180° over ~2s = move 1° every update
const int SERVO_SLOW_STEP_INTERVAL = 106;  // Updates between each 1° step (slow over all 3 cycles)
const int SERVO_FAST_STEP_INTERVAL = 1;    // Updates between each 1° step (fast return)
int servoStepInterval = SERVO_SLOW_STEP_INTERVAL;  // Current step interval
int servoStepCounter = 0;                  // Counter for step interval

// Forward declaration for servo function (defined later, used in handleService/stopService)
void setServoPositions(int leftPos, bool fastMode = false);

/* ===================== DRV8871 DC MOTOR DRIVERS - DUAL MOTORS ===================== */
// Left DC Motor
#define MOTOR_LEFT_IN1_PIN 21   // GPIO 21 - Left motor IN1
#define MOTOR_LEFT_IN2_PIN 47   // GPIO 47 - Left motor IN2

// Right DC Motor
#define MOTOR_RIGHT_IN1_PIN 48  // GPIO 48 - Right motor IN1
#define MOTOR_RIGHT_IN2_PIN 45  // GPIO 45 - Right motor IN2

// PWM configuration for motor speed control
const int MOTOR_PWM_FREQ = 1000;      // 1kHz PWM frequency
const int MOTOR_PWM_RESOLUTION = 8;   // 8-bit resolution (0-255)

int currentLeftMotorSpeed = 0;   // Left motor speed (-255 to 255, negative = reverse)
int currentRightMotorSpeed = 0;  // Right motor speed (-255 to 255, negative = reverse)

/* ===================== TB6600 STEPPER MOTOR DRIVER - TOP LINEAR STEPPER ===================== */
#define STEPPER1_STEP_PIN 35     // GPIO 35 - STEP/PULSE pin (PUL+/PUL-)
#define STEPPER1_DIR_PIN 36      // GPIO 36 - DIRECTION pin (DIR+/DIR-)
// ENA+ hardwired to GND (motor ALWAYS ENABLED - no ESP32 control needed)

// Top Linear Stepper configuration - Optimized for NEMA11 linear actuator (max 80mm/s)
const int STEPPER1_STEPS_PER_REV = 200;      // NEMA11: 1.8° step angle = 200 steps/rev (FULL STEP)
const int STEPPER1_MICROSTEPS = 1;           // TB6600 FULL STEP mode (fastest, set DIP: OFF-OFF-OFF)
const int STEPPER1_STEPS_PER_MM = 10;        // Lead screw: 20mm pitch (200 steps = 20mm travel)
const int STEPPER1_MAX_SPEED = 800;          // Maximum: 800 steps/sec = 80mm/s
const unsigned long STEPPER1_MIN_PULSE_WIDTH = 2;  // Minimum 2us pulse (optimized for speed)

// Top Linear Stepper state
long currentStepper1Position = 0;    // Current position in steps
long targetStepper1Position = 0;     // Target position in steps
int stepper1Speed = 800;             // Speed: 800 steps/sec = 80mm/s (MAXIMUM for this motor!)
bool stepper1Moving = false;         // Is stepper currently moving
unsigned long lastStepper1Update = 0;
unsigned long stepper1StepInterval = 1250;  // Microseconds between steps (calculated from speed)

/* ===================== TB6600 STEPPER MOTOR DRIVER - SIDE LINEAR STEPPER (DOUBLE) ===================== */
#define STEPPER2_STEP_PIN 37    // GPIO 37 - STEP/PULSE pin (PUL+/PUL-)
#define STEPPER2_DIR_PIN 38     // GPIO 38 - DIRECTION pin (DIR+/DIR-)
// ENA+ hardwired to GND (motor ALWAYS ENABLED - no ESP32 control needed)

// Mini Linear Rail Guide Slide Actuator Specifications:
// - Material: Aluminium alloy
// - Effective Travel: 100mm
// - Screw Rod Diameter: 6mm
// - Helical Pitch (Lead): 1mm per revolution
// - Step Angle: 1.8° (200 steps/revolution)
// - Steps per mm: 200 (1mm pitch ÷ 200 steps = 0.005mm per step)
// - Max Speed: 120mm/s = 24,000 steps/sec
// - Current: 0.6A
// - Holding Torque: 6N.cm
const int STEPPER2_STEPS_PER_REV = 200;     // 1.8° step angle = 200 steps/rev
const int STEPPER2_MICROSTEPS = 1;          // TB6600 FULL STEP mode (fastest)
const int STEPPER2_STEPS_PER_MM = 200;      // 1mm lead screw pitch = 200 steps/mm
const int STEPPER2_MAX_SPEED = 24000;       // Maximum: 24,000 steps/sec = 120mm/s
const long STEPPER2_MAX_POSITION = 20000;   // 100mm * 200 steps/mm = 20,000 steps
const unsigned long STEPPER2_MIN_PULSE_WIDTH = 2;  // Minimum 2us pulse (optimized for speed)

// Side Linear Stepper (Double) state
long currentStepper2Position = 0;   // Current position in steps
long targetStepper2Position = 0;    // Target position in steps
int stepper2Speed = 1500;           // Default: 1500 steps/sec = 7.5mm/s
bool stepper2Moving = false;        // Is stepper currently moving
unsigned long lastStepper2Update = 0;
unsigned long stepper2StepInterval = 667;  // Microseconds between steps (calculated from speed)

/* ===================== WS2812B RGB LED STRIP (NeoPixel) ===================== */
#define RGB_DATA_PIN 39      // GPIO 39 - WS2812B data pin
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

/* ===================== FUNCTIONS ===================== */

/* ===================== ESP-NOW FUNCTIONS ===================== */

// Callback when ESP-NOW data is sent
// Updated for ESP32 Arduino Core v3.x
void onDataSent(const wifi_tx_info_t *tx_info, esp_now_send_status_t status) {
    if (status == ESP_NOW_SEND_SUCCESS) {
        Serial.println("[ESP-NOW] Credentials sent to CAM");
        credentialsSentToCAM = true;
    } else {
        Serial.println("[ESP-NOW] Send failed");
    }
}

// Callback when ESP-NOW data is received (for CAM pairing acknowledgment)
// Updated for ESP32 Arduino Core v3.x
void onDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *data, int len) {
    Serial.println("\n[ESP-NOW] Data received from CAM!");

    // Get sender MAC address
    uint8_t* senderMac = recv_info->src_addr;
    Serial.print("[ESP-NOW] From MAC: ");
    for (int i = 0; i < 6; i++) {
        Serial.printf("%02X", senderMac[i]);
        if (i < 5) Serial.print(":");
    }
    Serial.println();

    // Check if this is a PairingAck message
    if (len == sizeof(PairingAck)) {
        PairingAck ack;
        memcpy(&ack, data, sizeof(PairingAck));

        Serial.println("[ESP-NOW] Pairing acknowledgment received:");
        Serial.println("  CAM Device ID: " + String(ack.camDeviceId));
        Serial.println("  Main Device ID: " + String(ack.mainDeviceId));
        Serial.println("  Ack Type: " + String(ack.ackType == 1 ? "ACCEPTED" : "REJECTED"));

        // Verify this is for our device
        if (strcmp(ack.mainDeviceId, deviceId.c_str()) == 0) {
            if (ack.ackType == 1) {
                // Always store/update the CAM device ID
                pairedCamDeviceId = String(ack.camDeviceId);
                prefs.putString("camDeviceId", pairedCamDeviceId);
                Serial.println("[ESP-NOW] Stored CAM Device ID: " + pairedCamDeviceId);

                // Credentials accepted - store CAM MAC for direct communication (first time only)
                if (!camMacPaired) {
                    memcpy(camMacAddress, senderMac, 6);
                    prefs.putBytes("camMac", camMacAddress, 6);
                    camMacPaired = true;

                    Serial.println("[ESP-NOW] Paired with CAM MAC:");
                    Serial.print("  ");
                    for (int i = 0; i < 6; i++) {
                        Serial.printf("%02X", camMacAddress[i]);
                        if (i < 5) Serial.print(":");
                    }
                    Serial.println();

                    // Update ESP-NOW peer to use direct MAC instead of broadcast
                    esp_now_del_peer(broadcastAddress);
                    esp_now_peer_info_t peerInfo;
                    memset(&peerInfo, 0, sizeof(peerInfo));
                    memcpy(peerInfo.peer_addr, camMacAddress, 6);
                    peerInfo.channel = 0;
                    peerInfo.encrypt = false;
                    esp_now_add_peer(&peerInfo);

                    Serial.println("[ESP-NOW] Updated to direct CAM communication");
                }

                // CAM is confirmed ready
                camIsReady = true;
                credentialSendAttempts = MAX_CREDENTIAL_ATTEMPTS;  // Stop retrying
                Serial.println("[ESP-NOW] CAM confirmed ready - pairing complete");

                // Notify frontend of CAM sync status
                sendCamSyncStatus();
            } else {
                Serial.println("[ESP-NOW] CAM rejected credentials (device ID mismatch on CAM side)");
            }
        } else {
            Serial.println("[ESP-NOW] Ack not for this device (expected: " + deviceId + ")");
        }
    } else {
        Serial.println("[ESP-NOW] Unknown data size: " + String(len) + " (expected PairingAck: " + String(sizeof(PairingAck)) + ")");
    }
}

// Initialize ESP-NOW (call after WiFi.mode is set)
void initESPNow() {
    if (espNowInitialized) return;

    // ESP-NOW requires WiFi to be initialized
    if (esp_now_init() != ESP_OK) {
        Serial.println("[ESP-NOW] Init failed!");
        return;
    }

    // Register send callback
    esp_now_register_send_cb(onDataSent);

    // Register receive callback (for pairing acknowledgment from CAM)
    esp_now_register_recv_cb(onDataRecv);

    // Load paired CAM MAC from preferences
    size_t macLen = prefs.getBytes("camMac", camMacAddress, 6);
    if (macLen == 6 && (camMacAddress[0] != 0x00 || camMacAddress[1] != 0x00)) {
        camMacPaired = true;
    }

    // Load paired CAM device ID from preferences
    pairedCamDeviceId = prefs.getString("camDeviceId", "");
    if (pairedCamDeviceId.length() > 0) {
        Serial.println("[ESP-NOW] Loaded CAM Device ID: " + pairedCamDeviceId);
    }

    // Add peer (either paired CAM MAC or broadcast for discovery)
    esp_now_peer_info_t peerInfo;
    memset(&peerInfo, 0, sizeof(peerInfo));
    
    if (camMacPaired) {
        // Use paired CAM MAC for direct communication
        memcpy(peerInfo.peer_addr, camMacAddress, 6);
        Serial.println("[ESP-NOW] Added paired CAM as peer");
    } else {
        // Use broadcast for initial pairing discovery
        memcpy(peerInfo.peer_addr, broadcastAddress, 6);
        Serial.println("[ESP-NOW] Added broadcast peer for pairing discovery");
    }
    
    peerInfo.channel = 0;  // Use current WiFi channel
    peerInfo.encrypt = false;

    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
        Serial.println("[ESP-NOW] Failed to add peer");
        return;
    }

    espNowInitialized = true;
    Serial.println("[ESP-NOW] Initialized successfully");
}

// Send WiFi credentials to ESP32-CAM via ESP-NOW broadcast
void sendCredentialsToCAM() {
    if (!espNowInitialized) {
        Serial.println("[ESP-NOW] Not initialized, cannot send credentials");
        return;
    }

    // Get stored WiFi credentials
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");

    if (ssid.length() == 0) {
        Serial.println("[ESP-NOW] No WiFi credentials stored");
        return;
    }

    // Prepare credentials structure
    memset(&camCredentials, 0, sizeof(camCredentials));
    strncpy(camCredentials.ssid, ssid.c_str(), sizeof(camCredentials.ssid) - 1);
    strncpy(camCredentials.password, pass.c_str(), sizeof(camCredentials.password) - 1);

    // WebSocket server info - use BACKEND_HOST (same server both boards connect to)
    strncpy(camCredentials.wsHost, BACKEND_HOST, sizeof(camCredentials.wsHost) - 1);
    camCredentials.wsPort = BACKEND_PORT;

    // Device ID for CAM to derive its own ID
    strncpy(camCredentials.deviceId, deviceId.c_str(), sizeof(camCredentials.deviceId) - 1);

    // Send to paired CAM MAC or broadcast if not paired
    uint8_t* targetMac = camMacPaired ? camMacAddress : broadcastAddress;
    esp_now_send(targetMac, (uint8_t *)&camCredentials, sizeof(camCredentials));
    
    // Track send attempts
    credentialSendAttempts++;
    lastCredentialSendTime = millis();
    Serial.println("[ESP-NOW] Credentials sent to CAM (attempt " + String(credentialSendAttempts) + ")");
}

/* ===================== WIFI FUNCTIONS ===================== */

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

        prefs.putString("ssid", ssid);
        prefs.putString("pass", pass);

        // Build confirmation page with actual SSID (from html_pages.h)
        String confirmPage = FPSTR(CONFIRM_HTML);
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

    int httpCode = http.POST(payload);

    if (httpCode == 200 || httpCode == 201) {
        String response = http.getString();
        if (response.indexOf("\"paired\":true") != -1) {
            Serial.println("[HTTP] Device already paired");
            isPaired = true;
            prefs.putBool("paired", true);
        }
    } else if (httpCode > 0) {
        Serial.println("[HTTP] Registration failed: " + String(httpCode));
    } else {
        Serial.println("[HTTP] Registration error: " + http.errorToString(httpCode));
    }

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

    int httpCode = http.POST(payload);
    if (httpCode < 0) {
        Serial.println("[HTTP] Status update error: " + http.errorToString(httpCode));
    }

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

                // Send CAM sync status so frontend knows if CAM is ready
                sendCamSyncStatus();
            }
            else if (message.indexOf("\"type\":\"status-ack\"") != -1) {
                // Acknowledgment of status update with paired status sync
                if (message.indexOf("\"success\":true") != -1) {

                    // Sync paired status from database
                    bool dbPaired = (message.indexOf("\"paired\":true") != -1);

                    if (dbPaired != isPaired) {
                        if (dbPaired && !isPaired) {
                            isPaired = true;
                            prefs.putBool("paired", true);
                        } else if (!dbPaired && isPaired) {
                            isPaired = false;
                            prefs.putBool("paired", false);
                            pairingCode = generatePairingCode();
                            sendDeviceRegistration();
                        }
                    }
                } else {
                    Serial.println("[WebSocket] Status update failed");
                }
            }
            else if (message.indexOf("\"type\":\"device-update\"") != -1) {
                if (message.indexOf("\"paired\":true") != -1) {
                    if (!isPaired) {
                        Serial.println("[WebSocket] Device paired!");
                        isPaired = true;
                        prefs.putBool("paired", true);
                    }
                }
                else if (message.indexOf("\"paired\":false") != -1) {
                    if (isPaired) {
                        Serial.println("[WebSocket] Device unpaired, new code: " + pairingCode);
                        isPaired = false;
                        prefs.putBool("paired", false);
                        pairingCode = generatePairingCode();
                        sendDeviceRegistration();
                    }
                }
            }
            else if (message.indexOf("\"type\":\"enable-payment\"") != -1) {
                Serial.println("[PAYMENT] Enabled");
                paymentEnabled = true;
                paymentEnableTime = millis();
                digitalWrite(RELAY_1_PIN, RELAY_ON);
                relay1State = true;
            }
            else if (message.indexOf("\"type\":\"disable-payment\"") != -1) {
                Serial.println("[PAYMENT] Disabled");
                paymentEnabled = false;
                digitalWrite(RELAY_1_PIN, RELAY_OFF);
                relay1State = false;
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
            else if (message.indexOf("\"type\":\"start-classification\"") != -1) {
                // Classification request received - LED is controlled by page enter/leave
                Serial.println("\n=== CLASSIFICATION STARTED ===");
                Serial.println("===============================\n");
            }
            else if (message.indexOf("\"type\":\"enable-classification\"") != -1) {
                // User entered classification page - turn on WHITE LED
                Serial.println("\n=== CLASSIFICATION PAGE ENTERED ===");
                rgbWhite();
                classificationLedOn = true;
                Serial.println("RGB Light: WHITE (camera lighting)");
                Serial.println("===================================\n");
            }
            else if (message.indexOf("\"type\":\"disable-classification\"") != -1) {
                // User left classification page - turn off LED
                Serial.println("\n=== CLASSIFICATION PAGE EXITED ===");
                rgbOff();
                classificationLedOn = false;
                Serial.println("RGB Light: OFF");
                Serial.println("==================================\n");
            }
            else if (message.indexOf("\"type\":\"classification-result\"") != -1) {
                // Classification result from ESP32-CAM (via backend)
                // Format: {"type":"classification-result","deviceId":"SSCM-CAM-xxx","result":"leather","confidence":0.95}

                // Extract result (shoe type)
                int resultIdx = message.indexOf("\"result\":\"");
                String shoeType = "";
                if (resultIdx != -1) {
                    int start = resultIdx + 10;
                    int end = message.indexOf("\"", start);
                    shoeType = message.substring(start, end);
                }

                // Extract confidence
                int confIdx = message.indexOf("\"confidence\":");
                float confidence = 0.0;
                if (confIdx != -1) {
                    int start = confIdx + 13;
                    int end = message.indexOf(",", start);
                    if (end == -1) end = message.indexOf("}", start);
                    confidence = message.substring(start, end).toFloat();
                }

                handleClassificationResultFromWebSocket(shoeType, confidence);
                // LED stays on - controlled by page leave (disable-classification)
            }
            else if (message.indexOf("\"type\":\"classification-error\"") != -1) {
                // Classification error from CAM
                Serial.println("[Classification] Error received from CAM");

                int errIdx = message.indexOf("\"error\":\"");
                if (errIdx != -1) {
                    int start = errIdx + 9;
                    int end = message.indexOf("\"", start);
                    String error = message.substring(start, end);
                    Serial.println("[Classification] Error: " + error);
                }
                // LED stays on - controlled by page leave (disable-classification)
            }
            else if (message.indexOf("\"type\":\"cam-status\"") != -1) {
                // CAM status update
                bool cameraReady = (message.indexOf("\"cameraReady\":true") != -1);
                Serial.println("[CAM] Status - Camera Ready: " + String(cameraReady ? "Yes" : "No"));
                
                // Stop credential retry if CAM is ready
                if (cameraReady && !camIsReady) {
                    camIsReady = true;
                    credentialSendAttempts = MAX_CREDENTIAL_ATTEMPTS;  // Stop retrying
                    Serial.println("[ESP-NOW] CAM confirmed ready - stopping credential retry");

                    // Notify frontend of CAM sync status
                    sendCamSyncStatus();
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
        Serial.println("[Service] Completing previous service: " + currentServiceType);
        
        // Send completion message for the previous service
        if (wsConnected && isPaired) {
            String msg = "{";
            msg += "\"type\":\"service-complete\",";
            msg += "\"deviceId\":\"" + deviceId + "\",";
            msg += "\"serviceType\":\"" + currentServiceType + "\",";
            msg += "\"shoeType\":\"" + currentShoeType + "\",";
            msg += "\"careType\":\"" + currentCareType + "\"";
            msg += "}";
            webSocket.sendTXT(msg);
            Serial.println("[WebSocket] Sent completion for: " + currentServiceType);
        }
        
        // Turn off RGB
        rgbOff();
        // Turn off all service relays (CH3-CH8)
        setRelay(3, false);  // Blower Fan
        setRelay(4, false);  // PTC Heater
        setRelay(5, false);  // Bottom Exhaust
        setRelay(6, false);  // Diaphragm Pump
        setRelay(7, false);  // Mist Maker
        setRelay(8, false);  // UVC Light

        // Reset cleaning-specific state if transitioning from cleaning
        if (currentServiceType == "cleaning") {
            cleaningPhase = 0;
            brushCurrentCycle = 0;
            stepper1MoveTo(0);  // Return stepper to home
            stepper2MoveTo(0);  // Return side stepper to home
            motorsCoast();      // Stop brush motors
            Serial.println("[Service] Cleaning state reset, steppers/motors returning to home");
        }
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
    Serial.print("Shoe Type: "); Serial.println(shoeType);
    Serial.print("Service Type: "); Serial.println(serviceType);
    Serial.print("Care Type: "); Serial.println(careType);
    Serial.print("Duration: "); Serial.print(serviceDuration / 1000); Serial.println(" seconds");

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
        stepper1MoveTo(CLEANING_MAX_POSITION);
        Serial.print("[Cleaning] Stepper moving to "); 
        Serial.print(CLEANING_MAX_POSITION / 10); 
        Serial.println("mm");

        // Move stepper2 (side linear) based on care type (absolute position)
        long stepper2TargetSteps = 0;
        if (careType == "strong") {
            stepper2TargetSteps = 20600;  // 103mm = 103 * 200 steps/mm
        } else if (careType == "normal") {
            stepper2TargetSteps = 19600;  // 98mm = 98 * 200 steps/mm
        } else if (careType == "gentle") {
            stepper2TargetSteps = 18600;  // 93mm = 93 * 200 steps/mm
        } else {
            stepper2TargetSteps = 19600;  // Default to normal (98mm)
        }
        stepper2MoveTo(stepper2TargetSteps);
        Serial.print("[Cleaning] Side stepper moving to "); 
        Serial.print(stepper2TargetSteps / 200); 
        Serial.print("mm ("); 
        Serial.print(careType); 
        Serial.println(" care)");
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
        brushCurrentCycle = 0;
        stepper1MoveTo(0);  // Return to home
        Serial.println("[Cleaning] Returning stepper to home position");
        // Return stepper2 to home position
        stepper2MoveTo(0);
        Serial.println("[Cleaning] Returning side stepper to home position");
        // Stop brush motors
        motorsCoast();
        Serial.println("[Cleaning] Brush motors stopped");
        // Reset servos to original position (fast return)
        setServoPositions(0, true);  // Left: 0°, Right: 180°
        Serial.println("[Cleaning] Resetting servos to home position");
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
    // For cleaning: don't stop if brushing is still in progress (phases 3-4)
    if (elapsed >= serviceDuration) {
        if (currentServiceType == "cleaning" && cleaningPhase >= 3) {
            // Brushing in progress - don't stop yet
        } else {
            stopService();
            return;
        }
    }

    // Handle cleaning mode phases
    if (currentServiceType == "cleaning" && cleaningPhase > 0) {

        // Phase 1 & 2: Stepper movement with pump
        if (cleaningPhase == 1 || cleaningPhase == 2) {
            // Check if stepper reached target position
            if (!stepper1Moving) {
                if (cleaningPhase == 1) {
                    // Reached max position, now return to 0
                    cleaningPhase = 2;
                    stepper1MoveTo(0);
                    Serial.println("[Cleaning] Stepper at max, returning to 0");
                } else if (cleaningPhase == 2) {
                    // Reached home position, stepper/pump phase complete
                    setRelay(6, false);  // Turn OFF diaphragm pump
                    Serial.println("[Cleaning] Stepper at home - pump OFF");

                    // Start brushing phase
                    cleaningPhase = 3;
                    brushCurrentCycle = 1;
                    brushPhaseStartTime = millis();
                    setMotorsSameSpeed(BRUSH_MOTOR_SPEED);  // Start CW
                    // First cycle: Start slow servo movement (left 0→180, right 180→0)
                    setServoPositions(180, false);  // Slow movement
                    Serial.println("[Cleaning] Starting brush cycle 1/3 - CLOCKWISE (with slow servo rotation)");
                }
            }
        }

        // Phase 3: Brushing clockwise
        else if (cleaningPhase == 3) {
            unsigned long brushElapsed = millis() - brushPhaseStartTime;
            if (brushElapsed >= BRUSH_DURATION_MS) {
                // Switch to counter-clockwise
                cleaningPhase = 4;
                brushPhaseStartTime = millis();
                setMotorsSameSpeed(-BRUSH_MOTOR_SPEED);  // Start CCW
                Serial.println("[Cleaning] Brush cycle " + String(brushCurrentCycle) + "/3 - COUNTER-CLOCKWISE");
            }
        }

        // Phase 4: Brushing counter-clockwise
        else if (cleaningPhase == 4) {
            unsigned long brushElapsed = millis() - brushPhaseStartTime;
            if (brushElapsed >= BRUSH_DURATION_MS) {
                // Cycle complete
                brushCurrentCycle++;

                if (brushCurrentCycle <= BRUSH_TOTAL_CYCLES) {
                    // Start next cycle (back to clockwise)
                    cleaningPhase = 3;
                    brushPhaseStartTime = millis();
                    setMotorsSameSpeed(BRUSH_MOTOR_SPEED);  // Start CW
                    Serial.println("[Cleaning] Starting brush cycle " + String(brushCurrentCycle) + "/3 - CLOCKWISE");
                } else {
                    // All cycles complete - stop motors and end service
                    motorsCoast();
                    cleaningPhase = 0;
                    brushCurrentCycle = 0;
                    Serial.println("[Cleaning] All 3 brush cycles complete - motors OFF");
                    stopService();  // Cleaning fully complete
                    return;
                }
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

/* ===================== CLASSIFICATION FUNCTIONS ===================== */
// Note: Classification is now handled via WebSocket through the backend server
// Flow: Main board -> Backend -> ESP32-CAM -> Backend -> Main board
// No more direct serial communication with CAM

void requestClassificationFromCAM() {
    Serial.println("[Classification] Requesting via WebSocket...");

    lastClassificationResult = "";
    lastClassificationConfidence = 0.0;

    // Request classification from CAM via backend
    // The backend will route this to the ESP32-CAM
    if (wsConnected && isPaired) {
        // Derive CAM device ID from main board ID: SSCM-ABC123 -> SSCM-CAM-ABC123
        String camDeviceId = "SSCM-CAM-" + deviceId.substring(5);  // Remove "SSCM-" and add "SSCM-CAM-"

        String reqMsg = "{\"type\":\"request-classification\",";
        reqMsg += "\"deviceId\":\"" + deviceId + "\",";
        reqMsg += "\"camDeviceId\":\"" + camDeviceId + "\"}";
        webSocket.sendTXT(reqMsg);

        Serial.println("[Classification] Request sent to backend for CAM: " + camDeviceId);
    } else {
        Serial.println("[Classification] Cannot request - not connected or not paired");
    }
}

// Handle classification result received from CAM via WebSocket
void handleClassificationResultFromWebSocket(String shoeType, float confidence) {
    Serial.println("\n=== CLASSIFICATION RESULT RECEIVED ===");
    Serial.println("Shoe Type: " + shoeType);
    Serial.println("Confidence: " + String(confidence * 100, 1) + "%");
    Serial.println("======================================\n");

    lastClassificationResult = shoeType;
    lastClassificationConfidence = confidence;
}

// Note: checkCamSerial() removed - CAM now communicates via WebSocket

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
    sensorMsg += "\"humidity\":" + String(currentHumidity) + ",";
    sensorMsg += "\"camSynced\":" + String(camIsReady ? "true" : "false");
    if (pairedCamDeviceId.length() > 0) {
        sensorMsg += ",\"camDeviceId\":\"" + pairedCamDeviceId + "\"";
    }
    sensorMsg += "}";

    webSocket.sendTXT(sensorMsg);
}

// Send CAM sync status update (called when sync status changes)
void sendCamSyncStatus() {
    if (!isPaired || !wsConnected) return;

    String syncMsg = "{";
    syncMsg += "\"type\":\"cam-sync-status\",";
    syncMsg += "\"deviceId\":\"" + deviceId + "\",";
    syncMsg += "\"camSynced\":" + String(camIsReady ? "true" : "false");
    if (pairedCamDeviceId.length() > 0) {
        syncMsg += ",\"camDeviceId\":\"" + pairedCamDeviceId + "\"";
    }
    syncMsg += "}";

    webSocket.sendTXT(syncMsg);
    Serial.println("[WebSocket] Sent CAM sync status: " + String(camIsReady ? "SYNCED" : "NOT_SYNCED") + (pairedCamDeviceId.length() > 0 ? " (CAM: " + pairedCamDeviceId + ")" : ""));
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
// Speed controlled by servoStepInterval (higher = slower)
void updateServoPositions() {
    if (!servosMoving) return;

    unsigned long currentTime = millis();

    // Check if it's time to update servo positions (every 15ms)
    if (currentTime - lastServoUpdate >= SERVO_UPDATE_INTERVAL) {
        lastServoUpdate = currentTime;

        // Increment step counter and check if we should move
        servoStepCounter++;
        if (servoStepCounter < servoStepInterval) {
            return;  // Not yet time to step
        }
        servoStepCounter = 0;  // Reset counter

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
            Serial.println("[Servo] Reached target - Left: " + String(currentLeftPosition) + "° Right: " + String(currentRightPosition) + "°");
        }
    }
}

// Set servo target positions - initiates non-blocking smooth movement
// leftPos: position for left servo (0-180)
// When left goes to 180°, right goes to 0° (mirrored)
// speedMode: true = fast return, false = slow brushing movement (default)
void setServoPositions(int leftPos, bool fastMode) {
    // Constrain position to 0-180 degrees
    leftPos = constrain(leftPos, 0, 180);

    // Calculate mirrored position for right servo
    int rightPos = 180 - leftPos;

    // Set speed based on mode
    servoStepInterval = fastMode ? SERVO_FAST_STEP_INTERVAL : SERVO_SLOW_STEP_INTERVAL;
    servoStepCounter = 0;  // Reset counter when starting new movement

    if (leftPos != currentLeftPosition || rightPos != currentRightPosition) {
        targetLeftPosition = leftPos;
        targetRightPosition = rightPos;
        servosMoving = true;
        Serial.println("[Servo] Moving to Left: " + String(leftPos) + "° Right: " + String(rightPos) + "° (" + (fastMode ? "FAST" : "SLOW") + ")");
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
    } else if (speed < 0) {
        ledcWrite(MOTOR_LEFT_IN1_PIN, 0);
        ledcWrite(MOTOR_LEFT_IN2_PIN, abs(speed));
    } else {
        ledcWrite(MOTOR_LEFT_IN1_PIN, 0);
        ledcWrite(MOTOR_LEFT_IN2_PIN, 0);
    }
}

// Set RIGHT motor speed and direction
void setRightMotorSpeed(int speed) {
    speed = constrain(speed, -255, 255);
    currentRightMotorSpeed = speed;

    if (speed > 0) {
        ledcWrite(MOTOR_RIGHT_IN1_PIN, speed);
        ledcWrite(MOTOR_RIGHT_IN2_PIN, 0);
    } else if (speed < 0) {
        ledcWrite(MOTOR_RIGHT_IN1_PIN, 0);
        ledcWrite(MOTOR_RIGHT_IN2_PIN, abs(speed));
    } else {
        ledcWrite(MOTOR_RIGHT_IN1_PIN, 0);
        ledcWrite(MOTOR_RIGHT_IN2_PIN, 0);
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
}

// Stop RIGHT motor with brake
void rightMotorBrake() {
    ledcWrite(MOTOR_RIGHT_IN1_PIN, 255);
    ledcWrite(MOTOR_RIGHT_IN2_PIN, 255);
    currentRightMotorSpeed = 0;
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
}

// Stop RIGHT motor with coast
void rightMotorCoast() {
    ledcWrite(MOTOR_RIGHT_IN1_PIN, 0);
    ledcWrite(MOTOR_RIGHT_IN2_PIN, 0);
    currentRightMotorSpeed = 0;
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
void setStepper1Speed(int stepsPerSecond) {
    if (stepsPerSecond <= 0) {
        stepper1Speed = 1;
    } else if (stepsPerSecond > STEPPER1_MAX_SPEED) {
        stepper1Speed = STEPPER1_MAX_SPEED;  // Max speed: 800 steps/sec = 80mm/s (motor specification limit)
    } else {
        stepper1Speed = stepsPerSecond;
    }

    // Calculate interval in microseconds
    stepper1StepInterval = 1000000UL / stepper1Speed;
}

// Perform a single step in the specified direction - OPTIMIZED FOR SPEED
void stepper1Step(bool direction) {
    // Set direction
    digitalWrite(STEPPER1_DIR_PIN, direction ? HIGH : LOW);
    delayMicroseconds(3);  // Direction setup time (TB6600 needs 2.5us min)

    // Generate step pulse
    digitalWrite(STEPPER1_STEP_PIN, HIGH);
    delayMicroseconds(2);  // Pulse width (TB6600 needs 2us min)
    digitalWrite(STEPPER1_STEP_PIN, LOW);

    // Update position
    if (direction) {
        currentStepper1Position++;
    } else {
        currentStepper1Position--;
    }
}

// Move stepper to absolute position (non-blocking - initiates movement)
void stepper1MoveTo(long position) {
    // Motor is ALWAYS ENABLED (ENA+ hardwired to GND) - ready to move!

    targetStepper1Position = position;

    if (targetStepper1Position != currentStepper1Position) {
        stepper1Moving = true;
        Serial.println("[Top Linear] Moving from " + String(currentStepper1Position) +
                       " to " + String(targetStepper1Position) +
                       " steps (" + String(abs(targetStepper1Position - currentStepper1Position)) + " steps)");
    } else {
        Serial.println("[Top Linear] Already at target position: " + String(targetStepper1Position));
    }
}

// Move stepper relative to current position (non-blocking)
void stepper1MoveRelative(long steps) {
    targetStepper1Position = currentStepper1Position + steps;
    stepper1MoveTo(targetStepper1Position);
}

// Move stepper by millimeters (non-blocking)
void stepper1MoveByMM(float mm) {
    long steps = (long)(mm * STEPPER1_STEPS_PER_MM);
    stepper1MoveRelative(steps);
}

// Stop stepper immediately
void stepper1Stop() {
    targetStepper1Position = currentStepper1Position;
    stepper1Moving = false;
    Serial.println("[Top Linear] Stopped at position: " + String(currentStepper1Position) + " steps");
}

// Home the stepper (reset position to zero)
void stepper1Home() {
    currentStepper1Position = 0;
    targetStepper1Position = 0;
    stepper1Moving = false;
    Serial.println("[Top Linear] Homed - position reset to 0");
}

// Non-blocking stepper update - called in loop()
void updateStepper1Position() {
    if (!stepper1Moving) return;

    unsigned long currentMicros = micros();

    // Check if enough time has passed for the next step
    if (currentMicros - lastStepper1Update >= stepper1StepInterval) {
        lastStepper1Update = currentMicros;

        if (currentStepper1Position < targetStepper1Position) {
            // Step forward
            stepper1Step(true);
            yield();  // Allow WiFi/WebSocket processing
        } else if (currentStepper1Position > targetStepper1Position) {
            // Step backward
            stepper1Step(false);
            yield();  // Allow WiFi/WebSocket processing
        } else {
            // Reached target
            stepper1Moving = false;
            Serial.println("[Top Linear] Reached target position: " + String(currentStepper1Position) + " steps");
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
    } else if (stepsPerSecond > STEPPER2_MAX_SPEED) {
        stepper2Speed = STEPPER2_MAX_SPEED;  // Max speed: 24,000 steps/sec = 120mm/s (motor specification limit)
    } else {
        stepper2Speed = stepsPerSecond;
    }

    // Calculate interval in microseconds
    stepper2StepInterval = 1000000UL / stepper2Speed;
    Serial.println("[Side Linear] Speed: " + String(stepper2Speed) + " steps/sec = " +
                   String(stepper2Speed / STEPPER2_STEPS_PER_MM) + " mm/sec");
}

// Perform a single step in the specified direction - OPTIMIZED FOR SPEED
void stepper2Step(bool direction) {
    // Set direction
    digitalWrite(STEPPER2_DIR_PIN, direction ? HIGH : LOW);
    delayMicroseconds(3);  // Direction setup time (TB6600 needs 2.5us min)

    // Generate step pulse
    digitalWrite(STEPPER2_STEP_PIN, HIGH);
    delayMicroseconds(2);  // Pulse width (TB6600 needs 2us min)
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
    long steps = (long)(mm * STEPPER2_STEPS_PER_MM);
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
            yield();  // Allow WiFi/WebSocket processing
        } else if (currentStepper2Position > targetStepper2Position) {
            // Step backward
            stepper2Step(false);
            yield();  // Allow WiFi/WebSocket processing
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

    Serial.println("\n\n=================================");
    Serial.println("  Smart Shoe Care Machine v2.0");
    Serial.println("  WebSocket Edition");
    Serial.println("=================================\n");

    prefs.begin("sscm", false);

    // Initialize ESP-NOW for wireless communication with ESP32-CAM
    // Note: ESP-NOW will be fully initialized after WiFi mode is set

    // Initialize DHT22 sensor
    dht.begin();

    // Initialize JSN-SR20-Y1 ultrasonic sensors
    pinMode(ATOMIZER_TRIG_PIN, OUTPUT);
    pinMode(ATOMIZER_ECHO_PIN, INPUT);
    digitalWrite(ATOMIZER_TRIG_PIN, LOW);
    
    pinMode(FOAM_TRIG_PIN, OUTPUT);
    pinMode(FOAM_ECHO_PIN, INPUT);
    digitalWrite(FOAM_TRIG_PIN, LOW);

    // Initialize servo motors (Tower Pro MG995) - Dual servos
    servoLeft.attach(SERVO_LEFT_PIN);
    servoRight.attach(SERVO_RIGHT_PIN);

    servoLeft.write(0);    // Left starts at 0 degrees
    servoRight.write(180); // Right starts at 180 degrees (mirrored)

    currentLeftPosition = 0;
    currentRightPosition = 180;
    targetLeftPosition = 0;
    targetRightPosition = 180;

    // Initialize DRV8871 DC Motor Drivers (Dual Motors) with PWM
    // IMPORTANT: Set pins LOW before attaching PWM to prevent motor spin at boot
    pinMode(MOTOR_LEFT_IN1_PIN, OUTPUT);
    pinMode(MOTOR_LEFT_IN2_PIN, OUTPUT);
    pinMode(MOTOR_RIGHT_IN1_PIN, OUTPUT);
    pinMode(MOTOR_RIGHT_IN2_PIN, OUTPUT);
    digitalWrite(MOTOR_LEFT_IN1_PIN, LOW);
    digitalWrite(MOTOR_LEFT_IN2_PIN, LOW);
    digitalWrite(MOTOR_RIGHT_IN1_PIN, LOW);
    digitalWrite(MOTOR_RIGHT_IN2_PIN, LOW);

    // Now attach PWM and immediately set duty to 0
    ledcAttach(MOTOR_LEFT_IN1_PIN, MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);
    ledcWrite(MOTOR_LEFT_IN1_PIN, 0);
    ledcAttach(MOTOR_LEFT_IN2_PIN, MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);
    ledcWrite(MOTOR_LEFT_IN2_PIN, 0);
    ledcAttach(MOTOR_RIGHT_IN1_PIN, MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);
    ledcWrite(MOTOR_RIGHT_IN1_PIN, 0);
    ledcAttach(MOTOR_RIGHT_IN2_PIN, MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);
    ledcWrite(MOTOR_RIGHT_IN2_PIN, 0);

    motorsCoast();

    // Initialize TB6600 Stepper Motor Driver (NEMA11 Linear Stepper)
    pinMode(STEPPER1_STEP_PIN, OUTPUT);
    pinMode(STEPPER1_DIR_PIN, OUTPUT);
    digitalWrite(STEPPER1_STEP_PIN, LOW);
    digitalWrite(STEPPER1_DIR_PIN, LOW);
    // ENA+ hardwired to GND - motor ALWAYS ENABLED (no pin control needed)

    // Set initial speed
    setStepper1Speed(800);  // 800 steps/second default
    Serial.println("[Stepper1] Top linear: GPIO " + String(STEPPER1_STEP_PIN) + "/" + String(STEPPER1_DIR_PIN) + ", " + String(stepper1Speed / STEPPER1_STEPS_PER_MM) + "mm/s");

    // Initialize Side Linear Stepper (Double)
    pinMode(STEPPER2_STEP_PIN, OUTPUT);
    pinMode(STEPPER2_DIR_PIN, OUTPUT);
    digitalWrite(STEPPER2_STEP_PIN, LOW);
    digitalWrite(STEPPER2_DIR_PIN, LOW);
    // ENA+ hardwired to GND - motor ALWAYS ENABLED (no pin control needed)

    // Set initial speed
    setStepper2Speed(1500);  // 1500 steps/second default (7.5mm/s)
    Serial.println("[Stepper2] Side linear: GPIO " + String(STEPPER2_STEP_PIN) + "/" + String(STEPPER2_DIR_PIN) + ", " + String(stepper2Speed / STEPPER2_STEPS_PER_MM) + "mm/s");

    // Initialize WS2812B LED Strip (NeoPixel)
    strip.begin();           // Initialize NeoPixel strip object
    strip.setBrightness(100); // Set moderate brightness to reduce power draw (0-255)
    strip.show();            // Initialize all pixels to 'off'

    Serial.println("[RGB] " + String(RGB_NUM_LEDS) + " LEDs on GPIO " + String(RGB_DATA_PIN));

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
    Serial.println("[Relay] 8-channel initialized, all OFF");

    // Initialize coin acceptor
    pinMode(COIN_SLOT_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(COIN_SLOT_PIN), handleCoinPulse, FALLING);

    // Initialize bill acceptor
    pinMode(BILL_PULSE_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(BILL_PULSE_PIN), handleBillPulse, FALLING);

    // Load totals from preferences
    totalCoinPesos = prefs.getUInt("totalCoinPesos", 0);
    totalBillPesos = prefs.getUInt("totalBillPesos", 0);
    totalPesos = totalCoinPesos + totalBillPesos;

    // Initialize device ID (persistent)
    deviceId = prefs.getString("deviceId", "");
    if (deviceId.length() == 0) {
        deviceId = generateDeviceId();
        prefs.putString("deviceId", deviceId);
    }

    // Check if device is paired
    isPaired = prefs.getBool("paired", false);

    // Generate pairing code if not paired
    if (!isPaired) {
        pairingCode = generatePairingCode();
    }

    Serial.println("\n--- Device Info ---");
    Serial.println("ID: " + deviceId);
    Serial.println("Paired: " + String(isPaired ? "Yes" : "No - Code: " + pairingCode));
    Serial.println("Money: " + String(totalPesos) + " PHP");
    Serial.println("-------------------\n");

    // Check if we have WiFi credentials
    String storedSSID = prefs.getString("ssid", "");

    if (storedSSID.length() == 0) {
        // No credentials - start SoftAP only (no ESP-NOW needed)
        Serial.println("[Setup] No WiFi credentials - starting SoftAP");
        startSoftAP();
    } else {
        // Has credentials - init ESP-NOW and connect WiFi
        Serial.println("[Setup] WiFi credentials found - connecting");
        WiFi.mode(WIFI_STA);
        delay(100);
        initESPNow();
        delay(100);
        sendCredentialsToCAM();
        connectWiFi();
    }
}

/* ===================== LOOP ===================== */
void loop() {
    // Handle WebSocket - MUST call loop() even when not connected for handshake
    webSocket.loop();

    // Note: ESP32-CAM communication is now via WebSocket (no serial)

    // Update servo positions for smooth non-blocking movement (dual servos)
    updateServoPositions();

    // Update stepper motor position for non-blocking movement
    updateStepper1Position();
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
            prefs.putUInt("totalCoinPesos", totalCoinPesos);

            Serial.println("[COIN] " + String(coinValue) + " PHP (Total: " + String(totalPesos) + " PHP)");

            if (isPaired && wsConnected) {
                String coinMsg = "{\"type\":\"coin-inserted\",\"deviceId\":\"" + deviceId + "\",\"coinValue\":" + String(coinValue) + ",\"totalPesos\":" + String(totalPesos) + "}";
                webSocket.sendTXT(coinMsg);
            }

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

            Serial.println("[BILL] " + String(billValue) + " PHP (Total: " + String(totalPesos) + " PHP)");

            // Send bill insertion event via WebSocket (only if paired)
            if (isPaired && wsConnected) {
                String billMsg = "{\"type\":\"bill-inserted\",\"deviceId\":\"" + deviceId + "\",\"billValue\":" + String(billValue) + ",\"totalPesos\":" + String(totalPesos) + "}";
                webSocket.sendTXT(billMsg);
            }

            // Reset pulse counter for next bill
            currentBillPulses = 0;
        }
    }

    // Retry sending credentials to CAM if not successful yet (handles simultaneous boot)
    if (!camIsReady && credentialSendAttempts > 0 && credentialSendAttempts < MAX_CREDENTIAL_ATTEMPTS) {
        if (millis() - lastCredentialSendTime >= CREDENTIAL_RETRY_INTERVAL) {
            Serial.println("[ESP-NOW] Retrying credential send (CAM may have booted late)...");
            sendCredentialsToCAM();
        }
    }

    // Serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd == "RESET_WIFI") {
            prefs.remove("ssid");
            prefs.remove("pass");
            Serial.println("WiFi reset, restarting...");
            delay(1000);
            ESP.restart();
        }
        else if (cmd == "RESET_PAIRING") {
            prefs.putBool("paired", false);
            isPaired = false;
            pairingCode = generatePairingCode();
            Serial.println("Pairing reset, code: " + pairingCode);
            delay(1000);
            ESP.restart();
        }
        else if (cmd == "RESET_MONEY") {
            totalCoinPesos = 0;
            totalBillPesos = 0;
            totalPesos = 0;
            currentCoinPulses = 0;
            currentBillPulses = 0;
            prefs.putUInt("totalCoinPesos", 0);
            prefs.putUInt("totalBillPesos", 0);
            Serial.println("Money counters reset");
        }
        else if (cmd == "STATUS") {
            Serial.println("\nDevice: " + deviceId);
            Serial.println("WiFi: " + String(wifiConnected ? WiFi.localIP().toString() : "Disconnected"));
            Serial.println("WS: " + String(wsConnected ? "OK" : "Down"));
            Serial.println("Paired: " + String(isPaired ? "Yes" : pairingCode));
            Serial.println("Money: " + String(totalPesos) + " PHP");
            Serial.println("Temp: " + String(currentTemperature) + "°C, Humidity: " + String(currentHumidity) + "%");
            Serial.println("Stepper1: " + String(currentStepper1Position / 10.0) + "mm" + (stepper1Moving ? " (moving)" : ""));
            Serial.println("Stepper2: " + String(currentStepper2Position / 10.0) + "mm" + (stepper2Moving ? " (moving)" : ""));
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
                            Serial.println("[ERROR] Use: RELAY_X_ON/OFF or RELAY_ALL_OFF");
                        }
                    } else {
                        Serial.println("[ERROR] Invalid channel (1-8)");
                    }
                } else {
                    Serial.println("[ERROR] Use: RELAY_X_ON/OFF or RELAY_ALL_OFF");
                }
            }
        }
        else if (cmd == "SERVO_DEMO") {
            setServoPositions(0);
            setServoPositions(90);
            setServoPositions(180);
            Serial.println("Servo demo started (0°→90°→180°)");
        }
        else if (cmd.startsWith("SERVO_")) {
            // Parse SERVO_XXX where XXX is angle for LEFT servo (0-180)
            // Right servo will mirror automatically
            String angleStr = cmd.substring(6);
            int angle = angleStr.toInt();

            if (angle >= 0 && angle <= 180) {
                setServoPositions(angle);
            } else {
                Serial.println("[ERROR] Angle 0-180 (use: SERVO_X)");
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
                    Serial.println("[ERROR] Speed -255 to 255 (use: MOTOR_X)");
                }
            }
        }
        else if (cmd.startsWith("STEPPER1_")) {
            // Stepper motor 1 commands
            String subCmd = cmd.substring(9);  // Remove "STEPPER1_"

            if (subCmd == "ENABLE" || subCmd == "DISABLE") {
                Serial.println("[Stepper1] Always enabled (ENA+ hardwired)");
            }
            else if (subCmd == "TEST_MANUAL") {
                Serial.println("[Stepper1] Testing 10 steps...");
                for (int i = 0; i < 10; i++) {
                    digitalWrite(STEPPER1_DIR_PIN, HIGH);
                    delayMicroseconds(5);
                    digitalWrite(STEPPER1_STEP_PIN, HIGH);
                    delayMicroseconds(20);
                    digitalWrite(STEPPER1_STEP_PIN, LOW);
                    delayMicroseconds(20);
                }
                Serial.println("[Stepper1] Test done");
            }
            else if (subCmd == "TEST_PINS") {
                // Test if pins are actually outputting
                Serial.println("[Top Linear] Pin Output Test (rapid pulses - non-blocking)");
                Serial.println("[Top Linear] Blinking STEP pin (GPIO " + String(STEPPER1_STEP_PIN) + ") 10 times");
                Serial.println("[Top Linear] Measure with oscilloscope or logic analyzer");

                for (int i = 0; i < 10; i++) {
                    digitalWrite(STEPPER1_STEP_PIN, HIGH);
                    Serial.println("[Top Linear] STEP pin HIGH (3.3V)");
                    delayMicroseconds(100);  // 100us pulse - visible on scope
                    digitalWrite(STEPPER1_STEP_PIN, LOW);
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
                    digitalWrite(STEPPER1_STEP_PIN, HIGH);
                    delayMicroseconds(20);
                    digitalWrite(STEPPER1_STEP_PIN, LOW);
                    delayMicroseconds(980);  // ~1000 pulses/sec
                }

                Serial.println("[Top Linear] Sent " + String(pulseCount) + " pulses in ~100ms");
                Serial.println("[Top Linear] Did TB6600 make buzzing noise? Did motor vibrate?");
            }
            else if (subCmd == "STOP") {
                stepper1Stop();
            }
            else if (subCmd == "HOME") {
                stepper1Home();
            }
            else if (subCmd == "INFO") {
                Serial.println("Pos: " + String(currentStepper1Position / 10.0) + "mm, Speed: " + String(stepper1Speed / 10) + "mm/s, Moving: " + String(stepper1Moving));
            }
            else if (subCmd.startsWith("SPEED_")) {
                // STEPPER1_SPEED_XXX - set speed in steps per second
                String speedStr = subCmd.substring(6);
                int speed = speedStr.toInt();
                if (speed > 0 && speed <= 800) {
                    setStepper1Speed(speed);
                } else {
                    Serial.println("[ERROR] Invalid stepper speed: " + speedStr);
                    Serial.println("Valid range: 1-800 steps/second (motor max: 80mm/s)");
                }
            }
            else if (subCmd.startsWith("MOVE_")) {
                // STEPPER1_MOVE_XXX - move relative steps
                String stepsStr = subCmd.substring(5);
                long steps = stepsStr.toInt();
                stepper1MoveRelative(steps);
            }
            else if (subCmd.startsWith("GOTO_")) {
                // STEPPER1_GOTO_XXX - move to absolute position
                String posStr = subCmd.substring(5);
                long position = posStr.toInt();
                stepper1MoveTo(position);
            }
            else if (subCmd.startsWith("MM_")) {
                // STEPPER1_MM_XXX - move by millimeters (can be negative)
                String mmStr = subCmd.substring(3);
                float mm = mmStr.toFloat();
                stepper1MoveByMM(mm);
            }
            else {
                Serial.println("[ERROR] Unknown stepper1 command");
            }
        }
        else if (cmd.startsWith("STEPPER2_")) {
            // Stepper motor 2 commands
            String subCmd = cmd.substring(9);  // Remove "STEPPER2_"

            if (subCmd == "ENABLE" || subCmd == "DISABLE") {
                Serial.println("[Stepper2] Always enabled (ENA+ hardwired)");
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
                if (speed > 0 && speed <= STEPPER2_MAX_SPEED) {
                    setStepper2Speed(speed);
                } else {
                    Serial.println("[ERROR] Invalid stepper2 speed: " + speedStr);
                    Serial.println("Valid range: 1-" + String(STEPPER2_MAX_SPEED) + " steps/second (motor max: 120mm/s)");
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
                Serial.println("[ERROR] Unknown stepper2 command");
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
                    Serial.println("[ERROR] Use: RGB_CUSTOM_R_G_B");
                }
            }
            else {
                Serial.println("[ERROR] Unknown RGB command");
            }
        }
        else if (cmd.startsWith("CAM_")) {
            // ESP32-CAM commands (via WebSocket)
            String subCmd = cmd.substring(4);

            if (subCmd == "BROADCAST") {
                Serial.println("[CAM] Broadcasting credentials via ESP-NOW...");
                sendCredentialsToCAM();
            }
            else if (subCmd == "CLASSIFY") {
                Serial.println("[CAM] Requesting classification via WebSocket...");
                requestClassificationFromCAM();
            }
            else {
                Serial.println("[ERROR] Unknown CAM command");
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

        // Broadcast credentials again (in case CAM booted after main board)
        Serial.println("[ESP-NOW] Re-broadcasting credentials to CAM (WiFi connected)...");
        delay(100);
        sendCredentialsToCAM();
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

    /* ================= SENSOR READINGS (BLOCKING) ================= */
    // Skip sensor readings when steppers are moving to prevent motor stuttering
    // pulseIn() blocks up to 30ms per ultrasonic, DHT22 blocks ~250ms
    if (!stepper1Moving && !stepper2Moving) {

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

            // Read both ultrasonic sensors (pulseIn blocks up to 30ms each)
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
    }

    /* ================= SERVICE HANDLING ================= */
    // Handle service timer, relay control, and RGB lights
    handleService();

    // Small yield to prevent watchdog timeout (allows ESP32 to handle WiFi/system tasks)
    yield();
}
