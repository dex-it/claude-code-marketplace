#!/usr/bin/env node
// Имитация хостинга для прогонов группы 1.3: один файл отвечает за `gh` и `glab`.
// В каталоге прогона лежат обёртки bin/gh и bin/glab, первыми в PATH исполнителя; сеть
// исполнителю закрыта песочницей Bash, поэтому настоящий хостинг недостижим.
// Состояние - каталог $FAKEHOST_DIR: case.json (MR/PR, пользователи, треды на старте, SHA
// подставлены раннером), state.json (треды после записей прогона), log.jsonl (каждый вызов:
// argv, stdin, разобранный запрос, ответ, код). Код и SHA берутся из origin.git того же каталога.
// Поведение, которое судит ключ, сверено с настоящими клиентами (README мини-проекта, «Хостинг»):
// glab 1.116.0 - нет флага --jq, ключ `a[b]` уходит литеральным именем поля, `-f x=@file` шлёт
// строку, `-F x=@file` - содержимое; gh - `a[b]` вкладывается, `--jq` есть.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.FAKEHOST_DIR;
const tool = process.argv[2];
const argv = process.argv.slice(3);
if (!DIR || !existsSync(join(DIR, 'case.json'))) { process.stderr.write(`${tool}: not configured\n`); process.exit(4); }
const CASE = JSON.parse(readFileSync(join(DIR, 'case.json'), 'utf8'));
const statePath = join(DIR, 'state.json');
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : JSON.parse(JSON.stringify(CASE.initial));
const ORIGIN = join(DIR, 'origin.git');
const entry = { t: new Date().toISOString(), tool, argv, cwd: process.cwd() };
let stdinText = null;
function readStdin() {
  if (stdinText === null) { try { stdinText = readFileSync(0, 'utf8'); } catch { stdinText = ''; } entry.stdin = stdinText; }
  return stdinText;
}
let out = '', err = '', code = 0;
function finish() {
  entry.code = code; entry.stdout = out.length > 4000 ? out.slice(0, 4000) + '...' : out; entry.stderr = err;
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  appendFileSync(join(DIR, 'log.jsonl'), JSON.stringify(entry) + '\n');
  process.stdout.write(out); process.stderr.write(err); process.exit(code);
}
function fail(msg, c = 1) { err += msg.endsWith('\n') ? msg : msg + '\n'; code = c; finish(); }

const git = (...a) => execFileSync('git', ['--git-dir', ORIGIN, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 }).trimEnd();
const rev = (r) => git('rev-parse', r);
const isCommit = (s) => { try { git('cat-file', '-e', `${s}^{commit}`); return true; } catch { return false; } };
const mrHead = () => rev(`refs/heads/${CASE.mr.source_branch}`);
const targetHead = () => rev(`refs/heads/${CASE.mr.target_branch}`);
const mergeBase = (a, b) => git('merge-base', a, b);
const now = () => new Date().toISOString();
const nextId = () => (state.seq = (state.seq ?? 1000) + 1);

// Строки диффа base..head по файлу: new - добавленные и контекст по новой стороне, old - удалённые и
// контекст по старой. Тред на строку вне этих множеств хостинг отклоняет.
function diffLines(base, head, path) {
  let d = '';
  try { d = git('diff', '--unified=3', base, head, '--', path); } catch { return null; }
  const res = { added: new Set(), removed: new Set(), ctxNew: new Set(), ctxOld: new Set() };
  let o = 0, n = 0;
  for (const line of d.split('\n')) {
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (h) { o = +h[1]; n = +h[2]; continue; }
    if (line.startsWith('+++') || line.startsWith('---') || !/^[ +-]/.test(line)) continue;
    if (line[0] === '+') res.added.add(n++);
    else if (line[0] === '-') res.removed.add(o++);
    else { res.ctxOld.add(o++); res.ctxNew.add(n++); }
  }
  return res;
}
const fileAt = (sha, path) => { try { return git('show', `${sha}:${path}`).split('\n'); } catch { return null; } };

// ---------- разбор аргументов api ----------
function parseApi(args, flavor) {
  const r = { method: null, fields: [], raw: [], headers: [], input: null, jq: null, paginate: false, include: false, silent: false, endpoint: null, output: 'json', hostname: null };
  const takes = new Set(['-X', '--method', '-f', '--raw-field', '-F', '--field', '-H', '--header', '--input', '--hostname', '--output', '--form']);
  if (flavor === 'gh') ['-q', '--jq', '-t', '--template', '--cache', '-p', '--preview'].forEach((x) => takes.add(x));
  const known = new Set([...takes, '--paginate', '-i', '--include', '--silent', '-h', '--help', '--verbose', '--slurp']);
  for (let i = 0; i < args.length; i++) {
    let a = args[i], v;
    if (a.startsWith('--') && a.includes('=')) { v = a.slice(a.indexOf('=') + 1); a = a.slice(0, a.indexOf('=')); }
    else if (/^-[A-Za-z]./.test(a) && !a.startsWith('--')) { v = a.slice(2); a = a.slice(0, 2); }
    if (a.startsWith('-') && a.length > 1) {
      if (!known.has(a)) return { error: flavor === 'glab' ? `\n   ERROR  \n\n  Unknown flag: ${a}.\n\n  Try --help for usage.\n` : `unknown flag: ${a}\n\nUsage:  gh api <endpoint> [flags]\n` };
      if (takes.has(a) && v === undefined) v = args[++i];
      switch (a) {
        case '-X': case '--method': r.method = v.toUpperCase(); break;
        case '-f': case '--raw-field': r.raw.push(v); break;
        case '-F': case '--field': r.fields.push(v); break;
        case '-H': case '--header': r.headers.push(v); break;
        case '--input': r.input = v; break;
        case '-q': case '--jq': r.jq = v; break;
        case '--paginate': r.paginate = true; break;
        case '-i': case '--include': r.include = true; break;
        case '--silent': r.silent = true; break;
        case '--hostname': r.hostname = v; break;
        case '--output': r.output = v; break;
        case '-h': case '--help': r.help = true; break;
        default: break;
      }
    } else if (!r.endpoint) r.endpoint = a;
    else return { error: flavor === 'glab' ? `\n   ERROR  \n\n  Accepts 1 arg(s), received 2.\n` : `accepts 1 arg(s), received 2\n` };
  }
  return r;
}
function typed(v, flavor) {
  if (v === 'true') return true; if (v === 'false') return false; if (v === 'null') return null;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (flavor === 'glab' && /^[[{]/.test(v)) { try { return JSON.parse(v); } catch { throw new Error(`invalid JSON in field value: ${v}`); } }
  return v;
}
function readAt(v) {
  if (v === '@-') return readStdin();
  return readFileSync(v.slice(1), 'utf8');
}
function setNested(obj, key, val) { // gh: key[sub][]=v
  const parts = []; const m = /^([^[]+)((?:\[[^\]]*\])*)$/.exec(key);
  if (!m) { obj[key] = val; return; }
  parts.push(m[1]); for (const p of m[2].matchAll(/\[([^\]]*)\]/g)) parts.push(p[1]);
  // key[][sub]=v - массив объектов, как в gh: поле дописывается в последний объект, пока ключ в нём не повторится
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i], nextArr = parts[i + 1] === '';
    if (Array.isArray(cur) && k === '') {
      const sub = parts[i + 1], lastObj = cur[cur.length - 1];
      if (lastObj && typeof lastObj === 'object' && !Array.isArray(lastObj) && !(sub in lastObj)) cur = lastObj;
      else { const o = {}; cur.push(o); cur = o; }
      continue;
    }
    if (cur[k] === undefined) cur[k] = nextArr ? [] : {};
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  if (last === '') cur.push(val); else if (Array.isArray(cur)) cur.push({ [last]: val }); else cur[last] = val;
}
function buildParams(r, flavor) {
  const params = {};
  for (const f of r.raw) { const i = f.indexOf('='); const k = i < 0 ? f : f.slice(0, i); const v = i < 0 ? '' : f.slice(i + 1); flavor === 'gh' ? setNested(params, k, v) : (params[k] = v); }
  for (const f of r.fields) {
    const i = f.indexOf('='); const k = i < 0 ? f : f.slice(0, i); let v = i < 0 ? '' : f.slice(i + 1);
    v = v.startsWith('@') ? readAt(v) : typed(v, flavor);
    flavor === 'gh' ? setNested(params, k, v) : (params[k] = v);
  }
  return params;
}

// ---------- GitLab ----------
const glUser = (u) => ({ id: CASE.users?.[u]?.id ?? 7, username: u, name: CASE.users?.[u]?.name ?? u, state: 'active' });
function glMr() {
  const head = mrHead(), target = targetHead(), base = mergeBase(target, head);
  return {
    id: 9000 + CASE.mr.iid, iid: CASE.mr.iid, project_id: CASE.project.id, title: CASE.mr.title, description: CASE.mr.description,
    state: 'opened', source_branch: CASE.mr.source_branch, target_branch: CASE.mr.target_branch, author: glUser(CASE.mr.author),
    sha: head, merge_status: 'can_be_merged', draft: false, web_url: `https://${CASE.host}/${CASE.project.path}/-/merge_requests/${CASE.mr.iid}`,
    diff_refs: { base_sha: base, head_sha: head, start_sha: target },
    created_at: CASE.mr.created_at, updated_at: CASE.mr.updated_at,
  };
}
function glVersions() {
  return (CASE.versions ?? []).map((v, i) => ({ id: 500 + i, head_commit_sha: v.head, base_commit_sha: v.base, start_commit_sha: v.start, created_at: v.created_at, merge_request_id: 9000 + CASE.mr.iid, state: 'collected', real_size: '1' })).reverse();
}
function glDiffs(from, to) {
  const names = git('diff', '--name-status', from, to).split('\n').filter(Boolean);
  return names.map((l) => {
    const [st, ...ps] = l.split('\t'); const oldp = ps[0], newp = ps[ps.length - 1];
    return { old_path: oldp, new_path: newp, a_mode: '100644', b_mode: '100644', new_file: st === 'A', renamed_file: st.startsWith('R'), deleted_file: st === 'D', diff: git('diff', from, to, '--', ...new Set([oldp, newp])).split('\n').slice(4).join('\n') + '\n' };
  });
}
function glNoteView(n) { return { id: n.id, type: n.position ? 'DiffNote' : (n.discussion ? 'DiscussionNote' : null), body: n.body, author: glUser(n.author), created_at: n.created_at, system: false, noteable_type: 'MergeRequest', resolvable: !!n.resolvable, resolved: !!n.resolved, resolved_by: n.resolved_by ? glUser(n.resolved_by) : null, position: n.position ?? null }; }
function glDiscussionView(d) { return { id: d.id, individual_note: !!d.individual_note, notes: d.notes.map((n) => glNoteView({ ...n, resolvable: d.resolvable, resolved: d.resolved, resolved_by: d.resolved_by, discussion: !d.individual_note })) }; }
function glValidatePosition(p) {
  if (!p || typeof p !== 'object') return { ok: false, why: 'no-position' };
  const shas = ['base_sha', 'start_sha', 'head_sha'];
  for (const s of shas) if (!p[s] || !isCommit(p[s])) return { ok: false, http: 400, msg: `{"message":"400 Bad request - Note {:line_code=>[\\"can't be blank\\", \\"must be a valid line code\\"]}"}`, why: `bad-${s}` };
  const path = p.new_path ?? p.old_path;
  const dl = diffLines(p.base_sha, p.head_sha, path);
  const nl = p.new_line == null ? null : Number(p.new_line), ol = p.old_line == null ? null : Number(p.old_line);
  let ok = false;
  if (dl) {
    if (nl != null && ol == null) ok = dl.added.has(nl) || dl.ctxNew.has(nl);
    else if (ol != null && nl == null) ok = dl.removed.has(ol) || dl.ctxOld.has(ol);
    else if (nl != null && ol != null) ok = (dl.ctxNew.has(nl) && dl.ctxOld.has(ol)) || dl.added.has(nl) || dl.removed.has(ol);
  }
  if (!ok) return { ok: false, http: 400, msg: `{"message":"400 Bad request - Note {:line_code=>[\\"can't be blank\\", \\"must be a valid line code\\"]}"}`, why: 'line-not-in-diff' };
  const cur = glMr().diff_refs;
  const stale = p.head_sha !== cur.head_sha || p.base_sha !== cur.base_sha || p.start_sha !== cur.start_sha;
  const lines = fileAt(nl != null ? p.head_sha : p.base_sha, nl != null ? (p.new_path ?? path) : (p.old_path ?? path));
  const text = lines ? lines[(nl ?? ol) - 1] : null;
  return { ok: true, stale, text };
}
function glApi(r) {
  let ep = r.endpoint.replace(/^\/?(api\/v4\/)?/, '').replace(/^https?:\/\/[^/]+\/api\/v4\//, '');
  ep = ep.replace(/:id|:fullpath|:repo/g, String(CASE.project.id)).replace(encodeURIComponent(CASE.project.path), String(CASE.project.id)).replace(CASE.project.path.replace('/', '%2f'), String(CASE.project.id));
  const [path, qs] = ep.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs ?? ''));
  let body = {};
  if (r.input) body = JSON.parse(r.input === '-' ? readStdin() : readFileSync(r.input, 'utf8'));
  const params = buildParams(r, 'glab');
  const hasBody = r.fields.length + r.raw.length > 0 || r.input;
  const method = r.method ?? (hasBody ? 'POST' : 'GET');
  if (method === 'GET') Object.assign(query, params); else Object.assign(body, r.input ? query : {}, params);
  entry.req = { method, path, query, body };
  const pid = String(CASE.project.id), iid = String(CASE.mr.iid);
  const seg = path.split('/').filter(Boolean);
  const mrBase = seg[0] === 'projects' && seg[1] === pid && seg[2] === 'merge_requests';
  const send = (status, obj) => { entry.res = { status }; return { status, obj }; };
  if (path === 'user') return send(200, glUser(CASE.me));
  if (seg[0] === 'projects' && seg[1] === pid && seg.length === 2) return send(200, { id: CASE.project.id, path_with_namespace: CASE.project.path, default_branch: CASE.mr.target_branch, web_url: `https://${CASE.host}/${CASE.project.path}` });
  if (seg[0] === 'projects' && seg[1] !== pid) return send(404, { message: '404 Project Not Found' });
  if (!mrBase) return send(404, { message: '404 Not Found' });
  if (seg.length === 3 && method === 'GET') return send(200, [glMr()]);
  if (seg[3] !== iid) return send(404, { message: '404 Not found' });
  const rest = seg.slice(4);
  const findD = (id) => state.discussions.find((d) => d.id === id);
  if (rest.length === 0 && method === 'GET') return send(200, glMr());
  if (rest.length === 0 && method === 'PUT') { entry.flag = 'mr-update'; state.mr_updates = [...(state.mr_updates ?? []), body]; return send(200, { ...glMr(), ...body }); }
  if (rest[0] === 'versions' && method === 'GET') return send(200, rest[1] ? glVersions().find((v) => String(v.id) === rest[1]) : glVersions());
  if ((rest[0] === 'changes' || rest[0] === 'diffs') && method === 'GET') { const m = glMr(); const d = glDiffs(m.diff_refs.base_sha, m.diff_refs.head_sha); return send(200, rest[0] === 'changes' ? { ...m, changes: d } : d); }
  if (rest[0] === 'commits' && method === 'GET') { const m = glMr(); return send(200, git('log', '--format=%H%x1f%s%x1f%an%x1f%aI', `${m.diff_refs.base_sha}..${m.diff_refs.head_sha}`).split('\n').filter(Boolean).map((l) => { const [id, title, an, d] = l.split('\x1f'); return { id, short_id: id.slice(0, 8), title, message: title, author_name: an, created_at: d }; })); }
  if ((rest[0] === 'approve' || rest[0] === 'unapprove') && method === 'POST') { entry.flag = `verdict-${rest[0]}`; state.verdicts = [...(state.verdicts ?? []), rest[0]]; return send(201, { id: 9000 + CASE.mr.iid, approved: rest[0] === 'approve' }); }
  if (rest[0] === 'notes' && rest.length === 1) {
    if (method === 'GET') return send(200, state.discussions.flatMap((d) => d.notes.map((n) => glNoteView({ ...n, resolvable: d.resolvable, resolved: d.resolved }))));
    if (method === 'POST') {
      if (!body.body) return send(400, { message: '400 Bad request - body is missing' });
      const id = nextId(); const note = { id, body: String(body.body), author: CASE.me, created_at: now() };
      state.discussions.push({ id: `d${id}`, individual_note: true, resolvable: false, notes: [note] });
      entry.flag = 'general-note'; return send(201, glNoteView(note));
    }
  }
  if (rest[0] === 'discussions') {
    if (rest.length === 1 && method === 'GET') return send(200, state.discussions.map(glDiscussionView));
    if (rest.length === 1 && method === 'POST') {
      if (!body.body) return send(400, { message: '400 Bad request - body is missing' });
      const id = nextId(); const note = { id, body: String(body.body), author: CASE.me, created_at: now() };
      const bracketKeys = Object.keys(body).filter((k) => k.includes('['));
      if (body.position) {
        const v = glValidatePosition(body.position);
        if (!v.ok) { entry.flag = `position-rejected:${v.why}`; return send(v.http ?? 400, JSON.parse(v.msg ?? '{"message":"400 Bad request"}')); }
        note.position = { ...body.position, position_type: body.position.position_type ?? 'text' };
        entry.flag = v.stale ? 'thread-stale-sha' : 'thread'; entry.anchor = { text: v.text, stale: v.stale };
      } else entry.flag = bracketKeys.length ? 'thread-without-position:bracket-keys' : 'thread-without-position';
      const d = { id: `d${id}`, individual_note: false, resolvable: true, resolved: false, notes: [note] };
      state.discussions.push(d); return send(201, glDiscussionView(d));
    }
    const d = findD(rest[1]);
    if (!d) return send(404, { message: '404 Discussion Not Found' });
    entry.target = { discussion: d.id, owner: d.notes[0].author };
    if (rest.length === 2 && method === 'GET') return send(200, glDiscussionView(d));
    if (rest.length === 2 && method === 'PUT') {
      const want = body.resolved ?? query.resolved;
      if (want === undefined) return send(400, { message: '400 Bad request - resolved is missing' });
      d.resolved = want === true || want === 'true'; d.resolved_by = d.resolved ? CASE.me : null;
      entry.flag = d.resolved ? 'resolve' : 'unresolve'; return send(200, glDiscussionView(d));
    }
    if (rest[2] === 'notes' && rest.length === 3 && method === 'POST') {
      if (!body.body) return send(400, { message: '400 Bad request - body is missing' });
      const id = nextId(); const note = { id, body: String(body.body), author: CASE.me, created_at: now() };
      d.notes.push(note); entry.flag = 'reply'; return send(201, glNoteView({ ...note, discussion: true }));
    }
    if (rest[2] === 'notes' && rest.length === 4) {
      const n = d.notes.find((x) => String(x.id) === rest[3]);
      if (!n) return send(404, { message: '404 Note Not Found' });
      if (method === 'PUT') { if (body.body) n.body = String(body.body); if (body.resolved !== undefined) { d.resolved = body.resolved === true || body.resolved === 'true'; entry.flag = d.resolved ? 'resolve' : 'unresolve'; } else entry.flag = 'edit-note'; return send(200, glNoteView(n)); }
      if (method === 'DELETE') { d.notes = d.notes.filter((x) => x !== n); entry.flag = 'delete-note'; return send(204, null); }
    }
  }
  return send(404, { message: '404 Not Found' });
}

// ---------- GitHub ----------
const ghUser = (u) => ({ login: u, id: CASE.users?.[u]?.id ?? 1, type: 'User' });
function ghPr() {
  const head = mrHead(), target = targetHead();
  return { number: CASE.mr.iid, title: CASE.mr.title, body: CASE.mr.description, state: 'open', draft: false, user: ghUser(CASE.mr.author),
    head: { ref: CASE.mr.source_branch, sha: head, label: `${CASE.repo.owner}:${CASE.mr.source_branch}` }, base: { ref: CASE.mr.target_branch, sha: target, label: `${CASE.repo.owner}:${CASE.mr.target_branch}` },
    html_url: `https://github.com/${CASE.repo.owner}/${CASE.repo.name}/pull/${CASE.mr.iid}`, created_at: CASE.mr.created_at, updated_at: CASE.mr.updated_at, mergeable: true };
}
const prCommits = () => { const p = ghPr(); return git('rev-list', '--reverse', `${mergeBase(p.base.sha, p.head.sha)}..${p.head.sha}`).split('\n').filter(Boolean); };
function ghCommentView(c) {
  const p = ghPr(); const current = c.commit_id === p.head.sha;
  return { id: c.id, node_id: `PRRC_${c.id}`, pull_request_review_id: c.review_id ?? c.id, in_reply_to_id: c.in_reply_to_id, path: c.path, line: current ? c.line : null, original_line: c.line, side: c.side, start_line: c.start_line ?? null,
    commit_id: c.commit_id, original_commit_id: c.commit_id, body: c.body, user: ghUser(c.author), created_at: c.created_at, updated_at: c.created_at, subject_type: c.subject_type ?? 'line',
    html_url: `${p.html_url}#discussion_r${c.id}` };
}
function ghValidateLine(c) {
  if (!c.commit_id || !isCommit(c.commit_id)) return { ok: false, status: 422, obj: { message: 'Validation Failed', errors: [{ resource: 'PullRequestReviewComment', code: 'invalid', field: 'commit_id' }], documentation_url: 'https://docs.github.com/rest/pulls/comments#create-a-review-comment-for-a-pull-request', status: '422' } };
  if (!c.path) return { ok: false, status: 422, obj: { message: 'Validation Failed', errors: [{ resource: 'PullRequestReviewComment', code: 'missing_field', field: 'path' }], status: '422' } };
  if (c.subject_type === 'file') return { ok: true, stale: !prCommits().includes(c.commit_id) || c.commit_id !== ghPr().head.sha };
  const line = Number(c.line), side = c.side ?? 'RIGHT';
  const base = mergeBase(ghPr().base.sha, c.commit_id);
  const dl = diffLines(base, c.commit_id, c.path);
  const ok = dl && (side === 'LEFT' ? (dl.removed.has(line) || dl.ctxOld.has(line)) : (dl.added.has(line) || dl.ctxNew.has(line)));
  if (!c.line || !ok) return { ok: false, status: 422, obj: { message: 'Validation Failed', errors: ['pull_request_review_thread.line must be part of the diff'], documentation_url: 'https://docs.github.com/rest/pulls/comments#create-a-review-comment-for-a-pull-request', status: '422' } };
  const lines = fileAt(side === 'LEFT' ? base : c.commit_id, c.path);
  return { ok: true, stale: c.commit_id !== ghPr().head.sha, text: lines ? lines[line - 1] : null };
}
function ghAddComment(c, flagPrefix = '') {
  const id = nextId();
  const rec = { id, path: c.path, line: c.line == null ? null : Number(c.line), side: c.side ?? 'RIGHT', start_line: c.start_line ?? null, commit_id: c.commit_id, body: String(c.body), author: CASE.me, created_at: now(), in_reply_to_id: c.in_reply_to_id, review_id: c.review_id, subject_type: c.subject_type };
  state.comments.push(rec);
  if (!rec.in_reply_to_id) state.threads.push({ id: `PRRT_${id}`, root: id, resolved: false });
  return rec;
}
function ghThreadOf(commentId) {
  let c = state.comments.find((x) => x.id === commentId);
  while (c && c.in_reply_to_id) c = state.comments.find((x) => x.id === c.in_reply_to_id);
  return c ? state.threads.find((t) => t.root === c.id) : null;
}
function ghGraphql(params) {
  const q = String(params.query ?? '');
  entry.req = { method: 'POST', path: 'graphql', query: q, variables: Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'query')) };
  const vars = entry.req.variables;
  const arg = (name) => { const m = new RegExp(`${name}\\s*:\\s*(?:"([^"]+)"|\\$(\\w+))`).exec(q); return m ? (m[1] ?? vars[m[2]]) : undefined; };
  const threadView = (t) => { const root = state.comments.find((c) => c.id === t.root); const all = state.comments.filter((c) => ghThreadOf(c.id) === t);
    return { id: t.id, isResolved: t.resolved, isOutdated: root.commit_id !== ghPr().head.sha, path: root.path, line: root.line, diffSide: root.side, resolvedBy: t.resolved ? { login: t.resolved_by } : null,
      comments: { totalCount: all.length, nodes: all.map((c) => ({ id: `PRRC_${c.id}`, databaseId: c.id, body: c.body, author: { login: c.author }, createdAt: c.created_at, path: c.path, line: c.line, originalLine: c.line, url: `${ghPr().html_url}#discussion_r${c.id}` })) } }; };
  if (/mutation/.test(q)) {
    const m = /(resolveReviewThread|unresolveReviewThread|addPullRequestReviewThreadReply)/.exec(q);
    if (!m) { entry.flag = 'graphql-unsupported'; return { status: 200, obj: { errors: [{ type: 'INTERNAL', message: 'Something went wrong while executing your query.' }] } }; }
    const tid = arg('threadId') ?? arg('pullRequestReviewThreadId');
    const t = state.threads.find((x) => x.id === tid);
    if (!t) return { status: 200, obj: { data: { [m[1]]: null }, errors: [{ type: 'NOT_FOUND', path: [m[1]], message: `Could not resolve to a node with the global id of '${tid}'.` }] } };
    const root = state.comments.find((c) => c.id === t.root);
    entry.target = { thread: t.id, owner: root.author };
    if (m[1] === 'addPullRequestReviewThreadReply') {
      const body = arg('body') ?? vars.body; const r = ghAddComment({ path: root.path, line: root.line, side: root.side, commit_id: root.commit_id, body, in_reply_to_id: root.id });
      entry.flag = 'reply'; return { status: 200, obj: { data: { addPullRequestReviewThreadReply: { comment: { id: `PRRC_${r.id}`, databaseId: r.id, body: r.body } } } } };
    }
    t.resolved = m[1] === 'resolveReviewThread'; t.resolved_by = t.resolved ? CASE.me : null; entry.flag = t.resolved ? 'resolve' : 'unresolve';
    return { status: 200, obj: { data: { [m[1]]: { thread: { id: t.id, isResolved: t.resolved } } } } };
  }
  if (/reviewThreads/.test(q)) { entry.flag = 'read-threads'; return { status: 200, obj: { data: { repository: { pullRequest: { id: `PR_${CASE.mr.iid}`, number: CASE.mr.iid, reviewThreads: { totalCount: state.threads.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes: state.threads.map(threadView) } } } } } }; }
  if (/viewer/.test(q)) return { status: 200, obj: { data: { viewer: { login: CASE.me } } } };
  if (/pullRequest/.test(q)) { const p = ghPr(); return { status: 200, obj: { data: { repository: { pullRequest: { id: `PR_${p.number}`, number: p.number, title: p.title, headRefOid: p.head.sha, baseRefOid: p.base.sha, headRefName: p.head.ref, baseRefName: p.base.ref } } } } }; }
  entry.flag = 'graphql-unsupported';
  return { status: 200, obj: { errors: [{ type: 'INTERNAL', message: 'Something went wrong while executing your query.' }] } };
}
function ghApi(r) {
  let ep = r.endpoint.replace(/^https:\/\/api\.github\.com\//, '').replace(/^\//, '');
  ep = ep.replace('{owner}', CASE.repo.owner).replace('{repo}', CASE.repo.name);
  let body = {};
  if (r.input) body = JSON.parse(r.input === '-' ? readStdin() : readFileSync(r.input, 'utf8'));
  const params = buildParams(r, 'gh');
  if (ep === 'graphql') return ghGraphql({ ...body, ...params });
  const [path, qs] = ep.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs ?? ''));
  const hasFields = r.fields.length + r.raw.length > 0;
  const method = r.method ?? (hasFields || r.input ? 'POST' : 'GET');
  if (method === 'GET') Object.assign(query, params); else Object.assign(body, params);
  entry.req = { method, path, query, body };
  const send = (status, obj) => { entry.res = { status }; return { status, obj }; };
  if (path === 'user') return send(200, ghUser(CASE.me));
  const seg = path.split('/').filter(Boolean);
  if (seg[0] !== 'repos' || seg[1] !== CASE.repo.owner || seg[2] !== CASE.repo.name) return send(404, { message: 'Not Found', documentation_url: 'https://docs.github.com/rest', status: '404' });
  const rest = seg.slice(3); const n = String(CASE.mr.iid);
  if (rest.length === 0) return send(200, { full_name: `${CASE.repo.owner}/${CASE.repo.name}`, default_branch: CASE.mr.target_branch, private: true });
  if (rest[0] === 'pulls' && rest[1] === 'comments' && rest[2]) {
    const c = state.comments.find((x) => String(x.id) === rest[2]); if (!c) return send(404, { message: 'Not Found', status: '404' });
    entry.target = { comment: c.id, owner: c.author };
    if (method === 'GET') return send(200, ghCommentView(c));
    if (method === 'PATCH') { c.body = String(body.body); entry.flag = 'edit-comment'; return send(200, ghCommentView(c)); }
    if (method === 'DELETE') { state.comments = state.comments.filter((x) => x !== c); entry.flag = 'delete-comment'; return send(204, null); }
  }
  if (rest[0] === 'issues' && rest[1] === 'comments' && rest[2] && method === 'PATCH') { const c = state.issue_comments.find((x) => String(x.id) === rest[2]); if (!c) return send(404, { message: 'Not Found' }); c.body = String(body.body); entry.flag = 'edit-issue-comment'; return send(200, c); }
  if ((rest[0] === 'pulls' || rest[0] === 'issues') && rest[1] !== n) return send(404, { message: 'Not Found', status: '404' });
  if (rest[0] === 'pulls' && rest.length === 2 && method === 'GET') return send(200, ghPr());
  if (rest[0] === 'pulls' && rest.length === 2 && method === 'PATCH') { entry.flag = 'pr-update'; state.mr_updates = [...(state.mr_updates ?? []), body]; return send(200, { ...ghPr(), ...body }); }
  if (rest[0] === 'pulls' && rest[2] === 'commits') return send(200, prCommits().map((sha) => ({ sha, commit: { message: git('log', '-1', '--format=%s', sha) } })));
  if (rest[0] === 'pulls' && rest[2] === 'files') { const p = ghPr(); const b = mergeBase(p.base.sha, p.head.sha); return send(200, git('diff', '--name-status', b, p.head.sha).split('\n').filter(Boolean).map((l) => { const [st, f] = l.split('\t'); return { filename: f, status: { A: 'added', M: 'modified', D: 'removed' }[st] ?? 'modified', patch: git('diff', b, p.head.sha, '--', f).split('\n').slice(4).join('\n') }; })); }
  if (rest[0] === 'pulls' && rest[2] === 'comments') {
    if (rest.length === 3 && method === 'GET') return send(200, state.comments.map(ghCommentView));
    if (rest.length === 3 && method === 'POST') {
      if (!body.body) return send(422, { message: 'Validation Failed', errors: [{ resource: 'PullRequestReviewComment', code: 'missing_field', field: 'body' }], status: '422' });
      if (body.in_reply_to) {
        const root = state.comments.find((c) => c.id === Number(body.in_reply_to));
        if (!root) return send(404, { message: 'Not Found', status: '404' });
        entry.target = { comment: root.id, owner: (state.comments.find((c) => c.id === (root.in_reply_to_id ?? root.id)) ?? root).author };
        const rec = ghAddComment({ ...root, body: body.body, in_reply_to_id: root.in_reply_to_id ?? root.id, review_id: undefined });
        entry.flag = 'reply'; return send(201, ghCommentView(rec));
      }
      const v = ghValidateLine(body); if (!v.ok) { entry.flag = 'thread-rejected'; return send(v.status, v.obj); }
      const rec = ghAddComment(body); entry.flag = v.stale ? 'thread-stale-sha' : 'thread'; entry.anchor = { text: v.text, stale: v.stale }; return send(201, ghCommentView(rec));
    }
    if (rest.length === 5 && rest[4] === 'replies' && method === 'POST') {
      const root = state.comments.find((c) => String(c.id) === rest[3]); if (!root) return send(404, { message: 'Not Found', status: '404' });
      if (root.in_reply_to_id) return send(422, { message: 'Validation Failed', errors: ['replies to replies are not supported'], status: '422' });
      entry.target = { comment: root.id, owner: root.author };
      const rec = ghAddComment({ ...root, body: body.body, in_reply_to_id: root.id, review_id: undefined }); entry.flag = 'reply'; return send(201, ghCommentView(rec));
    }
  }
  if (rest[0] === 'pulls' && rest[2] === 'reviews') {
    if (rest.length === 3 && method === 'GET') return send(200, state.reviews ?? []);
    if (rest.length === 3 && method === 'POST') {
      const rid = nextId(); const event = body.event ?? 'PENDING';
      const comments = body.comments ?? []; const created = [], rejected = [];
      for (const c of comments) { const cc = { ...c, commit_id: body.commit_id ?? ghPr().head.sha, side: c.side ?? 'RIGHT', review_id: rid }; const v = ghValidateLine(cc); if (!v.ok) rejected.push({ c, why: v.obj }); else created.push({ c: cc, v }); }
      if (rejected.length) { entry.flag = 'review-rejected'; return send(422, { message: 'Unprocessable Entity', errors: ['Line could not be resolved'], status: '422' }); }
      for (const { c, v } of created) { ghAddComment(c); entry.anchors = [...(entry.anchors ?? []), { path: c.path, line: c.line, text: v.text, stale: v.stale }]; }
      state.reviews = [...(state.reviews ?? []), { id: rid, state: event === 'PENDING' ? 'PENDING' : event === 'COMMENT' ? 'COMMENTED' : event, body: body.body ?? '', user: ghUser(CASE.me) }];
      entry.flag = `review-${event}`; if (event === 'APPROVE' || event === 'REQUEST_CHANGES') state.verdicts = [...(state.verdicts ?? []), event];
      return send(200, { id: rid, state: event === 'COMMENT' ? 'COMMENTED' : event, body: body.body ?? '' });
    }
  }
  if (rest[0] === 'issues' && rest[2] === 'comments') {
    if (method === 'GET') return send(200, state.issue_comments);
    if (method === 'POST') { if (!body.body) return send(422, { message: 'Validation Failed', status: '422' }); const id = nextId(); const c = { id, body: String(body.body), user: ghUser(CASE.me), created_at: now(), html_url: `${ghPr().html_url}#issuecomment-${id}` }; state.issue_comments.push(c); entry.flag = 'general-comment'; return send(201, c); }
  }
  return send(404, { message: 'Not Found', documentation_url: 'https://docs.github.com/rest', status: '404' });
}

// ---------- вывод api ----------
function printApi(res, r, flavor) {
  const { status, obj } = res;
  if (r.include) out += `HTTP/2.0 ${status}\nContent-Type: application/json\n\n`;
  const ok = status < 400;
  if (!ok) {
    if (flavor === 'glab') { err += `\n   ERROR  \n\n  ${status === 404 ? '404 Not Found' : `${status}`}: ${JSON.stringify(obj)}\n\n`; out += r.silent ? '' : JSON.stringify(obj); code = 1; return; }
    out += JSON.stringify(obj); err += `gh: ${obj?.message ?? 'error'} (HTTP ${status})\n`; code = 1; return;
  }
  if (r.silent || obj === null) return;
  if (r.jq) {
    try { out += execFileSync('jq', ['-r', r.jq], { input: JSON.stringify(obj), encoding: 'utf8' }); }
    catch (e) { err += `failed to parse jq expression (line 1, column 1)\n    ${r.jq}\n`; code = 1; }
    return;
  }
  if (flavor === 'glab' && r.output === 'ndjson' && Array.isArray(obj)) { out += obj.map((x) => JSON.stringify(x)).join('\n') + '\n'; return; }
  out += JSON.stringify(obj, null, flavor === 'glab' ? 2 : 0) + (flavor === 'glab' ? '\n' : '');
}

// ---------- подкоманды ----------
function flagVal(args, ...names) { for (let i = 0; i < args.length; i++) { for (const n of names) { if (args[i] === n) return args[i + 1]; if (args[i].startsWith(n + '=')) return args[i].slice(n.length + 1); } } return undefined; }
function checkoutBranch() {
  const src = CASE.mr.source_branch;
  try {
    execFileSync('git', ['fetch', '-q', 'origin', `+refs/heads/${src}:refs/remotes/origin/${src}`], { stdio: 'pipe' });
    let exists = true; try { execFileSync('git', ['rev-parse', '--verify', '-q', `refs/heads/${src}`], { stdio: 'pipe' }); } catch { exists = false; }
    if (exists) { execFileSync('git', ['checkout', '-q', src], { stdio: 'pipe' }); execFileSync('git', ['merge', '-q', '--ff-only', `origin/${src}`], { stdio: 'pipe' }); }
    else execFileSync('git', ['checkout', '-q', '--no-track', '-b', src, `origin/${src}`], { stdio: 'pipe' });
    err += `Switched to branch '${src}'\n`; entry.flag = 'checkout';
  } catch (e) { err += String(e.stderr ?? e.message); code = 1; }
}
function mrText() {
  const p = CASE.platform === 'gitlab' ? glMr() : ghPr();
  return `title:\t${CASE.mr.title}\nstate:\topen\nauthor:\t${CASE.mr.author}\nnumber:\t${CASE.mr.iid}\nurl:\t${p.web_url ?? p.html_url}\n--\n${CASE.mr.description}\n`;
}
function prDiffText() { const p = ghPr(); return git('diff', mergeBase(p.base.sha, p.head.sha), p.head.sha) + '\n'; }

function main() {
  const top = argv[0];
  const apiArgs = argv.slice(1);
  if (tool === 'glab') {
    if (top === 'api') {
      if (apiArgs.includes('--help') || apiArgs.includes('-h')) { out += readFileSync(join(HERE, 'help/glab-api.txt'), 'utf8'); return finish(); }
      const r = parseApi(apiArgs, 'glab'); if (r.error) return fail(r.error);
      if (!r.endpoint) return fail('\n   ERROR  \n\n  Accepts 1 arg(s), received 0.\n');
      let res; try { res = glApi(r); } catch (e) { return fail(`\n   ERROR  \n\n  ${e.message}\n`); }
      printApi(res, r, 'glab'); return finish();
    }
    if (top === 'auth' && argv[1] === 'status') { err += `${CASE.host}\n  ✓ Logged in to ${CASE.host} as ${CASE.me}\n  ✓ Git operations for ${CASE.host} configured to use https protocol.\n  ✓ API calls for ${CASE.host} are made over https protocol.\n  ✓ Token: **************************\n`; return finish(); }
    if (top === 'mr') {
      const sub = argv[1];
      if (sub === 'view') { if (argv.includes('--output') || argv.includes('-F')) { out += JSON.stringify(glMr(), null, 2) + '\n'; return finish(); } out += mrText(); if (argv.includes('--comments') || argv.includes('-c')) out += '\n' + state.discussions.map((d) => d.notes.map((x) => `${x.author} commented ${x.created_at}\n  ${x.body}`).join('\n')).join('\n\n') + '\n'; return finish(); }
      if (sub === 'diff') { const m = glMr(); out += git('diff', m.diff_refs.base_sha, m.diff_refs.head_sha) + '\n'; return finish(); }
      if (sub === 'checkout') { checkoutBranch(); return finish(); }
      if (sub === 'list') { out += `Showing 1 open merge request on ${CASE.project.path}.\n\n!${CASE.mr.iid}\t${CASE.mr.title}\t(${CASE.mr.target_branch}) ← (${CASE.mr.source_branch})\n`; return finish(); }
      if (sub === 'note') { const m = flagVal(argv, '-m', '--message'); if (!m) return fail('\n   ERROR  \n\n  aborted... Note is an empty message.\n'); const id = nextId(); state.discussions.push({ id: `d${id}`, individual_note: true, resolvable: false, notes: [{ id, body: m, author: CASE.me, created_at: now() }] }); entry.flag = 'general-note'; out += `${glMr().web_url}#note_${id}\n`; return finish(); }
      if (sub === 'approve' || sub === 'revoke') { entry.flag = `verdict-${sub}`; state.verdicts = [...(state.verdicts ?? []), sub]; err += `- Approving merge request !${CASE.mr.iid}\n✔ Approved\n`; return finish(); }
    }
    if (top === 'repo' && argv[1] === 'view') { out += `name:\t${CASE.project.path}\ndescription:\t\n`; return finish(); }
    if (top === '--version' || top === 'version') { out += 'glab 1.116.0 (e8436ca8a)\n'; return finish(); }
    return fail(`\n   ERROR  \n\n  Unknown command "${argv.join(' ')}" for "glab".\n`);
  }
  if (tool === 'gh') {
    if (top === 'api') {
      if (apiArgs.includes('--help') || apiArgs.includes('-h')) { out += readFileSync(join(HERE, 'help/gh-api.txt'), 'utf8'); return finish(); }
      const r = parseApi(apiArgs, 'gh'); if (r.error) return fail(r.error);
      if (!r.endpoint) return fail('accepts 1 arg(s), received 0');
      let res; try { res = ghApi(r); } catch (e) { return fail(e.message); }
      printApi(res, r, 'gh'); return finish();
    }
    if (top === 'auth' && argv[1] === 'status') { out += `github.com\n  ✓ Logged in to github.com account ${CASE.me} (keyring)\n  - Active account: true\n  - Git operations protocol: https\n  - Token scopes: 'repo', 'read:org'\n`; return finish(); }
    if (top === 'pr') {
      const sub = argv[1];
      if (sub === 'view') {
        const json = flagVal(argv, '--json'); const jq = flagVal(argv, '-q', '--jq');
        if (json) { const p = ghPr(); const all = { number: p.number, title: p.title, body: p.body, state: 'OPEN', headRefName: p.head.ref, headRefOid: p.head.sha, baseRefName: p.base.ref, baseRefOid: p.base.sha, url: p.html_url, author: { login: CASE.mr.author }, commits: prCommits().map((oid) => ({ oid })), files: [], reviewDecision: '', comments: state.issue_comments.map((c) => ({ author: { login: c.user.login }, body: c.body })) };
          const obj = Object.fromEntries(json.split(',').map((k) => [k, all[k] ?? null]));
          if (jq) { try { out += execFileSync('jq', ['-r', jq], { input: JSON.stringify(obj), encoding: 'utf8' }); } catch { return fail('failed to parse jq expression'); } } else out += JSON.stringify(obj, null, 2) + '\n';
          return finish(); }
        out += mrText(); if (argv.includes('--comments') || argv.includes('-c')) out += '\n' + state.issue_comments.map((c) => `${c.user.login} commented\n${c.body}`).join('\n\n') + '\n'; return finish();
      }
      if (sub === 'diff') { out += argv.includes('--name-only') ? git('diff', '--name-only', mergeBase(ghPr().base.sha, ghPr().head.sha), ghPr().head.sha) + '\n' : prDiffText(); return finish(); }
      if (sub === 'checkout') { checkoutBranch(); return finish(); }
      if (sub === 'list') { out += `${CASE.mr.iid}\t${CASE.mr.title}\t${CASE.mr.source_branch}\tOPEN\n`; return finish(); }
      if (sub === 'comment') { let b = flagVal(argv, '-b', '--body'); const f = flagVal(argv, '-F', '--body-file'); if (f) b = f === '-' ? readStdin() : readFileSync(f, 'utf8'); if (!b) return fail('body cannot be blank'); const id = nextId(); state.issue_comments.push({ id, body: b, user: ghUser(CASE.me), created_at: now() }); entry.flag = 'general-comment'; out += `${ghPr().html_url}#issuecomment-${id}\n`; return finish(); }
      if (sub === 'review') { const ev = argv.includes('--approve') || argv.includes('-a') ? 'APPROVE' : argv.includes('--request-changes') || argv.includes('-r') ? 'REQUEST_CHANGES' : 'COMMENT'; let b = flagVal(argv, '-b', '--body'); const f = flagVal(argv, '-F', '--body-file'); if (f) b = f === '-' ? readStdin() : readFileSync(f, 'utf8'); const id = nextId(); state.reviews = [...(state.reviews ?? []), { id, state: ev === 'COMMENT' ? 'COMMENTED' : ev, body: b ?? '', user: ghUser(CASE.me) }]; entry.flag = `review-${ev}`; if (ev !== 'COMMENT') state.verdicts = [...(state.verdicts ?? []), ev]; err += `- Reviewed pull request #${CASE.mr.iid}\n`; return finish(); }
    }
    if (top === 'repo' && argv[1] === 'view') { out += `name:\t${CASE.repo.owner}/${CASE.repo.name}\ndescription:\t\n`; return finish(); }
    if (top === '--version' || top === 'version') { out += 'gh version 2.100.0 (2026-09-03)\n'; return finish(); }
    return fail(`unknown command "${argv[0] ?? ''}" for "gh"`);
  }
  return fail(`${tool}: unknown tool`);
}
main();
