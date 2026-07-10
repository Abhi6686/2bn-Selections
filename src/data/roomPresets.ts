/**
 * Room Presets — Default room type templates with curated category selections.
 * Images are stored locally at /public/rooms/*.png
 */

export interface RoomPreset {
  name: string;
  icon: string;
  imageUrl: string;
  description: string;
  accentColor: string;
  defaultCategoryKeys: string[];
}

export const ROOM_PRESETS: RoomPreset[] = [
  {
    name: "Master Bedroom",
    icon: "🛏️",
    imageUrl: "/rooms/master-bedroom.png",
    description: "Primary bedroom suite with en-suite bathroom access",
    accentColor: "#8B7355",
    defaultCategoryKeys: [
      "Interior - Hardwood",
      "Interior - LVP / Laminate",
      "Interior - Carpet",
      "Interior - Interior Doors",
      "Interior - Door Hardware",
      "Interior - Paint",
      "Interior - Baseboard",
      "Interior - Casing",
      "Interior - Crown Molding",
      "Electrical - Interior Fixtures",
      "Storage - Closets",
    ],
  },
  {
    name: "Kids Bedroom (Boy)",
    icon: "🚀",
    imageUrl: "/rooms/kids-bedroom-boy.png",
    description: "Fun and functional bedroom for boys with durable finishes",
    accentColor: "#3B7DD8",
    defaultCategoryKeys: [
      "Interior - Carpet",
      "Interior - Paint",
      "Interior - Interior Doors",
      "Interior - Door Hardware",
      "Electrical - Interior Fixtures",
      "Storage - Closets",
    ],
  },
  {
    name: "Kids Bedroom (Girl)",
    icon: "🌸",
    imageUrl: "/rooms/kids-bedroom-girl.png",
    description: "Whimsical and elegant bedroom for girls",
    accentColor: "#D4698A",
    defaultCategoryKeys: [
      "Interior - Carpet",
      "Interior - Paint",
      "Interior - Interior Doors",
      "Interior - Door Hardware",
      "Electrical - Interior Fixtures",
      "Storage - Closets",
    ],
  },
  {
    name: "Master Bathroom",
    icon: "🛁",
    imageUrl: "/rooms/master-bathroom.png",
    description: "Spa-like primary bathroom with premium fixtures",
    accentColor: "#5B9EA0",
    defaultCategoryKeys: [
      "Interior - Tile",
      "Bathroom - Vanity",
      "Bathroom - Faucets",
      "Bathroom - Shower",
      "Bathroom - Tub",
      "Bathroom - Toilet",
      "Bathroom - Bathroom Accessories",
      "Electrical - Interior Fixtures",
      "Interior - Paint",
    ],
  },
  {
    name: "Common Bathroom",
    icon: "🚿",
    imageUrl: "/rooms/common-bathroom.png",
    description: "Shared full bathroom for family and guests",
    accentColor: "#7B9E87",
    defaultCategoryKeys: [
      "Interior - Tile",
      "Bathroom - Vanity",
      "Bathroom - Faucets",
      "Bathroom - Shower",
      "Bathroom - Toilet",
      "Bathroom - Bathroom Accessories",
      "Electrical - Interior Fixtures",
    ],
  },
  {
    name: "Kitchen",
    icon: "🍳",
    imageUrl: "/rooms/kitchen.png",
    description: "Heart of the home with full appliance and cabinetry selection",
    accentColor: "#C4933F",
    defaultCategoryKeys: [
      "Interior - Tile",
      "Interior - LVP / Laminate",
      "Interior - Hardwood",
      "Kitchen - Cabinetry",
      "Kitchen - Cabinet Hardware",
      "Kitchen - Countertops",
      "Kitchen - Backsplash",
      "Kitchen - Kitchen Sink & Faucet",
      "Kitchen - Appliances - Refrigerator",
      "Kitchen - Appliances - Range / Cooking",
      "Kitchen - Appliances - Wall Oven",
      "Kitchen - Appliances - Microwave",
      "Kitchen - Appliances - Dishwasher",
      "Kitchen - Appliances - Vent Hood",
      "Electrical - Interior Fixtures",
      "Interior - Paint",
    ],
  },
  {
    name: "Living Room",
    icon: "🛋️",
    imageUrl: "/rooms/living-room.png",
    description: "Open living and entertainment space with premium finishes",
    accentColor: "#7B6FA0",
    defaultCategoryKeys: [
      "Interior - Hardwood",
      "Interior - LVP / Laminate",
      "Interior - Carpet",
      "Interior - Paint",
      "Interior - Trim & Millwork",
      "Interior - Crown Molding",
      "Electrical - Interior Fixtures",
      "Interior - Interior Doors",
    ],
  },
  {
    name: "Laundry Room",
    icon: "🧺",
    imageUrl: "/rooms/laundry.png",
    description: "Functional utility space with cabinets and appliances",
    accentColor: "#5B8A9A",
    defaultCategoryKeys: [
      "Interior - Tile",
      "Laundry Room - Cabinets",
      "Laundry Room - Countertops",
      "Laundry Room - Sink",
      "Laundry Room - Faucet",
      "Laundry Room - Appliances - Washer",
      "Laundry Room - Appliances - Dryer",
    ],
  },
  {
    name: "Home Office",
    icon: "💼",
    imageUrl: "/rooms/home-office.png",
    description: "Productive workspace with built-in storage and premium finishes",
    accentColor: "#8B6914",
    defaultCategoryKeys: [
      "Interior - Hardwood",
      "Interior - LVP / Laminate",
      "Interior - Paint",
      "Interior - Trim & Millwork",
      "Interior - Crown Molding",
      "Electrical - Interior Fixtures",
      "Storage - Closets",
    ],
  },
  {
    name: "Garage",
    icon: "🚗",
    imageUrl: "/rooms/garage.png",
    description: "Finished garage with epoxy floors and storage systems",
    accentColor: "#6B7B8D",
    defaultCategoryKeys: [
      "Exterior - Garage Doors",
      "Electrical - Switches & Outlets",
    ],
  },
];

export function findPresetByName(name: string): RoomPreset | undefined {
  return ROOM_PRESETS.find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
}

export function getRoomImage(name: string, fallback?: string): string {
  const preset = findPresetByName(name);
  return preset?.imageUrl ?? fallback ?? "/rooms/master-bedroom.png";
}
