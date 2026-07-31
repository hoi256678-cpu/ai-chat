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
