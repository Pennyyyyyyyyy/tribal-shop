import torch
import torch.nn as nn
from torchvision import models


def load_model(num_classes, model_path, device):

    # 建立 EfficientNet
    model = models.efficientnet_b0(weights=None)

    # 修改最後分類層
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)

    # 讀取模型
    checkpoint = torch.load(model_path, map_location=device)

    if "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()

    return model