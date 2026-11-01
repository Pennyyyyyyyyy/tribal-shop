import cv2
import numpy as np
from dataclasses import dataclass


@dataclass
class SegmentConfig:
    min_area_ratio: float = 0.015       # 一般商品最小面積佔比 (1.5%)
    min_slender_area_ratio: float = 0.003 # 細長商品最小面積佔比 (0.3%，捕捉細長商品如白色觸控筆、餐具)
    max_area_ratio: float = 0.70        # 最大商品面積佔比 (放寬至 70% 容納近距大碗麵)
    max_aspect_ratio: float = 25.0      # 最大長寬比 (放寬至 25.0 支援細長觸控筆)
    containment_threshold: float = 0.85 # 內部包含重疊門檻 (過濾商品內部的文字/大色塊)
    max_process_dim: int = 800          # 分割前處理最大邊長 (等比降採樣大幅加速 CPU 運算)
    s_thresh: int = 28                  # HSV S 通道飽和度門檻 (28 能精準分離彩色包裝與灰白桌面陰影，避免 3~4 件商品誤黏)
    dist_threshold: float = 0.40        # 分水嶺前置距離變換種子閥值 (0.40 可穩健分離緊靠商品)


class WhiteBgSegmenter:
    """Stage 1: 白底多商品無類別分割器

    針對白底結帳台之陰影與包裝反光，透過 HSV 飽和度、光照差分與形態學分水嶺切出獨立商品。
    """

    def __init__(self, config: SegmentConfig = SegmentConfig()):
        self.cfg = config

    def segment(self, img_rgb: np.ndarray) -> tuple[list[np.ndarray], list[list[int]]]:
        """輸入 RGB numpy 陣列 (H, W, 3)，回傳:

        - final_masks: list of bool ndarray (H, W)
        - final_boxes: list of [x1, y1, x2, y2]
        """
        orig_h, orig_w = img_rgb.shape[:2]
        needs_scale = max(orig_h, orig_w) > self.cfg.max_process_dim
        if needs_scale:
            scale = self.cfg.max_process_dim / float(max(orig_h, orig_w))
            proc_w = max(1, int(round(orig_w * scale)))
            proc_h = max(1, int(round(orig_h * scale)))
            proc_rgb = cv2.resize(img_rgb, (proc_w, proc_h), interpolation=cv2.INTER_AREA)
        else:
            scale = 1.0
            proc_rgb = img_rgb
            proc_w, proc_h = orig_w, orig_h

        h, w = proc_h, proc_w
        total_area = float(h * w)

        blurred = cv2.bilateralFilter(proc_rgb, d=9, sigmaColor=75, sigmaSpace=75)
        hsv = cv2.cvtColor(blurred, cv2.COLOR_RGB2HSV)

        # 1. 取飽和度 S 通道 (抗白底桌面灰黑陰影)
        _, s_thresh = cv2.threshold(hsv[:, :, 1], self.cfg.s_thresh, 255, cv2.THRESH_BINARY)

        # 2. Canny 邊緣檢測 (抓出白色/淺色包裝與白色觸控筆的輪廓邊界)
        edges = cv2.Canny(blurred, 25, 85)

        combined = cv2.bitwise_or(s_thresh, edges)

        # 3. 形態學閉運算連通邊界，並以 RETR_EXTERNAL 填滿內部反光破洞
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel_close, iterations=2)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        filled_canvas = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(filled_canvas, contours, -1, 255, thickness=cv2.FILLED)

        # 4. 距離變換與分水嶺 (使用 5x5 開運算保留觸控筆等細長商品)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        opened = cv2.morphologyEx(filled_canvas, cv2.MORPH_OPEN, kernel_open, iterations=1)

        dist = cv2.distanceTransform(opened, cv2.DIST_L2, 5)
        if dist.max() == 0:
            return [], []
        _, sure_fg = cv2.threshold(dist, self.cfg.dist_threshold * dist.max(), 255, 0)
        sure_fg = np.uint8(sure_fg)

        # 自適應局部種子：若細長商品 (如白色觸控筆) 之局部半徑 (如 5~10px) 遠小於大碗麵 (如 100px)，
        # 其種子會被全域門檻 (0.4 * 100 = 40px) 淹沒。此處為未獲全域種子之連通區塊補上其自身的局部峰值種子。
        num_comp, comp_labels = cv2.connectedComponents(opened)
        for c_id in range(1, num_comp):
            c_mask = (comp_labels == c_id)
            if np.count_nonzero(sure_fg[c_mask]) == 0:
                c_dist_max = dist[c_mask].max()
                if c_dist_max >= 2.0:  # 至少 2px 厚度，排除單點噪聲
                    sure_fg[c_mask & (dist >= 0.50 * c_dist_max)] = 255

        unknown = cv2.subtract(opened, sure_fg)

        _, markers = cv2.connectedComponents(sure_fg)
        markers = markers + 1
        markers[unknown == 255] = 0
        markers = cv2.watershed(cv2.cvtColor(proc_rgb, cv2.COLOR_RGB2BGR), markers)

        # 5. 面積、長寬比與內部包含過濾
        candidates = []
        for marker_id in np.unique(markers):
            if marker_id <= 1:
                continue
            mask = (markers == marker_id)
            area = float(np.sum(mask))

            ys, xs = np.where(mask)
            if len(xs) == 0 or len(ys) == 0:
                continue
            x1, y1, x2, y2 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
            box_w, box_h = (x2 - x1), (y2 - y1)
            aspect = max(box_w, box_h) / (min(box_w, box_h) + 1e-5)

            # 若為細長形狀 (aspect >= 3.0)，啟用細長面積下限 (0.3%)，否則使用一般商品下限 (1.5%)
            is_slender = (aspect >= 3.0)
            req_min_area = self.cfg.min_slender_area_ratio if is_slender else self.cfg.min_area_ratio
            if area < (req_min_area * total_area) or area > (self.cfg.max_area_ratio * total_area):
                continue

            if aspect > self.cfg.max_aspect_ratio:
                continue

            # 若長寬比高達 6 以上且貫穿整張畫面頂底或左右邊緣 (畫面外入鏡的桌邊條)，才過濾
            touches_top_bot = (y1 <= 2 and y2 >= h - 3)
            touches_left_right = (x1 <= 2 and x2 >= w - 3)
            if aspect > 6.0 and (touches_top_bot or touches_left_right):
                continue

            candidates.append((mask, [x1, y1, x2, y2], area))

        candidates.sort(key=lambda x: x[2], reverse=True)
        final_masks, final_boxes = [], []

        for cand_mask, cand_box, cand_area in candidates:
            is_inside = any(
                (np.logical_and(cand_mask, kept_mask).sum() / cand_area) > self.cfg.containment_threshold
                for kept_mask in final_masks
            )
            if not is_inside:
                final_masks.append(cand_mask)
                final_boxes.append(cand_box)

        if needs_scale and scale > 0:
            rescaled_masks = []
            rescaled_boxes = []
            for mask, box in zip(final_masks, final_boxes):
                x1, y1, x2, y2 = box
                rx1 = max(0, min(orig_w, int(round(x1 / scale))))
                ry1 = max(0, min(orig_h, int(round(y1 / scale))))
                rx2 = max(rx1 + 1, min(orig_w, int(round(x2 / scale))))
                ry2 = max(ry1 + 1, min(orig_h, int(round(y2 / scale))))
                rescaled_boxes.append([rx1, ry1, rx2, ry2])

                # 將遮罩映射回全尺寸
                m_full = cv2.resize(
                    mask.astype(np.uint8),
                    (orig_w, orig_h),
                    interpolation=cv2.INTER_NEAREST
                ).astype(bool)
                rescaled_masks.append(m_full)

            return rescaled_masks, rescaled_boxes

        return final_masks, final_boxes
