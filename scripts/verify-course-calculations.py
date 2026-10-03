"""Independent recomputation: authored answers are read only for comparison.

The enumeration and rational arithmetic below do not share the author's
probability-formula construction. Additional course checks extend this registry.
"""
from fractions import Fraction
from itertools import combinations, product
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
lesson_path = root / "content/courses/STAT-201/lessons/lesson-1.json"
lesson = json.loads(lesson_path.read_text(encoding="utf-8"))
answers = {question["id"]: question for question in lesson["questions"]}
checks = []

def check(identifier, computed, expected, method):
    difference = abs(float(computed) - float(expected))
    if difference > 1e-12:
        raise AssertionError((identifier, computed, expected))
    checks.append({"id": identifier, "method": method, "computed": float(computed), "exact": str(computed), "declared": expected, "absolute_error": difference, "status": "passed"})

committee = list(combinations(range(5), 2))
check("STAT-201-example-1-1", Fraction(sum(sum(i < 2 for i in pair) == 1 for pair in committee), len(committee)), .6, "Enumerate all ten unordered committees; students 0,1 are statistics.")
coin_probabilities = {pair: (Fraction(4, 5) if pair[0] else Fraction(1, 5)) * (Fraction(4, 5) if pair[1] else Fraction(1, 5)) for pair in product([0, 1], repeat=2)}
check("STAT-201-example-1-2", sum(prob for pair, prob in coin_probabilities.items() if any(pair)), .96, "Enumerate all four biased independent-coin outcomes using exact fractions.")
# A has four equally weighted points, B has five, intersection has three.
a, b = {0, 1, 2, 3}, {0, 1, 2, 4, 5}
q = answers["STAT-201-l1-q3"]
check(q["id"], Fraction(len(a | b), 10), q["answer"], "Construct ten equally weighted points and count a set union directly.")
pairs = list(combinations(range(10), 2))
q = answers["STAT-201-l1-q4"]
check(q["id"], Fraction(sum(sum(i < 4 for i in pair) == 1 for pair in pairs), len(pairs)), q["answer"], "Enumerate all 45 ball pairs; balls 0..3 are red.")
destination = root / "content/courses/STAT-201/calculations.json"
destination.write_text(json.dumps({"method": "Independent Python enumeration and exact Fraction arithmetic", "checks": checks}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Independent checks passed: {len(checks)}")
