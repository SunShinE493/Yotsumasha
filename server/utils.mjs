import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 許可されたJSONファイルのベースディレクトリ
const DATA_BASE_PATH = path.join(__dirname, '..' , 'src', 'components', 'data');

// 許可されたJSONファイル名リスト
const ALLOWED_JSON_FILES = [
  'koumin.json',
  'koumin2.json',
  'rinri.json',
  'seikei.json',
];

export async function loadVocabularyFromJson(fileName) {
  if (!ALLOWED_JSON_FILES.includes(fileName)) {
    throw new Error(`Forbidden JSON file: ${fileName}`);
  }

  const filePath = path.join(DATA_BASE_PATH, fileName);
  try {
    const data = await readFile(filePath, 'utf8');
    const words = JSON.parse(data);

    // 単語構造の基本的なバリデーション
    if (!Array.isArray(words)) {
      throw new Error(`JSON file ${fileName} must contain an array of words.`);
    }
    return words.map(item => ({
      word: item.word,
      meaning: item.meaning,
      category: item.category || "未分類",
      example: item.example || null,
      difficulty: item.difficulty || 1,
      // IDはサーバー側で割り当てるか、クライアントで割り当てられたものを使用
      // ここでは簡易的にUUIDを生成
      id: item.id || crypto.randomUUID(), 
      createdAt: item.createdAt || new Date(),
    }));
  } catch (error) {
    console.error(`Error loading JSON file ${fileName}:`, error);
    throw new Error(`Failed to load vocabulary from ${fileName}: ${error.message}`);
  }
}
