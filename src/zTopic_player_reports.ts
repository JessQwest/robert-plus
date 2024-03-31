import {GuildMember, TextBasedChannel} from "discord.js"
import {APPLICATION_SERVER_ID, client, con, lpcon, MAIN_SERVER_ID} from "./index"
import {discordIdToMinecraftUuid} from "./api"
import {colors, ranks} from "./action_guildMemberUpdate"
import {addDashesToUuid, stringToEmbeds} from "./utility"
import * as util from "util"

export async function generatePlayerReport(channel: TextBasedChannel) {
    // get the main discord server
    const mainGuild = client.guilds.cache.get(MAIN_SERVER_ID)
    if (mainGuild == null) {
        console.error(`MAIN GUILD NULL (jx0044)`)
        return
    }
    const members = mainGuild.members.cache
    const memberList: GuildMember[] = Array.from(members.values())

    // check 3-6 prep
    let conflictingRankIds: string[] = []
    let conflictingRankNames: string[] = []
    let colorRankIds: string[] = []
    ranks.forEach(rank => {
        let rankId: string | number = rank[0]
        let rankName: string | number = rank[1]
        if (typeof rankId === 'string' && typeof rankName === 'string') {
            if (rank[3] == 0) { // if rank is not a duplicatable rank then add it to conflictingRankIds
                conflictingRankNames.push(`group.${rankName}`)
                conflictingRankIds.push(rankId)
            }
            if (rank[2] == 1) colorRankIds.push(rankId) // if rank allows for colours add to the colorRankIds
        }
    })

    // for check 5
    const conflictingRankNamesString = conflictingRankNames.map(() => '?').join(', ')

    for (const member of memberList) {
        const lpQueryAsync = util.promisify(lpcon.query).bind(lpcon)
        const queryAsync = util.promisify(con.query).bind(con)

        if (member.user.bot) continue // ignore bots
        let flagNotRegistered = false
        let flagNotWhitelisted = false
        let flagTooManyDiscordRoles = false
        let flagNonDonatorHasColor = false
        let flagDonatorHasMultipleColors = false
        let flagMultipleMinecraftRoles = false
        const memberRoles = member.roles.cache
        const discordId = member.id
        const mcUuid = await discordIdToMinecraftUuid(discordId)
        let dashedUuid = mcUuid != null ? addDashesToUuid(mcUuid) : null

        let mcUsername: string

        // check 1 - is this player registered?
        if (mcUuid == null) {
            flagNotRegistered = true
        }

        // check 2 - is the player whitelisted?
        if (flagNotRegistered) {
            // if they are not registered they cannot be whitelisted!
            flagNotWhitelisted = true
        }
        else {
            try {
                const result = await queryAsync(`SELECT * FROM whitelist WHERE uuid = ?`, [dashedUuid])

                if (result instanceof Array && result.length > 0) {
                    mcUsername = result[0]['name']
                } else {
                    flagNotWhitelisted = true
                }
            } catch (error) {
                console.warn(`Error in UUID (jx0071) + ${error}`)
                flagNotWhitelisted = true
            }
        }

        // check 3 - does the discord user have multiple conflicting roles
        // loop all roles, with a counter for how many roles are in conflictingRankIds
        let conflictingRoles: string[] = []
        let colorRoles: string[] = []
        let hasColorAwardRole = false // used for check 4
        memberRoles.forEach(role => {
            if (conflictingRankIds.includes(role.id)) {
                conflictingRoles.push(role.name)
            }
            if (colorRankIds.includes(role.id)) hasColorAwardRole = true
            if (colors.includes(role.id)) colorRoles.push(role.name)
        })
        if (conflictingRoles.length > 1) flagTooManyDiscordRoles = true

        // check 4 - does the player have too many colour roles
        if (hasColorAwardRole && colorRoles.length > 1) {
            flagDonatorHasMultipleColors = true
        } else if (!hasColorAwardRole && colorRoles.length > 0) {
            flagNonDonatorHasColor = true
        }

        // check 5 minecraft multiple roles
        if (dashedUuid != null) {
            try {
                const result = await lpQueryAsync(
                    `SELECT COUNT(*) AS count FROM s9496_luckperms.luckperms_user_permissions WHERE uuid = ? AND permission IN (?)`,
                    [dashedUuid, conflictingRankNames]
                )

                if (!result || result.length === 0) {
                    // Handle the case where there are no matching records
                } else {
                    const count = result[0].count
                   // console.log(`${member.user.username} has ${count} conflicting ranks from list (${conflictingRankNamesString})`)

                    if (parseInt(count, 10) > 1) {
                        //console.warn("AAAAAAAAAAAAAAAAAAAAAAAAAA")
                        flagMultipleMinecraftRoles = true
                    }
                }
            } catch (error) {
                console.warn(`Error in check 5 (jx0074) + ${error}`)
            }
        }

        // check 6 role sync
        // check 7 minecraft multiple colours
        // check 8 similar names
        // check 9 whitelisted player not in discord server
        // output
        if (flagNotRegistered) console.warn(`${member.user.username} failed check flagNotRegistered`)
        if (flagNotWhitelisted) console.warn(`${member.user.username} failed check flagNotWhitelisted`)
        if (flagTooManyDiscordRoles) console.warn(`${member.user.username} failed check flagTooManyDiscordRoles`)
        if (flagNonDonatorHasColor) console.warn(`${member.user.username} failed check flagNonDonatorHasColor`)
        if (flagDonatorHasMultipleColors) console.warn(`${member.user.username} failed check flagDonatorHasMultipleColors ${colorRoles}`)
        if (flagMultipleMinecraftRoles) console.warn(`${member.user.username} failed check flagMultipleMinecraftRoles`)
    }
}