import { readFile, writeFile, readdir, stat, mkdir, unlink } from "fs/promises";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ディレクトリ設定
const DATA_BASE_PATH = path.join(__dirname, "..", "src", "components", "data");
const PROJECT_ROOT = path.join(__dirname, "..");
const UPLOAD_BASE_PATH = path.join(PROJECT_ROOT, "files");

// 内蔵JSONファイル名リスト
export const BUILTIN_JSON_FILES = [
  "koumin.json",
  "koumin2.json",
  "rinri.json",
  "rinri2.json",
  "seikei.json",
  "chiri.json",
  "chiri2.json",
  "Chemistry.json",
  "organic.json",
  "chemistoryByIsii.json",
  "chemistoryByIsii2.json",
];

async function ensureUploadsDir() {
  await mkdir(UPLOAD_BASE_PATH, { recursive: true });
}

function normalizeJsonFileName(name) {
  if (!name || typeof name !== "string") {
    throw new Error("ファイル名が無効です");
  }
  const trimmed = name.trim();
  const base = path.basename(trimmed);
  if (base !== trimmed) {
    throw new Error("パスを含むファイル名は使用できません");
  }
  if (!/\.json$/i.test(base)) {
    throw new Error("拡張子は .json のみ対応しています");
  }
  if (base.includes("..")) {
    throw new Error("ファイル名に .. を含めることはできません");
  }
  return base;
}

function normalizeWordRecord(item) {
  if (!item || typeof item !== "object") {
    throw new Error("JSONの各要素はオブジェクトである必要があります");
  }
  if (!item.word || !item.meaning) {
    throw new Error("各単語には word と meaning が必要です");
  }
  return {
    word: item.word,
    meaning: item.meaning,
    category: item.category || "未分類",
    example: item.example || null,
    difficulty: item.difficulty || 1,
    id: item.id || crypto.randomUUID(),
    createdAt: item.createdAt || new Date(),
  };
}

async function readWordsFromJsonFile(filePath) {
  const data = await readFile(filePath, "utf8");
  const words = JSON.parse(data);
  if (!Array.isArray(words)) {
    throw new Error("JSONファイルは配列形式である必要があります");
  }
  return words;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function resolveJsonFilePath(fileName) {
  const normalized = normalizeJsonFileName(fileName);
  if (BUILTIN_JSON_FILES.includes(normalized)) {
    return {
      type: "builtin",
      path: path.join(DATA_BASE_PATH, normalized),
    };
  }
  await ensureUploadsDir();
  const uploadedPath = path.join(UPLOAD_BASE_PATH, normalized);
  if (await fileExists(uploadedPath)) {
    return {
      type: "uploaded",
      path: uploadedPath,
    };
  }
  throw new Error(`Forbidden JSON file: ${fileName}`);
}

export async function loadVocabularyFromJson(fileName) {
  try {
    const { path: filePath } = await resolveJsonFilePath(fileName);
    const rawWords = await readWordsFromJsonFile(filePath);
    return rawWords.map((item) => normalizeWordRecord(item));
  } catch (error) {
    console.error(`Error loading JSON file ${fileName}:`, error);
    throw new Error(`Failed to load vocabulary from ${fileName}: ${error.message}`);
  }
}

export async function listUploadedJsonFiles() {
  await ensureUploadsDir();
  const entries = await readdir(UPLOAD_BASE_PATH, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }
    const name = normalizeJsonFileName(entry.name);
    const filePath = path.join(UPLOAD_BASE_PATH, name);
    const stats = await stat(filePath);
    let wordCount = null;
    try {
      const words = await readWordsFromJsonFile(filePath);
      wordCount = Array.isArray(words) ? words.length : null;
    } catch {
      wordCount = null;
    }
    files.push({
      name,
      size: stats.size,
      updatedAt: stats.mtime,
      wordCount,
    });
  }
  files.sort((a, b) => b.updatedAt - a.updatedAt);
  return files;
}

export async function readUploadedJsonFile(fileName) {
  const normalized = normalizeJsonFileName(fileName);
  await ensureUploadsDir();
  const filePath = path.join(UPLOAD_BASE_PATH, normalized);
  if (!(await fileExists(filePath))) {
    throw new Error("ファイルが存在しません");
  }
  const words = await readWordsFromJsonFile(filePath);
  return {
    name: normalized,
    content: JSON.stringify(words, null, 2),
    words,
    wordCount: words.length,
  };
}

export async function saveUploadedJsonFile(fileName, content, options = {}) {
  const normalized = normalizeJsonFileName(fileName);
  await ensureUploadsDir();
  const filePath = path.join(UPLOAD_BASE_PATH, normalized);
  const overwrite = options?.overwrite !== undefined ? !!options.overwrite : true;
  if (!overwrite && (await fileExists(filePath))) {
    const err = new Error("同名のファイルが既に存在します");
    err.code = "FILE_EXISTS";
    throw err;
  }
  const payload = typeof content === "string" ? content : JSON.stringify(content);
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed)) {
    throw new Error("JSONファイルは配列形式である必要があります");
  }
  parsed.forEach((item) => {
    if (!item || typeof item !== "object" || !item.word || !item.meaning) {
      throw new Error("各単語には word と meaning が必要です");
    }
  });
  await writeFile(filePath, JSON.stringify(parsed, null, 2), "utf8");
  return { name: normalized, wordCount: parsed.length };
}

export async function deleteUploadedJsonFile(fileName) {
  const normalized = normalizeJsonFileName(fileName);
  await ensureUploadsDir();
  const filePath = path.join(UPLOAD_BASE_PATH, normalized);
  if (!(await fileExists(filePath))) {
    throw new Error("ファイルが存在しません");
  }
  await unlink(filePath);
}

export async function listAvailableJsonCatalog() {
  const builtin = await Promise.all(
    BUILTIN_JSON_FILES.map(async (name) => {
      try {
        const { path: filePath } = await resolveJsonFilePath(name);
        const words = await readWordsFromJsonFile(filePath);
        return {
          name,
          wordCount: Array.isArray(words) ? words.length : null,
          type: "builtin",
        };
      } catch {
        return { name, wordCount: null, type: "builtin" };
      }
    })
  );
  const uploadedRaw = await listUploadedJsonFiles();
  const uploaded = uploadedRaw.map((item) => ({
    name: item.name,
    wordCount: item.wordCount,
    updatedAt: item.updatedAt,
    size: item.size,
    type: "uploaded",
  }));
  return { builtin, uploaded };
}

export async function exportUploadedJsonFiles() {
  const uploads = await listUploadedJsonFiles();
  const results = [];
  for (const file of uploads) {
    try {
      const filePath = path.join(UPLOAD_BASE_PATH, file.name);
      const data = await readFile(filePath, "utf8");
      results.push({ name: file.name, content: data });
    } catch (error) {
      console.error(`[Export] Failed to read uploaded file ${file.name}:`, error?.message || error);
    }
  }
  return results;
}

export async function applyUploadedJsonFiles(files = []) {
  if (!Array.isArray(files)) return;
  for (const entry of files) {
    if (!entry || typeof entry !== "object") continue;
    const { name, content } = entry;
    if (!name || typeof content !== "string") continue;
    try {
      await saveUploadedJsonFile(name, content);
    } catch (error) {
      console.error(`[Import] Failed to save uploaded file ${name}:`, error?.message || error);
    }
  }
}

