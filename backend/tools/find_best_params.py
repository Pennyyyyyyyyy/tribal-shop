#!/usr/bin/env python3
import cv2
import glob
import time
import numpy as np
from pathlib import Path

def main():
    photos = sorted(glob.glob('backend/tools/testphoto/*.jpg'))
    if not photos:
        print("No photos found in backend/tools/testphoto/")
        return

    print(f"Loading {len(photos)} test photos...")
    images_data = []
    
    canny_pairs = [(25, 75), (30, 90), (35, 105)]
    
    for p in photos:
        raw_bgr = cv2.imread(p)
        orig_h, orig_w = raw_bgr.shape[:2]
        scale = 800.0 / max(orig_h, orig_w)
        pw, ph = int(round(orig_w * scale)), int(round(orig_h * scale))
        
        resized_bgr = cv2.resize(raw_bgr, (pw, ph), interpolation=cv2.INTER_AREA)
        blurred_bgr = cv2.bilateralFilter(resized_bgr, d=9, sigmaColor=75, sigmaSpace=75)
        hsv = cv2.cvtColor(blurred_bgr, cv2.COLOR_BGR2HSV)
        
        canny_cache = {}
        for (cl, ch) in canny_pairs:
            canny_cache[(cl, ch)] = cv2.Canny(blurred_bgr, cl, ch)
            
        images_data.append({
            'path': Path(p).name,
            'orig_w': orig_w,
            'orig_h': orig_h,
            'scale': scale,
            'pw': pw,
            'ph': ph,
            'area': pw * ph,
            'bgr': resized_bgr,
            'raw_bgr': raw_bgr,
            'hsv': hsv,
            'canny': canny_cache
        })

    expected = [2, 2, 2, 2, 2, 2, 3, 3, 3, 3]
    print(f"Ground truth expected counts: {expected} (Total: {sum(expected)})")

    def run_detection(img_data, s_thresh_val, c_pair, k_close, dist_thresh_val, min_a):
        h, w, total_area = img_data['ph'], img_data['pw'], img_data['area']
        
        _, s_thresh = cv2.threshold(img_data['hsv'][:, :, 1], s_thresh_val, 255, cv2.THRESH_BINARY)
        edges = img_data['canny'][c_pair]
        combined = cv2.bitwise_or(s_thresh, edges)
        
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_close, k_close))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel_close, iterations=2)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        filled_canvas = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(filled_canvas, contours, -1, 255, thickness=cv2.FILLED)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        opened = cv2.morphologyEx(filled_canvas, cv2.MORPH_OPEN, kernel_open, iterations=1)
        
        # 0-pad borders to prevent border distance inflation
        opened[0, :] = 0; opened[-1, :] = 0; opened[:, 0] = 0; opened[:, -1] = 0
        dist = cv2.distanceTransform(opened, cv2.DIST_L2, 5)
        if dist.max() == 0:
            return []
            
        _, sure_fg = cv2.threshold(dist, dist_thresh_val * dist.max(), 255, 0)
        sure_fg = np.uint8(sure_fg)
        unknown = cv2.subtract(opened, sure_fg)
        
        _, markers = cv2.connectedComponents(sure_fg)
        markers = markers + 1
        markers[unknown == 255] = 0
        markers = cv2.watershed(img_data['bgr'], markers)
        
        boxes = []
        scale = img_data['scale']
        for marker_id in np.unique(markers):
            if marker_id <= 1:
                continue
            mask = (markers == marker_id)
            area = float(np.sum(mask))
            if area < (min_a * total_area) or area > (0.85 * total_area):
                continue
            ys, xs = np.where(mask)
            if len(xs) == 0 or len(ys) == 0:
                continue
            bw = xs.max() - xs.min()
            bh = ys.max() - ys.min()
            aspect = max(bw, bh) / (min(bw, bh) + 1e-5)
            if aspect > 4.5:
                continue
                
            rx1 = max(0, min(img_data['orig_w'], int(round(xs.min() / scale))))
            ry1 = max(0, min(img_data['orig_h'], int(round(ys.min() / scale))))
            rx2 = max(rx1 + 1, min(img_data['orig_w'], int(round(xs.max() / scale))))
            ry2 = max(ry1 + 1, min(img_data['orig_h'], int(round(ys.max() / scale))))
            boxes.append([rx1, ry1, rx2, ry2])
            
        return boxes

    # Grid search
    print("Starting grid search...")
    t0 = time.time()
    results = []
    
    s_vals = [48, 50, 52, 55, 58, 60]
    k_vals = [15, 17, 19, 21]
    d_vals = [0.36, 0.38, 0.40, 0.42, 0.44]
    min_a_vals = [0.025, 0.035, 0.045]
    
    count_tested = 0
    for s in s_vals:
        for k in k_vals:
            for d in d_vals:
                for c_pair in canny_pairs:
                    for min_a in min_a_vals:
                        count_tested += 1
                        photo_counts = []
                        for img_data in images_data:
                            boxes = run_detection(img_data, s, c_pair, k, d, min_a)
                            photo_counts.append(len(boxes))
                        score = sum(1 for a, b in zip(photo_counts, expected) if a == b)
                        diff = abs(sum(photo_counts) - sum(expected))
                        results.append({
                            'score': score,
                            'diff': diff,
                            's_thresh': s,
                            'k_close': k,
                            'dist_thresh': d,
                            'canny': c_pair,
                            'min_a': min_a,
                            'counts': photo_counts
                        })

    elapsed = time.time() - t0
    print(f"Tested {count_tested} parameter sets in {elapsed:.1f}s")
    
    results.sort(key=lambda x: (x['score'], -x['diff']), reverse=True)
    
    print("\n" + "="*80)
    print(f"{'Rank':<5} | {'Score':<7} | {'S-Thresh':<9} | {'KernelClose':<11} | {'DistThresh':<10} | {'Canny':<10} | {'MinArea':<8} | Counts")
    print("="*80)
    for idx, r in enumerate(results[:15]):
        print(f"#{idx+1:<4} | {r['score']}/10   | {r['s_thresh']:<9} | {r['k_close']:<11} | {r['dist_thresh']:<10} | {str(r['canny']):<10} | {r['min_a']:<8} | {r['counts']}")
    print("="*80)

    # Save visualization for rank 1
    best_cfg = results[0]
    out_dir = Path('backend/tools/output/best_params')
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"\nSaving visualizations for #1 best config to {out_dir}...")
    
    colors = [(0, 255, 0), (255, 128, 0), (0, 165, 255), (255, 0, 255)]
    for img_data in images_data:
        boxes = run_detection(
            img_data,
            best_cfg['s_thresh'],
            best_cfg['canny'],
            best_cfg['k_close'],
            best_cfg['dist_thresh'],
            best_cfg['min_a']
        )
        canvas = img_data['raw_bgr'].copy()
        for b_idx, box in enumerate(boxes):
            x1, y1, x2, y2 = box
            color = colors[b_idx % len(colors)]
            cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 3)
            label = f"#{b_idx+1}: {x2-x1}x{y2-y1}"
            cv2.putText(canvas, label, (x1+5, y1+25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
        out_path = out_dir / f"{img_data['path']}_best.jpg"
        cv2.imwrite(str(out_path), canvas)
        print(f"  {img_data['path']}: {len(boxes)} boxes saved")

if __name__ == '__main__':
    main()
