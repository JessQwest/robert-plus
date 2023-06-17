import * as DiscordJS from "discord.js"
import {containsRulePhrase, escapeFormatting, getDiscordDisplayName, verifyUsernameInput} from "./utility"
import {buttonIDSet} from "./action_interactionCreate"
import {Client, MessageEmbed, TextBasedChannel} from "discord.js"
import {client, con, DEBUGMODE, MAIN_ANNOUNCEMENT_CHANNEL, postRuleRejectButtons} from "./index"


export async function messageCreate(client: Client, message: DiscordJS.Message){
    // @ts-ignore
    if ((message.channel.type === 'DM' || message.mentions.has(client.user.id)) && message.author != client.user) {
        const messagesToRobert = await client.channels.fetch("970115159781683290")
        let messageContent = message.content.replace("<@969760796278157384>","@Robert")
        messageContent = messageContent.replace("@everyone","@ everyone")
        // @ts-ignore
        await messagesToRobert.send(message.author.username + ": " + messageContent + "");
        for (const attatchment of message.attachments){
            // @ts-ignore
            await messagesToRobert.send(message.author.username + " attached " + attatchment[1].name + ": " + attatchment[1].url);
        }
    }

    if (message.reference != null && message.reference.messageId != null && message.content.at(0) == "!"){
        const messageRepliedTo: DiscordJS.Message = await message.channel.messages.fetch(message.reference.messageId);
        // @ts-ignore
        if (messageRepliedTo.author.id == client.user.id && messageRepliedTo.embeds.length >= 1){
            const embed = messageRepliedTo.embeds[0];
            //embed.setDescription(`IGN: ${message.content.slice(1)} ${embed.description.match("Discord name[^]]*")}`)
            // @ts-ignore
            const usernameBlockText = embed.description.match("IGN:\\s*.+\\s*Discord").toString();
            // @ts-ignore
            const mcusername = usernameBlockText.slice(5,-8)
            // @ts-ignore
            embed.setDescription(embed.description.replace(mcusername,message.content.slice(1)))
            await messageRepliedTo.edit({embeds: [embed]})
        }
    }

    // thumbs up and thumbs down reactions if the message is in announcements
    if (message.channelId == MAIN_ANNOUNCEMENT_CHANNEL) {
        await message.react("👍")
        await message.react("👎")
    }

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

    if (message.content.toLowerCase() == "my name is walter hartwell white"){
        message.reply({
            content: "I live at 308 negra arroyo lane albequerque new mexico"
        })
    }

    if (message.content.toLowerCase().includes("mccafe check") && message.author.id == "313080215100325889" && message.channelId == "878007042940485682"){
        message.channel.send("the mccafe check")
    }

    //test function
    if (message.content.toLowerCase().includes("cheese") && message.channelId == "970336504364818452"){
        const user = await client.users.fetch("252818596777033729");
        if (typeof user == 'undefined'){
            console.log("idk that channel")
            return;
        }
        // @ts-ignore
        user.send(":heart:").then(console.log("successful message")).catch(error => {
            console.log(error.message)
        })
        message.react("🧀")
    }

    if (message.content.length > 500 && message.author.id == "402216790798630915"){
        let randomint = Math.floor(Math.random() * 3);
        if (randomint == 1){
            message.channel.send(":flushed:")
        }
    }

    if(message.author.id === "538117228697223185"){
        let randomint = Math.floor(Math.random() * 2000);
        if (randomint == 1){
            message.reply("You're awesome")
        }
    }

    if(message.author.id === "309991624270675969"){
        let randomint = Math.floor(Math.random() * 1000);
        if (randomint == 1){
            message.reply(":ok:")
        }
    }

    if (message.content === "A"){
        let randomint = Math.floor(Math.random() * 20);
        let replymessage = "CHEESE";
        if (randomint == 18 && message.author.id == "699331874408890378") replymessage = "wesome you are";
        switch (randomint){
            case 1:
                replymessage = "mogus";
                break;
            case 2:
                replymessage = "ss";
                break;
            case 3:
                replymessage = "pple";
                break;
            case 4:
                replymessage = "zurelanternlit";
                break;
            case 5:
                replymessage = "B";
                break;
            case 6:
                replymessage = "AAAAAAAAAAA";
                break;
            case 7:
                message.react("<:A2:926172226204626976>");
                return;
        }
        if (replymessage == "CHEESE") return;
        message.reply({
            content: replymessage
        })
        return;
    }

    if (message.content.toLowerCase().includes("jacquestheminer")){
        message.react("🍷");
    }

    if (message.author.id === "252818596777033729" && message.channelId === "970336504364818452") {
        //await message.reply(containsDucks(message.content))
    }

    if (message.content === "dbreset" && message.author.id === "252818596777033729" && message.channelId === "970336504364818452"){
        con.reset()
    }

    if (message.content === "debug" && message.author.id === "252818596777033729" && message.channelId === "970336504364818452") {
        console.log("DEBUG COMMAND")
        var discordUser;
        var discordUsername = "Unknown user";
        try {
            const a = client.users.fetch('1017115584665755710').then(value => {
                discordUser = value;
                discordUsername = getDiscordDisplayName(discordUser);
            });
        }
        catch (error) {
            console.log("could not get username " + error);
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
                "ID: 629050148663721994");
        message.channel.send({embeds: [whitelistedEmbed]});
        return;
    }


    var listentingChannel: string = ""
    var channelIDtoPostApplications: string = ""
    var channelIDtoPostApplicationNotification: string = ""
    if (DEBUGMODE){
        listentingChannel = "970336504364818452"
        channelIDtoPostApplications = "970336504364818452"
        channelIDtoPostApplicationNotification = "970336504364818452"
    }
    else{
        listentingChannel = "908855513163399268"
        channelIDtoPostApplications = "805296027241676820"
        channelIDtoPostApplicationNotification = "829119465718284358"
    }

    if(message.channelId === listentingChannel && message.embeds.length >= 1){
        const applicationChannel = client.channels.cache.get(channelIDtoPostApplications)
        if (applicationChannel == null || applicationChannel.isText() == false){
            console.log("channelIDtoPostApplications is not a valid text channel (jx0011)")
            return
        }
        const applicationTextChannel: TextBasedChannel = applicationChannel as DiscordJS.TextChannel

        const recievedEmbed = message.embeds[0];

        if(recievedEmbed.description == null || !recievedEmbed.description.includes("What is your Minecraft IGN?")) return;

        // @ts-ignore
        const ignBlockText = recievedEmbed.description.match("What is your Minecraft IGN\\?:(.|\\n)*What is your age\\?:").toString();
        // @ts-ignore
        const ign = ignBlockText.slice(29,-22)

        // @ts-ignore
        const ageBlockText = recievedEmbed.description.match("What is your age\\?:(.|\\n)*Why do you want to join this server\\?:").toString();
        // @ts-ignore
        const age = ageBlockText.slice(19,-41)

        // @ts-ignore
        const referralText = recievedEmbed.description.match("please specify who\\.:(.|\\n)*Have you read and understood").toString();
        // @ts-ignore
        const referral = referralText.slice(21,-32)

        // @ts-ignore
        const discordNameBlockText = recievedEmbed.footer?.text.match("Applicant:\\s*.+\\s*ID").toString();
        // @ts-ignore
        const discordName = discordNameBlockText.slice(11,-3)

        // @ts-ignore
        const discordID = recievedEmbed.footer.text.slice(-19).trim()
        console.log(discordID)

        let applicationLengthDescription = "Unknown"
        // @ts-ignore
        const applicationLength = recievedEmbed.description.length
        console.log(`application length is ${applicationLength} characters`)
        if (applicationLength < 590) applicationLengthDescription = "Impressively bad"
        else if (applicationLength < 775) applicationLengthDescription = "Yikes"
        else if (applicationLength < 820) applicationLengthDescription = "Basic"
        else if (applicationLength < 1013) applicationLengthDescription = "Decent"
        else if (applicationLength < 1253) applicationLengthDescription = "Good"
        else if (applicationLength < 1553) applicationLengthDescription = "Very good"
        else if (applicationLength < 1853) applicationLengthDescription = "Amazing!"
        else applicationLengthDescription = "WOAH!"

        const duckDetected: boolean = containsRulePhrase(recievedEmbed.description)
        const duckDetectedString: string = duckDetected ? "Yes" : "No";

        const applicationEmbed = new MessageEmbed()
            .setColor("#bdbc4b")
            .setTitle("New Application - Please vote")
            .setDescription(
                "IGN: " + escapeFormatting(ign) + "\n" +
                "Discord name: " + escapeFormatting(discordName) + "\n" +
                "Age: " + age + "\n" +
                "Ducks Detected: " + duckDetectedString + "\n" +
                "Application Size: " + applicationLengthDescription)
            .setFooter(discordID)

        // @ts-ignore
        client.channels.cache.get(channelIDtoPostApplications).send("@everyone");
        // @ts-ignore
        let appMessage = client.channels.cache.get(channelIDtoPostApplications).send({embeds: [applicationEmbed]})
            .then(function (message: { react: (arg0: string) => void; }){
                message.react("<:yes:897152291591819376>");
                message.react("<:no:897152291809935430>");
            });

        const basicApplicationEmbed = new MessageEmbed()
            .setColor("#bdbc4b")
            .setTitle("A new application has been sent")
            .setDescription(
                "IGN: " + escapeFormatting(ign) + "\n" +
                "Discord name: " + escapeFormatting(discordName) + "\n" +
                "Referral: " + referral + "\n" +
                "Ducks Detected: " + duckDetectedString + "\n");

        // @ts-ignore
        client.channels.cache.get(channelIDtoPostApplicationNotification).send({embeds: [basicApplicationEmbed]})

        if (!verifyUsernameInput(ign)){
            // @ts-ignore
            client.channels.cache.get(channelIDtoPostApplications).send("This IGN doesnt look quite right. Reply to the application message with !(ign) if it is wrong")
        }

        if (!duckDetected){
            postRuleRejectButtons(ign,discordID,applicationTextChannel)
        }

        message.react("🇵")
    }
}