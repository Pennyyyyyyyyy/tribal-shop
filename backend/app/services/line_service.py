def send_line_notification(message: str, image_path: str = None):
    """
    模擬發送 LINE 通知給店長
    """
    print(f"\n======== [LINE Notify] ========")
    print(f"訊息: {message}")
    if image_path:
        print(f"附圖: {image_path}")
    print(f"===============================\n")
    
    # 未來如果要接真的 LINE，就在這裡寫 line_bot_api.push_message