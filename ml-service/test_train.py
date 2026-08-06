import copy
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

import train as train_module
from model import build_model
from train import train


def make_fixture_dataset(root: Path, classes: list[str], images_per_class: int = 4):
    for split in ("train", "val"):
        for class_name in classes:
            class_dir = root / split / class_name
            class_dir.mkdir(parents=True, exist_ok=True)
            for i in range(images_per_class):
                array = (np.random.rand(64, 64, 3) * 255).astype("uint8")
                Image.fromarray(array).save(class_dir / f"{i}.jpg")


def test_train_produces_model_and_classes_file(tmp_path):
    classes = ["아토피피부염", "여드름"]
    make_fixture_dataset(tmp_path, classes)

    model_output = tmp_path / "model.pth"
    classes_output = tmp_path / "classes.json"

    train(
        data_dir=tmp_path,
        model_output=model_output,
        classes_output=classes_output,
        epochs=1,
        batch_size=2,
        device="cpu",
    )

    assert model_output.exists()
    saved_classes = json.loads(classes_output.read_text(encoding="utf-8"))
    assert sorted(saved_classes) == sorted(classes)

    # Verify the saved artifact is actually a valid, matching state_dict —
    # not just that some file happens to exist at model_output. Task 4
    # (serve.py) will load this exact file at runtime via build_model(...)
    # .load_state_dict(...), so reconstruct that exact path here.
    loaded_model = build_model(num_classes=len(saved_classes))
    state_dict = torch.load(model_output, map_location="cpu")
    loaded_model.load_state_dict(state_dict)  # raises RuntimeError on mismatch

    loaded_model.eval()
    with torch.no_grad():
        dummy_input = torch.randn(1, 3, 224, 224)
        output = loaded_model(dummy_input)
    assert output.shape == (1, len(saved_classes))


def test_train_saves_best_epoch_checkpoint_not_last(tmp_path, monkeypatch):
    classes = ["아토피피부염", "여드름"]
    make_fixture_dataset(tmp_path, classes)

    model_output = tmp_path / "model.pth"
    classes_output = tmp_path / "classes.json"

    # Epoch 1 scores highest; epochs 2-3 score lower — a model that saves
    # the last epoch instead of the best would save epoch 3's (worse) weights.
    scripted_accuracies = iter([0.9, 0.5, 0.6])
    captured_states = []

    def fake_evaluate(model, loader, device):
        captured_states.append(copy.deepcopy(model.state_dict()))
        return next(scripted_accuracies)

    monkeypatch.setattr(train_module, "_evaluate", fake_evaluate)

    train(
        data_dir=tmp_path,
        model_output=model_output,
        classes_output=classes_output,
        epochs=3,
        batch_size=2,
        device="cpu",
    )

    saved_state = torch.load(model_output, map_location="cpu")
    best_state = captured_states[0]
    for key in best_state:
        assert torch.equal(saved_state[key], best_state[key])
