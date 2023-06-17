import * as DiscordJS from "discord.js"
import {
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    MessageOptions,
    MessagePayload,
    TextBasedChannel,
    TextChannel
} from "discord.js"
import {
    capitalizeFirstLetter,
    containsRulePhrase,
    escapeFormatting,
    unescapeFormatting,
    verifyUsernameInput
} from "./utility"
import {APPLICATION_CHANNEL_ID, client, con, NO_EMOJI, RULE_PHRASE_EMOJI, RULE_PHRASE_TEXT, YES_EMOJI} from "./index"
import {nameToUuid} from "./api"

export async function processNewApplication(message: DiscordJS.Message) {
    const applicationChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID)
    if (applicationChannel == null || !(applicationChannel instanceof TextChannel)) {
        console.log(`${APPLICATION_CHANNEL_ID} is not a valid text channel (jx0011)`)
        return
    }
    const applicationTextChannel: TextBasedChannel = applicationChannel as DiscordJS.TextChannel

    const application = await scanApplication(message.embeds[0])

    const rulePhraseDetectedString: string = application.rulePhraseDetected ? "Yes" : "No"

    const applicationEmbed = new MessageEmbed()
        .setColor("#bdbc4b")
        .setTitle("New Application - Please vote")
        .setDescription(
            `IGN: ${escapeFormatting(application.ign)}\n` +
            `Discord name: ${escapeFormatting(application.discordName)}\n` +
            `Age: ${application.age}\n` +
            `${capitalizeFirstLetter(RULE_PHRASE_TEXT)} Detected: ${rulePhraseDetectedString}\n` +
            `Application Size: ${application.applicationLengthDescription}`)
        .setFooter(application.discordID)

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
            `IGN: ${escapeFormatting(application.ign)}\n` +
            `Discord name: ${escapeFormatting(application.discordName)}\n` +
            `Referral: ${application.referral}\n` +
            `${capitalizeFirstLetter(RULE_PHRASE_TEXT)} Detected: ${rulePhraseDetectedString}\n`)

    applicationChannel.send({embeds: [basicApplicationEmbed]})

    if (!verifyUsernameInput(application.ign)){
        applicationChannel.send("This IGN doesnt look quite right. Reply to the application message with !(ign) if it is wrong")
    }

    if (!application.rulePhraseDetected){
        postRuleRejectButtons(application.ign,application.discordID,applicationTextChannel)
    }

    let applicationHistory: MessageEmbed[];
    try {
        applicationHistory = await checkApplicationHistory(application.discordID, application.ign)
        if (applicationHistory != null && applicationHistory.length >= 1) {
            applicationChannel.send({embeds: applicationHistory})
        }
    } catch (error) {
        console.error('Error retrieving application history:', error)
    }

    await message.react("🇵")
}

export async function scanApplication(receivedEmbed: MessageEmbed): Promise<Application> {

    if(receivedEmbed.description == null || !receivedEmbed.description.includes("What is your Minecraft IGN?")){
        // @ts-ignore
        console.log(`Invalid application! (jx0039) - ${receivedEmbed.description.slice(0,30)}...`)
        throw `Invalid application! (jx0039)`
    }

    const ignBlockText = receivedEmbed.description.match("What is your Minecraft IGN\\?:(.|\\n)*What is your age\\?:")?.toString()
    const ign = ignBlockText?.slice(29,-22)

    const ageBlockText = receivedEmbed.description.match("What is your age\\?:(.|\\n)*Why do you want to join this server\\?:")?.toString()
    const age = ageBlockText?.slice(19,-41)

    const referralText = receivedEmbed.description.match("please specify who\\.:(.|\\n)*Have you read and understood")?.toString()
    const referral = referralText?.slice(21,-32)

    const discordNameBlockText = receivedEmbed.footer?.text.match("Applicant:\\s*.+\\s*ID")?.toString()
    const discordName = discordNameBlockText?.slice(11,-3)

    const discordID = receivedEmbed.footer?.text.slice(-19).trim()
    //console.log(discordID)

    let applicationLengthDescription = "Unknown"
    const applicationLength = receivedEmbed.description.length
    //console.log(`application length is ${applicationLength} characters`)
    if (applicationLength < 590) applicationLengthDescription = "Impressively bad"
    else if (applicationLength < 775) applicationLengthDescription = "Yikes"
    else if (applicationLength < 820) applicationLengthDescription = "Basic"
    else if (applicationLength < 1013) applicationLengthDescription = "Decent"
    else if (applicationLength < 1253) applicationLengthDescription = "Good"
    else if (applicationLength < 1553) applicationLengthDescription = "Very good"
    else if (applicationLength < 1853) applicationLengthDescription = "Amazing!"
    else applicationLengthDescription = "WOAH!"

    const rulePhraseDetected: boolean = containsRulePhrase(receivedEmbed.description)
    // @ts-ignore
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

export function checkApplicationHistory(dcUserId: string, mcUsername = ''): Promise<MessageEmbed[]> {
    return new Promise(async (resolve, reject) => {
        let returnMessage: MessageEmbed[] = []
        let answerString = ''
        let mcUuid: string
        if (mcUsername == '') {
            mcUuid = ''
        } else mcUuid = await nameToUuid(mcUsername)

        console.log(`SELECT * FROM applicationhistory WHERE dcUserId = '${dcUserId}' or mcUsername = '${mcUsername}' or mcUuid = '${mcUuid}'`)
        con.query(
            'SELECT * FROM applicationhistory WHERE dcUserId = ? or mcUsername = ? or mcUuid = ?',
            [dcUserId, mcUsername, mcUuid],
            function (err: any, result: any, fields: any) {
                if (err) {
                    reject(err)
                    return
                }

                for (var sqlItem of result) {
                    var sqlDcUserId = sqlItem['dcUserId']
                    var sqlMcUsername = sqlItem['mcUsername']
                    var sqlMcUuid = sqlItem['mcUuid']
                    var messageTimestamp = sqlItem['messageTimestamp'].slice(0, -3)
                    var messageURL = sqlItem['messageURL']

                    if (dcUserId == null) dcUserId = ""
                    if (mcUuid == null) mcUuid = ""
                    if (mcUsername == null) mcUsername = ""
                    if (sqlDcUserId == null) sqlDcUserId = ""
                    if (sqlMcUsername == null) sqlMcUsername = ""
                    if (sqlMcUuid == null) sqlMcUuid = ""

                    var sharingString = ""
                    if (dcUserId != "" && dcUserId.toLowerCase() === sqlDcUserId.toLowerCase()) {
                        sharingString += 'Discord account';
                    }

                    if (mcUuid != "" && mcUuid.toLowerCase() === sqlMcUuid.toLowerCase()) {
                        if (sharingString) {
                            sharingString += ' and ';
                        }
                        sharingString += 'Minecraft account';
                    } else if (mcUsername != "" && mcUsername.toLowerCase() === sqlMcUsername.toLowerCase()) {
                        if (sharingString) {
                            sharingString += ' and ';
                        }
                        sharingString += 'Minecraft username';
                    }

                    // if the amount of text in a 4096 character embed is about to be maxxed
                    if (answerString.length > 3500) {
                        returnMessage.push(new MessageEmbed().setDescription(answerString))
                        answerString = ""
                    }

                    answerString += `The same ${sharingString} detected <t:${messageTimestamp}:R> on <t:${messageTimestamp}:f> ${messageURL}\n`
                }

                returnMessage.push(new MessageEmbed().setDescription(answerString))
                resolve(returnMessage)
            }
        )
    })
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