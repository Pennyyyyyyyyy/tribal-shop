import cv2
import numpy as np
from dataclasses import dataclass


@dataclass
class SegmentConfig:
    min_area_ratio: float = 0.035       # 最小商品面積佔比 (3.5% 針對外接鏡頭，抗碎角陰影與多餘分割碎片)
    max_area_ratio: float = 0.85        # 最大商品面積佔比 (放寬至 85% 容納外接鏡頭近距大碗麵)
    max_aspect_ratio: float = 4.5       # 最大長寬比 (放寬至 4.5 避免碗麵局部切邊被誤濾)
    containment_threshold: float = 0.85 # 內部包含重疊門檻 (過濾商品內部的文字/大色塊)
    max_process_dim: int = 800          # 分割前處理最大邊長 (等比降採樣大幅加速 CPU 運算)
    s_thresh: int = 52                  # HSV S 通道飽和度門檻 (52，外接鏡頭桌面 S~35-46，調至 52 徹底抗反光灰桌面與暗角)
    dist_threshold: float = 0.45        # 分水嶺前置距離變換種子閥值 (0.45 穩健分離相鄰多件商品)


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

        # 2. Canny 邊緣檢測 (抓出白色/淺色包裝商品與白桌面的立體邊界)
        edges = cv2.Canny(blurred, 35, 110)

        combined = cv2.bitwise_or(s_thresh, edges)

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
        _, sure_fg = cv2.threshold(dist, self.cfg.dist_threshold * dist.max(), 255, 0)
        sure_fg = np.uint8(sure_fg)
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

            if area < (self.cfg.min_area_ratio * total_area) or area > (self.cfg.max_area_ratio * total_area):
                continue

            ys, xs = np.where(mask)
            if len(xs) == 0 or len(ys) == 0:
                continue
            x1, y1, x2, y2 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
            box_w, box_h = (x2 - x1), (y2 - y1)
            aspect = max(box_w, box_h) / (min(box_w, box_h) + 1e-5)
            if aspect > self.cfg.max_aspect_ratio:
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
