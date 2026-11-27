/**
 * KEYARCADE_1100 — Universal Retrofit LED KeyBar Firmware (ESP32-S3 / ESP32-C3 + WS2812B)
 *
 * Mounts above any 61 / 76 / 88-key digital piano (Yamaha KBP/PSR-1100, Casio PX-S1100/WK-1100/CTK-1100, etc.)
 * Supports BOTH:
 *   1. USB Serial / USB-C OTG (115200 baud) — Works with WebSerial on Desktop & Android OTG
 *   2. Bluetooth Low Energy (BLE GATT UART) — Wireless pairing to Phone / Tablet / Laptop
 *
 * Wiring:
 *   - ESP32 GPIO4 -> 330 ohm resistor -> WS2812B DIN
 *   - External 5V 3A USB-C PD -> WS2812B VCC & GND (share common GND with ESP32; add 1000uF cap across 5V/GND)
 *   - 144 LED/m strip (~1.22m = ~176 LEDs for 88 keys; ~0.85m = ~122 LEDs for 61 keys)
 *
 * Line Protocol (ASCII newline-terminated, '\n'):
 *   PING                          -> replies "PONG KEYARCADE_KEYBAR_V1\n"
 *   CFG:<ledCount>:<brightness>   -> updates LED count (1..256) and brightness (1..255)
 *   CLR                           -> turns off all LEDs
 *   SET:<idx>:<r>,<g>,<b>         -> sets single LED index to RGB
 *   FRM:<hexRRGGBB...>            -> sets full strip frame (6 hex chars per LED, clamped cleanly)
 *   KEY:<ledCsv>                  -> quick wipe + paint pairs "idx:r,g,b;idx:r,g,b"
 *   DEMO                          -> plays startup rainbow sweep across active keys
 */

#include <FastLED.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define LED_PIN          4
#define MAX_LEDS         256
#define COLOR_ORDER      GRB
#define CHIPSET          WS2812B
#define DEFAULT_LEDS     176   // ~144 LED/m covering 88 piano keys (2 LEDs per white-key pitch span)
#define DEFAULT_BRIGHT   64    // Safe indoor brightness & <= 1.2A current draw

// Nordic UART-compatible BLE UUIDs recognized by KeyArcade 1100 Web Bluetooth
#define SERVICE_UUID        "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_RX_UUID        "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_TX_UUID        "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

CRGB leds[MAX_LEDS];
uint16_t activeLeds = DEFAULT_LEDS;
uint8_t activeBrightness = DEFAULT_BRIGHT;

BLECharacteristic *pTxChar = nullptr;
bool bleConnected = false;
String serialBuf = "";
String bleBuf = "";

void sendReply(const String &msg) {
  Serial.println(msg);
  if (bleConnected && pTxChar != nullptr) {
    String out = msg + "\n";
    pTxChar->setValue((uint8_t *)out.c_str(), out.length());
    pTxChar->notify();
  }
}

uint8_t parseHexByte(char hi, char lo) {
  auto hexVal = [](char c) -> uint8_t {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
    if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
    return 0;
  };
  return (hexVal(hi) << 4) | hexVal(lo);
}

void runBootSweep() {
  fill_solid(leds, MAX_LEDS, CRGB::Black);
  for (uint16_t i = 0; i < activeLeds; i += 2) {
    leds[i] = CRGB(255, 106, 0);
    if (i + 1 < activeLeds) leds[i + 1] = CRGB(0, 212, 255);
    FastLED.show();
    delay(6);
    leds[i] = CRGB::Black;
    if (i + 1 < activeLeds) leds[i + 1] = CRGB::Black;
  }
  FastLED.show();
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd == "PING") {
    sendReply("PONG KEYARCADE_KEYBAR_V1:" + String(activeLeds));
    return;
  }

  if (cmd == "CLR") {
    fill_solid(leds, MAX_LEDS, CRGB::Black);
    FastLED.show();
    return;
  }

  if (cmd == "DEMO") {
    runBootSweep();
    return;
  }

  if (cmd.startsWith("CFG:")) {
    int sep = cmd.indexOf(':', 4);
    if (sep > 4) {
      int nextCount = cmd.substring(4, sep).toInt();
      int nextBright = cmd.substring(sep + 1).toInt();
      activeLeds = constrain(nextCount, 16, MAX_LEDS);
      activeBrightness = constrain(nextBright, 8, 220);
      FastLED.setBrightness(activeBrightness);
      fill_solid(leds, MAX_LEDS, CRGB::Black);
      FastLED.show();
      sendReply("OK CFG:" + String(activeLeds) + ":" + String(activeBrightness));
    }
    return;
  }

  if (cmd.startsWith("SET:")) {
    int c1 = cmd.indexOf(':', 4);
    int c2 = cmd.indexOf(',', c1 + 1);
    int c3 = cmd.indexOf(',', c2 + 1);
    if (c1 > 4 && c2 > c1 && c3 > c2) {
      int idx = cmd.substring(4, c1).toInt();
      int r = cmd.substring(c1 + 1, c2).toInt();
      int g = cmd.substring(c2 + 1, c3).toInt();
      int b = cmd.substring(c3 + 1).toInt();
      if (idx >= 0 && idx < activeLeds) {
        leds[idx] = CRGB(constrain(r, 0, 255), constrain(g, 0, 255), constrain(b, 0, 255));
        FastLED.show();
      }
    }
    return;
  }

  if (cmd.startsWith("KEY:")) {
    fill_solid(leds, MAX_LEDS, CRGB::Black);
    String body = cmd.substring(4);
    int start = 0;
    while (start < (int)body.length()) {
      int semi = body.indexOf(';', start);
      String token = semi >= 0 ? body.substring(start, semi) : body.substring(start);
      int colon = token.indexOf(':');
      int c1 = token.indexOf(',', colon + 1);
      int c2 = token.indexOf(',', c1 + 1);
      if (colon > 0 && c1 > colon && c2 > c1) {
        int idx = token.substring(0, colon).toInt();
        int r = token.substring(colon + 1, c1).toInt();
        int g = token.substring(c1 + 1, c2).toInt();
        int b = token.substring(c2 + 1).toInt();
        if (idx >= 0 && idx < activeLeds) {
          leds[idx] = CRGB(constrain(r, 0, 255), constrain(g, 0, 255), constrain(b, 0, 255));
        }
      }
      if (semi < 0) break;
      start = semi + 1;
    }
    FastLED.show();
    return;
  }

  if (cmd.startsWith("FRM:")) {
    String hex = cmd.substring(4);
    uint16_t pairs = min<uint16_t>(activeLeds, hex.length() / 6);
    for (uint16_t i = 0; i < pairs; i++) {
      int off = i * 6;
      leds[i] = CRGB(
        parseHexByte(hex[off], hex[off + 1]),
        parseHexByte(hex[off + 2], hex[off + 3]),
        parseHexByte(hex[off + 4], hex[off + 5])
      );
    }
    for (uint16_t i = pairs; i < activeLeds; i++) {
      leds[i] = CRGB::Black;
    }
    FastLED.show();
  }
}

class KeyBarServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) override { bleConnected = true; }
  void onDisconnect(BLEServer *pServer) override {
    bleConnected = false;
    pServer->startAdvertising();
  }
};

class KeyBarRxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    String rx = pCharacteristic->getValue();
    bleBuf += rx;
    int nl;
    while ((nl = bleBuf.indexOf('\n')) >= 0) {
      String line = bleBuf.substring(0, nl);
      bleBuf.remove(0, nl + 1);
      handleCommand(line);
    }
  }
};

void setup() {
  Serial.begin(115200);
  FastLED.addLeds<CHIPSET, LED_PIN, COLOR_ORDER>(leds, MAX_LEDS);
  FastLED.setBrightness(activeBrightness);
  fill_solid(leds, MAX_LEDS, CRGB::Black);
  FastLED.show();

  BLEDevice::init("KEYARCADE-BAR");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new KeyBarServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pTxChar = pService->createCharacteristic(CHAR_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pTxChar->addDescriptor(new BLE2902());

  BLECharacteristic *pRxChar = pService->createCharacteristic(
    CHAR_RX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxChar->setCallbacks(new KeyBarRxCallbacks());
  pService->start();

  BLEAdvertising *pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->start();

  runBootSweep();
  sendReply("READY KEYARCADE_KEYBAR_V1");
}

void loop() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      handleCommand(serialBuf);
      serialBuf = "";
    } else if (c != '\r') {
      serialBuf += c;
    }
  }
}
