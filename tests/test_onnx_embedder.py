import unittest
from pathlib import Path
from PIL import Image
import numpy as np
from backend.app.ai.onnx_embedder import OnnxEfficientNetEmbedder

class TestOnnxEmbedder(unittest.TestCase):
    def test_batch_extraction(self):
        model_path = Path("backend/app/ai/best_efficientnet_model.onnx")
        self.assertTrue(model_path.exists(), "ONNX 模型檔不存在")

        embedder = OnnxEfficientNetEmbedder(str(model_path))
        img1 = Image.new("RGB", (224, 224), (255, 0, 0))
        img2 = Image.new("RGB", (224, 224), (0, 255, 0))

        embeddings = embedder.extract_batch([img1, img2])
        self.assertEqual(embeddings.shape, (2, 1280))
        self.assertFalse(np.isnan(embeddings).any(), "特徵值不可含 NaN")
        self.assertTrue(np.abs(embeddings).sum() > 0, "特徵值不可全為 0")

    def test_empty_batch(self):
        model_path = Path("backend/app/ai/best_efficientnet_model.onnx")
        embedder = OnnxEfficientNetEmbedder(str(model_path))
        embeddings = embedder.extract_batch([])
        self.assertEqual(len(embeddings), 0)

if __name__ == "__main__":
    unittest.main()
