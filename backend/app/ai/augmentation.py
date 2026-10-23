import random
from PIL import Image, ImageEnhance


TARGET_IMAGES = 120


def augment(img: Image.Image) -> Image.Image:
    """
    純 Pillow 影像增強（等價於 torchvision.transforms.Compose）：
    - RandomRotation(20)
    - RandomHorizontalFlip()
    - ColorJitter(brightness=0.4, contrast=0.4, saturation=0.3)
    - RandomResizedCrop(224, scale=(0.7, 1.0))
    完全免除 torchvision 與 PyTorch 依賴，節省樹莓派資源。
    """
    # 1. 隨機旋轉 (-20 ~ +20 度)
    angle = random.uniform(-20, 20)
    img = img.rotate(angle, resample=Image.BILINEAR)

    # 2. 隨機水平翻轉 (50% 機率)
    if random.random() < 0.5:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)

    # 3. 顏色隨機擾動 (亮度、對比度、飽和度)
    b_factor = random.uniform(0.6, 1.4)
    img = ImageEnhance.Brightness(img).enhance(b_factor)

    c_factor = random.uniform(0.6, 1.4)
    img = ImageEnhance.Contrast(img).enhance(c_factor)

    s_factor = random.uniform(0.7, 1.3)
    img = ImageEnhance.Color(img).enhance(s_factor)

    # 4. 隨機裁切並縮放至 224x224
    w, h = img.size
    area = w * h
    target_area = random.uniform(0.7, 1.0) * area
    aspect_ratio = random.uniform(3.0 / 4.0, 4.0 / 3.0)
    crop_w = int(round((target_area * aspect_ratio) ** 0.5))
    crop_h = int(round((target_area / aspect_ratio) ** 0.5))
    if crop_w <= w and crop_h <= h:
        left = random.randint(0, w - crop_w)
        top = random.randint(0, h - crop_h)
        img = img.crop((left, top, left + crop_w, top + crop_h))
    return img.resize((224, 224), Image.BILINEAR)


def augment_to_target(
    original_images: list[Image.Image],
    target: int = TARGET_IMAGES,
) -> list[Image.Image]:
    """
    將多張商品原圖平均 augmentation 到指定數量。

    6 張原圖 + 114 張 augmentation
    = 120 張圖片。

    不寫入硬碟，全部在記憶體中處理。
    """

    if not original_images:
        return []

    # 統一 RGB
    originals = [
        image.convert("RGB")
        for image in original_images
    ]

    # 保留所有原圖
    result = list(originals)

    if len(result) >= target:
        return result[:target]

    # 輪流從各張原圖產生 augmentation，
    # 確保不同拍攝角度的資料量盡量平均。
    index = 0

    while len(result) < target:
        source_image = originals[index % len(originals)]

        augmented_image = augment(source_image)

        result.append(augmented_image)

        index += 1

    return result
