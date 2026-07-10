"""Parse MasterList.txt into masterCategories.json."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE = ROOT / "MasterList.txt"
OUTPUT = Path(__file__).resolve().parent.parent / "src" / "data" / "masterCategories.json"

KNOWN_GROUPS = {
    "Roofing",
    "Siding & Exterior Finishes",
    "Soffit / Fascia",
    "Windows",
    "Exterior Doors",
    "Main Entry Doors",
    "Storm Doors",
    "Sliding / Patio Doors",
    "Garage Doors",
    "Exterior Lighting",
    "Porch / Deck / Outdoor Living",
    "Flooring",
    "Hardwood",
    "LVP / Laminate",
    "Tile",
    "Carpet",
    "Interior Doors",
    "Door Hardware",
    "Trim & Millwork",
    "Baseboard",
    "Casing",
    "Crown Molding",
    "Specialty Trim",
    "Paint",
    "Cabinetry",
    "Cabinet Hardware",
    "Countertops",
    "Backsplash",
    "Kitchen Sink & Faucet",
    "Appliances",
    "Vanity",
    "Plumbing Fixtures",
    "Faucets",
    "Shower",
    "Tub",
    "Toilet",
    "Bathroom Accessories",
    "Switches & Outlets",
    "Lighting",
    "Interior Fixtures",
    "Smart Home",
    "HVAC & COMFORT",
    "FIREPLACE SELECTIONS",
    "Closets",
    "Mudroom",
    "LAUNDRY ROOM",
    "Cabinets",
    "Countertops",
    "Sink",
    "Faucet",
    "Drying racks",
    "Appliance pedestals",
    "SPECIALTY ITEMS",
    "Hardware & Accessories",
    "General Preferences",
    "INFORMATION NEEDED FOR ORDERING",
}

SECTION_HEADERS = {
    "EXTERIOR SELECTIONS": 1,
    "INTERIOR FINISHES": 2,
    "KITCHEN SELECTIONS": 3,
    "BATHROOM SELECTIONS": 4,
    "ELECTRICAL & TECHNOLOGY": 5,
    "HVAC & COMFORT": 6,
    "FIREPLACE SELECTIONS": 7,
    "STORAGE & ORGANIZATION": 8,
    "LAUNDRY ROOM": 9,
    "SPECIALTY ITEMS": 10,
    "FINAL DETAIL ITEMS": 11,
    "PROJECT-WIDE DETAILS": 12,
    "INFORMATION NEEDED FOR ORDERING": 13,
}

SUBGROUP_PARENT = {
    "Main Entry Doors": "Exterior Doors",
    "Storm Doors": "Exterior Doors",
    "Sliding / Patio Doors": "Exterior Doors",
    "Garage Doors": "Exterior Doors",
    "Hardwood": "Flooring",
    "LVP / Laminate": "Flooring",
    "Tile": "Flooring",
    "Carpet": "Flooring",
    "Baseboard": "Trim & Millwork",
    "Casing": "Trim & Millwork",
    "Crown Molding": "Trim & Millwork",
    "Specialty Trim": "Trim & Millwork",
    "Faucets": "Plumbing Fixtures",
    "Shower": "Plumbing Fixtures",
    "Tub": "Plumbing Fixtures",
    "Toilet": "Plumbing Fixtures",
    "Interior Fixtures": "Lighting",
}


def section_prefix(section_name: str) -> str:
    mapping = {
        "EXTERIOR SELECTIONS": "Exterior",
        "INTERIOR FINISHES": "Interior",
        "KITCHEN SELECTIONS": "Kitchen",
        "BATHROOM SELECTIONS": "Bathroom",
        "ELECTRICAL & TECHNOLOGY": "Electrical",
        "HVAC & COMFORT": "HVAC",
        "FIREPLACE SELECTIONS": "Fireplace",
        "STORAGE & ORGANIZATION": "Storage",
        "LAUNDRY ROOM": "Laundry Room",
        "SPECIALTY ITEMS": "Specialty",
        "FINAL DETAIL ITEMS": "Final Details",
        "PROJECT-WIDE DETAILS": "Project-Wide",
        "INFORMATION NEEDED FOR ORDERING": "Ordering",
    }
    return mapping.get(section_name, section_name.title())


def category_key(section_name: str, group_name: str) -> str:
    return f"{section_prefix(section_name)} - {group_name}"


def tokenize_master_list(text: str) -> list[str]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    parts = re.split(r"\n|\x01", normalized)
    tokens: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if re.match(r"^\d+\.\s+", part):
            tokens.extend(re.split(r"(?=\d+\.\s+)", part))
            continue
        tokens.append(part)
    return [token.strip() for token in tokens if token.strip() and token != "\x01"]


def parse_master_list(text: str) -> dict:
    lines = tokenize_master_list(text)

    sections: list[dict] = []
    current_section_name = ""
    groups_by_key: dict[str, dict] = {}
    current_group_key: str | None = None

    for line in lines:
        line = line.lstrip("\ufeff")
        numbered_section = re.match(r"^(\d+)\.\s+(.+)$", line)
        if numbered_section:
            section_title = numbered_section.group(2).strip().upper()
            if section_title in SECTION_HEADERS:
                current_section_name = section_title
                sections.append(
                    {
                        "order": SECTION_HEADERS[section_title],
                        "name": section_title,
                        "slug": section_title.lower().replace(" ", "-").replace("&", "and"),
                        "groups": [],
                    }
                )
                current_group_key = None
            continue

        if line in SECTION_HEADERS:
            current_section_name = line
            sections.append(
                {
                    "order": SECTION_HEADERS[line],
                    "name": line,
                    "slug": line.lower().replace(" ", "-").replace("&", "and"),
                    "groups": [],
                }
            )
            current_group_key = None
            continue

        if line in KNOWN_GROUPS and current_section_name:
            parent = SUBGROUP_PARENT.get(line)
            key = category_key(current_section_name, line)
            group = {
                "name": line,
                "slug": re.sub(r"[^a-z0-9]+", "-", line.lower()).strip("-"),
                "categoryKey": key,
                "parentGroup": parent,
                "items": [],
            }
            groups_by_key[key] = group
            current_group_key = key

            if parent:
                parent_key = category_key(current_section_name, parent)
                parent_group = groups_by_key.get(parent_key)
                if parent_group:
                    parent_group.setdefault("subgroups", []).append(group)
                continue

            section = sections[-1]
            if not any(existing["categoryKey"] == key for existing in section["groups"]):
                section["groups"].append(group)
            continue

        if current_group_key and line not in KNOWN_GROUPS:
            groups_by_key[current_group_key]["items"].append(line)

    style_themes = ["Modern", "Traditional", "Farmhouse", "Transitional", "Contemporary Luxury"]
    for line in lines:
        if "modern" in line.lower() and "farmhouse" in line.lower():
            style_themes = [
                part.strip().title()
                for part in line.split("/")
                if part.strip() and "style" not in part.lower()
            ]

    flat_categories = []
    for section in sections:
        for group in section["groups"]:
            flat_categories.append(group["categoryKey"])
            for subgroup in group.get("subgroups", []):
                flat_categories.append(subgroup["categoryKey"])

    return {
        "meta": {
            "source": "Master Selections List",
            "version": 2,
            "styleThemesFromDocument": style_themes,
            "notes": "Admin can add themes beyond document defaults. Tag library items to themes for recommendations.",
        },
        "sections": sections,
        "flatCategories": flat_categories,
        "applianceCategoryRemap": {
            "Kitchen - Refrigeration": "Kitchen - Appliances",
            "Kitchen - Cooking": "Kitchen - Appliances",
            "Kitchen - Ventilation": "Kitchen - Appliances",
            "Kitchen - Microwave": "Kitchen - Appliances",
            "Kitchen - Dishwasher": "Kitchen - Appliances",
            "Laundry": "Laundry Room - Appliances",
            "Plumbing - Kitchen Faucet": "Kitchen - Sink & Faucet",
            "Plumbing - Bathroom Faucet": "Bathroom - Plumbing Fixtures",
            "Plumbing - Shower / Tub": "Bathroom - Plumbing Fixtures",
            "Plumbing - Toilet": "Bathroom - Plumbing Fixtures",
            "Plumbing - Specialty": "Kitchen - Sink & Faucet",
        },
    }


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8", errors="ignore")
    data = parse_master_list(text)
    OUTPUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Sections: {len(data['sections'])}")
    print(f"Categories: {len(data['flatCategories'])}")
    print("Themes:", data["meta"]["styleThemesFromDocument"])


if __name__ == "__main__":
    main()
