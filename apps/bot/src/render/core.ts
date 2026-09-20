import { createCanvas, Canvas, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';

// 封裝核心繪圖方法
export class RenderCore {
    private canvas: Canvas;
    private ctx: any;

    constructor(width: number, height: number) {
        this.canvas = createCanvas(width, height);
        this.ctx = this.canvas.getContext('2d');
    }

    // 取得上下文
    public getContext(): any {
        return this.ctx;
    }

    // 取得畫布
    public getCanvas(): Canvas {
        return this.canvas;
    }

    // 載入字體
    public static loadFont(fontPath: string, family: string): void {
        GlobalFonts.registerFromPath(fontPath, family);
    }

    // 繪製圓角矩形
    public drawRoundedRect(x: number, y: number, width: number, height: number, radius: number | number[], fillColor?: string, strokeColor?: string, lineWidth?: number): void {
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, radius);
        
        if (fillColor) {
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();
        }
        
        if (strokeColor) {
            this.ctx.strokeStyle = strokeColor;
            if (lineWidth) this.ctx.lineWidth = lineWidth;
            this.ctx.stroke();
        }
    }

    // 繪製文字
    public drawText(text: string, x: number, y: number, font: string, color: string, align: any = 'left', baseline: any = 'alphabetic'): void {
        this.ctx.font = font;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = baseline;
        this.ctx.fillText(text, x, y);
    }
    
    // 設定陰影
    public setShadow(color: string, blur: number, offsetX: number = 0, offsetY: number = 0): void {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = blur;
        this.ctx.shadowOffsetX = offsetX;
        this.ctx.shadowOffsetY = offsetY;
    }
    
    // 清除陰影
    public clearShadow(): void {
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }

    // 建立線性漸層
    public createLinearGradient(x0: number, y0: number, x1: number, y1: number, colorStops: { offset: number, color: string }[]): any {
        const gradient = this.ctx.createLinearGradient(x0, y0, x1, y1);
        colorStops.forEach(stop => {
            gradient.addColorStop(stop.offset, stop.color);
        });
        return gradient;
    }

    // 輸出至檔案
    public async saveToFile(filePath: string): Promise<void> {
        const buffer = this.canvas.toBuffer('image/png');
        fs.writeFileSync(filePath, buffer);
    }
}
