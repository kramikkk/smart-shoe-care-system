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
 */

// These sketches are tested with 2.0.4 ESP32 Arduino Core
// https://github.com/espressif/arduino-esp32/releases/tag/2.0.4

/* Includes ---------------------------------------------------------------- */
#include <shoe_classification_inferencing.h>
#include "edge-impulse-sdk/dsp/image/image.hpp"

#include "esp_camera.h"
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Preferences.h>
#include <esp_now.h>
#include <esp_wifi.h>

// Select camera model - find more camera models in camera_pins.h file here
// https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h

#define CAMERA_MODEL_ESP32S3_EYE // Has PSRAM
//#define CAMERA_MODEL_AI_THINKER // Has PSRAM

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

/* ===================== ESP-NOW + WIFI + WEBSOCKET ===================== */
// ESP-NOW receives WiFi credentials from Main ESP32 (wireless, no wires needed)
// Then connects to same WiFi and WebSocket server

Preferences prefs;
WebSocketsClient webSocket;

// Structure to receive WiFi credentials (must match main board)
typedef struct {
  char ssid[32];
  char password[64];
  char wsHost[64];
  uint16_t wsPort;
  char deviceId[24];  // Main board's device ID
} WiFiCredentials;

WiFiCredentials receivedCredentials;
bool credentialsReceived = false;
bool wifiConnected = false;
bool wsConnected = false;
String camDeviceId = "";  // Derived from main board ID: SSCM-ABC123 -> SSCM-CAM-ABC123

// Main board MAC address for pairing verification
uint8_t mainBoardMac[6] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
bool mainBoardPaired = false;

// WiFi/WebSocket reconnection
unsigned long lastWsReconnect = 0;
const unsigned long WS_RECONNECT_INTERVAL = 5000;

// Classification state
bool classificationInProgress = false;

/* ===================== CLASSIFICATION SETTINGS ===================== */
#define NUM_SCANS 5          // Number of scans to perform
#define SCAN_DELAY_MS 300    // Delay between scans in ms

/* Constant defines -------------------------------------------------------- */
#define EI_CAMERA_RAW_FRAME_BUFFER_COLS           320
#define EI_CAMERA_RAW_FRAME_BUFFER_ROWS           240
#define EI_CAMERA_FRAME_BYTE_SIZE                 3

/* Private variables ------------------------------------------------------- */
static bool debug_nn = false; // Set this to true to see e.g. features generated from the raw signal
static bool is_initialised = false;
uint8_t *snapshot_buf; //points to the output of the capture

static camera_config_t camera_config = {
    .pin_pwdn = PWDN_GPIO_NUM,
    .pin_reset = RESET_GPIO_NUM,
    .pin_xclk = XCLK_GPIO_NUM,
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
    .pin_href = HREF_GPIO_NUM,
    .pin_pclk = PCLK_GPIO_NUM,

    //XCLK 20MHz or 10MHz for OV2640 double FPS (Experimental)
    .xclk_freq_hz = 20000000,
    .ledc_timer = LEDC_TIMER_0,
    .ledc_channel = LEDC_CHANNEL_0,

    .pixel_format = PIXFORMAT_JPEG, //YUV422,GRAYSCALE,RGB565,JPEG
    .frame_size = FRAMESIZE_QVGA,    //QQVGA-UXGA Do not use sizes above QVGA when not JPEG

    .jpeg_quality = 12, //0-63 lower number means higher quality
    .fb_count = 1,       //if more than one, i2s runs in continuous mode. Use only with JPEG
    .fb_location = CAMERA_FB_IN_PSRAM,
    .grab_mode = CAMERA_GRAB_WHEN_EMPTY,
};

/* Function definitions ------------------------------------------------------- */
bool ei_camera_init(void);
void ei_camera_deinit(void);
bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf) ;

/* ===================== ESP-NOW CALLBACK ===================== */
// Called when ESP-NOW data is received
// Updated for ESP32 Arduino Core v3.x
void onDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *data, int len) {
    Serial.println("\n[ESP-NOW] Data received!");
    
    // Get sender MAC address
    uint8_t* senderMac = recv_info->src_addr;
    Serial.print("[ESP-NOW] From MAC: ");
    for (int i = 0; i < 6; i++) {
        Serial.printf("%02X", senderMac[i]);
        if (i < 5) Serial.print(":");
    }
    Serial.println();
    
    // If already paired, verify sender is the paired main board
    if (mainBoardPaired) {
        bool macMatch = true;
        for (int i = 0; i < 6; i++) {
            if (senderMac[i] != mainBoardMac[i]) {
                macMatch = false;
                break;
            }
        }
        
        if (!macMatch) {
            Serial.println("[ESP-NOW] REJECTED: Not from paired main board");
            Serial.print("[ESP-NOW] Expected MAC: ");
            for (int i = 0; i < 6; i++) {
                Serial.printf("%02X", mainBoardMac[i]);
                if (i < 5) Serial.print(":");
            }
            Serial.println();
            return;  // Ignore messages from other devices
        }
        Serial.println("[ESP-NOW] MAC verified - from paired main board");
    }

    if (len == sizeof(WiFiCredentials)) {
        memcpy(&receivedCredentials, data, sizeof(WiFiCredentials));

        Serial.println("[ESP-NOW] WiFi Credentials received:");
        Serial.println("  SSID: " + String(receivedCredentials.ssid));
        Serial.println("  WS Host: " + String(receivedCredentials.wsHost));
        Serial.println("  WS Port: " + String(receivedCredentials.wsPort));
        Serial.println("  Main Device ID: " + String(receivedCredentials.deviceId));

        // Derive CAM device ID: SSCM-ABC123 -> SSCM-CAM-ABC123
        String mainId = String(receivedCredentials.deviceId);
        if (mainId.startsWith("SSCM-")) {
            camDeviceId = "SSCM-CAM-" + mainId.substring(5);
        } else {
            camDeviceId = "SSCM-CAM-UNKNOWN";
        }
        Serial.println("  CAM Device ID: " + camDeviceId);

        // Store credentials in preferences
        prefs.putString("ssid", String(receivedCredentials.ssid));
        prefs.putString("pass", String(receivedCredentials.password));
        prefs.putString("wsHost", String(receivedCredentials.wsHost));
        prefs.putUInt("wsPort", receivedCredentials.wsPort);
        prefs.putString("camId", camDeviceId);
        
        // Store main board MAC for pairing (prevents accepting from other devices)
        if (!mainBoardPaired) {
            memcpy(mainBoardMac, senderMac, 6);
            prefs.putBytes("mainMac", mainBoardMac, 6);
            mainBoardPaired = true;
            
            Serial.println("[ESP-NOW] Paired with main board MAC:");
            Serial.print("  ");
            for (int i = 0; i < 6; i++) {
                Serial.printf("%02X", mainBoardMac[i]);
                if (i < 5) Serial.print(":");
            }
            Serial.println();
        }

        credentialsReceived = true;
        Serial.println("[ESP-NOW] Credentials stored. Connecting to WiFi...");
    } else {
        Serial.println("[ESP-NOW] Invalid data size: " + String(len));
    }
}

/* ===================== WEBSOCKET EVENT HANDLER ===================== */
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("[WebSocket] Disconnected");
            wsConnected = false;
            break;

        case WStype_CONNECTED:
            Serial.println("[WebSocket] Connected!");
            wsConnected = true;

            // Subscribe to device updates
            {
                String subscribeMsg = "{\"type\":\"subscribe\",\"deviceId\":\"" + camDeviceId + "\"}";
                webSocket.sendTXT(subscribeMsg);

                // Send initial status
                String statusMsg = "{\"type\":\"cam-status\",\"deviceId\":\"" + camDeviceId + "\",";
                statusMsg += "\"cameraReady\":" + String(is_initialised ? "true" : "false") + ",";
                statusMsg += "\"classifying\":false}";
                webSocket.sendTXT(statusMsg);
            }
            break;

        case WStype_TEXT:
            {
                String message = String((char*)payload);
                Serial.println("[WebSocket] Received: " + message);

                // Handle start-classification command
                if (message.indexOf("\"type\":\"start-classification\"") != -1 ||
                    message.indexOf("\"type\":\"request-classification\"") != -1) {

                    Serial.println("\n=== CLASSIFICATION REQUESTED ===");

                    if (!classificationInProgress && is_initialised) {
                        classificationInProgress = true;

                        // Send acknowledgment
                        String ackMsg = "{\"type\":\"classification-started\",\"deviceId\":\"" + camDeviceId + "\"}";
                        webSocket.sendTXT(ackMsg);

                        // Run classification
                        String result = runClassification();

                        // Parse and send result
                        if (result.startsWith("RESULT:")) {
                            int firstColon = result.indexOf(':', 7);
                            if (firstColon != -1) {
                                String shoeType = result.substring(7, firstColon);
                                float confidence = result.substring(firstColon + 1).toFloat();

                                String resultMsg = "{\"type\":\"classification-result\",";
                                resultMsg += "\"deviceId\":\"" + camDeviceId + "\",";
                                resultMsg += "\"result\":\"" + shoeType + "\",";
                                resultMsg += "\"confidence\":" + String(confidence, 4) + ",";
                                resultMsg += "\"scansCompleted\":" + String(NUM_SCANS) + "}";
                                webSocket.sendTXT(resultMsg);

                                Serial.println("[WebSocket] Sent result: " + shoeType);
                            }
                        } else {
                            // Error
                            String errMsg = "{\"type\":\"classification-error\",";
                            errMsg += "\"deviceId\":\"" + camDeviceId + "\",";
                            errMsg += "\"error\":\"" + result.substring(6) + "\"}";
                            webSocket.sendTXT(errMsg);
                        }

                        classificationInProgress = false;
                    } else if (classificationInProgress) {
                        Serial.println("[Classification] Already in progress");
                        String busyMsg = "{\"type\":\"classification-busy\",\"deviceId\":\"" + camDeviceId + "\"}";
                        webSocket.sendTXT(busyMsg);
                    } else {
                        Serial.println("[Classification] Camera not ready");
                        String errMsg = "{\"type\":\"classification-error\",\"deviceId\":\"" + camDeviceId + "\",\"error\":\"CAMERA_NOT_READY\"}";
                        webSocket.sendTXT(errMsg);
                    }
                    Serial.println("================================\n");
                }
                else if (message.indexOf("\"type\":\"subscribed\"") != -1) {
                    Serial.println("[WebSocket] Subscribed to updates");
                }
            }
            break;

        case WStype_ERROR:
            Serial.println("[WebSocket] Error");
            wsConnected = false;
            break;

        default:
            break;
    }
}

/* ===================== WIFI CONNECTION ===================== */
void connectWiFi() {
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");

    if (ssid.length() == 0) {
        Serial.println("[WiFi] No credentials stored. Waiting for ESP-NOW...");
        return;
    }

    Serial.println("[WiFi] Connecting to: " + ssid);
    WiFi.begin(ssid.c_str(), pass.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.println("\n[WiFi] Connected!");
        Serial.println("[WiFi] IP: " + WiFi.localIP().toString());
    } else {
        Serial.println("\n[WiFi] Connection failed!");
    }
}

/* ===================== WEBSOCKET CONNECTION ===================== */
void connectWebSocket() {
    String wsHost = prefs.getString("wsHost", "");
    uint16_t wsPort = prefs.getUInt("wsPort", 3000);
    camDeviceId = prefs.getString("camId", "SSCM-CAM-UNKNOWN");

    if (wsHost.length() == 0) {
        Serial.println("[WebSocket] No host configured");
        return;
    }

    Serial.println("[WebSocket] Connecting to: " + wsHost + ":" + String(wsPort));

    String path = "/api/ws?deviceId=" + camDeviceId;
    webSocket.begin(wsHost.c_str(), wsPort, path.c_str());
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}

/**
* @brief      Arduino setup function
*/
void setup()
{
    // Initialize USB Serial for debugging
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n=================================");
    Serial.println("  ESP32-S3 CAM Shoe Classifier");
    Serial.println("  Edge Impulse + WebSocket");
    Serial.println("=================================\n");

    // Initialize preferences
    prefs.begin("cam", false);

    // Check for stored credentials and pairing
    camDeviceId = prefs.getString("camId", "");
    if (camDeviceId.length() > 0) {
        Serial.println("[Startup] Found stored credentials");
        Serial.println("[Startup] CAM Device ID: " + camDeviceId);
        credentialsReceived = true;
    }
    
    // Load paired main board MAC
    size_t macLen = prefs.getBytes("mainMac", mainBoardMac, 6);
    if (macLen == 6 && (mainBoardMac[0] != 0x00 || mainBoardMac[1] != 0x00)) {
        mainBoardPaired = true;
        Serial.print("[Startup] Paired with main board MAC: ");
        for (int i = 0; i < 6; i++) {
            Serial.printf("%02X", mainBoardMac[i]);
            if (i < 5) Serial.print(":");
        }
        Serial.println();
    } else {
        Serial.println("[Startup] No main board pairing - will accept first valid credentials");
    }

    // Initialize WiFi in STA mode (required for ESP-NOW + WiFi coexistence)
    WiFi.mode(WIFI_STA);
    delay(500);  // CRITICAL: Wait for WiFi hardware to initialize before reading MAC
    Serial.println("[WiFi] Mode set to STA");
    Serial.println("[WiFi] MAC: " + WiFi.macAddress());

    // Initialize ESP-NOW to receive credentials
    if (esp_now_init() != ESP_OK) {
        Serial.println("[ESP-NOW] Init failed!");
    } else {
        esp_now_register_recv_cb(onDataRecv);
        Serial.println("[ESP-NOW] Initialized - waiting for credentials broadcast");
    }

    // Initialize camera
    if (ei_camera_init() == false) {
        ei_printf("Failed to initialize Camera!\r\n");
    }
    else {
        ei_printf("Camera initialized\r\n");
    }

    // If we have stored credentials, connect to WiFi
    if (credentialsReceived) {
        connectWiFi();
        if (wifiConnected) {
            connectWebSocket();
        }
    }

    Serial.println("\nWaiting for classification commands via WebSocket...");
    Serial.println("Or type 'TEST' in Serial Monitor to test locally.\n");
}

/**
* @brief      Run classification with multiple scans and return best result
*/
String runClassification() {
    Serial.println("\n=== Starting Classification (" + String(NUM_SCANS) + " scans) ===");

    // Track confidence for each class across all scans
    float classConfidences[EI_CLASSIFIER_LABEL_COUNT] = {0};
    int successfulScans = 0;

    for (int scan = 0; scan < NUM_SCANS; scan++) {
        Serial.println("Scan " + String(scan + 1) + "/" + String(NUM_SCANS) + "...");

        snapshot_buf = (uint8_t*)malloc(EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * EI_CAMERA_FRAME_BYTE_SIZE);

        if (snapshot_buf == nullptr) {
            ei_printf("ERR: Failed to allocate snapshot buffer!\n");
            continue;
        }

        ei::signal_t signal;
        signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
        signal.get_data = &ei_camera_get_data;

        if (ei_camera_capture((size_t)EI_CLASSIFIER_INPUT_WIDTH, (size_t)EI_CLASSIFIER_INPUT_HEIGHT, snapshot_buf) == false) {
            ei_printf("Failed to capture image\r\n");
            free(snapshot_buf);
            continue;
        }

        ei_impulse_result_t result = { 0 };
        EI_IMPULSE_ERROR err = run_classifier(&signal, &result, debug_nn);

        if (err != EI_IMPULSE_OK) {
            ei_printf("ERR: Failed to run classifier (%d)\n", err);
            free(snapshot_buf);
            continue;
        }

        successfulScans++;

        // Accumulate confidence for each class
        for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
            classConfidences[i] += result.classification[i].value;
            Serial.println("  " + String(ei_classifier_inferencing_categories[i]) + ": " + String(result.classification[i].value, 4));
        }

        free(snapshot_buf);

        if (scan < NUM_SCANS - 1) {
            delay(SCAN_DELAY_MS);
        }
    }

    Serial.println("\n=== Classification Complete ===");
    Serial.println("Successful scans: " + String(successfulScans) + "/" + String(NUM_SCANS));

    if (successfulScans == 0) {
        return "ERROR:NO_SUCCESSFUL_SCANS";
    }

    // Find class with highest average confidence
    float highestAvg = 0.0;
    int bestIndex = 0;

    Serial.println("\nAverage confidences:");
    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        float avg = classConfidences[i] / successfulScans;
        Serial.println("  " + String(ei_classifier_inferencing_categories[i]) + ": " + String(avg, 4));

        if (avg > highestAvg) {
            highestAvg = avg;
            bestIndex = i;
        }
    }

    String bestLabel = String(ei_classifier_inferencing_categories[bestIndex]);
    Serial.println("\n>>> RESULT: " + bestLabel + " (" + String(highestAvg * 100, 1) + "%)");

    return "RESULT:" + bestLabel + ":" + String(highestAvg, 4);
}

/**
* @brief      Main loop - wait for commands
*/
void loop()
{
    // Handle WebSocket communication
    if (wifiConnected) {
        webSocket.loop();
    }

    // Handle WiFi connection after receiving ESP-NOW credentials
    if (credentialsReceived && !wifiConnected) {
        connectWiFi();
        if (wifiConnected) {
            connectWebSocket();
        }
    }

    // Handle WebSocket reconnection
    if (wifiConnected && !wsConnected && millis() - lastWsReconnect >= WS_RECONNECT_INTERVAL) {
        lastWsReconnect = millis();
        Serial.println("[WebSocket] Attempting to reconnect...");
        connectWebSocket();
    }

    // Check for local test commands via USB Serial
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd == "TEST" || cmd == "CLASSIFY") {
            String result = runClassification();
            Serial.println("Result: " + result);
        }
        else if (cmd == "STATUS") {
            Serial.println("\n=== CAM Status ===");
            Serial.println("Camera: " + String(is_initialised ? "Ready" : "Not initialized"));
            Serial.println("WiFi: " + String(wifiConnected ? "Connected" : "Disconnected"));
            Serial.println("WebSocket: " + String(wsConnected ? "Connected" : "Disconnected"));
            Serial.println("Device ID: " + camDeviceId);
            Serial.println("Credentials: " + String(credentialsReceived ? "Yes" : "Waiting for ESP-NOW"));
            Serial.println("Scans per classification: " + String(NUM_SCANS));
            
            // Show pairing status
            if (mainBoardPaired) {
                Serial.print("Paired with main board: ");
                for (int i = 0; i < 6; i++) {
                    Serial.printf("%02X", mainBoardMac[i]);
                    if (i < 5) Serial.print(":");
                }
                Serial.println();
            } else {
                Serial.println("Pairing: Not paired (will accept first credentials)");
            }
            
            Serial.println("==================\n");
        }
        else if (cmd == "CLEAR") {
            Serial.println("Clearing stored credentials...");
            prefs.clear();
            credentialsReceived = false;
            wifiConnected = false;
            wsConnected = false;
            camDeviceId = "";
            mainBoardPaired = false;
            memset(mainBoardMac, 0, 6);
            Serial.println("Credentials AND pairing cleared. Restart to apply.");
        }
        else if (cmd == "UNPAIR") {
            Serial.println("Clearing main board pairing...");
            prefs.remove("mainMac");
            mainBoardPaired = false;
            memset(mainBoardMac, 0, 6);
            Serial.println("Pairing cleared. CAM will accept credentials from any main board.");
            Serial.println("Restart or wait for next credential broadcast.");
        }
        else if (cmd == "WIFI") {
            Serial.println("WiFi Status: " + String(WiFi.status()));
            Serial.println("IP: " + WiFi.localIP().toString());
            Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
        }
    }

    delay(10);  // Small delay to prevent busy-waiting
}

/**
 * @brief   Setup image sensor & start streaming
 *
 * @retval  false if initialisation failed
 */
bool ei_camera_init(void) {

    if (is_initialised) return true;

#if defined(CAMERA_MODEL_ESP_EYE)
  pinMode(13, INPUT_PULLUP);
  pinMode(14, INPUT_PULLUP);
#endif

    //initialize the camera
    esp_err_t err = esp_camera_init(&camera_config);
    if (err != ESP_OK) {
      Serial.printf("Camera init failed with error 0x%x\n", err);
      return false;
    }

    sensor_t * s = esp_camera_sensor_get();
    // initial sensors are flipped vertically and colors are a bit saturated
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1); // flip it back
      s->set_brightness(s, 1); // up the brightness just a bit
      s->set_saturation(s, 0); // lower the saturation
    }

#if defined(CAMERA_MODEL_M5STACK_WIDE)
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
#elif defined(CAMERA_MODEL_ESP_EYE)
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
    s->set_awb_gain(s, 1);
#endif

    is_initialised = true;
    return true;
}

/**
 * @brief      Stop streaming of sensor data
 */
void ei_camera_deinit(void) {

    //deinitialize the camera
    esp_err_t err = esp_camera_deinit();

    if (err != ESP_OK)
    {
        ei_printf("Camera deinit failed\n");
        return;
    }

    is_initialised = false;
    return;
}


/**
 * @brief      Capture, rescale and crop image
 *
 * @param[in]  img_width     width of output image
 * @param[in]  img_height    height of output image
 * @param[in]  out_buf       pointer to store output image, NULL may be used
 *                           if ei_camera_frame_buffer is to be used for capture and resize/cropping.
 *
 * @retval     false if not initialised, image captured, rescaled or cropped failed
 *
 */
bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf) {
    bool do_resize = false;

    if (!is_initialised) {
        ei_printf("ERR: Camera is not initialized\r\n");
        return false;
    }

    camera_fb_t *fb = esp_camera_fb_get();

    if (!fb) {
        ei_printf("Camera capture failed\n");
        return false;
    }

   bool converted = fmt2rgb888(fb->buf, fb->len, PIXFORMAT_JPEG, snapshot_buf);

   esp_camera_fb_return(fb);

   if(!converted){
       ei_printf("Conversion failed\n");
       return false;
   }

    if ((img_width != EI_CAMERA_RAW_FRAME_BUFFER_COLS)
        || (img_height != EI_CAMERA_RAW_FRAME_BUFFER_ROWS)) {
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

static int ei_camera_get_data(size_t offset, size_t length, float *out_ptr)
{
    // we already have a RGB888 buffer, so recalculate offset into pixel index
    size_t pixel_ix = offset * 3;
    size_t pixels_left = length;
    size_t out_ptr_ix = 0;

    while (pixels_left != 0) {
        // Swap BGR to RGB here
        // due to https://github.com/espressif/esp32-camera/issues/379
        out_ptr[out_ptr_ix] = (snapshot_buf[pixel_ix + 2] << 16) + (snapshot_buf[pixel_ix + 1] << 8) + snapshot_buf[pixel_ix];

        // go to the next pixel
        out_ptr_ix++;
        pixel_ix+=3;
        pixels_left--;
    }
    // and done!
    return 0;
}

#if !defined(EI_CLASSIFIER_SENSOR) || EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_CAMERA
#error "Invalid model for current sensor"
#endif
