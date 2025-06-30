

import { SlashCommandBuilder } from 'discord.js';
export const data = new SlashCommandBuilder()
  .setName('tami')
  .setDescription('Botが返事してくれるよ')
  .addIntegerOption(option=>
                  option.setName('content')
                  .setDescription('内容')
      .setRequired(true)

  );




export async function execute(interaction){
  let a = interaction.options.getInteger('content');
      
      
	
  interaction.channel.send(a);
}