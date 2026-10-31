import unittest
import re
from pathlib import Path

class TestDependencies(unittest.TestCase):
    def test_requirements_contains_opencv_headless(self):
        req_file = Path("backend/requirements.txt")
        self.assertTrue(req_file.exists())
        content = req_file.read_text(encoding="utf-8")
        self.assertTrue(
            bool(re.search(r"opencv-python-headless\s*>=\s*4\.8\.0", content)),
            "requirements.txt 應包含 opencv-python-headless>=4.8.0"
        )
        # 檢查實際相依套件行未包含 torch / torchvision
        package_lines = [
            line.strip().lower()
            for line in content.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
        for line in package_lines:
            self.assertFalse("torch" in line, f"package line contains torch: {line}")

if __name__ == "__main__":
    unittest.main()
