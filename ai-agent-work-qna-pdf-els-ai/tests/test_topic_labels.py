from knowledge_pipeline.topic_labels import clean_topic_label


def test_clean_topic_label_removes_practice_page_reference() -> None:
    assert (
        clean_topic_label("1.1 LinearEquations practice pages 11-13")
        == "1.1 Linear Equations"
    )


def test_clean_topic_label_collapses_subject_wide_embedded_reference() -> None:
    value = (
        "Mathematics, across all embedded topics: "
        "1.1 Linear Equations practice pages 11-13, 1.2 Quadratic Equations"
    )

    assert clean_topic_label(value, "Mathematics") == "Mathematics"
