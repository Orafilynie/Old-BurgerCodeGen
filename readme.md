# BurgerCodeGen Discord Bot

BurgerCodeGen is a Discord bot designed to generate promotional codes for Burger King France's "Burger Mystère" campaign. (Générateur de code "Burger Mystère" in French)

This campaing consist of a code that allows you to buy a random burger from the menu for only €2.90, which is pretty economical when an average burger base cost roughly 5€. 

The campaing is made to give only 2 codes per device, but this project was made to unlock the full potential of it and save you some money if you buy in "bulk".

The bot allows users to request codes for meat or vegetarian burgers, generates QR codes for each trough an automated discord bot.

**NEW**: The bot now support the "Glace Mystère" promotionnal operation codes, named as "Ice Cream" codes.

Please note that it is my very first finished and public project, that the means the code could be unoptimized and messy in some ways and that i didn't tested the bot with heavy request. This project is more of a PoC.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Bot](#running-the-bot)
- [Setup](#setup)
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

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/Orafilynie/BurgerCodeGen.git
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
CLIENT_ID=your_bot_id
GUILD_ID=your_guild_id
```

- **DISCORD_TOKEN**: Your Discord bot token.
- **CLIENT_ID**: Your Discord bot ID.
- **GUILD_ID**: The ID of your Discord server.

## Running the Bot

```bash
node index.js
```

Please ensure the bot is invited to your Discord server with the administrator permissions.

## Setup

To setup the bot, use the `/deploy` command in any discord channel.

It will automatically create the categories and channel for the bot to use, and store the IDs inside a file called `data.json` at the root folder.

Please do not delete the `data.json` unless you want to redeploy the bot.

## Usage

1. **Initiate a Request**

   - Go to the code generation channel.
   - Click on the Generate button to start the process.

2. **Follow the Prompts**

   - The bot will create a private channel for your request.
   - Click Start to begin.
   - Follow the instructions

3. **Confirm and Receive Codes**

   - Review your selections and click on Confirm.
   - The bot will generate your codes and QR codes.
   - Access your codes in the newly created codes channel.
   - Download the zipped file containing all your QR codes if necessary.

4. **Close Channels**

   - After you've received your codes, click on Close to delete the channels so you can generate more.

---

*Disclaimer: This bot is intended for educational purposes and should comply with Burger King France's terms and conditions. Unauthorized use of promotional codes is not endorsed and not my responsability.*

*Credits: The captcha code was taken from this [repository](https://github.com/JustYuuto/burger-king-fr-api), which is an amazing work around the Burger King France API made by JustYuuto and helped me a lot with this projet, please don't forget to check his work !*