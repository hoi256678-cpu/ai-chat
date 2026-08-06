import torch

from model import build_model


def test_build_model_output_shape():
    model = build_model(num_classes=5)
    model.eval()
    dummy_input = torch.randn(2, 3, 224, 224)
    with torch.no_grad():
        output = model(dummy_input)
    assert output.shape == (2, 5)


def test_build_model_different_num_classes():
    model = build_model(num_classes=3)
    model.eval()
    dummy_input = torch.randn(1, 3, 224, 224)
    with torch.no_grad():
        output = model(dummy_input)
    assert output.shape == (1, 3)
