import torch.nn as nn
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0


def build_model(num_classes: int) -> nn.Module:
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model
