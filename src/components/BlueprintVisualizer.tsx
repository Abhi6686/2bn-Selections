import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, Trash2, Eye, Edit3, Settings, MapPin, CheckCircle, Info, Sparkles, Loader2, Image as ImageIcon } from "lucide-react";
import { apiFetch } from "../api/client";

interface VisualizerSelection {
  category?: string;
  categoryKey?: string;
  libraryItemId?: string;
  manufacturer?: string;
  model?: string;
  product?: string;
  state?: string;
  priceUsed?: number;
  quantity?: number;
}

interface Hotspot {
  id: string;
  x: number; // percentage width (0-100)
  y: number; // percentage height (0-100)
  categoryKey: string;
  label: string;
}

interface BlueprintVisualizerProps {
  selections: VisualizerSelection[];
  activeCategoryKey: string;
  onSelectCategory: (categoryKey: string) => void;
  projectId: string;
}

const ARCHETYPES = [
  { id: "farmhouse", name: "Modern Farmhouse" },
  { id: "craftsman", name: "Craftsman Cottage" },
];

const AVAILABLE_HOTSPOT_CATEGORIES = [
  { key: "Exterior - Roofing", label: "Roofing" },
  { key: "Exterior - Siding & Exterior Finishes", label: "Siding & Exterior Finishes" },
  { key: "Exterior - Soffit / Fascia", label: "Soffit / Fascia" },
  { key: "Exterior - Windows", label: "Windows" },
  { key: "Exterior - Main Entry Doors", label: "Main Entry Doors" },
  { key: "Exterior - Storm Doors", label: "Storm Doors" },
  { key: "Exterior - Sliding / Patio Doors", label: "Sliding & Patio Doors" },
];

const AI_THEMES = [
  { id: "sunset", label: "🌅 Golden Sunset" },
  { id: "winter", label: "❄️ Snowy Winter" },
  { id: "forest", label: "🌲 Pine Forest" },
  { id: "modern", label: "🏡 Modern Suburbs" },
  { id: "traditional", label: "☀️ Sunny Morning" },
];

// Default sample blueprint image for demonstration
const DEFAULT_BLUEPRINT_URL = "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80";

export function BlueprintVisualizer({
  selections,
  activeCategoryKey,
  onSelectCategory,
  projectId,
}: BlueprintVisualizerProps) {
  const [viewMode, setViewMode] = useState<"archetype" | "custom" | "ai">("archetype");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("farmhouse");
  const [isBuilderMode, setIsBuilderMode] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  
  // AI States
  const [aiRenderUrl, setAiRenderUrl] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>("sunset");
  const [showPromptDetails, setShowPromptDetails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load hotspots & AI renders from local storage for custom blueprint persistence
  useEffect(() => {
    const saved = localStorage.getItem(`2bn-hotspots-${projectId}`);
    if (saved) {
      try {
        setHotspots(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved hotspots", e);
      }
    } else {
      // Default sample hotspots
      setHotspots([
        { id: "hs-1", x: 50, y: 20, categoryKey: "Exterior - Roofing", label: "Roofing" },
        { id: "hs-2", x: 35, y: 55, categoryKey: "Exterior - Siding & Exterior Finishes", label: "Exterior Siding" },
        { id: "hs-3", x: 50, y: 75, categoryKey: "Exterior - Main Entry Doors", label: "Main Entry Door" },
        { id: "hs-4", x: 70, y: 55, categoryKey: "Exterior - Windows", label: "Windows" },
      ]);
    }

    const savedImage = localStorage.getItem(`2bn-blueprint-img-${projectId}`);
    if (savedImage) {
      setUploadedImage(savedImage);
    }

    const savedAiRender = localStorage.getItem(`2bn-ai-render-${projectId}`);
    if (savedAiRender) {
      setAiRenderUrl(savedAiRender);
    }

    const savedAiPrompt = localStorage.getItem(`2bn-ai-prompt-${projectId}`);
    if (savedAiPrompt) {
      setAiPrompt(savedAiPrompt);
    }

    const savedTheme = localStorage.getItem(`2bn-ai-theme-${projectId}`);
    if (savedTheme) {
      setSelectedTheme(savedTheme);
    }
  }, [projectId]);

  // Save hotspots helper
  const saveHotspots = (newHotspots: Hotspot[]) => {
    setHotspots(newHotspots);
    localStorage.setItem(`2bn-hotspots-${projectId}`, JSON.stringify(newHotspots));
  };

  // Find selection details helper
  const getSelectionForCategory = (categoryKey: string) => {
    return selections.find(
      (s) =>
        ((s.category && (s.category === categoryKey || s.category.includes(categoryKey))) ||
         (s.categoryKey && (s.categoryKey === categoryKey || s.categoryKey.includes(categoryKey)))) &&
        s.state === "confirmed"
    );
  };

  // Dynamically resolve colors based on selection model/name
  const resolvedColors = useMemo(() => {
    const colors = {
      roof: "#2c3e50", // Dark slate
      siding: "#f5f6fa", // Off-white
      door: "#c0392b", // Red door
      windows: "#2f3640", // Dark trim
      soffit: "#dcdde1", // Grey soffit
    };

    // Roof shingle type/color
    const roofSel = getSelectionForCategory("Exterior - Roofing");
    if (roofSel) {
      const desc = `${roofSel.manufacturer} ${roofSel.model} ${roofSel.product}`.toLowerCase();
      if (desc.includes("charcoal") || desc.includes("slate") || desc.includes("black")) {
        colors.roof = "#1e272e";
      } else if (desc.includes("brown") || desc.includes("wood") || desc.includes("shake")) {
        colors.roof = "#57606f";
      } else if (desc.includes("pewter") || desc.includes("grey")) {
        colors.roof = "#747d8c";
      } else if (desc.includes("green")) {
        colors.roof = "#2f8450";
      } else {
        colors.roof = "#353b48";
      }
    }

    // Siding material/color
    const sidingSel = getSelectionForCategory("Exterior - Siding & Exterior Finishes");
    if (sidingSel) {
      const desc = `${sidingSel.manufacturer} ${sidingSel.model} ${sidingSel.product}`.toLowerCase();
      if (desc.includes("blue") || desc.includes("coastal")) {
        colors.siding = "#4a69bd";
      } else if (desc.includes("green") || desc.includes("forest") || desc.includes("sage")) {
        colors.siding = "#78e08f";
      } else if (desc.includes("grey") || desc.includes("pewter") || desc.includes("charcoal")) {
        colors.siding = "#82ccdd";
      } else if (desc.includes("white") || desc.includes("linen")) {
        colors.siding = "#f8f9fa";
      } else if (desc.includes("red") || desc.includes("brick")) {
        colors.siding = "#b8e994";
      }
    }

    // Main Entry door
    const doorSel = getSelectionForCategory("Exterior - Main Entry Doors");
    if (doorSel) {
      const desc = `${doorSel.manufacturer} ${doorSel.model} ${doorSel.product}`.toLowerCase();
      if (desc.includes("oak") || desc.includes("wood") || desc.includes("mahogany")) {
        colors.door = "#8c5b30";
      } else if (desc.includes("black") || desc.includes("charcoal")) {
        colors.door = "#1e272e";
      } else if (desc.includes("white")) {
        colors.door = "#f5f6fa";
      } else if (desc.includes("green")) {
        colors.door = "#1e3799";
      } else {
        colors.door = "#b33939"; // Classic brick red
      }
    }

    // Windows trim
    const winSel = getSelectionForCategory("Exterior - Windows");
    if (winSel) {
      const desc = `${winSel.manufacturer} ${winSel.model} ${winSel.product}`.toLowerCase();
      if (desc.includes("black")) {
        colors.windows = "#1e272e";
      } else if (desc.includes("white")) {
        colors.windows = "#ffffff";
      } else if (desc.includes("bronze")) {
        colors.windows = "#4a3c31";
      }
    }

    return colors;
  }, [selections]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const resultStr = event.target.result as string;
          setUploadedImage(resultStr);
          localStorage.setItem(`2bn-blueprint-img-${projectId}`, resultStr);
          setViewMode("custom");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isBuilderMode || viewMode !== "custom" || !containerRef.current) return;

    // Check if clicking directly on a hotspot pin to prevent adding a new pin on top
    if ((e.target as HTMLElement).closest(".hotspot-pin")) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newHotspot: Hotspot = {
      id: `hs-${Date.now()}`,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      categoryKey: AVAILABLE_HOTSPOT_CATEGORIES[0].key,
      label: AVAILABLE_HOTSPOT_CATEGORIES[0].label,
    };

    const nextHotspots = [...hotspots, newHotspot];
    saveHotspots(nextHotspots);
    setSelectedHotspotId(newHotspot.id);
  };

  const updateHotspot = (id: string, updates: Partial<Hotspot>) => {
    const nextHotspots = hotspots.map((hs) => {
      if (hs.id === id) {
        const key = updates.categoryKey || hs.categoryKey;
        const matchedCat = AVAILABLE_HOTSPOT_CATEGORIES.find((c) => c.key === key);
        return {
          ...hs,
          ...updates,
          label: matchedCat ? matchedCat.label : hs.label,
        };
      }
      return hs;
    });
    saveHotspots(nextHotspots);
  };

  const deleteHotspot = (id: string) => {
    const nextHotspots = hotspots.filter((hs) => hs.id !== id);
    saveHotspots(nextHotspots);
    if (selectedHotspotId === id) {
      setSelectedHotspotId(null);
    }
  };

  // AI Generative Rendering Call
  const handleGenerateAiRender = async (themeToUse = selectedTheme) => {
    const imgSource = uploadedImage;
    if (!imgSource) {
      setGenerationError("Please upload a custom blueprint elevation sketch first.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      // Map activeSelections
      const activeSelections = selections
        .filter((s) => s.state === "confirmed")
        .map((s) => ({
          category: s.category || s.categoryKey || "",
          manufacturer: s.manufacturer || "",
          model: s.model || "",
          product: s.product || "",
        }));

      const res = await apiFetch<{ renderingUrl: string; prompt: string }>(
        `/api/projects/${projectId}/selections/generate-rendering`,
        {
          method: "POST",
          body: JSON.stringify({
            blueprintImage: imgSource,
            selections: activeSelections,
            theme: themeToUse,
          }),
        }
      );

      setAiRenderUrl(res.renderingUrl);
      setAiPrompt(res.prompt);
      localStorage.setItem(`2bn-ai-render-${projectId}`, res.renderingUrl);
      localStorage.setItem(`2bn-ai-prompt-${projectId}`, res.prompt);
      localStorage.setItem(`2bn-ai-theme-${projectId}`, themeToUse);
    } catch (err: any) {
      console.error(err);
      setGenerationError(
        err.details?.error || err.message || "Failed to generate rendering. Ensure the backend server is running and your GEMINI_API_KEY is active."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Modern Farmhouse interactive SVG
  const renderFarmhouseSVG = () => {
    const colors = resolvedColors;
    const isRoofActive = activeCategoryKey === "Exterior - Roofing";
    const isSidingActive = activeCategoryKey === "Exterior - Siding & Exterior Finishes";
    const isDoorActive = activeCategoryKey === "Exterior - Main Entry Doors";
    const isWindowActive = activeCategoryKey === "Exterior - Windows";

    return (
      <svg viewBox="0 0 800 500" className="w-full h-full select-none" style={{ background: "#fcfbfa" }}>
        <defs>
          <linearGradient id="roofGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.roof} stopOpacity={1} />
            <stop offset="100%" stopColor={colors.roof} stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8f0fe" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#f5f6fa" stopOpacity={0.1} />
          </linearGradient>
          <pattern id="sidingPattern" width="10" height="40" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="40" stroke="rgba(15, 62, 32, 0.08)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Sky Background */}
        <rect width="800" height="500" fill="url(#skyGrad)" />
        
        {/* Soft Ground */}
        <path d="M 0,440 Q 400,430 800,440 L 800,500 L 0,500 Z" fill="#ebede9" />

        {/* Main Siding Structure */}
        <g 
          onClick={() => onSelectCategory("Exterior - Siding & Exterior Finishes")}
          className={`cursor-pointer transition-all duration-300 ${isSidingActive ? "filter drop-shadow-lg" : ""}`}
        >
          {/* Main Body */}
          <rect 
            x="180" 
            y="180" 
            width="440" 
            height="260" 
            fill={colors.siding} 
            stroke={isSidingActive ? "var(--accent)" : "#cbd5e1"} 
            strokeWidth={isSidingActive ? "3" : "2"} 
          />
          <rect x="180" y="180" width="440" height="260" fill="url(#sidingPattern)" />
          
          {/* Left Gable Extension */}
          <polygon 
            points="180,180 270,110 360,180" 
            fill={colors.siding} 
            stroke={isSidingActive ? "var(--accent)" : "#cbd5e1"} 
            strokeWidth={isSidingActive ? "3" : "2"} 
          />
          <polygon points="180,180 270,110 360,180" fill="url(#sidingPattern)" />

          {/* Right Gable Extension */}
          <polygon 
            points="440,180 530,110 620,180" 
            fill={colors.siding} 
            stroke={isSidingActive ? "var(--accent)" : "#cbd5e1"} 
            strokeWidth={isSidingActive ? "3" : "2"} 
          />
          <polygon points="440,180 530,110 620,180" fill="url(#sidingPattern)" />
        </g>

        {/* Siding Trim / Pillars */}
        <g stroke="#cbd5e1" strokeWidth="1" fill="#ffffff">
          {/* Left Column */}
          <rect x="375" y="320" width="10" height="120" />
          <rect x="370" y="430" width="20" height="10" fill="#a1a1a1" />
          {/* Right Column */}
          <rect x="415" y="320" width="10" height="120" />
          <rect x="410" y="430" width="20" height="10" fill="#a1a1a1" />
        </g>

        {/* Porch Shed Roof */}
        <polygon 
          points="360,310 440,310 450,320 350,320" 
          fill={colors.roof} 
          stroke="#2c3e50" 
        />

        {/* Roof Structure */}
        <g 
          onClick={() => onSelectCategory("Exterior - Roofing")}
          className={`cursor-pointer transition-all duration-300 ${isRoofActive ? "filter drop-shadow-xl" : ""}`}
        >
          {/* Left Roof Plane */}
          <polygon 
            points="160,185 270,100 380,185 365,195 270,120 175,195" 
            fill="url(#roofGrad)" 
            stroke={isRoofActive ? "var(--accent)" : "#1e272e"} 
            strokeWidth={isRoofActive ? "3" : "1.5"} 
          />
          {/* Right Roof Plane */}
          <polygon 
            points="420,185 530,100 640,185 625,195 530,120 435,195" 
            fill="url(#roofGrad)" 
            stroke={isRoofActive ? "var(--accent)" : "#1e272e"} 
            strokeWidth={isRoofActive ? "3" : "1.5"} 
          />
          {/* Main Connector Ridge */}
          <polygon 
            points="270,100 530,100 530,115 270,115" 
            fill={colors.roof} 
            stroke={isRoofActive ? "var(--accent)" : "#1e272e"} 
            strokeWidth={isRoofActive ? "1.5" : "0"} 
          />
        </g>

        {/* Soffits & Trim Accent Line */}
        <line x1="180" y1="180" x2="620" y2="180" stroke="#cbd5e1" strokeWidth="4" />

        {/* Windows */}
        <g 
          onClick={() => onSelectCategory("Exterior - Windows")}
          className={`cursor-pointer transition-all duration-300 ${isWindowActive ? "filter brightness-125" : ""}`}
        >
          {/* Left Gable Window */}
          <rect 
            x="255" 
            y="200" 
            width="30" 
            height="45" 
            fill="#dbeafe" 
            stroke={colors.windows} 
            strokeWidth={isWindowActive ? "3" : "2.5"} 
          />
          <line x1="270" y1="200" x2="270" y2="245" stroke={colors.windows} strokeWidth="1.5" />
          <line x1="255" y1="222" x2="285" y2="222" stroke={colors.windows} strokeWidth="1.5" />

          {/* Right Gable Window */}
          <rect 
            x="515" 
            y="200" 
            width="30" 
            height="45" 
            fill="#dbeafe" 
            stroke={colors.windows} 
            strokeWidth={isWindowActive ? "3" : "2.5"} 
          />
          <line x1="530" y1="200" x2="530" y2="245" stroke={colors.windows} strokeWidth="1.5" />
          <line x1="515" y1="222" x2="545" y2="222" stroke={colors.windows} strokeWidth="1.5" />

          {/* Bottom Left Large Window */}
          <rect 
            x="220" 
            y="290" 
            width="80" 
            height="70" 
            fill="#dbeafe" 
            stroke={colors.windows} 
            strokeWidth={isWindowActive ? "3" : "2.5"} 
          />
          <line x1="260" y1="290" x2="260" y2="360" stroke={colors.windows} strokeWidth="1.5" />
          <line x1="220" y1="325" x2="300" y2="325" stroke={colors.windows} strokeWidth="1.5" />
          <rect x="225" y="295" width="30" height="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
          <rect x="265" y="295" width="30" height="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />

          {/* Bottom Right Large Window */}
          <rect 
            x="500" 
            y="290" 
            width="80" 
            height="70" 
            fill="#dbeafe" 
            stroke={colors.windows} 
            strokeWidth={isWindowActive ? "3" : "2.5"} 
          />
          <line x1="540" y1="290" x2="540" y2="360" stroke={colors.windows} strokeWidth="1.5" />
          <line x1="500" y1="325" x2="580" y2="325" stroke={colors.windows} strokeWidth="1.5" />
          <rect x="505" y="295" width="30" height="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
          <rect x="545" y="295" width="30" height="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
        </g>

        {/* Front Entry Door */}
        <g 
          onClick={() => onSelectCategory("Exterior - Main Entry Doors")}
          className={`cursor-pointer transition-all duration-300 ${isDoorActive ? "filter drop-shadow-md brightness-110" : ""}`}
        >
          {/* Frame */}
          <rect x="388" y="336" width="24" height="104" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          {/* Door leaf */}
          <rect 
            x="390" 
            y="338" 
            width="20" 
            height="102" 
            fill={colors.door} 
            stroke={isDoorActive ? "var(--accent)" : "none"} 
            strokeWidth={isDoorActive ? "2.5" : "0"} 
          />
          {/* Windows inside door */}
          <rect x="394" y="348" width="12" height="20" fill="#eff6ff" opacity="0.8" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
          <line x1="400" y1="348" x2="400" y2="368" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
          
          {/* Door Handle */}
          <circle cx="393" cy="390" r="1.5" fill="#f5cd79" stroke="#e67e22" strokeWidth="0.5" />
        </g>

        {/* Labels overlay (Dynamic Legend) */}
        <g transform="translate(20, 465)" fontSize="11" fill="var(--text-muted)">
          <rect x="0" y="0" width="760" height="25" rx="4" fill="var(--surface-muted)" stroke="var(--border)" strokeWidth="0.5" />
          
          <circle cx="15" cy="12" r="5" fill={colors.roof} />
          <text x="25" y="15" fill="var(--text)">Roofing</text>

          <circle cx="150" cy="12" r="5" fill={colors.siding} stroke="#cbd5e1" strokeWidth="1" />
          <text x="160" y="15" fill="var(--text)">Siding</text>

          <circle cx="280" cy="12" r="5" fill={colors.door} />
          <text x="290" y="15" fill="var(--text)">Entry Door</text>

          <circle cx="430" cy="12" r="5" fill="#dbeafe" stroke={colors.windows} strokeWidth="1" />
          <text x="440" y="15" fill="var(--text)">Windows</text>

          <text x="590" y="15" fontStyle="italic">Click parts of the house to select materials</text>
        </g>
      </svg>
    );
  };

  // Craftsman Cottage SVG
  const renderCraftsmanSVG = () => {
    const colors = resolvedColors;
    const isRoofActive = activeCategoryKey === "Exterior - Roofing";
    const isSidingActive = activeCategoryKey === "Exterior - Siding & Exterior Finishes";
    const isDoorActive = activeCategoryKey === "Exterior - Main Entry Doors";
    const isWindowActive = activeCategoryKey === "Exterior - Windows";

    return (
      <svg viewBox="0 0 800 500" className="w-full h-full select-none" style={{ background: "#fcfbfa" }}>
        <defs>
          <linearGradient id="craftRoof" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.roof} />
            <stop offset="100%" stopColor={colors.roof} stopOpacity={0.85} />
          </linearGradient>
          <pattern id="brickPattern" width="20" height="10" patternUnits="userSpaceOnUse">
            <rect width="20" height="10" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            <line x1="10" y1="0" x2="10" y2="10" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="800" height="500" fill="#f1f2f6" opacity="0.5" />
        <path d="M 0,450 L 800,450 L 800,500 L 0,500 Z" fill="#dfe4ea" />

        {/* Siding Base */}
        <g 
          onClick={() => onSelectCategory("Exterior - Siding & Exterior Finishes")}
          className="cursor-pointer"
        >
          <rect 
            x="200" 
            y="220" 
            width="400" 
            height="230" 
            fill={colors.siding} 
            stroke={isSidingActive ? "var(--accent)" : "#a4b0be"} 
            strokeWidth={isSidingActive ? "3" : "1.5"} 
          />
          {/* Accent Brick Pillars base */}
          <rect x="230" y="340" width="40" height="110" fill="#cd6133" stroke="#b33939" />
          <rect x="230" y="340" width="40" height="110" fill="url(#brickPattern)" />
          <rect x="530" y="340" width="40" height="110" fill="#cd6133" stroke="#b33939" />
          <rect x="530" y="340" width="40" height="110" fill="url(#brickPattern)" />
        </g>

        {/* Roof Gable */}
        <g 
          onClick={() => onSelectCategory("Exterior - Roofing")}
          className="cursor-pointer"
        >
          <polygon 
            points="160,230 400,100 640,230" 
            fill="url(#craftRoof)" 
            stroke={isRoofActive ? "var(--accent)" : "#2f3542"} 
            strokeWidth={isRoofActive ? "3" : "1.5"} 
          />
          <polygon 
            points="220,220 400,120 580,220" 
            fill="none" 
            stroke="#ffffff" 
            strokeWidth="3" 
          />
        </g>

        {/* Pillars upper part */}
        <polygon points="240,260 260,260 265,340 235,340" fill="#ffffff" stroke="#ced6e0" />
        <polygon points="540,260 560,260 565,340 535,340" fill="#ffffff" stroke="#ced6e0" />

        {/* Windows */}
        <g 
          onClick={() => onSelectCategory("Exterior - Windows")}
          className="cursor-pointer"
        >
          {/* Center Triple Window */}
          <rect 
            x="350" 
            y="240" 
            width="100" 
            height="70" 
            fill="#eccc68" 
            opacity="0.4" 
            stroke={colors.windows} 
            strokeWidth={isWindowActive ? "3" : "2"} 
          />
          <line x1="383" y1="240" x2="383" y2="310" stroke={colors.windows} strokeWidth="1.5" />
          <line x1="416" y1="240" x2="416" y2="310" stroke={colors.windows} strokeWidth="1.5" />
          <line x1="350" y1="275" x2="450" y2="275" stroke={colors.windows} strokeWidth="1.5" />
        </g>

        {/* Front Door */}
        <g 
          onClick={() => onSelectCategory("Exterior - Main Entry Doors")}
          className="cursor-pointer"
        >
          <rect 
            x="480" 
            y="310" 
            width="35" 
            height="140" 
            fill={colors.door} 
            stroke={isDoorActive ? "var(--accent)" : "#2f3542"} 
            strokeWidth={isDoorActive ? "2.5" : "1"} 
          />
          {/* Top glass grid on door */}
          <rect x="485" y="320" width="25" height="30" fill="#ffffff" opacity="0.8" stroke="rgba(0,0,0,0.2)" />
          <line x1="492" y1="320" x2="492" y2="350" stroke="rgba(0,0,0,0.2)" />
          <line x1="500" y1="320" x2="500" y2="350" stroke="rgba(0,0,0,0.2)" />
          <circle cx="510" cy="380" r="2" fill="#ffa502" />
        </g>

        <text x="400" y="480" textAnchor="middle" fill="var(--text-muted)" fontSize="12">
          Craftsman Archetype · Interactive SVG
        </text>
      </svg>
    );
  };

  // Render active selection badge/banner
  const renderSelectionBanner = (categoryKey: string, name: string) => {
    const selection = getSelectionForCategory(categoryKey);
    if (!selection) return null;

    return (
      <div className="visualizer-selection-pill" key={categoryKey}>
        <CheckCircle size={14} className="text-emerald" />
        <span className="label">{name}:</span>
        <strong className="value">
          {selection.manufacturer} {selection.model}
        </strong>
      </div>
    );
  };

  return (
    <div className="card blueprint-visualizer-container" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Settings size={18} className="text-accent" />
          <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Interactive Visualizer</h3>
        </div>

        <div className="btn-group" style={{ display: "flex", gap: "4px", background: "var(--bg)", padding: "2px", borderRadius: "8px" }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "archetype" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", borderRadius: "6px" }}
            onClick={() => setViewMode("archetype")}
          >
            SVG Shapes
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "custom" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", borderRadius: "6px" }}
            onClick={() => setViewMode("custom")}
          >
            Custom Blueprint
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "ai" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", borderRadius: "6px" }}
            onClick={() => setViewMode("ai")}
          >
            ✨ AI Render
          </button>
        </div>
      </div>

      {/* Sub controls depending on mode */}
      {viewMode === "archetype" && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Choose House Shape:</span>
          {ARCHETYPES.map((arch) => (
            <button
              key={arch.id}
              type="button"
              className={`btn btn-sm ${selectedArchetype === arch.id ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              onClick={() => setSelectedArchetype(arch.id)}
            >
              {arch.name}
            </button>
          ))}
        </div>
      )}

      {viewMode === "custom" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} /> Upload Elevation
            </button>

            {uploadedImage && (
              <button
                type="button"
                className={`btn btn-sm ${isBuilderMode ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => setIsBuilderMode(!isBuilderMode)}
              >
                {isBuilderMode ? <Eye size={14} /> : <Edit3 size={14} />}
                {isBuilderMode ? "Exit Hotspot Editor" : "Setup Hotspots"}
              </button>
            )}
          </div>

          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {isBuilderMode ? "Click on the blueprint to place a selection hotspot pin." : "Click a pin to navigate to that slot."}
          </span>
        </div>
      )}

      {viewMode === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
              {AI_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={`btn btn-sm ${selectedTheme === theme.id ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
                  onClick={() => {
                    setSelectedTheme(theme.id);
                    if (aiRenderUrl && uploadedImage) {
                      handleGenerateAiRender(theme.id);
                    }
                  }}
                >
                  {theme.label}
                </button>
              ))}
            </div>

            {uploadedImage && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4, background: "var(--accent)" }}
                onClick={() => handleGenerateAiRender(selectedTheme)}
                disabled={isGenerating}
              >
                <Sparkles size={14} /> {aiRenderUrl ? "Re-Generate" : "Generate Render"}
              </button>
            )}
          </div>

          {!uploadedImage && (
            <div className="alert-box" style={{ background: "var(--accent-glow)", border: "1px solid var(--accent)", color: "var(--text)", fontSize: "0.8rem", padding: "0.75rem", borderRadius: "8px", display: "flex", gap: 8, alignItems: "center" }}>
              <Info size={16} className="text-accent" style={{ flexShrink: 0 }} />
              <div>
                Please upload a black-and-white custom design elevation sketch in the <strong>Custom Blueprint</strong> tab first before generating the AI render.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main visualizer area */}
      <div 
        ref={containerRef}
        onClick={handleContainerClick}
        style={{
          width: "100%",
          position: "relative",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "#fdfdfd",
          minHeight: "300px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isBuilderMode && viewMode === "custom" ? "crosshair" : "default"
        }}
      >
        {isGenerating && (
          <div 
            style={{ 
              position: "absolute", 
              inset: 0, 
              background: "rgba(15, 62, 32, 0.85)", 
              backdropFilter: "blur(4px)",
              zIndex: 30, 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center",
              color: "#fff",
              gap: "1rem",
              padding: "2rem",
              textAlign: "center"
            }}
          >
            <Loader2 className="animate-spin text-accent" size={36} style={{ color: "var(--accent)" }} />
            <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>Painting Lifelike Representation...</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.8, maxWidth: "280px" }}>
              Gemini 1.5 is analyzing house geometry and applying shingles, siding, and finishes via Imagen 3. This takes about 3 seconds.
            </div>
          </div>
        )}

        {viewMode === "archetype" && (
          selectedArchetype === "farmhouse" ? (
            renderFarmhouseSVG()
          ) : (
            renderCraftsmanSVG()
          )
        )}

        {viewMode === "custom" && (
          <div style={{ width: "100%", position: "relative" }}>
            <img
              src={uploadedImage || DEFAULT_BLUEPRINT_URL}
              alt="Blueprint Design"
              style={{ width: "100%", display: "block", pointerEvents: "none" }}
            />

            {/* Custom Hotspots Layer */}
            {hotspots.map((hs) => {
              const selection = getSelectionForCategory(hs.categoryKey);
              const isActive = activeCategoryKey === hs.categoryKey;
              return (
                <div
                  key={hs.id}
                  className={`hotspot-pin ${isActive ? "active" : ""}`}
                  style={{
                    position: "absolute",
                    left: `${hs.x}%`,
                    top: `${hs.y}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 10,
                  }}
                >
                  {/* Pin Circle */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isBuilderMode) {
                        setSelectedHotspotId(hs.id);
                      } else {
                        onSelectCategory(hs.categoryKey);
                      }
                    }}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: selection ? "var(--primary-emerald)" : "var(--accent)",
                      border: isActive ? "3px solid #ffffff" : "2px solid #ffffff",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: "bold",
                      transition: "transform 0.2s",
                    }}
                    className="hover-scale"
                    title={hs.label}
                  >
                    {selection ? "✓" : "?"}
                  </div>

                  {/* Hotspot label tooltip */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "30px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(11, 34, 20, 0.95)",
                      color: "#fff",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      pointerEvents: "none",
                      display: isActive || selectedHotspotId === hs.id ? "block" : "none",
                    }}
                  >
                    <div style={{ fontWeight: "bold" }}>{hs.label}</div>
                    {selection ? (
                      <div style={{ fontSize: "0.65rem", color: "var(--accent)" }}>
                        {selection.manufacturer} {selection.model}
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.65rem", color: "#ccc" }}>No selection</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "ai" && (
          <div style={{ width: "100%", height: "100%", minHeight: "300px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {aiRenderUrl ? (
              <div style={{ width: "100%" }}>
                <img
                  src={aiRenderUrl}
                  alt="AI Generated Lifelike House Rendering"
                  style={{ width: "100%", display: "block", borderRadius: "var(--radius-sm)" }}
                />
                <div style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "0.65rem", display: "flex", alignItems: "center", gap: 4 }}>
                  <Sparkles size={10} className="text-accent" /> Imagen 3 Photorealistic
                </div>
              </div>
            ) : (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                <ImageIcon size={48} className="text-accent" style={{ opacity: 0.5 }} />
                <h4>No AI Rendering Generated Yet</h4>
                <p style={{ fontSize: "0.85rem", maxWidth: "340px" }}>
                  Upload a sketch in the <strong>Custom Blueprint</strong> tab, make your exterior selections, and click <strong>Generate Render</strong> above to see a stunning, photorealistic scene of the home.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor drawer for selected hotspot (Builder mode only) */}
      {isBuilderMode && viewMode === "custom" && selectedHotspotId && (
        <div 
          className="card" 
          style={{ 
            background: "var(--surface-muted)", 
            padding: "1rem", 
            border: "1px solid var(--accent)", 
            display: "flex", 
            flexDirection: "column", 
            gap: "0.75rem" 
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={16} /> Configure Hotspot
            </h4>
            <button
              type="button"
              className="btn btn-secondary btn-sm text-danger"
              style={{ padding: "2px 6px", fontSize: "0.75rem" }}
              onClick={() => deleteHotspot(selectedHotspotId)}
            >
              <Trash2 size={12} style={{ marginRight: 4 }} /> Delete Pin
            </button>
          </div>

          {(() => {
            const hs = hotspots.find((h) => h.id === selectedHotspotId);
            if (!hs) return null;
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: "0.75rem", marginBottom: "2px" }}>Link to Category Slot</label>
                  <select
                    value={hs.categoryKey}
                    onChange={(e) => updateHotspot(hs.id, { categoryKey: e.target.value })}
                    style={{ fontSize: "0.85rem", padding: "0.3rem", width: "100%" }}
                  >
                    {AVAILABLE_HOTSPOT_CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Coordinates: X: {hs.x}%, Y: {hs.y}%
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Generation error display */}
      {generationError && (
        <div className="alert" style={{ background: "rgba(185, 28, 28, 0.08)", border: "1px solid var(--danger)", color: "var(--danger)", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.8rem" }}>
          <strong>Rendering Error:</strong> {generationError}
          <div style={{ marginTop: "4px", fontSize: "0.75rem", opacity: 0.9 }}>
            Verify that your backend has `GEMINI_API_KEY` configured in `.env` and you have run the backend server (`npm run dev:api`).
          </div>
        </div>
      )}

      {/* AI Prompt Details Trace Panel */}
      {viewMode === "ai" && aiPrompt && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ width: "100%", padding: "6px 12px", background: "var(--surface-muted)", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem" }}
            onClick={() => setShowPromptDetails(!showPromptDetails)}
          >
            <span>✨ View Gemini-Synthesized Painting Prompt</span>
            <span>{showPromptDetails ? "Hide" : "Show"}</span>
          </button>
          {showPromptDetails && (
            <div style={{ padding: "0.75rem", background: "var(--surface)", fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", lineHeight: 1.4 }}>
              {aiPrompt}
            </div>
          )}
        </div>
      )}

      {/* Active Selections Summary Panel */}
      <div 
        style={{ 
          background: "var(--surface-muted)", 
          padding: "1rem", 
          borderRadius: "var(--radius-sm)", 
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-emerald)", borderBottom: "1px solid var(--border)", paddingBottom: "0.3rem" }}>
          <Info size={14} /> Current Exterior Configuration
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1rem", fontSize: "0.8rem" }}>
          {renderSelectionBanner("Exterior - Roofing", "Roofing")}
          {renderSelectionBanner("Exterior - Siding & Exterior Finishes", "Siding")}
          {renderSelectionBanner("Exterior - Main Entry Doors", "Entry Door")}
          {renderSelectionBanner("Exterior - Windows", "Windows")}
        </div>
      </div>
    </div>
  );
}
