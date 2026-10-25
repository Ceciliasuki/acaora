"""ACAORA loopback reproduction companion. No uploads, installs, or arbitrary code.

Run beside analysis.py, analysis.R and requirements.txt:
  python local-runner.py --allow-origin http://127.0.0.1:3220
Paste the one-time startup token into ACAORA. Keep this terminal open.
"""
from __future__ import annotations

import argparse
from collections import OrderedDict
from datetime import datetime, timezone
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlsplit
import uuid

PROTOCOL = 'acaora-local-runner-v1'
MAX_REQUEST_BYTES = 25 * 1024 * 1024
MAX_OUTPUT_BYTES = 10 * 1024 * 1024
ROOT = Path(__file__).resolve().parent
ENGINES = {'basic': 'acaora-stats-v2', 'ols': 'acaora-ols-v2', 'advanced': 'acaora-advanced-v4'}
ADVANCED = {'logistic', 'cluster', 'fixed', 'paired', 'anova', 'welchanova', 'posthoc', 'mannwhitney', 'wilcoxon', 'pca', 'kmeans', 'cv', 'classification', 'bootstrap'}
PYTHON_PROBE = '''import importlib.metadata as m,json,platform
v={'python':platform.python_version()}
for p in ['numpy','scipy','statsmodels','pandas']:
 try:v[p]=m.version(p)
 except m.PackageNotFoundError:v[p]='missing'
print(json.dumps(v))'''
R_PROBE = '''cat(paste0("R\\t",R.version.string,"\\n"));for(p in c("jsonlite","digest"))cat(paste0(p,"\\t",tryCatch(as.character(packageVersion(p)),error=function(e)"missing"),"\\n"))'''


class Problem(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code = status, code


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical_json(value):
    """Match browser canonical JSON, including UTF-16 keys and JS number cutoffs."""
    if value is None or isinstance(value, (str, bool)):
        token = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        return ''.join('\\u%04x' % ord(c) if 0xd800 <= ord(c) <= 0xdfff else c for c in token)
    if isinstance(value, (int, float)):
        number = float(value)
        if not math.isfinite(number):
            raise ValueError('Non-finite JSON number')
        if number == 0:
            return '0'
        negative = '-' if number < 0 else ''
        mantissa, _, exponent = repr(abs(number)).lower().partition('e')
        whole, _, fraction = mantissa.partition('.')
        digits = (whole + fraction).rstrip('0')
        point = len(whole) + int(exponent or '0')
        if 1e-6 <= abs(number) < 1e21:
            body = '0.' + '0' * (-point) + digits if point <= 0 else digits + '0' * (point - len(digits)) if point >= len(digits) else digits[:point] + '.' + digits[point:]
        else:
            power = point - 1
            body = digits[0] + ('.' + digits[1:] if len(digits) > 1 else '') + 'e' + ('+' if power >= 0 else '') + str(power)
        return negative + body
    if isinstance(value, list):
        return '[' + ','.join(canonical_json(v) for v in value) + ']'
    if isinstance(value, dict):
        return '{' + ','.join(canonical_json(k) + ':' + canonical_json(value[k]) for k in sorted(value, key=lambda k: k.encode('utf-16-be', errors='surrogatepass'))) + '}'
    raise ValueError('Unsupported JSON value')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key')
        result[key] = value
    return result


def strict_json(raw):
    return json.loads(raw, object_pairs_hook=unique_object, parse_constant=lambda token: (_ for _ in ()).throw(ValueError('Non-finite JSON')))


def field(value, required=False):
    return isinstance(value, str) and len(value) <= 500 and (not required or bool(value.strip())) and not any(ord(c) < 32 for c in value)


def valid_analysis(analysis):
    if not isinstance(analysis, dict) or set(analysis) - {'kind', 'config', 'tables', 'charts'} or not isinstance(analysis.get('kind'), str) or analysis['kind'] not in ENGINES or not isinstance(analysis.get('config'), dict):
        return False
    c, kind = analysis['config'], analysis['kind']
    if kind == 'basic':
        return set(c) == {'method', 'x', 'y', 'group', 'value'} and c['method'] in ('describe', 'relation', 'test') and all(field(v) for v in c.values())
    cats = c.get('categoricals', [])
    if not isinstance(cats, list) or len(cats) > 6 or any(not isinstance(v, dict) or set(v) != {'name', 'reference'} or not field(v['name'], True) or not field(v['reference'], True) for v in cats):
        return False
    if not isinstance(c.get('predictors'), list) or len(c['predictors']) > 12 or any(not field(v, True) for v in c['predictors']) or len(set(c['predictors'])) != len(c['predictors']):
        return False
    if kind == 'ols':
        return not set(c) - {'outcome', 'predictors', 'standardErrors', 'categoricals'} and field(c.get('outcome'), True) and c.get('standardErrors') in ('classical', 'HC3') and 1 <= len(c['predictors']) + len(cats) <= 12
    allowed = {'method', 'outcome', 'predictors', 'group', 'second', 'components', 'clusters', 'folds', 'seed', 'validation', 'time', 'categoricals', 'posthocFamily', 'posthocReference', 'threshold', 'bootstrapStatistic', 'bootstrapUnit', 'bootstrapCluster', 'bootstrapIterations'}
    if set(c) - allowed or not isinstance(c.get('method'), str) or c['method'] not in ADVANCED or not all(field(c.get(k)) for k in ('outcome', 'group', 'second')):
        return False
    for key, low, high in [('components', 1, 12), ('clusters', 2, 12), ('folds', 2, 10), ('seed', 0, 4294967295), ('bootstrapIterations', 100, 2000)]:
        if key not in c and key == 'bootstrapIterations':
            continue
        if type(c.get(key)) is not int or not low <= c[key] <= high:
            return False
    for key, options in [('validation', ('random', 'group', 'time')), ('posthocFamily', ('all', 'reference')), ('bootstrapStatistic', ('mean', 'paired-difference', 'difference', 'correlation')), ('bootstrapUnit', ('row', 'cluster'))]:
        if key in c and c[key] not in options:
            return False
    return all(field(c[k]) for k in ('time', 'posthocReference', 'bootstrapCluster') if k in c) and ('threshold' not in c or type(c['threshold']) in (int, float) and math.isfinite(c['threshold']) and 0 <= c['threshold'] <= 1)


def validate_job(body):
    if not isinstance(body, dict) or set(body) - {'requestId', 'runtime', 'manifest', 'data', 'expectedEnvironment'} or not {'requestId', 'runtime', 'manifest', 'data'} <= set(body):
        raise Problem(400, 'INVALID_REQUEST', 'Only requestId, runtime, manifest, data and expectedEnvironment are accepted.')
    try:
        request_id = uuid.UUID(body['requestId'])
        if request_id.version not in range(1, 6) or str(request_id) != body['requestId'].lower():
            raise ValueError()
    except (ValueError, TypeError, AttributeError):
        raise Problem(400, 'INVALID_REQUEST_ID', 'Use a UUID requestId and preserve it when retrying.') from None
    if body['runtime'] not in ('python', 'r'):
        raise Problem(400, 'INVALID_RUNTIME', 'Choose python or r.')
    if 'expectedEnvironment' in body and not isinstance(body['expectedEnvironment'], str) or 'expectedEnvironment' in body and not re.fullmatch('[a-f0-9]{64}', body['expectedEnvironment']):
        raise Problem(400, 'INVALID_ENVIRONMENT', 'expectedEnvironment must be a SHA-256 value.')
    data, manifest = body['data'], body['manifest']
    if not isinstance(data, dict) or set(data) != {'headers', 'rows'} or not isinstance(data['headers'], list) or not 1 <= len(data['headers']) <= 2000 or any(not field(h, True) for h in data['headers']) or len(set(data['headers'])) != len(data['headers']) or not isinstance(data['rows'], list) or not 1 <= len(data['rows']) <= 100000:
        raise Problem(400, 'INVALID_DATA', 'Data requires unique headers and 1–100000 string-valued rows.')
    if any(not isinstance(row, list) or len(row) != len(data['headers']) or any(not isinstance(cell, str) for cell in row) for row in data['rows']):
        raise Problem(400, 'INVALID_DATA', 'Every row must match the header width and contain strings.')
    if not isinstance(manifest, dict) or manifest.get('format') != 'acaora-reproduction-pack' or manifest.get('version') != 1 or not valid_analysis(manifest.get('analysis')) or not isinstance(manifest.get('dataset'), dict):
        raise Problem(400, 'INVALID_MANIFEST', 'Use a current ACAORA reproduction manifest and recognised model settings.')
    # JS export writes the headers key before rows; do not hash transport whitespace.
    raw = json.dumps({'headers': data['headers'], 'rows': data['rows']}, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
    actual = digest(raw)
    identity = manifest.get('verificationIdentity')
    if not isinstance(identity, dict) or set(identity) != {'engine', 'settingsHash', 'dataFingerprint', 'sourceFingerprint'} or any(not isinstance(identity.get(k), str) for k in identity) or any(not re.fullmatch('[a-f0-9]{64}', identity[k]) for k in ('settingsHash', 'dataFingerprint', 'sourceFingerprint')):
        raise Problem(400, 'INVALID_IDENTITY', 'The manifest needs a complete verificationIdentity.')
    settings = {k: manifest['analysis'][k] for k in ('kind', 'config')}
    if identity['engine'] != ENGINES[settings['kind']] or identity['settingsHash'] != digest(canonical_json(settings).encode('utf-8')) or identity['dataFingerprint'] != actual or manifest['dataset'].get('fingerprint') != actual or identity['sourceFingerprint'] != manifest['dataset'].get('sourceFingerprint'):
        raise Problem(400, 'IDENTITY_MISMATCH', 'Data, model settings or engine SHA-256 identity does not match the manifest.')
    if manifest['dataset'].get('headers') != data['headers'] or manifest['dataset'].get('rows') != len(data['rows']):
        raise Problem(400, 'DATASET_MISMATCH', 'Manifest row count and headers must match the actual processed table.')
    return raw


def executable(value, required=False):
    found = shutil.which(value) if value else None
    path = Path(found or value).expanduser().resolve() if found or value else None
    if path and path.is_file():
        return str(path)
    if required:
        raise ValueError('Configured executable was not found: ' + str(value))
    return None


def allowed_origin(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('Use an exact http(s) origin, without a path or credentials.')
    if parsed.scheme == 'http' and parsed.hostname not in ('127.0.0.1', 'localhost'):
        raise ValueError('Plain HTTP origins must be localhost or 127.0.0.1.')
    return value.rstrip('/')


class Runner:
    def __init__(self, args):
        self.token = secrets.token_urlsafe(32)
        self.origins = {'https://acaora.cn', *(allowed_origin(v) for v in args.allow_origin)}
        self.python = executable(args.python, True)
        self.rscript = executable(args.rscript, bool(args.rscript)) if args.rscript else executable('Rscript')
        self.timeout, self.max_request = args.timeout, args.max_request_bytes
        self.scripts = {}
        for runtime, name in [('python', 'analysis.py'), ('r', 'analysis.R')]:
            path = ROOT / name
            if path.is_file() and not path.is_symlink() and path.stat().st_size <= 2 * 1024 * 1024:
                self.scripts[runtime] = path.read_bytes()
        if 'python' not in self.scripts or not (ROOT / 'requirements.txt').is_file():
            raise ValueError('Extract the complete companion bundle, including analysis.py and requirements.txt.')
        self.requirements = (ROOT / 'requirements.txt').read_bytes()
        if len(self.requirements) > 50000:
            raise ValueError('requirements.txt exceeds the companion budget.')
        self.job_lock, self.environment_lock, self.cache_lock = threading.Lock(), threading.Lock(), threading.Lock()
        self.cache = OrderedDict()
        self.environment, self.environment_hash = {}, ''
        self.refresh_environment()

    def probe(self, runtime):
        program = self.python if runtime == 'python' else self.rscript
        if not program:
            return {'status': 'unavailable'}
        command = [program, '-c', PYTHON_PROBE] if runtime == 'python' else [program, '--vanilla', '-e', R_PROBE]
        try:
            process = subprocess.run(command, shell=False, capture_output=True, timeout=10, cwd=ROOT, text=True, encoding='utf-8', errors='replace')
            if process.returncode or len(process.stdout) > 10000:
                return {'status': 'probe-failed'}
            if runtime == 'python':
                return strict_json(process.stdout)
            return dict(line.split('\t', 1) for line in process.stdout.splitlines() if '\t' in line)
        except (OSError, ValueError, subprocess.SubprocessError):
            return {'status': 'probe-failed'}

    def refresh_environment(self):
        with self.environment_lock:
            for runtime, raw in self.scripts.items():
                path = ROOT / ('analysis.py' if runtime == 'python' else 'analysis.R')
                if not path.is_file() or path.is_symlink() or path.read_bytes() != raw:
                    raise Problem(409, 'SCRIPT_CHANGED', 'A bundled script changed. Stop and restart the companion after reviewing the change.')
            if (ROOT / 'requirements.txt').read_bytes() != self.requirements:
                raise Problem(409, 'REQUIREMENTS_CHANGED', 'requirements.txt changed. Review it and restart the companion.')
            environment = {'format': 'acaora-environment-lock', 'version': 1, 'protocol': PROTOCOL, 'executables': {'python': self.python, 'r': self.rscript}, 'scriptHashes': {runtime: digest(raw) for runtime, raw in self.scripts.items()}, 'requirementsHash': digest(self.requirements), 'versions': {'python': self.probe('python'), 'r': self.probe('r')}}
            environment_hash = digest(canonical_json(environment).encode('utf-8'))
            path, temporary = ROOT / 'environment-lock.json', ROOT / '.environment-lock.json.tmp'
            try:
                temporary.write_text(json.dumps({**environment, 'environmentHash': environment_hash}, ensure_ascii=False, indent=2), encoding='utf-8')
                os.replace(temporary, path)
            except OSError:
                raise Problem(503, 'LOCK_NOT_WRITABLE', 'Cannot write environment-lock.json beside the companion. Extract the bundle into a writable folder.') from None
            self.environment, self.environment_hash = environment, environment_hash
            return environment, environment_hash

    def describe(self):
        environment, environment_hash = self.refresh_environment()
        return {'protocol': PROTOCOL, 'capabilities': {'python': 'python' in self.scripts, 'r': bool(self.rscript and 'r' in self.scripts)}, 'environmentHash': environment_hash, 'environment': environment, 'limits': {'requestBytes': self.max_request, 'outputBytes': MAX_OUTPUT_BYTES, 'timeoutSeconds': self.timeout, 'concurrentJobs': 1}, 'boundary': 'Only the processed table is checked; sourceFingerprint is a manifest declaration. Browser private-network access may require explicit permission.'}

    def run(self, body, raw):
        request_id, runtime = body['requestId'], body['runtime']
        payload_hash = digest(canonical_json(body).encode('utf-8'))
        with self.cache_lock:
            cached = self.cache.get(request_id)
            if cached:
                if cached[0] != payload_hash:
                    raise Problem(409, 'REQUEST_ID_CONFLICT', 'This requestId already belongs to different content. Use a new ID for an intentional new run.')
                return cached[1], cached[2]
        if not self.job_lock.acquire(blocking=False):
            raise Problem(409, 'RUNNING', 'One local run is already executing. Retry this requestId after it finishes.')
        try:
            # A second caller may have waited until the first caller completed.
            with self.cache_lock:
                cached = self.cache.get(request_id)
                if cached:
                    if cached[0] != payload_hash:
                        raise Problem(409, 'REQUEST_ID_CONFLICT', 'requestId content changed.')
                    return cached[1], cached[2]
            try:
                result = self.execute(body, raw)
                status = 200
            except Problem as issue:
                status, result = issue.status, {'error': str(issue), 'code': issue.code, 'requestId': request_id}
            with self.cache_lock:
                self.cache[request_id] = (payload_hash, status, result)
                while len(self.cache) > 8:
                    self.cache.popitem(last=False)
            return status, result
        finally:
            self.job_lock.release()

    def execute(self, body, raw):
        runtime = body['runtime']
        program = self.python if runtime == 'python' else self.rscript
        if not program or runtime not in self.scripts:
            raise Problem(503, 'RUNTIME_UNAVAILABLE', 'This runtime is unavailable. Configure --rscript or use Python; nothing was installed automatically.')
        environment, environment_hash = self.refresh_environment()
        if body.get('expectedEnvironment') not in (None, environment_hash):
            raise Problem(409, 'ENVIRONMENT_MISMATCH', 'The local environment changed. Reconnect and review the new environment lock before running.')
        started_at, started = datetime.now(timezone.utc).isoformat(), time.monotonic()
        with tempfile.TemporaryDirectory(prefix='acaora-reproduction-') as folder:
            root = Path(folder)
            script = root / ('analysis.py' if runtime == 'python' else 'analysis.R')
            script.write_bytes(self.scripts[runtime])
            (root / 'requirements.txt').write_bytes(self.requirements)
            (root / 'analysis-data.json').write_bytes(raw)
            (root / 'manifest.json').write_text(json.dumps(body['manifest'], ensure_ascii=False, allow_nan=False), encoding='utf-8')
            command = [program, str(script)] if runtime == 'python' else [program, '--vanilla', str(script)]
            # Fixed local scripts only; stdout/stderr go to capped-at-read files,
            # avoiding unbounded capture_output memory for a faulty native runtime.
            with (root / 'stdout.txt').open('wb') as stdout, (root / 'stderr.txt').open('wb') as stderr:
                try:
                    process = subprocess.run(command, shell=False, cwd=root, stdout=stdout, stderr=stderr, timeout=self.timeout)
                except subprocess.TimeoutExpired:
                    raise Problem(408, 'RUN_TIMEOUT', 'The fixed local script exceeded the configured time limit and was stopped.') from None
                except OSError:
                    raise Problem(503, 'RUNTIME_START_FAILED', 'The configured runtime could not start.') from None
            if process.returncode:
                with (root / 'stderr.txt').open('rb') as stream:
                    detail = stream.read(3000).decode('utf-8', errors='replace')
                raise Problem(422, 'RUN_FAILED', 'The local script failed; input data was not uploaded. ' + detail)
            output = root / ('python-results.json' if runtime == 'python' else 'r-results.json')
            if not output.is_file() or output.is_symlink() or output.stat().st_size > MAX_OUTPUT_BYTES:
                raise Problem(413, 'OUTPUT_LIMIT', 'The script produced no supported result file or exceeded the 10 MiB output limit.')
            try:
                result = strict_json(output.read_bytes())
            except (ValueError, UnicodeError, RecursionError):
                raise Problem(422, 'INVALID_OUTPUT', 'The script result is not finite, unambiguous JSON.') from None
        if not isinstance(result, dict) or result.get('verificationIdentity') != body['manifest']['verificationIdentity'] or not isinstance(result.get('versions'), dict) or not result['versions'] or len(result['versions']) > 30 or any(not field(k, True) or not isinstance(v, str) or len(v) > 500 for k, v in result['versions'].items()):
            raise Problem(422, 'INVALID_OUTPUT_IDENTITY', 'The fixed runtime did not return matching verification identity and software versions.')
        expected_versions = environment['versions'][runtime]
        if any(k in expected_versions and expected_versions[k] not in ('missing', v) for k, v in result['versions'].items()):
            raise Problem(409, 'ENVIRONMENT_DRIFT', 'Reported software versions differ from the environment lock; review the runtime before trusting this output.')
        result['executionReceipt'] = {'protocol': PROTOCOL, 'scriptHash': digest(self.scripts[runtime]), 'requirementsHash': digest(self.requirements), 'environmentHash': environment_hash, 'startedAt': started_at, 'elapsedMs': round((time.monotonic() - started) * 1000), 'requestId': body['requestId'], 'runtime': runtime}
        if len(json.dumps(result, ensure_ascii=False, allow_nan=False).encode('utf-8')) > MAX_OUTPUT_BYTES:
            raise Problem(413, 'OUTPUT_LIMIT', 'Result plus execution receipt exceeds the 10 MiB limit.')
        return result


class Handler(BaseHTTPRequestHandler):
    server_version = 'ACAORA-local/1'
    sys_version = ''

    def log_message(self, *_):
        # Do not log URLs, tokens, data, headers or model inputs.
        pass

    @property
    def runner(self):
        return self.server.runner

    def trusted(self, token=True):
        if self.headers.get('Host') != '127.0.0.1:' + str(self.server.server_port):
            raise Problem(403, 'HOST_REJECTED', 'Use the exact 127.0.0.1 companion URL.')
        if self.headers.get('Origin') not in self.runner.origins:
            raise Problem(403, 'ORIGIN_REJECTED', 'This website origin was not explicitly allowed at companion startup.')
        if token and not hmac.compare_digest(self.headers.get('Authorization', '').encode('utf-8'), ('Bearer ' + self.runner.token).encode('utf-8')):
            raise Problem(401, 'TOKEN_REQUIRED', 'Paste the current companion session token; tokens rotate each time it starts.')

    def respond(self, status, value=None):
        data = b'' if value is None else json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self.send_response(status)
        origin = self.headers.get('Origin')
        if origin in self.runner.origins:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Vary', 'Origin')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Connection', 'close')
        if status == 204:
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()
        if data:
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass
        self.close_connection = True

    def handle_request(self, action):
        try:
            self.connection.settimeout(10)
            self.trusted(token=action != 'OPTIONS')
            if action == 'OPTIONS':
                if self.path not in ('/health', '/environment', '/run'):
                    raise Problem(404, 'NOT_FOUND', 'Unsupported endpoint.')
                return self.respond(204)
            if action == 'GET':
                if self.path not in ('/health', '/environment'):
                    raise Problem(404, 'NOT_FOUND', 'Unsupported endpoint.')
                return self.respond(200, self.runner.describe())
            if self.path != '/run':
                raise Problem(404, 'NOT_FOUND', 'Unsupported endpoint.')
            if self.headers.get('Transfer-Encoding'):
                raise Problem(400, 'LENGTH_REQUIRED', 'Chunked request bodies are not accepted.')
            if self.headers.get('Content-Type', '').split(';', 1)[0].strip().lower() != 'application/json':
                raise Problem(415, 'JSON_REQUIRED', 'Use an application/json request body.')
            try:
                length = int(self.headers.get('Content-Length', ''))
            except ValueError:
                raise Problem(411, 'LENGTH_REQUIRED', 'Content-Length is required.') from None
            if not 0 < length <= self.runner.max_request:
                raise Problem(413, 'REQUEST_LIMIT', 'The local request exceeds its bounded size limit.')
            data = self.rfile.read(length)
            if len(data) != length:
                raise Problem(400, 'INCOMPLETE_BODY', 'Request data was interrupted; keep the requestId for retry.')
            try:
                body = strict_json(data)
                raw = validate_job(body)
            except (ValueError, UnicodeError, RecursionError, OverflowError):
                raise Problem(400, 'INVALID_JSON', 'The request must contain finite, unambiguous JSON and valid strings.') from None
            status, result = self.runner.run(body, raw)
            self.respond(status, result)
        except Problem as issue:
            self.respond(issue.status, {'error': str(issue), 'code': issue.code})
        except TimeoutError:
            self.respond(408, {'error': 'Request read timed out.', 'code': 'READ_TIMEOUT'})
        except (OSError, ValueError):
            self.respond(503, {'error': 'The local companion could not read its fixed bundle or environment. Review the terminal and reconnect.', 'code': 'LOCAL_IO_FAILED'})

    def do_GET(self):
        self.handle_request('GET')

    def do_POST(self):
        self.handle_request('POST')

    def do_OPTIONS(self):
        self.handle_request('OPTIONS')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--allow-origin', action='append', default=[])
    parser.add_argument('--python', default=sys.executable)
    parser.add_argument('--rscript')
    parser.add_argument('--timeout', type=float, default=120)
    parser.add_argument('--max-request-bytes', type=int, default=MAX_REQUEST_BYTES)
    args = parser.parse_args()
    if ROOT.name == 'repro' and ROOT.parent.name == 'public' and (ROOT.parent.parent / 'package.json').exists():
        parser.error('Download and extract a reproduction ZIP into a separate local folder before starting the companion; do not store environment locks in a web public directory.')
    if not 0 <= args.port <= 65535 or not .1 <= args.timeout <= 120 or not 1024 <= args.max_request_bytes <= MAX_REQUEST_BYTES:
        parser.error('Use port 0–65535, timeout 0.1–120 s and body budget 1024–26214400 bytes.')
    try:
        runner = Runner(args)
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
        server.daemon_threads = True
        server.runner = runner
    except (OSError, ValueError, Problem) as issue:
        parser.error(str(issue))
    print(json.dumps({'protocol': PROTOCOL, 'url': 'http://127.0.0.1:' + str(server.server_port), 'token': runner.token, 'environmentHash': runner.environment_hash, 'allowedOrigins': sorted(runner.origins)}, ensure_ascii=False), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
