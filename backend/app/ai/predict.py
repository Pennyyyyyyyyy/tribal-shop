import os
import logging
from pathlib import Path
from PIL import Image
import numpy as np

logger = logging.getLogger("predict")

BASE_AI_DIR = Path(__file__).resolve().parent
ONNX_MODEL_PATH = BASE_AI_DIR / "best_efficientnet_model.onnx"
PT_MODEL_PATH = BASE_AI_DIR / "best_efficientnet_model.pt"

# 優先使用 ONNX Runtime (樹莓派 ARM CPU 上執行更快且具 100% 指令集相容性，免除 PyTorch SIGILL)
USE_ONNX = False
ort_session = None

try:
    import onnxruntime as ort
    if ONNX_MODEL_PATH.is_file():
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = 2
        ort_session = ort.InferenceSession(
            str(ONNX_MODEL_PATH),
            sess_options=sess_options,
            providers=["CPUExecutionProvider"]
        )
        USE_ONNX = True
        print("[AI] ✅ 成功啟用 ONNX Runtime EfficientNet 推論引擎 (相容 ARM64 / 樹莓派)")
except Exception as e:
    logger.warning("無法載入 ONNX Runtime: %s，將使用 PyTorch 備援", e)
    USE_ONNX = False

if not USE_ONNX:
    import torch
    import torch.nn as nn
    from torchvision import transforms
    from app.ai.model import load_model

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    raw_model = load_model(51, str(PT_MODEL_PATH), device)
    raw_model.classifier = nn.Identity()
    raw_model.eval()
    vector_model = raw_model

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])


def _preprocess_numpy(image: Image.Image) -> np.ndarray:
    if image.mode != "RGB":
        image = image.convert("RGB")
    image_resized = image.resize((224, 224), Image.BILINEAR)
    arr = np.array(image_resized, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    arr = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(arr, 0)


def get_embedding(image: Image.Image) -> list[float]:
    if USE_ONNX and ort_session is not None:
        input_data = _preprocess_numpy(image)
        outputs = ort_session.run(["embedding"], {"input": input_data})
        return outputs[0].flatten().tolist()
    else:
        if image.mode != "RGB":
            image = image.convert("RGB")
        input_tensor = transform(image).unsqueeze(0).to(device)
        with torch.no_grad():
            embedding = vector_model(input_tensor)
        return embedding.cpu().numpy().flatten().tolist()


def get_embeddings(images: list[Image.Image]) -> list[list[float]]:
    return [get_embedding(img) for img in images]
