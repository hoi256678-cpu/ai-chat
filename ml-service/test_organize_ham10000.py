import csv
from pathlib import Path

from PIL import Image

from organize_ham10000 import organize_ham10000


def make_fixture(root: Path):
    image_dir = root / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    rows = [
        {"lesion_id": "l1", "image_id": "img1", "dx": "vasc"},
        {"lesion_id": "l2", "image_id": "img2", "dx": "df"},
        {"lesion_id": "l3", "image_id": "img3", "dx": "nv"},  # not a target class
        {"lesion_id": "l4", "image_id": "img4", "dx": "vasc"},
    ]
    for row in rows:
        Image.new("RGB", (16, 16)).save(image_dir / f"{row['image_id']}.jpg")

    metadata_csv = root / "HAM10000_metadata.csv"
    with metadata_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["lesion_id", "image_id", "dx"])
        writer.writeheader()
        writer.writerows(rows)

    return metadata_csv, image_dir


def test_organize_ham10000_sorts_into_class_folders(tmp_path):
    metadata_csv, image_dir = make_fixture(tmp_path)
    out_dir = tmp_path / "organized"

    counts = organize_ham10000(
        metadata_csv, [image_dir], out_dir, classes=["vasc", "df"]
    )

    assert counts == {"vasc": 2, "df": 1}
    assert (out_dir / "vasc" / "img1.jpg").exists()
    assert (out_dir / "vasc" / "img4.jpg").exists()
    assert (out_dir / "df" / "img2.jpg").exists()
    assert not (out_dir / "nv").exists()


def test_organize_ham10000_searches_multiple_image_dirs(tmp_path):
    part1 = tmp_path / "part1"
    part2 = tmp_path / "part2"
    part1.mkdir()
    part2.mkdir()
    Image.new("RGB", (16, 16)).save(part1 / "imgA.jpg")
    Image.new("RGB", (16, 16)).save(part2 / "imgB.jpg")

    metadata_csv = tmp_path / "HAM10000_metadata.csv"
    with metadata_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["lesion_id", "image_id", "dx"])
        writer.writeheader()
        writer.writerow({"lesion_id": "l1", "image_id": "imgA", "dx": "bcc"})
        writer.writerow({"lesion_id": "l2", "image_id": "imgB", "dx": "bcc"})

    out_dir = tmp_path / "organized"
    counts = organize_ham10000(metadata_csv, [part1, part2], out_dir, classes=["bcc"])

    assert counts == {"bcc": 2}
    assert (out_dir / "bcc" / "imgA.jpg").exists()
    assert (out_dir / "bcc" / "imgB.jpg").exists()
