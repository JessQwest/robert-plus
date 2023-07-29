var cron = require('node-cron')
import * as DiscordJS from 'discord.js'
const { MessageActionRow, MessageButton } = require('discord.js')
import * as dotenv from 'dotenv'
// @ts-ignore
import { v4 as uuidv4 } from 'uuid'
import {TextBasedChannel} from "discord.js"
dotenv.config()
var mysql = require('mysql')
const PropertiesReader = require('properties-reader')
const prop = PropertiesReader('robert.properties')

import * as db_setup from './db_setup'
import * as scheduled_jobs from './scheduled_jobs'
import * as command_management from './command_management'
import {messageReactionAdd} from "./action_messageReactionAdd"
import {guildMemberRemove} from "./action_guildMemberRemove"
import {
    interactionCreateButton,
    interactionCreateCommand
} from "./action_interactionCreate"
import {guildMemberUpdate} from "./action_guildMemberUpdate"
import {messageCreate} from "./action_messageCreate"
import {messageDelete} from "./action_messageDelete"

export var DEBUGMODE = false

console.log(`Reading debugmode - ${prop.get("debugmode")}`)
if (prop.get("debugmode") == true){
    console.log("Running with debugmode.")
    DEBUGMODE = true
}

//CONSTANTS
console.log("Applying constants")

// text constants
export const SERVER_NAME = "Divergent SMP"
export const SERVER_APPLICATION_URL = "https://apply.divergentsmp.net/"
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
export const DEBUG_CHANNEL_ID = "970336504364818452"

export const ALERT_CHANNEL = DEBUGMODE ? DEBUG_CHANNEL_ID : "1008083728863596716"
export const BOT_INFO_CHANNEL_ID = "1121768749054316574"
export const BOT_LOG_CHANNEL_ID = "970103685810118796"
export const STAFF_BOT_LOG_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : "800925944399265812"
export const MESSAGES_TO_ROBERT_CHANNEL_ID = "970115159781683290"
export const APPLICATION_NOTIFICATION_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : "829119465718284358"
export const MAIN_ANNOUNCEMENT_CHANNEL = DEBUGMODE ? "772844397020184579" : "706923005132931135"
export const APPLICATION_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : "908855513163399268" // channel where applications are posted
export const APPLICATION_VOTING_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : "805296027241676820" // channel where applications summaries are posted and voted on
export const ANNOUNCEMENT_DISCUSSION_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : "706923005493903367" // for posting birthday messages

var channelIDtoPostApplications: string = ""
var channelIDtoPostApplicationNotification: string = ""
if (DEBUGMODE){
    channelIDtoPostApplications = DEBUG_CHANNEL_ID
    channelIDtoPostApplicationNotification = DEBUG_CHANNEL_ID
}
else{
    channelIDtoPostApplications = "805296027241676820"
    channelIDtoPostApplicationNotification = "829119465718284358"
}

// server constants
export const APPLICATION_SERVER_ID = "743616108288016464"
export const MAIN_SERVER_ID = "706923004285812849"

// other constants
// second number needs to be one greater than the majority of staff (for 5 staff, majority is 3, so this value needs to be 4)
export const staffReactThreshold = DEBUGMODE ? 2 : 4
export const ROBERT_USER_ID = "969760796278157384"
export const MUSEUM_ROLE_ID = "1121767435159212112"
export const BIRTHDAY_ROLE_ID = "801826957041860638"

//CONSTANTS END

export const client = new DiscordJS.Client({
    intents: [
        "GUILDS","GUILD_MESSAGES","GUILD_INVITES","DIRECT_MESSAGES","GUILD_MESSAGE_REACTIONS","GUILD_MEMBERS", "GUILD_PRESENCES", "GUILD_MESSAGES"
    ],
    partials: [
        "CHANNEL", "MESSAGE"
    ]
})

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

console.log(`Attempting to create SQL connection to luckperms db ${lpDatabase} with ${lpHost}:${lpPort} ${lpUser}/${lpPassword}`)
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
        client.user.setActivity(`${SERVER_NAME}`, {type: "PLAYING"})
        if (DEBUGMODE) client.user.setActivity("DEBUG MODE", {type: "PLAYING"})
    }

    debugchannel = await client.channels.fetch(BOT_LOG_CHANNEL_ID) as TextBasedChannel

    console.info(`The bot is ready ${new Date().toISOString()}`)

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

// daily housekeep at 7am gmt hopefully
cron.schedule('0 7 * * *', async () => { // 0 7 * * * or * * * * *
    await scheduled_jobs.housekeepTask()
})

// sleepy time every day at 7am
cron.schedule('0,5,10,15,20,25,30 6 * * *', async () => {
    await scheduled_jobs.sleepyTime()
})

process.on('unhandledRejection', error => {
    console.warn(`error time ${new Date().toISOString()}`)
    console.error('Unhandled promise rejection:', error)
    if (error == null || !(error instanceof Error)) {
        console.log(`Error is invalid (jx0032)`)
        return
    }
    debugchannel.send(`Unhandled promise rejection: ${error} \n\n${error.stack}`)
})

client.on('shardError', error => {
    console.warn(`error time ${new Date().toISOString()}`)
    console.warn('A websocket connection encountered an error:', error)
    debugchannel.send(`A websocket connection encountered an error: ${error} \n\n${error.stack}`)
})

process.on('uncaughtException', error => {
    console.warn(`error time ${new Date().toISOString()}`)
    console.warn('Unhandled exception:', error)
    debugchannel.send(`Unhandled exception: ${error} \n\n${error.stack}`)
})

//post all errors into the log channel
const originalError = console.error
console.error = function (...args) {
    debugchannel.send(`logger.error: ${args.toString()}`)

    // Call the original console.error function to print the error message
    originalError.apply(console, args)
}

client.login(process.env.TOKEN)