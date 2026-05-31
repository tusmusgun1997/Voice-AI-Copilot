import fs from 'node:fs/promises';
import path from 'node:path';
import { isSupabaseStoreEnabled, readSupabaseCollection, writeSupabaseCollection } from './services/supabaseStore.js';

export const DEFAULT_LOCAL_DATA_FILE = 'data/app-data.json';

const EMPTY_STORE = {
  analyses: [],
  profiles: [],
  versions: []
};
const WRITE_ERROR_CODES = new Set(['EACCES', 'EPERM']);
const writeLocks = new Map();

export async function readCollection(filePath, key) {
  if (isSupabaseStoreEnabled()) {
    return readSupabaseCollection(key);
  }

  const store = await readStore(filePath);
  return Array.isArray(store[key]) ? store[key] : [];
}

export async function writeCollection(filePath, key, items) {
  if (isSupabaseStoreEnabled()) {
    return writeSupabaseCollection(key, items);
  }

  const resolvedPath = resolveStorePath(filePath);
  const previousLock = writeLocks.get(resolvedPath) ?? Promise.resolve();

  const nextLock = previousLock.then(async () => {
    const store = await readStore(filePath);
    const nextStore = {
      ...store,
      [key]: Array.isArray(items) ? items : []
    };
    await writeStore(nextStore, filePath);
    return nextStore[key];
  });

  writeLocks.set(
    resolvedPath,
    nextLock.catch(() => {})
  );

  return nextLock;
}

async function readStore(filePath = DEFAULT_LOCAL_DATA_FILE) {
  const resolvedPath = resolveStorePath(filePath);

  try {
    const content = await fs.readFile(resolvedPath, 'utf8');
    const parsed = JSON.parse(content);

    return {
      ...EMPTY_STORE,
      ...(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}),
      analyses: Array.isArray(parsed?.analyses) ? parsed.analyses : [],
      profiles: Array.isArray(parsed?.profiles) ? parsed.profiles : [],
      versions: Array.isArray(parsed?.versions) ? parsed.versions : []
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { ...EMPTY_STORE };
    throw new Error(`Unable to load local app data: ${error.message}`);
  }
}

async function writeStore(store, filePath = DEFAULT_LOCAL_DATA_FILE) {
  const resolvedPath = resolveStorePath(filePath);

  try {
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, `${JSON.stringify({ ...EMPTY_STORE, ...store }, null, 2)}\n`, 'utf8');
  } catch (error) {
    if (WRITE_ERROR_CODES.has(error.code)) {
      const writeError = new Error(
        `Unable to save local app data at ${resolvedPath}. Check that the file is not read-only and that the local server has permission to write to the project data folder.`
      );
      writeError.status = 500;
      writeError.cause = error;
      throw writeError;
    }

    throw error;
  }
}

function resolveStorePath(filePath = DEFAULT_LOCAL_DATA_FILE) {
  return path.resolve(process.cwd(), filePath || DEFAULT_LOCAL_DATA_FILE);
}
