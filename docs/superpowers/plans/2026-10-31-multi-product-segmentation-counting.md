# 飛鼠商店 (Tribal Shop) 多商品自動分割計數與 POS 數量加減實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在不改動 Supabase 資料庫結構的前提下，為樹莓派現場 POS 實作結帳白桌面多商品無類別自動分割、批次特徵比對與數量聚合，並在前端提供觸控友善的 `+`/`-` 數量微調與結帳引導。

**Architecture:** 
1. **後端 AI 管線**：分為 Stage 1 白底多商品分割 (`WhiteBgSegmenter`，結合雙邊濾波、HSV 飽和度、光照差分與分水嶺演算法)、Stage 2 去背填白與 1:1 正方形補邊 (`crop_mask_and_pad_pil` / `preprocess_single_enrollment_image`)、Stage 3 EfficientNet ONNX 批次推論 (`OnnxEfficientNetEmbedder`)。
2. **檢索與歸戶**：在 `vision.py` 透過 `pgvector` 比對 (`pe.label_name = p.label_name`) 取最接近商品，並依 `product_id` 歸戶聚合初始數量 `quantity`。
3. **前端互動**：在 `ScanPage.jsx` 拍照後呼叫 `/vision/scan-table`，透過 `CheckoutCartEditor.jsx` 呈現大按鈕觸控介面，提供顧客即時增減數量後直接進入投幣結帳 (`/payment`)。

**Tech Stack:** FastAPI, ONNX Runtime, OpenCV (opencv-python-headless), Pillow, NumPy, psycopg2 (pgvector), React 19, Tailwind CSS 3, Vite.

**Spec:** `/tmp/user_spec.md` (飛鼠商店 - 多商品自動分割計數與 POS 數量加減實作指南 (不改 DB 架構版))

## Global Constraints

- **【資料庫零更動】**：完全沿用現有 Supabase 資料表 (`products`, `product_embeddings`, `training_data`)，不修改 DB Schema，不新增欄位。
- **【建庫與推論基底一致】**：`vision.py` 的 `generate-embeddings` 處理商品照片時，先呼叫 `preprocess_single_enrollment_image` 去背填白補正方形，使建庫特徵與現場推論分佈一致。
- **【絕不安裝 PyTorch】**：樹莓派現場僅使用 `onnxruntime`, `Pillow`, `numpy`, `opencv-python-headless`，嚴防 ARMv8 SIGILL 崩潰。
- **【前端語言為 JSX】**：專案使用 React JSX，組件為 `.jsx` 格式。
- **【分支與發布】**：所有變更在 `rasberryVersion` 分支完成並推送到 GitHub 遠端倉庫。

---

### Task 1: 依賴更新 (`backend/requirements.txt`)

**Files:**
- Modify: `backend/requirements.txt`
- Test: `tests/test_deps.py`

**Interfaces:**
- Consumes: Python environment
- Produces: `opencv-python-headless>=4.8.0` requirement in requirements.txt

- [x] **Step 1: Write test to verify requirements.txt contains opencv-python-headless**

```python
# tests/test_deps.py
import re
from pathlib import Path

def test_requirements_contains_opencv_headless():
    req_file = Path("backend/requirements.txt")
    assert req_file.exists()
    content = req_file.read_text(encoding="utf-8")
    assert re.search(r"opencv-python-headless\s*>=\s*4\.8\.0", content)
    assert "torch" not in content.lower()
```

- [x] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_deps.py`
Expected: FAIL (missing dependency)

- [x] **Step 3: Update `backend/requirements.txt`**

在 `backend/requirements.txt` 的 AI 影像模型區塊加入 `opencv-python-headless>=4.8.0`。

- [x] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_deps.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/requirements.txt tests/test_deps.py
git commit -m "deps: 新增 opencv-python-headless>=4.8.0 相依設定"
```

---

### Task 2: Stage 1 白底多商品無類別分割器 (`backend/app/ai/segmenter.py`)

**Files:**
- Create: `backend/app/ai/segmenter.py`
- Test: `tests/test_segmenter.py`

**Interfaces:**
- Consumes: `img_rgb: np.ndarray` (H, W, 3)
- Produces: `WhiteBgSegmenter.segment(img_rgb) -> tuple[list[np.ndarray], list[list[int]]]` (masks, bounding_boxes `[x1, y1, x2, y2]`)

- [x] **Step 1: Write test for WhiteBgSegmenter**

```python
# tests/test_segmenter.py
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

        self.assertEqual(len(masks), 2)
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_segmenter.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.app.ai.segmenter'`

- [x] **Step 3: Implement `WhiteBgSegmenter` in `backend/app/ai/segmenter.py`**

依照規格書實作雙邊濾波、HSV S 通道抗陰影、光照差分抗白包裝、形態學閉運算、分水嶺分離與包含度過濾。

- [x] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python3 -m unittest tests/test_segmenter.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/app/ai/segmenter.py tests/test_segmenter.py
git commit -m "feat(ai): 實作 Stage 1 白底多商品無類別分割器 WhiteBgSegmenter"
```

---

### Task 3: Stage 2 遮罩去背填白與 1:1 正方形補邊 (`backend/app/ai/preprocessor.py`)

**Files:**
- Create: `backend/app/ai/preprocessor.py`
- Test: `tests/test_preprocessor.py`

**Interfaces:**
- Consumes: `img_rgb: np.ndarray`, `mask: np.ndarray`, `box: list[int]`
- Produces: 
  - `crop_mask_and_pad_pil(img_rgb, mask, box, target_size=224, bg_color=255) -> PIL.Image.Image` (224x224 RGB)
  - `preprocess_single_enrollment_image(pil_img, segmenter, target_size=224) -> PIL.Image.Image` (224x224 RGB)

- [x] **Step 1: Write test for preprocessor**

```python
# tests/test_preprocessor.py
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

if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python3 -m unittest tests/test_preprocessor.py`
Expected: FAIL

- [x] **Step 3: Implement `backend/app/ai/preprocessor.py`**

實作 `crop_mask_and_pad_pil` 與 `preprocess_single_enrollment_image`，正確將非遮罩區域補白、計算外接正方形並以 LANCZOS 縮放為 224x224。

- [x] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python3 -m unittest tests/test_preprocessor.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/app/ai/preprocessor.py tests/test_preprocessor.py
git commit -m "feat(ai): 實作 Stage 2 去背填白與 1:1 正方形補邊 preprocessor"
```

---

### Task 4: Stage 3 EfficientNet ONNX 批次特徵提取器 (`backend/app/ai/onnx_embedder.py`)

**Files:**
- Create: `backend/app/ai/onnx_embedder.py`
- Test: `tests/test_onnx_embedder.py`

**Interfaces:**
- Consumes: `onnx_model_path: str | Path`, list of `PIL.Image.Image` (224x224)
- Produces: `OnnxEfficientNetEmbedder.extract_batch(images: list[Image.Image]) -> np.ndarray` (shape: `(N, 1280)`)

- [x] **Step 1: Write test for OnnxEfficientNetEmbedder**

```python
# tests/test_onnx_embedder.py
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
        # 驗證數值非全 0 或 NaN
        self.assertFalse(np.isnan(embeddings).any())
        self.assertTrue(np.abs(embeddings).sum() > 0)

    def test_empty_batch(self):
        model_path = Path("backend/app/ai/best_efficientnet_model.onnx")
        embedder = OnnxEfficientNetEmbedder(str(model_path))
        embeddings = embedder.extract_batch([])
        self.assertEqual(len(embeddings), 0)

if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python3 -m unittest tests/test_onnx_embedder.py`
Expected: FAIL

- [x] **Step 3: Implement `backend/app/ai/onnx_embedder.py`**

- 封裝 ONNX Runtime 推論 Session，設定 intra_op_num_threads=2。
- 批次正規化 (ImageNet mean & std)，組成 `(N, 3, 224, 224)` 浮點張量。
- 一次推論整批圖片，回傳 `(N, 1280)` 特徵陣列。

- [x] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python3 -m unittest tests/test_onnx_embedder.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/app/ai/onnx_embedder.py tests/test_onnx_embedder.py
git commit -m "feat(ai): 實作 Stage 3 EfficientNet ONNX 批次特徵提取器"
```

---

### Task 5: 結合建庫前處理 (`generate-embeddings` & `embedding_worker.py`)

**Files:**
- Modify: `backend/app/routers/vision.py:1230-1280`
- Modify: `backend/embedding_worker.py`
- Test: `tests/test_enrollment_preprocessor.py`

**Interfaces:**
- Consumes: `preprocess_single_enrollment_image`
- Produces: 建庫照片在 augmentation 前先經去背與 1:1 補邊，保證特徵空間一致

- [x] **Step 1: Write test for enrollment preprocessing logic**

```python
# tests/test_enrollment_preprocessor.py
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
```

- [x] **Step 2: Update `backend/app/routers/vision.py`**

在 `generate_embeddings` 函式下載完 `original_images` 後：
```python
clean_images = [preprocess_single_enrollment_image(img, SEGMENTER) for img in original_images]
augmented_images = augment_to_target(clean_images, target=120)
```
並確保 `SEGMENTER` 由 `WhiteBgSegmenter` 實例化。

- [x] **Step 3: Update `backend/embedding_worker.py`**

加入相應的說明與 import，維持 job claim 與回報邏輯完全不變。

- [x] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python3 -m unittest tests/test_enrollment_preprocessor.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/app/routers/vision.py backend/embedding_worker.py tests/test_enrollment_preprocessor.py
git commit -m "feat(worker): 建庫照片抽特徵前導入去背與 1:1 補正方形預處理"
```

---

### Task 6: 多商品分割檢索與數量歸戶 API (`backend/app/routers/vision.py`)

**Files:**
- Modify: `backend/app/routers/vision.py`
- Test: `tests/test_scan_table_api.py`

**Interfaces:**
- Endpoint: `POST /vision/scan-table` (同時支援 `/api/vision/scan-table`)
- Input: `file: UploadFile = File(...)` (或 `image`)
- Output: 
  ```json
  {
    "status": "success",
    "total_objects_detected": 2,
    "unrecognized_count": 0,
    "cart_items": [
      {
        "product_id": "1",
        "name": "商品名",
        "price": 100,
        "image_url": "...",
        "quantity": 2,
        "max_similarity": 0.95
      }
    ],
    "detections": [...]
  }
  ```

- [x] **Step 1: Write test for `/vision/scan-table` route**

```python
# tests/test_scan_table_api.py
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
import numpy as np
from PIL import Image
import io

class TestScanTableApi(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("backend.app.routers.vision.get_db")
    def test_scan_table_empty_canvas(self, mock_get_db):
        # 傳入純白圖片，無商品
        img = Image.new("RGB", (300, 300), (255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        response = self.client.post(
            "/vision/scan-table",
            files={"file": ("frame.jpg", buf, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_objects_detected"], 0)
        self.assertEqual(data["cart_items"], [])

    @patch("backend.app.routers.vision.get_db")
    def test_scan_table_aggregates_quantity(self, mock_get_db):
        # 模擬 DB 回傳相同商品
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "id": 42,
            "name": "高山茶",
            "price": 50,
            "image_url": "https://example.com/tea.jpg",
            "stock": 10,
            "label_name": "tea",
            "similarity": 0.88
        }
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_get_db.return_value = mock_conn

        # 模擬 2 個商品
        canvas = np.full((400, 400, 3), 255, dtype=np.uint8)
        canvas[60:140, 60:140] = [200, 50, 50]
        canvas[240:320, 240:320] = [200, 50, 50]
        pil_img = Image.fromarray(canvas)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG")
        buf.seek(0)

        response = self.client.post(
            "/vision/scan-table",
            files={"file": ("frame.jpg", buf, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_objects_detected"], 2)
        self.assertEqual(len(data["cart_items"]), 1)
        self.assertEqual(data["cart_items"][0]["quantity"], 2)
        self.assertEqual(data["cart_items"][0]["product_id"], "42")

if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python3 -m unittest tests/test_scan_table_api.py`
Expected: FAIL (404 Not Found)

- [x] **Step 3: Implement `/scan-table` in `backend/app/routers/vision.py`**

- 撰寫 `query_pgvector_nearest(conn, vec_list)`，以正確的 `JOIN products p ON p.label_name = pe.label_name` 查出最相近商品與 similarity。
- 撰寫 `scan_checkout_table`：分割 -> 遮罩補白 -> batch ONNX 提取 -> 比對與 `quantity` 聚合 -> 回傳 `cart_items`。
- 同時在 `main.py` 或 router 宣告路徑，相容 `/vision/scan-table` 與 `/api/vision/scan-table`。

- [x] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python3 -m unittest tests/test_scan_table_api.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/app/routers/vision.py backend/main.py tests/test_scan_table_api.py
git commit -m "feat(vision): 實作 /scan-table 多商品分割檢索與數量歸戶 API"
```

---

### Task 7: 前端 POS 觸控加減數量介面 (`frontend/src/components/CheckoutCartEditor.jsx`)

**Files:**
- Create: `frontend/src/components/CheckoutCartEditor.jsx`
- Create: `frontend/src/components/CartConfirmModal.jsx` (相容規格別名)

**Interfaces:**
- Props:
  - `initialItems: Array<{ product_id, name, price, image_url, quantity }>`
  - `totalDetectedCount: number`
  - `unrecognizedCount: number`
  - `onRescan: () => void`
  - `onProceedToPay: (finalItems, totalAmount) => void`
- Behavior:
  - 點擊 `+` 增加該商品數量與總金額
  - 點擊 `-` 減少數量，減至 0 時自動移除
  - 若 `unrecognizedCount > 0` 顯示溫馨警語
  - 點擊「確認數量，開始投幣結帳 ➔」回傳最終商品清單與金額

- [x] **Step 1: Create `frontend/src/components/CheckoutCartEditor.jsx`**

根據規格書第 4 節轉換為標準 React JSX，套用大尺寸觸控按鈕 (`w-12 h-12`、`text-2xl`) 與 Tailwind 樣式。

- [x] **Step 2: Create `frontend/src/components/CartConfirmModal.jsx`**

導出 `CheckoutCartEditor` 以符合檔案清單別名需求。

- [x] **Step 3: Run frontend build to verify syntax**

Run: `cd frontend && npm run build`
Expected: PASS (builds cleanly)

- [x] **Step 4: Commit**

```bash
git add frontend/src/components/CheckoutCartEditor.jsx frontend/src/components/CartConfirmModal.jsx
git commit -m "feat(pos): 新增觸控友善之 CheckoutCartEditor 與 CartConfirmModal 組件"
```

---

### Task 8: 整合 ScanPage 拍照流程與投幣結帳導向

**Files:**
- Modify: `frontend/src/pages/ScanPage.jsx`
- Modify: `frontend/src/context/CheckoutContext.jsx` (若需提供 `setCart` 或批次更新)

**Interfaces:**
- Consumes: `/vision/scan-table`, `CheckoutCartEditor`
- Produces: 拍照辨識成功後直接切換至 `CheckoutCartEditor`，點擊結帳後寫入 `cart` 並導航至 `/payment`。

- [x] **Step 1: Check and ensure `setCart` in `CheckoutContext`**

確保 `CheckoutContext` 導出 `setCart` 供辨識結果一次性同步購物車。

- [x] **Step 2: Update `ScanPage.jsx`**

- 調整 `callVisionAPI` 優先呼叫 `${API_BASE_URL}/vision/scan-table`，回傳 `cart_items`, `total_objects_detected`, `unrecognized_count`。
- 在 `scanPhase === "RESULT"` 時，渲染 `<CheckoutCartEditor>`。
- 實現 `onProceedToPay`：將修正後的 items 寫入 Context 並調用 `navigate("/payment")`。
- 實現 `onRescan`：重置掃描狀態回到相機畫面。

- [x] **Step 3: Run frontend build to verify compilation**

Run: `cd frontend && npm run build`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add frontend/src/pages/ScanPage.jsx frontend/src/context/CheckoutContext.jsx
git commit -m "feat(pos): 將 ScanPage 串接 /scan-table 與 CheckoutCartEditor 結帳引導"
```

---

### Task 9: 全系統回歸驗證 (Regression & Verification)

**Files:**
- Test all created test suites: `tests/`
- Verify frontend production build: `frontend/dist/`
- Verify documentation: `DEPLOYMENT_PI.md`

- [x] **Step 1: Run all backend tests**

Run: `PYTHONPATH=. python3 -m unittest discover tests -v`
Expected: ALL PASS

- [x] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: PASS with 0 errors

- [x] **Step 3: Verify no PyTorch in requirements.txt**

Run: `grep -i torch backend/requirements.txt || echo "Clean: No PyTorch"`
Expected: Clean

- [x] **Step 4: Commit**

```bash
git add .
git commit -m "test: 完成多商品自動分割計數與 POS 介面驗證"
```

---

### Task 10: 推送變更至 GitHub 遠端倉庫

- [x] **Step 1: Push branch to GitHub**

```bash
git push origin rasberryVersion
```

- [x] **Step 2: Confirm git status clean**

Run: `git status`
Expected: `nothing to commit, working tree clean`
