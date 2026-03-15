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

        probs = torch.softmax(output, dim=1)

        confidence, pred = torch.max(probs, 1)

    label = id_to_label[pred.item()]

    return {
        "class": label,
        "confidence": float(confidence.item())
    }


# =============================
# TEST
# =============================

if __name__ == "__main__":

    test_img = "test.jpg"

    result = predict(test_img)

    print(result)