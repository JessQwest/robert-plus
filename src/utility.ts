import {ADMIN_LIST, RULE_CHECKING_ENABLED, RULE_MATCH_STRINGS, RULE_PHRASE_TEXT} from "./index"
import * as DiscordJS from "discord.js"
import {ColorResolvable} from "discord.js"

export function escapeFormatting(input: string): string {
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

export function unescapeFormatting(input: string) {
    return input.replaceAll("\\","")
}

export function capitalizeFirstLetter(input: string) {
    return input.charAt(0).toUpperCase() + input.slice(1)
}

export function verifyUsernameInput(username: String) {
    const regex = new RegExp('^[a-zA-Z0-9_]{2,16}$')
    if (!regex.test(<string>username)) {
        console.log(`verifyUsernameInput false for ${username}`)
        return false
    }
    console.log(`verifyUsernameInput true for ${username}`)
    return true
}

export function containsRulePhrase(inputString: string): boolean {
    if (!RULE_CHECKING_ENABLED) return true
    for (const string of RULE_MATCH_STRINGS) {
        if (inputString.toLowerCase().includes(string.toLowerCase())) {
            return true
        }
    }
    return false
}

export function getDiscordDisplayName(DiscordUser: DiscordJS.User) {
    if (DiscordUser.discriminator != "0") return `@${DiscordUser.username}#${DiscordUser.discriminator}`
    return `@${DiscordUser.username}`
}

export function addDashesToUuid(uuid: string) {
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

// used as a metric for how similar two strings are, higher score means more similar
export function jaccardIndex(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase())
    const set2 = new Set(str2.toLowerCase())

    const intersectionSize = [...set1].filter(char => set2.has(char)).length
    const unionSize = set1.size + set2.size - intersectionSize

    return intersectionSize / unionSize
}

export function stringToEmbeds(title: string, description: string, color: ColorResolvable = "#208386", footer: string | null = null): DiscordJS.MessageEmbed[] {
    const embeds: DiscordJS.MessageEmbed[] = []
    const lines = groupLines(description)
    let setTitle = false
    for (const line of lines) {
        let nextEmbed = new DiscordJS.MessageEmbed()
            .setColor(color)
            .setDescription(line)

        if (!setTitle) {
            nextEmbed.setTitle(title)
            setTitle = true
        }

        embeds.push(nextEmbed)
    }

    if (footer != null && embeds.length >= 1) {
        embeds[embeds.length - 1].footer = {text: footer}
    }

    return embeds
}


function groupLines(inputString: string): string[] {
    const lines = inputString.split('\n')
    const groupedLines: string[] = []
    let currentGroup: string[] = []

    for (const line of lines) {
        if (currentGroup.join('\n').length + line.length <= 4000) {
            currentGroup.push(line)
        } else {
            groupedLines.push(currentGroup.join('\n'))
            currentGroup = [line]
        }
    }

    if (currentGroup.length > 0) {
        groupedLines.push(currentGroup.join('\n'))
    }

    return groupedLines
}

export function hasAdminPerms(userId: string | null | undefined): boolean {
    if (userId == null) return false
    const isAdmin = ADMIN_LIST.includes(userId)
    return isAdmin
}

export function formatListOfStrings(strings: string[]): string {
    if (strings.length === 0) {
        return '';
    } else if (strings.length === 1) {
        return strings[0];
    } else {
        const allButLast = strings.slice(0, -1).join(', ')
        const last = strings[strings.length - 1]
        return `${allButLast} and ${last}`
    }
}