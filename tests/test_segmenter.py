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

    def test_slender_object_detection(self):
        # 測試細長觸控筆與大碗麵並存時，觸控筆能成功獲得種子並切出
        canvas = np.full((400, 400, 3), 245, dtype=np.uint8)
        # 大碗 (半徑 60)
        cv2.circle(canvas, (150, 150), 60, (200, 80, 50), -1)
        # 細長淺色觸控筆 (寬 10, 高 150, 長寬比 15)
        cv2.rectangle(canvas, (320, 100), (330, 250), (220, 220, 220), -1)
        cv2.rectangle(canvas, (320, 100), (330, 250), (100, 100, 100), 1)

        cfg = SegmentConfig()
        segmenter = WhiteBgSegmenter(cfg)
        masks, boxes = segmenter.segment(canvas)
        self.assertEqual(len(boxes), 2, f"應同時偵測到大碗與細長觸控筆，實際偵測到 {len(boxes)}")

if __name__ == "__main__":
    unittest.main()
