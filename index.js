const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// === DATA STORAGE ===
const teams = new Map(); // userId -> {name, game, members, group}
const fortniteStats = new Map(); // userId -> {kills, placement, points}
const groups = { rocketleague: {}, fc: {} }; // game -> groupName -> [teams]
const knockouts = { rocketleague: [], fc: [] };

// === BOT ONLINE ===
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} is LIVE!`);
  console.log(`🎮 Fortnite | Rocket League | FC Tournament Bot`);
});

// === SEND MAIN PANEL — Type !tournament in chat ===
client.on('messageCreate', async msg => {
  if (msg.content.toLowerCase() === '!tournament') {
    const embed = new EmbedBuilder()
      .setTitle('🏆 OFFICIAL TOURNAMENT')
      .setDescription('🎮 **Fortnite • Rocket League • FC**\n\n✅ Register your team in 1 click!\n📋 Auto-added to the list & groups\n⚙️ Manage scores & brackets')
      .addFields(
        { name: '✅ Register Team', value: 'Join instantly', inline: true },
        { name: '❌ Withdraw', value: 'Leave the tournament', inline: true },
        { name: '⚙️ More Actions', value: 'Scores • Points • Brackets', inline: true }
      )
      .setColor('#2ECC71')
      .setFooter({ text: '🚫 No racism • No discrimination • Be respectful' });

    const btns = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('register').setLabel('✅ Register Team').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('withdraw').setLabel('❌ Withdraw').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('more').setLabel('⚙️ More Actions').setStyle(ButtonStyle.Primary)
    );

    await msg.channel.send({ embeds: [embed], components: [btns] });
  }
});

// === BUTTON HANDLING ===
client.on(Events.InteractionCreate, async i => {
  if (!i.isButton()) return;

  // ✅ REGISTER
  if (i.customId === 'register') {
    const modal = new ModalBuilder().setCustomId('reg_modal').setTitle('Register Your Team');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tname').setLabel('Team Name').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('game').setLabel('Game: fortnite / rocketleague / fc').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('members').setLabel('Teammates @mention').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await i.showModal(modal);
  }

  // ❌ WITHDRAW
  if (i.customId === 'withdraw') {
    if (teams.has(i.user.id)) { teams.delete(i.user.id); fortniteStats.delete(i.user.id); await i.reply({content:'✅ Withdrawn!',ephemeral:true}); }
    else await i.reply({content:'❌ Not registered!',ephemeral:true});
  }

  // ⚙️ MORE ACTIONS
  if (i.customId === 'more') {
    const embed = new EmbedBuilder().setTitle('⚙️ Actions').addFields(
      {name:'🎮 Fortnite',value:'Submit kills & placement → auto points',inline:false},
      {name:'📊 Groups',value:'View group standings',inline:false},
      {name:'🏆 Knockouts',value:'View brackets',inline:false}
    ).setColor('#3498DB');
    const b = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('fn_points').setLabel('🎮 FN Points').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('show_groups').setLabel('📊 Groups').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('show_ko').setLabel('🏆 Knockouts').setStyle(ButtonStyle.Secondary)
    );
    await i.reply({embeds:[embed],components:[b],ephemeral:true});
  }

  // 🎮 FORTNITE POINTS FORM
  if (i.customId === 'fn_points') {
    const m = new ModalBuilder().setCustomId('fn_modal').setTitle('Fortnite Score');
    m.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kills').setLabel('Total Kills').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('place').setLabel('Placement (1=1st)').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await i.showModal(m);
  }
});

// === MODAL SUBMITS ===
client.on(Events.InteractionCreate, async i => {
  if (i.type !== InteractionType.ModalSubmit) return;

  // TEAM REGISTER
  if (i.customId === 'reg_modal') {
    const tname = i.fields.getTextInputValue('tname');
    const game = i.fields.getTextInputValue('game').toLowerCase();
    const members = i.fields.getTextInputValue('members');
    if (!['fortnite','rocketleague','fc'].includes(game)) return i.reply({content:'❌ Game: fortnite / rocketleague / fc',ephemeral:true});
    teams.set(i.user.id, {name:tname,game,members,registered:i.user.tag});
    if (game === 'fortnite') fortniteStats.set(i.user.id, {kills:0,placement:0,points:0});
    const e = new EmbedBuilder().setTitle('✅ TEAM REGISTERED!').addFields(
      {name:'Team',value:tname,inline:true},{name:'Game',value:game.toUpperCase(),inline:true},{name:'Members',value:members}
    ).setColor('#2ECC71');
    await i.reply({embeds:[e]});
  }

  // FORTNITE SCORE → AUTO POINTS
  if (i.customId === 'fn_modal') {
    const kills = parseInt(i.fields.getTextInputValue('kills'));
    const place = parseInt(i.fields.getTextInputValue('place'));
    const killPts = kills * 10;
    const placePts = Math.max(0, 100 - (place - 1) * 5);
    const total = killPts + placePts;
    fortniteStats.set(i.user.id, {kills,placement:place,points:total});
    await i.reply({content:`🎮 **Fortnite Score Saved**\nKills: ${kills} (+${killPts}pts)\nPlacement: #${place} (+${placePts}pts)\n**TOTAL: ${total} PTS**`,ephemeral:true});
  }
});

// === VIEW GROUPS & KNOCKOUTS (simplified — staff can set groups) ===
client.on(Events.InteractionCreate, async i => {
  if (!i.isButton()) return;
  if (i.customId === 'show_groups') {
    let txt = '📊 **Group Stages**\nRegister first, then staff will assign groups!\n\nFortnite: Points-based\nRL/FC: Win → advance to Knockouts';
    await i.reply({content:txt,ephemeral:true});
  }
  if (i.customId === 'show_ko') {
    await i.reply({content:'🏆 **Knockout Stage**\nTop 2 from each group advance!\nMatches start after Group Stages finish.',ephemeral:true});
  }
});

client.login(process.env.TOKEN);
