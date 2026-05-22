"""Extract images from docx and map to library models."""
import json
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
PROTOTYPE = Path(__file__).resolve().parent.parent
OUT_DIR = PROTOTYPE / "public" / "images"
LIBRARY_JSON = PROTOTYPE / "src" / "data" / "selectionLibrary.json"

DOCX_FILES = {
    "1": ROOT / "Level 1 Selections .docx",
    "2": ROOT / "Level 2 Selections.docx",
    "3": ROOT / "Level 3 Selections.docx",
}


def load_relationships(archive: zipfile.ZipFile) -> dict[str, str]:
    rels_xml = archive.read("word/_rels/document.xml.rels")
    root = ET.fromstring(rels_xml)
    mapping: dict[str, str] = {}
    for rel in root:
        relationship_id = rel.get("Id") or rel.get(
            "{http://schemas.openxmlformats.org/package/2006/relationships}Id"
        )
        target = rel.get("Target", "")
        if "media/" in target:
            mapping[relationship_id] = Path(target).name
    return mapping


def extract_images_in_order(archive: zipfile.ZipFile) -> list[str]:
    relationships = load_relationships(archive)
    document_xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
    image_files: list[str] = []
    for relationship_id in re.findall(r'r:embed="([^"]+)"', document_xml):
        filename = relationships.get(relationship_id)
        if filename and filename not in image_files:
            image_files.append(filename)
    return image_files


def normalize_model(text: str) -> str | None:
    patterns = [
        r"\b(GEP?\s+[A-Z0-9]{6,}[A-Z0-9-]*)\b",
        r"\b(GEM\s+Z[A-Z0-9]+)\b",
        r"\b(Model:\s*([A-Z0-9-]+))",
        r"\b(K-\d{4,5}-\d[A-Z0-9]*)\b",
        r"\b([A-Z]{2,}\s+[A-Z0-9]{4,}[A-Z0-9/-]*)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return re.sub(r"\s+", " ", match.group(1) if match.lastindex else match.group(0)).strip().upper()
    return None


def parse_table_models(archive: zipfile.ZipFile) -> list[str]:
    word_namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    document = ET.fromstring(archive.read("word/document.xml"))
    models: list[str] = []
    for row in document.iter(f"{word_namespace}tr"):
        row_text_parts: list[str] = []
        for cell in row.iter(f"{word_namespace}tc"):
            for text_node in cell.iter(f"{word_namespace}t"):
                if text_node.text:
                    row_text_parts.append(text_node.text)
        row_text = " ".join(row_text_parts)
        if "Category" in row_text and "Manufacturer" in row_text:
            continue
        if "DONS APPLIANCES" in row_text:
            continue
        model = normalize_model(row_text)
        if model:
            models.append(model.replace("GEP ", "GEP ").replace("GEM ", ""))
    return models


def simplify_model_key(model: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", model.upper())


def main() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)

    library = json.loads(LIBRARY_JSON.read_text(encoding="utf-8"))
    image_map: dict[str, str] = {}

    for level, docx_path in DOCX_FILES.items():
        if not docx_path.exists():
            continue
        with zipfile.ZipFile(docx_path) as archive:
            images_in_order = extract_images_in_order(archive)
            table_models = parse_table_models(archive)

            for image_filename in images_in_order:
                source = f"word/media/{image_filename}"
                level_prefix = f"level{level}"
                destination_name = f"{level_prefix}-{image_filename}"
                destination = OUT_DIR / destination_name
                destination.write_bytes(archive.read(source))

            print(f"Level {level}: {len(images_in_order)} images, {len(table_models)} models")
            if not table_models:
                table_models = [
                    item["model"] for item in library["levels"][level]["items"]
                ]

            for index, raw_model in enumerate(table_models):
                if index >= len(images_in_order):
                    break
                image_url = f"/images/level{level}-{images_in_order[index]}"
                library_model_keys = [
                    item["model"]
                    for item in library["levels"][level]["items"]
                ]
                matched = None
                raw_key = simplify_model_key(raw_model)
                for item_model in library_model_keys:
                    if simplify_model_key(item_model) in raw_key or raw_key in simplify_model_key(item_model):
                        matched = item_model
                        break
                if not matched and index < len(library["levels"][level]["items"]):
                    matched = library["levels"][level]["items"][index]["model"]

                if matched:
                    image_map[f"{level}-{matched}"] = image_url
                    for item in library["levels"][level]["items"]:
                        if item["model"] == matched:
                            item["imageUrl"] = image_url

    LIBRARY_JSON.write_text(json.dumps(library, indent=2), encoding="utf-8")
    map_path = PROTOTYPE / "src" / "data" / "imageMap.json"
    map_path.write_text(json.dumps(image_map, indent=2), encoding="utf-8")
    print(f"Mapped {len(image_map)} images -> {map_path}")


if __name__ == "__main__":
    main()
