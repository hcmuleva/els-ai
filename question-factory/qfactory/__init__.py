"""question-factory: offline CBSE/JEE/NEET-style question generation engine.

A POC 2 that implements the spec pipeline

    Request -> Normalizer -> Syllabus Mapper -> Generator -> Solver/Verifier
            -> Difficulty Calibrator -> Quality Gate -> Schema Validator -> Export

The generator is offline (Droid-authored bank) so there is no API quota and every
numeric answer is independently re-checked with sympy. Output keeps POC 1's
envelope (metadata + validation + questions) and extends each question with the
spec's fields (bloomLevel, marks, solution, qualityChecks, tags).
"""
