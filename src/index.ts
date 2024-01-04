import {interactionCreateCommand} from "./action_interactionCreateCommand"
import {interactionCreateModal} from "./action_interactionCreateModal"
import {interactionCreateButton} from "./action_interactionCreateButton"
var cron = require('node-cron')
const config = require("config")
import * as DiscordJS from 'discord.js'
import * as dotenv from 'dotenv'
// @ts-ignore
import { v4 as uuidv4 } from 'uuid'
import {TextBasedChannel} from "discord.js"
dotenv.config()
const mysql = require('mysql')

import * as db_setup from './db_setup'
import * as scheduled_jobs from './scheduled_jobs'
import * as command_management from './command_management'
import {messageReactionAdd} from "./action_messageReactionAdd"
import {guildMemberRemove} from "./action_guildMemberRemove"
import {guildMemberUpdate} from "./action_guildMemberUpdate"
import {messageCreate} from "./action_messageCreate"
import {messageDelete} from "./action_messageDelete"


export var DEBUGMODE = config.get('debug-mode.enabled')

console.log(`Running with debug mode set to ${DEBUGMODE}`)

// text constants
export const SERVER_NAME = config.get('server-info.server-name')
export const SERVER_APPLICATION_URL = config.get('server-info.server-application-url')
export const RULE_PHRASE_EMOJI: string = config.get('rule-checking.rule-phrase-emoji')
export const RULE_PHRASE_TEXT: string = config.get('rule-checking.rule-phrase-text')
export const RULE_MATCH_STRINGS: String[] = config.get('rule-checking.rule-match-key-phrases')

// emoji constants
export const YES_EMOJI_ID: string = config.get('emojis.yes.id')
export const YES_EMOJI: string = config.get('emojis.yes.emoji')
export const NO_EMOJI_ID: string = config.get('emojis.no.id')
export const NO_EMOJI: string = config.get('emojis.no.emoji')
export const REDSTONE_EMOJI_ID: string = config.get('emojis.debug.id')
export const REDSTONE_EMOJI: string = config.get('emojis.debug.emoji')

export const SHOP_STOCK_EMOJI: string = config.get('features.shop-check.shop-stocked-emoji')
export const SHOP_NOSTOCK_EMOJI: string = config.get('features.shop-check.shop-unstocked-emoji')
export const SHOP_NOSTOCK_7DAY_EMOJI: string = config.get('features.shop-check.shop-unstocked-7d-emoji')
export const SHOP_SERVICE_EMOJI: string = config.get('features.shop-check.shop-service-emoji')


// channel constants
export const DEBUG_CHANNEL_ID = config.get('debug-mode.debug-channel-id')

export const ALERT_CHANNEL = DEBUGMODE ? DEBUG_CHANNEL_ID : config.get('channel-ids.alert')
export const BOT_INFO_CHANNEL_ID = config.get('channel-ids.bot-info')
export const BOT_LOG_CHANNEL_ID = config.get('channel-ids.bot-log')
export const STAFF_BOT_LOG_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : config.get('channel-ids.staff-bot-log')
export const MESSAGES_TO_ROBERT_CHANNEL_ID = config.get('channel-ids.messages-to-robert')
export const MAIN_ANNOUNCEMENT_CHANNEL = DEBUGMODE ? DEBUG_CHANNEL_ID : config.get('features.announcement-thumbs-channel-id')
export const BIRTHDAY_MESSAGE_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : config.get('features.birthday-message-channel-id') // for posting birthday messages

export const IS_APPLICATION_ENABLED = config.get('application.server-application.enabled')
export const APPLICATION_MAJORITY_REQUIRED: boolean = config.get('application.server-application.require-majority-vote')
export const APPLICATION_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : config.get('application.server-application.full-post-channel') // channel where applications are posted
export const APPLICATION_VOTING_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : config.get('application.server-application.summary-post-channel') // channel where applications summaries are posted and voted on
export const APPLICATION_NOTIFICATION_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : config.get('application.server-application.notification-post-channel') // channel with basic notifications


export const IS_SHOP_APPLICATION_ENABLED = config.get('application.shop-application.enabled')
export const APPLICATION_SHOP_MAJORITY_REQUIRED: boolean = config.get('application.shop-application.require-majority-vote')
export const APPLICATION_SHOP_CHANNEL_ID = DEBUGMODE ? "0" : config.get('application.shop-application.full-post-channel') // channel where shop applications are posted
export const APPLICATION_SHOP_VOTING_CHANNEL_ID = DEBUGMODE ? DEBUG_CHANNEL_ID : config.get('application.shop-application.summary-post-channel') // channel where shop applications summaries are posted and voted on
export const APPLICATION_SHOP_NOTIFICATION_CHANNEL_ID = DEBUGMODE ? "0" : config.get('application.shop-application.notification-post-channel') // channel with basic notifications for shop applications


export const IS_MAP_APPLICATION_ENABLED = config.get('application.map-coordinate.enabled')
export const APPLICATION_MAP_FORM_CHANNEL_ID = DEBUGMODE ? config.get('debug-mode.map-form-post-channel-id') : config.get('application.map-coordinate.map-form-post-channel-id') // channel where the map message form is posted
export const APPLICATION_MAP_CHANNEL_ID = DEBUGMODE ? config.get('debug-mode.map-channel-id') : config.get('application.map-coordinate.map-channel-id') // channel where the map message is
export const APPLICATION_MAP_MESSAGE_ID = DEBUGMODE ? config.get('debug-mode.map-message-id') : config.get('application.map-coordinate.map-message-id') // message id of the map message
export const APPLICATION_SHOP_MESSAGE_ID = DEBUGMODE ? config.get('debug-mode.shop-message-id') : config.get('application.shop-application.shop-list-message-id') // message id of the list of shops

// server constants
export const APPLICATION_SERVER_ID = DEBUGMODE ? config.get('debug-mode.debug-server-id') : config.get('application.application-server-id')
export const MAIN_SERVER_ID = config.get('server-info.server-id')

// other constants
export const staffReactThreshold: number = DEBUGMODE ? 1 : config.get('application.application-vote-threshold')
export const APPLICATION_VOTE_REMINDER_THRESHOLD_HOURS = DEBUGMODE ? 0.005 : config.get('application.application-reminder-interval') // how often, in hours, should the bot remind people to vote on applications
export const APPLICATION_MAX_REMIND_TIMES = config.get('application.application-reminder-times') // how many times should the bot remind people to vote on applications. a give up message will be sent after this
export const APPLICATION_VOTER_ROLE_ID = DEBUGMODE ? "975908077884809276" : "743617410069692437" // people with this role that have not voted will be pinged to vote
export const ROBERT_USER_ID = config.get('other-ids.robert-plus-id')
export const MUSEUM_ROLE_ID = config.get('other-ids.museum')
export const BIRTHDAY_ROLE_ID = config.get('features.birthday-role-id')

//CONSTANTS END

export const client = new DiscordJS.Client({
    intents: [
        "GUILDS","GUILD_MESSAGES","GUILD_INVITES","DIRECT_MESSAGES","GUILD_MESSAGE_REACTIONS","GUILD_MEMBERS", "GUILD_PRESENCES", "GUILD_MESSAGES"
    ],
    partials: [
        "CHANNEL", "MESSAGE"
    ]
})

const dbHost: String = DEBUGMODE ? config.get('debug-mode.debughost') : config.get('database.host')
const dbPort: String = DEBUGMODE ? config.get('debug-mode.debugport') : config.get('database.port')
const dbUser: String = DEBUGMODE ? config.get('debug-mode.debuguser') : config.get('database.user')
const dbPassword: String = DEBUGMODE ? config.get('debug-mode.debugpassword') : config.get('database.password')
const dbDatabase: String = DEBUGMODE ? config.get('debug-mode.debugdatabase') : config.get('database.database')

const lpHost = config.get('database.lphost')
const lpPort = config.get('database.lpport')
const lpUser = config.get('database.lpuser')
const lpPassword = config.get('database.lppassword')
const lpDatabase = config.get('database.lpdatabase')

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

client.on('interactionCreate', async i => {
    await interactionCreateModal(client, i)
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

// hourly housekeep
cron.schedule('* * * * *', async () => { // 0 * * * * for every hour or * * * * * for every min
    await scheduled_jobs.hourlyHousekeepTask()
})

// daily housekeep at 7am gmt hopefully
cron.schedule('0 7 * * *', async () => { // 0 7 * * * for every 7am or * * * * * for every min
    await scheduled_jobs.dailyHousekeepTask()
})

// sleepy time every day at 7am
cron.schedule('0,5,10,15,20,25,30 6 * * *', async () => {
    await scheduled_jobs.sleepyTime()
})

process.on('unhandledRejection', error => {
    if (debugchannel === undefined) {
        //console.error("You are probably missing your environment key!")
    }
    console.warn(`error time ${new Date().toISOString()}`)
    console.error('Unhandled promise rejection:', error)
    if (error == null || !(error instanceof Error)) {
        console.log(`Error is invalid (jx0032)`)
        return
    }
    debugchannel.send(`Unhandled promise rejection: ${error} \n\n${error.stack}`)
})

client.on('shardError', error => {
    if (debugchannel === undefined) {
        //console.error("You are probably missing your environment key!")
    }
    console.warn(`error time ${new Date().toISOString()}`)
    console.warn('A websocket connection encountered an error:', error)
    debugchannel.send(`A websocket connection encountered an error: ${error} \n\n${error.stack}`)
})

process.on('uncaughtException', error => {
    if (debugchannel === undefined) {
        //console.error("You are probably missing your environment key!")
    }
    console.warn(`error time ${new Date().toISOString()}`)
    console.warn('Unhandled exception:', error)
    debugchannel.send(`Unhandled exception: ${error} \n\n${error.stack}`)
})

//post all errors into the log channel
const originalError = console.error
console.error = function (...args) {
    if (debugchannel === undefined) {
        //console.error("You are probably missing your environment key!")
    }
    //debugchannel.send(`logger.error: ${args.toString()}`)

    // Call the original console.error function to print the error message
    originalError.apply(console, args)
}

client.login(process.env.TOKEN).then(() => {
    console.log("Logged in using token successfully!")
})