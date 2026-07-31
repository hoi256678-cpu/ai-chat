import json
from pathlib import Path

import torch
from torch import nn, optim
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder

from model import EVAL_TRANSFORM, build_model

DEFAULT_DATA_DIR = Path(__file__).parent / "data"
DEFAULT_MODEL_OUTPUT = Path(__file__).parent / "skin_model.pth"
DEFAULT_CLASSES_OUTPUT = Path(__file__).parent / "classes.json"


def train(
    data_dir: Path = DEFAULT_DATA_DIR,
    model_output: Path = DEFAULT_MODEL_OUTPUT,
    classes_output: Path = DEFAULT_CLASSES_OUTPUT,
    epochs: int = 10,
    batch_size: int = 32,
    device: str | None = None,
) -> tuple[nn.Module, list[str]]:
    resolved_device = device or ("cuda" if torch.cuda.is_available() else "cpu")

    train_dataset = ImageFolder(data_dir / "train", transform=EVAL_TRANSFORM)
    val_dataset = ImageFolder(data_dir / "val", transform=EVAL_TRANSFORM)

    if train_dataset.classes != val_dataset.classes:
        raise ValueError(
            f"train/val class mismatch: {train_dataset.classes} vs {val_dataset.classes}"
        )

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    class_names = train_dataset.classes
    model = build_model(num_classes=len(class_names)).to(resolved_device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-4)

    for epoch in range(epochs):
        model.train()
        for images, labels in train_loader:
            images, labels = images.to(resolved_device), labels.to(resolved_device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(resolved_device), labels.to(resolved_device)
                outputs = model(images)
                _, predicted = torch.max(outputs, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        accuracy = correct / total if total else 0.0
        print(f"Epoch {epoch + 1}/{epochs} — val accuracy: {accuracy:.3f}")

    model_output.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), model_output)
    classes_output.write_text(
        json.dumps(class_names, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return model, class_names


if __name__ == "__main__":
    train()
