// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export type ColorMode = 'pastel' | 'solid' | 'outline';

export interface ColorDefinition {
    bg: string;
    fg: string;
    border: string;
}

export const DEFAULT_COLOR = 'gray';

// ------------------------------------------------------------
// Named Color Palette (Light mode only — dark mode is generated)
// ------------------------------------------------------------
const PALETTE: Record<string, Record<ColorMode, ColorDefinition>> = {
    blue: {
        pastel: { bg: '#EBF5FF', fg: '#1E40AF', border: '#BFDBFE' },
        solid:  { bg: '#3B82F6', fg: '#FFFFFF', border: '#2563EB' },
        outline:{ bg: '#FFFFFF', fg: '#2563EB', border: '#2563EB' },
    },
    green: {
        pastel: { bg: '#F0FDF4', fg: '#166534', border: '#BBF7D0' },
        solid:  { bg: '#22C55E', fg: '#FFFFFF', border: '#16A34A' },
        outline:{ bg: '#FFFFFF', fg: '#16A34A', border: '#16A34A' },
    },
    red: {
        pastel: { bg: '#FEF2F2', fg: '#991B1B', border: '#FECACA' },
        solid:  { bg: '#EF4444', fg: '#FFFFFF', border: '#DC2626' },
        outline:{ bg: '#FFFFFF', fg: '#DC2626', border: '#DC2626' },
    },
    orange: {
        pastel: { bg: '#FFF7ED', fg: '#9A3412', border: '#FED7AA' },
        solid:  { bg: '#F97316', fg: '#FFFFFF', border: '#EA580C' },
        outline:{ bg: '#FFFFFF', fg: '#EA580C', border: '#EA580C' },
    },
    yellow: {
        pastel: { bg: '#FEFCE8', fg: '#854D0E', border: '#FEF08A' },
        solid:  { bg: '#EAB308', fg: '#FFFFFF', border: '#CA8A04' },
        outline:{ bg: '#FFFFFF', fg: '#CA8A04', border: '#CA8A04' },
    },
    purple: {
        pastel: { bg: '#FAF5FF', fg: '#6B21A8', border: '#E9D5FF' },
        solid:  { bg: '#A855F7', fg: '#FFFFFF', border: '#9333EA' },
        outline:{ bg: '#FFFFFF', fg: '#9333EA', border: '#9333EA' },
    },
    gray: {
        pastel: { bg: '#F3F4F6', fg: '#374151', border: '#D1D5DB' },
        solid:  { bg: '#6B7280', fg: '#FFFFFF', border: '#4B5563' },
        outline:{ bg: '#FFFFFF', fg: '#4B5563', border: '#4B5563' },
    },
    neutral: {
        pastel: { bg: '#FFFFFF', fg: '#111827', border: '#D1D5DB' },
        solid:  { bg: '#1F2937', fg: '#FFFFFF', border: '#000000' },
        outline:{ bg: '#FFFFFF', fg: '#1F2937', border: '#1F2937' },
    }
};

// ------------------------------------------------------------
// Public resolver
// ------------------------------------------------------------
export function resolveColor(
    colorName: string | undefined,
    mode: ColorMode,
    theme: "light" | "dark"
): ColorDefinition {
    const key = colorName?.toLowerCase();

    // Named color
    if (key && PALETTE[key]) {
        return adjustForTheme(PALETTE[key][mode], theme);
    }

    // Custom hex
    if (key && isHexColor(key)) {
        const shades = generateShadesFromHex(key, mode);
        return adjustForTheme(shades, theme);
    }

    // Default fallback
    return adjustForTheme(PALETTE[DEFAULT_COLOR][mode], theme);
}

// ------------------------------------------------------------
// Dark Mode HSL Auto-Transform
// ------------------------------------------------------------
function adjustForTheme(def: ColorDefinition, theme: "light" | "dark"): ColorDefinition {
    if (theme === "light") return def;

    // auto-generate dark equivalents using HSL
    const bg = shiftToDark(def.bg, { targetL: 0.15, blend: 0.65 });
    const border = shiftToDark(def.border, { targetL: 0.25, blend: 0.5 });
    const fg = ensureReadableFg(def.fg, bg);

    return { bg, fg, border };
}

function shiftToDark(hex: string, opts: { targetL: number; blend: number }): string {
    const { h, s, l } = hexToHsl(normalizeHex(hex));
    const newL = l * (1 - opts.blend) + opts.targetL * opts.blend;
    return hslToHex(h, s, clamp01(newL));
}

function ensureReadableFg(fgHex: string, bgHex: string): string {
    const minRatio = 4.5;
    if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;

    const white = contrastRatio("#FFFFFF", bgHex);
    const black = contrastRatio("#000000", bgHex);

    return white >= black ? "#FFFFFF" : "#000000";
}

// ------------------------------------------------------------
// Shade generator for custom hex colors
// ------------------------------------------------------------
function generateShadesFromHex(hex: string, mode: ColorMode): ColorDefinition {
    const base = normalizeHex(hex);
    const rgb = hexToRgb(base);
    if (!rgb) return PALETTE[DEFAULT_COLOR][mode];

    const { r, g, b } = rgb;

    if (mode === 'solid') {
        return {
            bg: rgbToHex(r, g, b),
            fg: getContrastColor(r, g, b),
            border: rgbToHex(Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40))
        };
    }

    if (mode === 'pastel') {
        return {
            bg: rgbToHex(mix(r, 255, 0.75), mix(g, 255, 0.75), mix(b, 255, 0.75)),
            fg: rgbToHex(r, g, b),
            border: rgbToHex(mix(r, 200, 0.5), mix(g, 200, 0.5), mix(b, 200, 0.5)),
        };
    }

    return {
        bg: '#FFFFFF',
        fg: rgbToHex(r, g, b),
        border: rgbToHex(r, g, b),
    };
}

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------
function isHexColor(str: string): boolean {
    return /^#?[0-9a-f]{3,8}$/i.test(str);
}

function normalizeHex(hex: string): string {
    hex = hex.replace('#', '');
    if (hex.length === 3) return hex[0]+hex[0] + hex[1]+hex[1] + hex[2]+hex[2];
    if (hex.length === 6) return hex;
    if (hex.length === 8) return hex.substring(0, 6);
    return hex.padEnd(6, '0');
}

function hexToRgb(hex: string) {
    if (hex.length !== 6) return null;
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function mix(a: number, b: number, ratio: number): number {
    return Math.round(a * (1 - ratio) + b * ratio);
}

function getContrastColor(r: number, g: number, b: number): string {
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#FFFFFF';
}

// ------------------------------------------------------------
// Contrast & HSL functions
// ------------------------------------------------------------
function contrastRatio(hex1: string, hex2: string): number {
    const L1 = relLuminance(hexToRgb(normalizeHex(hex1))!);
    const L2 = relLuminance(hexToRgb(normalizeHex(hex2))!);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
}

function relLuminance({ r, g, b }: { r: number; g: number; b: number }) {
    const srgb = [r, g, b].map(v =>
        (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function hexToHsl(hex: string) {
    const { r, g, b } = hexToRgb(hex)!;
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === rNorm)      h = ((gNorm - bNorm) / delta) % 6;
        else if (max === gNorm) h = (bNorm - rNorm) / delta + 2;
        else                    h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r=0, g=0, b=0;
    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }

    return rgbToHex(
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    );
}

function clamp01(n: number) {
    return Math.min(1, Math.max(0, n));
}
