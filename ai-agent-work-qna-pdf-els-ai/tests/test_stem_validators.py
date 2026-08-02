from knowledge_pipeline.config import IdentityConfig
from knowledge_pipeline.diagram import builders
from knowledge_pipeline.diagram.dsl import (
    AngleMark,
    Arrow,
    DiagramSpec,
    Label,
    Polygon,
)
from knowledge_pipeline.quizschema.adapter import to_target_question
from knowledge_pipeline.validators import validate_question


def _wrapped(
    stem,
    explanation,
    option_values,
    correct_index,
    *,
    subject="Physics",
    topic="Electromagnetic Induction",
    diagram=None,
):
    item = {
        "stem": stem,
        "explanation": explanation,
        "subject": subject,
        "topic": topic,
        "level_band": "jee_main",
        "bloom_level": "Apply",
        "options": [
            {
                "label": value,
                "is_correct": index == correct_index,
                "rationale": "",
            }
            for index, value in enumerate(option_values)
        ],
        "question_diagram": diagram,
    }
    return to_target_question(
        item,
        IdentityConfig(subject=subject, class_level="Class 12"),
        quiz_id="validator-test",
        quiz_title="Validator Test",
    ).wrapped()


def test_transformer_question_rejects_generic_geometry():
    question = _wrapped(
        "An ideal transformer has primary and secondary coils. Which relation uses Np and Ns?",
        "The voltage ratio equals the turns ratio.",
        ["Vp/Vs = Np/Ns", "Vp/Vs = Ns/Np", "Vp = Vs", "Np = Ns"],
        0,
        topic="Transformers",
        diagram=builders.mensuration_rectangle(4, 2, "a", "b"),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "reject"
    assert "diagram_irrelevant" in report["critical_failures"]
    assert "primary_coil" in report["checks"]["diagram_required_objects"]["missing_objects"]


def test_magnetic_flux_question_rejects_angle_only_diagram():
    question = _wrapped(
        "A conducting loop of area A is in magnetic field B at 60° to its normal. Find magnetic flux.",
        "Magnetic flux is \\(\\Phi=BA\\cos 60^\\circ\\).",
        [
            "\\(BA/2\\)",
            "\\(BA\\)",
            "\\(2BA\\)",
            "\\(0\\)",
        ],
        0,
        diagram=builders.angle_diagram(label="60°"),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "reject"
    assert "conducting_loop" in report["checks"]["diagram_required_objects"]["missing_objects"]
    assert "magnetic_field_vector" in report["checks"]["diagram_required_objects"]["missing_objects"]


def test_mutual_induction_rejects_answer_explanation_mismatch():
    question = _wrapped(
        "Two coils have \\(L_1=4\\,\\mathrm{H}\\), \\(L_2=9\\,\\mathrm{H}\\), "
        "\\(k=0.5\\), and \\(i_1=3t^2\\). Find emf at \\(t=2\\,\\mathrm{s}\\).",
        "M = 3 H and di/dt = 12 A/s, hence the induced emf is 36 V.",
        ["18 V", "36 V", "12 V", "6 V"],
        0,
        diagram=builders.coupled_coils(
            l1_label="L1=4 H",
            l2_label="L2=9 H",
            coupling_label="k=0.5",
            current_label="i1=3t²",
            emf_label="ε2",
        ),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "reject"
    assert "answer_explanation_mismatch" in report["critical_failures"]
    assert report["checks"]["physics_correctness"]["expected"] == "36 V"
    assert report["checks"]["diagram_labels"]["missing_units"] == []


def test_schematic_mutual_induction_score_reflects_missing_context():
    question = _wrapped(
        "Two coils have L1=4 H, L2=9 H, k=0.5, and i1=3t². "
        "Find the induced emf at t=2 s.",
        "M=3 H and di1/dt=12 A/s, hence the induced emf is 36 V.",
        ["18 V", "36 V", "12 V", "6 V"],
        1,
        diagram=builders.coupled_coils(
            l1_label="L1=4 H",
            l2_label="L2=9 H",
            coupling_label="k=0.5",
            current_label="i1=3t²",
            emf_label="ε2",
        ),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "accept"
    assert 88 <= report["score"] <= 92
    assert report["checks"]["diagram_required_objects"][
        "recommended_context_missing"
    ] == [
        "mutual inductance M",
        "mutual flux direction",
        "dot convention",
    ]


def test_lr_current_graph_with_generic_axes_requires_repair():
    question = _wrapped(
        "The graph shows current growth in an LR circuit. At what shape does current approach its final value?",
        "The current rises exponentially toward its final value.",
        ["Exponential rise", "Linear rise", "Constant value", "Sinusoidal rise"],
        0,
        topic="LR Current Growth",
        diagram=builders.function_plot("1-exp(-2*x)", xmin=0, xmax=4, ymin=0, ymax=1.1),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "repair_required"
    assert "generic x/y axes" in " ".join(
        report["checks"]["graph_quality"]["issues"]
    )
    assert not report["critical_failures"]


def test_lr_current_graph_with_physical_axes_and_marker_passes():
    question = _wrapped(
        "From the graph, identify when LR circuit current reaches 75% of its final value.",
        "For exponential current growth, the marked point represents 75% of final current.",
        ["Marked 75% point", "Origin", "Final asymptote", "Negative time"],
        0,
        topic="LR Current Growth",
        diagram=builders.current_time_graph(percentage=75),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "accept"
    assert report["checks"]["graph_quality"]["status"] == "pass"
    assert report["checks"]["svg_schema"]["source_element_count"] == (
        report["checks"]["svg_schema"]["rendered_element_count"]
    )
    assert report["checks"]["svg_schema"]["missing_rendered_labels"] == []
    assert report["selected_static_engine"] == "deterministic_svg"
    assert report["animations_allowed"] is False


def test_placeholder_diagram_label_is_rejected():
    question = _wrapped(
        "A conducting loop of area A is placed in magnetic field B at angle θ to normal n.",
        "The flux is \\(\\Phi=BA\\cos\\theta\\).",
        ["\\(BA\\cos\\theta\\)", "\\(BA\\sin\\theta\\)", "\\(BA\\)", "\\(0\\)"],
        0,
        diagram=builders.magnetic_flux_loop(area_label="abc"),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "reject"
    assert "placeholder_label" in report["critical_failures"]
    assert "abc" in report["checks"]["placeholder_detection"]["found_placeholders"]


def test_physics_question_labeled_mathematics_is_rejected():
    question = _wrapped(
        "Find magnetic flux through a conducting loop in magnetic field B.",
        "The magnetic flux is \\(\\Phi=BA\\).",
        ["\\(BA\\)", "\\(B/A\\)", "\\(A/B\\)", "\\(0\\)"],
        0,
        subject="Mathematics",
        diagram=builders.magnetic_flux_loop(angle_degrees=0, angle_label="0°"),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "reject"
    assert "subject_mismatch" in report["critical_failures"]


def test_flux_diagram_missing_b_vector_is_rejected():
    flux_without_field = DiagramSpec(
        kind="physics-magnetic-flux",
        width=440,
        height=330,
        xmin=-4,
        xmax=4,
        ymin=-3,
        ymax=4,
        elements=[
            Polygon(points=[(-2, -1), (2, -1), (2.5, 1), (-1.5, 1)]),
            Label(at=(-0.5, 0), text="A"),
            Arrow(start=(0, 0), end=(0, 3), label="n"),
            AngleMark(vertex=(0, 0), p1=(0, 3), p2=(2, 2), label="45°"),
        ],
    )
    question = _wrapped(
        "A conducting loop of area A is in field B at 45° to normal n.",
        "The flux is \\(\\Phi=BA\\cos45^\\circ\\).",
        ["\\(BA/\\sqrt{2}\\)", "\\(BA\\)", "\\(0\\)", "\\(BA/2\\)"],
        0,
        diagram=flux_without_field,
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "reject"
    assert "magnetic_field_vector" in report["checks"]["diagram_required_objects"]["missing_objects"]


def test_rendered_svg_roles_must_match_diagram_spec():
    question = _wrapped(
        "Two coils have mutual inductance and changing current in coil 1.",
        "The changing current produces an induced emf in coil 2.",
        ["Mutual induction", "Self induction", "Resistance", "Capacitance"],
        0,
        diagram=builders.coupled_coils(),
    )
    question["question"]["question_svg"] = question["question"][
        "question_svg"
    ].replace(' data-semantic-role="coil_1"', "", 1)

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "reject"
    assert "diagram_render_mismatch" in report["critical_failures"]
    assert report["checks"]["svg_schema"]["status"] == "fail"


def test_transformer_numeric_comparison_ignores_rms_unit_suffix():
    question = _wrapped(
        "An ideal transformer has Vp=200 V rms, Np=500, and Ns=125. Find Vs.",
        "Using Vs=Vp Ns/Np gives 50.",
        ["50 V rms", "200 V rms", "12.5 V rms", "50 A"],
        0,
        topic="Transformers",
        diagram=builders.transformer_circuit(
            np_label="Np=500",
            ns_label="Ns=125",
            primary_voltage_label="Vp=200 V rms",
            secondary_voltage_label="Vs=?",
        ),
    )

    report = validate_question(question, quiz_subject="Physics", require_diagram=True)

    assert report["decision"] == "accept"
    assert report["checks"]["answer_key_consistency"]["status"] == "pass"
    assert report["checks"]["physics_correctness"]["ran"] is True
    assert report["checks"]["physics_correctness"]["expected"] == "50 V"
    assert "load_resistor" not in report["checks"]["diagram_required_objects"][
        "detected_objects"
    ]
    assert report["checks"]["svg_schema"]["rendered_object_counts"] == {
        "coil_count": 2,
        "transformer_core_count": 1,
        "resistor_count": 0,
        "inductor_count": 0,
        "field_vector_count": 0,
        "loop_count": 0,
        "angle_marker_count": 0,
    }


def test_series_aiding_mutual_inductance_formula_is_checked():
    question = _wrapped(
        "Two coupled coils have L1=4 H, L2=9 H, and M=2 H. "
        "Find the series aiding equivalent inductance.",
        "For series aiding, Leq=L1+L2+2M=4+9+4=17 H.",
        ["17 H", "9 H", "13 H", "21 H"],
        0,
        topic="Mutual induction",
    )

    report = validate_question(question, quiz_subject="Physics")

    assert report["decision"] == "accept"
    assert report["checks"]["physics_correctness"]["ran"] is True
    assert report["checks"]["physics_correctness"]["formula"] == (
        "Leq = L1 + L2 + 2M"
    )
    assert report["checks"]["physics_correctness"]["expected"] == "17 H"
