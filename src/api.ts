import {verifyUsernameInput} from "./utility"
import fetch from "node-fetch"

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
    } = await fetch('https://api.mojang.com/users/profiles/minecraft/' + username).then((response: { json: () => any; }) => response.json())
    console.log (`name to uuid lookup result for ${username}: name:${name} id:${id} errormessage:${errorMessage}`)
    if (name == null && id == null && errorMessage == null) {
        console.log(`name to uuid invalid return for ${username}`)
        throw new Error(`This isn't working right now, try again later or bug Jacques about it (jx0001)`)
    }
    else if (errorMessage != null){
        console.log(`name to uuid invalid name ${username}`)
        console.log(`No one appears to have this name`)
        return ""
    }
    else if (id != null) return id

    throw new Error(`An unhandled error has occurred, bug Jacques (jx0002)`)
}

export async function uuidToUsername(uuId: String): Promise<String> {
    console.log('https://sessionserver.mojang.com/session/minecraft/profile/' + uuId)
    const {
        id,
        name
    } = await fetch('https://sessionserver.mojang.com/session/minecraft/profile/' + uuId).then((response: { json: () => any }) => response.json());
    return name
}