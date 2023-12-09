import {addDashesToUuid, countCharacterChanges, getDiscordDisplayName} from "./utility"
import {
    BIRTHDAY_MESSAGE_CHANNEL_ID,
    BIRTHDAY_ROLE_ID,
    client,
    con,
    lpcon,
    STAFF_BOT_LOG_CHANNEL_ID
} from "./index"
import {Client, GuildMember, PartialGuildMember, Role, TextChannel} from "discord.js"
import {discordIdToMinecraftUuid} from "./api"

// ranks - [discordRoleId, nameOfRank, allowsColorChange]
// note that netherite rank is there twice, once for standard netherite and once for netherite giftee
const ranks = [["718434756496326657", "gold", 0], ["720848078264991765", "emerald", 0], ["710713981186211870", "diamond", 1], ["804897967374860288", "netherite", 1], ["1076240598232739854", "netherite", 1], ["801826957041860638", "birthday", 0]]
const colors = [
    "905473389592993882",
    "905475025786785822",
    "905474168043208725",
    "905474890927312998",
    "905476443776118824",
    "905476781845409812",
    "905473758238752818",
    "905473609663930438",
    "905473670590378014",
    "905476317712101467",
    "905475376954900481",
    "905474718126182431",
    "905475138626134047",
    "905474465708802139",
    "905474277636194367",
    "905473838668734526",
    "905474360486289408",
    "905476521836294214",
    "905473542307610645",
    "905475825313386496"]

export async function guildMemberUpdate(client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {

    console.log(`Guild member update for Discord ID: ${oldMember.id}`)

    const mcUuid: string = await discordIdToMinecraftUuid(oldMember.id) ?? "N/A"
    
    console.log(`Role changed for minecraft UUID: ${mcUuid}`)
    // Old roles Collection is higher in size than the new one. A role has been removed.
    if (oldMember.roles.cache.size > newMember.roles.cache.size) {
        await userRoleRemoved(oldMember, newMember, mcUuid)
    } else if (oldMember.roles.cache.size < newMember.roles.cache.size) {
        await userRoleAdded(oldMember, newMember, mcUuid)
    }
}

async function userRoleRemoved(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, mcUuid: string) {
    await checkUserColor(newMember)
    oldMember.roles.cache.forEach(role => {
        if (!newMember.roles.cache.has(role.id)) {
            console.log("Role Removed", role.id)
            removeMinecraftUserRole(role, newMember, mcUuid)
        }
    })
}

async function userRoleAdded(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, mcUuid: string) {
    newMember.roles.cache.forEach(role => {
        if (!oldMember.roles.cache.has(role.id)) {
            console.log("Role Added", role.id)
            // send happy birthday message if applicable
            if (role.id == `${BIRTHDAY_ROLE_ID}`) {
                console.log(`Saying happy birthday to ${newMember.user.username}`)
                const bdayChannel = client.channels.cache.get(BIRTHDAY_MESSAGE_CHANNEL_ID) as TextChannel
                const nickname = newMember.displayName
                const username = newMember.user.username
                const bdayName = countCharacterChanges(nickname, username) >= 4 ? `${nickname}/${username}` : nickname
                bdayChannel.send(`Happy Birthday to ${bdayName}!`)
            }
            addMinecraftUserRole(role, newMember, mcUuid)
        }
    })
}

async function addMinecraftUserRole(role: Role, newMember: GuildMember, mcUuid: string) {
    const dashedMcUuid = addDashesToUuid(mcUuid)
    const channel = await client.channels.cache.get(STAFF_BOT_LOG_CHANNEL_ID)
    for (const rank of ranks) {
        if (rank[0] == role.id) {
            console.log(`Reporting role gain to channel with id ${STAFF_BOT_LOG_CHANNEL_ID} & mcUuid = ${dashedMcUuid} discordId ${newMember.id}`)
            con.query('INSERT INTO rolelog (discordID, roleName, added) VALUES (?,?,"1")', [newMember.id, rank[1]], function (err: any, result: any, fields: any) {
                if (err) throw err
                console.log("added entry into database")
            })
            lpcon.query(`INSERT INTO luckperms_user_permissions (uuid, permission, value, server, world, expiry, contexts)
                    SELECT ?, ?, 1, 'global', 'global', 0, '{}'
                    FROM dual
                    WHERE NOT EXISTS (
                      SELECT * 
                      FROM luckperms_user_permissions 
                      WHERE uuid = ? AND permission = ?
                    )`, [dashedMcUuid, `group.${rank[1]}`, dashedMcUuid, `group.${rank[1]}`], function (err: any, result: any, fields: any) {
                if (result) {
                    console.log(`added ${result.affectedRows}`)
                    if (result.affectedRows >= 1 && channel != undefined && channel instanceof TextChannel) {
                        channel.send(`Added in game role ${role.name} to ${getDiscordDisplayName(newMember.user)}`)
                    }
                } else {
                    console.log(`No rows deleted`)
                }
            })
        }
    }
}

async function removeMinecraftUserRole(role: Role, newMember: GuildMember, mcUuid: string) {
    if (mcUuid == "N/A") return
    const dashedMcUuid = addDashesToUuid(mcUuid)
    const channel = await client.channels.cache.get(STAFF_BOT_LOG_CHANNEL_ID)
    // remove role alert
    console.log("Role Removed", role.id)
    // remove minecraft role
    for (const rank of ranks) {
        // check if lost role is a minecraft rank
        if (rank[0] == role.id) {
            // recording role loss to database
            console.log(`Reporting role loss to channel with id ${STAFF_BOT_LOG_CHANNEL_ID} & mcUuid = ${mcUuid}`)
            con.query('INSERT INTO rolelog (discordID, roleName, added) VALUES (?,?,"0")', [newMember.id, rank[1]], function (err: any, result: any, fields: any) {
                if (err) throw err
                console.log("added entry into database")
            })
            // loops through the ranks again checking for alt rank
            for (const altRank in ranks) {
                // if the id is different (confirming its a different result) but the names are the same and the player still has the other rank
                if (altRank[0] != rank[0] && altRank[1] == rank[1] && newMember.roles.cache.has(altRank[0])) {
                    console.log(`User has alt rank ${altRank[1]}`)
                    return
                }
            }

            // remove any custom colours
            lpcon.query(`DELETE FROM luckperms_user_permissions WHERE uuid = ? AND permission LIKE 'prefix%';`, [dashedMcUuid], function (err: any, result: any, fields: any) {
                if (result) {
                    console.log(`deleted ${result.affectedRows} prefixes`)
                } else {
                    console.log(`No prefixes deleted`)
                }
            })

            // remove the rank
            lpcon.query(`DELETE FROM luckperms_user_permissions WHERE replace(uuid,"-","") = ? AND permission = ?`, [mcUuid, 'group.' + rank[1]], function (err: any, result: any, fields: any) {
                if (result) {
                    console.log(`deleted ${result.affectedRows} roles`)
                    if (result.affectedRows >= 1 && channel != undefined && channel instanceof TextChannel) {
                        channel.send(`Removed in game role ${role.name} from ${getDiscordDisplayName(newMember.user)}`)
                    }
                } else {
                    console.log(`No rows deleted`)
                }
            })
            return
        }
    }
}

// check if the member has a color role but no valid rank to go with that role
function checkUserColor(member: GuildMember) {
    const channel = client.channels.cache.get(STAFF_BOT_LOG_CHANNEL_ID)

    // get all the ranks that allow color changing into a string array
    const ranksWithColor = ranks.filter(item => item[2] === 1).map(item => item[0])
    let memberHasValidRank: boolean = false
    // if the member has a rank with color changing then return
    member.roles.cache.forEach(role => {
        if (ranksWithColor.includes(role.id)) {
            console.log(`user has valid donator role so not removing color`)
            memberHasValidRank = true
        }
    })
    // if any colors are found, remove them
    member.roles.cache.forEach(role => {
        if (colors.includes(role.id) && !memberHasValidRank) {
            console.log(`non donator has role ${role.name}`)
            if (channel != undefined && channel instanceof TextChannel)
                member.roles.remove(role)
                    .then(() => channel.send(`Removed custom Discord colour ${role.name} from ${getDiscordDisplayName(member.user)}`))
                    .catch(error => console.error("Error removing role:", error))
        }
    })
}