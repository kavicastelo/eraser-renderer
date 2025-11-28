let ctx: CanvasRenderingContext2D | null = null;

export function measureText(text: string, font: string): { width: number; height: number } {
    if (typeof document === 'undefined') return { width: text.length * 8, height: 16 };

    if (!ctx) {
        const canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
    }
    if (!ctx) return { width: 0, height: 0 };

    ctx.font = font;
    const metrics = ctx.measureText(text);

    // Height approximation based on font size (usually 1.2x to 1.5x)
    const fontSize = parseInt(font.match(/\d+/)?.[0] || '14', 10);

    return {
        width: metrics.width,
        height: fontSize * 1.5
    };
}
