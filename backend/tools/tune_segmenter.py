#!/usr/bin/env python3
"""
白底商品分割器 (WhiteBgSegmenter) 參數微調與視覺化評測工具

用法範例:
  1. 測試單張照片並輸出不同參數的畫框結果:
     python3 backend/tools/tune_segmenter.py --image my_test.jpg

  2. 測試自訂特定參數:
     python3 backend/tools/tune_segmenter.py --image my_test.jpg --min-area 0.015 --s-thresh 25

  3. 批次測試一個資料夾內的所有現場照片:
     python3 backend/tools/tune_segmenter.py --dir backend/test_samples/
"""

import os
import sys
import argparse
import time
from pathlib import Path

# 將 backend 加入模組搜尋路徑
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import cv2
import numpy as np
from app.ai.segmenter import WhiteBgSegmenter, SegmentConfig


def draw_detection_boxes(img_bgr: np.ndarray, boxes: list[list[int]], masks: list[np.ndarray] = None) -> np.ndarray:
    """在圖片上繪製半透明遮罩與醒目的邊界框與標籤"""
    canvas = img_bgr.copy()
    h, w = canvas.shape[:2]
    total_area = float(h * w)

    colors = [
        (0, 255, 0),    # 綠
        (255, 128, 0),  # 藍青
        (0, 165, 255),  # 橘
        (255, 0, 255),  # 粉紫
        (0, 255, 255),  # 黃
    ]

    for idx, box in enumerate(boxes):
        x1, y1, x2, y2 = box
        bw, bh = x2 - x1, y2 - y1
        area_pct = ((bw * bh) / total_area) * 100.0
        color = colors[idx % len(colors)]

        # 畫外框
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 3)

        # 畫標籤背景
        label = f"#{idx+1}: {bw}x{bh} ({area_pct:.1f}%)"
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(canvas, (x1, max(0, y1 - lh - 8)), (x1 + lw + 8, y1), color, -1)
        cv2.putText(
            canvas, label, (x1 + 4, max(lh + 2, y1 - 4)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2, cv2.LINE_AA
        )

    return canvas


def run_single_test(
    img_rgb: np.ndarray,
    min_area_ratio: float = 0.015,
    max_area_ratio: float = 0.70,
    max_aspect_ratio: float = 3.8,
    containment_threshold: float = 0.85,
    s_thresh_val: int = 24,
    dist_thresh_val: float = 0.40
) -> tuple[list[list[int]], list[np.ndarray], float]:
    """執行單次分割測試並記錄耗時"""
    cfg = SegmentConfig(
        min_area_ratio=min_area_ratio,
        max_area_ratio=max_area_ratio,
        max_aspect_ratio=max_aspect_ratio,
        containment_threshold=containment_threshold,
        max_process_dim=800,
        s_thresh=s_thresh_val,
        dist_threshold=dist_thresh_val
    )
    segmenter = WhiteBgSegmenter(cfg)
    t0 = time.time()
    masks, boxes = segmenter.segment(img_rgb)
    elapsed = time.time() - t0
    return boxes, masks, elapsed


def evaluate_image(img_path: Path, output_dir: Path):
    """對單張圖片進行常用參數網格測試，並輸出對比圖"""
    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        print(f"❌ 無法讀取圖片: {img_path}")
        return

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_rgb.shape[:2]
    print(f"\n=======================================================")
    print(f"📷 正在測試照片: {img_path.name} ({w} x {h})")
    print(f"=======================================================")

    # 常用參數對比組合
    test_cases = [
        # (說明, min_area, s_thresh, dist_thresh)
        ("A. 推薦最佳參數 (S=24, min=1.5%)", 0.015, 24, 0.40),
        ("B. 舊版標準 (S=28, min=2.0%)", 0.020, 28, 0.42),
        ("C. 靈敏模式 (S=20, min=1.0%)", 0.010, 20, 0.38),
        ("D. 抗雜物模式 (S=30, min=2.5%)", 0.025, 30, 0.45),
    ]

    print(f"{'配置名稱':<30} | {'最小面積門檻':<12} | {'飽和度門檻':<10} | {'匡出件數':<8} | {'耗時':<8}")
    print("-" * 80)

    output_dir.mkdir(parents=True, exist_ok=True)

    for name, min_area, s_thresh, dist_thresh in test_cases:
        boxes, _, elapsed = run_single_test(
            img_rgb,
            min_area_ratio=min_area,
            max_area_ratio=0.70,
            max_aspect_ratio=3.8,
            containment_threshold=0.85,
            s_thresh_val=s_thresh,
            dist_thresh_val=dist_thresh
        )

        annotated = draw_detection_boxes(img_bgr, boxes)
        out_name = f"{img_path.stem}_{name[:1]}_area{min_area}_s{s_thresh}.jpg"
        out_path = output_dir / out_name
        cv2.imwrite(str(out_path), annotated)

        print(f"{name:<30} | {min_area*100:>5.1f}%       | {s_thresh:>6}     | {len(boxes):>4} 件   | {elapsed*1000:>5.1f}ms")

    print(f"\n📁 標註畫框結果圖已儲存至: {output_dir}/")
    print(f"👉 打開資料夾即可一眼看出哪一個參數切出的框最乾淨！")


def main():
    parser = argparse.ArgumentParser(description="WhiteBgSegmenter 參數微調與評測工具")
    parser.add_argument("--image", type=str, help="要測試的單張測試照片路徑")
    parser.add_argument("--dir", type=str, help="要批次測試的照片資料夾路徑")
    parser.add_argument("--output", type=str, default="backend/tools/output", help="對比輸出目錄")
    parser.add_argument("--min-area", type=float, help="指定自訂最小面積比率 (例如 0.015)")
    parser.add_argument("--s-thresh", type=int, help="指定自訂飽和度門檻 (例如 25)")
    args = parser.parse_args()

    out_dir = Path(args.output)

    if args.image:
        evaluate_image(Path(args.image), out_dir)
    elif args.dir:
        dir_path = Path(args.dir)
        images = list(dir_path.glob("*.jpg")) + list(dir_path.glob("*.jpeg")) + list(dir_path.glob("*.png"))
        if not images:
            print(f"⚠️ 在 {dir_path} 找不到任何 jpg/png 圖片")
            return
        for img_p in images:
            evaluate_image(img_p, out_dir)
    else:
        print("💡 請提供 --image <圖片路徑> 或 --dir <資料夾路徑>")
        print("範例: python3 backend/tools/tune_segmenter.py --image backend/app/ai/test.jpg")


if __name__ == "__main__":
    main()
