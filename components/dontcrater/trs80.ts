/*
 * A small model of a 1979 home-computer screen: 64 × 16 characters, where
 * codes 128–191 are 2 × 3 blocks of "pixels" (128 × 48 in all). Printing
 * understands the cursor codes the old BASICs used for drawing: 24 = left,
 * 25 = right, 26 = down, 27 = up, 13 = new line.
 */

export const COLS = 64;
export const ROWS = 16;

export class Trs80 {
  cells = new Uint8Array(COLS * ROWS).fill(32);
  /** 32-column mode: every character is twice as wide (only even columns show). */
  wide = false;
  cursor = 0;

  cls() {
    this.cells.fill(32);
    this.cursor = 0;
    this.wide = false;
  }

  at(pos: number) {
    this.cursor = Math.max(0, Math.min(COLS * ROWS - 1, pos));
    return this;
  }

  print(text: string, pos?: number) {
    if (pos !== undefined) this.at(pos);
    const step = this.wide ? 2 : 1;
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      if (c === 13 || c === 10) this.cursor = (Math.floor(this.cursor / COLS) + 1) * COLS;
      else if (c === 24) this.cursor -= 1;
      else if (c === 25) this.cursor += 1;
      else if (c === 26) this.cursor += COLS;
      else if (c === 27) this.cursor -= COLS;
      else {
        if (this.cursor >= 0 && this.cursor < this.cells.length) this.cells[this.cursor] = c;
        this.cursor += step;
      }
      if (this.cursor >= this.cells.length) {
        // Scroll up a line, as the real screen did.
        this.cells.copyWithin(0, COLS);
        this.cells.fill(32, this.cells.length - COLS);
        this.cursor -= COLS;
      }
    }
    return this;
  }

  /** Blank a run of characters. */
  clear(pos: number, len: number) {
    this.cells.fill(32, pos, Math.min(this.cells.length, pos + len));
  }

  setPixel(x: number, y: number, on = true) {
    if (x < 0 || y < 0 || x >= COLS * 2 || y >= ROWS * 3) return;
    const i = Math.floor(y / 3) * COLS + Math.floor(x / 2);
    const bit = 1 << ((y % 3) * 2 + (x % 2));
    let code = this.cells[i] >= 128 ? this.cells[i] : 128;
    code = on ? code | bit : code & ~bit;
    this.cells[i] = code;
  }

  /** Stamps a sprite drawn as rows of '#' and '.' with its top-left pixel at (x, y). */
  sprite(rows: string[], x: number, y: number, erase = false) {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) if (row[dx] === "#") this.setPixel(x + dx, y + dy, !erase);
    });
  }

  /** Clears the pixels of a rectangle (in pixels). */
  wipe(x: number, y: number, w: number, h: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.setPixel(xx, yy, false);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, font: string, color: string, glow: string) {
    const cw = w / COLS;
    const ch = h / ROWS;
    ctx.fillStyle = "#05070b";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.shadowColor = glow;
    ctx.shadowBlur = cw * 0.9;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const step = this.wide ? 2 : 1;
    ctx.font = `${Math.round(ch * 0.96)}px ${font}`;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c += step) {
        const code = this.cells[r * COLS + c];
        if (code === 32) continue;
        const x = c * cw;
        const y = r * ch;
        if (code >= 128) {
          const bw = (cw * step) / 2;
          const bh = ch / 3;
          for (let b = 0; b < 6; b++) if (code & (1 << b)) ctx.fillRect(x + (b % 2) * bw, y + Math.floor(b / 2) * bh, bw + 0.3, bh + 0.3);
        } else {
          ctx.save();
          ctx.translate(x + (cw * step) / 2, y + ch * 0.54);
          ctx.scale(step * 1.18, 1);
          ctx.fillText(String.fromCharCode(code), 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.shadowBlur = 0;
  }
}

/** BASIC-style numbers: a leading space for positives, no leading zero, up to 7 digits. */
export function basicNumber(x: number) {
  const sign = x < 0 ? "-" : " ";
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e7 || a < 0.01)) return sign + a.toExponential(5).replace(/\.?0+e/, "E").toUpperCase();
  let s = Number(a.toPrecision(7)).toString();
  if (s.startsWith("0.")) s = s.slice(1);
  return sign + s;
}
