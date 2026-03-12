/*
 * SSCM CAM Firmware — Gemini HTTP Classification Edition
 *
 * Replaces Edge Impulse local inference with HTTP POST to backend.
 * CAM captures a JPEG and POSTs it to /api/device/[mainId]/classify.
 * Backend calls Gemini and broadcasts the result via WebSocket.
 * CAM ACKs the main board with CAM_STATUS_API_HANDLED (6) via ESP-NOW.
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <HTTPClient.h>

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
    char     wsHost[64];     // Backend host
    uint16_t wsPort;         // Backend port
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
    char    shoeType[32];  // unused in Gemini path
    float   confidence;    // unused in Gemini path
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
#define CAM_STATUS_API_HANDLED    6  // Gemini path — backend handles result broadcast

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
const unsigned long PAIRING_ACK_TIMEOUT_MS = 15000;

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

/* ===================== CAMERA INIT STATE ===================== */
static bool is_initialised = false;

/* ===================== HTTP SERVER ===================== */
WebServer httpServer(80);
#define PART_BOUNDARY "frameboundary"

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
    .frame_size   = FRAMESIZE_XGA,  // 1024x768 — stable, 3x more detail than SVGA, no overflow

    .jpeg_quality = 6,              // 0=best quality; 6 is sharp without bloating file size
    .fb_count     = 1,
    .fb_location  = CAMERA_FB_IN_PSRAM,
    .grab_mode    = CAMERA_GRAB_WHEN_EMPTY,
};

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

        if (mainBoardPaired) {
            bool sameBoard = (memcmp(senderMac, mainBoardMac, 6) == 0);
            if (!sameBoard) {
                Serial.println("[ESP-NOW] Already paired to different board — ignored");
                return;
            }
            Serial.println("[ESP-NOW] Re-pair from known board — updating credentials");
        }

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

        prefs.putString("ssid",        String(pb.ssid));
        prefs.putString("pass",        String(pb.password));
        prefs.putString("wsHost",      String(pb.wsHost));
        prefs.putUInt("wsPort",        pb.wsPort);
        prefs.putString("groupToken",  token);
        prefs.putString("mainId",      String(pb.deviceId));

        storedGroupToken = token;

        memcpy(mainBoardMac, senderMac, 6);
        prefs.putBytes("mainMac", mainBoardMac, 6);
        mainBoardPaired = true;

        Serial.println("[ESP-NOW] Paired with main board: " + String(pb.deviceId));
        Serial.println("[ESP-NOW] GroupToken: " + storedGroupToken);
        Serial.printf("[ESP-NOW] Main board MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
            mainBoardMac[0], mainBoardMac[1], mainBoardMac[2],
            mainBoardMac[3], mainBoardMac[4], mainBoardMac[5]);

        String ssid = String(pb.ssid);
        String pass = String(pb.password);
        if (ssid.length() > 0) {
            WiFi.begin(ssid.c_str(), pass.c_str());
            wifiConnectStartMs = millis();
            Serial.println("[WiFi] Connecting to: " + ssid);
        }

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
            break;

        case CAM_MSG_LED_DISABLE:
            Serial.println("[ESP-NOW] LED_DISABLE");
            break;

        case CAM_MSG_FACTORY_RESET:
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

    client.print("HTTP/1.1 200 OK\r\n");
    client.print("Content-Type: multipart/x-mixed-replace; boundary=" PART_BOUNDARY "\r\n");
    client.print("Cache-Control: no-cache\r\n");
    client.print("Connection: keep-alive\r\n\r\n");

    Serial.println("[Stream] Client connected");
    int frameCount = 0;

    while (client.connected()) {
        yield();

        if (classificationRequested) {
            Serial.println("[Stream] Classification requested — ending stream");
            break;
        }

        camera_fb_t* fb = esp_camera_fb_get();
        if (!fb) {
            delay(100);
            continue;
        }

        client.print("\r\n--" PART_BOUNDARY "\r\n");
        client.print("Content-Type: image/jpeg\r\n");
        client.printf("Content-Length: %u\r\n\r\n", fb->len);
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
}

void onWiFiDisconnected(WiFiEvent_t event, WiFiEventInfo_t info) {
    wifiConnected     = false;
    httpServerStarted = false;
    camIp             = "";
    Serial.println("[WiFi] Disconnected — reconnecting...");

    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    if (ssid.length() > 0) {
        WiFi.begin(ssid.c_str(), pass.c_str());
        wifiConnectStartMs = millis();
    }
}

/* ===================== CLASSIFICATION — Gemini HTTP path ===================== */

void captureAndPostToBackend() {
    Serial.println("\n=== Capturing JPEG for Gemini classification ===");

    if (!is_initialised) {
        Serial.println("[Classify] Camera not initialized");
        sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_NOT_READY, "", 0.0f);
        return;
    }

    // Drain all buffered frames (fb_count=2) so we capture a truly fresh frame
    for (int i = 0; i < 3; i++) {
        camera_fb_t* stale = esp_camera_fb_get();
        if (stale) esp_camera_fb_return(stale);
    }
    delay(500); // Let AEC settle — extra time needed with bright LED strip in chamber

    // Capture the actual frame
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[Classify] Camera capture failed");
        sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_ERROR, "", 0.0f);
        return;
    }

    Serial.printf("[Classify] Captured %u bytes\n", fb->len);

    // Read backend connection info from prefs
    String wsHost   = prefs.getString("wsHost", "");
    uint16_t wsPort = prefs.getUInt("wsPort", 3000);
    String mainId   = prefs.getString("mainId", "");
    String token    = storedGroupToken;

    if (wsHost.isEmpty() || mainId.isEmpty() || token.isEmpty()) {
        Serial.println("[Classify] Missing prefs (wsHost/mainId/groupToken) — not paired?");
        esp_camera_fb_return(fb);
        sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_ERROR, "", 0.0f);
        return;
    }

    String url = "http://" + wsHost + ":" + String(wsPort) +
                 "/api/device/" + mainId + "/classify";
    Serial.println("[Classify] POST → " + url);

    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "image/jpeg");
    http.addHeader("X-Group-Token", token);
    http.setTimeout(20000); // 20s — Gemini can be slow on free tier

    int httpCode = http.sendRequest("POST", fb->buf, fb->len);
    esp_camera_fb_return(fb); // Free buffer immediately after POST

    if (httpCode > 0) {
        Serial.printf("[Classify] HTTP %d\n", httpCode);
    } else {
        Serial.println("[Classify] HTTP request failed: " + http.errorToString(httpCode));
    }

    http.end();

    // ACK the main board regardless of HTTP outcome
    // Backend is responsible for broadcasting the result or error to the tablet
    sendCamMessage(CAM_MSG_CLASSIFY_RESULT, CAM_STATUS_API_HANDLED, "", 0.0f);
    Serial.println("=== Classification POST complete — backend handles result ===\n");
}

/* ===================== FACTORY RESET ===================== */
void factoryReset() {
    Serial.println("[FactoryReset] Clearing all preferences...");
    prefs.clear();
    Serial.println("[FactoryReset] Done. Restarting...");
    delay(500);
    ESP.restart();
}

/* ===================== CAMERA INIT ===================== */

bool camera_init(void) {
    if (is_initialised) return true;

    esp_err_t err = esp_camera_init(&camera_config);
    if (err != ESP_OK) {
        Serial.printf("Camera init failed with error 0x%x\n", err);
        return false;
    }

    sensor_t* s = esp_camera_sensor_get();
    Serial.printf("[Camera] Sensor PID: 0x%04X\n", s->id.PID);

    // OV5640 — 5MP sensor on Aideepen ESP32-S3-CAM
    if (s->id.PID == OV5640_PID) {
        Serial.println("[Camera] OV5640 detected");
        s->set_vflip(s, 1);             // Flip vertically (camera mounted upside down)
        s->set_hmirror(s, 0);

        // Auto exposure — slight compensation for bright LED strip
        s->set_exposure_ctrl(s, 1);     // Auto exposure ON
        s->set_aec2(s, 0);              // Disable night-mode AEC
        s->set_ae_level(s, -1);         // Slight underexposure to avoid LED blowout
        s->set_gain_ctrl(s, 1);         // Auto gain ON
        s->set_gainceiling(s, GAINCEILING_4X);

        // White balance
        s->set_whitebal(s, 1);
        s->set_awb_gain(s, 1);
        s->set_wb_mode(s, 0);           // Auto WB

        // Image quality — balanced, not aggressive
        s->set_brightness(s, 0);
        s->set_contrast(s, 1);
        s->set_saturation(s, 1);
        s->set_sharpness(s, 2);
        s->set_lenc(s, 1);              // Lens correction
        s->set_bpc(s, 1);
        s->set_wpc(s, 1);
        s->set_raw_gma(s, 1);
    }
    // OV3660 fallback
    else if (s->id.PID == OV3660_PID) {
        s->set_vflip(s, 1);
        s->set_brightness(s, 0);
        s->set_ae_level(s, -1);
        s->set_aec2(s, 0);
        s->set_contrast(s, 1);
        s->set_saturation(s, 1);
        s->set_sharpness(s, 2);
        s->set_lenc(s, 1);
        s->set_bpc(s, 1);
        s->set_wpc(s, 1);
    }
    // Generic OV2640 or unknown fallback
    else {
        s->set_vflip(s, 1);
        s->set_brightness(s, 0);
        s->set_ae_level(s, -1);
        s->set_aec2(s, 0);
        s->set_contrast(s, 1);
        s->set_saturation(s, 1);
        s->set_sharpness(s, 2);
        s->set_lenc(s, 1);
        s->set_bpc(s, 1);
        s->set_wpc(s, 1);
    }

    is_initialised = true;
    return true;
}

/* ===================== SETUP ===================== */

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n=================================");
    Serial.println("  ESP32-S3 CAM Shoe Classifier");
    Serial.println("  Gemini HTTP Edition");
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

    camOwnDeviceId = generateCamOwnDeviceId();
    Serial.println("[Startup] CAM Device ID: " + camOwnDeviceId);

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

    WiFi.onEvent(onWiFiConnected,    ARDUINO_EVENT_WIFI_STA_CONNECTED);
    WiFi.onEvent(onWiFiGotIP,        ARDUINO_EVENT_WIFI_STA_GOT_IP);
    WiFi.onEvent(onWiFiDisconnected, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

    WiFi.mode(WIFI_STA);
    delay(200);
    Serial.println("[WiFi] Mode: STA | MAC: " + WiFi.macAddress());

    if (esp_now_init() != ESP_OK) {
        Serial.println("[ESP-NOW] Init FAILED!");
    } else {
        esp_now_register_send_cb(onDataSent);
        esp_now_register_recv_cb(onDataRecv);
        Serial.println("[ESP-NOW] Initialized — listening for pairing broadcast");
    }

    if (mainBoardPaired) {
        esp_now_peer_info_t peer;
        memset(&peer, 0, sizeof(peer));
        memcpy(peer.peer_addr, mainBoardMac, 6);
        peer.channel = 0;
        peer.encrypt = false;
        esp_now_add_peer(&peer);
        Serial.println("[ESP-NOW] Added main board as peer");
    }

    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    if (ssid.length() > 0) {
        WiFi.begin(ssid.c_str(), pass.c_str());
        wifiConnectStartMs = millis();
        Serial.println("[WiFi] Connecting to: " + ssid);
    } else {
        Serial.println("[WiFi] No credentials — waiting for pairing broadcast");
    }

    if (!camera_init()) {
        Serial.println("[Camera] Init FAILED");
    } else {
        Serial.println("[Camera] Initialized");
    }

    Serial.println("\n--- Serial Commands ---");
    Serial.println("CLASSIFY      - Capture and POST to backend (Gemini)");
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

    // --- Factory reset ---
    if (factoryResetRequested) {
        factoryResetRequested = false;
        factoryReset();
    }

    // --- Classification (runs from Arduino task, not ESP-NOW callback) ---
    if (classificationRequested && !classificationInProgress) {
        classificationRequested  = false;
        classificationInProgress = true;
        captureAndPostToBackend();
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
                captureAndPostToBackend();
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
