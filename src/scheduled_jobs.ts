import {
    APPLICATION_CHANNEL_ID, APPLICATION_MAX_REMIND_TIMES,
    APPLICATION_NOTIFICATION_CHANNEL_ID,
    APPLICATION_SERVER_ID,
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

var jacques: string = "252818596777033729"
var schrute: string = "699331874408890378"

//every day at 7am
export async function sleepyTime() {
    console.log(`sleepytime task @ ${new Date().toISOString()}`)
    let holidayhome = await client.guilds.fetch("885542685090410586")
    let juser = await holidayhome.members.fetch(jacques)
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
    let appChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID)
    const applicationVotingChannel = client.channels.cache.get(APPLICATION_VOTING_CHANNEL_ID)
    if (applicationVotingChannel == null || !(applicationVotingChannel instanceof TextChannel)) {
        console.error(`APPLICATION NOTIFICATION CHANNEL NULL (jx0047)`)
        return
    }
    if (applicationGuild == null) {
        console.error(`APPLICATION GUILD OR MAIN GUILD NULL (jx0045)`)
        return
    }
    if (appChannel == null || !appChannel.isText()) {
        console.error(`APP CHANNEL NOT VALID NULL (jx0048)`)
        return
    }

    for (const application of activeApplications) {
        // check if it has been enough time to send a reminder
        const currentTime = new Date().getTime()
        const timeDifferenceMilliseconds = currentTime - application.lastNotificationDatetime.getTime()
        const timeDifferenceHours = timeDifferenceMilliseconds / 1000 / 60 / 60
        if (timeDifferenceHours >= APPLICATION_VOTE_REMINDER_THRESHOLD_HOURS) {
            // check who has reacted/voted so far
            let message = appChannel.messages.cache.get(application.applicationMessageId)
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
            if (application.remindedCount > APPLICATION_MAX_REMIND_TIMES) continue
            else if (application.remindedCount == APPLICATION_MAX_REMIND_TIMES) {
                await applicationVotingChannel.send(`FINAL REMINDER: Voting for ${escapeFormatting(application.name)} is still open! [Application Link](${application.url})${unvotedMembersString}`)
            } else {
                await applicationVotingChannel.send(`Voting for ${escapeFormatting(application.name)} is still open! [Application Link](${application.url})${unvotedMembersString}`)
            }

            application.lastNotificationDatetime = new Date()
            application.remindedCount++
        }
    }
}


const millsecondsInDay = 1000 * 60 * 60 * 27

async function removeApplicationMembers() {
    const applicationGuild = client.guilds.cache.get(APPLICATION_SERVER_ID)
    const mainGuild = client.guilds.cache.get(MAIN_SERVER_ID)
    if (applicationGuild == null || mainGuild == null) {
        console.error(`APPLICATION GUILD OR MAIN GUILD NULL (jx0043)`)
        return
    }
    applicationGuild.members.cache.forEach(member => {
            if (member.joinedTimestamp == null) {
                sendApplicationNotification(`${member.user.username} doesn't have a joined timestamp! @Jacques`)
            } else {
                let daysJoined = (Date.now() - member.joinedTimestamp) / millsecondsInDay
                daysJoined = Math.round(daysJoined)
                console.log(`${member.user.username} joined at ${member.joinedTimestamp} - ${daysJoined} Days ago`)
                // if the user has no roles (not staff) and has been in the server for 30 days (applicants) or 3 days (in the main server) kick them
                if (member.roles.cache.size <= 1 && (daysJoined >= 30 || (daysJoined >=3 && mainGuild.members.fetch(member.id)))) {
                    console.log(`${member.user.username} has ${member.roles.cache.size} roles: ${JSON.stringify(member.roles.cache)}`)
                    sendApplicationNotification(`${member.user.username} joined ${daysJoined} Days ago and is being kicked for inactivity`)
                    member.kick(`${member.user.username} joined ${daysJoined} Days ago and is being kicked for inactivity`)
                }
            }
        }
    )
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