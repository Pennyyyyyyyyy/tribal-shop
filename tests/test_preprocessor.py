import unittest
import numpy as np
from PIL import Image
from backend.app.ai.segmenter import WhiteBgSegmenter
from backend.app.ai.preprocessor import crop_mask_and_pad_pil, preprocess_single_enrollment_image

class TestPreprocessor(unittest.TestCase):
    def test_crop_mask_and_pad_pil(self):
        img_rgb = np.full((200, 200, 3), 255, dtype=np.uint8)
        # 在中央放置藍色長方形 100x50
        img_rgb[75:125, 50:150] = [0, 0, 255]
        mask = np.zeros((200, 200), dtype=bool)
        mask[75:125, 50:150] = True
        box = [50, 75, 150, 125]

        out_pil = crop_mask_and_pad_pil(img_rgb, mask, box, target_size=224)
        self.assertEqual(out_pil.size, (224, 224))
        self.assertEqual(out_pil.mode, "RGB")
        # 四個角落應為純白 (255, 255, 255)
        out_arr = np.array(out_pil)
        np.testing.assert_array_equal(out_arr[0, 0], [255, 255, 255])
        np.testing.assert_array_equal(out_arr[223, 223], [255, 255, 255])

    def test_preprocess_single_enrollment_image(self):
        pil_img = Image.new("RGB", (300, 300), (255, 255, 255))
        # 畫一個方塊
        img_arr = np.array(pil_img)
        img_arr[50:150, 50:150] = [180, 40, 40]
        pil_img = Image.fromarray(img_arr)

        segmenter = WhiteBgSegmenter()
        res = preprocess_single_enrollment_image(pil_img, segmenter, target_size=224)
        self.assertEqual(res.size, (224, 224))
        self.assertEqual(res.mode, "RGB")

if __name__ == "__main__":
    unittest.main()
