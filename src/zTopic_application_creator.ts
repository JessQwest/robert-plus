import * as DiscordJS from "discord.js"
import {unescapeFormatting, verifyUsernameInput} from "./utility"
import {MessageActionRow, MessageButton, MessageEmbed, TextChannel} from "discord.js"
import {
    APPLICATION_CHANNEL_ID,
    APPLICATION_NOTIFICATION_CHANNEL_ID,
    APPLICATION_VOTING_CHANNEL_ID,
    client,
    SERVER_NAME
} from "./index"
import {usernameCheck} from "./api"

class InProgressApplication {
    public discordId: string
    public startTimestamp: number
    public currentQuestionNo: number = 0
    public answers: string[] = []
    public applicationStatus = "active"
    constructor(discordId: string) {
        this.discordId = discordId
        this.startTimestamp = Math.floor(Date.now() / 1000)
        this.currentQuestionNo = 0
        this.answers = []
        for (let i = 0; i < questions.length; i++) {
            this.answers.push('')
        }
    }
}

const questions = [
    ["What is your Minecraft IGN?", "IGN"],
    ["What is your age?", "NUMBER"],
    ["Why do you want to join this server?", "TEXT"],
    ["What rule do you value most when playing on an SMP?", "TEXT"],
    ["What are some of your hobbies outside of minecraft?", "TEXT"],
    ["Are you a streamer or a YouTuber? If so include a link", "TEXT"],
    ["How did you find the server? (Reddit/friend/website etc) If it's a friend, please specify who.", "TEXT"],
    ["Have you read and understood the rules?", "TEXT"],
    ["Include any additional information or questions here", "OPTIONAL_TEXT"]
]

const inputTypes = [
    ["IGN", "your IGN, which is composed of letters, numbers, and underscores"],
    ["NUMBER", "a number"],
    ["TEXT", "some text (less than 800 characters)"],
    ["OPTIONAL_TEXT", "some text or click the button to skip"]
]

function inputTypeLookup(inputType: string): string {
    for (const item of inputTypes) {
        if (item[0] === inputType) return item[1]
    }
    return "unknown"
}

function lookupApplication(discordId: string): InProgressApplication | undefined {
    return inProgressApplications.find(item => item.discordId === discordId && item.applicationStatus == "active")
}

let inProgressApplications: InProgressApplication[] = []

export async function createApplication(user: DiscordJS.User): Promise<string> {
    const playerApplication = lookupApplication(user.id)
    if (playerApplication != null) {
        return "You already have an application in progress!"
    }

    const newApplication = new InProgressApplication(user.id)
    inProgressApplications.push(newApplication)

    try {
        const dmSuccess = await dmUserQuestion(user, 0)

        if (dmSuccess) {
            // send notification to staff
            let notificationChannel = client.channels.cache.get(APPLICATION_NOTIFICATION_CHANNEL_ID)
            if (notificationChannel == null || !notificationChannel.isText()) {
                console.error(`NOTIFICATION CHANNEL NOT VALID OR NULL (jx0053)`)
                return "An error occurred while sending the DM. Please let a staff member know."
            }

            let notificationEmbed = new MessageEmbed()
                .setTitle(`${user.username} has started an application!`)
                .setColor(`#f45858`)
            notificationChannel.send({embeds: [notificationEmbed]})

            // send response to applicant
            return "I've sent you a DM! Start your application there! Please let a staff member know if this does not work!"
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

    if (currentApplication.currentQuestionNo >= questions.length) {
        await dmUserApplicationSubmissionConfirmation(messageAuthor)
        return
    }

    const answerValidation = await validateAnswer(messageContent, questions[currentApplication.currentQuestionNo][1])
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

    if (currentApplication.currentQuestionNo >= questions.length) {
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
    if (rule === "IGN") {
        text = unescapeFormatting(text)
        const a = await usernameCheck(text)
        const b = await verifyUsernameInput(text)
        if (!a) {
            return 2
        }
        if (a && b) return 1
        return 0
    }
    else if (rule === "NUMBER") {
        const regex = new RegExp('^\\d+(\\.\\d)?\\d?$')
        const regexSuccess = regex.test(<string>text)
        if (regexSuccess) return 1
        return 0
    }
    else if (rule === "TEXT" || rule === "OPTIONAL_TEXT") {
        if (text.length < 800) return 1
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

    const inputDescription = inputTypeLookup(questions[questionNo][1])
    const currentUserInput = playerApplication.answers[questionNo]
    const embedDescription = currentUserInput === '' ? `Enter ${inputDescription}.` : `Your current answer: ${currentUserInput}\n\nEnter ${inputDescription}.`

    let questionEmbed = new MessageEmbed()
        .setTitle(`Question ${questionNo + 1} of ${questions.length}: ${questions[questionNo][0]}`)
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
        .setTitle(`Would you like to submit your application?`)
        .setColor(`#10c1e0`)

    const playerApplication =  lookupApplication(user.id)
    if (playerApplication == null) return

    const messageActionRow = generateButtons(playerApplication, playerApplication.currentQuestionNo)

    await user.send({embeds: [submitEmbed], components: [messageActionRow]})
}

function generateButtons(playerApplication: InProgressApplication, questionNo: number): MessageActionRow {
    const messageActionRow = new MessageActionRow()

    if (questionNo < questions.length && questions[questionNo][1] === "OPTIONAL_TEXT") {
        const skipButton = new MessageButton()
            .setCustomId(`application,skip`)
            .setLabel(`⏭ Skip question`)
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
    if (questionNo + 1 < questions.length && playerApplication.answers[questionNo] != '') {
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
    const playerApplication =  lookupApplication(user.id)
    if (playerApplication == null) return

    if (playerApplication.currentQuestionNo - 1 >= 0 && playerApplication.answers[playerApplication.currentQuestionNo - 1] != '') {
        playerApplication.currentQuestionNo --
        await dmUserQuestion(user, playerApplication.currentQuestionNo)
    }
}

export async function buttonGotoNextQuestion(user: DiscordJS.User) {
    const playerApplication =  lookupApplication(user.id)
    if (playerApplication == null) return

    if (playerApplication.currentQuestionNo + 1 < questions.length && playerApplication.answers[playerApplication.currentQuestionNo] != '') {
        playerApplication.currentQuestionNo ++
        await dmUserQuestion(user, playerApplication.currentQuestionNo)
    }
}

export async function buttonCancelApplication(user: DiscordJS.User) {
    const playerApplication =  lookupApplication(user.id)
    if (playerApplication == null) {
        await user.send(`You don't have an application in progress.`)
    }
    else {
        playerApplication.applicationStatus = "cancelled"
        await user.send(`Your application has been cancelled.`)
    }
}

export async function buttonSkipQuestion(user: DiscordJS.User) {
    const playerApplication =  lookupApplication(user.id)
    if (playerApplication == null) {
        await user.send(`You don't have an application in progress.`)
    }
    else if (questions[playerApplication.currentQuestionNo][1] === "OPTIONAL_TEXT") {
        await dmReceived('N/A', user)
    }
}

export async function buttonPostApplication(user: DiscordJS.User) {
    const playerApplication =  lookupApplication(user.id)
    if (playerApplication == null) {
        await user.send(`You don't have an application in progress.`)
        return
    }

    if (!playerApplication.answers.every(element => !!element)) {
        await user.send(`You have not completed your application yet.`)
        return
    }

    let application = ""

    for (let i = 0; i < questions.length; i++) {
        application += `${questions[i][0]}:\n${playerApplication.answers[i]}\n\n`
    }

    let finalApplicationEmbed = new MessageEmbed()
        .setTitle(`New ${SERVER_NAME} Application`)
        .setDescription(application)
        .setFooter({text: `Applicant: ${user.username}\nID: ${user.id}`})
        .setColor(`#ff1541`)

    let appChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID)
    if (appChannel == null || !appChannel.isText()) {
        console.error(`APP CHANNEL NOT VALID NULL (jx0049)`)
        return
    }

    appChannel.send({embeds: [finalApplicationEmbed]})
    playerApplication.applicationStatus = "submitted"
    await user.send(`Your application has been submitted.`)

    console.info("APPLICATION SUBMITTED")
}