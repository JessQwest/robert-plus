import * as DiscordJS from "discord.js"
import {client} from "./index"

let lastTits = 0

export async function easter_egg_messageCreate(message: DiscordJS.Message) {
    // if anyone says jacquestheminer
    if (message.content.toLowerCase().includes("jacquestheminer")) {
        await message.react("🍷")
    }

    // if azure sends a long message
    if (message.content.length > 500 && message.author.id == "402216790798630915") {
        let randomInt = Math.floor(Math.random() * 3)
        if (randomInt == 1) {
            message.channel.send(":flushed:")
        }
    }

    // if stella sends a message
    if(message.author.id === "538117228697223185") {
        let randomInt = Math.floor(Math.random() * 2000)
        if (randomInt == 1) {
            await message.reply("You're awesome")
        }
    }

    // if someone says A
    if (message.content === "A") {
        let randomInt = Math.floor(Math.random() * 20)
        let replyMessage = "CHEESE"
        if (randomInt == 18 && message.author.id == "699331874408890378") replyMessage = "wesome you are"
        switch (randomInt) {
            case 1:
                replyMessage = "mogus"
                break
            case 2:
                replyMessage = "ss"
                break
            case 3:
                replyMessage = "pple"
                break
            case 4:
                replyMessage = "zurelanternlit"
                break
            case 5:
                replyMessage = "B"
                break
            case 6:
                replyMessage = "AAAAAAAAAAA"
                break
            case 7:
                await message.react("<:A_:926170429486411796>")
                return
        }
        if (replyMessage == "CHEESE") return
        await message.reply({
            content: replyMessage
        })
        return
    }

    // if someone says azurelanternlit
    if (message.content === "azurelanternlit" && message.author != client.user) {
        if(message.author.id === "749814178595864678") {
            await message.reply({
                content: "ok"
            })
        }
        else {
            await message.reply({
                content: "azurelanternlit"
            })
        }
    }

    // if someone says my name is walter hartwell white
    if (message.content.toLowerCase() == "my name is walter hartwell white") {
        await message.reply({
            content: "I live at 308 negra arroyo lane albequerque new mexico 87104"
        })
    }

    // if penguin sends a mccafe check in #mugs
    if (message.content.toLowerCase().includes("mccafe check") && message.author.id == "313080215100325889" && message.channelId == "878007042940485682") {
        message.channel.send("the mccafe check")
    }

    // responds with a gif to demi saying tits - cooldown of 6 hours
    let currentTime = Math.floor(new Date().getTime() / 1000)
    if (message.content.toLowerCase().includes("tits") && message.author.id == "596759267382657024" && (currentTime - lastTits > 21600 || lastTits == 0)) {
        await message.reply("https://tenor.com/view/good-boy-pat-on-head-stitch-gif-14742401")
        // set lastTits to now as a unix timestamp
        lastTits = Math.floor(new Date().getTime() / 1000)

    }
}