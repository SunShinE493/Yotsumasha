import { SlashCommandBuilder } from 'discord.js';

import {Koumin6 ,Koumin7} from  './citizenquiz.mjs';

export const data = new SlashCommandBuilder()
  .setName('misslist')
  .setDescription('復習シートの作成')
  .addStringOption(option => 
    option.setName('missnumber')
      .setDescription('問題リスト')
      .setRequired(true)
  ).addIntegerOption(option => 
    option.setName('category')
      .setDescription('問題のカテゴリ (2,3,4,5,3年考査ⅱ:8)　15：地理V')
      .setRequired(true)                 
  );
  

export async function execute(interaction) {
    const missnumber = interaction.options.getString('missnumber');
    const hani = interaction.options.getInteger('category');



const numbersString = interaction.options.getString('missnumber'); 
        if (!numbersString) {
            await interaction.reply({ content: '数字のリストを指定してください（例: 1,2,3）', ephemeral: true });
            return;
        }
         const numbersArray = numbersString.split(',').map(s => s.trim());
        console.log('取得した配列（文字列）:', numbersArray);

let result = `復習シート`;

for (let i=0; i<numbersArray.length; i++){

let random,tango, seikai;

          random = numbersArray[i];
/***
          if (hani === 2) {

                tango = kouminQ2[random];

                seikai = KouminA2[random];

            } else if (hani === 3) {

                tango = KouminQ3[random];

                seikai = KouminA3[random];

            } else if (hani === 4) {

                tango = KouminQ4[random];

                seikai = KouminA4[random];

            } else if (hani === 5) {

                tango = KouminQ5[random];

                seikai = KouminA5[random];
                
            } else if (hani === 7) {

                tango = Seikei1[2*random];

                seikai =Seikei1[2*random+1];
}
            
***/
            if (hani === 6) {

                tango = Koumin6[2*random];

                seikai =Koumin6[2*random+1];

            } else if (hani === 8) {

                tango =  Koumin7[2*random];

                seikai = Koumin7[2*random+1];

            }

        result += `\n\n${random}${tango}||${seikai}||`
        }
        interaction.reply (result);
        }