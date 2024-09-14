const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, PermissionsBitField, StringSelectMenuBuilder } = require('discord.js');
const QRCode = require('qrcode');
const archiver = require('archiver');
require('dotenv').config();
const { generateCodes } = require('../codegen/codegen');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const BUTTON_CHANNEL_ID = process.env.BUTTON_CHANNEL_ID;
const PROMPT_CATEGORY_ID = process.env.PROMPT_CATEGORY_ID;
const CODES_CATEGORY_ID = process.env.CODES_CATEGORY_ID;
const QR_CODE_DIRECTORY = './qrcodes/';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const userSelections = new Map();

function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }
}

async function generateQRCode(code, fileName) {
  try {
    await QRCode.toFile(fileName, code, {
      version: 1,
      errorCorrectionLevel: 'H',
    });
    return fileName;
  } catch (err) {
    console.error('Error while generating QR codes:', err);
    return null;
  }
}

function createTempUserDirectory(userId) {
  const tempDir = path.join(QR_CODE_DIRECTORY, `temp_${userId}`);
  ensureDirectoryExists(tempDir);
  return tempDir;
}

function zipFiles(sourceDir, zipFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function deleteFiles(filePaths) {
  for (const filePath of filePaths) {
    fs.unlink(filePath, err => {
      if (err) console.error(`Error while trying to delete the file ${filePath}:`, err);
    });
  }
}

function deleteDirectory(directory) {
  fs.rm(directory, { recursive: true }, err => {
    if (err) console.error(`Error while trying to delete the folder ${directory}:`, err);
  });
}

client.once('ready', async () => {
  try {
    const channel = await client.channels.fetch(BUTTON_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 1 });
    const lastMessage = messages.first();

    if (!lastMessage || !lastMessage.components.length || lastMessage.components[0].components[0].customId !== 'generate_button') {
      const embed = new EmbedBuilder()
        .setTitle('• BurgerCodeGen •')
        .setDescription(
          "\nThis bot was made to generate codes for the promotional operation \"Burger Mystère\" of Burger King France.\n\nTo start, please press the button and follow the instructions.\n\nThe bot will create your own channel for you to make your request and handle it."
        )
        .setColor('#FF5500');

      const generateButton = new ButtonBuilder()
        .setCustomId('generate_button')
        .setLabel('‎ ‎ ‎ Generate')
        .setEmoji('🍔')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(generateButton);

      await channel.send({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    console.error('Error while starting the bot:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    switch (interaction.customId) {
      case 'generate_button':
        await handleGenerateButton(interaction);
        break;
      case 'start_button':
        await handleStartButton(interaction);
        break;
      case 'close_prompt_button':
        await handleCloseButton(interaction);
        break;
      case 'confirm_button':
        await handleConfirmButton(interaction);
        break;
      case 'close_codes_button':
        await handleCloseButton(interaction);
        break;
      default:
        console.warn(`Interaction not handled: ${interaction.customId}`);
    }
  } else if (interaction.isStringSelectMenu()) {
    switch (interaction.customId) {
      case 'select_lots':
        await handleSelectLots(interaction);
        break;
      case 'select_meat':
        await handleSelectMeat(interaction);
        break;
      default:
        console.warn(`Dropdown not handled: ${interaction.customId}`);
    }
  }
});

async function handleGenerateButton(interaction) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const userId = interaction.user.id;
    const promptChannelName = `prompt-${userId}`;
    const codesChannelName = `codes-${userId}`;

    if (guild.channels.cache.some(channel => channel.name === promptChannelName || channel.name === codesChannelName)) {
      await interaction.reply({ content: 'You already have an opened channel. Please use it or delete it.', ephemeral: true });
      return;
    }

    const channel = await guild.channels.create({
      name: promptChannelName,
      type: 0,
      parent: PROMPT_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle('• BurgerCodeGen •')
      .setDescription("Welcome to your own prompt channel.\n\nLet the bot guide you trough the whole process !")
      .setColor('#FF5500');

    const startButton = new ButtonBuilder()
      .setCustomId('start_button')
      .setLabel('‎ ‎ ‎ Start')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Success);

    const closeButton = new ButtonBuilder()
      .setCustomId('close_prompt_button')
      .setLabel('‎ ‎ ‎ Close')
      .setEmoji('🧽')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(startButton, closeButton);

    await channel.send({ embeds: [embed], components: [row] });

    await interaction.reply({ content: `Your prompt channel has been created successfully ! Please go to this channel : ${channel.toString()}`, ephemeral: true });
  } catch (err) {
    console.error('Error while trying to handle the generate button:', err);
    await interaction.reply({ content: 'An error has occured with your request.', ephemeral: true });
  }
}

async function handleStartButton(interaction) {
  try {
    const channel = interaction.channel;
    await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_prompt_button').setLabel('‎ ‎ ‎ Close').setEmoji('🧽').setStyle(ButtonStyle.Danger))] });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_lots')
      .setPlaceholder('Select how much lots.')
      .addOptions([...Array(10).keys()].map(i => ({ label: `${i + 1}`, value: `${i + 1}` })));

    const embed = new EmbedBuilder()
      .setTitle('• Step 1/2 •')
      .setDescription("First, how much lots do you want ?\n\n[INFO] : Each lot contains **2 codes**, and you can generate a maximum of **10 lots**.")
      .setColor('#FF5500');

    await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    await interaction.deferUpdate();
  } catch (err) {
    console.error('Error while trying to handle the start button:', err);
  }
}

async function handleCloseButton(interaction) {
  try {
    await interaction.channel.delete();
  } catch (err) {
    console.error('Error while trying to close channel code:', err);
  }
}

async function handleSelectLots(interaction) {
  try {
    const lots = parseInt(interaction.values[0]);
    const totalCodes = lots * 2;
    userSelections.set(interaction.user.id, { totalCodes });

    const meatSelectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_meat')
      .setPlaceholder('Select how much meat codes.')
      .addOptions([...Array(totalCodes + 1).keys()].map(i => ({ label: `${i}`, value: `${i}` })));

    const embed = new EmbedBuilder()
      .setTitle('• Step 2/2 •')
      .setDescription("Now choose how much **Meat** codes you want.\n\nThe rest of the unseletced codes will be assigned as **Veggie**.")
      .setColor('#FF5500');

    await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(meatSelectMenu)] });
  } catch (err) {
    console.error('Error while selecting lots:', err);
  }
}

async function handleSelectMeat(interaction) {
  try {
    const meatCodes = parseInt(interaction.values[0]);
    const totalCodes = userSelections.get(interaction.user.id).totalCodes;
    const veggieCodes = totalCodes - meatCodes;

    userSelections.set(interaction.user.id, { meatCodes, veggieCodes });

    const embed = new EmbedBuilder()
      .setTitle('• Choices Summary •')
      .setDescription(`Here is your choices summary :\n\n🍖 • **Meat** : ${meatCodes}\n🍃 • **Veggie** : ${veggieCodes}\n\nIf your choices are **correct**, please press the **confirm** button.\nElse, close this prompt channel and create a new one.`)
      .setColor('#FF5500');

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_button')
      .setLabel('‎ ‎ ‎ Confirm')
      .setEmoji('🍔')
      .setStyle(ButtonStyle.Success);

    await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(confirmButton)] });
  } catch (err) {
    console.error('Error while trying to select code types:', err);
  }
}

async function handleConfirmButton(interaction) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const userId = interaction.user.id;
    const { meatCodes, veggieCodes } = userSelections.get(userId);
    const choices = 'B'.repeat(meatCodes) + 'V'.repeat(veggieCodes);

    const codesChannel = await guild.channels.create({
      name: `codes-${userId}`,
      type: 0,
      parent: CODES_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    await interaction.reply({ content: `Your choices has been confirmed. The generation process has been launched.\n\nPlease go to this channel : ${codesChannel.toString()}\n\nYour prompt channel will be deleted after the generation is complete.`, ephemeral: true });

    ensureDirectoryExists(QR_CODE_DIRECTORY);
    const tempUserDir = createTempUserDirectory(userId);
    const generatedFiles = [];

    const embed = new EmbedBuilder()
      .setTitle('• BurgerCodeGen •')
      .setDescription("The codes are being generated, please wait patiently.\n\nAfter you used your codes, please close this channel, else you won't be able to generate new codes.")
      .setColor('#FF5500');

    const closeButton = new ButtonBuilder()
      .setCustomId('close_codes_button')
      .setLabel('‎ ‎ ‎ Close')
      .setEmoji('🧽')
      .setStyle(ButtonStyle.Danger);

    await codesChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(closeButton)] });

    const lots = choices.match(/.{1,2}/g);
    for (let i = 0; i < lots.length; i++) {
      const [firstChoice, secondChoice] = lots[i];
      const { firstCode, secondCode } = await generateCodes(firstChoice, secondChoice);

      const firstQRCodeFile = await generateQRCode(firstCode, path.join(tempUserDir, `lot_${i + 1}_code_1.png`));
      const secondQRCodeFile = await generateQRCode(secondCode, path.join(tempUserDir, `lot_${i + 1}_code_2.png`));

      generatedFiles.push(firstQRCodeFile, secondQRCodeFile);

      await sendCodeEmbed(codesChannel, i + 1, 1, firstChoice, firstCode, firstQRCodeFile);
      await sendCodeEmbed(codesChannel, i + 1, 2, secondChoice, secondCode, secondQRCodeFile);
    }

    const zipFilePath = path.join(QR_CODE_DIRECTORY, `QRcodes_${userId}.zip`);
    await zipFiles(tempUserDir, zipFilePath);
    await codesChannel.send({ files: [zipFilePath] });

    deleteFiles(generatedFiles.concat(zipFilePath));
    deleteDirectory(tempUserDir);

    setTimeout(() => interaction.channel.delete(), 5000);
  } catch (err) {
    console.error('Error while confirming:', err);
  }
}

async function sendCodeEmbed(channel, lotNumber, codeNumber, choice, code, qrCodeFile) {
  const embed = new EmbedBuilder()
    .setTitle('• BurgerCodeGen •')
    .setDescription(`\n**Lot ${lotNumber} - Code ${codeNumber}**\n\n**${choice === 'B' ? '🍖 • Meat' : '🍃 • Veggie'}** code:\n\`\`\`${code}\`\`\``)
    .setThumbnail(`attachment://lot_${lotNumber}_code_${codeNumber}.png`)
    .setColor('#FF5500');

  await channel.send({ embeds: [embed], files: [qrCodeFile] });
}

function start() {
  client.login(TOKEN);
}

module.exports = { start };