import * as DiscordJS from "discord.js"
import {client} from "./index"

export async function easter_egg_messageCreate(message: DiscordJS.Message) {
    // if anyone says jacquestheminer
    if (message.content.toLowerCase().includes("jacquestheminer")){
        message.react("🍷")
    }

    // if azure sends a long message
    if (message.content.length > 500 && message.author.id == "402216790798630915"){
        let randomint = Math.floor(Math.random() * 3)
        if (randomint == 1){
            message.channel.send(":flushed:")
        }
    }

    // if stella sends a message
    if(message.author.id === "538117228697223185"){
        let randomint = Math.floor(Math.random() * 2000)
        if (randomint == 1){
            message.reply("You're awesome")
        }
    }

    // if sage sends a message
    if(message.author.id === "309991624270675969"){
        let randomint = Math.floor(Math.random() * 1000)
        if (randomint == 1){
            message.reply(":ok:")
        }
    }

    // if someone says A
    if (message.content === "A"){
        let randomint = Math.floor(Math.random() * 20)
        let replymessage = "CHEESE"
        if (randomint == 18 && message.author.id == "699331874408890378") replymessage = "wesome you are"
        switch (randomint){
            case 1:
                replymessage = "mogus"
                break
            case 2:
                replymessage = "ss"
                break
            case 3:
                replymessage = "pple"
                break
            case 4:
                replymessage = "zurelanternlit"
                break
            case 5:
                replymessage = "B"
                break
            case 6:
                replymessage = "AAAAAAAAAAA"
                break
            case 7:
                message.react("<:A2:926172226204626976>")
                return
        }
        if (replymessage == "CHEESE") return
        message.reply({
            content: replymessage
        })
        return
    }

    // if someone says azurelanternlit
    if (message.content === "azurelanternlit" && message.author != client.user){
        if(message.author.id === "749814178595864678"){
            message.reply({
                content: "ok"
            })
        }
        else {
            message.reply({
                content: "azurelanternlit"
            })
        }
    }

    // if someone says
    if (message.content.toLowerCase() == "my name is walter hartwell white"){
        message.reply({
            content: "I live at 308 negra arroyo lane albequerque new mexico 87104"
        })
    }

    if (message.content.toLowerCase().includes("mccafe check") && message.author.id == "313080215100325889" && message.channelId == "878007042940485682"){
        message.channel.send("the mccafe check")
    }
}