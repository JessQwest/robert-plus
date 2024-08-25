import * as DiscordJS from "discord.js"
import {
    con,
    DEBUG_SERVER_ID,
    DEBUGMODE,
    MAIN_SERVER_ID,
    STAFF_BOT_LOG_CHANNEL_ID
} from "./index"
import {Client, MessageEmbed, TextChannel} from "discord.js"
import {uuidToUsername} from "./api"

export function guildMemberRemove(client: Client, member: DiscordJS.GuildMember | DiscordJS.PartialGuildMember) {
    console.log(`guildMemberRemove triggered`)

    console.log("Guild Member has left a server")
    const loggingChannel = client.channels.cache.get(STAFF_BOT_LOG_CHANNEL_ID)
    const guildToCheck: string = DEBUGMODE ? DEBUG_SERVER_ID : MAIN_SERVER_ID
    console.log(`Member left guild with ID: ${member.guild.id}. Guild ID to monitor: ${guildToCheck}`)

    if(member.guild.id == guildToCheck) {
        console.log("Member has left the monitored server. Attempting to unwhitelist")
        con.query(`SELECT minecraftUuid FROM accountLinking WHERE discordId = ?`, [member.id], async function (err: any, result: any, fields: any) {
            for (let sqlItem of result) {
                const mcUuid = sqlItem['minecraftUuid']
                const mcUsername = await uuidToUsername(mcUuid)
                console.log(`mcUuid to unwhitelist = ${mcUuid}, name = ${mcUsername}`)

                const departureEmbed = new MessageEmbed()
                    .setColor('#ff0000')
                    .setTitle(':warning: Player Left')
                    .setDescription(`Player \`${mcUsername}\` has left the server. Removing them from the whitelist.`)

                if (loggingChannel instanceof TextChannel) loggingChannel.send({embeds: [departureEmbed]})

                con.query(`DELETE FROM whitelist WHERE name = '` + mcUsername + `' or uuid = '` + mcUuid + "'", function (err: any, result: any, fields: any) {
                    console.log(`deleted whitelist entries: ${result.affectedRows} records`)
                })
            }
        })
    }
}