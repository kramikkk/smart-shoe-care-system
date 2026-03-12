/*
 * HTML Pages for Smart Shoe Care Machine
 * WiFi Setup Portal Pages
 */

#ifndef HTML_PAGES_H
#define HTML_PAGES_H

#include <Arduino.h>

// WiFi Setup Page - Main form for entering WiFi credentials
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
      background: rgba(255, 255, 255, 0.15);
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

// WiFi Confirmation Page - Shown after credentials are saved
const char CONFIRM_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
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

#endif // HTML_PAGES_H
