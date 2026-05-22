import json
from pathlib import Path

categories = [
    "Kitchen - Refrigeration",
    "Kitchen - Cooking",
    "Kitchen - Ventilation",
    "Kitchen - Microwave",
    "Kitchen - Dishwasher",
    "Laundry",
    "Plumbing - Kitchen Faucet",
    "Plumbing - Bathroom Faucet",
    "Plumbing - Shower / Tub",
    "Plumbing - Toilet",
    "Plumbing - Specialty",
]

library = {
    "meta": {
        "vendor": "Appliances",
        "changeOrderMinimum": 500,
        "note": "CHANGE ORDERS WILL BEGIN AT $500.",
    },
    "levels": {
        "1": {
            "label": "Level 1 - Value",
            "description": "Low range selections",
            "items": [
                {"category": "Kitchen - Refrigeration", "manufacturer": "GE", "model": "GWE22JYMFS", "product": "Counter-Depth French-Door Refrigerator 36\" 21.9 cu ft", "finish": "Fingerprint Resistant Stainless", "priceMin": 1480, "priceMax": 1480},
                {"category": "Kitchen - Cooking", "manufacturer": "GE", "model": "GGS600AVFS", "product": "Convection Gas Range with Air Fry", "finish": "Stainless steel", "priceMin": 992, "priceMax": 992},
                {"category": "Kitchen - Microwave", "manufacturer": "GE", "model": "JVM3160RFSS", "product": "Over-the-range microwave 1.6 cu ft", "finish": "Stainless steel", "priceMin": 230, "priceMax": 230},
                {"category": "Kitchen - Dishwasher", "manufacturer": "GE", "model": "GDT670SYVFS", "product": "Top Control Dishwasher with Sanitize", "finish": "Fingerprint Resistant Stainless", "priceMin": 612, "priceMax": 612},
                {"category": "Laundry", "manufacturer": "GE Profile", "model": "PTW605BSRWS", "product": "4.9 cu ft Top Load Washer", "finish": "White/silver", "priceMin": 715, "priceMax": 715},
                {"category": "Laundry", "manufacturer": "GE Profile", "model": "PTD60EBSRWS", "product": "7.4 cu ft Electric Dryer", "finish": "White/silver", "priceMin": 740, "priceMax": 740},
                {"category": "Plumbing - Kitchen Faucet", "manufacturer": "Altair", "model": "F0216-KCF-BN", "product": "Oribe 1.8 GPM Pull Down Kitchen Faucet", "finish": "Brushed nickel", "priceMin": 135.15, "priceMax": 135.15},
                {"category": "Plumbing - Bathroom Faucet", "manufacturer": "Elegant Lighting", "model": "FAV-1005PCH", "product": "Lena 1.5 GPM Vessel Bathroom Faucet", "finish": "Chrome or brushed nickel", "priceMin": 89, "priceMax": 99},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Moen", "model": "T2233EP", "product": "Eva Tub and Shower Trim Package", "finish": "ORB, Chrome, brushed nickel", "priceMin": 117, "priceMax": 196},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Delta", "model": "T14432-SS", "product": "Woodhurst Tub and Shower Trim Package", "finish": "Chrome or brushed nickel", "priceMin": 108, "priceMax": 160},
                {"category": "Plumbing - Toilet", "manufacturer": "Kohler", "model": "K-26077-0", "product": "Kingston Comfort Height Two-Piece Toilet", "finish": "White", "priceMin": 200, "priceMax": 200},
            ],
        },
        "2": {
            "label": "Level 2 - Mid",
            "description": "Mid range selections",
            "items": [
                {"category": "Kitchen - Refrigeration", "manufacturer": "GE Profile", "model": "PJE23BYWFS", "product": "Smart Counter-Depth French-Door Refrigerator 23.2 cu ft", "finish": "Fingerprint Resistant Stainless", "priceMin": 2894, "priceMax": 2894},
                {"category": "Kitchen - Cooking", "manufacturer": "GE Profile", "model": "PGP7036SLSS", "product": "36\" Built-In Gas Cooktop", "finish": "Stainless steel", "priceMin": 1402, "priceMax": 1402, "group": "cooking-package"},
                {"category": "Kitchen - Cooking", "manufacturer": "GE Profile", "model": "PTD7000SNSS", "product": "30\" Built-In Convection Double Wall Oven", "finish": "Stainless steel", "priceMin": 2480, "priceMax": 2480, "group": "cooking-package"},
                {"category": "Kitchen - Cooking", "manufacturer": "GE Profile", "model": "PGS930YPFS", "product": "30\" Smart Slide-In Gas Range (alternative)", "finish": "Anti fingerprint stainless", "priceMin": 2084, "priceMax": 2084, "group": "range-alternative", "optional": True},
                {"category": "Kitchen - Cooking", "manufacturer": "GE Profile", "model": "PSS93YPFS", "product": "30\" Smart Slide-In Electric Range (alternative)", "finish": "Anti fingerprint stainless", "priceMin": 1724, "priceMax": 1724, "group": "range-alternative", "optional": True},
                {"category": "Kitchen - Ventilation", "manufacturer": "XO", "model": "XOB36SC", "product": "Fabriano 36\" Wall Mount Hood", "finish": "Stainless steel", "priceMin": 759, "priceMax": 759},
                {"category": "Kitchen - Microwave", "manufacturer": "LA", "model": "UMD241AS", "product": "24\" Built-In Microwave Drawer", "finish": "Stainless steel", "priceMin": 900, "priceMax": 900, "group": "microwave-choice"},
                {"category": "Kitchen - Microwave", "manufacturer": "GE Profile", "model": "PVM9005SJSS", "product": "Over-the-Range Sensor Microwave (alternative)", "finish": "Anti fingerprint stainless", "priceMin": 450, "priceMax": 450, "group": "microwave-choice", "optional": True},
                {"category": "Kitchen - Dishwasher", "manufacturer": "GE Profile", "model": "PDT715SYVFS", "product": "Top Control Dishwasher with Microban", "finish": "Anti Fingerprint Stainless", "priceMin": 725, "priceMax": 725},
                {"category": "Laundry", "manufacturer": "GE", "model": "GFW655SSVWW", "product": "5.0 cu ft Smart Front Load Washer", "finish": "White/silver", "priceMin": 865, "priceMax": 865},
                {"category": "Laundry", "manufacturer": "GE", "model": "GFD65ESSVWW", "product": "7.8 cu ft Smart Electric Dryer", "finish": "White/silver", "priceMin": 890, "priceMax": 890},
                {"category": "Plumbing - Kitchen Faucet", "manufacturer": "Delta", "model": "9110-BL-DST", "product": "Westville Pull Down Kitchen Faucet", "finish": "Brushed nickel, chrome, matte black", "priceMin": 236, "priceMax": 282},
                {"category": "Plumbing - Bathroom Faucet", "manufacturer": "Kohler", "model": "K-35953-4-BN", "product": "Buckley Widespread Bathroom Faucet", "finish": "Brushed nickel, chrome, matte black", "priceMin": 209, "priceMax": 283},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Miseno", "model": "MTS550425SEBN", "product": "Mia Tub and Shower Trim with Rain Head", "finish": "Brushed nickel, chrome, matte black", "priceMin": 193, "priceMax": 242},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Pulse", "model": "3006-MB-1.8GPM", "product": "Refuge Pressure Balanced Shower System", "finish": "Multiple finishes", "priceMin": 251, "priceMax": 330},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Signature Hardware", "model": "416163", "product": "Lattimore Pressure Balanced Shower System", "finish": "Multiple finishes", "priceMin": 440, "priceMax": 470},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Symmons", "model": "S339815TRM", "product": "Solarity Pressure Balanced Shower System", "finish": "Matte black, chrome, satin nickel", "priceMin": 300, "priceMax": 420},
                {"category": "Plumbing - Toilet", "manufacturer": "Kohler", "model": "K-43999-0", "product": "Highline Two Piece Elongated Toilet", "finish": "White", "priceMin": 330, "priceMax": 330},
            ],
        },
        "3": {
            "label": "Level 3 - Premium",
            "description": "High range Monogram / premium selections",
            "items": [
                {"category": "Kitchen - Refrigeration", "manufacturer": "Monogram", "model": "ZIP364", "product": "36\" Premium Integrated French-Door Bottom Freezer", "finish": "Panel-ready / stainless", "priceMin": 11407, "priceMax": 11407},
                {"category": "Kitchen - Microwave", "manufacturer": "Monogram", "model": "ZWL1126SRSS", "product": "1.2 cu ft Drawer Microwave", "finish": "Stainless steel", "priceMin": 1680, "priceMax": 1680},
                {"category": "Kitchen - Microwave", "manufacturer": "Monogram", "model": "ZSA1202PSS", "product": "Advantium 120 Speedcooking Oven", "finish": "Stainless steel", "priceMin": 1840, "priceMax": 1840},
                {"category": "Kitchen - Cooking", "manufacturer": "Monogram", "model": "ZGU366NTSS", "product": "36\" Professional Gas Rangetop 6 Burners", "finish": "Stainless steel", "priceMin": 3942, "priceMax": 3942, "group": "cooking-package"},
                {"category": "Kitchen - Cooking", "manufacturer": "Monogram", "model": "ZTD90DPSNSS", "product": "30\" Built-In Double Wall Oven", "finish": "Stainless steel", "priceMin": 5280, "priceMax": 5280, "group": "cooking-package"},
                {"category": "Kitchen - Cooking", "manufacturer": "Monogram", "model": "ZGP304NTSS", "product": "30\" All-Gas Professional Range (alternative)", "finish": "Stainless Steel", "priceMin": 4595, "priceMax": 4595, "group": "range-alternative", "optional": True},
                {"category": "Kitchen - Ventilation", "manufacturer": "Monogram", "model": "ZVW1360SPSS", "product": "36\" Professional Hood with QuietBoost", "finish": "Stainless steel", "priceMin": 2320, "priceMax": 2320},
                {"category": "Kitchen - Dishwasher", "manufacturer": "Monogram", "model": "ZDT925SPNSS", "product": "24\" Fully Integrated Dishwasher", "finish": "Stainless steel", "priceMin": 1755, "priceMax": 1755},
                {"category": "Laundry", "manufacturer": "GE Profile", "model": "PFW870SSVWW", "product": "5.3 cu ft Smart Front Load Washer", "finish": "White (stackable)", "priceMin": 1015, "priceMax": 1015},
                {"category": "Laundry", "manufacturer": "GE Profile", "model": "PFD87ESSVWW", "product": "7.8 cu ft Smart Electric Dryer", "finish": "White (stackable)", "priceMin": 1040, "priceMax": 1040},
                {"category": "Plumbing - Kitchen Faucet", "manufacturer": "Signature Hardware", "model": "SHXCAM107BG", "product": "Amberley Pull Down Kitchen Faucet", "finish": "Multiple premium finishes", "priceMin": 376, "priceMax": 502},
                {"category": "Plumbing - Kitchen Faucet", "manufacturer": "Delta", "model": "18804Z-CZ-DST", "product": "Theodora Pre-Rinse Pull Down Kitchen Faucet", "finish": "Multiple finishes", "priceMin": 346, "priceMax": 465},
                {"category": "Plumbing - Specialty", "manufacturer": "Waterstone", "model": "5600-ABZ", "product": "Traditional PLP Pulldown Faucet", "finish": "32 finish options", "priceMin": 2831.25, "priceMax": 2831.25, "optional": True},
                {"category": "Plumbing - Specialty", "manufacturer": "Kohler", "model": "99270-BV", "product": "Artifacts Wall-mount Pot Filler", "finish": "7 finish options", "priceMin": 862, "priceMax": 1380, "optional": True},
                {"category": "Plumbing - Specialty", "manufacturer": "Delta", "model": "GR250-CZ", "product": "Glass Rinser", "finish": "7 finish options", "priceMin": 227, "priceMax": 300, "optional": True},
                {"category": "Plumbing - Specialty", "manufacturer": "Mountain Plumbing", "model": "MT250/CHBRZ", "product": "Countertop Glass Rinser", "finish": "Champagne bronze", "priceMin": 365, "priceMax": 365, "optional": True},
                {"category": "Plumbing - Bathroom Faucet", "manufacturer": "Kingston Brass", "model": "KS1252AL", "product": "Heritage Wall Mounted Widespread Faucet", "finish": "Multiple finishes", "priceMin": 292, "priceMax": 334},
                {"category": "Plumbing - Bathroom Faucet", "manufacturer": "Signature Hardware", "model": "437386", "product": "Enid Widespread Bathroom Faucet", "finish": "Multiple finishes", "priceMin": 289, "priceMax": 366},
                {"category": "Plumbing - Bathroom Faucet", "manufacturer": "Pfister", "model": "LG49-TB0SDB", "product": "Tisbury Widespread Bathroom Faucet", "finish": "Multiple finishes", "priceMin": 327, "priceMax": 467},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Delta", "model": "DSS-Trinsic-17T03-CZ", "product": "TempAssure 17T Thermostatic Shower System", "finish": "Multiple finishes", "priceMin": 1443, "priceMax": 2001},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Signature Hardware", "model": "SHK559416", "product": "Beasley Thermostatic Shower System", "finish": "Premium finishes", "priceMin": 2191, "priceMax": 2680},
                {"category": "Plumbing - Shower / Tub", "manufacturer": "Signature Hardware", "model": "SHK497971", "product": "Greyfield Thermostatic Shower System", "finish": "Premium finishes", "priceMin": 2303, "priceMax": 2845},
                {"category": "Plumbing - Toilet", "manufacturer": "Kohler", "model": "K-20450-0", "product": "Irvine Comfort Height Skirted Toilet", "finish": "White", "priceMin": 585, "priceMax": 585},
            ],
        },
    },
    "categories": categories,
}

output_path = Path(__file__).resolve().parent.parent / "src" / "data" / "selectionLibrary.json"
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(library, indent=2), encoding="utf-8")
print("Written", output_path)
