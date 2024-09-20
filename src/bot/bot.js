const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, PermissionsBitField, StringSelectMenuBuilder, SlashCommandBuilder, Collection } = require('discord.js');
const QRCode = require('qrcode');
const archiver = require('archiver');
require('dotenv').config();
const { generateCodes } = require('../codegen/codegen');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const QR_CODE_DIRECTORY = './qrcodes/';
const DATA_FILE = './data.json';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.commands = new Collection();

// Load or initialize data.json
let botData = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    botData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Error parsing data.json:', err);
  }
}

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
  console.log(`Logged in as ${client.user.tag}!`);
  const guild = client.guilds.cache.get(botData.GUILD_ID || GUILD_ID);
  if (guild) {
    try {
      await guild.commands.create(
        new SlashCommandBuilder()
          .setName('deploy')
          .setDescription('Deploy the bot by creating necessary categories and channels.')
          .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      );
      console.log('Slash command /deploy registered.');
    } catch (err) {
      console.error('Error registering /deploy command:', err);
    }
  } else {
    console.error('Guild not found. Please check GUILD_ID in your .env file or data.json.');
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isCommand()) {
      const { commandName } = interaction;

      if (commandName === 'deploy') {
        await handleDeployCommand(interaction);
      }
    } else if (interaction.isButton()) {
      if (!botData || !botData.GUILD_ID || !botData.BUTTON_CHANNEL_ID || !botData.PROMPT_CATEGORY_ID || !botData.CODES_CATEGORY_ID) {
        await interaction.reply({ content: 'Missing data.json file or bot is not properly configured. Please contact the owner.', ephemeral: true });
        return;
      }

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
      if (!botData || !botData.GUILD_ID || !botData.BUTTON_CHANNEL_ID || !botData.PROMPT_CATEGORY_ID || !botData.CODES_CATEGORY_ID) {
        await interaction.reply({ content: 'Missing data.json file or bot is not properly configured. Please contact the owner.', ephemeral: true });
        return;
      }

      switch (interaction.customId) {
        case 'select_product':
          await handleSelectProduct(interaction);
          break;
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
  } catch (err) {
    console.error('Error handling interaction:', err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'An unexpected error occurred. Please contact the owner.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'An unexpected error occurred. Please contact the owner.', ephemeral: true });
    }
  }
});

async function handleDeployCommand(interaction) {
  try {
    const guild = await client.guilds.fetch(interaction.guildId);

    // Check if data.json exists and IDs are valid
    let alreadyDeployed = false;

    if (botData.GUILD_ID && botData.BUTTON_CHANNEL_ID && botData.PROMPT_CATEGORY_ID && botData.CODES_CATEGORY_ID) {
      const buttonChannel = guild.channels.cache.get(botData.BUTTON_CHANNEL_ID);
      const promptCategory = guild.channels.cache.get(botData.PROMPT_CATEGORY_ID);
      const codesCategory = guild.channels.cache.get(botData.CODES_CATEGORY_ID);

      if (buttonChannel && promptCategory && codesCategory) {
        alreadyDeployed = true;
      } else {
        // If any of the channels/categories do not exist, reset botData
        botData = {};
        fs.unlinkSync(DATA_FILE);
      }
    }

    if (alreadyDeployed) {
      await interaction.reply({ content: 'The bot has already been deployed. If you wish to redeploy, please delete the existing channels and data.json file.', ephemeral: true });
      return;
    }

    // Create categories with permissions to make them private
    const newPromptCategory = await guild.channels.create({
      name: 'BurgerCodeGen Prompt',
      type: 4, // Category
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
      ],
    });

    const newCodesCategory = await guild.channels.create({
      name: 'BurgerCodeGen Codes',
      type: 4, // Category
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
      ],
    });

    // Create button channel
    const newButtonChannel = await guild.channels.create({
      name: 'burger code gen',
      type: 0, // Text Channel
    });

    // Save IDs to data.json
    botData = {
      GUILD_ID: guild.id,
      BUTTON_CHANNEL_ID: newButtonChannel.id,
      PROMPT_CATEGORY_ID: newPromptCategory.id,
      CODES_CATEGORY_ID: newCodesCategory.id,
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2));

    // Send initial embed and button in the button channel
    const embed = new EmbedBuilder()
      .setTitle('• BurgerCodeGen •')
      .setDescription(
        '\nThis bot was made to generate codes for the promotional operation "Burger Mystère" of Burger King France.\n\nTo start, please press the button and follow the instructions.\n\nThe bot will create your own channel for you to make your request and handle it.'
      )
      .setColor('#FF5500');

    const generateButton = new ButtonBuilder()
      .setCustomId('generate_button')
      .setLabel('‎ ‎ ‎ Generate')
      .setEmoji('🍔')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(generateButton);

    await newButtonChannel.send({ embeds: [embed], components: [row] });

    await interaction.reply({ content: 'Bot deployed successfully!', ephemeral: true });
  } catch (err) {
    console.error('Error during deployment:', err);
    await interaction.reply({ content: 'An error occurred during deployment. Please check the bot\'s permissions and try again.', ephemeral: true });
  }
}

async function handleGenerateButton(interaction) {
  try {
    if (!botData || !botData.PROMPT_CATEGORY_ID || !botData.CODES_CATEGORY_ID) {
      await interaction.reply({ content: 'Missing data.json file or bot is not properly configured. Please contact the owner.', ephemeral: true });
      return;
    }

    const guild = await client.guilds.fetch(botData.GUILD_ID);
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
      parent: botData.PROMPT_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle('• BurgerCodeGen •')
      .setDescription('Welcome to your own prompt channel.\n\nLet the bot guide you through the whole process!')
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

    await interaction.reply({ content: `Your prompt channel has been created successfully! Please go to this channel: ${channel.toString()}`, ephemeral: true });
  } catch (err) {
    console.error('Error while trying to handle the generate button:', err);
    await interaction.reply({ content: 'An error has occurred with your request.', ephemeral: true });
  }
}

async function handleStartButton(interaction) {
  try {
    const channel = interaction.channel;
    await interaction.message.edit({
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_prompt_button')
          .setLabel('‎ ‎ ‎ Close')
          .setEmoji('🧽')
          .setStyle(ButtonStyle.Danger)
      )]
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_product')
      .setPlaceholder('Select a product.')
      .addOptions([
        { label: '🍔 Burger', value: 'burger' },
        { label: '🍦 Ice Cream', value: 'icecream' }
      ]);

    const embed = new EmbedBuilder()
      .setTitle('• Product Selection •')
      .setDescription('You can choose between **Burger** codes and **Ice Cream** codes.\n\nPlease choose what product you want with the dropdown menu.')
      .setColor('#FF5500');

    await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(selectMenu)]
    });

    await interaction.deferUpdate();
  } catch (err) {
    console.error('Error while trying to handle the start button:', err);
  }
}

async function handleCloseButton(interaction) {
  try {
    await interaction.channel.delete();
  } catch (err) {
    console.error('Error while trying to close channel!', err);
  }
}

async function handleSelectProduct(interaction) {
  try {
    const productType = interaction.values[0];
    const userId = interaction.user.id;
    const userData = userSelections.get(userId) || {};
    userData.productType = productType;
    userSelections.set(userId, userData);

    if (productType === 'burger' || productType === 'icecream') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_lots')
        .setPlaceholder('Select how many lots.')
        .addOptions([...Array(10).keys()].map(i => ({ label: `${i + 1}`, value: `${i + 1}` })));

      const embed = new EmbedBuilder()
        .setTitle('• Lots Quantity •')
        .setDescription('First, how many lots do you want?\n\n[INFO]: Each lot contains **2 codes**, and you can generate a maximum of **10 lots**.')
        .setColor('#FF5500');

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    }
  } catch (err) {
    console.error('Error while selecting product:', err);
  }
}

async function handleSelectLots(interaction) {
  try {
    const userId = interaction.user.id;
    const lots = parseInt(interaction.values[0]);
    const totalCodes = lots * 2;
    const userData = userSelections.get(userId) || {};
    userData.totalCodes = totalCodes;
    userSelections.set(userId, userData);

    if (userData.productType === 'burger') {
      const meatSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_meat')
        .setPlaceholder('Select how many meat codes.')
        .addOptions([...Array(totalCodes + 1).keys()].map(i => ({ label: `${i}`, value: `${i}` })));

      const embed = new EmbedBuilder()
        .setTitle('• Burger Choices •')
        .setDescription('Now choose how many **Meat** codes you want.\n\nThe rest of the unselected codes will be assigned as **Veggie**.')
        .setColor('#FF5500');

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(meatSelectMenu)] });
    } else if (userData.productType === 'icecream') {
      const embed = new EmbedBuilder()
        .setTitle('• Choices Summary •')
        .setDescription(`Here is your choices summary:\n\n🍦 • **Ice Cream**: ${totalCodes}\n\nIf your choices are **correct**, please press the **Confirm** button.\nElse, close this prompt channel and create a new one.`)
        .setColor('#FF5500');

      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_button')
        .setLabel('‎ ‎ ‎ Confirm')
        .setEmoji('🍦')
        .setStyle(ButtonStyle.Success);

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(confirmButton)] });
    }
  } catch (err) {
    console.error('Error while selecting lots:', err);
  }
}

async function handleSelectMeat(interaction) {
  try {
    const userId = interaction.user.id;
    const meatCodes = parseInt(interaction.values[0]);
    const userData = userSelections.get(userId);
    const totalCodes = userData.totalCodes;
    const veggieCodes = totalCodes - meatCodes;

    userData.meatCodes = meatCodes;
    userData.veggieCodes = veggieCodes;
    userSelections.set(userId, userData);

    const embed = new EmbedBuilder()
      .setTitle('• Choices Summary •')
      .setDescription(`Here is your choices summary:\n\n🍖 • **Meat**: ${meatCodes}\n🍃 • **Veggie**: ${veggieCodes}\n\nIf your choices are **correct**, please press the **Confirm** button.\nElse, close this prompt channel and create a new one.`)
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
    if (!botData || !botData.CODES_CATEGORY_ID) {
      await interaction.reply({ content: 'Missing data.json file or bot is not properly configured. Please contact the owner.', ephemeral: true });
      return;
    }

    const guild = await client.guilds.fetch(botData.GUILD_ID);
    const userId = interaction.user.id;
    const userData = userSelections.get(userId);
    const { productType, totalCodes } = userData;

    if (!productType) {
      await interaction.reply({ content: 'Product type is not specified.', ephemeral: true });
      return;
    }

    const codesChannel = await guild.channels.create({
      name: `codes-${userId}`,
      type: 0,
      parent: botData.CODES_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    await interaction.reply({ content: `Your choices have been confirmed. The generation process has been launched.\n\nPlease go to this channel: ${codesChannel.toString()}\n\nYour prompt channel will be deleted after the generation is complete.`, ephemeral: true });

    ensureDirectoryExists(QR_CODE_DIRECTORY);
    const tempUserDir = createTempUserDirectory(userId);
    const generatedFiles = [];

    const embed = new EmbedBuilder()
      .setTitle('• BurgerCodeGen •')
      .setDescription('The codes are being generated, please wait patiently.\n\nAfter you use your codes, please close this channel, else you won\'t be able to generate new codes.')
      .setColor('#FF5500');

    const closeButton = new ButtonBuilder()
      .setCustomId('close_codes_button')
      .setLabel('‎ ‎ ‎ Close')
      .setEmoji('🧽')
      .setStyle(ButtonStyle.Danger);

    await codesChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(closeButton)] });

    if (productType === 'burger') {
      const { meatCodes, veggieCodes } = userData;
      const choices = 'B'.repeat(meatCodes) + 'V'.repeat(veggieCodes);
      const lots = choices.match(/.{1,2}/g);

      for (let i = 0; i < lots.length; i++) {
        const [firstChoice, secondChoice] = lots[i];
        const { firstCode, secondCode } = await generateCodes('burger', firstChoice, secondChoice);

        const firstQRCodeFile = await generateQRCode(firstCode, path.join(tempUserDir, `lot_${i + 1}_code_1.png`));
        const secondQRCodeFile = await generateQRCode(secondCode, path.join(tempUserDir, `lot_${i + 1}_code_2.png`));

        generatedFiles.push(firstQRCodeFile, secondQRCodeFile);

        const embeds = [];
        const files = [];

        const firstEmbed = createCodeEmbed(i + 1, 1, firstChoice, firstCode, firstQRCodeFile, productType);
        const secondEmbed = createCodeEmbed(i + 1, 2, secondChoice, secondCode, secondQRCodeFile, productType);

        embeds.push(firstEmbed, secondEmbed);
        files.push(firstQRCodeFile, secondQRCodeFile);

        await codesChannel.send({ embeds, files });
      }

      const zipFilePath = path.join(QR_CODE_DIRECTORY, `QRcodes_${userId}.zip`);
      await zipFiles(tempUserDir, zipFilePath);
      generatedFiles.push(zipFilePath);

      await codesChannel.send({ files: [zipFilePath] });

    } else if (productType === 'icecream') {
      for (let i = 0; i < totalCodes; i += 2) {
        const embeds = [];
        const files = [];

        for (let j = 0; j < 2 && (i + j) < totalCodes; j++) {
          const { firstCode } = await generateCodes('icecream');
          const codeNumber = i + j + 1;
          const qrCodeFile = await generateQRCode(firstCode, path.join(tempUserDir, `code_${codeNumber}.png`));
          generatedFiles.push(qrCodeFile);

          const embed = createCodeEmbed(null, codeNumber, null, firstCode, qrCodeFile, productType);
          embeds.push(embed);
          files.push(qrCodeFile);
        }

        await codesChannel.send({ embeds, files });
      }

      const zipFilePath = path.join(QR_CODE_DIRECTORY, `QRcodes_${userId}.zip`);
      await zipFiles(tempUserDir, zipFilePath);
      generatedFiles.push(zipFilePath);

      await codesChannel.send({ files: [zipFilePath] });
    }

    deleteFiles(generatedFiles);
    deleteDirectory(tempUserDir);

    setTimeout(() => {
      if (interaction.channel) {
        interaction.channel.delete().catch(error => {
          console.error('Error while deleting the prompt channel:', error);
        });
      }
    }, 5000);
  } catch (err) {
    console.error('Error while confirming:', err);
    await interaction.reply({ content: 'An error occurred during code generation. Please contact the owner.', ephemeral: true });
  }
}

function createCodeEmbed(lotNumber, codeNumber, choice, code, qrCodeFile, productType) {
  let description;
  if (productType === 'burger') {
    description = `\n**Lot ${lotNumber} - Code ${codeNumber}**\n\n**${choice === 'B' ? '🍖 • Meat' : '🍃 • Veggie'}** code:\n\n\`${code}\``;
  } else if (productType === 'icecream') {
    description = `\n**Code ${codeNumber}**\n\n🍦 • **Ice Cream** code:\n\n\`${code}\``;
  }

  const embed = new EmbedBuilder()
    .setTitle('• BurgerCodeGen •')
    .setDescription(description)
    .setThumbnail(`attachment://${path.basename(qrCodeFile)}`)
    .setColor('#FF5500');

  return embed;
}

function start() {
  client.login(TOKEN);
}

module.exports = { start };