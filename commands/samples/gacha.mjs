import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("uranai")
  .setDescription("藤田占いダヒョ")
.addSubcommand(subcommand => subcommand

    .setName('i')

    .setDescription('藤田ガチャだょ')
              )
.addSubcommand(subcommand => subcommand

    .setName('italian')

    .setDescription('💀☠️💀☠️')

              )
.addSubcommand(subcommand => subcommand

    .setName('10ren')

    .setDescription('10藤田でます')
              );


export async function execute(interaction) {
  
  const brainrotimg = ["https://cdn.discordapp.com/attachments/1354471322557612218/1354502920946712809/Screenshot_20250327-020805.png?ex=67e586a5&is=67e43525&hm=7af4f86d5b96891a21e90ee4fc66e65ba10a535747bf8e0daa01aad9bbf90917&","https://cdn.discordapp.com/attachments/1179247297008246905/1354497570512175154/Screenshot_20250327-003442.png?ex=67e581aa&is=67e4302a&hm=e4c7f75aafeb6069ca60c1d6875f75419d8c5e52bcfca05c8f8cde6102c21a5b&","https://cdn.discordapp.com/attachments/1354471322557612218/1354475927483977748/Screenshot_20250327-001223.png?ex=67e56d82&is=67e41c02&hm=dce2ef557e2cf06e1cf123effba17231e54231d446b28d67c8967ea7168fd902&","https://cdn.discordapp.com/attachments/1354471322557612218/1354475938901004410/Screenshot_20250327-001035.png?ex=67e56d84&is=67e41c04&hm=f1870f81391ee1521550cfcc1c5b95a1dd346c09eac781c3077b4e4590734b1f&","https://cdn.discordapp.com/attachments/1354471322557612218/1354475949495816252/markup_1000006909.png?ex=67e56d87&is=67e41c07&hm=5e23332f92dfd2533267d802af9859670a1c52f7ddbeada41cce175883687c19&","https://cdn.discordapp.com/attachments/1354471322557612218/1354475916985634908/Screenshot_20250327-001448.png?ex=67e56d7f&is=67e41bff&hm=499dcd79b699478d2fff09524576dc5458eebaae258c87169d848d511118fa35&ああ","https://cdn.discordapp.com/attachments/1354471322557612218/1354476403688607855/Screenshot_20250327-002525.png?ex=67e56df3&is=67e41c73&hm=31ccba8f09b9f7b044678f7f06cae2f02084263e31dd397bc802e7395b4a8ae9&","https://cdn.discordapp.com/attachments/1354471322557612218/1354476899094626508/Screenshot_20250327-002721.png?ex=67e56e69&is=67e41ce9&hm=d6059e8698fab789c37622ad43af34afb61ec1df857900c6d3c97612927d31e0&","https://cdn.discordapp.com/attachments/1354471322557612218/1354477227995304158/Screenshot_20250327-002835.png?ex=67e56eb8&is=67e41d38&hm=ef304011b759a502ea30cccd889214c2e461db0fec7153388b0cad575e075f63&","https://cdn.discordapp.com/attachments/1354471322557612218/1354477239252553874/Screenshot_20250327-001710.png?ex=67e56eba&is=67e41d3a&hm=17eb9703547f77cb7ef5dfeb0eec7061b1697e1fa7398431be4ce20f1c4600c2&","https://cdn.discordapp.com/attachments/1354471322557612218/1354477736042692759/Screenshot_20250327-002937.png?ex=67e56f31&is=67e41db1&hm=c5ae134a36104faac023816b63bfae0fa3f12eb40084d9f6b2a991245541c8fd&","https://cdn.discordapp.com/attachments/1354471322557612218/1354477746323198163/Screenshot_20250327-001755.png?ex=67e56f33&is=67e41db3&hm=faedce895a946bab14f440e6c9dae5c3820220291ded98ea344d255b04153260&","https://cdn.discordapp.com/attachments/1354471322557612218/1354477831199133837/Screenshot_20250327-001820.png?ex=67e56f47&is=67e41dc7&hm=d89a199a778c4fa0cfb41c05aba90014cc2042a3b5d092b0a53505f290a65d74&","https://cdn.discordapp.com/attachments/1354471322557612218/1354477931614699610/Screenshot_20250327-003130.png?ex=67e56f5f&is=67e41ddf&hm=91cc496ee477f810a7fd84adb25186688ecc1dff245ded9b5970c4d1a938cf76&","https://cdn.discordapp.com/attachments/1354471322557612218/1354478146266857683/Screenshot_20250327-003214.png?ex=67e56f93&is=67e41e13&hm=365d57c95ccef3df034e6618c7665440503dbf1440a35588a0a9085437244619&","https://cdn.discordapp.com/attachments/1354471322557612218/1354478157595676913/Screenshot_20250327-002001.png?ex=67e56f95&is=67e41e15&hm=a2d58f4b8ebfe11916429e98efb31dbb6a7cb4ff55c435aff7d0d523990ed056&","https://cdn.discordapp.com/attachments/1354471322557612218/1354478168173580298/Screenshot_20250327-002023.png?ex=67e56f98&is=67e41e18&hm=d249d6f36624da2a4559cde93a935ed72917cb06a5cf78a78d433e1a0187edec&","https://cdn.discordapp.com/attachments/1354471322557612218/1354479268150771892/Screenshot_20250327-003638.png?ex=67e5709e&is=67e41f1e&hm=7abfd8adc9ce1d1d904873fb8f44455ccf1a4c9e57bb1ed31855cd1d113e3eda&","https://cdn.discordapp.com/attachments/1354471322557612218/1354479353425301504/Screenshot_20250325-232257.png?ex=67e570b2&is=67e41f32&hm=1dab18b14bee258d78c8033999af23b13c668d24694d3d13c033de9b7f573a24&","https://cdn.discordapp.com/attachments/1354471322557612218/1354480870790008942/Screenshot_20250327-003926.png?ex=67e5721c&is=67e4209c&hm=e2c307817ae34ccd8e48e261291a0043718eabb55fb9187ac350442c0478ef4f&","https://cdn.discordapp.com/attachments/1354471322557612218/1354480893351301191/Screenshot_20250327-001531.png?ex=67e57222&is=67e420a2&hm=fead514564f249729d260a7bdc2ae46dcada7aae7504178c5ef67c340c78e16d&","https://cdn.discordapp.com/attachments/1354471322557612218/1354480906118758461/Screenshot_20250327-004135.png?ex=67e57225&is=67e420a5&hm=667bf54ec3ca46b6cfccbeb52619663811429e2c86f96cc126ffd01a12a30e2e&","https://tenor.com/view/lirili-larila-gif-10086152631622725846","https://tenor.com/view/tralalelo-tralalala-gif-9781035983536344817","https://tenor.com/view/plane-memes-meme-animals-brainrot-gif-4980906455793060286"]
  const bweight     = [8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,2,2,2,2]
  const brainrot    = ["BRIII BRIII BICUS DICUS DEBICUS DEDICUS","GIRAFFA MELONIERA","BONECA AMBALABU","BOMBOMBINI GOUSINI","LA VACA SATURNO SATURNITA","GIRAFFA CELESTE","TRIPPI TROPPI TROPPA TRIPPA","ORANGUTINI ANANNASINI","BOBRINNI KOKOKOSINNI","BOBRITTO BANDITO","TRULIMERO TRULICHINA","FRIGOCAMELO BUFUFARDELLO","CHIMPANZINNI BANANINI","CAPIBARELLO COCOSSINI","COCOFANTO ELEFANTO","ZEBRAZUBRA ZEBRALINNI","BLUEBERINNI OCTOPUSSINI","EL CACTO HIPOPOTAMO","LOS TOMATES DICEN QUE NO","TUNG TUNG TUNG SAHUR","BRR BRR PATAPIM","# G ANOMALI HOTSPOT","# SSR LIRILI LARILA","#　SSR TRALALERO TRALALA","# SSR BOMBARDIRO CROCODILO"]
  const arr = ["R<:Enamorus:1352270510414893186>逃げ","R<:YouTuberGaSutavaTyuumonSurutokinoGakaku:1352270531218640926>ローアングル","R<:swimmer:1352270824245297242>みぞおち","R<:Xaxis:1352270571336892509>生首","R<:comfortable2:1352270614672576532>ご満悦","R<:VideoCalling:1352270635266736200>緊急でビデオ通話する","R<:CoolStanding:1352270665574514698>たちんぼ","R<:imara3:1352270719278518292>あくび(？)","R<:Vlog:1352270788060774470>Vlogを撮る","R<:Aiseki:1349555074774339584>毒を盛られたことに気づいた","R<:Zecchi:1349952390723403847>絶頂","R<:Comfortable:1349592333175488532>事後","R<:Gekiita:1349952380937965598>激イタ","R<:Bodhisattva:1349971173991125093>歩く菩薩","R<:Imara2:1349592796935491584>幽体離脱","SR<:Drunkenness:1352270838443016344>多分酔ってる","SR<:Teacher:1352270696268697658>謎理論展開","SR<:BraveFighter:1352270745455034420>40歳無の職","SR<:comfortable3:1352270768179908658>どアップ","SR<:BeautifulSummer:1349592817722327122>煽り厨","SR<:Obake:1349592808964755467>おばけに乗っ取られた","SR<:FeelAsleep:1349592778639802551>睡眠ガチ勢","SR<:FrontofFace:1349592789578547302>ウマヅラ","SR<:MasterofBilliards:1349592653288701994>ビリヤード","SR<:nanikaikenaimonowomitesimattatok:1301436869715689523>何かに唖然とした","SR<:Calling:1349953298937024572>着信","SR<:Kirin:1349953307564576812>きりん","SR<:Childhood:1349953315747794945>幼き頃の","# SSR<:GayActor:1349555116797198388>AV","# G<:Hikoku:1349583835733426226>書類送検","# SSR<:Imara:1349592318897815622>4K","# SSR<:Foreverlove:1349555062246215680>ウェディング","# SSR<:kikainakao:1352270861683654747>変顔","# SSR<:theater:1352270809661706250>映画館デート(彼女目線)の","# SSR<:kidscorner:1352270597152964660>精神年齢的にお子様な","# SSR<:beautiFlower:1352270553121034261>JK","# ||UR<:GCGGarrettTurbo:1352270869170225233>ターボ||","# ||LR<a:serveGG:1352267714974060644>サーブ||"];
  const weight = [16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,8,8,8,8,8,8,8,8,8,8,8,8,8,4,4,4,4,4,4,4,4,2,1];
  const subcommand = interaction.options.getSubcommand();
  let replymess = '10連結果: \n';
  let result = "";
  let result2 = "";
  
  let totalWeight = 0;
  for (let i = 0; i < weight.length; i++) {
    totalWeight += weight[i];
  }
  let random = Math.floor(Math.random() * totalWeight);
  
  let btotalWeight = 0;
  for (let i = 0; i < bweight.length; i++) {
    btotalWeight += bweight[i];
  }
  let brandom = Math.floor(Math.random() * btotalWeight);

  
  
  
  if (subcommand === '10ren') {
    
    for(let t =0; t<10 ; t++){
      
       random = Math.floor(Math.random() * totalWeight);

  
      for (let i = 0; i < weight.length; i++) {

    if (random < weight[i]) {

      result = arr[i];
      
      replymess += `${result}藤田   \n`
    
      break;

    } else {

      random -= weight[i];

    }

  }
    } 
    await interaction.reply(replymess);
   
    }else if(subcommand === 'italian'){

  for (let i = 0; i < bweight.length; i++) {
    if (brandom < bweight[i]) {
      result = brainrot[i];
      result2 = brainrotimg[i];
      break;
    } else {
      brandom -= bweight[i];
    }
  }

  await interaction.reply(`${result}\n${result2}`);
      
      
    }
  else{
  for (let i = 0; i < weight.length; i++) {
    if (random < weight[i]) {
      result = arr[i];
      break;
    } else {
      random -= weight[i];
    }
  }

  await interaction.reply(`${result}藤田 が当選しました！`);
      }
}
