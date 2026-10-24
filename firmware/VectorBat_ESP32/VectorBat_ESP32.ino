#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <SPI.h>
#include <Adafruit_ADXL375.h>
#include <Adafruit_BNO08x.h>
#include <Adafruit_NeoPixel.h>
#include "dashboard.h"

// =====================================================
// WIFI CONFIGURATION
// =====================================================

// Your Home / Mobile Wi-Fi router
const char* WIFI_SSID     = "HUZAIFA 4G";
const char* WIFI_PASSWORD = "huzaifa22";

// Static IP settings so the ESP32 ALWAYS gets 192.168.1.11
IPAddress local_IP(192, 168, 1, 11);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);
IPAddress secondaryDNS(1, 1, 1, 1);

// Backup Direct Hotspot (SoftAP)
// If your router is off or has AP isolation, connect your phone to this Wi-Fi!
const char* AP_SSID = "VectorBat_Sensor";
const char* AP_PASS = "vectorbat123";
IPAddress ap_IP(192, 168, 4, 1);
IPAddress ap_Gateway(192, 168, 4, 1);
IPAddress ap_Subnet(255, 255, 255, 0);

// =====================================================
// PIN DEFINITIONS (ESP32-S3 Hardware)
// =====================================================

#define PIN_SPI_SCK    12
#define PIN_SPI_MISO   13
#define PIN_SPI_MOSI   11

#define PIN_ADXL_CS    10

#define PIN_BNO_CS     5
#define PIN_BNO_INT    4
#define PIN_BNO_RST    6

#define PIN_NEOPIXEL   48

// =====================================================
// OBJECTS
// =====================================================

WebServer server(80);
WebSocketsServer webSocket(81);

Adafruit_NeoPixel pixel(
  1,
  PIN_NEOPIXEL,
  NEO_GRB + NEO_KHZ800
);

Adafruit_ADXL375 adxl =
  Adafruit_ADXL375(PIN_ADXL_CS, &SPI, 12345);

Adafruit_BNO08x bno(PIN_BNO_RST);

sh2_SensorValue_t sensorValue;

// =====================================================
// STATUS
// =====================================================

bool adxlOK = false;
bool bnoOK = false;

// =====================================================
// SENSOR VALUES
// =====================================================

// ADXL375 acceleration in G
float ax = 0.0;
float ay = 0.0;
float az = 0.0;

// BNO085 orientation in degrees
float roll  = 0.0;
float pitch = 0.0;
float yaw   = 0.0;

// BNO085 raw rotation quaternions (for zero gimbal-lock 3D rotation)
float qw = 1.0;
float qx = 0.0;
float qy = 0.0;
float qz = 0.0;

// =====================================================
// TIMING
// =====================================================

unsigned long ledTimer = 0;
unsigned long lastStream = 0;
unsigned long lastWifiCheck = 0;

const unsigned long LED_HOLD_TIME = 5000;

// 20 ms = 50 Hz high-speed telemetry
const unsigned long STREAM_INTERVAL = 20;

// =====================================================
// NEOPIXEL
// =====================================================

void setPixelColor(uint32_t color) {
  pixel.setPixelColor(0, color);
  pixel.show();
  ledTimer = millis();
}

// =====================================================
// WIFI CONNECTION (AP + STA DUAL MODE)
// =====================================================

void setupWiFi() {
  Serial.println();
  Serial.println("=====================================================");
  Serial.println("[WIFI] Initializing Dual-Mode Wi-Fi (AP + STA)...");
  Serial.println("=====================================================");

  // Set Dual Mode: Connects to your router AND creates a backup hotspot
  WiFi.mode(WIFI_AP_STA);

  // 1. Launch Backup SoftAP (192.168.4.1)
  WiFi.softAPConfig(ap_IP, ap_Gateway, ap_Subnet);
  WiFi.softAP(AP_SSID, AP_PASS);

  Serial.println("[WIFI] Backup SoftAP Active:");
  Serial.print("       SSID:     "); Serial.println(AP_SSID);
  Serial.print("       Password: "); Serial.println(AP_PASS);
  Serial.print("       AP IP:    ws://"); Serial.print(WiFi.softAPIP()); Serial.println(":81");

  // 2. Configure Static IP for Station Mode (192.168.1.11)
  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
    Serial.println("[WIFI] Warning: Static IP configuration failed, using DHCP.");
  }

  // 3. Connect to Home / Mobile Hotspot
  Serial.print("[WIFI] Connecting to Station: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] SUCCESS: Connected to Home Router!");
    Serial.print("       Station IP:     "); Serial.println(WiFi.localIP());
    Serial.print("       Signal (RSSI):  "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
    Serial.print("       Web Dashboard:  http://"); Serial.println(WiFi.localIP());
    Serial.print("       WebSocket URL:  ws://"); Serial.print(WiFi.localIP()); Serial.println(":81");
  } else {
    Serial.println("[WIFI] Station connection pending or timed out.");
    Serial.println("[WIFI] You can still connect directly to the hotspot: 'VectorBat_Sensor'");
    Serial.print("       Direct WebSocket URL: ws://"); Serial.print(WiFi.softAPIP()); Serial.println(":81");
  }
  Serial.println("=====================================================");
}

// =====================================================
// WEBSOCKET EVENT HANDLER
// =====================================================

void onWebSocketEvent(
  uint8_t num,
  WStype_t type,
  uint8_t *payload,
  size_t length
) {
  switch (type) {
    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.println();
      Serial.printf("[WS] Client #%u CONNECTED from %s\n", num, ip.toString().c_str());

      String statusStr =
        "{\"type\":\"welcome\",\"adxl\":" + String(adxlOK ? "true" : "false") +
        ",\"bno\":" + String(bnoOK ? "true" : "false") +
        ",\"ip\":\"" + WiFi.localIP().toString() + "\"}";

      webSocket.sendTXT(num, statusStr);
      break;
    }

    case WStype_DISCONNECTED:
      Serial.printf("[WS] Client #%u DISCONNECTED\n", num);
      break;

    case WStype_TEXT:
      Serial.printf("[WS] Client #%u sent: %s\n", num, (char*)payload);
      break;

    default:
      break;
  }
}

// =====================================================
// READ ADXL375 (HIGH-G ACCELEROMETER)
// =====================================================

void readADXL375() {
  if (!adxlOK) return;

  sensors_event_t event;
  adxl.getEvent(&event);

  // Convert m/s² to standard G
  ax = event.acceleration.x / 9.80665f;
  ay = event.acceleration.y / 9.80665f;
  az = event.acceleration.z / 9.80665f;
}

// =====================================================
// READ BNO085 (9-DOF ORIENTATION IMU)
// =====================================================

void readBNO085() {
  if (!bnoOK) return;

  // Re-enable report if sensor had an unexpected reset
  if (bno.wasReset()) {
    Serial.println("[BNO] Sensor reset detected - re-enabling rotation vector report...");
    bno.enableReport(SH2_ARVR_STABILIZED_RV, 10000);
  }

  if (!bno.getSensorEvent(&sensorValue)) return;
  if (sensorValue.sensorId != SH2_ARVR_STABILIZED_RV) return;

  // Extract Quaternions
  qw = sensorValue.un.arvrStabilizedRV.real; // W
  qx = sensorValue.un.arvrStabilizedRV.i;    // X
  qy = sensorValue.un.arvrStabilizedRV.j;    // Y
  qz = sensorValue.un.arvrStabilizedRV.k;    // Z

  // Quaternion -> Euler Roll (degrees)
  float sinr_cosp = 2.0f * (qw * qx + qy * qz);
  float cosr_cosp = 1.0f - 2.0f * (qx * qx + qy * qy);
  roll = atan2(sinr_cosp, cosr_cosp) * RAD_TO_DEG;

  // Quaternion -> Euler Pitch (degrees)
  float sinp = 2.0f * (qw * qy - qz * qx);
  sinp = constrain(sinp, -1.0f, 1.0f);
  pitch = asin(sinp) * RAD_TO_DEG;

  // Quaternion -> Euler Yaw (degrees)
  float siny_cosp = 2.0f * (qw * qz + qx * qy);
  float cosy_cosp = 1.0f - 2.0f * (qy * qy + qz * qz);
  yaw = atan2(siny_cosp, cosy_cosp) * RAD_TO_DEG;
}

// =====================================================
// BROADCAST TELEMETRY TO ALL CONNECTED CLIENTS
// =====================================================

void sendTelemetry() {
  // Build fast JSON payload matching VectorBat App parser
  String json = "{";
  json += "\"ax\":" + String(ax, 3);
  json += ",\"ay\":" + String(ay, 3);
  json += ",\"az\":" + String(az, 3);
  json += ",\"roll\":" + String(roll, 2);
  json += ",\"pitch\":" + String(pitch, 2);
  json += ",\"yaw\":" + String(yaw, 2);
  json += ",\"qw\":" + String(qw, 4);
  json += ",\"qx\":" + String(qx, 4);
  json += ",\"qy\":" + String(qy, 4);
  json += ",\"qz\":" + String(qz, 4);
  json += ",\"adxl\":" + String(adxlOK ? "true" : "false");
  json += ",\"bno\":" + String(bnoOK ? "true" : "false");
  json += ",\"wifi\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false");
  json += ",\"rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
  json += ",\"time\":" + String(millis());
  json += "}";

  // Broadcast to React Native mobile app & Web visualizer
  webSocket.broadcastTXT(json);

  // Serial Monitor Live Stream
  Serial.printf(
    "ADXL [g]: X=%.2f Y=%.2f Z=%.2f | BNO [deg]: R=%.1f P=%.1f Y=%.1f\n",
    ax,
    ay,
    az,
    roll,
    pitch,
    yaw
  );
}

// =====================================================
// SETUP
// =====================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=====================================================");
  Serial.println("       VECTORBAT ESP32-S3 TELEMETRY SYSTEM");
  Serial.println("=====================================================");

  // 1. NeoPixel
  pixel.begin();
  pixel.setBrightness(40);
  pixel.clear();
  pixel.show();

  // 2. SPI Initialization
  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

  pinMode(PIN_ADXL_CS, OUTPUT);
  pinMode(PIN_BNO_CS, OUTPUT);
  digitalWrite(PIN_ADXL_CS, HIGH);
  digitalWrite(PIN_BNO_CS, HIGH);
  delay(100);

  // 3. ADXL375 Initialization
  Serial.print("[CHECK] ADXL375 High-G Accelerometer (CS GPIO 10)... ");
  if (adxl.begin()) {
    adxlOK = true;
    Serial.println("[ OK ]");
  } else {
    adxlOK = false;
    Serial.println("[ FAILED ]");
  }

  // 4. BNO085 Initialization
  Serial.print("[CHECK] BNO08x 9-DOF IMU (CS GPIO 5, INT GPIO 4)... ");
  if (bno.begin_SPI(PIN_BNO_CS, PIN_BNO_INT)) {
    bnoOK = true;
    Serial.println("[ OK ]");

    if (bno.enableReport(SH2_ARVR_STABILIZED_RV, 10000)) {
      Serial.println("[BNO] Rotation Vector Report Enabled (100 Hz)");
    } else {
      Serial.println("[BNO] Could not enable rotation report");
    }
  } else {
    bnoOK = false;
    Serial.println("[ FAILED ]");
  }

  // 5. LED Color Coding
  if (adxlOK && bnoOK) {
    setPixelColor(pixel.Color(0, 255, 0));     // GREEN: Both OK
  } else if (!adxlOK && bnoOK) {
    setPixelColor(pixel.Color(255, 255, 0));   // YELLOW: Only BNO OK
  } else if (adxlOK && !bnoOK) {
    setPixelColor(pixel.Color(255, 0, 255));   // MAGENTA: Only ADXL OK
  } else {
    setPixelColor(pixel.Color(255, 0, 0));     // RED: Both Failed
  }

  // 6. Wi-Fi Setup
  setupWiFi();

  // 7. Web Server (Port 80)
  server.on("/", []() {
    server.send(200, "text/html", DASHBOARD_HTML);
  });

  server.on("/status", []() {
    String status = "{";
    status += "\"device\":\"VectorBat\"";
    status += ",\"adxl\":" + String(adxlOK ? "true" : "false");
    status += ",\"bno\":" + String(bnoOK ? "true" : "false");
    status += ",\"ip\":\"" + WiFi.localIP().toString() + "\"";
    status += ",\"ap_ip\":\"" + WiFi.softAPIP().toString() + "\"";
    status += "}";
    server.send(200, "application/json", status);
  });

  server.begin();
  Serial.println("[WEB] HTTP Server started on port 80");

  // 8. WebSocket Server (Port 81)
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
  Serial.println("[WS] WebSocket Server started on port 81");

  Serial.println("=====================================================");
  Serial.println("[LIVE] Sensor telemetry active at 50 Hz!");
  Serial.println("=====================================================");
}

// =====================================================
// MAIN LOOP
// =====================================================

void loop() {
  // Service HTTP & WebSocket protocols
  server.handleClient();
  webSocket.loop();

  // Read hardware sensors
  readADXL375();
  readBNO085();

  // Broadcast telemetry at 50 Hz (20ms interval)
  if (millis() - lastStream >= STREAM_INTERVAL) {
    lastStream = millis();
    sendTelemetry();
  }

  // Auto-dim NeoPixel LED after 5 seconds to conserve battery
  if (millis() - ledTimer >= LED_HOLD_TIME) {
    pixel.setPixelColor(0, pixel.Color(2, 2, 2));
    pixel.show();
  }

  // Non-blocking WiFi reconnect check every 30 seconds (NOT 5 seconds!)
  if (millis() - lastWifiCheck >= 30000) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Station disconnected. Re-trying connection to HUZAIFA 4G...");
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }
}
