from PIL import Image
from torchvision import transforms


TARGET_IMAGES = 120


# 與原本 augment_dataset.py 使用完全相同的 augmentation
augment = transforms.Compose([
    transforms.RandomRotation(20),

    transforms.RandomHorizontalFlip(),

    transforms.ColorJitter(
        brightness=0.4,
        contrast=0.4,
        saturation=0.3,
    ),

    transforms.RandomResizedCrop(
        224,
        scale=(0.7, 1.0),
    ),
])


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