import os
import sys

# 設定 ARM CPU 基礎相容環境變數
os.environ["ATEN_CPU_CAPABILITY"] = "default"
os.environ["OPENBLAS_CORETYPE"] = "ARMV8"
os.environ["OMP_NUM_THREADS"] = "2"

print(f"🐍 Python 版本: {sys.version.split()[0]}")

try:
    print("📦 載入 PyTorch 與 TorchVision...")
    import torch
    import torchvision
    print(f"   - PyTorch: {torch.__version__}")
    print(f"   - TorchVision: {torchvision.__version__}")

    print("⚡ 測試建立 Tensor 矩陣...")
    x = torch.randn(1, 3, 224, 224)
    print("   - Tensor 建立成功！")

    print("🧠 測試 EfficientNet-B0 神經網路前向推論...")
    m = torchvision.models.efficientnet_b0(weights=None)
    m.eval()
    with torch.no_grad():
        out = m(x)

    print(f"🎉 測試大成功！輸出維度: {list(out.shape)}")
    print("👉 代表 CPU 指令集與 AI 模型推論完全相容，可以啟動 start_pi.sh 了！")
except Exception as e:
    print(f"❌ 測試失敗: {e}")
