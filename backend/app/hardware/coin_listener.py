import asyncio
import logging
import os
import threading
import time

logger = logging.getLogger("coin_listener")

try:
    import RPi.GPIO as GPIO
    HAS_GPIO = True
except (ImportError, RuntimeError):
    HAS_GPIO = False

# 預設使用 BCM 27 (實體 Pin 13)
COIN_PIN = int(os.getenv("COIN_PIN", "27"))
BOUNCE_TIME = int(os.getenv("COIN_BOUNCE_TIME", "50"))
PULSE_TIMEOUT = float(os.getenv("COIN_PULSE_TIMEOUT", "0.35"))

_pulse_count = 0
_last_pulse_time = 0
_lock = threading.Lock()
_running = False
_worker_thread = None
_loop = None

def _pulse_callback(channel):
    global _pulse_count, _last_pulse_time
    with _lock:
        _pulse_count += 1
        _last_pulse_time = time.time()
        logger.debug("[GPIO 27] 偵測到投幣脈衝！目前累積: %d", _pulse_count)

def _monitor_loop(broadcast_fn):
    global _pulse_count, _last_pulse_time, _running, _loop
    logger.info("[Coin] 投幣機脈衝處理迴圈已啟動 (GPIO %d, bouncetime=%d)", COIN_PIN, BOUNCE_TIME)

    while _running:
        time.sleep(0.05)
        to_process = 0
        with _lock:
            if _pulse_count > 0 and (time.time() - _last_pulse_time) > PULSE_TIMEOUT:
                to_process = _pulse_count
                _pulse_count = 0

        if to_process > 0:
            # 轉換脈衝為金額
            from app.routers.payment import pulses_to_amount
            amount = pulses_to_amount(to_process)
            logger.info("💰 投幣結算：收到 %d 個脈衝，換算 NT$ %d", to_process, amount)
            if _loop and not _loop.is_closed():
                asyncio.run_coroutine_threadsafe(
                    broadcast_fn({"type": "coin_inserted", "amount": amount}),
                    _loop
                )

def start_coin_listener(loop, broadcast_fn):
    """在後端啟動時開啟 GPIO 投幣監聽"""
    global _running, _worker_thread, _loop

    if not HAS_GPIO:
        logger.info("ℹ️  非樹莓派環境 (無 RPi.GPIO)，略過 GPIO 27 實體監聽。可使用 /api/mock-coin 或 /api/hardware-pulse 測試。")
        return

    _loop = loop
    _running = True

    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(COIN_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.add_event_detect(COIN_PIN, GPIO.FALLING, callback=_pulse_callback, bouncetime=BOUNCE_TIME)
        logger.info("✅ 樹莓派投幣機已就緒！正在監聽 BCM GPIO %d (實體 Pin 13)", COIN_PIN)

        _worker_thread = threading.Thread(target=_monitor_loop, args=(broadcast_fn,), daemon=True)
        _worker_thread.start()
    except Exception as e:
        logger.error("❌ 啟動 GPIO 投幣機監聽失敗: %s", e)

def stop_coin_listener():
    """在後端關閉時清理 GPIO"""
    global _running
    _running = False

    if HAS_GPIO:
        try:
            GPIO.cleanup(COIN_PIN)
            logger.info("[Coin] 已釋放 GPIO %d", COIN_PIN)
        except Exception as e:
            logger.debug("[Coin] GPIO cleanup 警告: %s", e)
