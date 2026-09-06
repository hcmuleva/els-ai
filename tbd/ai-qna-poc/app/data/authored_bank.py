"""Droid-authored question bank (the "LLM" content for this POC).

Every stem, option and explanation is written in **book-format markdown**:
inline math uses ``$...$`` and display math uses ``$$...$$`` so a markdown +
KaTeX/MathJax renderer shows formulas the way they appear in a textbook.

Explanations are written in a **teacher voice**: they state what is given,
the idea/concept behind it, then go step by step (with the reason for each
step) and finish with the answer. Blocks are separated by blank lines so a
markdown renderer shows them as clean paragraphs.

The bank is keyed by ``(class_level, subject) -> topic -> [items]``. The
generator filters items by difficulty / type / topic and tops up the count
with the parametrised generators in ``droid_authored.py``.
"""
from __future__ import annotations

from typing import Dict, List, Tuple

from app.schemas import Difficulty, QuestionType

RawQuestion = Dict[str, object]

SC_INSTR = "Choose the one correct option."
MCQ_INSTR = "Select all correct options."
TF_INSTR = "State whether the statement is True or False."


def steps(*blocks: str) -> str:
    """Join explanation blocks into book-format markdown (blank line between)."""
    return "\n\n".join(b.strip() for b in blocks if b)


def sc(difficulty: str, topic: str, title_md: str, options: List[Tuple[str, bool]],
       explanation_md: str, ref: str, verification: Dict = None) -> RawQuestion:
    item: RawQuestion = {
        "type": QuestionType.single_choice,
        "difficulty": Difficulty(difficulty),
        "topic": topic,
        "title_md": title_md,
        "instruction": SC_INSTR,
        "options": [{"label_md": lbl, "is_correct": ok} for lbl, ok in options],
        "explanation_md": explanation_md,
        "source_style_ref": ref,
    }
    if verification:
        item["verification"] = verification
    return item


def mcq(difficulty: str, topic: str, title_md: str, options: List[Tuple[str, bool]],
        explanation_md: str, ref: str, verification: Dict = None) -> RawQuestion:
    item: RawQuestion = {
        "type": QuestionType.multi_choice,
        "difficulty": Difficulty(difficulty),
        "topic": topic,
        "title_md": title_md,
        "instruction": MCQ_INSTR,
        "options": [{"label_md": lbl, "is_correct": ok} for lbl, ok in options],
        "explanation_md": explanation_md,
        "source_style_ref": ref,
    }
    if verification:
        item["verification"] = verification
    return item


def tf(difficulty: str, topic: str, statement_md: str, correct: bool,
       explanation_md: str, ref: str, verification: Dict = None) -> RawQuestion:
    item: RawQuestion = {
        "type": QuestionType.true_false,
        "difficulty": Difficulty(difficulty),
        "topic": topic,
        "title_md": statement_md,
        "instruction": TF_INSTR,
        "options": [
            {"label_md": "True", "is_correct": correct},
            {"label_md": "False", "is_correct": not correct},
        ],
        "explanation_md": explanation_md,
        "source_style_ref": ref,
    }
    if verification:
        item["verification"] = verification
    return item


# ---------------------------------------------------------------------------
# Class 12 - Physics
# ---------------------------------------------------------------------------
_C12_PHYSICS: Dict[str, List[RawQuestion]] = {
    "current_electricity": [
        sc("easy", "current_electricity",
           r"The SI unit of electrical resistance is the **ohm** $(\Omega)$. Which combination of base units is equivalent to one ohm?",
           [(r"$\text{V}\,\text{A}^{-1}$", True),
            (r"$\text{A}\,\text{V}^{-1}$", False),
            (r"$\text{V}\,\text{s}$", False),
            (r"$\text{C}\,\text{V}^{-1}$", False)],
           steps(
               r"**What we are using.** Resistance is *defined* through Ohm's law, which connects voltage and current.",
               r"**Step 1 — Write Ohm's law.** $$V = IR.$$",
               r"**Step 2 — Make $R$ the subject.** Divide both sides by $I$: $$R = \dfrac{V}{I}.$$",
               r"**Why the unit looks like this.** $V$ is measured in volt and $I$ in ampere, so the unit of $R$ must be volt per ampere.",
               r"**Answer.** $1\,\Omega = 1\,\text{V}\,\text{A}^{-1}$.",
           ),
           "CBSE Class 12 Physics, Current Electricity (1-mark recall)"),
        sc("easy", "current_electricity",
           r"Two resistors $R_1 = 2\,\Omega$ and $R_2 = 3\,\Omega$ are joined in **series**. The equivalent resistance is:",
           [(r"$5\,\Omega$", True), (r"$1.2\,\Omega$", False),
            (r"$6\,\Omega$", False), (r"$0.5\,\Omega$", False)],
           steps(
               r"**Given.** $R_1 = 2\,\Omega$ and $R_2 = 3\,\Omega$, connected in series.",
               r"**The idea.** In a series circuit there is only one path, so the *same* current flows through both resistors and their resistances simply add up.",
               r"**Step 1 — Series rule.** $$R_{eq} = R_1 + R_2.$$",
               r"**Step 2 — Put in the numbers.** $$R_{eq} = 2 + 3 = 5\,\Omega.$$",
               r"**Answer.** $R_{eq} = 5\,\Omega$.",
           ),
           "CBSE Class 12 Physics, Current Electricity (series combination)"),
        sc("medium", "current_electricity",
           r"A wire of resistivity $\rho$, length $L$ and area of cross-section $A$ has resistance $R$. If it is stretched so that its length doubles (volume constant), the new resistance is:",
           [(r"$4R$", True), (r"$2R$", False), (r"$R/2$", False), (r"$R/4$", False)],
           steps(
               r"**Given.** Original resistance $R = \rho\dfrac{L}{A}$; the wire is stretched so its length doubles, with the volume unchanged.",
               r"**Why volume matters.** Stretching only reshapes the same metal, so the volume $V = AL$ stays fixed. If the length doubles, the area must halve to keep $V$ constant.",
               r"**Step 1 — New length and area.** $L' = 2L$ and, since $A'L' = AL$, we get $A' = \dfrac{A}{2}$.",
               r"**Step 2 — New resistance.** $$R' = \rho\dfrac{L'}{A'} = \rho\dfrac{2L}{A/2} = 4\,\rho\dfrac{L}{A}.$$",
               r"**Step 3 — Recognise the old resistance.** Since $\rho\dfrac{L}{A} = R$, $$R' = 4R.$$",
               r"**Answer.** The resistance becomes $4R$ (stretching makes a wire thinner *and* longer, both of which raise resistance).",
           ),
           "CBSE Class 12 Physics, Current Electricity (resistivity, 2-mark)"),
        mcq("medium", "current_electricity",
            r"Select **all** correct expressions for the power $P$ dissipated in a resistor $R$ carrying current $I$ across potential difference $V$.",
            [(r"$P = VI$", True), (r"$P = I^2 R$", True),
             (r"$P = \dfrac{V^2}{R}$", True), (r"$P = \dfrac{IR}{V}$", False)],
            steps(
                r"**Start from the definition.** Electrical power is energy delivered per second: $$P = VI.$$",
                r"**Step 1 — Swap out $V$.** Using Ohm's law $V = IR$: $$P = (IR)\,I = I^2 R.$$",
                r"**Step 2 — Swap out $I$ instead.** Using $I = \dfrac{V}{R}$: $$P = V\cdot\dfrac{V}{R} = \dfrac{V^2}{R}.$$",
                r"**Why the last one is wrong.** $\dfrac{IR}{V} = \dfrac{V}{V} = 1$, which is just a number, not power.",
                r"**Answer.** The correct forms are $P = VI$, $P = I^2R$ and $P = \dfrac{V^2}{R}$.",
            ),
            "CBSE Class 12 Physics, Current Electricity (electric power)"),
        mcq("hard", "current_electricity",
            r"A cell of emf $\varepsilon$ and internal resistance $r$ drives a current $I$ through an external resistor $R$. Choose **all** correct statements.",
            [(r"Terminal voltage is $V = \varepsilon - Ir$", True),
             (r"Current is $I = \dfrac{\varepsilon}{R + r}$", True),
             (r"Power delivered to $R$ is maximum when $R = r$", True),
             (r"Terminal voltage exceeds $\varepsilon$ while discharging", False)],
            steps(
                r"**Picture the circuit.** The emf $\varepsilon$ has to push current through *both* the outside resistor $R$ and the cell's own internal resistance $r$.",
                r"**Step 1 — Find the current.** Total resistance is $R + r$, so $$I = \dfrac{\varepsilon}{R + r}.$$",
                r"**Step 2 — Terminal voltage.** Some emf is used up inside the cell across $r$, leaving $$V = \varepsilon - Ir.$$ Because $Ir > 0$, the terminal voltage is always *less* than $\varepsilon$ while discharging.",
                r"**Step 3 — Maximum power.** Power in $R$ is $P = I^2R$. Maximising this with respect to $R$ gives the matched condition $R = r$.",
                r"**Answer.** The first three statements are correct; the terminal voltage never exceeds $\varepsilon$ on discharge.",
            ),
            "CBSE Class 12 Physics, Current Electricity (emf & internal resistance)"),
        tf("easy", "current_electricity",
           r"**Kirchhoff's junction rule** states that the algebraic sum of currents meeting at a junction is zero, i.e. $\sum I = 0$.",
           True,
           steps(
               r"**The rule.** At any junction, $$\sum I = 0,$$ meaning the current flowing in equals the current flowing out.",
               r"**Why it must be true.** Charge cannot collect at a point in the wire. So every coulomb that arrives each second must also leave: $\sum I_{in} = \sum I_{out}$. This is simply conservation of charge.",
               r"**Answer.** True.",
           ),
           "CBSE Class 12 Physics, Current Electricity (Kirchhoff's laws)"),
        tf("medium", "current_electricity",
           r"The equivalent resistance of a parallel combination is always **greater** than the largest individual resistance.",
           False,
           steps(
               r"**The rule.** For resistors in parallel, $$\dfrac{1}{R_{eq}} = \sum \dfrac{1}{R_i}.$$",
               r"**Think about it.** Adding another parallel branch gives the current an *extra* path to flow through, which makes it easier for current to pass, i.e. lowers the resistance.",
               r"**Conclusion.** So $R_{eq}$ comes out *smaller* than even the smallest branch, never larger than the biggest one.",
               r"**Answer.** False.",
           ),
           "CBSE Class 12 Physics, Current Electricity (parallel combination)"),
    ],
    "electrostatics": [
        sc("easy", "electrostatics",
           r"Coulomb's law gives the force between two point charges $q_1, q_2$ separated by $r$ as $F = \dfrac{1}{4\pi\varepsilon_0}\dfrac{q_1 q_2}{r^2}$. If $r$ is doubled, the force becomes:",
           [(r"$F/4$", True), (r"$F/2$", False), (r"$2F$", False), (r"$4F$", False)],
           steps(
               r"**Law.** $$F = \dfrac{1}{4\pi\varepsilon_0}\dfrac{q_1 q_2}{r^2}.$$",
               r"**Key point.** With the charges unchanged, the force depends only on distance as $F \propto \dfrac{1}{r^2}$ (an inverse-square law).",
               r"**Step 1 — Replace $r$ with $2r$.** $$F' \propto \dfrac{1}{(2r)^2} = \dfrac{1}{4r^2}.$$",
               r"**Step 2 — Compare with the original.** The denominator grew $4$ times, so $F' = \dfrac{F}{4}$.",
               r"**Answer.** The force drops to $F/4$.",
           ),
           "CBSE Class 12 Physics, Electrostatics (Coulomb's law)"),
        sc("medium", "electrostatics",
           r"The electric field at a distance $r$ from an infinite line charge of linear density $\lambda$ is:",
           [(r"$\dfrac{\lambda}{2\pi\varepsilon_0 r}$", True),
            (r"$\dfrac{\lambda}{4\pi\varepsilon_0 r^2}$", False),
            (r"$\dfrac{\lambda r}{2\varepsilon_0}$", False),
            (r"$\dfrac{\lambda}{\varepsilon_0 r}$", False)],
           steps(
               r"**Method.** Use Gauss's law with a cylinder of radius $r$ and length $\ell$ wrapped around the line charge (this symmetry makes the maths simple).",
               r"**Step 1 — Charge enclosed.** A length $\ell$ of the line holds $q_{enc} = \lambda \ell$.",
               r"**Step 2 — Flux through the cylinder.** The field is radial, so only the curved surface counts: $\Phi = E\,(2\pi r \ell)$.",
               r"**Step 3 — Apply Gauss's law $\Phi = \dfrac{q_{enc}}{\varepsilon_0}$.** $$E\,(2\pi r \ell) = \dfrac{\lambda \ell}{\varepsilon_0}.$$",
               r"**Step 4 — Cancel $\ell$ and solve for $E$.** $$E = \dfrac{\lambda}{2\pi\varepsilon_0 r}.$$",
               r"**Answer.** $E = \dfrac{\lambda}{2\pi\varepsilon_0 r}$ (note it falls as $1/r$, not $1/r^2$).",
           ),
           "CBSE Class 12 Physics, Electrostatics (Gauss's law)"),
        tf("easy", "electrostatics",
           r"Electric field lines can never intersect each other.",
           True,
           steps(
               r"**What a field line means.** The tangent to a field line at any point shows the direction of the electric field $\vec{E}$ there.",
               r"**The contradiction.** If two lines crossed, at the crossing point we could draw two different tangents, i.e. $\vec{E}$ would point in two directions at once.",
               r"**Why that is impossible.** The field at a point can have only one direction, so the lines cannot meet.",
               r"**Answer.** True.",
           ),
           "CBSE Class 12 Physics, Electrostatics (field lines)"),
    ],
}

# ---------------------------------------------------------------------------
# Class 12 - Mathematics
# ---------------------------------------------------------------------------
_C12_MATH: Dict[str, List[RawQuestion]] = {
    "calculus": [
        sc("easy", "calculus",
           r"Evaluate $\dfrac{d}{dx}\left(\sin x\right)$.",
           [(r"$\cos x$", True), (r"$-\cos x$", False),
            (r"$-\sin x$", False), (r"$\sec^2 x$", False)],
           steps(
               r"**Standard result.** $$\dfrac{d}{dx}\big(\sin x\big) = \cos x.$$",
               r"**Where it comes from.** From first principles, $\dfrac{d}{dx}\sin x = \lim_{h\to 0}\dfrac{\sin(x+h)-\sin x}{h}$, which simplifies to $\cos x$ using $\lim_{h\to 0}\dfrac{\sin h}{h}=1$.",
               r"**Quick check.** At $x = 0$ the graph of $\sin x$ rises with slope $1$, and indeed $\cos 0 = 1$.",
               r"**Answer.** $\cos x$.",
           ),
           "CBSE Class 12 Mathematics, Continuity & Differentiability"),
        sc("medium", "calculus",
           r"Evaluate the definite integral $$\int_0^{\pi/2} \cos x \, dx.$$",
           [(r"$1$", True), (r"$0$", False), (r"$\dfrac{\pi}{2}$", False), (r"$-1$", False)],
           steps(
               r"**Step 1 — Find the antiderivative.** $$\int \cos x\,dx = \sin x.$$",
               r"**Step 2 — Use the Fundamental Theorem of Calculus.** Evaluate $\sin x$ at the upper limit minus the lower limit: $$\Big[\sin x\Big]_0^{\pi/2} = \sin\tfrac{\pi}{2} - \sin 0.$$",
               r"**Step 3 — Plug in the values.** $$= 1 - 0 = 1.$$",
               r"**Answer.** $1$.",
           ),
           "CBSE Class 12 Mathematics, Integrals (definite integral)"),
        mcq("medium", "calculus",
            r"Let $f(x) = x^3 - 3x$. Select **all** correct statements about its critical points.",
            [(r"$x = 1$ is a point of local minimum", True),
             (r"$x = -1$ is a point of local maximum", True),
             (r"$f'(x) = 3x^2 - 3$", True),
             (r"$x = 0$ is a point of local maximum", False)],
            steps(
                r"**Step 1 — Differentiate.** $$f'(x) = 3x^2 - 3 = 3(x-1)(x+1).$$",
                r"**Step 2 — Find critical points.** Set $f'(x) = 0$, which gives $x = 1$ and $x = -1$.",
                r"**Step 3 — Classify with the second derivative.** $f''(x) = 6x$, so: at $x=1$, $f''(1) = 6 > 0 \Rightarrow$ local **minimum**; at $x=-1$, $f''(-1) = -6 < 0 \Rightarrow$ local **maximum**.",
                r"**Why $x=0$ is rejected.** $f'(0) = -3 \neq 0$, so $x = 0$ is not even a critical point.",
                r"**Answer.** $f'(x) = 3x^2 - 3$; $x = 1$ is a minimum and $x = -1$ is a maximum.",
            ),
            "CBSE Class 12 Mathematics, Application of Derivatives"),
        tf("easy", "calculus",
           r"If $f(x)$ is differentiable at $x = a$, then $f(x)$ is necessarily continuous at $x = a$.",
           True,
           steps(
               r"**Theorem.** Differentiable at a point $\Rightarrow$ continuous at that point.",
               r"**Why.** For the derivative $\lim_{x\to a}\dfrac{f(x)-f(a)}{x-a}$ to exist as a finite number, the top $f(x)-f(a)$ must go to $0$ as $x\to a$. That is exactly the condition for continuity.",
               r"**A warning about the converse.** Continuity does *not* guarantee differentiability: $f(x) = |x|$ is continuous at $0$ but has a sharp corner, so it is not differentiable there.",
               r"**Answer.** True.",
           ),
           "CBSE Class 12 Mathematics, Continuity & Differentiability"),
    ],
    "matrices_determinants": [
        sc("easy", "matrices_determinants",
           r"For a $2\times 2$ matrix $A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$, the determinant $\det(A)$ equals:",
           [(r"$ad - bc$", True), (r"$ab - cd$", False),
            (r"$ad + bc$", False), (r"$ac - bd$", False)],
           steps(
               r"**Rule for a $2\times2$ matrix.** Multiply along the main diagonal, then subtract the product of the other diagonal.",
               r"**Step 1 — Main diagonal.** Top-left times bottom-right: $a \times d = ad$.",
               r"**Step 2 — Other diagonal.** Top-right times bottom-left: $b \times c = bc$.",
               r"**Step 3 — Subtract.** $$\det(A) = ad - bc.$$",
               r"**Answer.** $ad - bc$.",
           ),
           "CBSE Class 12 Mathematics, Determinants"),
        tf("medium", "matrices_determinants",
           r"A square matrix $A$ is invertible if and only if $\det(A) \neq 0$.",
           True,
           steps(
               r"**Formula for the inverse.** $$A^{-1} = \dfrac{1}{\det(A)}\,\text{adj}(A).$$",
               r"**Why the condition appears.** We divide by $\det(A)$, and division is only allowed when $\det(A) \neq 0$. If $\det(A) = 0$ the inverse simply does not exist.",
               r"**Vocabulary.** A matrix with $\det(A) \neq 0$ is called *non-singular* (invertible); one with $\det(A) = 0$ is *singular*.",
               r"**Answer.** True.",
           ),
           "CBSE Class 12 Mathematics, Determinants (inverse of a matrix)"),
    ],
}

# ---------------------------------------------------------------------------
# Class 12 - Chemistry
# ---------------------------------------------------------------------------
_C12_CHEMISTRY: Dict[str, List[RawQuestion]] = {
    "electrochemistry": [
        sc("easy", "electrochemistry",
           r"The standard hydrogen electrode (SHE) is assigned a standard electrode potential of:",
           [(r"$0.00\ \text{V}$", True), (r"$+1.00\ \text{V}$", False),
            (r"$-0.76\ \text{V}$", False), (r"$+0.34\ \text{V}$", False)],
           steps(
               r"**The problem chemists faced.** The potential of a single electrode cannot be measured on its own; you always need a second electrode to complete a cell.",
               r"**The fix — a reference.** So the standard hydrogen electrode (SHE) is chosen as the zero mark and assigned $E^\circ = 0.00\ \text{V}$ at all temperatures.",
               r"**What this gives us.** Every other electrode potential is then quoted *relative* to the SHE.",
               r"**Answer.** $0.00\ \text{V}$.",
           ),
           "CBSE Class 12 Chemistry, Electrochemistry"),
        sc("medium", "electrochemistry",
           r"For the cell reaction with standard emf $E^\circ_{cell}$, the Nernst equation at $298\ \text{K}$ is "
           r"$E_{cell} = E^\circ_{cell} - \dfrac{0.0591}{n}\log Q$. The factor $0.0591$ has units of:",
           [(r"volt", True), (r"joule", False), (r"$\text{mol}^{-1}$", False), (r"no units", False)],
           steps(
               r"**The equation.** $$E_{cell} = E^\circ_{cell} - \dfrac{0.0591}{n}\log Q.$$",
               r"**Where the number comes from.** $0.0591$ is the value of $\dfrac{RT}{F}\ln 10$ worked out at $T = 298\ \text{K}$.",
               r"**Now check the units.** $E^\circ_{cell}$ is in volt and $\log Q$ has no units, so for the equation to balance, the factor must also be in volt.",
               r"**Answer.** Volt.",
           ),
           "CBSE Class 12 Chemistry, Electrochemistry (Nernst equation)"),
        tf("easy", "electrochemistry",
           r"In a galvanic cell, **oxidation** occurs at the anode.",
           True,
           steps(
               r"**Definitions.** Oxidation = loss of electrons; reduction = gain of electrons.",
               r"**Where each happens.** The anode is *defined* as the electrode where oxidation occurs; reduction happens at the cathode.",
               r"**Memory aid.** *An–Ox* (Anode = Oxidation) and *Red–Cat* (Reduction = Cathode).",
               r"**Answer.** True.",
           ),
           "CBSE Class 12 Chemistry, Electrochemistry (galvanic cell)"),
    ],
    "chemical_kinetics": [
        sc("easy", "chemical_kinetics",
           r"The unit of the rate constant $k$ for a **first-order** reaction is:",
           [(r"$\text{s}^{-1}$", True), (r"$\text{mol}\,\text{L}^{-1}\text{s}^{-1}$", False),
            (r"$\text{L}\,\text{mol}^{-1}\text{s}^{-1}$", False), (r"dimensionless", False)],
           steps(
               r"**General formula for units.** For a reaction of order $n$, the rate constant carries units $(\text{mol}\,\text{L}^{-1})^{1-n}\,\text{s}^{-1}$.",
               r"**Step — Substitute $n = 1$.** $$(\text{mol}\,\text{L}^{-1})^{1-1}\,\text{s}^{-1} = (\text{mol}\,\text{L}^{-1})^{0}\,\text{s}^{-1} = \text{s}^{-1}.$$",
               r"**Why this makes sense.** For first order, rate $= k[A]$; rate is $\text{mol}\,\text{L}^{-1}\text{s}^{-1}$ and $[A]$ is $\text{mol}\,\text{L}^{-1}$, so $k$ must be $\text{s}^{-1}$.",
               r"**Answer.** $\text{s}^{-1}$.",
           ),
           "CBSE Class 12 Chemistry, Chemical Kinetics (order of reaction)"),
        mcq("medium", "chemical_kinetics",
            r"Select **all** correct statements about a first-order reaction.",
            [(r"Half-life is independent of initial concentration", True),
             (r"$\ln[A]$ varies linearly with time", True),
             (r"$t_{1/2} = \dfrac{0.693}{k}$", True),
             (r"Rate is independent of concentration", False)],
            steps(
                r"**Start with the rate law.** For first order, the concentration decays as $$[A] = [A]_0\,e^{-kt}.$$",
                r"**Step 1 — Take natural log.** $$\ln[A] = \ln[A]_0 - kt,$$ which is a straight line ($\ln[A]$ vs $t$) with slope $-k$.",
                r"**Step 2 — Find the half-life.** Put $[A] = \tfrac{1}{2}[A]_0$ and solve: $$t_{1/2} = \dfrac{\ln 2}{k} = \dfrac{0.693}{k}.$$ Notice $[A]_0$ cancels out, so the half-life does not depend on the starting amount.",
                r"**Why the last option is wrong.** Rate $= k[A]$ clearly *does* depend on concentration.",
                r"**Answer.** The first three statements are correct.",
            ),
            "CBSE Class 12 Chemistry, Chemical Kinetics (first-order)"),
    ],
}

# ---------------------------------------------------------------------------
# Class 12 - Biology
# ---------------------------------------------------------------------------
_C12_BIOLOGY: Dict[str, List[RawQuestion]] = {
    "genetics": [
        sc("easy", "genetics",
           r"In Mendel's monohybrid cross, the phenotypic ratio obtained in the $F_2$ generation is:",
           [(r"$3 : 1$", True), (r"$1 : 1$", False), (r"$9 : 3 : 3 : 1$", False), (r"$1 : 2 : 1$", False)],
           steps(
               r"**The cross.** Self-cross the $F_1$ hybrids: $Tt \times Tt$ (one gene, two alleles).",
               r"**Step 1 — Draw the Punnett square.** The offspring come out as $1\,TT : 2\,Tt : 1\,tt$ (this $1:2:1$ is the *genotype* ratio).",
               r"**Step 2 — Convert to phenotypes.** $TT$ and $Tt$ both show the dominant trait, while $tt$ shows the recessive trait, giving $3 : 1$.",
               r"**Answer.** $3 : 1$.",
           ),
           "CBSE Class 12 Biology, Principles of Inheritance"),
        sc("medium", "genetics",
           r"A dihybrid cross between two heterozygous individuals $(\text{RrYy} \times \text{RrYy})$ yields a phenotypic ratio of:",
           [(r"$9 : 3 : 3 : 1$", True), (r"$3 : 1$", False), (r"$1 : 1 : 1 : 1$", False), (r"$9 : 7$", False)],
           steps(
               r"**The cross.** $RrYy \times RrYy$ — two different gene pairs at once.",
               r"**Key idea (Law of Independent Assortment).** Each gene pair sorts independently, and on its own gives a $3:1$ ratio.",
               r"**Step — Combine the two pairs.** Multiply the ratios: $(3:1)\times(3:1) = 9 : 3 : 3 : 1$.",
               r"**Answer.** $9 : 3 : 3 : 1$.",
           ),
           "CBSE Class 12 Biology, Principles of Inheritance (dihybrid cross)"),
        tf("easy", "genetics",
           r"DNA replication is **semi-conservative**, meaning each daughter molecule retains one parental strand.",
           True,
           steps(
               r"**What 'semi-conservative' means.** Each new DNA double helix keeps one old (parent) strand and pairs it with one freshly built strand.",
               r"**The evidence.** Meselson and Stahl grew bacteria in heavy $^{15}\text{N}$ and then in light $^{14}\text{N}$; the density pattern of the new DNA matched exactly this one-old-one-new model.",
               r"**Answer.** True.",
           ),
           "CBSE Class 12 Biology, Molecular Basis of Inheritance"),
    ],
    "human_physiology": [
        sc("easy", "human_physiology",
           r"The functional unit of the kidney responsible for filtration of blood is the:",
           [(r"nephron", True), (r"alveolus", False), (r"neuron", False), (r"nephridia", False)],
           steps(
               r"**What is being asked.** The *functional unit* is the smallest structure that can carry out the organ's main job — here, filtering blood.",
               r"**The answer structure.** Each kidney has about a million **nephrons** that filter blood, reabsorb useful substances, and form urine.",
               r"**Rule out the others.** Alveolus $\to$ lungs, neuron $\to$ nervous system, nephridia $\to$ excretory organ of the earthworm.",
               r"**Answer.** Nephron.",
           ),
           "CBSE Class 12 Biology, Excretory Products and their Elimination"),
        tf("medium", "human_physiology",
           r"Oxygenated blood is carried away from the heart by **arteries** (except the pulmonary artery).",
           True,
           steps(
               r"**Rule for arteries.** Arteries always carry blood *away* from the heart.",
               r"**Oxygen status.** This blood is usually oxygenated — the one exception is the pulmonary artery, which carries deoxygenated blood from the heart to the lungs.",
               r"**Answer.** True (with the pulmonary artery noted as the exception).",
           ),
           "CBSE Class 12 Biology, Body Fluids and Circulation"),
    ],
}

# ---------------------------------------------------------------------------
# Class 10 - Science (Physics / Chemistry / Biology) and Mathematics
# ---------------------------------------------------------------------------
_C10_PHYSICS: Dict[str, List[RawQuestion]] = {
    "electricity": [
        sc("easy", "electricity",
           r"Ohm's law relates potential difference $V$, current $I$ and resistance $R$ as:",
           [(r"$V = IR$", True), (r"$V = \dfrac{I}{R}$", False),
            (r"$V = \dfrac{R}{I}$", False), (r"$V = I^2 R$", False)],
           steps(
               r"**What Ohm's law says.** At a fixed temperature, the current through a conductor is proportional to the voltage across it: $V \propto I$.",
               r"**Step — Turn proportionality into an equation.** Introduce the constant $R$ (the resistance): $$V = IR.$$",
               r"**Answer.** $V = IR$.",
           ),
           "CBSE Class 10 Science, Electricity"),
        sc("medium", "electricity",
           r"An electric bulb is rated $60\ \text{W}$ at $230\ \text{V}$. The current drawn by it is approximately:",
           [(r"$0.26\ \text{A}$", True), (r"$3.8\ \text{A}$", False),
            (r"$13.8\ \text{A}$", False), (r"$60\ \text{A}$", False)],
           steps(
               r"**Given.** Power $P = 60\ \text{W}$ and voltage $V = 230\ \text{V}$.",
               r"**Step 1 — Pick the right relation.** Power, voltage and current are linked by $P = VI$.",
               r"**Step 2 — Make $I$ the subject.** $$I = \dfrac{P}{V} = \dfrac{60}{230}.$$",
               r"**Step 3 — Work it out.** $$I \approx 0.26\ \text{A}.$$",
               r"**Answer.** About $0.26\ \text{A}$.",
           ),
           "CBSE Class 10 Science, Electricity (power rating)"),
        tf("easy", "electricity",
           r"In a series circuit, the same current flows through every component.",
           True,
           steps(
               r"**Why.** A series circuit is a single loop with only one path, so the charges have nowhere else to go — the same current passes through each component.",
               r"**What changes instead.** It is the voltage that splits up across the components, not the current.",
               r"**Answer.** True.",
           ),
           "CBSE Class 10 Science, Electricity (series circuit)"),
    ],
    "light": [
        sc("easy", "light",
           r"The power of a lens of focal length $f$ (in metres) is given by $P = \dfrac{1}{f}$. Its SI unit is the:",
           [(r"dioptre $(\text{D})$", True), (r"watt $(\text{W})$", False),
            (r"lumen", False), (r"candela", False)],
           steps(
               r"**Definition.** The power of a lens is $$P = \dfrac{1}{f},$$ with the focal length $f$ measured in metres.",
               r"**Step — Find the unit.** If $f$ is in metres, then $P$ is in $\text{m}^{-1}$, and this unit is given the special name *dioptre* $(\text{D})$.",
               r"**Answer.** Dioptre $(\text{D})$, where $1\ \text{D} = 1\ \text{m}^{-1}$.",
           ),
           "CBSE Class 10 Science, Light - Reflection and Refraction"),
        tf("medium", "light",
           r"A concave mirror always forms a virtual and erect image, regardless of object position.",
           False,
           steps(
               r"**Claim to test.** 'A concave mirror *always* gives a virtual, erect image.'",
               r"**Step — Check the cases.** Only when the object is placed *between the pole and the focus* does a concave mirror form a virtual, erect (and enlarged) image.",
               r"**The other positions.** For any object beyond the focus, the image is real and inverted.",
               r"**Answer.** False, because it depends on where the object is.",
           ),
           "CBSE Class 10 Science, Light (concave mirror)"),
    ],
}

_C10_CHEMISTRY: Dict[str, List[RawQuestion]] = {
    "acids_bases_salts": [
        sc("easy", "acids_bases_salts",
           r"A solution with $\text{pH} = 7$ at $25^\circ\text{C}$ is said to be:",
           [(r"neutral", True), (r"strongly acidic", False),
            (r"strongly basic", False), (r"weakly basic", False)],
           steps(
               r"**The pH scale.** It runs from $0$ to $14$ at $25^\circ\text{C}$.",
               r"**The rule.** $\text{pH} < 7$ means acidic, $\text{pH} = 7$ means neutral, and $\text{pH} > 7$ means basic.",
               r"**Apply it.** A value of exactly $7$ sits right in the middle, where $[\text{H}^+] = [\text{OH}^-]$.",
               r"**Answer.** Neutral.",
           ),
           "CBSE Class 10 Science, Acids, Bases and Salts"),
        tf("easy", "acids_bases_salts",
           r"Acids turn blue litmus paper red.",
           True,
           steps(
               r"**The litmus test.** Acids turn blue litmus *red*; bases turn red litmus *blue*.",
               r"**Quick memory aid.** 'Acid $\to$ A for red change on blue paper.' Vinegar (an acid) reddens blue litmus.",
               r"**Answer.** True.",
           ),
           "CBSE Class 10 Science, Acids, Bases and Salts (indicators)"),
        sc("medium", "acids_bases_salts",
           r"The reaction $\text{NaOH} + \text{HCl} \rightarrow \text{NaCl} + \text{H}_2\text{O}$ is an example of:",
           [(r"neutralisation", True), (r"displacement", False),
            (r"combination", False), (r"decomposition", False)],
           steps(
               r"**Look at the reactants.** $\text{NaOH}$ is a base and $\text{HCl}$ is an acid.",
               r"**The idea.** When an acid and a base react, they cancel each other's nature and produce a salt plus water — this is called *neutralisation*.",
               r"**Match the products.** Here the salt is $\text{NaCl}$ and water is $\text{H}_2\text{O}$, exactly fitting the pattern.",
               r"**Answer.** Neutralisation reaction.",
           ),
           "CBSE Class 10 Science, Acids, Bases and Salts (neutralisation)"),
    ],
    "chemical_reactions": [
        sc("easy", "chemical_reactions",
           r"The reaction $2\text{Mg} + \text{O}_2 \rightarrow 2\text{MgO}$ is best classified as a:",
           [(r"combination reaction", True), (r"decomposition reaction", False),
            (r"double displacement reaction", False), (r"neutralisation reaction", False)],
           steps(
               r"**Count the reactants and products.** Two substances, magnesium and oxygen, go in; a single substance, magnesium oxide, comes out.",
               r"**The rule.** When two or more reactants join to form one product, it is a *combination* reaction.",
               r"**Bonus observation.** Magnesium gains oxygen here, so it is also an example of oxidation.",
               r"**Answer.** Combination reaction.",
           ),
           "CBSE Class 10 Science, Chemical Reactions and Equations"),
        tf("medium", "chemical_reactions",
           r"In a balanced chemical equation, the total mass of reactants equals the total mass of products.",
           True,
           steps(
               r"**Law of conservation of mass.** In a chemical reaction, atoms are only rearranged — none are created or destroyed.",
               r"**What balancing does.** A balanced equation has the same number of each type of atom on both sides, so the total mass must match too.",
               r"**Answer.** True.",
           ),
           "CBSE Class 10 Science, Chemical Reactions and Equations"),
    ],
}

_C10_BIOLOGY: Dict[str, List[RawQuestion]] = {
    "life_processes": [
        sc("easy", "life_processes",
           r"The green pigment in plants that absorbs light for photosynthesis is:",
           [(r"chlorophyll", True), (r"haemoglobin", False),
            (r"melanin", False), (r"carotene", False)],
           steps(
               r"**The job.** Photosynthesis needs something to *capture* light energy.",
               r"**The pigment.** **Chlorophyll**, found in chloroplasts, absorbs light (mainly red and blue) and gives leaves their green colour.",
               r"**Rule out the rest.** Haemoglobin carries oxygen in blood, melanin colours skin, and carotene is only a helper pigment.",
               r"**Answer.** Chlorophyll.",
           ),
           "CBSE Class 10 Science, Life Processes (nutrition)"),
        sc("medium", "life_processes",
           r"The overall word equation for photosynthesis can be written as: carbon dioxide + water $\xrightarrow{\text{light, chlorophyll}}$ ____ + oxygen. The missing product is:",
           [(r"glucose", True), (r"protein", False),
            (r"starch only", False), (r"lactic acid", False)],
           steps(
               r"**Write the balanced equation.** $$6\text{CO}_2 + 6\text{H}_2\text{O} \xrightarrow{\text{light}} \text{C}_6\text{H}_{12}\text{O}_6 + 6\text{O}_2.$$",
               r"**Read off the products.** Besides oxygen, the plant makes the carbohydrate glucose, $\text{C}_6\text{H}_{12}\text{O}_6$.",
               r"**Why not the others.** Proteins and lactic acid are not made directly here, and starch is only formed *later* by joining many glucose units.",
               r"**Answer.** Glucose.",
           ),
           "CBSE Class 10 Science, Life Processes (photosynthesis)"),
        tf("easy", "life_processes",
           r"Human beings breathe out carbon dioxide during respiration.",
           True,
           steps(
               r"**The respiration equation.** $$\text{C}_6\text{H}_{12}\text{O}_6 + 6\text{O}_2 \rightarrow 6\text{CO}_2 + 6\text{H}_2\text{O} + \text{energy}.$$",
               r"**Read off the products.** Oxygen is used up and carbon dioxide is produced, which we then breathe out.",
               r"**Answer.** True.",
           ),
           "CBSE Class 10 Science, Life Processes (respiration)"),
    ],
}

_C10_MATH: Dict[str, List[RawQuestion]] = {
    "quadratic_equations": [
        sc("easy", "quadratic_equations",
           r"The roots of a quadratic equation $ax^2 + bx + c = 0$ are given by the formula:",
           [(r"$x = \dfrac{-b \pm \sqrt{b^2 - 4ac}}{2a}$", True),
            (r"$x = \dfrac{-b \pm \sqrt{b^2 + 4ac}}{2a}$", False),
            (r"$x = \dfrac{b \pm \sqrt{b^2 - 4ac}}{2a}$", False),
            (r"$x = \dfrac{-b \pm \sqrt{4ac - b^2}}{2a}$", False)],
           steps(
               r"**The equation.** $ax^2 + bx + c = 0$, where $a \neq 0$.",
               r"**Where the formula comes from.** Completing the square on this equation leads to the general solution.",
               r"**The quadratic formula.** $$x = \dfrac{-b \pm \sqrt{b^2 - 4ac}}{2a}.$$",
               r"**Watch the signs.** It is $-b$ on top and $b^2 - 4ac$ under the root (not $b^2 + 4ac$).",
               r"**Answer.** $x = \dfrac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.",
           ),
           "CBSE Class 10 Mathematics, Quadratic Equations"),
        sc("medium", "quadratic_equations",
           r"For the equation $x^2 - 5x + 6 = 0$, the roots are:",
           [(r"$2$ and $3$", True), (r"$-2$ and $-3$", False),
            (r"$1$ and $6$", False), (r"$-1$ and $-6$", False)],
           steps(
               r"**Step 1 — Split the middle term.** We need two numbers that **multiply to $6$** and **add to $5$**. Those numbers are $2$ and $3$.",
               r"**Step 2 — Factorise.** $$x^2 - 5x + 6 = (x-2)(x-3) = 0.$$",
               r"**Step 3 — Use the zero-product rule.** If a product is $0$, one factor must be $0$: $x - 2 = 0$ or $x - 3 = 0$.",
               r"**Answer.** $x = 2$ and $x = 3$.",
           ),
           "CBSE Class 10 Mathematics, Quadratic Equations (factorisation)"),
        tf("medium", "quadratic_equations",
           r"If the discriminant $D = b^2 - 4ac > 0$, the quadratic equation has two distinct real roots.",
           True,
           steps(
               r"**What the discriminant is.** $D = b^2 - 4ac$ is the quantity under the square root in the quadratic formula.",
               r"**The three cases.** $D > 0 \Rightarrow$ two distinct real roots; $D = 0 \Rightarrow$ two equal real roots; $D < 0 \Rightarrow$ no real roots (the root of a negative number is not real).",
               r"**Answer.** True.",
           ),
           "CBSE Class 10 Mathematics, Quadratic Equations (discriminant)"),
    ],
    "trigonometry": [
        sc("easy", "trigonometry",
           r"The value of $\sin 30^\circ$ is:",
           [(r"$\dfrac{1}{2}$", True), (r"$\dfrac{\sqrt{3}}{2}$", False),
            (r"$1$", False), (r"$\dfrac{1}{\sqrt{2}}$", False)],
           steps(
               r"**Standard value.** From the table of standard angles, $$\sin 30^\circ = \dfrac{1}{2}.$$",
               r"**Why.** In a $30^\circ$–$60^\circ$–$90^\circ$ triangle, the side opposite the $30^\circ$ angle is exactly half the hypotenuse, and $\sin = \dfrac{\text{opposite}}{\text{hypotenuse}}$.",
               r"**Answer.** $\dfrac{1}{2}$.",
           ),
           "CBSE Class 10 Mathematics, Introduction to Trigonometry"),
        tf("easy", "trigonometry",
           r"For all angles $\theta$, the identity $\sin^2\theta + \cos^2\theta = 1$ holds.",
           True,
           steps(
               r"**The identity.** $$\sin^2\theta + \cos^2\theta = 1.$$",
               r"**Where it comes from.** In a right triangle with sides $p$, $b$ and hypotenuse $h$, Pythagoras gives $p^2 + b^2 = h^2$. Dividing through by $h^2$ turns this into $\sin^2\theta + \cos^2\theta = 1$.",
               r"**Answer.** True, for every angle $\theta$.",
           ),
           "CBSE Class 10 Mathematics, Trigonometric Identities"),
    ],
}

# Master index: (class_level, subject) -> {topic: [items]}
BANK: Dict[Tuple[str, str], Dict[str, List[RawQuestion]]] = {
    ("12", "physics"): _C12_PHYSICS,
    ("12", "mathematics"): _C12_MATH,
    ("12", "chemistry"): _C12_CHEMISTRY,
    ("12", "biology"): _C12_BIOLOGY,
    ("10", "physics"): _C10_PHYSICS,
    ("10", "chemistry"): _C10_CHEMISTRY,
    ("10", "biology"): _C10_BIOLOGY,
    ("10", "mathematics"): _C10_MATH,
}


# Merge any Droid-authored JSON content (app/data/authored/*.json) into the bank
# so the app serves it alongside the hardcoded items.
from app.data.authored_loader import load_authored, merge_into  # noqa: E402

merge_into(BANK, load_authored())


def default_topic(class_level: str, subject: str) -> str:
    topics = BANK.get((class_level, subject))
    if topics:
        return next(iter(topics.keys()))
    return subject
