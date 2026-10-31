import numpy as np
from PIL import Image


def crop_mask_and_pad_pil(
    img_rgb: np.ndarray,
    mask: np.ndarray,
    box: list[int],
    target_size: int = 224,
    bg_color: int = 255
) -> Image.Image:
    """將單一商品遮罩外的區域填為純白 (255, 255, 255)，補邊為 1:1 正方形後縮放至 target_size x target_size。"""
    x1, y1, x2, y2 = box
    h_img, w_img = img_rgb.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w_img, x2), min(h_img, y2)

    if x2 <= x1 or y2 <= y1:
        return Image.new("RGB", (target_size, target_size), (bg_color, bg_color, bg_color))

    roi_rgb = img_rgb[y1:y2, x1:x2].copy()
    roi_mask = mask[y1:y2, x1:x2]
    roi_rgb[~roi_mask] = bg_color

    h, w = roi_rgb.shape[:2]
    max_side = max(h, w, 1)
    square_arr = np.full((max_side, max_side, 3), bg_color, dtype=np.uint8)

    y_off = (max_side - h) // 2
    x_off = (max_side - w) // 2
    square_arr[y_off:y_off + h, x_off:x_off + w] = roi_rgb

    return Image.fromarray(square_arr).resize((target_size, target_size), Image.Resampling.LANCZOS)


def preprocess_single_enrollment_image(
    pil_img: Image.Image,
    segmenter,
    target_size: int = 224
) -> Image.Image:
    """供商品建庫照片使用：

    若能分割出主體則自動去背補正方形；若為滿版特寫無法分割，則直接置中補白邊縮放為 1:1 正方形。
    """
    img_rgb = np.asarray(pil_img.convert("RGB"))
    masks, boxes = segmenter.segment(img_rgb)
    if masks:
        # 取面積最大的遮罩去背 (segmenter 已由大到小排序)
        return crop_mask_and_pad_pil(img_rgb, masks[0], boxes[0], target_size=target_size)

    # Fallback: 若照片拍得太近滿版，直接補白邊成正方形
    h, w = img_rgb.shape[:2]
    max_side = max(h, w, 1)
    square_arr = np.full((max_side, max_side, 3), 255, dtype=np.uint8)
    y_off, x_off = (max_side - h) // 2, (max_side - w) // 2
    square_arr[y_off:y_off + h, x_off:x_off + w] = img_rgb
    return Image.fromarray(square_arr).resize((target_size, target_size), Image.Resampling.LANCZOS)
