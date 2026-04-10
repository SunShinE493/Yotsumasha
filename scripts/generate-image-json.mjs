import fs from 'fs/promises';
import path from 'path';

/**
 * public/images/cards フォルダ内の画像を読み込み、
 * 暗記カード用のJSONテンプレートを生成するスクリプト。
 */

const IMG_DIR = './public/images/cards';
const OUTPUT_FILE = './src/components/data/image_cards_template.json';

async function generate() {
    try {
        // フォルダが存在しない場合は作成
        await fs.mkdir(IMG_DIR, { recursive: true });

        const files = await fs.readdir(IMG_DIR);
        const imageFiles = files.filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f));

        if (imageFiles.length === 0) {
            console.log(`No images found in ${IMG_DIR}. Please add some images and run again.`);
            return;
        }

        const sortedFiles = imageFiles.sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        const cards = [];
        for (let i = 0; i < sortedFiles.length; i += 2) {
            const frontImg = sortedFiles[i];
            const backImg = sortedFiles[i + 1];

            if (backImg) {
                cards.push({
                    category: "新規画像ペアカード",
                    subcategory: "0",
                    word: `img:/images/cards/${frontImg}:${i + 1}`,
                    meaning: `img:/images/cards/${backImg}:${i + 2}`,
                    answerType: "画像ペア",
                    difficulty: "1"
                });
            } else {
                // 奇数枚だった場合、最後は画像のみ
                cards.push({
                    category: "新規画像ペアカード",
                    subcategory: "0",
                    word: `img:/images/cards/${frontImg}:${i + 1}`,
                    meaning: `${i + 1}`,
                    answerType: "画像",
                    difficulty: "1"
                });
            }
        }

        await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(cards, null, 2), 'utf8');

        console.log(`Successfully generated ${cards.length} cards in ${OUTPUT_FILE}`);
    } catch (err) {
        console.error('Error:', err);
    }
}

generate();
