import * as DiscordJS from "discord.js"
import {
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
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
import {
    APPLICATION_CHANNEL_ID, APPLICATION_NOTIFICATION_CHANNEL_ID,
    APPLICATION_VOTING_CHANNEL_ID,
    client,
    con,
    NO_EMOJI,
    RULE_PHRASE_EMOJI,
    RULE_PHRASE_TEXT,
    YES_EMOJI
} from "./index"
import {nameToUuid} from "./api"

const applicationStatusDictionary: Record<string, string> = {
    'accept': 'Application Accepted',
    'rulereject': 'Rejected for not reading rules',
    'rulerejectkick': 'Rejected AND KICKED for not reading rules',
    'badappreject': 'Rejected for bad application',
    'underagereject': 'Rejected for underage application',
    'genericreject': 'Rejected (no specific reason given)',
}

export var activeApplications: ActiveApplication[] = []

export async function processNewApplication(message: DiscordJS.Message) {
    const applicationChannel = client.channels.cache.get(APPLICATION_VOTING_CHANNEL_ID) //channel to vote in
    const applicationNotificationChannel = client.channels.cache.get(APPLICATION_NOTIFICATION_CHANNEL_ID) //channel to notify basic app info
    if (applicationChannel == null || !(applicationChannel instanceof TextChannel)) {
        console.log(`${APPLICATION_CHANNEL_ID} is not a valid text channel for application information (jx0011)`)
        return
    }
    if (applicationNotificationChannel == null || !(applicationNotificationChannel instanceof TextChannel)) {
        console.log(`${APPLICATION_NOTIFICATION_CHANNEL_ID} is not a valid text channel for application summary (jx0041)`)
        return
    }
    const applicationTextChannel: TextBasedChannel = applicationChannel as DiscordJS.TextChannel

    const applicationEmbedToScan = message.embeds[0]
    const application = await scanApplication(applicationEmbedToScan)

    const rulePhraseDetectedString: string = application.rulePhraseDetected ? "Yes" : "No"

    const applicationEmbedToPost = new MessageEmbed()
        .setColor("#bdbc4b")
        .setTitle("New Application - Please vote")
        .setDescription(
            `IGN: ${escapeFormatting(application.ign)}\n` +
            `Discord name: ${escapeFormatting(application.discordName)}\n` +
            `Age: ${application.age}\n` +
            `${capitalizeFirstLetter(RULE_PHRASE_TEXT)} Detected: ${rulePhraseDetectedString}\n` +
            `Application Size: ${application.applicationLengthDescription}`)
        .setFooter(`${application.discordID},${message.id}`)

    let votingIgn: string = ""
    let applicationMessageId: string = ""
    let votingMessageUrl: string = ""
    let votingMessageTimestamp: number = 0

    applicationChannel.send("@everyone")
    applicationChannel.send({embeds: [applicationEmbedToPost]})
        .then(function (voteMessage: { react: (arg0: string) => void }){
            if (voteMessage instanceof Message) {
                votingIgn = application.ign
                applicationMessageId = message.id
                votingMessageUrl = voteMessage.url
                votingMessageTimestamp = voteMessage.createdTimestamp
                activeApplications.push(new ActiveApplication(
                    votingIgn,
                    applicationMessageId,
                    votingMessageUrl,
                    votingMessageTimestamp
                ))
            }
            voteMessage.react(YES_EMOJI)
            voteMessage.react(NO_EMOJI)
        })

    const basicApplicationEmbed = new MessageEmbed()
        .setColor("#bdbc4b")
        .setTitle("A new application has been sent")
        .setDescription(
            `IGN: ${escapeFormatting(application.ign)}\n` +
            `Discord name: ${escapeFormatting(application.discordName)}\n` +
            `Referral: ${application.referral}\n` +
            `${capitalizeFirstLetter(RULE_PHRASE_TEXT)} Detected: ${rulePhraseDetectedString}\n`)

    applicationNotificationChannel.send({embeds: [basicApplicationEmbed]})

    if (!verifyUsernameInput(application.ign)){
        applicationChannel.send("This IGN doesnt look quite right. Reply to the application message with !(ign) if it is wrong")
    }

    if (!application.rulePhraseDetected){
        postRuleRejectButtons(application.ign,application.discordID,applicationTextChannel, message.id)
    }

    let mcUuid = await nameToUuid(application.ign) ?? "unknown"

    // export application data to database
    con.query(`INSERT INTO applicationhistory(dcUserId, messageId, messageTimestamp, messageURL, mcUsername, mcUuid, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [application.discordID, message.id, message.createdTimestamp, message.url, application.ign, mcUuid, "unknown"], (err: any) => {
            if (err) {
                console.error('Error inserting data:', err)
            } else {
                console.log('Data inserted successfully')
            }
        })

    await postApplicationHistory(message, applicationChannel, application.discordID, application.ign)

    await message.react("🇵")
}

export async function postApplicationHistory(message: Message, messageChannel: TextChannel, discordId: string, mcUsername = '') {
    let applicationHistory: MessageEmbed[]
    try {
        applicationHistory = await checkApplicationHistory(discordId,mcUsername)
        if (applicationHistory != null && applicationHistory.length >= 1 && applicationHistory[0].description != null && applicationHistory[0].description.length >= 1) {
            try {
                messageChannel.send({content: "Application History", embeds: applicationHistory})
            }
            catch (e) {
                console.error(`failed to post application history: ${applicationHistory[0].description}`)
            }
        }
        else messageChannel.send({content: "No known prior application history"})
    } catch (error) {
        console.error('Error retrieving application history:', error)
    }
}

export async function scanApplication(receivedEmbed: MessageEmbed): Promise<Application> {

    if(receivedEmbed.description == null || !receivedEmbed.description.includes("What is your Minecraft IGN?")){
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

class ActiveApplication {
    public name: string
    public applicationMessageId: string
    public url: string
    public timestamp: number
    public lastNotificationDatetime: Date = new Date()
    public remindedCount: number = 0
    constructor(name: string, applicationMessageId: string, url: string, timestamp: number) {
        this.name = name
        this.applicationMessageId = applicationMessageId
        this.url = url
        this.timestamp = timestamp
    }
}

export async function removeActiveApplication(applicationMessageId: string) {
    activeApplications = activeApplications.filter(application => application.applicationMessageId != applicationMessageId)
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

        const oneMinuteAgo = Date.now() - 60 * 1000

        console.log(`SELECT * FROM applicationhistory WHERE dcUserId = '${dcUserId}' or mcUsername = '${mcUsername}' or mcUuid = '${mcUuid}'`)
        con.query(
            'SELECT * FROM applicationhistory WHERE (dcUserId = ? or mcUsername = ? or mcUuid = ?) AND messageTimestamp < ? ORDER BY messageTimestamp DESC',
            [dcUserId, mcUsername, mcUuid, oneMinuteAgo],
            function (err: any, result: any) {
                if (err) {
                    reject(err)
                    return
                }

                let username: String = ""

                for (var sqlItem of result) {
                    let sqlDcUserId = sqlItem['dcUserId']
                    let sqlMcUsername = sqlItem['mcUsername']
                    let sqlMcUuid = sqlItem['mcUuid']
                    let messageTimestamp = sqlItem['messageTimestamp'].slice(0, -3)
                    let messageURL = sqlItem['messageURL']
                    let status = sqlItem['status']

                    // remove nulls to check for errors
                    if (dcUserId == null) dcUserId = ""
                    if (mcUuid == null) mcUuid = ""
                    if (mcUsername == null) mcUsername = ""
                    if (sqlDcUserId == null) sqlDcUserId = ""
                    if (sqlMcUsername == null) sqlMcUsername = ""
                    if (sqlMcUuid == null) sqlMcUuid = ""

                    // save the most recent recorded username
                    if (username == "" && mcUsername != "") username = mcUsername

                    // establish what is matching
                    var sharingString = ""
                    if (dcUserId != "" && dcUserId.toLowerCase() === sqlDcUserId.toLowerCase()) {
                        sharingString += 'Discord account'
                    }

                    if (mcUuid != "" && mcUuid.toLowerCase() === sqlMcUuid.toLowerCase()) {
                        if (sharingString) {
                            sharingString += ' and '
                        }
                        sharingString += 'Minecraft account'
                    } else if (mcUsername != "" && mcUsername.toLowerCase() === sqlMcUsername.toLowerCase()) {
                        if (sharingString) {
                            sharingString += ' and '
                        }
                        sharingString += 'Minecraft username'
                    }

                    // if the amount of text in a 4096 character embed is about to be maxxed
                    if (answerString.length > 3500) {
                        returnMessage.push(new MessageEmbed().setDescription(answerString))
                        answerString = ""
                    }

                    if (typeof status === 'string') status = applicationStatusDictionary[status]

                    let applicationSuccessString = status == null || status == "unknown" ? "" : `. Application status: ${status}.`
                    answerString += `The same ${sharingString} detected <t:${messageTimestamp}:R> on <t:${messageTimestamp}:f> ${messageURL}${applicationSuccessString}\n`
                }

                if (answerString.length >= 1) returnMessage.push(new MessageEmbed().setDescription(answerString))
                if (username != "" && returnMessage.length >= 1) returnMessage.at(0)?.setTitle(`Player username: ${escapeFormatting(username.toString())}`)
                resolve(returnMessage)
            }
        )
    })
}

export function postRuleRejectButtons(mcusername: string, discordID: string, channel: DiscordJS.TextBasedChannel, applicationMessageId: String) {
    const ruleViolationButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},rulereject,${applicationMessageId}`)
                .setLabel(`${RULE_PHRASE_EMOJI} ${capitalizeFirstLetter(RULE_PHRASE_TEXT)} rule reject ${unescapeFormatting(mcusername)}`)
                .setStyle('SECONDARY'),
        )
    const genericDeclineButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},rulerejectkick,${applicationMessageId}`)
                .setLabel(`${RULE_PHRASE_EMOJI} ${capitalizeFirstLetter(RULE_PHRASE_TEXT)} rule reject AND KICK ${unescapeFormatting(mcusername)}`)
                .setStyle('DANGER'),
        )
    channel.send({ content:`${escapeFormatting(mcusername)} has been flagged as not having mentioned ${RULE_PHRASE_TEXT}. Click the button to ${RULE_PHRASE_TEXT} reject`, components: [ruleViolationButton, genericDeclineButton] })
}

export function postRegularRejectButtons(mcusername: string, discordID: string, channel: DiscordJS.TextBasedChannel, applicationMessageId: String) {
    const badApplicationButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},badappreject,${applicationMessageId}`)
                .setLabel(`💩 Bad application reject and kick ${unescapeFormatting(mcusername)}`)
                .setStyle('SECONDARY'),
        )
    const underAgeButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},underagereject,${applicationMessageId}`)
                .setLabel(`🔞 Underage application reject and kick ${unescapeFormatting(mcusername)}`)
                .setStyle('SECONDARY'),
        )
    const genericButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`${mcusername},${discordID},genericreject,${applicationMessageId}`)
                .setLabel(`👎 Generic reason reject and kick ${unescapeFormatting(mcusername)}`)
                .setStyle('SECONDARY'),
        )
    channel.send({ content:`${escapeFormatting(mcusername)} has received enough votes to be rejected. Click a button to reject`, components: [badApplicationButton, underAgeButton, genericButton] })
}