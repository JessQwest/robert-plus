import {RULE_MATCH_STRINGS, RULE_PHRASE_TEXT} from "./index";
import * as DiscordJS from "discord.js";

export function escapeFormatting(input: string){
    if (input.includes("\\")) {
        console.log("The string seems to already be escaped (jx0028)");
        return input
    }
    return input.replaceAll("_","\\_")
}

export function unescapeFormatting(input: string){
    return input.replaceAll("\\","")
}

export function capitalizeFirstLetter(input: string) {
    return input.charAt(0).toUpperCase() + input.slice(1);
}

export function verifyUsernameInput(username: String){
    const regex = new RegExp('^[a-zA-Z0-9_]{1,16}$');
    if (!regex.test(<string>username)) {
        console.log("verifyUsernameInput false for " + username)
        return false
    }
    console.log("verifyUsernameInput true for " + username)
    return true
}

export function containsRulePhrase(inputString: string): boolean{
    console.log(`checking for ${RULE_PHRASE_TEXT} in string: ${inputString}`);
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