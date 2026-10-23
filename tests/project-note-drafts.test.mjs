import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../app/projects/project-note-drafts.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const drafts = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const makeDraft = (ownerId, projectId, text) => ({version: 1, ownerId, projectId, text, baseNotes: 'saved baseline', baseUpdatedAt: '2026-10-23T00:00:00Z', updatedAt: 1});

function storage(t) {
  const original = globalThis.localStorage;
  const values = new Map();
  const store = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
  globalThis.localStorage = store;
  t.after(() => {if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original;});
  return {store, values};
}

test('project note drafts are scoped by both owner and project and retain their saved baseline', t => {
  storage(t);
  const value = makeDraft('owner-a', 'same-project', 'private draft');
  assert.equal(drafts.storeProjectNoteDraft(value), true);
  assert.deepEqual(drafts.readProjectNoteDraft('owner-a', 'same-project'), value);
  assert.equal(drafts.readProjectNoteDraft('owner-b', 'same-project'), null);
  assert.equal(drafts.readProjectNoteDraft('owner-a', 'other-project'), null);
  assert.equal(drafts.isProjectNoteDraftDurable(value), true);
});

test('quota failures retain the newest input for client navigation and can retry durable storage', t => {
  const {store} = storage(t);
  const nativeWrite = store.setItem;
  store.setItem = () => {throw new Error('quota');};
  const first = makeDraft('quota-owner', 'quota-project', 'first');
  const latest = {...first, text: 'latest final character。'};
  assert.equal(drafts.storeProjectNoteDraft(first), false);
  assert.equal(drafts.storeProjectNoteDraft(latest), false);
  assert.deepEqual(drafts.readProjectNoteDraft(first.ownerId, first.projectId), latest);
  assert.equal(drafts.isProjectNoteDraftDurable(latest), false);
  store.setItem = nativeWrite;
  assert.equal(drafts.storeProjectNoteDraft(latest), true);
  assert.equal(drafts.isProjectNoteDraftDurable(latest), true);
});

test('a late acknowledgement cannot clear a newer draft even with equal millisecond timestamps', t => {
  storage(t);
  const submitted = makeDraft('late-owner', 'late-project', 'submitted');
  const newer = {...submitted, text: 'newer'};
  drafts.storeProjectNoteDraft(newer);
  assert.equal(drafts.clearProjectNoteDraft(submitted.ownerId, submitted.projectId, submitted), false);
  assert.deepEqual(drafts.readProjectNoteDraft(newer.ownerId, newer.projectId), newer);
  assert.equal(drafts.clearProjectNoteDraft(newer.ownerId, newer.projectId, newer), true);
  assert.equal(drafts.readProjectNoteDraft(newer.ownerId, newer.projectId), null);
});
