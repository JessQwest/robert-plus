import * as DiscordJS from "discord.js"
import {client} from "./index"

export async function easter_egg_messageCreate(message: DiscordJS.Message) {
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

    // if someone says E or T react with trans heart
    if (message.content === "E" || message.content === "T") {
        await message.react("<:transheart:1170071007239876659>")
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
}