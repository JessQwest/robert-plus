import {ALERT_CHANNEL, APPLICATION_NOTIFICATION_CHANNEL_ID, APPLICATION_SERVER_ID, client, con} from "./index"
import {TextChannel} from "discord.js"

var jacques : string = "252818596777033729"
var schrute : string = "699331874408890378"
//every day at 7am
export async function sleepyTime() {
    console.log('sleepytime task')
    let holidayhome = await client.guilds.fetch("885542685090410586")
    let juser = await holidayhome.members.fetch(jacques)
    let suser = await holidayhome.members.fetch(schrute)
    await juser.voice.disconnect()
    await suser.voice.disconnect()
}

export async function housekeepTask() {
    await removeApplicationMembers()
}

const millsecondsInDay = 1000 * 60 * 60 * 27
async function removeApplicationMembers() {
    const list = client.guilds.cache.get(APPLICATION_SERVER_ID)
    if (list == null) return
    list.members.cache.forEach(member => {
            if (member.joinedTimestamp == null) {
                sendApplicationNotification(`${member.user.username} doesn't have a joined timestamp! @Jacques`)
            }
            else {
                let daysJoined = (Date.now() - member.joinedTimestamp) / millsecondsInDay
                daysJoined = Math.round(daysJoined)
                console.log(`${member.user.username} joined at ${member.joinedTimestamp} - ${daysJoined} Days ago`)
                if (daysJoined >= 30 && member.roles.cache.size <= 1) {
                    console.log(`${member.user.username} has ${member.roles.cache.size} roles: ${JSON.stringify(member.roles.cache)}`)
                    sendApplicationNotification(`${member.user.username} joined ${daysJoined} Days ago and is being kicked for inactivity`)
                    member.kick(`${member.user.username} joined ${daysJoined} Days ago and is being kicked for inactivity`)
                }
            }
        }
    )
}

async function sendApplicationNotification(contents: string) {
    console.log(contents)
    let channel = client.channels.cache.get(APPLICATION_NOTIFICATION_CHANNEL_ID)
    if (channel == null){
        console.error(`NOTIFICATION CHANNEL NULL (jx0029)`)
        throw "NOTIFICATION CHANNEL NULL"
    }
    else if (!(channel instanceof TextChannel)) {
        console.error(`NOTIFICATION CHANNEL NOT TEXT CHANNEL (jx0030)`)
        throw "NOTIFICATION CHANNEL NOT TEXT CHANNEL"
    }
    channel.send(contents)
}