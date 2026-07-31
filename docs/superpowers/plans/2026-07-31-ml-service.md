# ML 파이프라인 (피부질환 이미지 분류기) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 피부질환 이미지를 넣으면 `{class, confidence}`를 반환하는 로컬 FastAPI 추론 서버(`ml-service/`)를, 직접 학습시킨 CNN 모델로 구축한다.

**Architecture:** ImageNet 사전학습 EfficientNet-B0를 전이학습(fine-tuning)으로 5~10개 피부질환 클래스에 맞게 재학습시키고, 가중치를 로컬 FastAPI 서버가 로드해서 `POST /predict`로 서빙한다. Next.js 앱과는 완전히 분리된 별도 Python 프로세스 — 이번 계획은 이 서비스 하나만 다루고, 웹앱 통합은 별도 계획에서 진행한다.

**Tech Stack:** Python 3.12, PyTorch + torchvision (CUDA), FastAPI + Uvicorn, pytest

**참조 스펙:** `docs/superpowers/specs/2026-07-31-skin-check-design.md`

## Global Constraints

- 데이터셋: AI Hub "피부질환 진단 의료 이미지" (32종, 106,776장) 중 **5~10종 서브셋**만 사용
- 모델: ImageNet 사전학습 CNN(EfficientNet-B0 계열) 전이학습 — 처음부터 학습하지 않음
- 하드웨어: RTX 4070 SUPER, 12GB VRAM (로컬 학습)
- **Python 버전: 3.12 필수.** 이 머신엔 Python 3.14만 설치돼 있는데, PyTorch CUDA 빌드(`download.pytorch.org/whl/cu124`)는 아직 cp313까지만 지원하고 cp314 휠이 없음 — 3.14로 진행하면 CPU 전용으로 깔려서 GPU를 못 씀. `ml-service/` 전용 venv는 반드시 Python 3.12로 생성.
- 서빙 계약: `POST /predict` (multipart, 필드명 `file`) → `{"class": string, "confidence": number}` — 이 계약은 이후 웹앱 통합 계획이 그대로 의존함
- 마감: 1개월 미만 → 라이브 카메라 UI, 시계열 추적, 32종 전체 분류는 스코프 밖 (별도 계획/스펙 참고)
- 레포에 JS 테스트 러너는 없지만, 이 Python 서브시스템은 신규이므로 pytest로 TDD 진행

---

## 파일 구조

- `ml-service/requirements.txt` — 의존성 (신규)
- `ml-service/model.py` — 공유 모델 정의 `build_model()` (신규)
- `ml-service/test_model.py` — model.py 테스트 (신규)
- `ml-service/prepare_data.py` — AI Hub 원본 데이터를 train/val로 정리하는 스크립트 (신규)
- `ml-service/test_prepare_data.py` — prepare_data.py 테스트 (신규)
- `ml-service/train.py` — 학습 스크립트, `skin_model.pth` + `classes.json` 생성 (신규)
- `ml-service/test_train.py` — train.py 테스트 (신규, 합성 데이터로 1 epoch만 실행)
- `ml-service/serve.py` — FastAPI 서버, `POST /predict` (신규)
- `ml-service/test_serve.py` — serve.py 테스트 (신규)
- `.gitignore` — `ml-service/.venv/`, `ml-service/data/`, `ml-service/*.pth`, `ml-service/classes.json`, `ml-service/__pycache__/` 추가 (수정)

---

### Task 1: 프로젝트 스캐폴드 + 공유 모델 모듈

**Files:**
- Create: `ml-service/requirements.txt`
- Create: `ml-service/model.py`
- Test: `ml-service/test_model.py`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `build_model(num_classes: int) -> torch.nn.Module` — Task 3(train.py), Task 4(serve.py)가 그대로 가져다 씀

- [ ] **Step 1: Python 3.12 설치 및 venv 생성**

```bash
winget install --id Python.Python.3.12 -e
```

설치 후 새 셸에서 아래 명령으로 3.12가 잡히는지 확인:

```bash
py -3.12 --version
```

Expected: `Python 3.12.x` 출력

```bash
py -3.12 -m venv ml-service/.venv
```

- [ ] **Step 2: `.gitignore`에 ml-service 관련 항목 추가**

`.gitignore` 끝에 추가:

```
# ml-service (python)
ml-service/.venv/
ml-service/data/
ml-service/*.pth
ml-service/classes.json
ml-service/__pycache__/
ml-service/**/__pycache__/
.pytest_cache/
```

- [ ] **Step 3: `requirements.txt` 작성**

`ml-service/requirements.txt`:

```
torch>=2.2
torchvision>=0.17
fastapi>=0.110
uvicorn[standard]>=0.27
python-multipart>=0.0.9
pillow>=10.0
numpy>=1.26
pytest>=8.0
httpx>=0.27
```

- [ ] **Step 4: venv 활성화 후 CUDA용 PyTorch 설치**

```bash
source ml-service/.venv/Scripts/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install fastapi "uvicorn[standard]" python-multipart pillow numpy pytest httpx
```

- [ ] **Step 5: GPU 인식 확인**

```bash
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

Expected: `True NVIDIA GeForce RTX 4070 SUPER`

- [ ] **Step 6: 실패하는 테스트 작성**

`ml-service/test_model.py`:

```python
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
```

- [ ] **Step 7: 테스트 실행해서 실패 확인**

```bash
cd ml-service && python -m pytest test_model.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'model'`

- [ ] **Step 8: `model.py` 구현**

`ml-service/model.py`:

```python
import torch.nn as nn
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0


def build_model(num_classes: int) -> nn.Module:
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model
```

- [ ] **Step 9: 테스트 실행해서 통과 확인**

```bash
cd ml-service && python -m pytest test_model.py -v
```

Expected: PASS (2 passed) — 첫 실행은 사전학습 가중치를 다운로드하느라 시간이 좀 걸릴 수 있음

- [ ] **Step 10: 커밋**

```bash
git add .gitignore ml-service/requirements.txt ml-service/model.py ml-service/test_model.py
git commit -m "Add ml-service scaffold and shared EfficientNet-B0 model builder"
```

---

### Task 2: 데이터 준비 스크립트

**Files:**
- Create: `ml-service/prepare_data.py`
- Test: `ml-service/test_prepare_data.py`

**Interfaces:**
- Produces: `prepare_data(raw_dir: Path, out_dir: Path, classes: list[str] = TARGET_CLASSES, val_ratio: float = 0.2, seed: int = 42) -> list[str]` — Task 5(실제 학습 실행)가 커맨드라인으로 호출. `TARGET_CLASSES` 상수는 실제 다운로드한 데이터의 폴더명과 맞는지 Task 5에서 반드시 확인/수정.
- 출력 디렉토리 구조 계약: `out_dir/train/<class>/*.jpg`, `out_dir/val/<class>/*.jpg` — Task 3(train.py)이 `torchvision.datasets.ImageFolder`로 그대로 읽음

- [ ] **Step 1: 실패하는 테스트 작성**

`ml-service/test_prepare_data.py`:

```python
from pathlib import Path

from PIL import Image

from prepare_data import prepare_data


def make_raw_dataset(root: Path, classes_and_counts: dict[str, int]):
    for class_name, count in classes_and_counts.items():
        class_dir = root / class_name
        class_dir.mkdir(parents=True, exist_ok=True)
        for i in range(count):
            Image.new("RGB", (32, 32), color=(i % 256, 0, 0)).save(class_dir / f"{i}.jpg")


def test_prepare_data_splits_train_and_val(tmp_path):
    raw_dir = tmp_path / "raw"
    out_dir = tmp_path / "prepared"
    classes = ["아토피피부염", "여드름"]
    make_raw_dataset(raw_dir, {c: 10 for c in classes})

    result = prepare_data(raw_dir, out_dir, classes=classes, val_ratio=0.2)

    assert result == classes
    for class_name in classes:
        train_files = list((out_dir / "train" / class_name).glob("*.jpg"))
        val_files = list((out_dir / "val" / class_name).glob("*.jpg"))
        assert len(train_files) == 8
        assert len(val_files) == 2


def test_prepare_data_is_deterministic_with_same_seed(tmp_path):
    raw_dir = tmp_path / "raw"
    classes = ["아토피피부염"]
    make_raw_dataset(raw_dir, {c: 10 for c in classes})

    out_dir_a = tmp_path / "a"
    out_dir_b = tmp_path / "b"
    prepare_data(raw_dir, out_dir_a, classes=classes, val_ratio=0.2, seed=42)
    prepare_data(raw_dir, out_dir_b, classes=classes, val_ratio=0.2, seed=42)

    names_a = sorted(p.name for p in (out_dir_a / "val" / "아토피피부염").glob("*.jpg"))
    names_b = sorted(p.name for p in (out_dir_b / "val" / "아토피피부염").glob("*.jpg"))
    assert names_a == names_b


def test_prepare_data_raises_for_missing_class_folder(tmp_path):
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    out_dir = tmp_path / "prepared"

    try:
        prepare_data(raw_dir, out_dir, classes=["존재하지않는클래스"])
        assert False, "FileNotFoundError가 발생해야 합니다"
    except FileNotFoundError:
        pass
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
cd ml-service && python -m pytest test_prepare_data.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'prepare_data'`

- [ ] **Step 3: `prepare_data.py` 구현**

`ml-service/prepare_data.py`:

```python
import random
import shutil
import sys
from pathlib import Path

# AI Hub "피부질환 진단 의료 이미지" 다운로드본을 실제로 열어보고, 아래 이름이
# 실제 폴더명과 다르면 여기를 맞춰서 고칠 것 (Task 5에서 확인).
TARGET_CLASSES = [
    "아토피피부염",
    "여드름",
    "두드러기",
    "건선",
    "대상포진",
]

VAL_RATIO = 0.2
IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png")


def prepare_data(
    raw_dir: Path,
    out_dir: Path,
    classes: list[str] = TARGET_CLASSES,
    val_ratio: float = VAL_RATIO,
    seed: int = 42,
) -> list[str]:
    rng = random.Random(seed)

    for split in ("train", "val"):
        (out_dir / split).mkdir(parents=True, exist_ok=True)

    for class_name in classes:
        source_dir = raw_dir / class_name
        if not source_dir.is_dir():
            raise FileNotFoundError(
                f"'{class_name}' 클래스 폴더를 {raw_dir}에서 찾을 수 없습니다. "
                "AI Hub에서 받은 데이터의 실제 폴더 구조를 확인하고 "
                "TARGET_CLASSES를 맞춰주세요."
            )

        images = sorted(
            p for p in source_dir.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES
        )
        rng.shuffle(images)

        val_count = max(1, int(len(images) * val_ratio))
        val_images = images[:val_count]
        train_images = images[val_count:]

        for split, split_images in (("train", train_images), ("val", val_images)):
            dest_dir = out_dir / split / class_name
            dest_dir.mkdir(parents=True, exist_ok=True)
            for image_path in split_images:
                shutil.copy2(image_path, dest_dir / image_path.name)

    return classes


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("사용법: python prepare_data.py <raw_dir> <out_dir>")
        raise SystemExit(1)

    result_classes = prepare_data(Path(sys.argv[1]), Path(sys.argv[2]))
    print(f"준비 완료: {result_classes}")
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

```bash
cd ml-service && python -m pytest test_prepare_data.py -v
```

Expected: PASS (3 passed)

- [ ] **Step 5: 커밋**

```bash
git add ml-service/prepare_data.py ml-service/test_prepare_data.py
git commit -m "Add skin dataset train/val split script"
```

---

### Task 3: 학습 스크립트

**Files:**
- Create: `ml-service/train.py`
- Test: `ml-service/test_train.py`

**Interfaces:**
- Consumes: `build_model(num_classes: int) -> nn.Module` from `model.py` (Task 1); `out_dir/train/<class>/*`, `out_dir/val/<class>/*` structure from `prepare_data.py` (Task 2)
- Produces: `train(data_dir: Path, model_output: Path, classes_output: Path, epochs: int = 10, batch_size: int = 32, device: str | None = None) -> tuple[nn.Module, list[str]]`. 저장 파일: `model_output`에 `state_dict` (`torch.save`), `classes_output`에 클래스명 리스트를 담은 JSON 배열 — Task 4(serve.py)가 이 두 파일 포맷을 그대로 읽음.

- [ ] **Step 1: 실패하는 테스트 작성**

`ml-service/test_train.py`:

```python
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
cd ml-service && python -m pytest test_train.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'train'`

- [ ] **Step 3: `train.py` 구현**

`ml-service/train.py`:

```python
import json
from pathlib import Path

import torch
from torch import nn, optim
from torch.utils.data import DataLoader
from torchvision import transforms
from torchvision.datasets import ImageFolder

from model import build_model

DEFAULT_DATA_DIR = Path(__file__).parent / "data"
DEFAULT_MODEL_OUTPUT = Path(__file__).parent / "skin_model.pth"
DEFAULT_CLASSES_OUTPUT = Path(__file__).parent / "classes.json"

TRANSFORM = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


def train(
    data_dir: Path = DEFAULT_DATA_DIR,
    model_output: Path = DEFAULT_MODEL_OUTPUT,
    classes_output: Path = DEFAULT_CLASSES_OUTPUT,
    epochs: int = 10,
    batch_size: int = 32,
    device: str | None = None,
) -> tuple[nn.Module, list[str]]:
    resolved_device = device or ("cuda" if torch.cuda.is_available() else "cpu")

    train_dataset = ImageFolder(data_dir / "train", transform=TRANSFORM)
    val_dataset = ImageFolder(data_dir / "val", transform=TRANSFORM)

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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

```bash
cd ml-service && python -m pytest test_train.py -v
```

Expected: PASS (1 passed) — CPU로 1 epoch만 돌리므로 느려도 1~2분 내로 끝나야 함

- [ ] **Step 5: 커밋**

```bash
git add ml-service/train.py ml-service/test_train.py
git commit -m "Add transfer-learning training script for skin classifier"
```

---

### Task 4: FastAPI 서빙

**Files:**
- Create: `ml-service/serve.py`
- Test: `ml-service/test_serve.py`

**Interfaces:**
- Consumes: `build_model(num_classes: int) -> nn.Module` from `model.py`; `skin_model.pth`(state_dict) + `classes.json`(JSON string 배열) 포맷 from Task 3
- Produces: 모듈 레벨 `app` (FastAPI 인스턴스). 엔드포인트 계약: `POST /predict`, multipart 필드명 `file` → 응답 `{"class": str, "confidence": float}` (0.0~1.0). 잘못된 이미지 업로드 시 `400`. **이 계약은 웹앱 통합 계획에서 그대로 사용함.**

- [ ] **Step 1: 실패하는 테스트 작성**

`ml-service/test_serve.py`:

```python
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
cd ml-service && python -m pytest test_serve.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'serve'`

- [ ] **Step 3: `serve.py` 구현**

`ml-service/serve.py`:

```python
import io
import json
from pathlib import Path

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from torchvision import transforms

from model import build_model

MODEL_PATH = Path(__file__).parent / "skin_model.pth"
CLASSES_PATH = Path(__file__).parent / "classes.json"

TRANSFORM = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)

app = FastAPI()

_state: dict[str, object] = {"model": None, "classes": None}


@app.on_event("startup")
def load_model() -> None:
    classes = json.loads(CLASSES_PATH.read_text(encoding="utf-8"))
    model = build_model(num_classes=len(classes))
    model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
    model.eval()
    _state["model"] = model
    _state["classes"] = classes


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="이미지 파일을 읽을 수 없습니다.")

    tensor = TRANSFORM(image).unsqueeze(0)
    model = _state["model"]
    classes = _state["classes"]
    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        confidence, predicted_index = torch.max(probabilities, dim=0)

    return {
        "class": classes[predicted_index.item()],
        "confidence": round(confidence.item(), 4),
    }
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

```bash
cd ml-service && python -m pytest test_serve.py -v
```

Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add ml-service/serve.py ml-service/test_serve.py
git commit -m "Add FastAPI /predict endpoint for skin classifier"
```

---

### Task 5: 실제 데이터로 학습 실행 (수동 런북 — 코드 작성 아님)

이 태스크는 AI Hub 로그인/승인이 필요한 데이터 다운로드와 실제 GPU 학습(시간 소요)을 포함하므로, 에이전트가 아니라 **사용자가 직접 실행**하는 태스크임. subagent-driven-development로 이 계획을 실행하더라도 이 태스크는 건너뛰고 사용자에게 넘길 것.

**Files:**
- 없음 (운영 절차만, `ml-service/data/`는 `.gitignore`로 커밋 안 됨)

- [ ] **Step 1: AI Hub에서 "피부질환 진단 의료 이미지" 데이터셋 다운로드/승인 신청**

https://aihub.or.kr 에서 로그인 후 해당 데이터셋 페이지에서 다운로드 승인 신청 → 승인 후 다운로드 및 압축 해제

- [ ] **Step 2: 실제 폴더 구조 확인, 필요시 `prepare_data.py`의 `TARGET_CLASSES` 수정**

압축 해제한 경로를 열어서 클래스별 폴더명이 `prepare_data.py`의 `TARGET_CLASSES`(아토피피부염/여드름/두드러기/건선/대상포진)와 일치하는지 확인. 다르면 실제 폴더명으로 상수를 고치고, 이미지 수가 너무 적은 클래스는 다른 클래스로 교체 (5~10종 범위 유지)

- [ ] **Step 3: train/val 분리 실행**

```bash
cd ml-service && source .venv/Scripts/activate
python prepare_data.py <다운로드받은_원본_경로> data
```

Expected: `data/train/<class>/`, `data/val/<class>/` 폴더에 이미지가 채워짐

- [ ] **Step 4: 실제 학습 실행**

```bash
python train.py
```

`train.py`의 `if __name__ == "__main__": train()` 호출 — GPU가 잡히면 자동으로 `cuda` 사용. 각 epoch마다 검증 정확도가 출력됨. 기본 10 epoch 기준 클래스 5~10개, 데이터 규모에 따라 다르지만 RTX 4070 SUPER에서 수십 분~2시간 내외 예상

- [ ] **Step 5: 결과물 확인**

```bash
ls -la skin_model.pth classes.json
```

Expected: 두 파일 모두 존재. `classes.json` 내용이 실제 학습에 사용한 클래스명과 일치하는지 확인

- [ ] **Step 6: 실제 서버 기동 후 curl 스모크 테스트**

```bash
uvicorn serve:app --port 8000
```

다른 셸에서:

```bash
curl -X POST http://localhost:8000/predict -F "file=@<샘플_이미지_경로>"
```

Expected: `{"class": "...", "confidence": 0.xx}` 형태 JSON — 확신도가 너무 낮거나(예: 1/클래스수에 가까움) 매 요청마다 같은 클래스만 나오면 과적합/데이터 문제이니 `train.py`의 epoch/데이터 규모를 조정

- [ ] **Step 7: 검증 정확도를 스펙/발표자료용으로 기록**

`train.py` 출력의 마지막 epoch 검증 정확도를 어딘가(발표자료, 커밋 메시지 등)에 남겨둘 것 — 졸작 평가 자료로 재사용

---

## 계획 자체 검증 (self-review 결과)

- 스펙의 데이터셋/모델/서빙 계약/에러 처리(낮은 확신도) 요구사항은 Task 1~5로 커버됨. 단, "낮은 확신도일 때 참고 정보로만 활용" 지시문은 **Gemini 프롬프트**에 들어가는 부분이라 이 계획(ML 서비스 자체) 범위가 아니라 웹앱 통합 계획에서 다룸 — confidence 숫자를 그대로 반환하는 것까지가 이 계획의 책임.
- 자리표시자(TBD 등) 없음, 모든 스텝에 실행 가능한 코드/명령 포함.
- 타입/시그니처 일관성: `build_model(num_classes)` → Task 3, 4에서 동일 시그니처로 사용. `train()`의 파라미터명(`data_dir`, `model_output`, `classes_output`)이 Task 3 테스트와 Task 5 런북에서 일치. `serve.py`의 `MODEL_PATH`/`CLASSES_PATH` 모듈 전역 변수명이 테스트의 `monkeypatch.setattr` 대상과 일치.
