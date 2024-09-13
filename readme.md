# BurgerCodeGen Discord Bot

BurgerCodeGen is a Discord bot designed to generate promotional codes for Burger King France's "Burger Mystère" campaign. 

This campaing consist of a code that allows you to buy a random burger from the menu for only €2.90, which is pretty economical when an average burger base cost roughly 5€. 

The campaing is made to give only 2 codes per device, but this project was made to unlock the full potential of it and save you some money if you buy in "bulk".

The bot allows users to request codes for meat or vegetarian burgers, generates QR codes for each trough an automated discord bot.

Please note that it is my very first finished and public project, that the means the code could be unoptimized and messy in some ways and that i didn't tested the bot with heavy request. This project is more of a PoC.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Bot](#running-the-bot)
- [Usage](#usage)

## Features

- **Automated Code Generation**: Users can interact with the bot to generate promotional codes.

- **Request Customization**: Choose the number of lots and specify preferences for meat or vegetarian options.

- **QR Code Generation**: Generates QR codes for each promotional code.

- **Automated Channels**: Creates private channels for each user's request and deletes them after completion.

- **Zip File Delivery**: Provides all QR codes in a zipped file for easy download.

## Prerequisites

- **Node.js**: Version 14 or higher.
- **Discord Bot Token**: You need a Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications).
- **Guild (Server) ID**: The ID of your Discord server.
- **Channel and Category IDs**: IDs for the specific channels and categories the bot will interact with.

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/BurgerCodeGen.git
   cd BurgerCodeGen
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

## Configuration

Navigate to the example.env file in the root directory and modify the following environnment variables :

```env
DISCORD_TOKEN=your_discord_bot_token
GUILD_ID=your_guild_id
BUTTON_CHANNEL_ID=button_channel_id
PROMPT_CATEGORY_ID=prompt_category_id
CODES_CATEGORY_ID=codes_category_id
```

- **DISCORD_TOKEN**: Your Discord bot token.
- **GUILD_ID**: The ID of your Discord server.
- **BUTTON_CHANNEL_ID**: The ID of the channel where the "Generate" button will be placed.
- **PROMPT_CATEGORY_ID**: The ID of the category where user prompt channels will be created.
- **CODES_CATEGORY_ID**: The ID of the category where code channels will be created.

For more explaination, the bot automatically creates private channels for the users to ensure a smooth process.

It does that under two categories to keep the management easy. 

It will create the privates request channels under the `PROMPT_CATEGORY_ID`.

It will create the privates codes channels under the `CODES_CATEGORY_ID` after the request has been sent.

So you need to fill the categories ID in the .env so the bot knows where to create the channels.

For the button channel ID, this is just in which channel the bot is gonna take the new generation requests.

## Running the Bot

```bash
node index.js
```

Please ensure the bot is invited to your Discord server with the appropriate permissions.

## Usage

1. **Initiate a Request**

   - Go to the channel specified by `BUTTON_CHANNEL_ID`.
   - Click on the Generate button to start the process.

2. **Follow the Prompts**

   - The bot will create a private channel for your request.
   - Click Start to begin.
   - Select the number of lots you want (each lot contains 2 codes).
   - Choose the number of meat codes; the rest will be vegetarian.

3. **Confirm and Receive Codes**

   - Review your selections and click on Confirm.
   - The bot will generate your codes and QR codes.
   - Access your codes in the newly created codes channel.
   - Download the zipped file containing all your QR codes if necessary.

4. **Close Channels**

   - After you've received your codes, click on Close to delete the channels so you can generate more.

---

*Disclaimer: This bot is intended for educational purposes and should comply with Burger King France's terms and conditions. Unauthorized use of promotional codes is not endorsed and not my responsability.*