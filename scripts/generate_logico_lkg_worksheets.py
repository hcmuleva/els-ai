#!/usr/bin/env python3
"""Generate three Logico Piccolo-style worksheets for LKG.

Layout follows the reference samples in dump/downloades/logico-piccolo:
  - Yellow title strip across the top.
  - Main worksheet card on the left with 10 question rows.
  - Right column with 10 numbered answer slots.
  - Each row pairs a coloured "button" on the left with a target on the right;
    the answer slots show the matching answer for the row in the same colour.
Outputs three PNGs under dump/downloades/logico-piccolo/LKG/.
"""
from __future__ import annotations

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path("/Users/Harish.Muleva/personal/els-ai/dump/downloades/logico-piccolo/LKG")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = 1000, 1300
MARGIN = 40
TITLE_H = 80
ANSWER_W = 180
SLOT_COUNT = 10

WHITE = (255, 255, 255)
BLACK = (20, 20, 20)
TITLE_BG = (255, 213, 79)
TITLE_BORDER = (60, 60, 60)
GRID_BORDER = (40, 40, 40)
SOFT_BG = (255, 255, 255)
ROW_LINE = (60, 60, 60)

PALETTE = {
    "red": (224, 60, 49),
    "blue": (47, 116, 214),
    "yellow": (245, 200, 38),
    "green": (66, 168, 80),
    "orange": (240, 142, 38),
    "purple": (138, 80, 180),
    "pink": (236, 116, 158),
    "brown": (140, 96, 60),
    "black": (30, 30, 30),
    "white": (250, 250, 250),
}


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_title_bar(draw: ImageDraw.ImageDraw, title: str) -> None:
    draw.rectangle([MARGIN, MARGIN, PAGE_W - MARGIN, MARGIN + TITLE_H], fill=TITLE_BG, outline=TITLE_BORDER, width=3)
    title_font = load_font(34, bold=True)
    text_y = MARGIN + (TITLE_H - 34) // 2 - 2
    draw.text((MARGIN + 24, text_y), title, fill=BLACK, font=title_font)


def filled_circle(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: tuple) -> None:
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color, outline=BLACK, width=3)


def ring_circle(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: tuple) -> None:
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color, outline=BLACK, width=3)
    inner = max(4, int(r * 0.42))
    draw.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=WHITE, outline=(140, 140, 140), width=2)


def draw_card_frame(draw: ImageDraw.ImageDraw, top: int, bottom: int, right: int) -> None:
    draw.rectangle([MARGIN, top, right, bottom], outline=GRID_BORDER, width=3, fill=SOFT_BG)


def draw_answer_column(draw: ImageDraw.ImageDraw, top: int, bottom: int, render_slot) -> None:
    col_left = PAGE_W - MARGIN - ANSWER_W
    draw.rectangle([col_left, top, PAGE_W - MARGIN, bottom], outline=GRID_BORDER, width=3, fill=WHITE)
    slot_h = (bottom - top) / SLOT_COUNT
    for i in range(SLOT_COUNT):
        y0 = int(top + slot_h * i)
        y1 = int(top + slot_h * (i + 1))
        if i > 0:
            draw.line([col_left, y0, PAGE_W - MARGIN, y0], fill=ROW_LINE, width=2)
        cx = (col_left + PAGE_W - MARGIN) // 2
        cy = (y0 + y1) // 2
        render_slot(draw, i, cx, cy, slot_h)


def draw_question_rows(draw: ImageDraw.ImageDraw, top: int, bottom: int, render_row) -> None:
    card_left = MARGIN
    card_right = PAGE_W - MARGIN - ANSWER_W - 20
    draw_card_frame(draw, top, bottom, card_right)
    row_h = (bottom - top) / SLOT_COUNT
    for i in range(SLOT_COUNT):
        y0 = int(top + row_h * i)
        y1 = int(top + row_h * (i + 1))
        if i > 0:
            draw.line([card_left, y0, card_right, y0], fill=(220, 220, 220), width=1)
        render_row(draw, i, card_left + 20, card_right - 20, y0, y1, row_h)


def draw_footer(draw: ImageDraw.ImageDraw) -> None:
    footer_font = load_font(16, bold=False)
    draw.text((MARGIN + 6, PAGE_H - MARGIN + 4), "LOGICO PICCOLO — LKG", fill=(80, 80, 80), font=footer_font)


def common_canvas() -> tuple[Image.Image, ImageDraw.ImageDraw, int, int]:
    img = Image.new("RGB", (PAGE_W, PAGE_H), WHITE)
    draw = ImageDraw.Draw(img)
    top = MARGIN + TITLE_H + 24
    bottom = PAGE_H - MARGIN - 30
    return img, draw, top, bottom


# ── Worksheet 1: Color Mixing ────────────────────────────────────────────────
COLOR_MIX_QUESTIONS = [
    ("red", "blue", "purple"),
    ("yellow", "blue", "green"),
    ("red", "yellow", "orange"),
    ("blue", "white", "blue"),
    ("red", "white", "pink"),
    ("yellow", "red", "orange"),
    ("blue", "yellow", "green"),
    ("red", "blue", "purple"),
    ("yellow", "blue", "green"),
    ("red", "yellow", "orange"),
]


def worksheet_color_mixing(path: Path) -> None:
    img, draw, top, bottom = common_canvas()
    draw_title_bar(draw, "Color Mixing — Tap the matching color")

    answer_colors = [PALETTE[q[2]] for q in COLOR_MIX_QUESTIONS]

    def render_row(d, i, lx, rx, y0, y1, rh):
        cy = (y0 + y1) // 2
        radius = int(rh * 0.32)
        c1 = PALETTE[COLOR_MIX_QUESTIONS[i][0]]
        c2 = PALETTE[COLOR_MIX_QUESTIONS[i][1]]
        cx1 = lx + radius + 10
        cx2 = cx1 + radius * 2 + 60
        plus_x = (cx1 + cx2) // 2
        eq_x = cx2 + radius + 80
        font_op = load_font(40, bold=True)
        font_eq = load_font(40, bold=True)
        filled_circle(d, cx1, cy, radius, c1)
        d.text((plus_x - 10, cy - 28), "+", fill=BLACK, font=font_op)
        filled_circle(d, cx2, cy, radius, c2)
        d.text((eq_x - 14, cy - 28), "=", fill=BLACK, font=font_eq)
        slot_x0 = eq_x + 30
        slot_x1 = rx - 10
        d.rectangle([slot_x0, cy - radius - 4, slot_x1, cy + radius + 4], outline=BLACK, width=2, fill=(248, 248, 252))
        qmark_font = load_font(36, bold=True)
        d.text(((slot_x0 + slot_x1) // 2 - 8, cy - 22), "?", fill=(120, 120, 130), font=qmark_font)

    def render_slot(d, i, cx, cy, sh):
        r = int(sh * 0.32)
        ring_circle(d, cx, cy, r, answer_colors[i])

    draw_question_rows(draw, top, bottom, render_row)
    draw_answer_column(draw, top, bottom, render_slot)
    draw_footer(draw)
    img.save(path, "PNG", optimize=True)


# ── Worksheet 2: Shape Matching ──────────────────────────────────────────────
SHAPES = [
    "circle", "triangle", "square", "star",
    "heart", "diamond", "pentagon", "hexagon",
    "oval", "rectangle",
]


def draw_shape(d: ImageDraw.ImageDraw, name: str, cx: int, cy: int, size: int, color: tuple, outline=BLACK) -> None:
    s = size
    if name == "circle":
        d.ellipse([cx - s, cy - s, cx + s, cy + s], fill=color, outline=outline, width=3)
    elif name == "oval":
        d.ellipse([cx - int(s * 1.3), cy - int(s * 0.8), cx + int(s * 1.3), cy + int(s * 0.8)], fill=color, outline=outline, width=3)
    elif name == "square":
        d.rectangle([cx - s, cy - s, cx + s, cy + s], fill=color, outline=outline, width=3)
    elif name == "rectangle":
        d.rectangle([cx - int(s * 1.3), cy - int(s * 0.7), cx + int(s * 1.3), cy + int(s * 0.7)], fill=color, outline=outline, width=3)
    elif name == "triangle":
        d.polygon([(cx, cy - s), (cx - s, cy + s), (cx + s, cy + s)], fill=color, outline=outline)
        d.line([(cx, cy - s), (cx - s, cy + s), (cx + s, cy + s), (cx, cy - s)], fill=outline, width=3)
    elif name == "diamond":
        d.polygon([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy)], fill=color, outline=outline)
        d.line([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy), (cx, cy - s)], fill=outline, width=3)
    elif name == "star":
        import math
        pts = []
        for k in range(10):
            angle = -math.pi / 2 + k * math.pi / 5
            r = s if k % 2 == 0 else int(s * 0.45)
            pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
        d.polygon(pts, fill=color, outline=outline)
        d.line(pts + [pts[0]], fill=outline, width=2)
    elif name == "heart":
        import math
        pts = []
        for t in range(0, 360, 4):
            rad = math.radians(t)
            x = 16 * math.sin(rad) ** 3
            y = 13 * math.cos(rad) - 5 * math.cos(2 * rad) - 2 * math.cos(3 * rad) - math.cos(4 * rad)
            pts.append((cx + x * (s / 16), cy - y * (s / 16)))
        d.polygon(pts, fill=color, outline=outline)
    elif name == "pentagon":
        import math
        pts = []
        for k in range(5):
            angle = -math.pi / 2 + k * 2 * math.pi / 5
            pts.append((cx + s * math.cos(angle), cy + s * math.sin(angle)))
        d.polygon(pts, fill=color, outline=outline)
        d.line(pts + [pts[0]], fill=outline, width=3)
    elif name == "hexagon":
        import math
        pts = []
        for k in range(6):
            angle = k * math.pi / 3
            pts.append((cx + s * math.cos(angle), cy + s * math.sin(angle)))
        d.polygon(pts, fill=color, outline=outline)
        d.line(pts + [pts[0]], fill=outline, width=3)


def worksheet_shape_matching(path: Path) -> None:
    img, draw, top, bottom = common_canvas()
    draw_title_bar(draw, "Shape Matching — Find the same shape")

    button_colors = ["red", "blue", "yellow", "green", "orange", "purple", "pink", "brown", "blue", "green"]
    answer_palette = list(button_colors)

    def render_row(d, i, lx, rx, y0, y1, rh):
        cy = (y0 + y1) // 2
        size = int(rh * 0.30)
        button_x = lx + size + 10
        target_x = rx - size - 10
        # Color button (left)
        filled_circle(d, button_x, cy, size, PALETTE[button_colors[i]])
        # Arrow
        arrow_x0 = button_x + size + 18
        arrow_x1 = target_x - size - 18
        d.line([arrow_x0, cy, arrow_x1, cy], fill=BLACK, width=3)
        d.polygon([(arrow_x1, cy - 10), (arrow_x1 + 16, cy), (arrow_x1, cy + 10)], fill=BLACK)
        # Shape on the right
        draw_shape(d, SHAPES[i], target_x, cy, size, PALETTE[button_colors[i]])

    def render_slot(d, i, cx, cy, sh):
        size = int(sh * 0.30)
        draw_shape(d, SHAPES[i], cx, cy, size, PALETTE[answer_palette[i]])

    draw_question_rows(draw, top, bottom, render_row)
    draw_answer_column(draw, top, bottom, render_slot)
    draw_footer(draw)
    img.save(path, "PNG", optimize=True)


# ── Worksheet 3: Number Matching ─────────────────────────────────────────────
NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]


def worksheet_number_matching(path: Path) -> None:
    img, draw, top, bottom = common_canvas()
    draw_title_bar(draw, "Number Matching — Count the dots")

    button_colors = ["red", "blue", "yellow", "green", "orange", "purple", "pink", "brown", "blue", "green"]

    def draw_dots(d, count, cx, cy, dot_r, max_per_row=5):
        # Arrange dots in up to two rows centered.
        rows = 1 if count <= max_per_row else 2
        per_row = min(count, max_per_row) if rows == 1 else max_per_row
        spacing = dot_r * 2 + 6
        if rows == 1:
            total_w = (count - 1) * spacing
            start_x = cx - total_w // 2
            for k in range(count):
                filled_circle(d, start_x + k * spacing, cy, dot_r, BLACK)
        else:
            top_count = max_per_row
            bottom_count = count - top_count
            top_w = (top_count - 1) * spacing
            bottom_w = max(0, (bottom_count - 1) * spacing)
            tx = cx - top_w // 2
            bx = cx - bottom_w // 2
            ty = cy - dot_r - 2
            by = cy + dot_r + 2
            for k in range(top_count):
                filled_circle(d, tx + k * spacing, ty, dot_r, BLACK)
            for k in range(bottom_count):
                filled_circle(d, bx + k * spacing, by, dot_r, BLACK)

    def render_row(d, i, lx, rx, y0, y1, rh):
        cy = (y0 + y1) // 2
        button_r = int(rh * 0.30)
        button_x = lx + button_r + 10
        filled_circle(d, button_x, cy, button_r, PALETTE[button_colors[i]])
        # Number text in centre of button
        num_font = load_font(int(button_r * 1.1), bold=True)
        n = NUMBERS[i]
        text = str(n)
        bbox = d.textbbox((0, 0), text, font=num_font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        d.text((button_x - tw // 2, cy - th // 2 - bbox[1]), text, fill=WHITE, font=num_font)

        # Arrow
        arrow_x0 = button_x + button_r + 22
        arrow_x1 = arrow_x0 + 90
        d.line([arrow_x0, cy, arrow_x1, cy], fill=BLACK, width=3)
        d.polygon([(arrow_x1, cy - 10), (arrow_x1 + 16, cy), (arrow_x1, cy + 10)], fill=BLACK)
        # Dots representation
        dots_x = arrow_x1 + 60
        draw_dots(d, n, dots_x + 60, cy, dot_r=10)

    def render_slot(d, i, cx, cy, sh):
        size = int(sh * 0.32)
        filled_circle(d, cx, cy, size, PALETTE[button_colors[i]])
        num_font = load_font(int(size * 1.1), bold=True)
        text = str(NUMBERS[i])
        bbox = d.textbbox((0, 0), text, font=num_font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        d.text((cx - tw // 2, cy - th // 2 - bbox[1]), text, fill=WHITE, font=num_font)

    draw_question_rows(draw, top, bottom, render_row)
    draw_answer_column(draw, top, bottom, render_slot)
    draw_footer(draw)
    img.save(path, "PNG", optimize=True)


def main() -> None:
    out1 = OUTPUT_DIR / "worksheet_1_color_mixing.png"
    out2 = OUTPUT_DIR / "worksheet_2_shape_matching.png"
    out3 = OUTPUT_DIR / "worksheet_3_number_matching.png"

    worksheet_color_mixing(out1)
    worksheet_shape_matching(out2)
    worksheet_number_matching(out3)

    print("Saved:")
    for p in (out1, out2, out3):
        print(f"  {p} ({p.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
