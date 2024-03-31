import {client, con, DEBUG_CHANNEL_ID, DEBUGMODE} from "./index"
import {containsRulePhrase, getDiscordDisplayName, unescapeFormatting, verifyUsernameInput} from "./utility"
import {MessageEmbed, TextChannel} from "discord.js"
import * as DiscordJS from "discord.js"
import {
    activeApplications,
    InProgressApplication,
    postApplicationHistory,
} from "./zTopic_application_management"
import {dailyHousekeepTask} from "./scheduled_jobs"
import {buttonPostApplication} from "./zTopic_application_creator"
import {buttonIDSet} from "./action_interactionCreateButton"

export async function debug_messageCreate(message: DiscordJS.Message) {
    //test function
    if (message.content.toLowerCase().includes("cheese") && message.channelId == DEBUG_CHANNEL_ID) {
        const user = await client.users.fetch("252818596777033729")
        if (typeof user == 'undefined') {
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
        messages.forEach(message => {
            // if an embed (app posted by bot) attempt to scan for user information
            if (message.embeds.length >= 1) {
                if (message.embeds[0] == null) {
                    console.error("jx0040")
                }
                scanApplication(message.embeds[0]).then(async (app) => {
                    let playerIgn = unescapeFormatting(app.ign)
                    if (!verifyUsernameInput(playerIgn)) playerIgn = 'null'
                    else playerIgn = `'${playerIgn}'`
                    applicationInsertStatement += (`insert into applicationhistory(dcUserId, messageId, messageTimestamp, messageURL, mcUsername) values ('${app.discordID}', '${message.id}', '${message.createdTimestamp}', '${message.url}', ${playerIgn});\n`)
                })
            } else applicationInsertStatement += (`insert into applicationhistory(dcUserId, messageId, messageTimestamp, messageURL) values ('${message.author.id}', '${message.id}', '${message.createdTimestamp}', '${message.url}');\n`)
        })
        console.log(applicationInsertStatement)
    }

    if (message.content === "dbreset" && message.author.id === "252818596777033729" && message.channelId === DEBUG_CHANNEL_ID) {
        con.reset()
    }

    if (message.content === "dailyhousekeep" && message.author.id === "252818596777033729" && message.channelId === DEBUG_CHANNEL_ID) {
        await dailyHousekeepTask()
        return
    }

    if (message.content === "debug" && message.author.id === "252818596777033729" && message.channelId === DEBUG_CHANNEL_ID) {
        console.log("DEBUG COMMAND")
        var discordUser
        var discordUsername = "Unknown user"
        try {
            client.users.fetch('1017115584665755710').then(value => {
                discordUser = value
                discordUsername = getDiscordDisplayName(discordUser)
            })
        }
        catch (error) {
            console.log("could not get username " + error)
            console.log(error)
        }
    }

    if (message.content === "flush" && ((message.author.id === "252818596777033729") || message.channelId === "805296027241676820")) {
        await message.reply("Before: " + Array.from(buttonIDSet.values()).toString())
        await buttonIDSet.clear()
        await message.reply("After: " + Array.from(buttonIDSet.values()).toString())
    }

    if (message.content === "wl" && message.author.id === "252818596777033729" && message.channelId === DEBUG_CHANNEL_ID) {
        if (!DEBUGMODE) {
            await message.reply("DEBUG MODE IS NOT ENABLED! You don't want to send this as an official application!")
            return
        }
        message.channel.send("WL TRIGGER")
        const application = new InProgressApplication(`252818596777033729`, `jess.qwest`,`applicationquestions`)
        application.uniqueIdentifier = "_Lemonadee_"
        application.answers = [
            "_pizza_",
            "16",
            "THIS IS A JESS TEST APPLICATION! my friends are in it :D",
            "having fun :>",
            "video gaming B)",
            "n/a",
            "friends",
            "yee",
            "( ’-’)"
        ]
        activeApplications.push(application)
        await buttonPostApplication(message.author)
    }

    // if replying to an application with an question mark, pull the history
    if (message.content.at(0) == "?" && message.content.length > 3 && (message.author.id == "252818596777033729" || message.channelId == "805296027241676820")) {
        if (message.channel instanceof TextChannel) await postApplicationHistory(message.channel, message.content.slice(1), message.content.slice(1))
    }
}

export async function scanApplication(receivedEmbed: MessageEmbed): Promise<Application> {

    if(receivedEmbed.description == null || !receivedEmbed.description.includes("What is your Minecraft IGN?")) {
        // @ts-ignore
        console.log(`Invalid application! (jx0039) - ${receivedEmbed.description.slice(0,30)}...`)
        throw `Invalid application! (jx0039)`
    }

    const ignBlockText = receivedEmbed.description.match("What is your Minecraft IGN\\?:(.|\\n)*What is your age\\?:")?.toString()
    const ign = ignBlockText?.slice(29,-22) ?? "Unknown"

    const ageBlockText = receivedEmbed.description.match("What is your age\\?:(.|\\n)*Why do you want to join this server\\?:")?.toString()
    const age = ageBlockText?.slice(19,-41) ?? "Error"

    const referralText = receivedEmbed.description.match("please specify who\\.:(.|\\n)*Have you read and understood")?.toString()
    const referral = referralText?.slice(21,-32) ?? "Error"

    const discordNameBlockText = receivedEmbed.footer?.text.match("Applicant:\\s*.+\\s*ID")?.toString()
    const discordName = discordNameBlockText?.slice(11,-3) ?? "Error"

    const discordID = receivedEmbed.footer?.text.slice(-19).trim() ?? "Error"

    let applicationLengthDescription: string
    const applicationLength = receivedEmbed.description.length
    if (applicationLength < 590) applicationLengthDescription = "Impressively bad"
    else if (applicationLength < 775) applicationLengthDescription = "Yikes"
    else if (applicationLength < 820) applicationLengthDescription = "Basic"
    else if (applicationLength < 1013) applicationLengthDescription = "Decent"
    else if (applicationLength < 1253) applicationLengthDescription = "Good"
    else if (applicationLength < 1553) applicationLengthDescription = "Very good"
    else if (applicationLength < 1853) applicationLengthDescription = "Amazing!"
    else applicationLengthDescription = "WOAH!"

    const rulePhraseDetected: boolean = containsRulePhrase(receivedEmbed.description)

    return new Application(ign, age, referral, discordName, discordID, applicationLengthDescription, rulePhraseDetected)
}

class Application {
    public ign: string
    public age: string
    public referral: string
    public discordName: string
    public discordID: string
    public applicationLengthDescription: string
    public rulePhraseDetected: boolean
    constructor(ign: string, age: string, referral: string, discordName: string, discordID: string, applicationLengthDescription: string, rulePhraseDetected: boolean) {
        this.ign = ign
        this.age = age
        this.referral = referral
        this.discordName = discordName
        this.discordID = discordID
        this.applicationLengthDescription = applicationLengthDescription
        this.rulePhraseDetected = rulePhraseDetected
    }
}