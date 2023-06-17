var cron = require('node-cron')
import * as DiscordJS from 'discord.js'
const { MessageActionRow, MessageButton } = require('discord.js');
import * as dotenv from 'dotenv';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import {TextBasedChannel} from "discord.js";
dotenv.config()
const fetch = require('node-fetch');
var mysql = require('mysql');
const PropertiesReader = require('properties-reader')
const prop = PropertiesReader('robert.properties')

import * as db_setup from './db_setup'
import * as scheduled_jobs from './scheduled_jobs'
import * as command_management from './command_management'
import {
    capitalizeFirstLetter,
    escapeFormatting,
    unescapeFormatting,
} from './utility'
import {messageReactionAdd} from "./action_messageReactionAdd";
import {guildMemberRemove} from "./action_guildMemberRemove";
import {
    interactionCreateButton,
    interactionCreateCommand
} from "./action_interactionCreate"
import {guildMemberUpdate} from "./action_guildMemberUpdate"
import {messageCreate} from "./action_messageCreate"
import {messageDelete} from "./action_messageDelete"

// change this during development
export var DEBUGMODE = true

console.log(`Reading forcenodebug - ${prop.get("forcenodebug")}`)
if (prop.get("forcenodebug") == true && DEBUGMODE){
    console.log("Forcing to run without debugmode")
    DEBUGMODE = false
}

//CONSTANTS
console.log("Applying constants")

// text constants
export const SERVER_NAME = "Divergent SMP"
export const RULE_PHRASE_EMOJI: string = "🦆"
export const RULE_PHRASE_TEXT: string = "duck"
export const RULE_MATCH_STRINGS = ["duck","quack",":duck:","🦆"]

// emoji constants
export const YES_EMOJI_ID: string = "897152291591819376"
export const YES_EMOJI: string = `<:yes:${YES_EMOJI_ID}>`
export const NO_EMOJI_ID: string = "897152291809935430"
export const NO_EMOJI: string = `<:no:${NO_EMOJI_ID}>`
export const REDSTONE_EMOJI_ID: string = "868669449010569247"
export const REDSTONE_EMOJI: string = `<:redstone:${REDSTONE_EMOJI_ID}>`

// channel constants
export const ALERT_CHANNEL = DEBUGMODE ? "970336504364818452" : "1008083728863596716"
export const BOT_LOG_CHANNEL_ID = "970103685810118796"
export const APPLICATION_NOTIFICATION_CHANNEL_ID = DEBUGMODE ? "970336504364818452" : "829119465718284358"
export const MAIN_ANNOUNCEMENT_CHANNEL = DEBUGMODE ? "772844397020184579" : "706923005132931135"

// server constants
export const APPLICATION_SERVER_ID = "743616108288016464"

// other constants
//second number needs to be one greater than the majority of staff (for 5 staff, majority is 3, so this value needs to be 4)
export const staffReactThreshold = DEBUGMODE ? 2 : 4

//CONSTANTS END

export const client = new DiscordJS.Client({
    intents: [
        "GUILDS","GUILD_MESSAGES","GUILD_INVITES","DIRECT_MESSAGES","GUILD_MESSAGE_REACTIONS","GUILD_MEMBERS", "GUILD_PRESENCES", "GUILD_MESSAGES"
    ],
    partials: [
        "CHANNEL", "MESSAGE"
    ]
})

//CHANNEL DEFINITIONS

//const NOTIFCATION_CHANNEL: TextBasedChannel = client.channels.fetch(BOT_LOG_CHANNEL_ID) as TextBasedChannel

//CHANNEL DEFINITIONS END

var dbHost: String = ""
var dbPort: String = ""
var dbUser: String = ""
var dbPassword: String = ""
var dbDatabase: String = ""

var lpHost = prop.get("lphost")
var lpPort = prop.get("lpport")
var lpUser = prop.get("lpuser")
var lpPassword = prop.get("lppassword")
var lpDatabase = prop.get("lpdatabase")

setupDBParameters()
console.log("Database Params set")

console.log(`Attempting to create SQL connection to db ${dbDatabase} with ${dbHost}:${dbPort} ${dbUser}/${dbPassword}`)
export const con = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbDatabase
})

console.log(`Attempting to create SQL connection to db ${lpDatabase} with ${lpHost}:${lpPort} ${lpUser}/${lpPassword}`)
export const lpcon = mysql.createPool({
    host: lpHost,
    port: lpPort,
    user: lpUser,
    password: lpPassword,
    database: lpDatabase
})

function setupDBParameters(){
    if (DEBUGMODE){
        dbHost = prop.get("debughost")
        dbPort = prop.get("debugport")
        dbUser = prop.get("debuguser")
        dbPassword = prop.get("debugpassword")
        dbDatabase = prop.get("debugdatabase")
    }
    else{
        dbHost = prop.get("host")
        dbPort = prop.get("port")
        dbUser = prop.get("user")
        dbPassword = prop.get("password")
        dbDatabase = prop.get("database")
    }
}

export var debugchannel : TextBasedChannel

client.on('ready', async () =>{

    db_setup.setupDatabaseTables()

    command_management.registerCommands()

    if (client.user != null) {
        client.user.setActivity(`${SERVER_NAME}`,{type: "PLAYING"})
        if (DEBUGMODE) client.user.setActivity("DEBUG MODE",{type: "PLAYING"})
    }

    console.log(`The bot is ready ${new Date().toISOString()}`)

    debugchannel = await client.channels.fetch(BOT_LOG_CHANNEL_ID) as TextBasedChannel

    // @ts-ignore
    await debugchannel.send("Bot Started")
})

client.on('messageReactionAdd', async (reaction) => {
    await messageReactionAdd(client, reaction)
})

client.on('guildMemberRemove',  member => {
    guildMemberRemove(client, member)
})

client.on('interactionCreate', async i => {
    await interactionCreateButton(client, i)
})

client.on('interactionCreate', async i => {
    await interactionCreateCommand(client, i)
})

client.on('messageDelete', async (message) => {
    await messageDelete(client, message)
})

client.on("guildMemberUpdate", async (oldMember, newMember) => {
    await guildMemberUpdate(client, oldMember, newMember)
})

client.on('messageCreate', async (message) => {
    await messageCreate(client, message)
})

process.on('unhandledRejection', error => {
    console.error(`error time ${new Date().toISOString()}`)
    console.error('Unhandled promise rejection:', error);
    // @ts-ignore
    debugchannel.send(`Unhandled promise rejection: ${error} \n\n${error.stack}`);
});

client.on('shardError', error => {
    console.error(`error time ${new Date().toISOString()}`)
    console.error('A websocket connection encountered an error:', error);
    // @ts-ignore
    debugchannel.send(`A websocket connection encountered an error: ${error} \n\n${error.stack}`);
});

process.on('uncaughtException', error => {
    console.error(`error time ${new Date().toISOString()}`)
    console.error('Unhandled exception:', error);
    // @ts-ignore
    console.error("error code: !" + error.code + "!")
    // @ts-ignore
    if (error.code == "ECONNRESET") {
        console.log("ECONNRESET Exception");
        debugchannel.send(`HANDLING ECONNRESET`);
    }
    // @ts-ignore
    debugchannel.send(`Unhandled exception: ${error} \n\n${error.stack}`);
});


// daily housekeep at 1am
cron.schedule('0 1 * * *', async () => {
    await scheduled_jobs.housekeepTask()
})

// sleepy time every day at 7am
cron.schedule('0,5,10,15,20,25,30 6 * * *', async () => {
    await scheduled_jobs.sleepyTime()
})

export function postRuleRejectButtons(mcusername: string, discordID: string, channel: DiscordJS.TextBasedChannel) {
    const ruleViolationButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},rulereject`)
                .setLabel(`${RULE_PHRASE_EMOJI} ${capitalizeFirstLetter(RULE_PHRASE_TEXT)} rule reject ${unescapeFormatting(mcusername)}`)
                .setStyle('SECONDARY'),
        )
    const genericDeclineButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},rulerejectkick`)
                .setLabel(`${RULE_PHRASE_EMOJI} ${capitalizeFirstLetter(RULE_PHRASE_TEXT)} rule reject AND KICK ${unescapeFormatting(mcusername)}`)
                .setStyle('DANGER'),
        )
    channel.send({ content:`${escapeFormatting(mcusername)} has been flagged as not having mentioned ${RULE_PHRASE_TEXT}. Click the button to ${RULE_PHRASE_TEXT} reject`, components: [ruleViolationButton, genericDeclineButton] })
}

export function postRegularRejectButtons(mcusername: string, discordID: string, channel: DiscordJS.TextBasedChannel) {
    const badApplicationButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},badappreject`)
                .setLabel(`💩 Reject and kick ${unescapeFormatting(mcusername)} for bad application`)
                .setStyle('SECONDARY'),
        )
    const underAgeButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},underagereject`)
                .setLabel(`🔞 Reject and kick ${unescapeFormatting(mcusername)} for underage application`)
                .setStyle('SECONDARY'),
        )
    const genericButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},genericreject`)
                .setLabel(`👎 Reject and kick ${unescapeFormatting(mcusername)} for no reason`)
                .setStyle('SECONDARY'),
        )
    channel.send({ content:`${escapeFormatting(mcusername)} has recieved enough votes to be rejected. Click a button to reject`, components: [badApplicationButton, underAgeButton, genericButton] })
}

client.login(process.env.TOKEN)