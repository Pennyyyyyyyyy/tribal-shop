#!/usr/bin/env python3
"""
樹莓派投幣機硬體監聽腳本 (獨立執行版本)
使用 BCM 27 (實體 Pin 13) 監聽投幣機脈衝訊號，並回報至本地後端 API。
"""
import time
import requests

try:
    import RPi.GPIO as GPIO
except ImportError:
    print("❌ 錯誤：未安裝 RPi.GPIO 或非樹莓派環境。")
    exit(1)

# 改用 BCM 27，對應實體的 Pin 13
PIN = 27
BOUNCE_TIME = 50
PULSE_TIMEOUT = 0.35  # 判定單次投幣脈衝結束的間隔 (秒)
API_URL = "http://127.0.0.1:8000/api/hardware-pulse"

pulse_count = 0
last_pulse_time = 0

def pulse_detected(channel):
    global pulse_count, last_pulse_time
    pulse_count += 1
    last_pulse_time = time.time()
    print(f"[{time.strftime('%H:%M:%S')}] 偵測到投幣脈衝訊號！(Pin 13 / GPIO 27) 累積: {pulse_count}")

def process_pulses():
    global pulse_count
    if pulse_count > 0:
        print(f"✅ 脈衝序列結束：收到 {pulse_count} 個 pulses，回報至後端...")
        try:
            res = requests.post(API_URL, params={"pulses": pulse_count}, timeout=2)
            print(f"伺服器回應: {res.json()}")
        except Exception as e:
            print(f"⚠️ 無法連線至後端: {e}")
        pulse_count = 0

def main():
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.add_event_detect(PIN, GPIO.FALLING, callback=pulse_detected, bouncetime=BOUNCE_TIME)

    print(f"==================================================")
    print(f"🪙 樹莓派投幣機監聽已啟動 (BCM GPIO {PIN} / 實體 Pin 13)")
    print(f"目標伺服器: {API_URL}")
    print(f"按 Ctrl+C 結束測試")
    print(f"==================================================")

    try:
        while True:
            time.sleep(0.05)
            if pulse_count > 0 and (time.time() - last_pulse_time) > PULSE_TIMEOUT:
                process_pulses()
    except KeyboardInterrupt:
        print("\n結束測試，清理 GPIO")
    finally:
        GPIO.cleanup()

if __name__ == "__main__":
    main()
