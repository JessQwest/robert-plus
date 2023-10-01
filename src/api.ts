import {capitalizeFirstLetter, escapeFormatting, verifyUsernameInput} from "./utility"
import fetch from "node-fetch"
import {con, RULE_PHRASE_TEXT} from "./index"
import * as DiscordJS from "discord.js"
import {MessageEmbed} from "discord.js"

// given the minecraft username, gets the uuid for that username
export async function nameToUuid(username: String | null): Promise<string>{
    if (username == null) return ""
    if (!verifyUsernameInput(username)) {
        console.log(`Invalid username entered (${username}) (jx0038)`)
        return ""
    }
    const {
        name,
        id,
        errorMessage
    } = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`).then((response: { json: () => any }) => response.json())
    console.log (`name to uuid lookup result for ${username}: name:${name} id:${id} errormessage:${errorMessage}`)
    if (name == null && id == null && errorMessage == null) {
        console.log(`name to uuid invalid return for ${username}`)
        throw new Error(`This isn't working right now, try again later or bug Jessica about it (jx0001)`)
    }
    else if (errorMessage != null){
        console.log(`name to uuid invalid name ${username}`)
        console.log(`No one appears to have this name`)
        return ""
    }
    else if (id != null) return id

    throw new Error(`An unhandled error has occurred, bug Jessica (jx0002)`)
}

export async function usernameCheck(username: string, textChannel: DiscordJS.TextChannel | undefined = undefined): Promise<Boolean> {
    return new Promise(async (resolve, reject) => {
        const url = `https://api.mojang.com/users/profiles/minecraft/${username}`

        try {
            const response = await fetch(url)
            const data = await response.json()

            if (data.errorMessage) {
                const errorEmbed = new MessageEmbed()
                    .setColor("#f5bc06")
                    .setTitle("Minecraft Username Check Failed")
                    .setDescription(`⚠️ ${data.errorMessage} ⚠️`)
                if (textChannel != undefined) textChannel.send({embeds: [errorEmbed]})
                resolve(false)
            } else {
                resolve(true)
            }
        } catch (error) {
            console.error('Error:', error)
            reject(error)
        }
    })
}

export async function uuidToUsername(uuId: String): Promise<String> {
    console.log(`https://sessionserver.mojang.com/session/minecraft/profile/${uuId}`)
    const {
        id,
        name
    } = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuId}`).then((response: { json: () => any }) => response.json())
    return name
}

export async function discordIdToMinecraftUuid(discordId: String): Promise<string | null> {
    return new Promise((resolve, reject) => {
        con.query(`SELECT minecraftUuid FROM accountLinking WHERE discordId = ?`, [discordId], async function (err: any, result: any, fields: any) {
            if (err) return reject(err)
            if (result == null || result == "" || result.size == 0) return resolve(null)

            try {
                const mcuuid = result[0]['minecraftUuid']
                resolve(mcuuid)
            } catch (e) {
                console.log("ERROR IN UUID (jx0024)")
                resolve(null)
            }
        })
    })
}