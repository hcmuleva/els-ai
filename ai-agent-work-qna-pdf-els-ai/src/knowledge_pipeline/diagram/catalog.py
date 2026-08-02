"""Shared controlled-diagram vocabulary for every generation agent."""
from __future__ import annotations

from typing import Final

DIAGRAM_EXAMPLES: Final[tuple[tuple[str, str], ...]] = (
    (
        "triangle",
        '{"type":"triangle","vertices":[[0,0],[4,0],[1,3]],'
        '"vertex_labels":["A","B","C"],"side_labels":["c","a","b"],'
        '"mark_angle_at":0,"angle_label":"\\\\theta","right_angle_at":null,'
        '"equal_sides":[]}',
    ),
    (
        "right-triangle",
        '{"type":"right-triangle","leg_a":10,"leg_b":14,'
        '"orientation":"bottom-right","side_labels":["10","?","14"],'
        '"angle_at":1,"angle_label":"55°"}',
    ),
    (
        "circle",
        '{"type":"circle","radius":3,"marked":[[0,"A"],[110,"B"]],'
        '"chords":[[0,110]]}',
    ),
    ("angle", '{"type":"angle","degrees":60,"label":"60°","sweep":"minor"}'),
    (
        "function",
        '{"type":"function","expr":"x**2 - 3*x","xmin":-3,"xmax":4,'
        '"points":[[1,-2,"P"]]}',
    ),
    (
        "function-region",
        '{"type":"function-region","upper_expr":"x","lower_expr":"x**2",'
        '"xmin":0,"xmax":1,"ymin":0,"ymax":1}',
    ),
    (
        "coordinate",
        '{"type":"coordinate","points":[[3,4,"P"]],'
        '"segments":[[[0,0],[3,4],"OP"]]}',
    ),
    (
        "mensuration",
        '{"type":"mensuration","width":6,"height":4,'
        '"width_label":"6 cm","height_label":"?"}',
    ),
    (
        "lpp",
        '{"type":"lpp","constraints":[[1,1,4,"<="]],'
        '"vertices":[[0,0],[4,0],[0,4]],"optimum":[4,0,"max"]}',
    ),
    (
        "bar-chart",
        '{"type":"bar-chart","categories":["Tea","Coffee","Milk"],'
        '"values":[40,45,105],"max_value":120,"tick_step":20,'
        '"x_label":"Drink","y_label":"Frequency"}',
    ),
    (
        "pie-chart",
        '{"type":"pie-chart","categories":["Bus","Walk","Train"],'
        '"values":[6,7,11],"label_mode":"degrees","total_label":"Total: 24"}',
    ),
    (
        "pictogram",
        '{"type":"pictogram","unit":2,"key_label":"1 square = 2 people",'
        '"rows":[{"label":"Bike","value":5},{"label":"Train","value":11}]}',
    ),
    (
        "geometry",
        '{"type":"geometry","segments":[{"a":[0,0],"b":[5,0]},'
        '{"a":[0,3],"b":[5,3]},{"a":[1,-1],"b":[4,4]}],'
        '"angles":[{"vertex":[1.6,0],"p1":[5,0],"p2":[4,4],'
        '"label":"105°","sweep":"minor"}],'
        '"parallel_marks":[{"a":[0,0],"b":[5,0],"count":1},'
        '{"a":[0,3],"b":[5,3],"count":1}],'
        '"right_angles":[],"tick_marks":[]}',
    ),
    (
        "triangle-geometry",
        '{"type":"triangle-geometry","title":"Triangle with cevian and circumcircle",'
        '"polygons":[{"vertices":[[-3,0],[3,0],[0,3]],'
        '"labels":["A","B","C"],"role":"triangle"}],'
        '"circles":[{"center":[0,0],"radius":3,"role":"circumcircle"}],'
        '"segments":[{"a":[0,3],"b":[0,0],"role":"cevian","label":"CD"}],'
        '"points":[[0,0,"D"]],'
        '"angles":[{"vertex":[0,3],"p1":[-3,0],"p2":[0,0],"label":"α"},'
        '{"vertex":[0,3],"p1":[0,0],"p2":[3,0],"label":"β"}]}',
    ),
    (
        "circle-geometry",
        '{"type":"circle-geometry","title":"Tangent-secant configuration",'
        '"circles":[{"center":[0,0],"radius":3,"role":"circle","label":"O"}],'
        '"segments":[{"a":[3,-3],"b":[3,3],"role":"tangent","label":"t"},'
        '{"a":[-4,-1],"b":[3.5,1.5],"role":"secant"},'
        '{"a":[0,0],"b":[3,0],"role":"radius","label":"OT"}],'
        '"points":[[0,0,"O"],[3,0,"T"],[-2.85,-0.95,"A"],[2.85,0.95,"B"]],'
        '"right_angles":[{"vertex":[3,0],"p1":[0,0],"p2":[3,3]}]}',
    ),
    (
        "solid-geometry",
        '{"type":"solid-geometry","title":"Projected tetrahedron",'
        '"polygons":[{"vertices":[[-3,-2],[3,-2],[1,2]],'
        '"fill":"#dbeafe","fill_opacity":0.2,"role":"visible_face"}],'
        '"segments":[{"a":[-3,-2],"b":[0,4],"role":"visible_edge"},'
        '{"a":[3,-2],"b":[0,4],"role":"visible_edge"},'
        '{"a":[1,2],"b":[0,4],"role":"visible_edge"},'
        '{"a":[-3,-2],"b":[1,2],"dashed":true,"role":"hidden_edge"},'
        '{"a":[3,-2],"b":[1,2],"dashed":true,"role":"hidden_edge"}],'
        '"points":[[-3,-2,"A"],[3,-2,"B"],[1,2,"C"],[0,4,"D"]]}',
    ),
    (
        "inclined-plane",
        '{"type":"inclined-plane","angle_degrees":30,'
        '"friction_up_slope":true}',
    ),
    (
        "projectile",
        '{"type":"projectile","speed":20,"angle_degrees":45,"gravity":9.8}',
    ),
    (
        "convex-lens",
        '{"type":"convex-lens","focal_length":2,'
        '"object_distance":6,"object_height":2}',
    ),
    (
        "magnetic-flux",
        '{"type":"magnetic-flux","area_label":"A=0.02 m²",'
        '"field_label":"B=0.5 T","normal_label":"n",'
        '"angle_degrees":60,"angle_label":"60°"}',
    ),
    (
        "lr-circuit",
        '{"type":"lr-circuit","voltage_label":"V=12 V",'
        '"resistance_label":"R=4 Ω","inductance_label":"L=2 H",'
        '"current_label":"I"}',
    ),
    (
        "current-time",
        '{"type":"current-time","final_current_label":"I∞","percentage":75}',
    ),
    (
        "transformer-circuit",
        '{"type":"transformer-circuit","np_label":"Np=500",'
        '"ns_label":"Ns=100","primary_voltage_label":"Vp=200 V rms",'
        '"secondary_voltage_label":"Vs=?"}',
    ),
    (
        "coupled-coils",
        '{"type":"coupled-coils","l1_label":"L1=4 H",'
        '"l2_label":"L2=9 H","coupling_label":"k=0.5",'
        '"current_label":"i1=3t²","emf_label":"ε2",'
        '"mutual_label":"M=k√(L1L2)","flux_label":"mutual flux Φ12",'
        '"dot_convention":true}',
    ),
    (
        "refraction",
        '{"type":"refraction","incident_angle":45,"refracted_angle":28}',
    ),
    (
        "chemical-reaction",
        '{"type":"chemical-reaction","reactants":"2H₂ + O₂",'
        '"products":"2H₂O","condition":"ignition"}',
    ),
)


def diagram_prompt_guide(field_name: str = "diagram") -> str:
    lines = [
        f'DIAGRAM SPEC (set "{field_name}" to one controlled object below, or null).',
        "The server renders and validates the SVG. Never write raw SVG.",
        "Use a diagram only when it is required or materially improves reasoning.",
        "Displayed lengths, angles, relations, chart values, and unknowns must match the stem.",
        "Geometry must be proportional; never encode or reveal a derived answer unless it is given.",
    ]
    lines.extend(f"- {name}: {example}" for name, example in DIAGRAM_EXAMPLES)
    return "\n".join(lines)


def supported_diagram_types() -> tuple[str, ...]:
    return tuple(name for name, _ in DIAGRAM_EXAMPLES)
