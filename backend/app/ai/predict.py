import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from app.ai.model import load_model

# =============================
# PATH & CONFIG
# =============================
MODEL_PATH = "app/ai/best_efficientnet_model.pt"
# 向量檢索不再需要 labels.json，因為對應關係改由資料庫管理
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# =============================
# LOAD & CONVERT MODEL (關鍵修改)
# =============================
# 先載入原本的模型 (22類)
raw_model = load_model(22, MODEL_PATH, device)

def get_feature_extractor(model):
    """
    精準移除最後一層。
    注意：EfficientNet 的 classifier 是一個 Sequential，
    裡面包含 Dropout(0) 和 Linear(1280, 22)。
    我們只需要拿掉最後的 Linear。
    """
    # 將最後的分類層替換為 Identity，保留 1280 維度輸出
    model.classifier = nn.Identity() 
    model.eval()
    return model

# 建立特徵提取專用模型
vector_model = get_feature_extractor(raw_model)

# =============================
# IMAGE TRANSFORM (加入 Normalize)
# =============================
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    # 建議加入標準正規化，能讓特徵提取更精準（這是 ImageNet 預訓練模型的標準做法）
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# =============================
# GET EMBEDDING FUNCTION
# =============================
def get_embedding(image):
    """
    接收 PIL Image，回傳 1280 維度的 Python List。
    """
    if image.mode != "RGB":
        image = image.convert("RGB")

    input_tensor = transform(image).unsqueeze(0).to(device)
    
    with torch.no_grad():
        # 得到形狀為 [1, 1280] 的張量
        embedding = vector_model(input_tensor)
    
    # 轉為 1D list 方便 Supabase 的 pgvector 讀取
    return embedding.cpu().numpy().flatten().tolist()