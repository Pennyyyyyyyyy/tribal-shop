import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from app.ai.model import load_model


MODEL_PATH = "app/ai/best_efficientnet_model.pt"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

raw_model = load_model(51, MODEL_PATH, device)

def get_feature_extractor(model):


    model.classifier = nn.Identity() 
    model.eval()
    return model

vector_model = get_feature_extractor(raw_model)

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def get_embedding(image):

    if image.mode != "RGB":
        image = image.convert("RGB")

    input_tensor = transform(image).unsqueeze(0).to(device)
    
    with torch.no_grad():
        embedding = vector_model(input_tensor)
    
    return embedding.cpu().numpy().flatten().tolist()
def get_embeddings(images):
    embeddings = []

    for image in images:
        embedding = get_embedding(image)
        embeddings.append(embedding)

    return embeddings