/* Edge Impulse Arduino examples
 * Copyright (c) 2022 EdgeImpulse Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Revised for SSCM 3-way binding:
 *   - ESP-NOW only (no WebSocket on CAM)
 *   - GroupToken-based pairing (automatic, no SETPAIR command needed)
 *   - MAC-lock after first valid pairing broadcast
 *   - Confidence threshold (0.55)
 *   - Optional HTTP MJPEG streaming at /stream and /snapshot
 */

/* Includes ---------------------------------------------------------------- */
#include <shoe_classification_inferencing.h>
#include "edge-impulse-sdk/dsp/image/image.hpp"

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <esp_now.h>
#include <esp_wifi.h>

// Select camera model
#define CAMERA_MODEL_ESP32S3_EYE // Has PSRAM

#if defined(CAMERA_MODEL_ESP32S3_EYE)
#define PWDN_GPIO_NUM  -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM  15
#define SIOD_GPIO_NUM  4
#define SIOC_GPIO_NUM  5

#define Y2_GPIO_NUM 11
#define Y3_GPIO_NUM 9
#define Y4_GPIO_NUM 8
#define Y5_GPIO_NUM 10
#define Y6_GPIO_NUM 12
#define Y7_GPIO_NUM 18
#define Y8_GPIO_NUM 17
#define Y9_GPIO_NUM 16

#define VSYNC_GPIO_NUM 6
#define HREF_GPIO_NUM  7
#define PCLK_GPIO_NUM  13
#else
#error "Camera model not selected"
#endif

/* ===================== SHARED ESP-NOW DEFINITIONS ===================== */
// These structs MUST match Thesis_SSCM.ino exactly.

// Pairing broadcast from main board to CAM
typedef struct {
    uint8_t  type;           // CAM_MSG_PAIR_REQUEST = 1
    char     groupToken[10]; // 8 hex chars + null terminator
    char     deviceId[24];   // Main board device ID (e.g., SSCM-ABC123)
    char     ssid[32];       // WiFi SSID for CAM to connect (streaming)
    char     password[64];   // WiFi password
    char     wsHost[64];     // Backend host (informational only)
    uint16_t wsPort;         // Backend port (informational only)
} PairingBroadcast;          // ~197 bytes — within 250-byte ESP-NOW limit

// Pairing acknowledgment from CAM to main board
typedef struct {
    uint8_t type;               // CAM_MSG_PAIR_ACK = 2
    char    camOwnDeviceId[24]; // e.g., SSCM-CAM-D4DB1C
    char    camIp[20];          // CAM's WiFi IP (empty string if not connected yet)
} PairingAck;                   // 45 bytes

// Runtime classification/control message (bidirectional)
typedef struct {
    uint8_t type;          // Message type constant
    uint8_t status;        // Status code constant
    char    shoeType[32];  // "sneaker", "leather", etc.
    float   confidence;    // 0.0 - 1.0
} CamMessage;              // 38 bytes — well within 250-byte limit

// Message type constants
#define CAM_MSG_PAIR_REQUEST      1  // Main board → CAM: pairing broadcast
#define CAM_MSG_PAIR_ACK          2  // CAM → Main board: pairing accepted
#define CAM_MSG_CLASSIFY_REQUEST  3  // Main board → CAM: run classifier
#define CAM_MSG_CLASSIFY_RESULT   4  // CAM → Main board: classifier output
#define CAM_MSG_STATUS_PING       5  // Main board → CAM: are you ready?
#define CAM_MSG_STATUS_PONG       6  // CAM → Main board: yes/no
#define CAM_MSG_LED_ENABLE        7  // Main board → CAM: classification light on
#define CAM_MSG_LED_DISABLE       8  // Main board → CAM: classification light off
#define CAM_MSG_FACTORY_RESET     9  // Main board → CAM: wipe all prefs and restart

// Status codes in CamMessage.status
#define CAM_STATUS_OK             0
#define CAM_STATUS_ERROR          1
#define CAM_STATUS_TIMEOUT        2
#define CAM_STATUS_BUSY           3
#define CAM_STATUS_NOT_READY      4
#define CAM_STATUS_LOW_CONFIDENCE 5

// Minimum confidence to accept a classification result
#define CONFIDENCE_THRESHOLD 0.55f

/* ===================== PREFERENCES ===================== */
Preferences prefs;

/* ===================== CAM IDENTITY ===================== */
String camOwnDeviceId = "";

/* ===================== ESP-NOW STATE ===================== */
uint8_t mainBoardMac[6]  = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}; // broadcast until paired
bool    mainBoardPaired  = false;
String  storedGroupToken = "";

/* ===================== PAIRING STATE ===================== */
bool          pairingAckPending  = false;
unsigned long pairingTime        = 0;
const unsigned long PAIRING_ACK_TIMEOUT_MS = 15000; // send ack after 15s even without WiFi

/* ===================== WIFI STATE ===================== */
bool          wifiConnected       = false;
bool          httpServerStarted   = false;
unsigned long wifiConnectStartMs  = 0;
String        camIp               = "";

/* ===================== CLASSIFICATION STATE ===================== */
volatile bool classificationRequested  = false;
bool          classificationInProgress = false;

/* ===================== FACTORY RESET STATE ===================== */
volatile bool factoryResetRequested = false;

/* ===================== CLASSIFICATION SETTINGS ===================== */
#define NUM_SCANS 5
#define SCAN_DELAY_MS 300
#define CLASSIFICATION_TIMEOUT_MS 15000

/* ===================== HTTP SERVER ===================== */
WebServer httpServer(80);
#define PART_BOUNDARY "frameboundary"

/* Constant defines -------------------------------------------------------- */
#define EI_CAMERA_RAW_FRAME_BUFFER_COLS           320
#define EI_CAMERA_RAW_FRAME_BUFFER_ROWS           240
#define EI_CAMERA_FRAME_BYTE_SIZE                 3

/* Private variables ------------------------------------------------------- */
static bool debug_nn    = false;
static bool is_initialised = false;
uint8_t *snapshot_buf; // points to the output of the capture

static camera_config_t camera_config = {
    .pin_pwdn  = PWDN_GPIO_NUM,
    .pin_reset = RESET_GPIO_NUM,
    .pin_xclk  = XCLK_GPIO_NUM,
    .pin_sscb_sda = SIOD_GPIO_NUM,
    .pin_sscb_scl = SIOC_GPIO_NUM,

    .pin_d7 = Y9_GPIO_NUM,
    .pin_d6 = Y8_GPIO_NUM,
    .pin_d5 = Y7_GPIO_NUM,
    .pin_d4 = Y6_GPIO_NUM,
    .pin_d3 = Y5_GPIO_NUM,
    .pin_d2 = Y4_GPIO_NUM,
    .pin_d1 = Y3_GPIO_NUM,
    .pin_d0 = Y2_GPIO_NUM,
    .pin_vsync = VSYNC_GPIO_NUM,
    .pin_href  = HREF_GPIO_NUM,
    .pin_pclk  = PCLK_GPIO_NUM,

    .xclk_freq_hz = 20000000,
    .ledc_timer   = LEDC_TIMER_0,
    .ledc_channel = LEDC_CHANNEL_0,

    .pixel_format = PIXFORMAT_JPEG,
    .frame_size   = FRAMESIZE_QVGA, // 320x240

    .jpeg_quality = 12,
    .fb_count     = 1,
    .fb_location  = CAMERA_FB_IN_PSRAM,
    .grab_mode    = CAMERA_GRAB_WHEN_EMPTY,
};

/* Function declarations --------------------------------------------------- */
bool   ei_camera_init(void);
void   ei_camera_deinit(void);
bool   ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf);
static int ei_camera_get_data(size_t offset, size_t length, float *out_ptr);

/* ===================== CAM DEVICE ID ===================== */
String generateCamOwnDeviceId() {
    uint64_t chipid = ESP.getEfuseMac();
    char id[24];
    snprintf(id, sizeof(id), "SSCM-CAM-%02X%02X%02X",
        (uint8_t)(chipid >> 16), (uint8_t)(chipid >> 8), (uint8_t)chipid);
    return String(id);
}

/* ===================== ESP-NOW HELPERS ===================== */

void addPeerIfNeeded(uint8_t* mac) {
    if (!esp_now_is_peer_exist(mac)) {
        esp_now_peer_info_t peer;
        memset(&peer, 0, sizeof(peer));
        memcpy(peer.peer_addr, mac, 6);
        peer.channel = 0;
        peer.encrypt = false;
        esp_now_add_peer(&peer);
    }
}

// Send CamMessage to the paired main board
void sendCamMessage(uint8_t type, uint8_t status, const char* shoeType, float confidence) {
    if (!mainBoardPaired) return;

    CamMessage msg;
    memset(&msg, 0, sizeof(msg));
    msg.type      = type;
    msg.status    = status;
    msg.confidence = confidence;
    if (shoeType) strncpy(msg.shoeType, shoeType, sizeof(msg.shoeType) - 1);

    addPeerIfNeeded(mainBoardMac);
    esp_now_send(mainBoardMac, (uint8_t*)&msg, sizeof(msg));
}

// Send PairingAck to the main board that paired us
void sendPairingAck(uint8_t* targetMac) {
    PairingAck ack;
    memset(&ack, 0, sizeof(ack));
    ack.type = CAM_MSG_PAIR_ACK;
    strncpy(ack.camOwnDeviceId, camOwnDeviceId.c_str(), sizeof(ack.camOwnDeviceId) - 1);
    if (camIp.length() > 0) {
        strncpy(ack.camIp, camIp.c_str(), sizeof(ack.camIp) - 1);
    }

    addPeerIfNeeded(targetMac);
    esp_err_t res = esp_now_send(targetMac, (uint8_t*)&ack, sizeof(ack));

    Serial.println("[ESP-NOW] Sent PairingAck (" + String(res == ESP_OK ? "OK" : "FAIL") + ")");
    if (camIp.length() > 0) {
        Serial.println("[ESP-NOW] Reported CAM IP: " + camIp);
    } else {
        Serial.println("[ESP-NOW] WiFi not connected yet — IP will be sent when connected");
    }
}

/* ===================== ESP-NOW SEND CALLBACK ===================== */
void onDataSent(const wifi_tx_info_t *tx_info, esp_now_send_status_t status) {
    if (status != ESP_NOW_SEND_SUCCESS) {
        Serial.println("[ESP-NOW] Send failed");
    }
}

/* ===================== ESP-NOW RECEIVE CALLBACK ===================== */
// IMPORTANT: This runs in the WiFi task. Keep it lightweight — only set flags,
// send short responses. Never run classification from here.
void onDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *data, int len) {
    if (len < 1) return;

    uint8_t  msgType   = data[0];
    uint8_t* senderMac = recv_info->src_addr;

    // ============================================================
    // PAIRING REQUEST (type 1): Accept first valid groupToken broadcast
    // ============================================================
    if (msgType == CAM_MSG_PAIR_REQUEST) {
        if (len < (int)sizeof(PairingBroadcast)) {
            Serial.println("[ESP-NOW] PairingBroadcast too small: " + String(len));
            return;
        }

        PairingBroadcast pb;
        memcpy(&pb, data, sizeof(PairingBroadcast));

        Serial.println("\n[ESP-NOW] Pairing request from: " + String(pb.deviceId));

        // If already paired to a DIFFERENT board, ignore
        if (mainBoardPaired) {
            bool sameBoard = (memcmp(senderMac, mainBoardMac, 6) == 0);
            if (!sameBoard) {
                Serial.println("[ESP-NOW] Already paired to different board — ignored");
                return;
            }
            Serial.println("[ESP-NOW] Re-pair from known board — updating credentials");
        }

        // Validate groupToken: must be exactly 8 uppercase hex characters
        String token = String(pb.groupToken);
        token.toUpperCase();
        if (token.length() != 8) {
            Serial.println("[ESP-NOW] Invalid groupToken length: '" + token + "'");
            return;
        }
        bool tokenValid = true;
        for (int i = 0; i < 8; i++) {
            char c = token[i];
            if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F'))) {
                tokenValid = false;
                break;
            }
        }
        if (!tokenValid) {
            Serial.println("[ESP-NOW] Invalid groupToken chars: '" + token + "'");
            return;
        }

        // Store credentials in NVS
        prefs.putString("ssid",        String(pb.ssid));
        prefs.putString("pass",        String(pb.password));
        prefs.putString("wsHost",      String(pb.wsHost));
        prefs.putUInt("wsPort",        pb.wsPort);
        prefs.putString("groupToken",  token);
        prefs.putString("mainId",      String(pb.deviceId));

        storedGroupToken = token;

        // MAC-lock: only accept future messages from this board
        memcpy(mainBoardMac, senderMac, 6);
        prefs.putBytes("mainMac", mainBoardMac, 6);
        mainBoardPaired = true;

        Serial.println("[ESP-NOW] Paired with main board: " + String(pb.deviceId));
        Serial.println("[ESP-NOW] GroupToken: " + storedGroupToken);
        Serial.printf("[ESP-NOW] Main board MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
            mainBoardMac[0], mainBoardMac[1], mainBoardMac[2],
            mainBoardMac[3], mainBoardMac[4], mainBoardMac[5]);

        // Start non-blocking WiFi connection
        String ssid = String(pb.ssid);
        String pass = String(pb.password);
        if (ssid.length() > 0) {
            WiFi.begin(ssid.c_str(), pass.c_str());
            wifiConnectStartMs = millis();
            Serial.println("[WiFi] Connecting to: " + ssid);
        }

        // Schedule PairingAck — sent from main loop once WiFi connects (or timeout)
        pairingAckPending = true;
        pairingTime       = millis();

        return;
    }

    // ============================================================
    // RUNTIME MESSAGES: Must come from the paired main board
    // ============================================================
    if (!mainBoardPaired) {
        Serial.println("[ESP-NOW] Not paired — ignoring runtime message type " + String(msgType));
        return;
    }

    if (memcmp(senderMac, mainBoardMac, 6) != 0) {
        Serial.println("[ESP-NOW] Message from unknown MAC — ignored");
        return;
    }

    if (len < (int)sizeof(CamMessage)) {
        Serial.println("[ESP-NOW] CamMessage too small: " + String(len));
        return;
    }

    CamMessage msg;
    memcpy(&msg, data, sizeof(CamMessage));

    switch (msg.type) {

        case CAM_MSG_CLASSIFY_REQUEST:
            Serial.println("[ESP-NOW] CLASSIFY_REQUEST received");
            if (!is_initialised) {
                sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_NOT_READY, "", 0.0f);
            } else if (classificationInProgress) {
                sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_BUSY, "", 0.0f);
            } else {
                // Set flag — classification runs from main loop for safety
                classificationRequested = true;
            }
            break;

        case CAM_MSG_STATUS_PING:
            Serial.println("[ESP-NOW] STATUS_PING received");
            sendCamMessage(CAM_MSG_STATUS_PONG,
                is_initialised ? CAM_STATUS_OK : CAM_STATUS_NOT_READY,
                "", 0.0f);
            break;

        case CAM_MSG_LED_ENABLE:
            Serial.println("[ESP-NOW] LED_ENABLE (classification lighting)");
            // No built-in LED on ESP32-S3 Eye for this purpose
            break;

        case CAM_MSG_LED_DISABLE:
            Serial.println("[ESP-NOW] LED_DISABLE");
            break;

        case CAM_MSG_FACTORY_RESET:
            // Set flag — handled from main loop (unsafe to call prefs/restart from WiFi task)
            Serial.println("[ESP-NOW] FACTORY_RESET received — will reset after callback");
            factoryResetRequested = true;
            break;

        default:
            Serial.println("[ESP-NOW] Unknown message type: " + String(msg.type));
            break;
    }
}

/* ===================== HTTP STREAM SERVER ===================== */

void handleStream() {
    WiFiClient client = httpServer.client();

    // Send multipart stream header
    client.print("HTTP/1.1 200 OK\r\n");
    client.print("Content-Type: multipart/x-mixed-replace; boundary=" PART_BOUNDARY "\r\n");
    client.print("Cache-Control: no-cache\r\n");
    client.print("Connection: keep-alive\r\n\r\n");

    Serial.println("[Stream] Client connected");
    int frameCount = 0;

    while (client.connected()) {
        // Yield to other tasks (WiFi, ESP-NOW)
        yield();

        // If classification requested, break so loop() can handle it
        if (classificationRequested) {
            Serial.println("[Stream] Classification requested — ending stream");
            break;
        }

        camera_fb_t* fb = esp_camera_fb_get();
        if (!fb) {
            delay(100);
            continue;
        }

        // Send frame boundary
        client.print("\r\n--" PART_BOUNDARY "\r\n");
        client.print("Content-Type: image/jpeg\r\n");
        client.printf("Content-Length: %u\r\n\r\n", fb->len);

        // Write JPEG data directly
        client.write(fb->buf, fb->len);

        esp_camera_fb_return(fb);
        frameCount++;

        delay(50); // ~20 FPS max
    }

    Serial.println("[Stream] Client disconnected after " + String(frameCount) + " frames");
}

void handleSnapshot() {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        httpServer.send(500, "text/plain", "Camera capture failed");
        return;
    }

    httpServer.sendHeader("Content-Type", "image/jpeg");
    httpServer.sendHeader("Content-Length", String(fb->len));
    httpServer.sendHeader("Cache-Control", "no-cache");
    httpServer.send_P(200, "image/jpeg", (const char*)fb->buf, fb->len);

    esp_camera_fb_return(fb);
    Serial.println("[Snapshot] Served " + String(fb->len) + " bytes");
}

void handleRoot() {
    String page  = "<!DOCTYPE html><html><body>";
    page        += "<h2>SSCM CAM — " + camOwnDeviceId + "</h2>";
    page        += "<p>WiFi IP: " + (wifiConnected ? WiFi.localIP().toString() : "not connected") + "</p>";
    page        += "<p>Camera: " + String(is_initialised ? "Ready" : "Not initialized") + "</p>";
    page        += "<p>Paired to: " + (mainBoardPaired ? prefs.getString("mainId", "?") : "Not paired") + "</p>";
    page        += "<p><a href=\"/stream\">Live Stream</a></p>";
    page        += "<p><a href=\"/snapshot\">Snapshot</a></p>";
    page        += "</body></html>";
    httpServer.send(200, "text/html", page);
}

void setupHTTPServer() {
    httpServer.on("/",        HTTP_GET, handleRoot);
    httpServer.on("/stream",  HTTP_GET, handleStream);
    httpServer.on("/snapshot", HTTP_GET, handleSnapshot);
    httpServer.begin();
    httpServerStarted = true;
    camIp = WiFi.localIP().toString();
    Serial.println("[HTTP] Server started at: http://" + camIp);
}

/* ===================== WIFI EVENT HANDLERS ===================== */

void onWiFiConnected(WiFiEvent_t event, WiFiEventInfo_t info) {
    Serial.println("[WiFi] Connected to AP");
}

void onWiFiGotIP(WiFiEvent_t event, WiFiEventInfo_t info) {
    wifiConnected = true;
    camIp = WiFi.localIP().toString();
    Serial.println("[WiFi] Got IP: " + camIp);
    // HTTP server and PairingAck will be started from main loop
    // (safer to do from Arduino task, not WiFi event task)
}

void onWiFiDisconnected(WiFiEvent_t event, WiFiEventInfo_t info) {
    wifiConnected     = false;
    httpServerStarted = false;
    camIp             = "";
    Serial.println("[WiFi] Disconnected — reconnecting...");

    // Reconnect using stored credentials
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    if (ssid.length() > 0) {
        WiFi.begin(ssid.c_str(), pass.c_str());
        wifiConnectStartMs = millis();
    }
}

/* ===================== CLASSIFICATION ===================== */

void runClassificationAndRespond() {
    Serial.println("\n=== Starting Classification (" + String(NUM_SCANS) + " scans) ===");

    float classConfidences[EI_CLASSIFIER_LABEL_COUNT] = {0};
    int   successfulScans = 0;
    unsigned long startTime = millis();

    for (int scan = 0; scan < NUM_SCANS; scan++) {
        if (millis() - startTime >= CLASSIFICATION_TIMEOUT_MS) {
            Serial.println("[Classification] Timeout");
            sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_TIMEOUT, "", 0.0f);
            return;
        }

        Serial.println("Scan " + String(scan + 1) + "/" + String(NUM_SCANS));

        snapshot_buf = (uint8_t*)malloc(
            EI_CAMERA_RAW_FRAME_BUFFER_COLS *
            EI_CAMERA_RAW_FRAME_BUFFER_ROWS *
            EI_CAMERA_FRAME_BYTE_SIZE);

        if (!snapshot_buf) {
            ei_printf("ERR: Failed to allocate snapshot buffer!\n");
            continue;
        }

        ei::signal_t signal;
        signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
        signal.get_data     = &ei_camera_get_data;

        if (!ei_camera_capture(EI_CLASSIFIER_INPUT_WIDTH, EI_CLASSIFIER_INPUT_HEIGHT, snapshot_buf)) {
            ei_printf("Failed to capture image\r\n");
            free(snapshot_buf);
            continue;
        }

        ei_impulse_result_t result = {0};
        EI_IMPULSE_ERROR err = run_classifier(&signal, &result, debug_nn);

        if (err != EI_IMPULSE_OK) {
            ei_printf("ERR: Failed to run classifier (%d)\n", err);
            free(snapshot_buf);
            continue;
        }

        successfulScans++;
        for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
            classConfidences[i] += result.classification[i].value;
            Serial.println("  " + String(ei_classifier_inferencing_categories[i]) +
                           ": " + String(result.classification[i].value, 4));
        }

        free(snapshot_buf);

        if (scan < NUM_SCANS - 1) delay(SCAN_DELAY_MS);
    }

    Serial.println("Successful scans: " + String(successfulScans) + "/" + String(NUM_SCANS));

    if (successfulScans == 0) {
        sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_ERROR, "", 0.0f);
        return;
    }

    // Find class with highest average confidence
    float highestAvg = 0.0f;
    int   bestIndex  = 0;
    Serial.println("\nAverage confidences:");
    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        float avg = classConfidences[i] / successfulScans;
        Serial.println("  " + String(ei_classifier_inferencing_categories[i]) +
                       ": " + String(avg, 4));
        if (avg > highestAvg) { highestAvg = avg; bestIndex = i; }
    }

    String bestLabel = String(ei_classifier_inferencing_categories[bestIndex]);
    Serial.println("\n>>> RESULT: " + bestLabel + " (" + String(highestAvg * 100, 1) + "%)");

    // Apply confidence threshold
    if (highestAvg < CONFIDENCE_THRESHOLD) {
        Serial.println("[Classification] LOW CONFIDENCE (" + String(highestAvg * 100, 1) +
                       "% < " + String(CONFIDENCE_THRESHOLD * 100, 0) + "%)");
        sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_LOW_CONFIDENCE,
                       bestLabel.c_str(), highestAvg);
        return;
    }

    sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_OK,
                   bestLabel.c_str(), highestAvg);
    Serial.println("=== Classification Complete ===\n");
}

/* ===================== FACTORY RESET ===================== */
void factoryReset() {
    Serial.println("[FactoryReset] Clearing all preferences...");
    prefs.clear();
    Serial.println("[FactoryReset] Done. Restarting...");
    delay(500);
    ESP.restart();
}

/* ===================== SETUP ===================== */

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n=================================");
    Serial.println("  ESP32-S3 CAM Shoe Classifier");
    Serial.println("  ESP-NOW + HTTP Stream Edition");
    Serial.println("=================================\n");

    prefs.begin("cam", false);

    // Factory reset via BOOT button (GPIO0) held at power-on for 3s
    pinMode(0, INPUT_PULLUP);
    if (digitalRead(0) == LOW) {
        Serial.println("[Setup] BOOT button held — hold 3s to confirm factory reset...");
        delay(3000);
        if (digitalRead(0) == LOW) {
            Serial.println("[Setup] Confirmed — triggering factory reset!");
            factoryReset();
        }
        Serial.println("[Setup] BOOT button released — factory reset cancelled");
    }

    // Generate CAM's own permanent device ID
    camOwnDeviceId = generateCamOwnDeviceId();
    Serial.println("[Startup] CAM Device ID: " + camOwnDeviceId);

    // Load stored pairing state
    size_t macLen = prefs.getBytes("mainMac", mainBoardMac, 6);
    bool macValid = (macLen == 6 &&
        !(mainBoardMac[0] == 0x00 && mainBoardMac[1] == 0x00 &&
          mainBoardMac[2] == 0x00 && mainBoardMac[3] == 0x00 &&
          mainBoardMac[4] == 0x00 && mainBoardMac[5] == 0x00) &&
        !(mainBoardMac[0] == 0xFF && mainBoardMac[1] == 0xFF &&
          mainBoardMac[2] == 0xFF && mainBoardMac[3] == 0xFF &&
          mainBoardMac[4] == 0xFF && mainBoardMac[5] == 0xFF));

    if (macValid) {
        mainBoardPaired = true;
        Serial.printf("[Startup] Paired to main board MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
            mainBoardMac[0], mainBoardMac[1], mainBoardMac[2],
            mainBoardMac[3], mainBoardMac[4], mainBoardMac[5]);
    } else {
        memset(mainBoardMac, 0xFF, 6); // broadcast
        Serial.println("[Startup] Not paired — waiting for main board pairing broadcast");
    }

    storedGroupToken = prefs.getString("groupToken", "");
    if (storedGroupToken.length() > 0) {
        Serial.println("[Startup] GroupToken: " + storedGroupToken);
    }

    // Register WiFi event handlers (runs in WiFi task, so keep them lightweight)
    WiFi.onEvent(onWiFiConnected,    ARDUINO_EVENT_WIFI_STA_CONNECTED);
    WiFi.onEvent(onWiFiGotIP,        ARDUINO_EVENT_WIFI_STA_GOT_IP);
    WiFi.onEvent(onWiFiDisconnected, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

    // STA mode required for ESP-NOW + WiFi coexistence
    WiFi.mode(WIFI_STA);
    delay(200);
    Serial.println("[WiFi] Mode: STA | MAC: " + WiFi.macAddress());

    // Initialize ESP-NOW
    if (esp_now_init() != ESP_OK) {
        Serial.println("[ESP-NOW] Init FAILED!");
    } else {
        esp_now_register_send_cb(onDataSent);
        esp_now_register_recv_cb(onDataRecv);
        Serial.println("[ESP-NOW] Initialized — listening for pairing broadcast");
    }

    // If already paired, add main board as ESP-NOW peer for sending
    if (mainBoardPaired) {
        esp_now_peer_info_t peer;
        memset(&peer, 0, sizeof(peer));
        memcpy(peer.peer_addr, mainBoardMac, 6);
        peer.channel = 0;
        peer.encrypt = false;
        esp_now_add_peer(&peer);
        Serial.println("[ESP-NOW] Added main board as peer");
    }

    // Start WiFi if credentials are available
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    if (ssid.length() > 0) {
        WiFi.begin(ssid.c_str(), pass.c_str());
        wifiConnectStartMs = millis();
        Serial.println("[WiFi] Connecting to: " + ssid);
    } else {
        Serial.println("[WiFi] No credentials — waiting for pairing broadcast");
    }

    // Initialize camera
    if (!ei_camera_init()) {
        Serial.println("[Camera] Init FAILED");
    } else {
        Serial.println("[Camera] Initialized");
    }

    Serial.println("\n--- Serial Commands ---");
    Serial.println("CLASSIFY      - Run local classification test");
    Serial.println("STATUS        - Show device status");
    Serial.println("UNPAIR        - Clear MAC pairing and groupToken");
    Serial.println("CLEAR         - Clear all stored data (restart required)");
    Serial.println("FACTORY_RESET - Wipe all prefs and restart");
    Serial.println("-----------------------\n");
}

/* ===================== LOOP ===================== */

void loop() {
    // --- HTTP server ---
    if (wifiConnected && httpServerStarted) {
        httpServer.handleClient();
    }

    // --- Start HTTP server when WiFi first connects ---
    if (wifiConnected && !httpServerStarted) {
        setupHTTPServer();
    }

    // --- Send pending PairingAck ---
    // Send immediately once WiFi is up, or after timeout (without IP)
    if (pairingAckPending) {
        bool wifiReady  = wifiConnected && camIp.length() > 0;
        bool timedOut   = (millis() - pairingTime) >= PAIRING_ACK_TIMEOUT_MS;

        if (wifiReady || timedOut) {
            if (timedOut && !wifiReady) {
                Serial.println("[Pairing] WiFi timeout — sending ack without IP");
            }
            sendPairingAck(mainBoardMac);
            pairingAckPending = false;
        }
    }

    // --- Factory reset (deferred from ESP-NOW callback — unsafe to run in WiFi task) ---
    if (factoryResetRequested) {
        factoryResetRequested = false;
        factoryReset();
    }

    // --- Classification (runs from Arduino task, not ESP-NOW callback) ---
    if (classificationRequested && !classificationInProgress) {
        classificationRequested  = false;
        classificationInProgress = true;
        runClassificationAndRespond();
        classificationInProgress = false;
    }

    // --- Serial commands ---
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd == "CLASSIFY" || cmd == "TEST") {
            if (!is_initialised) {
                Serial.println("[Classify] Camera not initialized");
            } else if (classificationInProgress) {
                Serial.println("[Classify] Already in progress");
            } else {
                classificationInProgress = true;
                runClassificationAndRespond();
                classificationInProgress = false;
            }
        }
        else if (cmd == "STATUS") {
            Serial.println("\n=== CAM Status ===");
            Serial.println("Device ID:   " + camOwnDeviceId);
            Serial.println("Camera:      " + String(is_initialised ? "Ready" : "Not initialized"));
            Serial.println("WiFi:        " + String(wifiConnected ? camIp : "Disconnected"));
            Serial.println("HTTP Server: " + String(httpServerStarted ? "Running at http://" + camIp : "Stopped"));
            Serial.println("GroupToken:  " + (storedGroupToken.length() > 0 ? storedGroupToken : "none"));
            Serial.println("Paired:      " + String(mainBoardPaired ? "YES" : "NO"));
            if (mainBoardPaired) {
                Serial.printf("Main MAC:    %02X:%02X:%02X:%02X:%02X:%02X\n",
                    mainBoardMac[0], mainBoardMac[1], mainBoardMac[2],
                    mainBoardMac[3], mainBoardMac[4], mainBoardMac[5]);
                Serial.println("Main ID:     " + prefs.getString("mainId", "?"));
            }
            Serial.println("==================\n");
        }
        else if (cmd == "UNPAIR") {
            prefs.remove("mainMac");
            prefs.remove("groupToken");
            prefs.remove("mainId");
            mainBoardPaired  = false;
            storedGroupToken = "";
            memset(mainBoardMac, 0xFF, 6);
            Serial.println("[UNPAIR] MAC and groupToken cleared. Restart to take effect.");
        }
        else if (cmd == "CLEAR") {
            prefs.clear();
            Serial.println("[CLEAR] All NVS data cleared. Restart required.");
        }
        else if (cmd == "FACTORY_RESET") {
            Serial.println("[Serial] Factory reset command received!");
            factoryReset();
        }
    }

    delay(5);
}

/* ===================================================================
 * EDGE IMPULSE CAMERA FUNCTIONS (unchanged from original)
 * =================================================================== */

bool ei_camera_init(void) {
    if (is_initialised) return true;

    esp_err_t err = esp_camera_init(&camera_config);
    if (err != ESP_OK) {
        Serial.printf("Camera init failed with error 0x%x\n", err);
        return false;
    }

    sensor_t* s = esp_camera_sensor_get();
    if (s->id.PID == OV3660_PID) {
        s->set_brightness(s, 1);
        s->set_saturation(s, 0);
    }
    s->set_vflip(s, 1);  // Flip vertically (camera mounted upside down)

    is_initialised = true;
    return true;
}

void ei_camera_deinit(void) {
    esp_err_t err = esp_camera_deinit();
    if (err != ESP_OK) {
        ei_printf("Camera deinit failed\n");
        return;
    }
    is_initialised = false;
}

bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf) {
    bool do_resize = false;

    if (!is_initialised) {
        ei_printf("ERR: Camera is not initialized\r\n");
        return false;
    }

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        ei_printf("Camera capture failed\n");
        return false;
    }

    bool converted = fmt2rgb888(fb->buf, fb->len, PIXFORMAT_JPEG, snapshot_buf);
    esp_camera_fb_return(fb);

    if (!converted) {
        ei_printf("Conversion failed\n");
        return false;
    }

    if ((img_width != EI_CAMERA_RAW_FRAME_BUFFER_COLS) ||
        (img_height != EI_CAMERA_RAW_FRAME_BUFFER_ROWS)) {
        do_resize = true;
    }

    if (do_resize) {
        ei::image::processing::crop_and_interpolate_rgb888(
            out_buf,
            EI_CAMERA_RAW_FRAME_BUFFER_COLS,
            EI_CAMERA_RAW_FRAME_BUFFER_ROWS,
            out_buf,
            img_width,
            img_height);
    }

    return true;
}

static int ei_camera_get_data(size_t offset, size_t length, float *out_ptr) {
    size_t pixel_ix   = offset * 3;
    size_t pixels_left = length;
    size_t out_ptr_ix  = 0;

    while (pixels_left != 0) {
        // Swap BGR → RGB
        out_ptr[out_ptr_ix] = (snapshot_buf[pixel_ix + 2] << 16) +
                              (snapshot_buf[pixel_ix + 1] << 8)  +
                               snapshot_buf[pixel_ix];
        out_ptr_ix++;
        pixel_ix    += 3;
        pixels_left--;
    }
    return 0;
}

#if !defined(EI_CLASSIFIER_SENSOR) || EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_CAMERA
#error "Invalid model for current sensor"
#endif
