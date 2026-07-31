import json
from pathlib import Path

import numpy as np
from PIL import Image

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
