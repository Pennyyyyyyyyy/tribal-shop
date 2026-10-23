import os
import sys

# 設定 ARM CPU 基礎相容環境變數
os.environ["ATEN_CPU_CAPABILITY"] = "default"
os.environ["OPENBLAS_CORETYPE"] = "ARMV8"
os.environ["OMP_NUM_THREADS"] = "2"

print(f"🐍 Python 版本: {sys.version.split()[0]}")

# 1. 優先測試 ONNX Runtime (樹莓派現場最佳化引擎)
print("\n" + "=" * 50)
print("🚀 測試 1: ONNX Runtime 推論引擎 (樹莓派首選)")
print("=" * 50)
try:
    import onnxruntime as ort
    from PIL import Image
    import numpy as np

    print("   - onnxruntime 載入成功 (版本: %s)" % ort.__version__)
    onnx_path = "backend/app/ai/best_efficientnet_model.onnx"
    if not os.path.exists(onnx_path):
        onnx_path = "app/ai/best_efficientnet_model.onnx"

    if os.path.exists(onnx_path):
        sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
        dummy = np.random.randn(1, 3, 224, 224).astype(np.float32)
        out = sess.run(["embedding"], {"input": dummy})[0]
        print("   ✅ ONNX 推論成功！輸出形狀: %s" % str(out.shape))
        print("   🎉 ONNX 引擎 100% 相容樹莓派 CPU，完全不受無效指令影響！")
    else:
        print("   ⚠️ 找不到 ONNX 模型檔: %s" % onnx_path)
except Exception as e:
    print("   ❌ ONNX 測試失敗: %s" % e)

# 2. 測試 PyTorch
print("\n" + "=" * 50)
print("🔍 測試 2: PyTorch 引擎 (備援)")
print("=" * 50)
try:
    import torch
    import torchvision
    print("   - PyTorch 載入成功 (版本: %s)" % torch.__version__)
    m = torchvision.models.efficientnet_b0(weights=None)
    m.eval()
    x = torch.randn(1, 3, 224, 224)
    out = m(x)
    print("   ✅ PyTorch 推論成功！輸出形狀: %s" % str(out.shape))
except Exception as e:
    print("   ⚠️ PyTorch 推論未通過 (可直接改用 ONNX 引擎): %s" % e)
