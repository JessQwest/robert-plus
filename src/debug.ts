import {client, con} from "./index"
import {getDiscordDisplayName} from "./utility"
import {buttonIDSet} from "./action_interactionCreate"
import {MessageEmbed} from "discord.js"
import * as DiscordJS from "discord.js"

export async function debug_messageCreate(message: DiscordJS.Message) {
    //test function
    if (message.content.toLowerCase().includes("cheese") && message.channelId == "970336504364818452"){
        const user = await client.users.fetch("252818596777033729")
        if (typeof user == 'undefined'){
            console.log("idk that channel")
            return
        }

        user.send(":heart:").then(success =>
            console.log("successful message")
        ).catch(error => {
            console.log(error.message)
        })
        await message.react("🧀")
    }

    if (message.author.id === "252818596777033729" && message.channelId === "970336504364818452") {
        //await message.reply(containsDucks(message.content))
    }

    if (message.content === "dbreset" && message.author.id === "252818596777033729" && message.channelId === "970336504364818452"){
        con.reset()
    }

    if (message.content === "debug" && message.author.id === "252818596777033729" && message.channelId === "970336504364818452") {
        console.log("DEBUG COMMAND")
        var discordUser
        var discordUsername = "Unknown user"
        try {
            const a = client.users.fetch('1017115584665755710').then(value => {
                discordUser = value
                discordUsername = getDiscordDisplayName(discordUser)
            })
        }
        catch (error) {
            console.log("could not get username " + error)
            console.log(error)
        }
    }

    if (message.content === "flush" && ((message.author.id === "252818596777033729") || message.channelId === "805296027241676820")){
        await message.reply("Before: " + Array.from(buttonIDSet.values()).toString())
        await buttonIDSet.clear()
        await message.reply("After: " + Array.from(buttonIDSet.values()).toString())
    }

    if (message.content === "wl" && message.author.id === "252818596777033729" && message.channelId === "970336504364818452"){
        message.channel.send("WL TRIGGER")
        const whitelistedEmbed = new MessageEmbed()
            .setColor("#54fbfb")
            .setTitle("New: Divergent SMP Application")
            .setDescription("What is your Minecraft IGN?:\n" +
                "_notch_\n" +
                "\n" +
                "What is your age?:\n" +
                "17\n" +
                "\n" +
                "Why do you want to join this server?:\n" +
                "my friends are in it :D\n" +
                "\n" +
                "What rule do you value most when playing on an SMP?:\n" +
                "having fun :>\n" +
                "\n" +
                "What are some of your hobbies outside of minecraft?:\n" +
                "video gaming B)\n" +
                "\n" +
                "Are you a streamer or a youtuber? If so include a link:\n" +
                "n/a\n" +
                "\n" +
                "How did you find the server? (Reddit/friend/website etc) If it's a friend, please specify who.:\n" +
                "friends\n" +
                "asd\n" +
                "\n" +
                "Have you read and understood the rules?:\n" +
                "yee\n" +
                "\n" +
                "Include any additional information or questions here:\n" +
                "( ’-’)")
            .setFooter("Applicant: _Jacques_#8805\n" +
                "ID: 629050148663721994")
        message.channel.send({embeds: [whitelistedEmbed]})
    }
}