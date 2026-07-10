import json
from pathlib import Path

library_path = Path(__file__).resolve().parent.parent / "src" / "data" / "selectionLibrary.json"
data = json.loads(library_path.read_text(encoding="utf-8"))

for level_key in data["levels"]:
    for item in data["levels"][level_key]["items"]:
        product_words = item["product"].split()
        selection_slot = item["model"]
        if "Refrigerator" in item["product"] or "refrigerator" in item["product"].lower():
            selection_slot = "Refrigerator"
        elif "Range" in item["product"] or "Cooktop" in item["product"] or "Rangetop" in item["product"]:
            selection_slot = "Range / Cooking"
        elif "Microwave" in item["product"] or "Advantium" in item["product"]:
            selection_slot = "Microwave"
        elif "Dishwasher" in item["product"]:
            selection_slot = "Dishwasher"
        elif "Washer" in item["product"]:
            selection_slot = "Washer"
        elif "Dryer" in item["product"]:
            selection_slot = "Dryer"
        elif "Hood" in item["product"]:
            selection_slot = "Vent Hood"
        elif "Wall Oven" in item["product"] or "Double" in item["product"]:
            selection_slot = "Wall Oven"
        elif "Toilet" in item["product"]:
            selection_slot = "Toilet"
        elif "Shower" in item["product"] or "Tub" in item["product"]:
            selection_slot = "Shower / Tub"
        elif "Faucet" in item["product"]:
            selection_slot = "Faucet"
        elif "Pot Filler" in item["product"] or "Rinser" in item["product"]:
            selection_slot = "Specialty Plumbing"

        item["selectionSlot"] = selection_slot
        item["categoryKey"] = f"{item['category']} - {selection_slot}"

library_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
print("Added selectionSlot to all library items")
