import io
import json
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from model import EVAL_TRANSFORM, build_model

MODEL_PATH = Path(__file__).parent / "skin_model.pth"
CLASSES_PATH = Path(__file__).parent / "classes.json"

_state: dict[str, object] = {"model": None, "classes": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    classes = json.loads(CLASSES_PATH.read_text(encoding="utf-8"))
    model = build_model(num_classes=len(classes))
    model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
    model.eval()
    _state["model"] = model
    _state["classes"] = classes
    yield
    _state["model"] = None
    _state["classes"] = None


app = FastAPI(lifespan=lifespan)


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="이미지 파일을 읽을 수 없습니다.")

    tensor = EVAL_TRANSFORM(image).unsqueeze(0)
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
