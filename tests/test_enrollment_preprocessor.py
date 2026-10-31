import unittest
from PIL import Image
import numpy as np
from backend.app.ai.segmenter import WhiteBgSegmenter
from backend.app.ai.preprocessor import preprocess_single_enrollment_image

class TestEnrollmentIntegration(unittest.TestCase):
    def test_enrollment_image_preprocessing(self):
        seg = WhiteBgSegmenter()
        raw_img = Image.new("RGB", (640, 480), (255, 255, 255))
        # 模擬商品
        arr = np.array(raw_img)
        arr[100:300, 150:350] = [100, 150, 200]
        raw_img = Image.fromarray(arr)
        
        clean_img = preprocess_single_enrollment_image(raw_img, seg, target_size=224)
        self.assertEqual(clean_img.size, (224, 224))
        self.assertEqual(clean_img.mode, "RGB")

if __name__ == "__main__":
    unittest.main()
