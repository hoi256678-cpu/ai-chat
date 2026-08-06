import torch.nn as nn
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

# Shared preprocessing used by both train.py (dataset transform) and serve.py
# (inference transform) — kept in one place so the two can't silently drift
# apart and produce confident, wrong predictions.
EVAL_TRANSFORM = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


def build_model(num_classes: int) -> nn.Module:
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model
