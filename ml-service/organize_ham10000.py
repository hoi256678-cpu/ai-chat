import csv
import shutil
import sys
from pathlib import Path

TARGET_CLASSES = ["vasc", "df", "bcc", "akiec"]
IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png")


def _find_image(image_id: str, image_dirs: list[Path]) -> Path | None:
    for image_dir in image_dirs:
        for suffix in IMAGE_SUFFIXES:
            candidate = image_dir / f"{image_id}{suffix}"
            if candidate.exists():
                return candidate
    return None


def organize_ham10000(
    metadata_csv: Path,
    image_dirs: list[Path],
    out_dir: Path,
    classes: list[str] = TARGET_CLASSES,
) -> dict[str, int]:
    counts = {class_name: 0 for class_name in classes}

    with metadata_csv.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            dx = row["dx"]
            if dx not in classes:
                continue

            image_path = _find_image(row["image_id"], image_dirs)
            if image_path is None:
                raise FileNotFoundError(
                    f"이미지 '{row['image_id']}'를 {image_dirs}에서 찾을 수 없습니다."
                )

            dest_dir = out_dir / dx
            dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(image_path, dest_dir / image_path.name)
            counts[dx] += 1

    return counts


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("사용법: python organize_ham10000.py <metadata_csv> <out_dir> <image_dir> [image_dir2 ...]")
        raise SystemExit(1)

    result_counts = organize_ham10000(
        Path(sys.argv[1]), [Path(p) for p in sys.argv[3:]], Path(sys.argv[2])
    )
    print(f"정리 완료: {result_counts}")
