import {client, con, DEBUG_CHANNEL_ID, SERVER_NAME} from "./index"
import {getDiscordDisplayName, unescapeFormatting, verifyUsernameInput} from "./utility"
import {buttonIDSet} from "./action_interactionCreate"
import {Application, MessageEmbed, TextChannel} from "discord.js"
import * as DiscordJS from "discord.js"
import {
    changeApplicationIGN,
    checkApplicationHistory,
    postApplicationHistory,
    scanApplication
} from "./zTopic_application_management"
import {nameToUuid} from "./api"

export async function debug_messageCreate(message: DiscordJS.Message) {
    //test function
    if (message.content.toLowerCase().includes("cheese") && message.channelId == DEBUG_CHANNEL_ID){
        const user = await client.users.fetch("252818596777033729")
        if (typeof user == 'undefined'){
            console.log("idk that channel")
            return
        }

        user.send(":heart:").then(() =>
            console.log("successful message")
        ).catch(error => {
            console.log(error.message)
        })
        await message.react("🧀")
    }

    // get all the messages in the old text channel for pushing to db
    if (message.author.id === "252818596777033729" && message.channelId === DEBUG_CHANNEL_ID && message.content == "ttx") {
        //const channel = client.channels.cache.get("743877003538727023") // august20-april21
        //const channel = client.channels.cache.get("829119466763583508") // april21-october21
        const channel = client.channels.cache.get("908855513163399268") // october21-current
        if (channel == null) return
        if (!(channel instanceof TextChannel)) return
        if (channel.messages == null) return
        let messages: DiscordJS.Message[] = []

        // Create message pointer
        let message = await channel.messages
            .fetch({ limit: 1 })
            .then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null))

        while (message) {
            await channel.messages
                .fetch({ limit: 100, before: message.id })
                .then(messagePage => {
                    messagePage.forEach(msg => messages.push(msg))

                    // Update our message pointer to be the last message on the page of messages
                    message = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null
                })
        }

        let applicationInsertStatement: string = ""
        await messages.forEach(message => {
            // if an embed (app posted by bot) attempt to scan for user information
            if (message.embeds.length >= 1) {
                if (message.embeds[0] == null) {
                    console.error("jx0040")
                }
                scanApplication(message.embeds[0]).then(async app => {
                    let playerIgn = unescapeFormatting(app.ign)
                    if (!verifyUsernameInput(playerIgn)) playerIgn = 'null'
                    else playerIgn = `'${playerIgn}'`
                    applicationInsertStatement += (`insert into applicationhistory(dcUserId, messageId, messageTimestamp, messageURL, mcUsername) values ('${app.discordID}', '${message.id}', '${message.createdTimestamp}', '${message.url}', ${playerIgn});\n`)
                })
            }
            else applicationInsertStatement += (`insert into applicationhistory(dcUserId, messageId, messageTimestamp, messageURL) values ('${message.author.id}', '${message.id}', '${message.createdTimestamp}', '${message.url}');\n`)
        })
        console.log(applicationInsertStatement)
    }

    if (message.content === "dbreset" && message.author.id === "252818596777033729" && message.channelId === DEBUG_CHANNEL_ID){
        con.reset()
    }

    if (message.content === "debug" && message.author.id === "252818596777033729" && message.channelId === DEBUG_CHANNEL_ID) {
        console.log("DEBUG COMMAND")
        var discordUser
        var discordUsername = "Unknown user"
        try {
            const a = client.users.fetch('1017115584665755710').then(value => {
                discordUser = value
                discordUsername = getDiscordDisplayName(discordUser)
            })
        }
        catch (error) {
            console.log("could not get username " + error)
            console.log(error)
        }
    }

    if (message.content === "flush" && ((message.author.id === "252818596777033729") || message.channelId === "805296027241676820")){
        await message.reply("Before: " + Array.from(buttonIDSet.values()).toString())
        await buttonIDSet.clear()
        await message.reply("After: " + Array.from(buttonIDSet.values()).toString())
    }

    if (message.content === "wl" && message.author.id === "252818596777033729" && message.channelId === DEBUG_CHANNEL_ID){
        message.channel.send("WL TRIGGER")
        const whitelistedEmbed = new MessageEmbed()
            .setColor("#54fbfb")
            .setTitle(`New: ${SERVER_NAME} Application`)
            .setDescription("What is your Minecraft IGN?:\n" +
                "_notch_\n" +
                "\n" +
                "What is your age?:\n" +
                "17\n" +
                "\n" +
                "Why do you want to join this server?:\n" +
                "my friends are in it :D\n" +
                "\n" +
                "What rule do you value most when playing on an SMP?:\n" +
                "having fun :>\n" +
                "\n" +
                "What are some of your hobbies outside of minecraft?:\n" +
                "video gaming B)\n" +
                "\n" +
                "Are you a streamer or a youtuber? If so include a link:\n" +
                "n/a\n" +
                "\n" +
                "How did you find the server? (Reddit/friend/website etc) If it's a friend, please specify who.:\n" +
                "friends\n" +
                "asd\n" +
                "\n" +
                "Have you read and understood the rules?:\n" +
                "yee\n" +
                "\n" +
                "Include any additional information or questions here:\n" +
                "( ’-’)")
            .setFooter({text: "Applicant: _Jessica_#0\n" +
                "ID: 252818596777033729"})
        message.channel.send({embeds: [whitelistedEmbed]})
    }

    // if replying to an application with an question mark, pull the history
    if (message.content.at(0) == "?" && (message.author.id == "252818596777033729" || message.channelId == "805296027241676820")){
        if (message.channel instanceof TextChannel) await postApplicationHistory(message, message.channel, message.content.slice(1), message.content.slice(1))
    }
}