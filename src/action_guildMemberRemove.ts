import * as DiscordJS from "discord.js"
import {con, DEBUGMODE} from "./index"
import {Client} from "discord.js"
import {uuidToUsername} from "./api"

export function guildMemberRemove(client: Client, member: DiscordJS.GuildMember | DiscordJS.PartialGuildMember) {
    console.log(`guildMemberRemove triggered`)

    console.log("Guild Member has left a server")
    var channelToLog: string = "706923005132931141"
    var guildToCheck: string = "706923004285812849"
    if (DEBUGMODE){
        guildToCheck = "772844397020184576"
        channelToLog = "970336504364818452"
    }
    console.log(`Member left guild with ID: ${member.guild.id}. ID to monitor: ${guildToCheck}`)
    if(member.guild.id == guildToCheck){
        console.log("Member has left the monitored server. Attempting to unwhitelist")
        con.query(`SELECT minecraftUuid FROM accountLinking WHERE discordId = '` + member.id + "'", async function (err: any, result: any, fields: any) {
            for (var sqlItem of result) {
                var mcId = sqlItem['minecraftUuid']
                let name = await uuidToUsername(mcId)
                console.log(`mcId to unwhitelist = ${mcId} name = ${name}`)
                // @ts-ignore
                client.channels.cache.get(channelToLog).send(`PLAYER LEFT, UNWHITELISTED ${name}`)
                con.query(`DELETE FROM whitelist WHERE name = '` + name + `' or uuid = '` + mcId + "'", function (err: any, result: any, fields: any) {
                    console.log(`deleted whitelist entries: ${result.affectedRows} records`)
                })
            }
        })
    }
}