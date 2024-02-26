import {
    ButtonInteraction,
    Client,
    GuildMember,
    Interaction, MessageActionRow, MessageButton,
    MessageEmbed, Modal,
    RateLimitError, Role,
    TextChannel, TextInputComponent, User
} from "discord.js"
import {
    countCharacterChanges,
    escapeFormatting, formatListOfStrings,
    getDiscordDisplayName,
    jaccardIndex,
    verifyUsernameInput
} from "./utility"
import * as DiscordJS from "discord.js"
import fetch from "node-fetch"
import {
    ALERT_CHANNEL, APPLICATION_CHANNEL_ID, APPLICATION_NOTIFICATION_CHANNEL_ID,
    BOT_INFO_CHANNEL_ID, client,
    con, DEBUGMODE, IS_APPLICATION_ENABLED, IS_MAP_APPLICATION_ENABLED, IS_SHOP_APPLICATION_ENABLED, MAIN_SERVER_ID,
    MUSEUM_ROLE_ID, NO_EMOJI, RULE_PHRASE_EMOJI,
    RULE_PHRASE_TEXT, SERVER_APPLICATION_URL,
    SERVER_NAME,
    YES_EMOJI
} from "./index"

// @ts-ignore
import { v4 as uuidv4 } from 'uuid'
import {nameToUuid, uuidToUsername} from "./api"
import {createRoleButton} from "./zTopic_role_manager"
import {startShopCheck} from "./zTopic_shop_check"

export async function interactionCreateCommand(client: Client, i: Interaction) {
    if (!i.isCommand()) return

    const { commandName, options, user, member, guild } = i

    if (commandName === "alert") {
        // @ts-ignore
        client.channels.cache.get(ALERT_CHANNEL).send(`@everyone ${user.username} has raised an alert in ${i.channel.toString()}`)
        await i.reply({
            content: "Staff have been silently notified of action in this channel.",
            ephemeral: true
        })
    }

    if (commandName === "museum") {
        if (i.guild == null) return
        i.guild.roles.fetch(MUSEUM_ROLE_ID).then(role => {
            // @ts-ignore
            client.channels.cache.get(BOT_INFO_CHANNEL_ID).send(`${user.username} has requested the Museum role`)
            // @ts-ignore
            i.member.roles.add(role)
            i.reply({
                content: "You now have a day pass to the DSMP Museum!",
                ephemeral: true
            })
        })
        return
    }

    if (commandName === "getdiscordname") {
        try {
            await i.deferReply({ephemeral: true})
            // @ts-ignore
            if (!verifyUsernameInput(options.getString("mcusername"))) {
                await i.editReply("Invalid name input")
                return
            }
            const {
                name,
                id
            } = await fetch('https://api.mojang.com/users/profiles/minecraft/' + options.getString("mcusername")).then((response: { json: () => any }) => response.json())

            if (name == null && id == null) {
                i.editReply("This isn't working right now, try again later or bug Jessica about it")
                return
            }
            console.log(`dc id to look up = ${id}`)
            var returnString = `There is no record for ${options.getString("mcusername")}`

            try {
                const result = await new Promise((resolve, reject) => {
                    con.query('SELECT discordId FROM accountLinking WHERE minecraftUuid = ?', [id], (err: any, result: any, fields: any) => {
                        if (err) reject(err)
                        resolve(result)
                    })
                })

                var firstEntry: boolean = true
                // @ts-ignore
                for (var sqlItem of result) {
                    var dcId = sqlItem['discordId']
                    console.log(`dcId = ${dcId}`)
                    var discordUsername: string = "Unknown user"
                    try {
                        const value = await client.users.fetch(dcId)
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
                i.editReply(returnString)
                return
            } catch (error) {
                console.log("Error in SQL query: " + error)
            }

        }
        catch (e) {
            await i.editReply("Invalid name.")
            return
        }
    }

    if (commandName === "getminecraftname") {
        await i.deferReply({ ephemeral: true })
        try {
            let discordUser = options.getUser("discordusername") as DiscordJS.User
            await con.query(`SELECT minecraftUuid FROM accountLinking WHERE discordId = '` + discordUser + "'", async function (err: any, result: any, fields: any) {
                console.log(`getminecraftname called for user ${options.getUser("discordusername")} - result of name lookup: ${result.map((row: any) => row['minecraftUuid']).join(', ')}`)

                const mcUuids = result.map((row: any) => row['minecraftUuid']);
                const names = await Promise.all(mcUuids.map(async (mcUuid: string) => await uuidToUsername(mcUuid)));

                await i.editReply(`${discordUser} is known on Minecraft by the ${names.length > 1 ? 'names' : 'name'}: ${escapeFormatting(formatListOfStrings(names))}`)
            })
        }
        catch (e) {
            await i.editReply("Failed to get Minecraft names");
            console.log(e);
        }
        return;
    }


    if (commandName === "nametouuid") {
        const username = options.getString("username")
        await i.deferReply({ephemeral: true})
        try{
            const uuid = await nameToUuid(username)
            if (uuid == "") {
                await i.editReply("No one appears to have this name")
                return
            }
            await i.editReply({content: `Name: ${username}\nUUID: ${uuid}`})
        }
        catch (err) {
            if (err instanceof Error) await i.editReply({content: err.toString()})
            else await i.editReply({content: "Unknown error (jx0003)"})
        }
    }

    if (commandName === "bedtime") {
        let bedtimeSuccess = false
        let targetedUser: User | null = options.getUser("username")
        let targetedGuildMember: GuildMember | undefined = undefined
        let adminTriggered: boolean = false
        if (targetedUser != null) {
            targetedGuildMember = await guild?.members.fetch(targetedUser)
            adminTriggered = true
        } else {
            targetedGuildMember = await guild?.members.fetch(i.user)
        }
        if (targetedGuildMember == undefined) {
            await i.reply("Cannot find user")
            return
        }
        // if a user has been targeted and the executer has admin perms
        if (adminTriggered && !i?.memberPermissions?.has("ADMINISTRATOR")) {
            bedtimeSuccess = await timeoutUser(targetedGuildMember, 6,`${targetedGuildMember.nickname} has been sent to bed by ${i.user.username}!`)
            if (bedtimeSuccess) {
                i.reply(`${targetedGuildMember.nickname} has been sent to bed by ${i.user.username}!`)
                return
            }
        } else {
            bedtimeSuccess = await timeoutUser(targetedGuildMember, 6, `${i.user.username} requested to go to bed`)
            if (bedtimeSuccess) {
                i.reply(`${i.user.username} requested to go to bed, see you in 6 hours!`)
                return
            }
        }
        await i.reply(`I am unable to send ${targetedGuildMember.nickname} to bed`)
        return
    }

    //commands past this point need special perm
    //=============================================================================================================================================================================================================================
    const isAdmin = ["252818596777033729", "699331874408890378", "616751114355736785", "284664965686624256", "346501391931408384"].includes(user.id)
    if (!isAdmin) {
        await i.reply({content: `Only staff may use this command. ${user.id}`, ephemeral: true})
        return
    }
    //=============================================================================================================================================================================================================================

    if (commandName === "timeout") {
        let targetedUser: User | null = options.getUser("user")
        if (targetedUser == null) {
            i.reply({content: "User not found (jx0067)", ephemeral: true})
            return
        }

        let hours: number | null = options.getInteger("hours")
        if (hours == null) {
            i.reply({content: "Hours not found (jx0069)", ephemeral: true})
            return
        }

        let targetedGuildMember: GuildMember | undefined = undefined
        targetedGuildMember = await guild?.members.fetch(targetedUser)

        if (targetedGuildMember == undefined) {
            i.reply({content: "User not found (jx0068)", ephemeral: true})
            return
        }

        const success = await timeoutUser(targetedGuildMember, hours,`${targetedGuildMember.nickname} has been timed out by ${i.user.username} for ${hours} hours.`)
        if (success) {
            i.reply(`${targetedGuildMember.nickname} has been timed out by ${i.user.username} for ${hours} hours.`)
        } else {
            i.reply(`I am unable to time out ${targetedGuildMember.nickname}. Please make sure the permissions are ok and that the timeout duration is between 1 and 672 hours (4 weeks)`)
        }
        return
    }


    if (commandName === "editshop") {
        const description: string | null = options.getString("description")
        if (description == null) return

        con.query(`SELECT * FROM shop`, function (err: any, result: any, fields: any) {
            if (err) {
                const errMsg = `${NO_EMOJI} SQL Error, Jess needs to look into this (jx0051)`
                console.error(errMsg, err)
                return
            }

            // ranks and scores all the results against each other
            const sortedResults = result.sort((a: any, b: any) => {
                const scoreA = jaccardIndex(`${a.shopType} ${a.shopOwner}`, description)
                const scoreB = jaccardIndex(`${b.shopType} ${b.shopOwner}`, description)
                return scoreB - scoreA
            })

            const editMessageActionRow = new MessageActionRow()
            const deleteMessageActionRow = new MessageActionRow()

            const MAX_SEARCH_COUNT: number = 3 // edit this to change the max number of returned results
            const rowsToPrint = sortedResults.slice(0, MAX_SEARCH_COUNT)
            let resultsString = ""
            for (let i = 0; i < rowsToPrint.length; i++) {
                resultsString += `${i + 1}: ${rowsToPrint[i].shopType} - ${escapeFormatting(rowsToPrint[i].shopOwner)}\n`

                const editButton = new MessageButton()
                    .setCustomId(`shop,editbyid,${rowsToPrint[i].shopId}`)
                    .setLabel(`Edit shop ${i + 1}`)
                    .setStyle('SECONDARY')
                editMessageActionRow.addComponents(editButton)

                const deleteButton = new MessageButton()
                    .setCustomId(`shop,deletebyid,${rowsToPrint[i].shopId}`)
                    .setLabel(`Delete shop ${i + 1}`)
                    .setStyle('DANGER')
                deleteMessageActionRow.addComponents(deleteButton)
            }

            i.reply({ content: `Here are the top ${rowsToPrint.length} results based on your search. Click a button below:\n${resultsString}`, components: [editMessageActionRow, deleteMessageActionRow] })
        })

        return
    }

    if (commandName === "register") {
        const dcUserInput: DiscordJS.User | null = options.getUser("discordusername")
        const mcUserInput: string | null = options.getString("minecraftusername")
        if (dcUserInput == null || mcUserInput == null) return
        console.log(`Attempt to register ${dcUserInput.username} : ${mcUserInput}`)
        let mcName = ""
        let mcuuid = ""
        try {
            const {name, id} = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcUserInput}`).then((response: { json: () => any }) => response.json())
            mcuuid = id
            mcName = name
            if (mcuuid == null) {
                await i.reply({ephemeral: true, content: "Cannot retrieve Minecraft uuid"})
                return
            }
        } catch (err) {
            console.log(err)
            console.log("Invalid parameters")
            i.reply({ephemeral: true, content: "Cannot retrieve Minecraft uuid"})
            return
        }
        // @ts-ignore
        let dcId = dcUserInput.id
        con.query(`INSERT INTO accountLinking VALUES (\'${dcId}\',\'${mcuuid}\')`, function (err: any, result: any, fields: any) {
            console.log(err)
            if (err) {
                if (err.errno == 1062) {
                    i.reply({ephemeral: true, content: "This entry already exists"})
                    return
                } else {
                    i.reply({ephemeral: true, content: "Error processing request"})
                    return
                }
            }
            var discordname = "Unknown user"
            if (dcUserInput != null) {
                discordname = getDiscordDisplayName(dcUserInput)
            }
            console.log("success")
            var response = `MC account ${escapeFormatting(mcName)} Linked to discord user ${escapeFormatting(discordname)}`
            const accountEmbed = new MessageEmbed()
                .setColor("#54fbfb")
                .setTitle(response)
            i.reply({embeds: [accountEmbed]})
            return
        })
    }

    if (commandName === "unlink") {
        const dcUser = options.getUser("discordusername")
        const mcUser = options.getString("minecraftusername")
        if (dcUser == null && mcUser == null) {
            await i.reply("An input is required!")
        }

        const dcId = dcUser == null ? null : dcUser.id

        if (dcId != null) {
            console.log(`deleting with discordID = ${dcId}`)
            con.query('DELETE FROM accountLinking WHERE discordId = ?', [dcId], function (err: any, result: any, fields: any) {
                // @ts-ignore
                i.channel.send(`Deleted ${result.affectedRows} results by discord name`)
            })
        }

        if (mcUser != null) {
            const {name, id} = await fetch('https://api.mojang.com/users/profiles/minecraft/' + mcUser).then((response: { json: () => any }) => response.json())
            const mcUuid = id
            console.log(`deleting with mcID = ${mcUuid}`)
            if (mcUuid != null)
                con.query('DELETE FROM accountLinking WHERE minecraftUuid = ?', [mcUuid], function (err: any, result: any, fields: any) {
                    // @ts-ignore
                    i.channel.send(`Deleted ${result.affectedRows} results by minecraft name`)
                })
        }
        await i.reply("Processed")
        return
    }

    if (commandName === "accept") {
        const theGuild = await client.guilds.fetch(MAIN_SERVER_ID)
        // @ts-ignore
        const guildInvite = await theGuild.systemChannel.createInvite({maxAge: 604800, maxUses: 1, unique: true}) // one week long invite
        await i.reply({
            content: `Thank you for your interest in ${SERVER_NAME}. Your application has been approved and you'll be whitelisted momentarily. \n` +
                "Please join the main server discord with this invite link: https://discord.gg/" + guildInvite.code + "\n" +
                "Other details about the server can be found in the #information tab\n" +
                `And welcome to ${SERVER_NAME}!`
        })
        return
    }

    if (commandName === "shopcheck") {
        if (i.channel == null) return
        startShopCheck(i.channel, i.user)
        i.reply({content: "Shop check started!", ephemeral: true})
        return
    }

    if (commandName === "whitelist") {

        await i.deferReply()

        if(options.getSubcommand() === "list") {
            con.query('SELECT name FROM whitelist GROUP BY name', function (err: any, result: any, fields: any) {
                if (err) throw err
                const whitelistedPeople = new Set()
                for(var sqlItem of result) {
                    whitelistedPeople.add(sqlItem['name'])
                }
                let outputString = ""
                for(var person of whitelistedPeople) {
                    outputString += person + ", "
                }
                outputString = escapeFormatting(outputString.slice(0,-2).toString()) //remove last comma and space
                const whitelistedEmbed = new MessageEmbed()
                    .setColor("#54fbfb")
                    .setTitle("Whitelisted Players")
                    .setDescription(outputString)
                i.editReply({embeds: [whitelistedEmbed]})
                return
            })
        }

        //check if the username is a valid input before checking the other 3 options

        // @ts-ignore
        if(!verifyUsernameInput(options.getString("username"))) {
            const whitelistedEmbed = new MessageEmbed()
                .setColor("#e11f1f")
                .setTitle(options.getString("username") + " is not a recognised username")
            await i.editReply({embeds: [whitelistedEmbed]})
            return
        }

        if(options.getSubcommand() === "verify") {
            con.query('SELECT name FROM whitelist WHERE name = ?', [options.getString("username")] , function (err: any, result: any, fields: any) {
                if (err) throw err
                console.log(result.length)
                if(result.length >= 1) {
                    const whitelistedEmbed = new MessageEmbed()
                        .setColor("#1fe125")
                        .setTitle(result[0]["name"] + " is on the whitelist")
                    i.editReply({embeds: [whitelistedEmbed]})
                    return
                }
                else {
                    const whitelistedEmbed = new MessageEmbed()
                        .setColor("#e11f1f")
                        .setTitle(options.getString("username") + " is not on the whitelist")
                    i.editReply({embeds: [whitelistedEmbed]})
                    return
                }
            })
        }

        if(options.getSubcommand() === "add") {
            var usernameWhitelisted = options.getString("username")
            // @ts-ignore
            usernameWhitelisted = escapeFormatting(usernameWhitelisted)
            con.query('INSERT INTO whitelist (uuid, name, whitelisted) VALUES (?,?,0)', [uuidv4(), options.getString("username")] , function (err: any, result: any, fields: any) {
                if (err) throw err
                const whitelistedEmbed = new MessageEmbed()
                    .setColor("#1FCCE1")
                    .setTitle(usernameWhitelisted + " has been added to the whitelist")
                i.editReply({embeds: [whitelistedEmbed]})
                return
            })
            return
        }

        if(options.getSubcommand() === "remove") {
            const mcUsername: string | null = options.getString("username") as string
            if (typeof mcUsername == null) {
                await i.reply("Username is null! (jx0019)")
                return
            }
            con.query('SELECT name FROM whitelist WHERE name = ?', [mcUsername] , function (err: any, result: any, fields: any) {
                if (err) throw err
                let resultCount = result.length
                if(result.length >= 5) {
                    const whitelistedEmbed = new MessageEmbed()
                        .setColor("#e11f1f")
                        .setTitle("This cannot be done because Jess has probably done a bad, let her sort this one out (jx0020)")
                    i.editReply({embeds: [whitelistedEmbed]})
                    return
                }
                else if(result.length <= 0) {
                    const whitelistedEmbed = new MessageEmbed()
                        .setColor("#e11f1f")
                        .setTitle(escapeFormatting(mcUsername) + " is not on the whitelist and cannot be removed")
                    i.editReply({embeds: [whitelistedEmbed]})
                    return
                }
                else {
                    con.query('DELETE FROM whitelist WHERE name = ?', [mcUsername] , function (err: any, result: any, fields: any) {
                        if (err) throw err
                        const whitelistedEmbed = new MessageEmbed()
                            .setColor("#E11F6E")
                            .setTitle(escapeFormatting(mcUsername) + " has been removed from the whitelist")
                        if(resultCount > 1) {
                            whitelistedEmbed.setDescription("Note: Multiple entries have been removed")
                        }
                        i.editReply({embeds: [whitelistedEmbed]})
                        return
                    })
                }
            })
        }
        return
    }

    if (commandName === "rolebutton") {
        let role = options.getRole("role")
        let inputChannel = options.getChannel("channel")
        let channel: TextChannel
        if (role == null || !(role instanceof Role)) return
        if (inputChannel != null && inputChannel instanceof TextChannel) {
            channel = inputChannel
        }
        else {
            channel = i.channel as TextChannel
        }
        await createRoleButton(role, channel)
        await i.reply({ephemeral: true, content: "Button created!"})
    }


    if (commandName === "purge") {
        try {
            await i.deferReply()
            let mcUsername = options.getString("mcusername")
            if (mcUsername == null) {
                await i.editReply("mc username is null! (jx0027)")
                return
            }
            if (!verifyUsernameInput(mcUsername)) {
                await i.editReply("Invalid name input")
                return
            }
            const {
                name,
                id
            } = await fetch('https://api.mojang.com/users/profiles/minecraft/' + options.getString("mcusername")).then((response: { json: () => any }) => response.json())

            if (name == null && id == null) {
                await i.editReply("This isn't working right now, try again later or bug Jessica about it")
                return
            }
            console.log(`dc id to look up = ${id}`)
            var returnString = `There is no record for mcUsername}`

            try {
                const result = await new Promise((resolve, reject) => {
                    con.query('SELECT discordId FROM accountLinking WHERE minecraftUuid = ?', [id], (err: any, result: any, fields: any) => {
                        if (err) reject(err)
                        resolve(result)
                    })
                })

                // @ts-ignore
                for (var sqlItem of result) {
                    var dcId = sqlItem['discordId']
                    console.log(`dcId = ${dcId}`)

                    var discordUsername: string = "Unknown user"
                    var discordUser: DiscordJS.User
                    try {
                        const discordUser : DiscordJS.User = await client.users.fetch(dcId)

                        let content = `Hi, I'm Robert, the robotic assistant for ${SERVER_NAME}. \n` +
                            `You have not joined the server for a while, and therefore you have been kicked from the server due to inactivity\n` +
                            `If you wish to rejoin, you will need to re-apply again at ${SERVER_APPLICATION_URL}`
                        messageAndKick(i, escapeFormatting(mcUsername), i.user.username, discordUser, content)
                        await i.editReply({content: `${i.user.username} kicked ${escapeFormatting(mcUsername)} for inactivity`, components: []})
                    }
                    catch (error) {
                        console.log(`Error in sending message: ${error}`)
                        await i.editReply(`Error in sending message: ${error}`)
                        return
                    }
                }
                return
            } catch (error) {
                console.log("Error in SQL query: " + error)
            }
        }
        catch (e) {
            await i.editReply("Invalid name.")
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
        const personDmMessage: string = `${YES_EMOJI} Sent a DM to ${discordUsername}`
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


async function timeoutUser(member: GuildMember, durationHours: number, reason: string) {
    try {
        if (durationHours > 672 || durationHours < 1) {
            return false
        }
        await member.timeout(durationHours * 60 * 60 * 1000, reason)
        console.log("timed out " + member.user.username)
        return true
    } catch (error) {
        console.log(error)
        return false
    }
}