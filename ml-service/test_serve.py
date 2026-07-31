import io
import json

import torch
from fastapi.testclient import TestClient
from PIL import Image

import serve
from model import build_model


def _write_dummy_model(tmp_path, classes):
    model = build_model(num_classes=len(classes))
    model_path = tmp_path / "model.pth"
    classes_path = tmp_path / "classes.json"
    torch.save(model.state_dict(), model_path)
    classes_path.write_text(json.dumps(classes, ensure_ascii=False), encoding="utf-8")
    return model_path, classes_path


def _jpeg_bytes(color=(255, 0, 0)):
    image = Image.new("RGB", (64, 64), color=color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer


def _truncated_jpeg_bytes(color=(0, 255, 0)):
    """A file with a valid, recognizable JPEG header but truncated pixel
    data — Image.open() succeeds (it only reads the header), but forcing a
    full decode (e.g. via .convert("RGB")) raises a plain OSError such as
    "image file is truncated", distinct from UnidentifiedImageError."""
    image = Image.new("RGB", (64, 64), color=color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    full_data = buffer.getvalue()
    truncated = full_data[: len(full_data) // 2]
    return io.BytesIO(truncated)


def test_predict_returns_class_and_confidence(tmp_path, monkeypatch):
    classes = ["아토피피부염", "여드름"]
    model_path, classes_path = _write_dummy_model(tmp_path, classes)
    monkeypatch.setattr(serve, "MODEL_PATH", model_path)
    monkeypatch.setattr(serve, "CLASSES_PATH", classes_path)

    with TestClient(serve.app) as client:
        response = client.post(
            "/predict",
            files={"file": ("test.jpg", _jpeg_bytes(), "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["class"] in classes
    assert 0.0 <= data["confidence"] <= 1.0


def test_predict_rejects_non_image_file(tmp_path, monkeypatch):
    classes = ["아토피피부염", "여드름"]
    model_path, classes_path = _write_dummy_model(tmp_path, classes)
    monkeypatch.setattr(serve, "MODEL_PATH", model_path)
    monkeypatch.setattr(serve, "CLASSES_PATH", classes_path)

    with TestClient(serve.app) as client:
        response = client.post(
            "/predict",
            files={"file": ("not_an_image.txt", io.BytesIO(b"hello"), "text/plain")},
        )

    assert response.status_code == 400


def test_predict_rejects_truncated_image(tmp_path, monkeypatch):
    classes = ["아토피피부염", "여드름"]
    model_path, classes_path = _write_dummy_model(tmp_path, classes)
    monkeypatch.setattr(serve, "MODEL_PATH", model_path)
    monkeypatch.setattr(serve, "CLASSES_PATH", classes_path)

    with TestClient(serve.app) as client:
        response = client.post(
            "/predict",
            files={
                "file": (
                    "truncated.jpg",
                    _truncated_jpeg_bytes(),
                    "image/jpeg",
                )
            },
        )

    assert response.status_code == 400
