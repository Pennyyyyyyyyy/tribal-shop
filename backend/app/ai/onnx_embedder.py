import logging
from pathlib import Path
from PIL import Image
import numpy as np

logger = logging.getLogger("onnx_embedder")

try:
    import onnxruntime as ort
except ImportError:
    ort = None


class OnnxEfficientNetEmbedder:
    """Stage 3: EfficientNet ONNX 批次特徵提取器

    專為樹莓派 CPU 最佳化，支援多張圖片一次性批次推論，免除重複前向傳遞開銷。
    """

    def __init__(self, onnx_model_path: str | Path, num_threads: int = 2):
        self.model_path = Path(onnx_model_path).resolve()
        if not self.model_path.is_file():
            raise FileNotFoundError(f"找不到 ONNX 模型檔：{self.model_path}")

        if ort is None:
            raise RuntimeError("未安裝 onnxruntime 套件")

        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = num_threads
        sess_options.inter_op_num_threads = 1
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.session = ort.InferenceSession(
            str(self.model_path),
            sess_options=sess_options,
            providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        logger.info("已載入 ONNX EfficientNet 模型：%s (輸入=%s, 輸出=%s)", self.model_path.name, self.input_name, self.output_name)

    def _preprocess_batch(self, images: list[Image.Image]) -> np.ndarray:
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

        batch_arr = np.empty((len(images), 3, 224, 224), dtype=np.float32)
        for i, img in enumerate(images):
            if img.mode != "RGB":
                img = img.convert("RGB")
            if img.size != (224, 224):
                img = img.resize((224, 224), Image.BILINEAR)
            arr = np.asarray(img, dtype=np.float32) / 255.0
            # (H, W, C) -> (C, H, W)
            batch_arr[i] = np.transpose(arr, (2, 0, 1))

        # 批次常態化
        batch_arr = (batch_arr - mean) / std
        return batch_arr

    def extract_batch(self, images: list[Image.Image]) -> np.ndarray:
        """批次提取特徵向量，回傳形狀為 (N, 1280) 的 numpy 陣列。"""
        if not images:
            return np.empty((0, 1280), dtype=np.float32)

        batch_tensor = self._preprocess_batch(images)
        outputs = self.session.run([self.output_name], {self.input_name: batch_tensor})
        return outputs[0]

    def extract(self, image: Image.Image) -> list[float]:
        """單張提取特徵向量，回傳長度為 1280 的 list[float]。"""
        res = self.extract_batch([image])
        return res[0].flatten().tolist()
