"""Recompute authored numerical answers using separate reference algorithms.

Run with the project QA environment: .course-checks/Scripts/python.exe
scripts/verify-course-calculations.py --course STAT-201
"""
from pathlib import Path
import argparse
import importlib
import json
import math

root = Path(__file__).resolve().parents[1]


class Verification:
    def __init__(self, code):
        self.code = code
        directory = root / 'content/courses' / code
        self.lessons = {path.stem: json.loads(path.read_text(encoding='utf-8')) for path in (directory / 'lessons').glob('*.json')}
        assessment_path = directory / 'assessments.json'
        assessments = json.loads(assessment_path.read_text(encoding='utf-8')) if assessment_path.exists() else []
        self.questions = {q['id']: q for item in list(self.lessons.values()) + assessments for q in item['questions']}
        self.checks = []

    def check(self, identifier, computed, expected, method, inputs, tolerance=1e-12):
        difference = abs(float(computed) - float(expected))
        if not math.isfinite(float(computed)) or difference > tolerance:
            raise AssertionError((identifier, computed, expected, tolerance))
        self.checks.append({'id': identifier, 'inputs': inputs, 'method': method, 'computed': float(computed), 'exact_or_repr': str(computed), 'declared': expected, 'tolerance': tolerance, 'absolute_error': difference, 'status': 'passed'})

    def numeric(self, identifier, computed, method, inputs):
        question = self.questions[identifier]
        if question['type'] != 'numeric':
            raise AssertionError('Expected numerical question: ' + identifier)
        self.check(identifier, computed, question['answer'], method, inputs, question['tolerance'])

    def finish(self):
        checked = {item['id'] for item in self.checks}
        required = {q['id'] for q in self.questions.values() if q['type'] == 'numeric'}
        required |= {example['calculationId'] for lesson in self.lessons.values() for example in lesson['examples'] if 'calculationId' in example}
        if required - checked:
            raise AssertionError('Numerical checks missing: ' + ', '.join(sorted(required - checked)))
        destination = root / 'content/courses' / self.code / 'calculations.json'
        destination.write_text(json.dumps({'method': 'Independent Python reference algorithms: exact enumeration, quadrature and scientific libraries.', 'checks': self.checks}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{self.code}: {len(self.checks)} independent checks passed; {len(required)} authored numerical items covered.')


parser = argparse.ArgumentParser()
parser.add_argument('--course', default='STAT-201')
parser.add_argument('--all', action='store_true')
args = parser.parse_args()
catalog = json.loads((root / 'content/courses/catalog.json').read_text(encoding='utf-8'))
codes = [course['code'] for course in catalog]
selected = codes if args.all else [args.course]
for code in selected:
    if code not in codes:
        raise ValueError('Unknown course ' + code)
    ctx = Verification(code)
    importlib.import_module('course_calculations.' + code.replace('-', '').lower()).verify(ctx)
    ctx.finish()
