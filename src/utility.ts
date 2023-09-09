import {RULE_MATCH_STRINGS, RULE_PHRASE_TEXT} from "./index"
import * as DiscordJS from "discord.js"

export function escapeFormatting(input: string){
    if (input.includes("\\")) {
        console.log("The string seems to already be escaped (jx0028)")
        return input
    }
    // removes redundant discriminator
    if (input.endsWith("#0")) {
        input = input.slice(0, -2)
    }
    return input.replaceAll("_","\\_")
}

export function unescapeFormatting(input: string){
    return input.replaceAll("\\","")
}

export function capitalizeFirstLetter(input: string) {
    return input.charAt(0).toUpperCase() + input.slice(1)
}

export function verifyUsernameInput(username: String){
    const regex = new RegExp('^[a-zA-Z0-9_]{1,16}$')
    if (!regex.test(<string>username)) {
        console.log(`verifyUsernameInput false for ${username}`)
        return false
    }
    console.log(`verifyUsernameInput true for ${username}`)
    return true
}

export function containsRulePhrase(inputString: string): boolean{
    for (const string of RULE_MATCH_STRINGS) {
        if (inputString.toLowerCase().includes(string.toLowerCase())){
            return true
        }
    }
    return false
}

export function getDiscordDisplayName(DiscordUser: DiscordJS.User){
    if (DiscordUser.discriminator != "0") return `@${DiscordUser.username}#${DiscordUser.discriminator}`
    return `@${DiscordUser.username}`
}

export function addDashesToUuid(uuid: string){
    if (uuid.length != 32) {
        console.warn("uuid is not 32 characters long (jx0042)")
        return uuid
    }
    return uuid.slice(0,8) + "-" + uuid.slice(8,12) + "-" + uuid.slice(12,16) + "-" + uuid.slice(16,20) + "-" + uuid.slice(20)
}

export function countCharacterChanges(str1: string, str2: string): number {
    if (str1 === str2) return 0

    const len1 = str1.length
    const len2 = str2.length
    const maxLength = Math.max(len1, len2)

    let changes = Math.abs(len1 - len2)

    for (let i = 0; i < maxLength; i++) {
        if (str1[i] !== str2[i]) {
            changes++
        }
    }

    return changes
}
