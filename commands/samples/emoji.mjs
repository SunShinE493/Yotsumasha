let emoji = ['a','b','c','<:Flapper:1288693937770467409>','<:Kao:1315279759739195443>','やった','<:Keshitetekusa:1315640091787395113>','うんた','あもやろ','あも','きみあたま','くさ']

import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()

  .setName('emoji')

  .setDescription('あ')

  .addIntegerOption(option => 

    option.setName('number')

      .setDescription('数')

      .setRequired(true)

  );

export async function execute(interaction) {

let num =  interaction.options.getInteger('number');

 let q = emoji[num]
 
interaction.channel.send(q)

}