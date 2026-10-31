import unittest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi import UploadFile
import numpy as np
from PIL import Image
import io

from backend.app.routers.vision import scan_checkout_table

class TestScanTableApi(unittest.TestCase):
    def test_scan_table_empty_canvas(self):
        img = Image.new("RGB", (300, 300), (255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        upload_file = UploadFile(filename="frame.jpg", file=buf)

        data = asyncio.run(scan_checkout_table(upload_file))
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["total_objects_detected"], 0)
        self.assertEqual(data["cart_items"], [])

    @patch("backend.app.routers.vision.query_pgvector_nearest")
    def test_scan_table_aggregates_quantity(self, mock_query):
        # 模擬比對 DB 命中同一個商品
        mock_query.return_value = {
            "product_id": "42",
            "name": "高山茶",
            "price": 50,
            "image_url": "https://example.com/tea.jpg",
            "similarity": 0.88
        }

        # 建立有 2 個商品的圖片
        canvas = np.full((400, 400, 3), 255, dtype=np.uint8)
        canvas[60:140, 60:140] = [200, 50, 50]
        canvas[240:320, 240:320] = [50, 180, 50]
        pil_img = Image.fromarray(canvas)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG")
        buf.seek(0)
        upload_file = UploadFile(filename="frame.jpg", file=buf)

        data = asyncio.run(scan_checkout_table(upload_file))
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["total_objects_detected"], 2)
        self.assertEqual(len(data["cart_items"]), 1)
        self.assertEqual(data["cart_items"][0]["quantity"], 2)
        self.assertEqual(data["cart_items"][0]["product_id"], "42")
        self.assertEqual(data["cart_items"][0]["price"], 50)

if __name__ == "__main__":
    unittest.main()
