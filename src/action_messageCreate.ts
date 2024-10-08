import * as DiscordJS from "discord.js"
import {Client, Message, MessageActionRow, MessageButton, MessageEmbed, TextChannel} from "discord.js"
import {
    ANNOUNCEMENT_THUMBS,
    MAIN_ANNOUNCEMENT_CHANNEL,
    MESSAGES_TO_ROBERT_CHANNEL_ID, ROBERT_USER_ID, SERVER_NAME
} from "./index"
import {debug_messageCreate} from "./debug"
import {easter_egg_messageCreate} from "./easter_egg"
import {changeApplicationIGN} from "./zTopic_application_management"
import {dmReceived, QUESTION_SET_MAP, QUESTION_SET_SHOP} from "./zTopic_application_creator"
import {escapeFormatting, hasAdminPerms} from "./utility"
import {coreProtectLookup} from "./zTopic_coreprotect"
import {generatePlayerReport} from "./zTopic_player_reports"


export async function messageCreate(client: Client, message: DiscordJS.Message) {
    if (client.user == null) {
        console.error(`client.user is null (jx0033)`)
        return
    }
    // if robert is DM'd/mentioned, and it was by someone that was not himself, repost the message
    if ((message.channel.type === 'DM' || message.mentions.has(client.user.id)) && message.author != client.user) {
        await dmReceived(message.content, message.author)
        await postRobertMessage(client, message)
    }

    // if message is a coreprotect lookup go through the core process
    if (message.content.startsWith("co l") && hasAdminPerms(message.member?.id)) {
        await coreProtectLookup(message.content, message.channel as TextChannel)
        return
    }

    // generate player report
    if (message.content.startsWith("generateplayerreport") && hasAdminPerms(message.member?.id)) {
        await generatePlayerReport(message.channel)
        return
    }

    // if replying to an application with an exclamation mark, attempt to change the ign
    if (message.reference != null && message.reference.messageId != null && message.content.at(0) == "!") {
        await changeApplicationIGN(message)
        return
    }

    // thumbs reactions if the message is in announcements
    if (message.channelId == MAIN_ANNOUNCEMENT_CHANNEL && message.author.id != client.user.id) {
        if (ANNOUNCEMENT_THUMBS == true) await message.react("👍")
    }

    // if message is generateapplicationbutton then create an embed with the button
    if (message.content === "gab" || message.content == "generateapplicationbutton") {
        let applicationEmbed = new MessageEmbed()
            .setDescription("Welcome to the application server! Press the button to start an application!")
            .setColor(`#10e083`)
        const startApplicationButton = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId(`application,start,applicationquestions`)
                    .setLabel(`Start an application to ${SERVER_NAME}`)
                    .setStyle('PRIMARY'),
            )
        message.channel.send(({embeds: [applicationEmbed], components: [startApplicationButton]}))
    }

    // if message is generatemapbutton then create an embed with the maps/shops buttons
    if (message.content === "gmb" || message.content == "generatemapbutton") {
        const applicationButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId(`application,start,${QUESTION_SET_SHOP}`)
                    .setLabel(`🛍️ Start a shop application`)
                    .setStyle('PRIMARY')
                ,
                new MessageButton()
                    .setCustomId(`application,start,${QUESTION_SET_MAP}`)
                    .setLabel(`🗺️ Post your base coordinates`)
                    .setStyle('PRIMARY')
                ,
                new MessageButton()
                    .setCustomId(`application,removemap`)
                    .setLabel(`❌ Remove your base coordinates`)
                    .setStyle('DANGER')
            )
        message.channel.send(({components: [applicationButtons]}))
    }
    // if message is generatemapbutton then create an embed with the maps/shops buttons
    if (message.content === "blank") {
        message.channel.send("️")
    }

    await debug_messageCreate(message)
    await easter_egg_messageCreate(message)
}

async function postRobertMessage(client: DiscordJS.Client, message: DiscordJS.Message) {
    if (client.user == null) {
        console.error(`client.user is null (jx0037)`)
        return
    }
    if ((message.channel.type === 'DM' || message.mentions.has(client.user.id)) && message.author != client.user) {
        const messagesToRobert = await client.channels.fetch(MESSAGES_TO_ROBERT_CHANNEL_ID)
        if (messagesToRobert == null || !(messagesToRobert instanceof TextChannel)) {
            console.error(`Messages to Robert channel is null! (jx0031)`)
            return
        }
        let messageContent = message.content.replace(`<@${ROBERT_USER_ID}>`,"@Robert")
        messageContent = messageContent.replace("@everyone","@ everyone")
        messageContent = message.author.username + ": " + messageContent + ""
        await messagesToRobert.send(escapeFormatting(messageContent))
        for (const attatchment of message.attachments) {
            await messagesToRobert.send(message.author.username + " attached " + attatchment[1].name + ": " + attatchment[1].url)
        }
    }
}