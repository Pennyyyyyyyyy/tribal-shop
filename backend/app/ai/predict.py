import torch
import json
from PIL import Image
from torchvision import transforms

from app.ai.model import load_model


# =============================
# PATH
# =============================

MODEL_PATH = "app/ai/best_efficientnet_model.pt"
LABELS_JSON = "app/ai/labels.json"


# =============================
# DEVICE
# =============================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# =============================
# LOAD LABELS
# =============================

with open(LABELS_JSON, "r", encoding="utf-8") as f:
    labels = json.load(f)

id_to_label = {i: label for i, label in enumerate(labels)}

num_classes = len(labels)

print("Loaded classes:", num_classes)


# =============================
# LOAD MODEL
# =============================

model = load_model(num_classes, MODEL_PATH, device)


# =============================
# IMAGE TRANSFORM
# =============================

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])


# =============================
# PREDICT FUNCTION
# =============================

def predict(image):
    image = image.convert("RGB")
    image = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(image)
        # 取得機率值
        probs = torch.softmax(output, dim=1)

        # 取得前三個最高機率的值與索引
        # k=3 代表取前三名
        top_probs, top_indices = torch.topk(probs, k=3, dim=1)

    # 整理成 list 格式回傳
    results = []
    for i in range(3):
        confidence = top_probs[0][i].item()
        label_idx = top_indices[0][i].item()
        label = id_to_label[label_idx]
        
        results.append({
            "class": label,
            "confidence": float(confidence)
        })

    return results


# =============================
# TEST
# =============================

if __name__ == "__main__":

    test_img = "test.jpg"

    result = predict(test_img)

    print(result)