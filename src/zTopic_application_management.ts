import * as DiscordJS from "discord.js"
// @ts-ignore
import { v4 as uuidv4 } from 'uuid'
import {
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    TextBasedChannel,
    TextChannel
} from "discord.js"
import {
    capitalizeFirstLetter, containsRulePhrase,
    escapeFormatting,
    unescapeFormatting,
    verifyUsernameInput
} from "./utility"
import {
    APPLICATION_CHANNEL_ID,
    APPLICATION_MAP_CHANNEL_ID,
    APPLICATION_MAP_MESSAGE_ID,
    APPLICATION_NOTIFICATION_CHANNEL_ID,
    APPLICATION_SHOP_MESSAGE_ID,
    APPLICATION_SHOP_NOTIFICATION_CHANNEL_ID,
    APPLICATION_SHOP_VOTING_CHANNEL_ID,
    APPLICATION_VOTING_CHANNEL_ID,
    client,
    con,
    NO_EMOJI,
    RULE_PHRASE_EMOJI,
    RULE_PHRASE_TEXT,
    YES_EMOJI
} from "./index"
import {discordIdToMinecraftUuid, nameToUuid, usernameCheck, uuidToUsername} from "./api"
import {
    getQuestions, QUESTION_SET_APPLICATION, QUESTION_SET_MAP, QUESTION_SET_SHOP,
    VISIBILITY_ALL, VISIBILITY_ALL_UNIQUE_IDENTIFIER,
    VISIBILITY_NOTIFICATION_ONLY,
    VISIBILITY_REVIEW_ONLY
} from "./zTopic_application_creator"

export const applicationStatusDictionary: Record<string, string> = {
    'accept': 'Application Accepted',
    'rulereject': 'Rejected for not reading rules',
    'rulerejectkick': 'Rejected AND KICKED for not reading rules',
    'badappreject': 'Rejected for bad application',
    'underagereject': 'Rejected for underage application',
    'genericreject': 'Rejected (no specific reason given)',
    'dismissed': 'Dismissed by staff'
}

export var activeApplications: InProgressApplication[] = []

export class InProgressApplication {
    public discordId: string // ID of application creator
    public discordUsername: string // discord username of application creator
    public uniqueIdentifier: string = "" // minecraft username or random uuid for shops
    public applicationMessageId : string = "" // id of message that contains the full application
    public applicationMessageUrl: string = "" // url link to the message with the full application
    public applicationSummaryId: string = "" // id of message with the application summary
    public applicationSummaryUrl: string = "" // url link to the application summary
    public startTimestamp: number // the time that the application was created
    public submittedTimestamp: number = 0 // the time the application was submitted
    public currentQuestionNo: number = 0 // which question number the applicant is currently working on
    public questionSet: string // what set of questions this application pertains to
    public answers: string[] = [] // the answers to the questions in the application

    // APPLICATION STATUSES
    // creating - The applicant is currently creating the application
    // active - The application has been made and is currently being voted on
    // cancelled - The application has been cancelled by the user
    // failed/exception - There has been an issue in the code that has lead to this
    public applicationStatus = "creating" // current status of the application. Starts out active

    public lastNotificationDatetime: Date = new Date() // the last time staff has been reminded to serve this application
    public remindedCount: number = 0 // how many times staff has been reminded to serve this application
    constructor(discordId: string, discordUsername: string, questionSet: string) {
        this.discordId = discordId
        this.discordUsername = discordUsername
        this.startTimestamp = Date.now()
        this.currentQuestionNo = 0
        this.questionSet = questionSet
        this.answers = []
        for (let i = 0; i < this.getQuestionSet().length; i++) {
            this.answers.push('')
        }
    }
    getQuestionSet() {
        return getQuestions(this.questionSet)
    }

    checkForRulePhrase(): boolean {
        let fullAnswers = this.answers.join()
        return containsRulePhrase(fullAnswers)
    }
}

export async function processNewApplication(application: InProgressApplication) {
    // work out what channels to post in
    let applicationChannel: DiscordJS.AnyChannel | undefined
    let applicationNotificationChannel: DiscordJS.AnyChannel | undefined
    if (application.questionSet == QUESTION_SET_APPLICATION) {
        applicationChannel = client.channels.cache.get(APPLICATION_VOTING_CHANNEL_ID) //channel to vote in
        applicationNotificationChannel = client.channels.cache.get(APPLICATION_NOTIFICATION_CHANNEL_ID) //channel to notify basic app info

        let uniqueIdentifier = application.getQuestionSet().findIndex(item => item[2] === VISIBILITY_ALL_UNIQUE_IDENTIFIER)
        application.uniqueIdentifier = application.answers[uniqueIdentifier]
    } else if (application.questionSet == QUESTION_SET_SHOP) {
        applicationChannel = client.channels.cache.get(APPLICATION_SHOP_VOTING_CHANNEL_ID) //channel to vote in
        applicationNotificationChannel = client.channels.cache.get(APPLICATION_SHOP_NOTIFICATION_CHANNEL_ID) //channel to notify basic app info

        application.uniqueIdentifier = uuidv4()
    } else if (application.questionSet == QUESTION_SET_MAP) {
        // create the message with the coordinate text
        let mcUuid = await discordIdToMinecraftUuid(application.discordId) ?? "unknown"
        if (mcUuid == "unknown") return
        let mcUsername = await uuidToUsername(mcUuid) ?? "unknown"
        if (mcUsername == "unknown") return

        let coordinateText = `${escapeFormatting(mcUsername)}: ${application.answers[0]}, ${application.answers[1]}`
        // update the message in the database
        con.query(
            'INSERT INTO `map` (`discordId`, `text`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `text` = VALUES(`text`)',
            [application.discordId, coordinateText],
            function (err: any, result: any, fields: any) {
                if (err) {
                    console.error(err)
                    return
                }
                // rebuild the edited message
                rebuildMapMessage()
            }
        )
    }

    const applicationTextChannel: TextBasedChannel = applicationChannel as DiscordJS.TextChannel

    let applicationReviewDescription = ""
    let applicationNotificationDescription = ""
    let totalApplicationLength = 0

    for (let i = 0; i < application.answers.length; i++) {
        let currentQuestion = application.getQuestionSet()[i]
        let applicantAnswer = application.answers[i]
        totalApplicationLength += applicantAnswer.length
        let questionShortText = currentQuestion[3]
        let visibility = currentQuestion[2]
        if (visibility == VISIBILITY_REVIEW_ONLY || visibility == VISIBILITY_ALL || visibility == VISIBILITY_ALL_UNIQUE_IDENTIFIER) {
            applicationReviewDescription += `${questionShortText}: ${escapeFormatting(applicantAnswer)}\n`
        }
        if (visibility == VISIBILITY_NOTIFICATION_ONLY || visibility == VISIBILITY_ALL || visibility == VISIBILITY_ALL_UNIQUE_IDENTIFIER) {
            applicationNotificationDescription += `${questionShortText}: ${applicantAnswer}\n`
        }
    }

    // different formatting depending on what kind of application it is
    if (application.questionSet == QUESTION_SET_APPLICATION) {
        let applicationLengthDescription: string
        const applicationLength = totalApplicationLength
        if (applicationLength < 110) applicationLengthDescription = "Impressively bad"
        else if (applicationLength < 300) applicationLengthDescription = "Yikes"
        else if (applicationLength < 360) applicationLengthDescription = "Basic"
        else if (applicationLength < 530) applicationLengthDescription = "Decent"
        else if (applicationLength < 770) applicationLengthDescription = "Good"
        else if (applicationLength < 1080) applicationLengthDescription = "Very good"
        else if (applicationLength < 1350) applicationLengthDescription = "Amazing!"
        else applicationLengthDescription = "WOAH!"

        const rulePhraseDetectedString: string = application.checkForRulePhrase() ? "Yes" : "No"

        applicationReviewDescription = `Discord Name: ${escapeFormatting(application.discordUsername)}\n${applicationReviewDescription}${capitalizeFirstLetter(RULE_PHRASE_TEXT)}s Detected: ${rulePhraseDetectedString}\nApplication Size: ${applicationLengthDescription}`
        applicationNotificationDescription = `Discord Name: ${escapeFormatting(application.discordUsername)}\n${applicationNotificationDescription}${capitalizeFirstLetter(RULE_PHRASE_TEXT)}s Detected: ${rulePhraseDetectedString}`
    } else if (application.questionSet == QUESTION_SET_SHOP) {
        applicationReviewDescription = `Discord Name: ${escapeFormatting(application.discordUsername)}\n${applicationReviewDescription}`
        applicationNotificationDescription = `Discord Name: ${escapeFormatting(application.discordUsername)}\n${applicationNotificationDescription}`
    }

    const applicationEmbedToPost = new MessageEmbed()
        .setColor("#bdbc4b")
        .setTitle("New Application - Please vote")
        .setDescription(applicationReviewDescription)

    // prepare application summary
    if (applicationChannel == null || !(applicationChannel instanceof TextChannel)) {
        console.log(`${APPLICATION_CHANNEL_ID} is not a valid text channel for application information `)
    } else {

        const messageActionRow = new MessageActionRow()

        const dismissButton = new MessageButton()
            .setCustomId(`application,dismiss,${application.uniqueIdentifier}`)
            .setLabel(`Dismiss application`)
            .setStyle('DANGER')
        messageActionRow.addComponents(dismissButton)

        // if application is for a shop, add an edit button
        if (application.questionSet == QUESTION_SET_SHOP) {
            const editButton = new MessageButton()
                .setCustomId(`shop,editbyuuid,${application.uniqueIdentifier}`)
                .setLabel(`Edit answers`)
                .setStyle('SECONDARY')
            messageActionRow.addComponents(editButton)
        }

        await applicationChannel.send("@everyone")
        await applicationChannel.send({ embeds: [applicationEmbedToPost], components: [messageActionRow] })
            .then(function (voteMessage: { react: (arg0: string) => void }) {
                if (voteMessage instanceof Message) {
                    application.applicationSummaryId = voteMessage.id
                    application.applicationSummaryUrl = voteMessage.url
                }
                voteMessage.react(YES_EMOJI)
                voteMessage.react(NO_EMOJI)
            })
    }

    if (applicationNotificationChannel == null || !(applicationNotificationChannel instanceof TextChannel)) {
        console.log(`${APPLICATION_NOTIFICATION_CHANNEL_ID} is not a valid text channel for application summary`)
    } else {
        // prepare notification summary
        const basicApplicationEmbed = new MessageEmbed()
            .setColor("#bdbc4b")
            .setTitle("A new application has been sent")
            .setDescription(escapeFormatting(applicationNotificationDescription))

        await applicationNotificationChannel.send({embeds: [basicApplicationEmbed]})
    }

    // specific for main application
    if (application.questionSet == QUESTION_SET_APPLICATION && applicationChannel != null && applicationChannel instanceof TextChannel) {
        // check if Mojang recognizes the username or if its spelt correctly
        let usernameValid: Boolean = await usernameCheck(application.uniqueIdentifier, applicationChannel)
        if (!usernameValid && !verifyUsernameInput(application.uniqueIdentifier)) {
            await applicationChannel.send("This IGN doesnt look quite right. Reply to the application message with !(ign) if it is wrong")
        }

        if (!application.checkForRulePhrase()) {
            postRuleRejectButtons(application.uniqueIdentifier, application.discordId, applicationTextChannel, application.applicationMessageId)
        }

        let mcUuid = await nameToUuid(application.uniqueIdentifier) ?? "unknown"

        // export application data to database
        con.query(`INSERT INTO applicationhistory(dcUserId, messageId, messageTimestamp, messageURL, mcUsername, mcUuid, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [application.discordId, application.applicationMessageId, application.submittedTimestamp, application.applicationMessageUrl, application.uniqueIdentifier, mcUuid, "unknown"], (err: any) => {
                if (err) {
                    console.error('Error inserting data:', err)
                } else {
                    console.log('Data inserted successfully')
                }
            })

        await postApplicationHistory(applicationChannel, application.discordId, application.uniqueIdentifier)
    }
}

export async function rebuildShopMessage() {
    // rebuild the edited message
    let mapsShopsChannel = client.channels.cache.get(APPLICATION_MAP_CHANNEL_ID)
    if (!(mapsShopsChannel instanceof TextChannel)) return
    let mapMessage = await mapsShopsChannel.messages.fetch(APPLICATION_SHOP_MESSAGE_ID)

    con.query(
        'SELECT `shopOwner`, `shopType`, `xCoord`, `zCoord` FROM `shop` ORDER BY `shopType` ASC',
        function (err: Error | null, result: any[]) {
            if (err) {
                console.error(err)
                return
            }
            let concatenatedText = ''

            // Iterate over each record in the result array
            result.forEach((record) => {
                // Format the information and concatenate to the result string
                concatenatedText += `${record.shopType} (${record.shopOwner}) X:${record.xCoord}, Z:${record.zCoord}\n`
            })
            mapMessage.edit(`**__Shops:__**\n${concatenatedText}`)
        }
    )
}

export async function rebuildMapMessage() {
    // rebuild the edited message
    let mapChannel = client.channels.cache.get(APPLICATION_MAP_CHANNEL_ID)
    if (!(mapChannel instanceof TextChannel)) return
    let mapMessage = await mapChannel.messages.fetch(APPLICATION_MAP_MESSAGE_ID)

    con.query(
        'SELECT `text` FROM `map` ORDER BY `text` ASC',
        function (err: Error | null, result: any[]) {
            if (err) {
                console.error(err)
                return
            }

            const texts: string[] = result.map(row => row.text)
            const concatenatedText: string = texts.join('\n')

            mapMessage.edit(`**__Base locations:__**\n${concatenatedText}`)
        }
    )
}

export function removeMapCoord(discordId: String) {
    con.query(
        'DELETE FROM `map` WHERE `discordId` = ?',
        [discordId],
        function (err: Error | null, result: any) {
            if (err) {
                console.error(err)
                return
            }
        }
    )
}

export async function postApplicationHistory(messageChannel: TextChannel, discordId: string, mcUsername = '') {
    let applicationHistory: MessageEmbed[]
    try {
        applicationHistory = await checkApplicationHistory(discordId,mcUsername)
        if (applicationHistory != null && applicationHistory.length >= 1 && applicationHistory[0].description != null && applicationHistory[0].description.length >= 1) {
            try {
                await messageChannel.send({content: "Application History", embeds: applicationHistory})
            }
            catch (e) {
                console.error(`failed to post application history: ${applicationHistory[0].description}`)
            }
        }
        else await messageChannel.send({content: "No known prior application history"})
    } catch (error) {
        console.error('Error retrieving application history:', error)
    }
}

export async function removeActiveApplication(applicationMessageId: string) {
    activeApplications = activeApplications.filter(application => application.applicationMessageId != applicationMessageId)
}

export async function removeActiveApplicationByUniqueIdentifier(uniqueIdentifier: string) {
    activeApplications = activeApplications.filter(application => application.uniqueIdentifier != uniqueIdentifier)
}

export async function changeApplicationIGN(message: DiscordJS.Message) {
    if (message.reference != null && message.reference.messageId != null && message.content.at(0) == "!") {
        // initial null checks
        if (client.user == null) {
            console.error(`client.user is null (jx0036)`)
            return
        }
        const applicationChannel = client.channels.cache.get(APPLICATION_VOTING_CHANNEL_ID) //channel to vote in
        if (applicationChannel == null || !(applicationChannel instanceof TextChannel)) {
            console.log(`${APPLICATION_CHANNEL_ID} is not a valid text channel for application information (jx0011)`)
            return
        }

        const newIgnToSet = message.content.slice(1)
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
            embed.setDescription(embed.description.replace(mcUsername, newIgnToSet))
            await messageRepliedTo.edit({embeds: [embed]})
            await usernameCheck(newIgnToSet, applicationChannel)
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
    channel.send({ content:`${escapeFormatting(mcusername)} has been flagged as not having mentioned ${RULE_PHRASE_TEXT}. Click the button to ${RULE_PHRASE_TEXT} reject.`, components: [ruleViolationButton, genericDeclineButton] })
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
    channel.send({
        content: `${escapeFormatting(mcusername)} has received enough votes to be rejected. Click a button to reject.`,
        components: [badApplicationButton, underAgeButton, genericButton]
    })
}

export function postShopAcceptButton(uniqueIdentifier: string, applicant: string, channel: DiscordJS.TextBasedChannel) {
    const shopAcceptButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`shop,accept,${uniqueIdentifier}`)
                .setLabel(`Accept shop request from ${unescapeFormatting(applicant)}`)
                .setStyle('PRIMARY'),
        )
    channel.send({
        content: `${escapeFormatting(applicant)} has received enough votes to be accepted. Click the button to accept`,
        components: [shopAcceptButton]
    })
}

export function postShopRejectButton(uniqueIdentifier: string, applicant: string, channel: DiscordJS.TextBasedChannel) {
    const shopRejectButton = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`shop,reject,${uniqueIdentifier}`)
                .setLabel(`Reject shop request from ${unescapeFormatting(applicant)}`)
                .setStyle('DANGER'),
        )
    channel.send({
        content: `${escapeFormatting(applicant)} has received enough votes to be rejected. Click the button to reject. You must send the applicant a message yourself explaining why they were rejected and suggest a resolution.`,
        components: [shopRejectButton]
    })
}