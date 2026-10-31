import cv2
import numpy as np
from dataclasses import dataclass


@dataclass
class SegmentConfig:
    min_area_ratio: float = 0.02        # 最小商品面積佔比 (過濾碎塊)
    max_area_ratio: float = 0.65        # 最大商品面積佔比 (過濾整張白桌面)
    max_aspect_ratio: float = 3.8       # 最大長寬比 (過濾畫面邊緣入鏡的木桌邊條)
    containment_threshold: float = 0.85 # 內部包含重疊門檻 (過濾商品內部的文字/大色塊)


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
        h, w = img_rgb.shape[:2]
        total_area = float(h * w)

        blurred = cv2.bilateralFilter(img_rgb, d=9, sigmaColor=75, sigmaSpace=75)
        hsv = cv2.cvtColor(blurred, cv2.COLOR_RGB2HSV)
        gray = cv2.cvtColor(blurred, cv2.COLOR_RGB2GRAY)

        # 1. 取飽和度 S 通道 (抗桌面灰黑陰影)
        _, s_thresh = cv2.threshold(hsv[:, :, 1], 28, 255, cv2.THRESH_BINARY)

        # 2. 光照差分 + Canny 邊緣 (抓出白色包裝商品與白桌面的立體邊界)
        bg_illum = cv2.GaussianBlur(gray, (0, 0), sigmaX=max(h, w) * 0.05)
        diff = cv2.absdiff(gray, bg_illum)
        _, diff_thresh = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
        edges = cv2.Canny(blurred, 35, 110)

        combined = cv2.bitwise_or(cv2.bitwise_or(s_thresh, diff_thresh), edges)

        # 3. 形態學閉運算連通邊界，並以 RETR_EXTERNAL 填滿內部反光破洞
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel_close, iterations=2)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        filled_canvas = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(filled_canvas, contours, -1, 255, thickness=cv2.FILLED)

        # 4. 距離變換與分水嶺 (分離輕微相連的陰影區塊)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        opened = cv2.morphologyEx(filled_canvas, cv2.MORPH_OPEN, kernel_open, iterations=1)

        dist = cv2.distanceTransform(opened, cv2.DIST_L2, 5)
        if dist.max() == 0:
            return [], []
        _, sure_fg = cv2.threshold(dist, 0.42 * dist.max(), 255, 0)
        sure_fg = np.uint8(sure_fg)
        unknown = cv2.subtract(opened, sure_fg)

        _, markers = cv2.connectedComponents(sure_fg)
        markers = markers + 1
        markers[unknown == 255] = 0
        markers = cv2.watershed(cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR), markers)

        # 5. 面積、長寬比與內部包含過濾
        candidates = []
        for marker_id in np.unique(markers):
            if marker_id <= 1:
                continue
            mask = (markers == marker_id)
            area = float(np.sum(mask))

            if area < (self.cfg.min_area_ratio * total_area) or area > (self.cfg.max_area_ratio * total_area):
                continue

            ys, xs = np.where(mask)
            if len(xs) == 0 or len(ys) == 0:
                continue
            x1, y1, x2, y2 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
            box_w, box_h = (x2 - x1), (y2 - y1)
            if (max(box_w, box_h) / (min(box_w, box_h) + 1e-5)) > self.cfg.max_aspect_ratio:
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

        return final_masks, final_boxes
