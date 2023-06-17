import {Client, Message, PartialMessage} from "discord.js"

export async function messageDelete(client: Client, messageDelete: Message<boolean> | PartialMessage) {
    console.log("deleted message")
    if (messageDelete.author == null || messageDelete.author.id == null) return
    // @ts-ignore
    else if (messageDelete.author.id == "238325144156766208"){
        messageDelete.channel.send("🤨")
    }
    // @ts-ignore
    else if (messageDelete.author.id == "749814178595864678"){
        messageDelete.channel.send("ok")
    }
    // @ts-ignore
    else if (messageDelete.author.id == "264183823716057089") {
        messageDelete.channel.send("I saw that.")
    }
}