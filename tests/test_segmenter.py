import unittest
import numpy as np
import cv2
from backend.app.ai.segmenter import WhiteBgSegmenter, SegmentConfig

class TestSegmenter(unittest.TestCase):
    def test_white_bg_segmentation_finds_distinct_objects(self):
        # 建立 400x400 純白背景 (255, 255, 255)
        canvas = np.full((400, 400, 3), 255, dtype=np.uint8)
        
        # 繪製商品 A (彩色有飽和度，中心約 100, 100，大小 80x80)
        cv2.rectangle(canvas, (60, 60), (140, 140), (200, 50, 50), -1)
        
        # 繪製商品 B (中心約 280, 280，大小 80x80)
        cv2.rectangle(canvas, (240, 240), (320, 320), (50, 180, 50), -1)

        cfg = SegmentConfig(min_area_ratio=0.01, max_area_ratio=0.6)
        segmenter = WhiteBgSegmenter(cfg)
        masks, boxes = segmenter.segment(canvas)

        self.assertEqual(len(masks), 2, f"應偵測到 2 個商品，實際偵測到 {len(masks)}")
        self.assertEqual(len(boxes), 2)
        
        # 檢查 box 格式為 [x1, y1, x2, y2]
        for box in boxes:
            self.assertEqual(len(box), 4)
            x1, y1, x2, y2 = box
            self.assertTrue(x1 < x2 and y1 < y2)

    def test_blank_white_image_returns_empty(self):
        canvas = np.full((300, 300, 3), 255, dtype=np.uint8)
        segmenter = WhiteBgSegmenter()
        masks, boxes = segmenter.segment(canvas)
        self.assertEqual(len(masks), 0)
        self.assertEqual(len(boxes), 0)

if __name__ == "__main__":
    unittest.main()
