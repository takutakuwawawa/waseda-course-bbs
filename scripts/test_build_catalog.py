from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_catalog import PUBLIC_FIELDS, build_catalog


def write_course_csv(path: Path, rows: list[dict[str, str]]) -> None:
    fields = sorted(PUBLIC_FIELDS)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def course_row(p_key: str, name: str, faculty: str) -> dict[str, str]:
    return {
        "year": "2026",
        "course_code": "TEST101",
        "name": name,
        "teacher": "担当教員",
        "faculty": faculty,
        "term": "春学期",
        "schedule": "月1時限",
        "p_key": p_key,
        "course_code_full": "TEST101L",
        "credits": "2",
        "method_type": "【対面】",
    }


class CatalogBuildTests(unittest.TestCase):
    def test_same_course_can_appear_in_multiple_faculties(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_course_csv(
                source / "law_spring.csv",
                [course_row("shared-key", "共通科目", "法学")],
            )
            write_course_csv(
                source / "education_spring.csv",
                [course_row("shared-key", "共通科目", "教育")],
            )

            build_catalog([source], output)

            law = json.loads((output / "courses" / "law.json").read_text(encoding="utf-8"))
            education = json.loads((output / "courses" / "education.json").read_text(encoding="utf-8"))
            self.assertEqual(len(law), 1)
            self.assertEqual(len(education), 1)
            self.assertEqual(law[0]["id"], education[0]["id"])
            self.assertEqual(
                law[0]["syllabusUrl"],
                "https://www.wsl.waseda.jp/syllabus/JAA104.php?pKey=shared-key&pLng=jp",
            )

    def test_later_source_overrides_same_csv_filename(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            overlay = root / "overlay"
            output = root / "output"
            source.mkdir()
            overlay.mkdir()
            write_course_csv(
                source / "law_spring.csv",
                [course_row("old-key", "更新前", "法学")],
            )
            write_course_csv(
                overlay / "law_spring.csv",
                [course_row("new-key", "更新後", "法学")],
            )

            build_catalog([source, overlay], output)

            courses = json.loads((output / "courses" / "law.json").read_text(encoding="utf-8"))
            self.assertEqual([course["name"] for course in courses], ["更新後"])


if __name__ == "__main__":
    unittest.main()
