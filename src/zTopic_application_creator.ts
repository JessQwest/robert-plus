import * as DiscordJS from "discord.js"
import {containsRulePhrase, escapeFormatting, unescapeFormatting, verifyUsernameInput} from "./utility"
import {MessageActionRow, MessageButton, MessageEmbed, TextChannel} from "discord.js"
import {
    APPLICATION_CHANNEL_ID, APPLICATION_MAP_FORM_CHANNEL_ID,
    APPLICATION_NOTIFICATION_CHANNEL_ID, APPLICATION_SHOP_CHANNEL_ID,
    client,
    SERVER_NAME
} from "./index"
import {usernameCheck} from "./api"
import {activeApplications, InProgressApplication, processNewApplication} from "./zTopic_application_management"


export const REQ_IGN = "IGN"
export const REQ_POS_NUMBER = "NUMBER"
export const REQ_ANY_NUMBER = "ANY_NUMBER"
export const REQ_TEXT = "TEXT"
export const REQ_TINY_TEXT = "TINY_TEXT"
export const REQ_OPTIONAL_TEXT = "OPTIONAL_TEXT"
export const REQ_AGREE = "AGREE"

export const VISIBILITY_NONE = "NONE"
export const VISIBILITY_REVIEW_ONLY = "REVIEW_ONLY"
export const VISIBILITY_NOTIFICATION_ONLY = "NOTIFICATION_ONLY"
export const VISIBILITY_ALL = "ALL"
export const VISIBILITY_ALL_UNIQUE_IDENTIFIER = "ALL_UNIQUE_IDENTIFIER"

export const QUESTION_SET_APPLICATION = "applicationquestions"
export const QUESTION_SET_SHOP = "shopquestions"
export const QUESTION_SET_MAP = "mapquestions"

// [Question text, validation type, visibility, short identifier]
// visibility indicates if the response is shown in the summary to application reviewers, notification viewers, none or both
// use the all unique identifier to establish their name for voting purposes
export const applicationquestions = [
    ["What is your Minecraft IGN?", REQ_IGN, VISIBILITY_ALL_UNIQUE_IDENTIFIER, "IGN"],
    ["What is your age?", REQ_POS_NUMBER, VISIBILITY_REVIEW_ONLY, "Age"],
    ["Why do you want to join this server?", REQ_TEXT, VISIBILITY_NONE, "Reason for joining"],
    ["What rule do you value most when playing on an SMP?", REQ_TEXT, VISIBILITY_NONE, "Most valued rule"],
    ["What are some of your hobbies outside of minecraft?", REQ_TEXT, VISIBILITY_NONE, "Hobbies"],
    ["Are you a streamer or a YouTuber? If so include a link", REQ_TEXT, VISIBILITY_NONE, "Content creation"],
    ["How did you find the server? (Reddit/friend/website etc) If it's a friend, please specify who.", REQ_TEXT, VISIBILITY_NOTIFICATION_ONLY, "Referral"],
    ["Have you read and understood the rules?", REQ_TEXT, VISIBILITY_NONE, "Read rules"],
    ["Include any additional information or questions here", REQ_OPTIONAL_TEXT, VISIBILITY_NONE, "Additional information"]
]

export const shopquestions = [
    ["What is your IGN? If multiple people will share the shop, enter all names.", REQ_TINY_TEXT, VISIBILITY_ALL, "Shop owners"],
    ["What do you wish to sell?", REQ_TINY_TEXT, VISIBILITY_ALL, "Shop type"],
    ["What is your shop X coordinate?", REQ_ANY_NUMBER, VISIBILITY_ALL, "X"],
    ["What is your shop Z coordinate?", REQ_ANY_NUMBER, VISIBILITY_ALL, "Z"],
    ["I have read and I agree to the shop rules. I understand that I must initially stock within 24 hours, and that if my shop is unstocked for a week I will get a 7 day notice to stock it via Discord, after which the shop will be destroyed without notice.", REQ_AGREE, VISIBILITY_NONE, "Agree"]
]

export const mapquestions = [
    ["What is your base X coordinate?", REQ_ANY_NUMBER, VISIBILITY_ALL, "X"],
    ["What is your base Z coordinate?", REQ_ANY_NUMBER, VISIBILITY_ALL, "Z"],
]

export function getQuestions(questionSet: string) {
    if (questionSet === QUESTION_SET_APPLICATION) return applicationquestions
    if (questionSet === QUESTION_SET_SHOP) return shopquestions
    if (questionSet === QUESTION_SET_MAP) return mapquestions
    throw "invalid question set provided"
}

const inputTypes = [
    [REQ_IGN, "your IGN, which is composed of letters, numbers, and underscores"],
    [REQ_POS_NUMBER, "a number"],
    [REQ_ANY_NUMBER, "a number"],
    [REQ_TINY_TEXT, "a little bit of text (less than 50 characters)"],
    [REQ_TEXT, "some text (less than 800 characters)"],
    [REQ_OPTIONAL_TEXT, "some text or click the button to skip"],
    [REQ_OPTIONAL_TEXT, "'I agree' or click the button"],
    [REQ_AGREE, "'I agree' or click the button below"]
]

function inputTypeLookup(inputType: string): string {
    for (const item of inputTypes) {
        if (item[0] === inputType) return item[1]
    }
    return "unknown"
}

// looks up an application by the user that is currently being created
export function lookupApplication(discordId: string, applicationStatus: string = "creating"): InProgressApplication | undefined {
    if (applicationStatus == "*") return activeApplications.find(item => item.discordId === discordId)
    return activeApplications.find(item => item.discordId === discordId && item.applicationStatus == applicationStatus)
}

export function lookupApplicationByMessageSummaryId(messageId: string): InProgressApplication | undefined {
    return activeApplications.find(item => item.applicationSummaryId === messageId && item.applicationStatus == "active")
}

export function lookupApplicationByUniqueIdentifier(uniqueIdentifier: string): InProgressApplication | undefined {
    return activeApplications.find(item => item.uniqueIdentifier === uniqueIdentifier && item.applicationStatus == "active")
}

export function dismissApplication(uniqueIdentifier: string): string | null {
    const application = lookupApplicationByUniqueIdentifier(uniqueIdentifier)
    if (application == null) return null
    application.applicationStatus = "dismissed"
    return application.applicationSummaryId
}

export async function createApplication(user: DiscordJS.User, questionSet: string): Promise<string> {
    // check if there is already an application in progress
    let playerApplication = lookupApplication(user.id)
    if (playerApplication != null) {
        return "You already have an application in progress!"
    }

    // check if there is an active application being voted on
    playerApplication = lookupApplication(user.id, "active")
    if (playerApplication != null) {
        return "You have recently made an application, and the staff are still reviewing it."
    }

    const newApplication = new InProgressApplication(user.id, user.username, questionSet)
    activeApplications.push(newApplication)

    try {
        const dmSuccess = await dmUserQuestion(user, 0)

        if (dmSuccess) {
            // send notification to staff
            let notificationChannel = client.channels.cache.get(APPLICATION_NOTIFICATION_CHANNEL_ID)
            if (notificationChannel == null || !notificationChannel.isText()) {
                console.error(`NOTIFICATION CHANNEL NOT VALID OR NULL (jx0053)`)
                return "An error occurred while sending the DM. Please let a staff member know."
            }

            if (questionSet == QUESTION_SET_APPLICATION) {
                let notificationEmbed = new MessageEmbed()
                    .setTitle(`${escapeFormatting(user.username)} has started an application!`)
                    .setColor(`#f45858`)
                notificationChannel.send({embeds: [notificationEmbed]})
            }

            // send response to applicant
            return "I've sent you a DM! Fill in your answers there! Please let a staff member know if this does not work!"
        } else {
            newApplication.applicationStatus = "failed"
            return "I was unable to send you a DM! Please make sure you have DMs enabled from server members!"
        }
    } catch (error) {
        console.error(error)
        newApplication.applicationStatus = "exception"
        return "An error occurred while sending a DM. Please let a staff member know."
    }
}


export async function dmReceived(messageContent: string, messageAuthor: DiscordJS.User) {
    const currentApplication = lookupApplication(messageAuthor.id)
    if (currentApplication == null) return

    if (currentApplication.currentQuestionNo >= currentApplication.getQuestionSet().length) {
        await dmUserApplicationSubmissionConfirmation(messageAuthor)
        return
    }

    const answerValidation = await validateAnswer(messageContent, currentApplication.getQuestionSet()[currentApplication.currentQuestionNo][1])
    if (answerValidation == -1) {
        console.error(`answer validation exception! (jx0052)`)
        await messageAuthor.send(`An error occurred while validating your answer. Please let a staff member know.`)
        return
    }
    else if (answerValidation == 0) {
        await dmUserInvalidAnswer(messageAuthor, currentApplication.currentQuestionNo)
        return
    }
    else if (answerValidation == 2) {
        await messageAuthor.send(`No one has this IGN! Please check that you have a **non cracked Minecraft Java Edition account** and that you have typed your IGN correctly.`)
        return
    }

    currentApplication.answers[currentApplication.currentQuestionNo] = messageContent
    currentApplication.currentQuestionNo ++

    if (currentApplication.currentQuestionNo >= currentApplication.getQuestionSet().length) {
        await dmUserApplicationSubmissionConfirmation(messageAuthor)
        return
    }

    await dmUserQuestion(messageAuthor, currentApplication.currentQuestionNo)
}

// returns -1 for error
// returns 0 for fail
// returns 1 for success
// returns 2 for failed ign check
async function validateAnswer(text: string, rule: String): Promise<number> {
    if (rule === REQ_IGN) {
        text = unescapeFormatting(text) // removes any backslashes that may have been entered by the applicant
        const a = await usernameCheck(text) // test that supplied test exists on the Mojang database
        const b = verifyUsernameInput(text) // test that the supplied text matches the standard for usernames
        if (!a) {
            return 2
        }
        if (a && b) return 1
        return 0
    }
    else if (rule === REQ_POS_NUMBER) {
        const regex = new RegExp('^\\d+(\\.\\d)?\\d?$')
        const regexSuccess = regex.test(<string>text)
        if (regexSuccess) return 1
        return 0
    }
    else if (rule === REQ_ANY_NUMBER) {
        const regex = new RegExp('^-?\\d+(\\.\\d)?$')
        const regexSuccess = regex.test(<string>text)
        if (regexSuccess) return 1
        return 0
    }
    else if (rule === REQ_TEXT || rule === REQ_OPTIONAL_TEXT) {
        if (text.length <= 800) return 1
        return 0
    }
    else if (rule === REQ_TINY_TEXT) {
        if (text.length <= 50) return 1
        return 0
    }
    else if (rule === REQ_AGREE) {
        if (text.toLowerCase() == "i agree") return 1
        return 0
    }
    return -1
}

async function dmUserInvalidAnswer(user: DiscordJS.User, questionNo: number) {
    await user.send(`Invalid answer. Please try again.`)
    await dmUserQuestion(user, questionNo)
}

async function dmUserQuestion(user: DiscordJS.User, questionNo: number): Promise<boolean> {
    const playerApplication = lookupApplication(user.id)
    if (playerApplication == null) return false

    const inputDescription = inputTypeLookup(playerApplication.getQuestionSet()[questionNo][1])
    const currentUserInput = playerApplication.answers[questionNo]
    const embedDescription = currentUserInput === '' ? `Enter ${inputDescription}.` : `Your current answer: ${currentUserInput}\n\nEnter ${inputDescription}.`

    let questionContents = playerApplication.getQuestionSet()[questionNo][0]
    let questionPrefix = `Question ${questionNo + 1} of ${playerApplication.getQuestionSet().length}:`
    if (questionContents.length + questionPrefix.length <= 256) {
        questionContents = `${questionPrefix} ${questionContents}`
    }

    let questionEmbed = new MessageEmbed()
        .setTitle(questionContents)
        .setDescription(embedDescription)
        .setColor(`#10c1e0`)

    const messageActionRow = generateButtons(playerApplication, questionNo)

    try {
        await user.send({ embeds: [questionEmbed], components: [messageActionRow] })
        return true
    } catch (error) {
        console.error(error)
        return false
    }
}

async function dmUserApplicationSubmissionConfirmation(user: DiscordJS.User) {
    let submitEmbed = new MessageEmbed()
        .setTitle(`Would you like to submit these answers?`)
        .setColor(`#10c1e0`)

    const playerApplication = lookupApplication(user.id)
    if (playerApplication == null) return

    const messageActionRow = generateButtons(playerApplication, playerApplication.currentQuestionNo)

    await user.send({embeds: [submitEmbed], components: [messageActionRow]})
}

function generateButtons(playerApplication: InProgressApplication, questionNo: number): MessageActionRow {
    const messageActionRow = new MessageActionRow()

    if (questionNo < playerApplication.getQuestionSet().length && playerApplication.getQuestionSet()[questionNo][1] === REQ_OPTIONAL_TEXT) {
        const skipButton = new MessageButton()
            .setCustomId(`application,skip`)
            .setLabel(`⏭ Skip question`)
            .setStyle('SECONDARY')
        messageActionRow.addComponents(skipButton)
    }
    if (questionNo < playerApplication.getQuestionSet().length && playerApplication.getQuestionSet()[questionNo][1] === REQ_AGREE) {
        const skipButton = new MessageButton()
            .setCustomId(`application,agree`)
            .setLabel(`☑️ I agree`)
            .setStyle('SECONDARY')
        messageActionRow.addComponents(skipButton)
    }
    if (questionNo - 1 >= 0 && playerApplication.answers[questionNo - 1] != '') {
        const previousButton = new MessageButton()
            .setCustomId(`application,previous`)
            .setLabel(`⬅️ Previous question`)
            .setStyle('PRIMARY')
        messageActionRow.addComponents(previousButton)
    }
    if (playerApplication.answers.every(element => !!element)) {
        const submitButton = new MessageButton()
            .setCustomId(`application,submit`)
            .setLabel(`Submit application`)
            .setStyle('SUCCESS')
        messageActionRow.addComponents(submitButton)
    }
    if (questionNo + 1 < playerApplication.getQuestionSet().length && playerApplication.answers[questionNo] != '') {
        const nextButton = new MessageButton()
            .setCustomId(`application,next`)
            .setLabel(`Next question ➡️`)
            .setStyle('PRIMARY')
        messageActionRow.addComponents(nextButton)
    }
    const cancelButton = new MessageButton()
        .setCustomId(`application,cancel`)
        .setLabel(`Cancel application`)
        .setStyle('DANGER')
    messageActionRow.addComponents(cancelButton)
    return messageActionRow
}

export async function buttonGotoPreviousQuestion(user: DiscordJS.User) {
    const playerApplication = lookupApplication(user.id)
    if (playerApplication == null) return

    if (playerApplication.currentQuestionNo - 1 >= 0 && playerApplication.answers[playerApplication.currentQuestionNo - 1] != '') {
        playerApplication.currentQuestionNo --
        await dmUserQuestion(user, playerApplication.currentQuestionNo)
    }
}

export async function buttonGotoNextQuestion(user: DiscordJS.User) {
    const playerApplication = lookupApplication(user.id)
    if (playerApplication == null) return

    if (playerApplication.currentQuestionNo + 1 < playerApplication.getQuestionSet().length && playerApplication.answers[playerApplication.currentQuestionNo] != '') {
        playerApplication.currentQuestionNo ++
        await dmUserQuestion(user, playerApplication.currentQuestionNo)
    }
}

export async function buttonCancelApplication(user: DiscordJS.User) {
    const playerApplication = lookupApplication(user.id)
    if (playerApplication == null) {
        await user.send(`You don't have an application in progress.`)
    }
    else {
        playerApplication.applicationStatus = "cancelled"
        await user.send(`Your application has been cancelled.`)
    }
}

export async function buttonSkipQuestion(user: DiscordJS.User) {
    const playerApplication = lookupApplication(user.id)
    if (playerApplication == null) {
        await user.send(`You don't have an application in progress.`)
    }
    else if (playerApplication.getQuestionSet()[playerApplication.currentQuestionNo][1] === REQ_OPTIONAL_TEXT) {
        await dmReceived('N/A', user)
    }
}

export async function buttonAgreeQuestion(user: DiscordJS.User) {
    const playerApplication = lookupApplication(user.id)
    if (playerApplication == null) {
        await user.send(`You don't have an application in progress.`)
    }
    else if (playerApplication.getQuestionSet()[playerApplication.currentQuestionNo][1] === REQ_AGREE) {
        await dmReceived('I agree', user)
    }
}

export async function buttonPostApplication(user: DiscordJS.User) {
    const playerApplication = lookupApplication(user.id)
    if (playerApplication == null) {
        await user.send(`You don't have an application in progress.`)
        return
    }

    if (!playerApplication.answers.every(element => !!element)) {
        await user.send(`You have not completed your application yet.`)
        return
    }

    let application = ""

    for (let i = 0; i < playerApplication.getQuestionSet().length; i++) {
        application += `${playerApplication.getQuestionSet()[i][0]}:\n${playerApplication.answers[i]}\n\n`
    }

    let finalApplicationEmbed = new MessageEmbed()
        .setTitle(`New ${SERVER_NAME} Application`)
        .setDescription(application)
        .setFooter({text: `Applicant: ${user.username}\nID: ${user.id}`})
        .setColor(`#ff1541`)

    let appChannel: DiscordJS.AnyChannel | undefined
    if (playerApplication.questionSet == QUESTION_SET_APPLICATION) appChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID)
    else if (playerApplication.questionSet == QUESTION_SET_SHOP) appChannel = client.channels.cache.get(APPLICATION_SHOP_CHANNEL_ID)
    else if (playerApplication.questionSet == QUESTION_SET_MAP) appChannel = client.channels.cache.get(APPLICATION_MAP_FORM_CHANNEL_ID)

    if (appChannel == null || !appChannel.isText()) {
        console.log(`Supplied application channel is not valid`)
    } else {
        await appChannel.send({embeds: [finalApplicationEmbed]}).then(message => {
            playerApplication.applicationMessageId = message.id
            playerApplication.applicationMessageUrl = message.url
        })
    }

    playerApplication.submittedTimestamp = Date.now()
    await processNewApplication(playerApplication)

    playerApplication.applicationStatus = "active"
    await user.send(`Your answers have been submitted.`)

    console.info("APPLICATION SUBMITTED")
}