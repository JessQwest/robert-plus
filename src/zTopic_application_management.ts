import * as DiscordJS from "discord.js"
import {MessageActionRow, MessageButton, MessageEmbed, TextBasedChannel, TextChannel} from "discord.js"
import {
    capitalizeFirstLetter,
    containsRulePhrase,
    escapeFormatting,
    unescapeFormatting,
    verifyUsernameInput
} from "./utility"
import {APPLICATION_CHANNEL_ID, client, NO_EMOJI, RULE_PHRASE_EMOJI, RULE_PHRASE_TEXT, YES_EMOJI} from "./index"

export async function processNewApplication(message: DiscordJS.Message) {
    const applicationChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID)
    if (applicationChannel == null || !(applicationChannel instanceof TextChannel)) {
        console.log(`${APPLICATION_CHANNEL_ID} is not a valid text channel (jx0011)`)
        return
    }
    const applicationTextChannel: TextBasedChannel = applicationChannel as DiscordJS.TextChannel

    const recievedEmbed = message.embeds[0]

    if(recievedEmbed.description == null || !recievedEmbed.description.includes("What is your Minecraft IGN?")) return

    // @ts-ignore
    const ignBlockText = recievedEmbed.description.match("What is your Minecraft IGN\\?:(.|\\n)*What is your age\\?:").toString()
    // @ts-ignore
    const ign = ignBlockText.slice(29,-22)

    // @ts-ignore
    const ageBlockText = recievedEmbed.description.match("What is your age\\?:(.|\\n)*Why do you want to join this server\\?:").toString()
    // @ts-ignore
    const age = ageBlockText.slice(19,-41)

    // @ts-ignore
    const referralText = recievedEmbed.description.match("please specify who\\.:(.|\\n)*Have you read and understood").toString()
    // @ts-ignore
    const referral = referralText.slice(21,-32)

    // @ts-ignore
    const discordNameBlockText = recievedEmbed.footer?.text.match("Applicant:\\s*.+\\s*ID").toString()
    // @ts-ignore
    const discordName = discordNameBlockText.slice(11,-3)

    // @ts-ignore
    const discordID = recievedEmbed.footer.text.slice(-19).trim()
    console.log(discordID)

    let applicationLengthDescription = "Unknown"
    // @ts-ignore
    const applicationLength = recievedEmbed.description.length
    console.log(`application length is ${applicationLength} characters`)
    if (applicationLength < 590) applicationLengthDescription = "Impressively bad"
    else if (applicationLength < 775) applicationLengthDescription = "Yikes"
    else if (applicationLength < 820) applicationLengthDescription = "Basic"
    else if (applicationLength < 1013) applicationLengthDescription = "Decent"
    else if (applicationLength < 1253) applicationLengthDescription = "Good"
    else if (applicationLength < 1553) applicationLengthDescription = "Very good"
    else if (applicationLength < 1853) applicationLengthDescription = "Amazing!"
    else applicationLengthDescription = "WOAH!"

    const rulePhraseDetected: boolean = containsRulePhrase(recievedEmbed.description)
    const rulePhraseDetectedString: string = rulePhraseDetected ? "Yes" : "No"

    const applicationEmbed = new MessageEmbed()
        .setColor("#bdbc4b")
        .setTitle("New Application - Please vote")
        .setDescription(
            `IGN: ${escapeFormatting(ign)}\n` +
            `Discord name: ${escapeFormatting(discordName)}\n` +
            `Age: ${age}` +
            `${capitalizeFirstLetter(RULE_PHRASE_TEXT)} Detected: ${rulePhraseDetectedString}\n` +
            `Application Size: ${applicationLengthDescription}`)
        .setFooter(discordID)

    applicationChannel.send("@everyone")
    applicationChannel.send({embeds: [applicationEmbed]})
        .then(function (message: { react: (arg0: string) => void }){
            message.react(YES_EMOJI)
            message.react(NO_EMOJI)
        })

    const basicApplicationEmbed = new MessageEmbed()
        .setColor("#bdbc4b")
        .setTitle("A new application has been sent")
        .setDescription(
            `IGN: ${escapeFormatting(ign)}\n` +
            `Discord name: ${escapeFormatting(discordName)}\n` +
            `Referral: ${referral}\n` +
            `${capitalizeFirstLetter(RULE_PHRASE_TEXT)} Detected: ${rulePhraseDetectedString}\n`)

    applicationChannel.send({embeds: [basicApplicationEmbed]})

    if (!verifyUsernameInput(ign)){
        applicationChannel.send("This IGN doesnt look quite right. Reply to the application message with !(ign) if it is wrong")
    }

    if (!rulePhraseDetected){
        postRuleRejectButtons(ign,discordID,applicationTextChannel)
    }

    await message.react("🇵")
}

export async function changeApplicationIGN(message: DiscordJS.Message) {
    if (message.reference != null && message.reference.messageId != null && message.content.at(0) == "!") {
        if (client.user == null) {
            console.error(`client.user is null (jx0036)`)
            return
        }
        const messageRepliedTo: DiscordJS.Message = await message.channel.messages.fetch(message.reference.messageId)
        if (messageRepliedTo.author.id == client.user.id && messageRepliedTo.embeds.length >= 1) {
            const embed = messageRepliedTo.embeds[0]
            if (embed.description == null) {
                console.error(`embed description is null (jx0034)`)
                return
            }
            const usernameBlockText = embed.description.match("IGN:\\s*.+\\s*Discord")?.toString()
            if (usernameBlockText == null) {
                console.error(`usernameBlockText is null (jx0035)`)
                return
            }
            const mcUsername = usernameBlockText.slice(5, -8)
            embed.setDescription(embed.description.replace(mcUsername, message.content.slice(1)))
            await messageRepliedTo.edit({embeds: [embed]})
        }
    }
}

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