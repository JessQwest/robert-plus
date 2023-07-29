import {
    APPLICATION_NOTIFICATION_CHANNEL_ID,
    APPLICATION_SERVER_ID, BOT_INFO_CHANNEL_ID,
    client,
    MAIN_SERVER_ID, MUSEUM_ROLE_ID
} from "./index"
import {TextChannel} from "discord.js"

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

export async function housekeepTask() {
    await removeApplicationMembers()
    await removeMuseumDayPasses()
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