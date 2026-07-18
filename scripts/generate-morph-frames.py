"""Generate source-derived liquid-metal frame loops for Orbit Presence.

This is a design-build utility, not a runtime dependency. It uses the approved
raster assets as material truth, then applies restrained mesh deformation,
moving specular light, and state tinting. Run it from the repository root with
Python, Pillow, and NumPy available.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from math import cos, pi, sin
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
MORPH_ROOT = ROOT / "public" / "presence" / "morph"
FRAME_ROOT = MORPH_ROOT / "frame-loops"
STILL_ROOT = MORPH_ROOT / "stills"


@dataclass(frozen=True)
class SequenceSpec:
    source: str
    count: int
    amplitude_x: float
    amplitude_y: float
    glint: float
    pulse: float
    tint: tuple[int, int, int] | None = None
    tint_strength: float = 0.0
    phase_offset: float = 0.0


SEQUENCES: dict[str, SequenceSpec] = {
    "idle": SequenceSpec("idle.png", 14, 5.0, 4.0, 0.08, 0.035),
    "noticing": SequenceSpec(
        "attention.png", 18, 7.0, 5.0, 0.13, 0.07, phase_offset=0.1
    ),
    "listening": SequenceSpec(
        "idle.png", 20, 9.0, 7.0, 0.12, 0.15, phase_offset=0.18
    ),
    "thinking": SequenceSpec(
        "idle.png", 22, 11.0, 7.0, 0.16, 0.08, phase_offset=0.3
    ),
    "speaking": SequenceSpec(
        "speaking.png", 24, 15.0, 9.0, 0.2, 0.17, phase_offset=0.42
    ),
    "attention": SequenceSpec(
        "attention.png", 20, 9.0, 6.0, 0.2, 0.12, phase_offset=0.54
    ),
    "completed": SequenceSpec(
        "idle.png",
        16,
        5.0,
        4.0,
        0.15,
        0.1,
        tint=(60, 146, 108),
        tint_strength=0.06,
        phase_offset=0.66,
    ),
    "error": SequenceSpec(
        "idle.png",
        14,
        4.0,
        3.0,
        0.07,
        0.035,
        tint=(164, 69, 52),
        tint_strength=0.08,
        phase_offset=0.78,
    ),
}


def mesh_deform(
    image: Image.Image,
    phase: float,
    amplitude_x: float,
    amplitude_y: float,
) -> Image.Image:
    """Apply a continuous inverse mesh map so the silhouette flexes like liquid."""

    width, height = image.size
    columns, rows = 9, 8
    xs = [round(width * index / columns) for index in range(columns + 1)]
    ys = [round(height * index / rows) for index in range(rows + 1)]

    def source_point(x: float, y: float) -> tuple[float, float]:
        nx = x / max(1, width)
        ny = y / max(1, height)
        edge = sin(pi * nx) * sin(pi * ny)
        dx = edge * (
            amplitude_x * sin((ny * 2.0 + phase) * 2.0 * pi)
            + amplitude_x * 0.34 * sin((nx * 3.0 - phase * 1.35) * 2.0 * pi)
        )
        dy = edge * (
            amplitude_y * cos((nx * 2.0 - phase * 0.82) * 2.0 * pi)
            + amplitude_y * 0.3 * sin((ny * 3.0 + phase * 1.1) * 2.0 * pi)
        )
        return x + dx, y + dy

    mesh = []
    for row in range(rows):
        for column in range(columns):
            left, top = xs[column], ys[row]
            right, bottom = xs[column + 1], ys[row + 1]
            nw = source_point(left, top)
            sw = source_point(left, bottom)
            se = source_point(right, bottom)
            ne = source_point(right, top)
            mesh.append(((left, top, right, bottom), (*nw, *sw, *se, *ne)))

    return image.transform(
        image.size,
        Image.Transform.MESH,
        mesh,
        resample=Image.Resampling.BICUBIC,
    )


def radial_mask(
    size: tuple[int, int],
    center: tuple[float, float],
    radius: tuple[float, float],
) -> Image.Image:
    width, height = size
    yy, xx = np.mgrid[0:height, 0:width]
    nx = (xx - center[0] * width) / max(1.0, radius[0] * width)
    ny = (yy - center[1] * height) / max(1.0, radius[1] * height)
    values = np.exp(-(nx * nx + ny * ny) * 2.5)
    return Image.fromarray(np.uint8(np.clip(values * 255.0, 0, 255)), "L")


def add_material_light(
    image: Image.Image,
    phase: float,
    glint_strength: float,
    pulse_strength: float,
) -> Image.Image:
    width, height = image.size
    alpha = image.getchannel("A")
    yy, xx = np.mgrid[0:height, 0:width]

    sweep = (0.16 + 0.68 * phase) * width
    diagonal = xx - sweep - (yy - height * 0.5) * 0.38
    band = np.exp(-((diagonal / max(18.0, width * 0.055)) ** 2))
    glint_mask = Image.fromarray(
        np.uint8(np.clip(band * 255.0 * glint_strength, 0, 255)), "L"
    )
    glint_mask = ImageChops.multiply(glint_mask, alpha)
    glint = Image.new("RGBA", image.size, (255, 250, 241, 0))
    glint.putalpha(glint_mask)
    result = Image.alpha_composite(image, glint)

    pulse_cycle = 0.58 + 0.42 * sin(phase * 2.0 * pi) ** 2
    warm_mask = radial_mask(image.size, (0.475, 0.52), (0.16, 0.2))
    cool_mask = radial_mask(image.size, (0.545, 0.51), (0.16, 0.2))
    warm_mask = warm_mask.point(
        lambda value: round(value * pulse_strength * pulse_cycle)
    )
    cool_mask = cool_mask.point(
        lambda value: round(value * pulse_strength * (1.0 - 0.2 * pulse_cycle))
    )
    warm_mask = ImageChops.multiply(warm_mask, alpha)
    cool_mask = ImageChops.multiply(cool_mask, alpha)
    warm = Image.new("RGBA", image.size, (255, 105, 39, 0))
    cool = Image.new("RGBA", image.size, (25, 205, 199, 0))
    warm.putalpha(warm_mask)
    cool.putalpha(cool_mask)
    return Image.alpha_composite(Image.alpha_composite(result, warm), cool)


def add_tint(
    image: Image.Image,
    tint: tuple[int, int, int] | None,
    strength: float,
) -> Image.Image:
    if tint is None or strength <= 0:
        return image

    alpha = image.getchannel("A").point(lambda value: round(value * strength))
    overlay = Image.new("RGBA", image.size, (*tint, 0))
    overlay.putalpha(alpha)
    return Image.alpha_composite(image, overlay)


def prepare_source(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is not None:
        padding = round(max(bounds[2] - bounds[0], bounds[3] - bounds[1]) * 0.055)
        left = max(0, bounds[0] - padding)
        top = max(0, bounds[1] - padding)
        right = min(image.width, bounds[2] + padding)
        bottom = min(image.height, bounds[3] + padding)
        image = image.crop((left, top, right, bottom))
    rgb = Image.merge("RGB", image.split()[:3])
    rgb = ImageEnhance.Contrast(rgb).enhance(1.045)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.15)
    return Image.merge("RGBA", (*rgb.split(), image.getchannel("A")))


def render_frame(source: Image.Image, spec: SequenceSpec, index: int) -> Image.Image:
    phase = (index / spec.count + spec.phase_offset) % 1.0
    deformation = 0.72 + 0.28 * sin(phase * 2.0 * pi) ** 2
    frame = mesh_deform(
        source,
        phase,
        spec.amplitude_x * deformation,
        spec.amplitude_y * deformation,
    )
    frame = add_material_light(frame, phase, spec.glint, spec.pulse)
    frame = add_tint(frame, spec.tint, spec.tint_strength)
    rgb = Image.merge("RGB", frame.split()[:3]).filter(
        ImageFilter.UnsharpMask(radius=0.65, percent=78, threshold=2)
    )
    return Image.merge("RGBA", (*rgb.split(), frame.getchannel("A")))


def generate_sequence(state: str, spec: SequenceSpec) -> None:
    source = prepare_source(MORPH_ROOT / spec.source)
    target = FRAME_ROOT / state
    target.mkdir(parents=True, exist_ok=True)
    STILL_ROOT.mkdir(parents=True, exist_ok=True)

    frames = []
    for index in range(spec.count):
        frame = render_frame(source, spec, index)
        frame.save(
            target / f"{state}-{index:02d}.webp",
            "WEBP",
            quality=93,
            method=4,
            exact=True,
        )
        frames.append(frame)

    still_index = spec.count // 2
    frames[still_index].save(
        STILL_ROOT / f"{state}.webp",
        "WEBP",
        quality=96,
        method=4,
        exact=True,
    )
    print(f"generated {state}: {spec.count} frames")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--states",
        nargs="*",
        choices=tuple(SEQUENCES),
        default=tuple(SEQUENCES),
        help="Generate only the named states.",
    )
    args = parser.parse_args()

    for state in args.states:
        spec = SEQUENCES[state]
        generate_sequence(state, spec)


if __name__ == "__main__":
    main()
