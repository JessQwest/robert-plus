import {BOT_INFO_CHANNEL_ID, client} from "./index"
import {Interaction, MessageActionRow, MessageButton, Role, TextChannel} from "discord.js"
import {escapeFormatting, unescapeFormatting} from "./utility"


export async function manageUserRole(i: Interaction, action: string, roleId: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        // action: "add" or "remove"
        // userId: discord user id
        // roleId: discord role id
        if (i.guild == null) {
            resolve("Error running command. Please contact staff (jx0054)")
            return
        }
        const guild = await client.guilds.cache.get(i.guild.id)
        const userId = i.user.id
        if (guild == null) {
            resolve("Error running command. Please contact staff (jx0055)")
            return
        }
        const user = await guild.members.cache.get(userId)
        if (user == null) {
            resolve("Error running command. Please contact staff (jx0056)")
            return
        }
        const role = await guild.roles.fetch(roleId)
        if (role == null) {
            resolve("Error running command. Please contact staff (jx0057)")
            return
        }
        if (action == "add") {
            if (user.roles.cache.has(role.id)) {
                console.log(`${user.user.username} already has role ${role.name}`)
                resolve(`You already have the ${role.name} role!`)
                return
            }
            await user.roles.add(role).then(() => {
                console.log(`Added role ${role.name} to ${user.user.username}`)
                const botInfo = client.channels.cache.get(BOT_INFO_CHANNEL_ID) as TextChannel
                if (botInfo != null) botInfo.send(`Added role ${role.name} to ${user.user.username}`)
                resolve(`You have been given the ${role.name} role`)
            }).catch((error) => {
                console.error(`Error adding role ${role.name} to ${user.user.username}: ${error}`)
                resolve(`There was a problem sorting this role. The role might be above my role in the role list. Please contact staff for help (jx0060)`)
            })
        } else if (action == "remove") {
            if (!user.roles.cache.has(role.id)) {
                console.log(`${user.user.username} doesnt have role ${role.name}`)
                resolve(`You already do not have the ${role.name} role!`)
                return
            }
            await user.roles.remove(role).then(() => {
                console.log(`Removed role ${role.name} from ${user.user.username}`)
                const botInfo = client.channels.cache.get(BOT_INFO_CHANNEL_ID) as TextChannel
                if (botInfo != null) botInfo.send(`Removed role ${role.name} from ${user.user.username}`)
                resolve(`You have been removed from the ${role.name} role`)
            }).catch((error) => {
                console.error(`Error adding role ${role.name} to ${user.user.username}: ${error}`)
                resolve(`There was a problem sorting this role. The role might be above my role in the role list. Please contact staff for help (jx0061)`)
            })
        } else {
            console.error(`Invalid action ${action} passed to manageUserRole`)
            resolve("Error running command. Please contact staff (jx0058)")
        }
        resolve("Error running command. Please contact staff (jx0059)")
    })
}

export async function createRoleButton(role: Role, channel: TextChannel) {
    const roleButtonRow = new MessageActionRow()
    roleButtonRow.addComponents(
        new MessageButton()
            .setCustomId(`role,add,${role.id}`)
            .setLabel(`Add role ${role.name}`)
            .setStyle('PRIMARY'),
    )
    roleButtonRow.addComponents(
        new MessageButton()
            .setCustomId(`role,remove,${role.id}`)
            .setLabel(`Remove role ${role.name}`)
            .setStyle('DANGER'),
    )
    await channel.send({content: `Click the buttons below to add/remove the ${role.name} role`, components: [roleButtonRow]})
}