import {
    APPLICATION_MAX_REMIND_TIMES,
    APPLICATION_NOTIFICATION_CHANNEL_ID,
    APPLICATION_SERVER_ID, APPLICATION_SHOP_NOTIFICATION_CHANNEL_ID, APPLICATION_SHOP_VOTING_CHANNEL_ID,
    APPLICATION_VOTE_REMINDER_THRESHOLD_HOURS, APPLICATION_VOTER_ROLE_ID,
    APPLICATION_VOTING_CHANNEL_ID,
    BOT_INFO_CHANNEL_ID,
    client,
    MAIN_SERVER_ID,
    MUSEUM_ROLE_ID
} from "./index"
import {TextChannel} from "discord.js"
import {activeApplications} from "./zTopic_application_management"
import {escapeFormatting} from "./utility"
import {
    QUESTION_SET_APPLICATION,
    QUESTION_SET_SHOP,
    VISIBILITY_ALL_UNIQUE_IDENTIFIER
} from "./zTopic_application_creator"
import * as DiscordJS from "discord.js"

var Jessica: string = "252818596777033729"
var schrute: string = "699331874408890378"

//every day at 7am
export async function sleepyTime() {
    console.log(`sleepytime task @ ${new Date().toISOString()}`)
    let holidayhome = await client.guilds.fetch("885542685090410586")
    let juser = await holidayhome.members.fetch(Jessica)
    let suser = await holidayhome.members.fetch(schrute)
    await juser.voice.disconnect()
    await suser.voice.disconnect()
}

export async function hourlyHousekeepTask() {
    await postApplicationVotingReminder()
}

export async function dailyHousekeepTask() {
    await removeApplicationMembers()
    await removeMuseumDayPasses()
}

async function postApplicationVotingReminder() {
    const applicationGuild = client.guilds.cache.get(APPLICATION_SERVER_ID)

    if (applicationGuild == null) {
        console.error(`APPLICATION GUILD OR MAIN GUILD NULL (jx0045)`)
        return
    }

    const applicationsForReminder = activeApplications.filter(a => a.applicationStatus == "active")

    for (const application of applicationsForReminder) {
        // check if it has been enough time to send a reminder
        const currentTime = new Date().getTime()
        const timeDifferenceMilliseconds = currentTime - application.lastNotificationDatetime.getTime()
        const timeDifferenceHours = timeDifferenceMilliseconds / 1000 / 60 / 60
        if (timeDifferenceHours >= APPLICATION_VOTE_REMINDER_THRESHOLD_HOURS) {
            // get the right channel to post in
            let applicationChannel: DiscordJS.AnyChannel | undefined
            if (application.questionSet == QUESTION_SET_APPLICATION) {
                applicationChannel = client.channels.cache.get(APPLICATION_VOTING_CHANNEL_ID)
            } else if (application.questionSet == QUESTION_SET_SHOP) {
                applicationChannel = client.channels.cache.get(APPLICATION_SHOP_VOTING_CHANNEL_ID)
            }
            if (applicationChannel == null || !(applicationChannel instanceof TextChannel)) {
                console.error(`APPLICATION NOTIFICATION CHANNEL NULL (jx0047)`)
                continue
            }

            // check who has reacted/voted so far
            let message = applicationChannel.messages.cache.get(application.applicationSummaryId)
            if (message == null) continue
            let reactionIds: String[] = []
            message.reactions.cache.forEach(r => {
                r.users.cache.forEach(u => {
                    reactionIds.push(u.id)
                })
            })
            // get all the members with the voting role that have not voted yet
            let unvotedMembersString = ""
            const role = await applicationGuild.roles.fetch(APPLICATION_VOTER_ROLE_ID)
            if (role) {
                const allMembers = role.members
                let unvotedMemberIds = allMembers.filter(m => !reactionIds.includes(m.id))
                let unvotedMemberUsernames = unvotedMemberIds.map(m => m.user.username)
                if (unvotedMemberIds.size > 0) {
                    unvotedMembersString = `\n\nThe following staff have not voted yet: ${unvotedMemberUsernames.join(", ")}`
                }
            } else {
                console.error(`APPLICATION VOTER ROLE NULL (jx0046)`)
            }

            // depending on how many times the reminder has been sent before, alter the message (or don't send it at all)
            let voteReminderString = ""
            if (application.remindedCount > APPLICATION_MAX_REMIND_TIMES) continue
            else if (application.remindedCount == APPLICATION_MAX_REMIND_TIMES) {
                voteReminderString = `FINAL REMINDER: `
            }

            // build links for voting
            let isApplicationLink: boolean = application.applicationMessageUrl != ""
            let isVotingLink: boolean = application.applicationSummaryUrl != ""
            let votingLinkString = ""
            if (isApplicationLink) votingLinkString += `[Application Link](${application.applicationMessageUrl})`
            if (isApplicationLink && isVotingLink) votingLinkString += " | "
            if (isVotingLink) votingLinkString += `[Voting Link](${application.applicationSummaryUrl})`

            // get name for voting
            let name: string = ""
            if (application.questionSet == QUESTION_SET_APPLICATION) name = application.uniqueIdentifier
            else if (application.questionSet == QUESTION_SET_SHOP) name = application.answers[0]

            voteReminderString += `Voting for ${escapeFormatting(name)} is still open! ${votingLinkString}${unvotedMembersString}`
            await applicationChannel.send(voteReminderString)

            application.lastNotificationDatetime = new Date()
            application.remindedCount++
        }
    }
}


const millisecondsInDay = 1000 * 60 * 60 * 27

async function removeApplicationMembers() {
    const applicationGuild = client.guilds.cache.get(APPLICATION_SERVER_ID)
    const mainGuild = client.guilds.cache.get(MAIN_SERVER_ID)
    if (applicationGuild == null || mainGuild == null) {
        console.error(`APPLICATION GUILD OR MAIN GUILD NULL (jx0043)`)
        return
    }
    for (const memberClump of applicationGuild.members.cache) {
            let member = memberClump[1]
            if (member.joinedTimestamp == null) {
                await sendApplicationNotification(`${member.user.username} doesn't have a joined timestamp! @Jessica`)
            } else {
                let daysJoined = (Date.now() - member.joinedTimestamp) / millisecondsInDay
                daysJoined = Math.round(daysJoined)
                console.log(`${member.user.username} joined at ${member.joinedTimestamp} - ${daysJoined} days ago`)
                // if the user has no roles (not staff) and has been in the server for 30 days (applicants) or 3 days (in the main server) kick them
                let kickReason = ""
                let otherUser
                if (await mainGuild.members.cache.get(member.id)) {
                    console.log(`${member.user.username} is in the main guild`)
                    otherUser = await mainGuild.members.fetch(member.id)
                }
                if (member.roles.cache.size <= 1 && daysJoined >= 30) kickReason = `${escapeFormatting(member.user.username)} joined ${daysJoined} days ago and is being kicked for inactivity.`
                else if (member.roles.cache.size <= 1 && daysJoined >= 3 && otherUser != null) kickReason = `${escapeFormatting(member.user.username)} joined ${daysJoined} days ago and is being kicked as they are in the main server.`
                console.log(kickReason)
                if (kickReason != "") {
                    console.log(`Kicking ${member.user.username}. Days joined: ${daysJoined} kick reason: ${kickReason}`)
                    await sendApplicationNotification(kickReason)
                    member.kick(kickReason)
                }
            }
        }
}

async function removeMuseumDayPasses() {
    var infochannel = await client.channels.cache.get(BOT_INFO_CHANNEL_ID)
    if (infochannel == null || !(infochannel instanceof TextChannel)) return
    const mainGuild = client.guilds.cache.get(MAIN_SERVER_ID)
    if (mainGuild == null) return
    mainGuild.members.cache.forEach(member => {
        // if member has museum day pass role
        if (member.roles.cache.has(MUSEUM_ROLE_ID)) {
            //remove the role
            member.roles.remove(MUSEUM_ROLE_ID)
            // and log it in bot info channel
            if (infochannel != null && infochannel instanceof TextChannel)
                infochannel.send(`${member.user.username} has had their museum day pass removed`)
        }
    })
}

async function sendApplicationNotification(contents: string) {
    console.log(contents)
    let channel = client.channels.cache.get(APPLICATION_NOTIFICATION_CHANNEL_ID)
    if (channel == null) {
        console.error(`NOTIFICATION CHANNEL NULL (jx0029)`)
        throw "NOTIFICATION CHANNEL NULL"
    } else if (!(channel instanceof TextChannel)) {
        console.error(`NOTIFICATION CHANNEL NOT TEXT CHANNEL (jx0030)`)
        throw "NOTIFICATION CHANNEL NOT TEXT CHANNEL"
    }
    channel.send(contents)
}