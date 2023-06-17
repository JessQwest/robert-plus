import {ButtonInteraction, Client, GuildMember, Interaction, MessageEmbed} from "discord.js"
import {escapeFormatting, getDiscordDisplayName, verifyUsernameInput} from "./utility"
import * as DiscordJS from "discord.js"
import fetch from "node-fetch"
import {ALERT_CHANNEL, con, RULE_PHRASE_TEXT, SERVER_NAME, YES_EMOJI} from "./index"

// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import {nameToUuid} from "./api"

export var buttonIDSet : Set<string> = new Set
export async function interactionCreateButton(client: Client, i: Interaction) {
    const { user, member, guild } = i

    //checking for valid
    if (!i.isButton()) {
        console.log("Interaction created which is not button, ignoring")
        return
    }
    if (i.channel == null) {
        console.log("Interaction created but channel is unknown! (jx0013)")
        return
    }

    //prepare valid button
    const b: ButtonInteraction = i;
    console.log(`Button pressed! ${b.component.label}`)
    if (!buttonIDSet.has(b.message.id)){
        buttonIDSet.add(b.message.id)
    }
    else {
        console.log("Interaction button clash (jx0014)")
        i.channel.send(`${b.user.username} was too slow! They should get good.`)
        return
    }
    if (b.component.label == null) {
        console.log("Interaction button does not have a label (jx0015)")
        return
    }

    //process custom ID (mcusername,discordId)
    console.log(`Splitting up custom id, input: ${b.customId}`)
    const customID = b.customId;
    const splitCustomId = customID.split(",")
    if (splitCustomId.length < 2) {
        console.log(`Invalid custom id input (jx0016)`)
    }
    let mcUsername = splitCustomId[0]
    const escapedMcUsername = escapeFormatting(mcUsername)
    console.log(`Collected mcUsername from customId, unescaped: ${mcUsername} & escaped ${escapedMcUsername}`)
    const dcId = splitCustomId[1]
    console.log(`Processing ${mcUsername}...`)
    const reason = splitCustomId[2]
    console.log(`...for ${reason}`)

    let discordUser: DiscordJS.User | undefined
    let discordUsername: string = "Unknown user"
    const userPromise = client.users.fetch(dcId).then(value => {
        discordUser = value
        discordUsername = getDiscordDisplayName(discordUser)
        return value
    }).catch(error => {
        console.log(`Error in getting username: ${error} (jx0017)`)
        if (i.channel == null){
            console.log(`Error in reporting getting username error (jx0018)`)
            return
        }
        i.channel.send("Could not get discord username, Jac probably did a bad")
        return
    })

    const labelText: string = b.component.label.toLowerCase()

    await userPromise

    if (discordUser == null){
        console.log("discord user is undefined! (jx0021)")
        return
    }

    if (reason == "accept") {
        var whitelistMessage = ""
        var accountLinkMessage = ""
        var personDmMessage = ""

        //WHITELISTING
        // @ts-ignore
        if(!verifyUsernameInput(mcUsername)){
            whitelistMessage = "<:no:897152291809935430> " + escapedMcUsername + " is not a recognised username"
        }
        else
        {
            console.log("mc username verified")
            con.query('SELECT name FROM whitelist WHERE name = ? AND whitelisted = 0', [mcUsername], function (err: any, result: any, fields: any){
                console.log("select statement")
                if (err){
                    whitelistMessage = "<:no:897152291809935430> SQL Error 1, Jac needs to look into this (jx0005)"
                    console.error(err)
                }
                else {
                    console.log("Number of people with this name already in whitelist: " + result.length)
                }
                if (result.length > 0){
                    whitelistMessage = "<:maybe:1024499432781254697> " + escapeFormatting(mcUsername) + " is already in the whitelist"
                }
                else{
                    con.query('INSERT INTO whitelist (uuid, name, whitelisted) VALUES (?,?,0)', [uuidv4(), mcUsername] , function (err: any, result: any, fields: any) {
                        if (err){
                            whitelistMessage = "<:no:897152291809935430> SQL Error 2, Jac needs to look into this (jx0022)"
                            console.error(err)
                        }
                        whitelistMessage = "<:yes:897152291591819376> " + escapedMcUsername + " has been added to the whitelist"
                    })
                }
            })
        }
        //ACCOUNT LINKING
        console.log(`Attempt to register ${dcId} : ${mcUsername}`)
        var mcuuid = ""
        try {
            const {name, id} = await fetch('https://api.mojang.com/users/profiles/minecraft/' + mcUsername).then((response: { json: () => any; }) => response.json())
            mcuuid = id;
            if (mcuuid == null){
                accountLinkMessage = "<:no:897152291809935430> Cannot retrieve Minecraft uuid"
            }
            else{
                mcUsername = name
            }
        } catch (err) {
            console.log(err)
            console.log("Invalid parameters")
            accountLinkMessage = "<:no:897152291809935430> SQL Error 3, Jac needs to look into this"
        }
        if (mcuuid != null) {
            con.query(`INSERT INTO accountLinking VALUES (\'${dcId}\',\'${mcuuid}\')`, function (err: any, result: any, fields: any) {
                if (err) {
                    if (err.errno == 1062) {
                        accountLinkMessage = "<:maybe:1024499432781254697> This account has already been linked"
                        console.log(accountLinkMessage)
                    } else {
                        accountLinkMessage = "<:no:897152291809935430> Error processing request, Jac needs to look into this"
                        console.error("errno: " + err.errno)
                        console.error(err)
                    }
                }
                else{
                    console.log("success")
                    accountLinkMessage = "<:yes:897152291591819376> " + `MC account ${escapedMcUsername} Linked to Discord user ${escapeFormatting(discordUsername)}`
                    console.log(accountLinkMessage)
                }
            })
        }
        else { //fail
            accountLinkMessage = "<:no:897152291809935430> SQL connection error 4, Jac needs to look into this"
            console.log(accountLinkMessage)
        }


        try{
            const theGuild = await client.guilds.fetch("706923004285812849");

            // @ts-ignore
            console.log("attempting message send to " + discordUser.username)
            // @ts-ignore
            const guildInvite = await theGuild.systemChannel.createInvite({maxAge: 604800, maxUses: 1, unique: true}).catch(error => {
                // @ts-ignore
                i.channel.send("Error in generating invite link: " + error)
                personDmMessage = "<:no:897152291809935430> Could not generate server invite, Jac needs to look into this"
            }).then(invite => {
                // @ts-ignore
                discordUser.send({
                    content: `Hi, I'm Robert, the robotic assistant for ${SERVER_NAME}. Thank you for your interest and application for ${SERVER_NAME}. Your application has been approved and you have been whitelisted on the server. \n` +// @ts-ignore
                        "Please join the main server discord with this invite link: https://discord.gg/" + invite.code + "\n" +
                        "Other details about the server such as the IP address can be found in the #information channel. You don't need to be in the application server anymore.\n" +
                        `Welcome to ${SERVER_NAME}!`
                }).then(result => {
                    // @ts-ignore
                    personDmMessage = `<:yes:897152291591819376> Sent a DM to ${getDiscordDisplayName(discordUser)}`
                    console.log(`ACCEPT MESSAGE SENT OK FOR ${discordUser?.username}`)
                }).catch(error => { // @ts-ignore
                    console.log("Error in sending message: " + error)
                    personDmMessage = `<:no:897152291809935430> Could not send the DM. type /accept and do manually`
                })
            })
        }
        catch (err){
            personDmMessage = "<:no:897152291809935430> Could not generate server invite, Jac needs to look into this"
            console.log(err)
        }

        //END RESULT
        await i.update({ content: `${escapedMcUsername} was accepted by ${b.user.username}`, components: [] });

        let sleep = async (ms: number) => await new Promise(r => setTimeout(r,ms));
        try{
            await sleep(4000)
        }
        catch (err){
        }

        const acceptEmbed = new MessageEmbed()
            .setColor("#12ce0c")
            .setTitle("Accept status for " + mcUsername)
            .setDescription("**Added to whitelist:** " + whitelistMessage + "\n" +
                "**Account linked:** " + accountLinkMessage + "\n" +
                "**Person DM'd:** " + personDmMessage );
        console.log("EMBED PREPARED")

        i.channel.send({embeds: [acceptEmbed]})
    }

    if (reason == "rulereject") {
        await i.update({ content: `${escapedMcUsername} was ${RULE_PHRASE_TEXT} rejected by ${b.user.username}`, components: [] });
        await discordUser.send({
            content: `Thank you for your application to ${SERVER_NAME}! Unfortunately your application has been denied at this time for failure to read the rules. Once you've had a chance to look over them, please feel free to reapply!`
        }).then(result => {
            i.channel?.send(`${YES_EMOJI} Sent a ${RULE_PHRASE_TEXT} reject DM to ${discordUsername}`)
            console.log(`RULE REJECT MESSAGE SENT OK FOR ${discordUser?.username}: ${result}`)
            return
        }).catch(error => {
            console.log(`Error in sending message: ${error}`)
            i.channel?.send(`<:no:897152291809935430> Could not send the DM. You will need to send manually (jx0023: ${error})`)
            return
        })
    }

    if (reason == "rulerejectkick") {
        messageAndKick(i, escapedMcUsername, b.user.username, discordUser, `Thank you for your application to ${SERVER_NAME}! Unfortunately your application has been denied at this time for failure to read the rules.`)
        await i.update({ content: `${escapedMcUsername} was ${RULE_PHRASE_TEXT} rejected and kicked by ${b.user.username}`, components: [] });
    }

    if (reason == "badappreject") {
        messageAndKick(i, escapedMcUsername, b.user.username, discordUser, `Thank you for your interest in ${SERVER_NAME}!\nUnfortunately, your application did not receive enough staff votes to be accepted at this server.\nHave a great day.`)
        await i.update({ content: `${escapedMcUsername} was rejected and kicked by ${b.user.username} for a bad application`, components: [] });
    }

    if (reason == "underagereject") {
        messageAndKick(i, escapedMcUsername, b.user.username, discordUser, `Thank you for your interest in ${SERVER_NAME}. Unfortunately your application has been denied at this time due to our 16+ age requirement.\nPlease feel free to reapply when you are 16!`)
        await i.update({ content: `${escapedMcUsername} was rejected and kicked by ${b.user.username} for underage application`, components: [] });
    }

    if (reason == "genericreject") {
        messageAndKick(i, escapedMcUsername, b.user.username, discordUser, `Thank you for your interest in ${SERVER_NAME}!\nUnfortunately, your application on this occasion has not been successful.\nHave a great day.`)
        await i.update({ content: `${escapedMcUsername} was rejected and kicked by ${b.user.username} for a bad application`, components: [] });
    }
}

export async function interactionCreateCommand(client: Client, interaction: Interaction) {
    if (!interaction.isCommand()) return

    const { commandName, options, user, member, guild } = interaction

    if (commandName === "alert"){
        // @ts-ignore
        client.channels.cache.get(ALERT_CHANNEL).send(`@everyone ${user.username} has raised an alert in ${interaction.channel.toString()}`)
        await interaction.reply({
            content: "Staff have been silently notified of action in this channel.",
            ephemeral: true
        })
    }

    if (commandName === "getdiscordname"){
        try {
            await interaction.deferReply({ephemeral: true});
            // @ts-ignore
            if (verifyUsernameInput(options.getString("mcusername")) == false) {
                await interaction.editReply("Invalid name input")
                return;
            }
            const {
                name,
                id
            } = await fetch('https://api.mojang.com/users/profiles/minecraft/' + options.getString("mcusername")).then((response: { json: () => any; }) => response.json());

            if (name == null && id == null) {
                interaction.editReply("This isn't working right now, try again later or bug Jacques about it");
                return;
            }
            console.log(`dc id to look up = ${id}`)
            var returnString = `There is no record for ${options.getString("mcusername")}`

            try {
                const result = await new Promise((resolve, reject) => {
                    con.query('SELECT discordId FROM accountLinking WHERE minecraftUuid = ?', [id], (err: any, result: any, fields: any) => {
                        if (err) reject(err);
                        resolve(result);
                    });
                });

                var firstEntry: boolean = true
                // @ts-ignore
                for (var sqlItem of result) {
                    var dcId = sqlItem['discordId']
                    console.log(`dcId = ${dcId}`)
                    var discordUsername: string = "Unknown user"
                    try {
                        const value = await client.users.fetch(dcId);
                        discordUsername = getDiscordDisplayName(value)
                        if (firstEntry) {
                            firstEntry = false
                            returnString = `${options.getString("mcusername")} is known on Discord as `
                        } else {
                            returnString = returnString + " and "
                        }
                        returnString = returnString + discordUsername
                        console.log(`workin on it - ${returnString}`)
                    } catch (error) {
                        console.log("could not get username " + error)
                    }
                }

                console.log("about to print")
                interaction.editReply(returnString);
                return;
            } catch (error) {
                console.log("Error in SQL query: " + error);
            }

        }
        catch (e) {
            await interaction.editReply("Invalid name.")
            return
        }
    }

    if (commandName === "getminecraftname"){
        await interaction.deferReply({ephemeral: true});
        try{
            await con.query(`SELECT minecraftUuid FROM accountLinking WHERE discordId = '` + options.getUser("discordusername") + "'", async function (err: any, result: any, fields: any) {
                console.log(`getminecraftname called for user ${options.getUser("discordusername")} - result of name lookup: ${result[0]['minecraftUuid']}`)
                const mcUuid = result[0]['minecraftUuid']
                const lookupUrl = 'https://sessionserver.mojang.com/session/minecraft/profile/' + mcUuid
                console.log(`getminecraftname API call to ${lookupUrl}`)
                const {id, name} = await fetch(lookupUrl).then((response: { json: () => any; }) => response.json());
                console.log(name)
                await interaction.editReply(`Minecraft name: ${name}`)
            });
        }
        catch (e) {
            await interaction.editReply("Failed to get Minecraft name")
            console.log(e)
            return
        }
    }

    if (commandName === "nametouuid"){
        const username = options.getString("username")
        await interaction.deferReply({ephemeral: true})
        try{
            const uuid = await nameToUuid(username)
            await interaction.editReply({content: `Name: ${username}\nUUID: ${uuid}`})
        }
        catch (err) {
            if (err instanceof Error) await interaction.editReply({content: err.toString()})
            else await interaction.editReply({content: "Unknown error (jx0003)"})
        }
    }

    if (commandName === "bedtime"){
        let bedtimeSuccess = false;
        let timeoutusername = "You have";
        let guildmember;
        // @ts-ignore
        guildmember = await guild?.members.fetch(options.getUser("username"));
        // @ts-ignore
        if (options.getUser("username") === null || (!interaction.memberPermissions.has("ADMINISTRATOR") && interaction.user.id !== "430518858097360907")){
            if (member instanceof GuildMember && interaction.channel != null) {
                bedtimeSuccess = await bedtimeUser(member)
            }
        }
        // @ts-ignore
        else if (options.getUser("username").id === "264183823716057089" && user.id === "430518858097360907"){
            // @ts-ignore
            bedtimeSuccess = await bedtimeUser(guildmember)
            // @ts-ignore
            timeoutusername = guildmember.user.username + " has";
        }
        // @ts-ignore
        else if (interaction.memberPermissions.has("ADMINISTRATOR")){
            // @ts-ignore
            bedtimeSuccess = await bedtimeUser(guildmember)
            // @ts-ignore
            timeoutusername = guildmember.user.username + " has";
            // @ts-ignore
            console.log("Admin timed out user " + options.getUser("username").username)
        }
        if (bedtimeSuccess){
            // @ts-ignore
            await interaction.reply(timeoutusername + " requested to go to bed, see you in 6 hours!");
        }
        else{
            // @ts-ignore
            await interaction.reply("I am unable to send " + options.getUser("username").username + " to bed")
        }
        return;
    }

    //commands past this point need special perm
    if (user.id != "252818596777033729" && interaction.channelId != "805296027241676820"){
        await interaction.reply({content: "Only Jacques may control Robert here."})
        return;
    }

    if (commandName === "register"){
        // @ts-ignore
        var dcuserinput: DiscordJS.User = options.getUser("discordusername")
        // @ts-ignore
        var mcuserinput: string = options.getString("minecraftusername")
        console.log(`Attempt to register ${dcuserinput.username} : ${mcuserinput}`)
        var mcname = ""
        var mcuuid = ""
        try {
            const {name, id} = await fetch('https://api.mojang.com/users/profiles/minecraft/' + mcuserinput).then((response: { json: () => any; }) => response.json());
            mcuuid = id;
            mcname = name;
            if (mcuuid == null){
                await interaction.reply({ephemeral: true, content: "Cannot retrieve Minecraft uuid"})
                return;
            }
        } catch (err) {
            console.log(err)
            console.log("Invalid parameters")
            interaction.reply({ephemeral: true, content: "Cannot retrieve Minecraft uuid"})
            return;
        }
        // @ts-ignore
        var dcId = dcuserinput.id
        con.query(`INSERT INTO accountLinking VALUES (\'${dcId}\',\'${mcuuid}\')`, function (err: any, result: any, fields: any) {
            console.log(err)
            if (err) {
                if (err.errno == 1062) {
                    console.log("a")
                    interaction.reply({ephemeral: true, content: "This entry already exists"})
                    return;
                } else {
                    console.log("b")
                    interaction.reply({ephemeral: true, content: "Error processing request"})
                    return;
                }
            }
            var discordname = "Unknown user"
            if (dcuserinput != null) {
                discordname = getDiscordDisplayName(dcuserinput)
            }
            console.log("success")
            var response = `MC account ${escapeFormatting(mcname)} Linked to discord user ${escapeFormatting(discordname)}`
            const accountEmbed = new MessageEmbed()
                .setColor("#54fbfb")
                .setTitle(response)
            interaction.reply({embeds: [accountEmbed]});
            return;
        })
    }

    if (commandName === "unlink"){
        const dcUser = options.getUser("discordusername");
        const mcUser = options.getString("minecraftusername");
        if (dcUser == null && mcUser == null){
            interaction.reply("An input is required!")
        }

        const dcId = dcUser == null ? null : dcUser.id

        if (dcId != null){
            console.log(`deleting with discordID = ${dcId}`)
            con.query('DELETE FROM accountLinking WHERE discordId = ?', [dcId], function (err: any, result: any, fields: any) {
                // @ts-ignore
                interaction.channel.send(`Deleted ${result.affectedRows} results by discord name`)
            });
        }

        if (mcUser != null){
            const {name, id} = await fetch('https://api.mojang.com/users/profiles/minecraft/' + mcUser).then((response: { json: () => any; }) => response.json());
            const mcUuid = id;
            console.log(`deleting with mcID = ${mcUuid}`)
            if (mcUuid != null)
                con.query('DELETE FROM accountLinking WHERE minecraftUuid = ?', [mcUuid], function (err: any, result: any, fields: any) {
                    // @ts-ignore
                    interaction.channel.send(`Deleted ${result.affectedRows} results by minecraft name`)
                });
        }
        await interaction.reply("Processed");
        return;
    }

    if (commandName === "accept"){
        const theGuild = await client.guilds.fetch("706923004285812849");
        // @ts-ignore
        const guildInvite = await theGuild.systemChannel.createInvite({maxAge: 604800, maxUses: 1, unique: true});
        interaction.reply({
            content: `Thank you for your interest in ${SERVER_NAME}. Your application has been approved and you'll be whitelisted momentarily. \n` +
                "Please join the main server discord with this invite link: https://discord.gg/" + guildInvite.code + "\n" +
                "Other details about the server can be found in the #information tab\n" +
                `And welcome to ${SERVER_NAME}!`
        })
        return;
    }

    if (commandName === "whitelist"){

        await interaction.deferReply();

        if(options.getSubcommand() === "list"){
            con.query('SELECT name FROM whitelist GROUP BY name', function (err: any, result: any, fields: any) {
                if (err) throw err;
                const whitelistedPeople = new Set();
                for(var sqlItem of result){
                    whitelistedPeople.add(sqlItem['name']);
                }
                let outputString = "";
                for(var person of whitelistedPeople){
                    outputString += person + ", ";
                }
                outputString = escapeFormatting(outputString.slice(0,-2).toString()); //remove last comma and space
                const whitelistedEmbed = new MessageEmbed()
                    .setColor("#54fbfb")
                    .setTitle("Whitelisted Players")
                    .setDescription(outputString);
                interaction.editReply({embeds: [whitelistedEmbed]});
                return;
            });
        }

        //check if the username is a valid input before checking the other 3 options

        // @ts-ignore
        if(!verifyUsernameInput(options.getString("username"))){
            const whitelistedEmbed = new MessageEmbed()
                .setColor("#e11f1f")
                .setTitle(options.getString("username") + " is not a recognised username");
            interaction.editReply({embeds: [whitelistedEmbed]});
            return;
        }

        if(options.getSubcommand() === "verify"){
            con.query('SELECT name FROM whitelist WHERE name = ?', [options.getString("username")] , function (err: any, result: any, fields: any) {
                if (err) throw err
                console.log(result.length)
                if(result.length >= 1){
                    const whitelistedEmbed = new MessageEmbed()
                        .setColor("#1fe125")
                        .setTitle(result[0]["name"] + " is on the whitelist")
                    interaction.editReply({embeds: [whitelistedEmbed]})
                    return;
                }
                else {
                    const whitelistedEmbed = new MessageEmbed()
                        .setColor("#e11f1f")
                        .setTitle(options.getString("username") + " is not on the whitelist")
                    interaction.editReply({embeds: [whitelistedEmbed]})
                    return
                }
            })
        }

        if(options.getSubcommand() === "add"){
            var usernameWhitelisted = options.getString("username")
            // @ts-ignore
            usernameWhitelisted = escapeFormatting(usernameWhitelisted)
            con.query('INSERT INTO whitelist (uuid, name, whitelisted) VALUES (?,?,0)', [uuidv4(), options.getString("username")] , function (err: any, result: any, fields: any) {
                if (err) throw err
                const whitelistedEmbed = new MessageEmbed()
                    .setColor("#1FCCE1")
                    .setTitle(usernameWhitelisted + " has been added to the whitelist")
                interaction.editReply({embeds: [whitelistedEmbed]})
                return
            })
            return
        }

        if(options.getSubcommand() === "remove"){
            const mcUsername: string | null = options.getString("username") as string
            if (typeof mcUsername == null){
                await interaction.reply("Username is null! (jx0019)")
                return
            }
            con.query('SELECT name FROM whitelist WHERE name = ?', [mcUsername] , function (err: any, result: any, fields: any) {
                if (err) throw err;
                let resultCount = result.length
                if(result.length >= 5){
                    const whitelistedEmbed = new MessageEmbed()
                        .setColor("#e11f1f")
                        .setTitle("This cannot be done because Jac has probably done a bad, let him sort this one out (jx0020)");
                    interaction.editReply({embeds: [whitelistedEmbed]});
                    return
                }
                else if(result.length <= 0){
                    const whitelistedEmbed = new MessageEmbed()
                        .setColor("#e11f1f")
                        .setTitle(escapeFormatting(mcUsername) + " is not on the whitelist and cannot be removed");
                    interaction.editReply({embeds: [whitelistedEmbed]});
                    return
                }
                else {
                    con.query('DELETE FROM whitelist WHERE name = ?', [mcUsername] , function (err: any, result: any, fields: any) {
                        if (err) throw err
                        const whitelistedEmbed = new MessageEmbed()
                            .setColor("#E11F6E")
                            .setTitle(escapeFormatting(mcUsername) + " has been removed from the whitelist");
                        if(resultCount > 1){
                            whitelistedEmbed.setDescription("Note: Multiple entries have been removed");
                        }
                        interaction.editReply({embeds: [whitelistedEmbed]});
                        return
                    })
                }
            })
        }
        return
    }

    if (commandName === "purge"){
        try {
            await interaction.deferReply();
            let mcUsername = options.getString("mcusername")
            if (mcUsername == null) {
                await interaction.editReply("mc username is null! (jx0027)")
                return
            }
            if (!verifyUsernameInput(mcUsername)) {
                await interaction.editReply("Invalid name input")
                return
            }
            const {
                name,
                id
            } = await fetch('https://api.mojang.com/users/profiles/minecraft/' + options.getString("mcusername")).then((response: { json: () => any; }) => response.json())

            if (name == null && id == null) {
                interaction.editReply("This isn't working right now, try again later or bug Jacques about it")
                return
            }
            console.log(`dc id to look up = ${id}`)
            var returnString = `There is no record for mcUsername}`

            try {
                const result = await new Promise((resolve, reject) => {
                    con.query('SELECT discordId FROM accountLinking WHERE minecraftUuid = ?', [id], (err: any, result: any, fields: any) => {
                        if (err) reject(err)
                        resolve(result)
                    });
                });

                // @ts-ignore
                for (var sqlItem of result) {
                    var dcId = sqlItem['discordId']
                    console.log(`dcId = ${dcId}`)

                    var discordUsername: string = "Unknown user"
                    var discordUser: DiscordJS.User
                    try {
                        const discordUser : DiscordJS.User = await client.users.fetch(dcId)

                        let content = `Hi, I'm Robert, the robotic assistant for ${SERVER_NAME}. \n` +
                            "You have not joined the server for a while, and therefore you have been kicked from the server due to inactivity\n" +
                            "If you wish to rejoin, you will need to re-apply again at https://apply.divergentsmp.net/"
                        messageAndKick(interaction, escapeFormatting(mcUsername), interaction.user.username, discordUser, content)
                        await interaction.editReply({content: `${interaction.user.username} kicked ${escapeFormatting(mcUsername)} for inactivity`, components: []})
                    }
                    catch (error) {
                        console.log(`Error in sending message: ${error}`)
                        await interaction.editReply(`Error in sending message: ${error}`);
                        return
                    }
                }
                return
            } catch (error) {
                console.log("Error in SQL query: " + error)
            }
        }
        catch (e) {
            await interaction.editReply("Invalid name.")
            return
        }
    }
}

export function messageAndKick(interaction: Interaction, kickedMcUsername: String, kickerDcUsername: String, kickedDiscordUser: DiscordJS.User, kickMessage: string) {
    let discordUsername = getDiscordDisplayName(kickedDiscordUser)
    console.log(`discord user to purge is ${discordUsername}`)
    kickedDiscordUser.send({
        content: kickMessage
    }).then(result => {
        if (interaction.channel == null || interaction.guild == null) throw "channel or guild is null jx0026"
        const personDmMessage: string = `<:yes:897152291591819376> Sent a DM to ${discordUsername}`
        console.log(personDmMessage)
        interaction.channel.send(personDmMessage)

        interaction.guild.members.fetch(kickedDiscordUser).then(member => {
            member.kick()
        })

    }).catch(error => {
        console.log(`Error in sending message: ${error}`)
        return `Error in sending message: ${error}`
    })
}


async function bedtimeUser(memberitem: GuildMember) {
    try {
        await memberitem.timeout(6 * 60 * 60 * 1000, memberitem.user.username + " has requested to go to bed")
        console.log("timed out " + memberitem.user.username)
        return true
    } catch (error) {
        // @ts-ignore
        console.log(error.message)
        return false
    }
}