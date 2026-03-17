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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Shoe Care - WiFi Setup</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0d9488;
      --primary-light: #14b8a6;
      --accent: #06b6d4;
      --bg-gradient: linear-gradient(135deg, #0d9488 0%, #06b6d4 50%, #3b82f6 100%);
      --glass: rgba(255, 255, 255, 0.12);
      --glass-border: rgba(255, 255, 255, 0.2);
    }
    * { box-sizing: border-box; }
    body, html {
      height: 100%;
      margin: 0;
      font-family: 'Outfit', sans-serif;
      background: var(--bg-gradient);
      color: #fff;
      overflow: hidden;
    }
    .container {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 400px;
      padding: 48px 40px;
      background: var(--glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
      animation: fadeIn 0.8s ease-out;
      text-align: center;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .logo {
      width: 64px;
      height: 64px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    h1 {
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
    }
    p.subtitle {
      font-size: 15px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 32px;
    }
    .input-group {
      margin-bottom: 20px;
      text-align: left;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 400;
      margin-bottom: 8px;
      color: rgba(255, 255, 255, 0.8);
      margin-left: 4px;
    }
    select, input {
      width: 100%;
      padding: 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      color: #fff;
      font-size: 16px;
      font-family: inherit;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;
    }
    select:focus, input:focus {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);
    }
    select option { background: #134e4a; color: white; }
    button {
      width: 100%;
      padding: 16px;
      background: #fff;
      color: #0d9488;
      border: none;
      border-radius: 16px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.2);
      margin-top: 12px;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 25px -5px rgba(0, 0, 0, 0.25);
      background: #f8fafc;
    }
    button:active { transform: translateY(0); }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
          <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
      </div>
      <h1>WiFi Setup</h1>
      <p class="subtitle">Connect your Machine to the internet</p>
      <form method="POST">
        <div class="input-group">
          <label>Network Name</label>
          <select name="ssid" required>
            {{WIFI_LIST}}
          </select>
        </div>
        <div class="input-group">
          <label>Password</label>
          <input name="pass" type="password" placeholder="••••••••" autocomplete="off">
        </div>
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WiFi Saved - Smart Shoe Care</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #10b981;
      --bg-gradient: linear-gradient(135deg, #0d9488 0%, #06b6d4 50%, #3b82f6 100%);
      --glass: rgba(255, 255, 255, 0.12);
      --glass-border: rgba(255, 255, 255, 0.2);
    }
    body, html {
      height: 100%; margin: 0;
      font-family: 'Outfit', sans-serif;
      background: var(--bg-gradient);
      color: #fff;
      overflow: hidden;
    }
    .container {
      height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .card {
      width: 100%; max-width: 400px; padding: 48px 40px;
      background: var(--glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 32px;
      text-align: center;
      animation: fadeIn 0.8s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .success-icon {
      width: 80px; height: 80px; background: rgba(16, 185, 129, 0.2);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px; border: 2px solid rgba(16, 185, 129, 0.3);
    }
    h1 { font-size: 28px; font-weight: 600; margin: 0 0 12px 0; }
    p { color: rgba(255, 255, 255, 0.8); margin: 0; line-height: 1.6; }
    .ssid-badge {
      display: inline-block; padding: 6px 16px; background: rgba(255, 255, 255, 0.1);
      border-radius: 20px; font-weight: 600; margin-top: 8px; font-size: 14px;
    }
    .countdown-container { margin-top: 40px; }
    .count {
      font-size: 64px; font-weight: 600; color: #fff; margin: 10px 0;
      text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
    }
    .hint { font-size: 13px; color: rgba(255, 255, 255, 0.5); margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="success-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h1>Configuration Saved</h1>
      <p>Your machine is connecting to:</p>
      <div class="ssid-badge">{{SSID}}</div>
      <div class="countdown-container">
        <p>Rebooting in</p>
        <div class="count" id="count">15</div>
        <p>seconds</p>
      </div>
      <p class="hint" id="hint">You can close this window manually</p>
    </div>
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
        hintEl.innerHTML = "Taking you back...";
        setTimeout(() => {
          window.open('about:blank', '_self');
          window.close();
        }, 500);
      }
    }, 1000);
  </script>
</body>
</html>
)rawliteral";

#endif // HTML_PAGES_H
