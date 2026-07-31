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
