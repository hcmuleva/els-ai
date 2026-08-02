"""Generate sample educational PDFs so the pipeline can be demoed end-to-end.

Creates two short, overlapping physics books (to exercise overlap analysis) plus
deliberate noise pages (copyright, references) to exercise noise removal.

Usage:
    python scripts/make_sample_pdf.py
"""
from __future__ import annotations

import textwrap
from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

_REPO_ROOT = Path(__file__).resolve().parents[1]
_OUT = _REPO_ROOT / "data" / "input"


def _render(path: Path, pages: list[str]) -> None:
    c = canvas.Canvas(str(path), pagesize=LETTER)
    width, height = LETTER
    for page in pages:
        text_obj = c.beginText(56, height - 64)
        text_obj.setFont("Helvetica", 11)
        for raw_line in page.splitlines():
            if not raw_line.strip():
                text_obj.textLine("")
                continue
            for wrapped in textwrap.wrap(raw_line, width=92) or [""]:
                text_obj.textLine(wrapped)
        c.drawText(text_obj)
        c.showPage()
    c.save()


MECHANICS = [
    # p0 - title / copyright noise
    "Classical Mechanics: Foundations of Motion\n\n"
    "Copyright 2024 Sample Educational Press. All rights reserved. ISBN 978-0-00-000000-0.\n"
    "Published by Sample Educational Press. Printed in the United States. First edition.",
    # p1 - chapter 1 with definitions + formula + example
    "Chapter 1: Kinematics\n\n"
    "Displacement is defined as the change in position of an object in a given direction. "
    "Velocity is the rate of change of displacement with respect to time, and is a vector "
    "quantity. Speed refers to the magnitude of velocity without direction.\n\n"
    "The formula for average velocity is v = d / t, where d is displacement and t is time. "
    "Acceleration is defined as the rate of change of velocity with respect to time, given by "
    "a = (v2 - v1) / t.\n\n"
    "For example, a car that travels 100 metres in 5 seconds has an average velocity of 20 "
    "metres per second.",
    # p2 - chapter 2 laws + process + case study
    "Chapter 2: Newton's Laws of Motion\n\n"
    "Newton's first law states that an object remains at rest or in uniform motion unless acted "
    "upon by a net external force. The principle of inertia describes this tendency to resist "
    "changes in motion.\n\n"
    "Force is defined as the product of mass and acceleration, expressed by the formula F = m a. "
    "This principle leads to a change in the momentum of the object.\n\n"
    "The process of solving a dynamics problem follows clear steps. First, draw a free body "
    "diagram. Second, resolve the forces. Third, apply Newton's second law. Finally, solve for "
    "the unknown quantity.\n\n"
    "For example, a force of 10 newtons applied to a 2 kilogram mass produces an acceleration of "
    "5 metres per second squared. In practice, engineers apply this framework to design safe "
    "braking systems for vehicles.",
    # p3 - chapter 3 energy (overlaps with book 2)
    "Chapter 3: Work and Energy\n\n"
    "Work is defined as the product of force and the displacement in the direction of the force, "
    "given by W = F d. Energy refers to the capacity of a system to do work.\n\n"
    "Kinetic energy is the energy possessed by an object due to its motion, expressed by the "
    "formula KE = 0.5 m v^2. The principle of conservation of energy states that energy cannot be "
    "created or destroyed, only transformed.\n\n"
    "For example, a falling object converts potential energy into kinetic energy as it descends.",
    # p4 - references noise
    "References\n\n"
    "1. Halliday, D. Fundamentals of Physics. 2. Serway, R. Physics for Scientists.\n"
    "Bibliography and further reading available at the publisher website. "
    "Acknowledgements: the author would like to thank the review committee.",
]

THERMO = [
    "Energy and Thermodynamics: A Concise Introduction\n\n"
    "Copyright 2023 Sample Educational Press. All rights reserved. ISBN 978-0-00-000001-7.",
    "Chapter 1: Energy and Heat\n\n"
    "Energy is defined as the capacity of a system to do work or produce heat. Heat is the "
    "transfer of thermal energy between systems due to a temperature difference.\n\n"
    "The principle of conservation of energy states that the total energy of an isolated system "
    "remains constant. Work is the transfer of energy by a force acting through a displacement, "
    "given by W = F d.\n\n"
    "For example, a heated gas expands and does work on its surroundings.",
    "Chapter 2: Laws of Thermodynamics\n\n"
    "The first law of thermodynamics states that the change in internal energy of a system equals "
    "the heat added minus the work done by the system. This principle is a statement of energy "
    "conservation.\n\n"
    "Entropy is defined as a measure of the disorder of a system. The second law of "
    "thermodynamics states that the entropy of an isolated system never decreases.\n\n"
    "For example, heat flows spontaneously from a hot body to a cold body, never the reverse.",
]


def main() -> None:
    _OUT.mkdir(parents=True, exist_ok=True)
    _render(_OUT / "sample_classical_mechanics.pdf", MECHANICS)
    _render(_OUT / "sample_thermodynamics.pdf", THERMO)
    print(f"Wrote sample PDFs to {_OUT}")


if __name__ == "__main__":
    main()
