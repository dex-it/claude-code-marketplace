import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const root = process.env.ORACLE_REPO;
if (!root) throw new Error('ORACLE_REPO не задан');
export const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);
export const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
