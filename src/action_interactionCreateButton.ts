import {
    ButtonInteraction,
    Client,
    Interaction, InteractionReplyOptions, MessageActionRow, MessageButton,
    MessageEmbed, Modal, TextChannel, TextInputComponent
} from "discord.js"
import {escapeFormatting, getDiscordDisplayName, jaccardIndex, verifyUsernameInput} from "./utility"
import * as DiscordJS from "discord.js"
import {
    APPLICATION_CHANNEL_ID,
    APPLICATION_MAP_CHANNEL_ID,
    APPLICATION_NOTIFICATION_CHANNEL_ID,
    APPLICATION_SHOP_MESSAGE_ID,
    client,
    con,
    DEBUGMODE,
    IS_APPLICATION_ENABLED,
    IS_MAP_APPLICATION_ENABLED,
    IS_SHOP_APPLICATION_ENABLED,
    NO_EMOJI,
    RULE_PHRASE_EMOJI,
    RULE_PHRASE_TEXT,
    SERVER_NAME,
    YES_EMOJI
} from "./index"

// @ts-ignore
import { v4 as uuidv4 } from 'uuid'
import {nameToUuid} from "./api"
import {
    applicationStatusDictionary,
    rebuildMapMessage, rebuildShopMessage,
    removeActiveApplication, removeActiveApplicationByUniqueIdentifier,
    removeMapCoord
} from "./zTopic_application_management"
import {
    buttonAgreeQuestion,
    buttonCancelApplication,
    buttonGotoNextQuestion,
    buttonGotoPreviousQuestion,
    buttonPostApplication,
    buttonSkipQuestion,
    createApplication, dismissApplication, lookupApplication,
    lookupApplicationByUniqueIdentifier,
    QUESTION_SET_APPLICATION,
    QUESTION_SET_MAP,
    QUESTION_SET_SHOP
} from "./zTopic_application_creator"
import {manageUserRole} from "./zTopic_role_manager"
import {messageAndKick} from "./action_interactionCreateCommand"
import {createShopEditModal} from "./action_interactionCreateModal"

export var buttonIDSet : Set<string> = new Set
export async function interactionCreateButton(client: Client, i: Interaction) {
    //checking for valid button
    if (!i.isButton()) return

    if (i.channel == null) {
        console.log("Interaction created but channel is unknown! (jx0013)")
        await i.deferUpdate()
        return
    }
    if (i.message.author.id != client.user?.id) {
        console.log(`Interaction created but message author is not this bot! ${i.message.author} ${client.user} (jx0062)`)
        return
    }

    //prepare valid button
    const b: ButtonInteraction = i
    console.log(`Button pressed! ${b.component.label}`)

    //process custom ID
    console.log(`Splitting up custom id, input: ${b.customId}`)
    const customID = b.customId
    const splitCustomId = customID.split(",")

    // check if an application button was pressed
    if (splitCustomId[0] === "application") {
        if (splitCustomId[1] === "start") {
            //check if creating application is allowed
            const applicationType = splitCustomId[2]
            if (DEBUGMODE && i.user.id != "252818596777033729" && i.guild?.id != "772844397020184576") {
                await i.reply({ ephemeral: true, content: `Applications are currently disabled. Please try again later.` })
                return
            }
            if (applicationType == QUESTION_SET_APPLICATION && IS_APPLICATION_ENABLED == false) {
                await i.reply({ ephemeral: true, content: `Applications are currently disabled. Please try again later.` })
                return
            } else if (applicationType == QUESTION_SET_SHOP && IS_SHOP_APPLICATION_ENABLED == false) {
                await i.reply({ ephemeral: true, content: `Shop applications are currently disabled. Please try again later.` })
                return
            } else if (applicationType == QUESTION_SET_MAP && IS_MAP_APPLICATION_ENABLED == false) {
                await i.reply({ ephemeral: true, content: `Updating coordinates is currently disabled. Please try again later.` })
                return
            }

            const startApplicationResponse = await createApplication(i.user, splitCustomId[2])
            await i.reply({ ephemeral: true, content: startApplicationResponse })
            return
        }
        else if (splitCustomId[1] === "previous") {
            await buttonGotoPreviousQuestion(i.user)
            await i.deferUpdate()
        }
        else if (splitCustomId[1] === "next") {
            await buttonGotoNextQuestion(i.user)
            await i.deferUpdate()
        }
        else if (splitCustomId[1] === "submit") {
            await buttonPostApplication(i.user)
            await i.deferUpdate()
        }
        else if (splitCustomId[1] === "cancel") {
            await buttonCancelApplication(i.user)
            await i.deferUpdate()
        }
        else if (splitCustomId[1] === "skip") {
            await buttonSkipQuestion(i.user)
            await i.deferUpdate()
        }
        else if (splitCustomId[1] === "agree") {
            await buttonAgreeQuestion(i.user)
            await i.deferUpdate()
        }
        else if (splitCustomId[1] === "removemap") {
            removeMapCoord(i.user.id)
            await rebuildMapMessage()
            await i.reply({ephemeral: true, content: "Your map coordinates have been removed if you had any."})
        }
        else if (splitCustomId[1] === "dismiss") {
            if (!(i.component instanceof MessageButton)) return
            if (splitCustomId.length >= 4 && splitCustomId[3] == "confirm") {
                // if this is a confirmation button
                let application = lookupApplicationByUniqueIdentifier(splitCustomId[2])
                let messageId = await dismissApplication(splitCustomId[2])
                if (messageId == null) {
                    await i.update({ content: `Could not dismiss the application. It might have already been dismissed`, components: [] })
                    await i.deferUpdate()
                    return
                }
                let applicationMessage = await i.channel.messages.fetch(messageId)
                applicationMessage.react(`🚫`)
                // for main applications, react to the main application and record in the database
                if (application?.questionSet == QUESTION_SET_APPLICATION) {
                    let appChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID)
                    if (appChannel != null && appChannel.isText()) {
                        let message = appChannel.messages.cache.get(application.applicationMessageId)
                        if (message != null) message.react(`🚫`)
                    }
                    con.query(`UPDATE applicationhistory SET status = ? WHERE messageId = ?`, ["dismissed", messageId], (err: any, result: { affectedRows: number }) => {
                        if (err) {
                            console.error('Error updating status:', err)
                        } else {
                            if (result.affectedRows > 0) {
                                console.log(`Status updated for message ID ${messageId}`)
                            } else {
                                console.log(`No rows were affected for message ID ${messageId}`)
                            }
                        }
                    })
                }
                await applicationMessage.reply({content: `This application has been dismissed by ${i.user.username}` })
                await i.update({ content: `You have dismissed this application`, components: [] })
                await i.deferUpdate()
            } else {
                // if not a confirmation button, post one
                const application = lookupApplicationByUniqueIdentifier(splitCustomId[2])
                if (application == null) {
                    await i.deferUpdate()
                    return
                }
                const reply = await getConfirmationButton(i.component)
                i.reply(reply)
            }
        }
        return
    }

    // will be in format role,<add/remove>,<roleId>. userId is taken from interaction
    if (splitCustomId[0] === "role") {
        const response = await manageUserRole(i, splitCustomId[1],splitCustomId[2])
        await i.reply({ ephemeral: true, content: response })
        return
    }

    if (splitCustomId[0] === "shop" && splitCustomId[1] === "editbyuuid") {
        // get the applicant for that specific application
        const application = lookupApplicationByUniqueIdentifier(splitCustomId[2])
        if (application == null) return
        const applicantId = application.discordId
        const applicant = await client.users.fetch(applicantId)
        if (applicant == null) return

        // Create the modal
        const modal = createShopEditModal("uuid", splitCustomId[2], application.answers[0], application.answers[1], application.answers[2], application.answers[3])
        // Show the modal to the user
        await i.showModal(modal)
        return
    }

    if (splitCustomId[0] === "shop" && splitCustomId[1] === "editbyid") {

        con.query(`SELECT * FROM shop where shopId = ?`, [splitCustomId[2]], function (err: any, result: any, fields: any) {
            if (err) {
                const errMsg = `${NO_EMOJI} SQL Error, Jess needs to look into this (jx0051)`
                console.error(errMsg, err)
                return
            }
            if (result.length > 0) {
                const {
                    shopId,
                    shopOwner,
                    shopType,
                    xCoord,
                    zCoord,
                } = result[0]

                console.log(`shopId: ${shopId}, shopOwner: ${shopOwner}, shopType: ${shopType}, xCoord: ${xCoord}, zCoord: ${zCoord}`)
                // Create the modal
                const modal = createShopEditModal("id", splitCustomId[2], shopOwner, shopType, xCoord, zCoord)
                // Show the modal to the user
                i.showModal(modal)
                return
            } else {
                console.log('No rows found.')
            }
        })

        // get the applicant for that specific application
        const application = lookupApplicationByUniqueIdentifier(splitCustomId[2])
        if (application == null) return
        const applicantId = application.discordId
        const applicant = await client.users.fetch(applicantId)
        if (applicant == null) return

        // Create the modal
        const modal = new Modal()
            .setCustomId(splitCustomId[2])
            .setTitle(`Edit application: ${application.answers[0]}`)
        // Add components to modal
        // Create the text input components
        const shopOwnerInput = new TextInputComponent()
            .setCustomId('shopOwner')
            .setLabel("List of shop owner IGNs")
            .setValue(application.answers[0])
            .setStyle('SHORT')
        const shopTypeInput = new TextInputComponent()
            .setCustomId('shopType')
            .setLabel("Shop Type")
            .setValue(application.answers[1])
            .setStyle('SHORT')
        const xCoordInput = new TextInputComponent()
            .setCustomId('xCoord')
            .setLabel("X coordinate")
            .setValue(application.answers[2])
            .setStyle('SHORT')
        const zCoordInput = new TextInputComponent()
            .setCustomId('zCoord')
            .setLabel("Z coordinate")
            .setValue(application.answers[3])
            .setStyle('SHORT')
        // An action row only holds one text input,
        // so you need one action row per text input.
        // @ts-ignore
        const actionRow1 = new MessageActionRow().addComponents(shopOwnerInput)
        // @ts-ignore
        const actionRow2 = new MessageActionRow().addComponents(shopTypeInput)
        // @ts-ignore
        const actionRow3 = new MessageActionRow().addComponents(xCoordInput)
        // @ts-ignore
        const actionRow4 = new MessageActionRow().addComponents(zCoordInput)
        // @ts-ignore
        modal.addComponents(actionRow1, actionRow2, actionRow3, actionRow4)
        // Show the modal to the user
        await i.showModal(modal)
        return
    }

    if (splitCustomId[0] === "shop" && splitCustomId[1] === "deletebyid") {
        if (!(i.component instanceof MessageButton)) return
        if (splitCustomId.length >= 4 && splitCustomId[3] == "confirm") {
            // if this is a confirmation button
            // find the shop information to delete
            let currentShopOwner: string
            let currentShopType: string
            con.query(`SELECT * FROM shop where shopId = ?`, [splitCustomId[2]], function (err: any, result: any, fields: any) {
                if (err) {
                    const errMsg = `${NO_EMOJI} SQL Error, Jess needs to look into this (jx0051)`
                    console.error(errMsg, err)
                    return
                }
                if (result.length > 0) {
                    const {
                        shopId,
                        shopOwner,
                        shopType,
                        xCoord,
                        zCoord,
                    } = result[0]
                    currentShopOwner = shopOwner
                    currentShopType = shopType
                }
            })
            // then delete it
            con.query(`DELETE FROM shop WHERE shopId = ?`, [splitCustomId[2]], function (err: any, result: any, fields: any) {
                if (err) {
                    const errMsg = `${NO_EMOJI} SQL Error, Jess needs to look into this (jx0063)`
                    console.error(errMsg, err)
                    return
                }
                if (result.affectedRows > 0) {
                    console.log(`Deleted shop with id ${splitCustomId[2]}`)
                    i.channel?.send({content: `Deleted shop: ${currentShopType} - ${currentShopOwner}`})
                    rebuildShopMessage()
                } else {
                    console.log('No rows found.')
                    i.reply({content: `Could not find the shop, it might have already been deleted.`, ephemeral: true})
                }
            })
        } else {
            // if not a confirmation button, post one if such a record exists
            con.query(`SELECT * FROM shop where shopId = ?`, [splitCustomId[2]], function (err: any, result: any, fields: any) {
                if (err) {
                    const errMsg = `${NO_EMOJI} SQL Error, Jess needs to look into this (jx0051)`
                    console.error(errMsg, err)
                    return
                }
                if (result.length > 0) {
                    i.reply({content: `This shop does not appear to exist!`, ephemeral: true})
                    return
                }
            })
            const reply = await getConfirmationButton(i.component)
            i.reply(reply)
        }
        return
    }

    // buttons past this point are single use and can only be interacted with one

    // check for button clash
    if (!buttonIDSet.has(b.message.id)) {
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

    // check if button is for a shop
    if (splitCustomId[0] === "shop") {
        // get the applicant for that specific application
        const application = lookupApplicationByUniqueIdentifier(splitCustomId[2])
        if (application == null) return
        const applicantId = application.discordId
        const applicant = await client.users.fetch(applicantId)
        if (applicant == null) return

        if (splitCustomId[1] === "accept") {
            await removeActiveApplicationByUniqueIdentifier(splitCustomId[2])

            con.query('INSERT INTO shop (shopOwner, shopType, xCoord, zCoord) VALUES (?,?,?,?)', [application.answers[0], application.answers[1], application.answers[2], application.answers[3]] , function (err: any, result: any, fields: any) {
                if (err) {
                    const errorMessage = `${NO_EMOJI} SQL Error 2, Jess needs to look into this (jx0050)`
                    i.channel?.send(errorMessage)
                    console.error(`${errorMessage}: ${err}`)
                }
                i.channel?.send(`The shop request has been accepted`)
                i.update({ content: `The shop request for ${application.answers[0]} was accepted by ${b.user.username}`, components: [] })
            })

            await applicant.send(`Your shop application has been accepted. 🎉`)
            await rebuildShopMessage()
        } else if (splitCustomId[1] === "reject") {
            await removeActiveApplicationByUniqueIdentifier(splitCustomId[2])
            await applicant.send(`Your shop application has been rejected. 🙁`)
            i.update({ content: `The shop request for ${application.answers[0]} was rejected by ${b.user.username}`, components: [] })
        }
        else {
            console.error(`Invalid shop button custom id ${splitCustomId[1]}: (jx0049)`)
        }
        return
    }

    // must be a button for an application
    if (splitCustomId.length < 2) {
        console.log(`Invalid custom id input (jx0016)`)
    }
    let mcUsername = splitCustomId[0]
    const escapedMcUsername = escapeFormatting(mcUsername)
    console.log(`Collected mcUsername from customId, unescaped: ${mcUsername} & escaped ${escapedMcUsername}`)
    const dcId = splitCustomId[1]
    const reason = splitCustomId[2]
    const messageId = splitCustomId[3]
    console.log(`Processing ${mcUsername} (DcId: ${dcId}) for ${reason}. Message ID: ${messageId}`)

    await removeActiveApplication(messageId)

    // post intentions in notification channel
    let reasonText: string | undefined = undefined
    if (typeof reason === 'string') reasonText = applicationStatusDictionary[reason]
    let notificationChannel = client.channels.cache.get(APPLICATION_NOTIFICATION_CHANNEL_ID)
    if (reasonText != null && notificationChannel != null && notificationChannel.isText()) {
        notificationChannel.send(`${escapedMcUsername}: ${reasonText}`)
    }

    let discordUser: DiscordJS.User | undefined
    let discordUsername: string = "Unknown user"
    const userPromise = client.users.fetch(dcId).then(value => {
        discordUser = value
        discordUsername = getDiscordDisplayName(discordUser)
        return value
    }).catch(error => {
        console.log(`Error in getting username: ${error} (jx0017)`)
        if (i.channel == null) {
            console.log(`Error in reporting getting username error (jx0018)`)
            return
        }
        i.channel.send("Could not get discord username, Jess probably did a bad")
        return
    })

    await userPromise

    if (discordUser == null) {
        console.log("discord user is undefined! (jx0021)")
        return
    }

    let appChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID)
    if (appChannel != null && appChannel.isText()) {
        let message = appChannel.messages.cache.get(messageId)
        if (message != null) {
            con.query(`UPDATE applicationhistory SET status = ? WHERE messageId = ?`, [reason, messageId], (err: any, result: { affectedRows: number }) => {
                if (err) {
                    console.error('Error updating status:', err)
                } else {
                    if (result.affectedRows > 0) {
                        console.log(`Status updated for message ID ${messageId}`)
                    } else {
                        console.log(`No rows were affected for message ID ${messageId}`)
                    }
                }
            })

            if (reason == "accept") {
                message.react(YES_EMOJI)
            } else if (reason == "rulereject" || reason == "rulerejectkick") {
                message.react(RULE_PHRASE_EMOJI)
            } else { // if not accept must be a reject
                message.react(NO_EMOJI)
            }
        }
    }

    if (reason == "accept") {
        var whitelistMessage = ""
        var accountLinkMessage = ""
        var personDmMessage = ""

        //WHITELISTING
        // @ts-ignore
        if(!verifyUsernameInput(mcUsername)) {
            whitelistMessage = `${NO_EMOJI} ${escapedMcUsername} is not a recognised username`
        }
        else
        {
            console.log("mc username verified")
            con.query('SELECT name FROM whitelist WHERE name = ? AND whitelisted = 0', [mcUsername], function (err: any, result: any, fields: any) {
                console.log("select statement")
                if (err) {
                    whitelistMessage = `${NO_EMOJI} SQL Error 1, Jess needs to look into this (jx0005)`
                    console.error(err)
                }
                else {
                    console.log("Number of people with this name already in whitelist: " + result.length)
                }
                if (result.length > 0) {
                    whitelistMessage = "<:maybe:1024499432781254697> " + escapeFormatting(mcUsername) + " is already in the whitelist"
                }
                else{
                    con.query('INSERT INTO whitelist (uuid, name, whitelisted) VALUES (?,?,0)', [uuidv4(), mcUsername] , function (err: any, result: any, fields: any) {
                        if (err) {
                            whitelistMessage = `${NO_EMOJI} SQL Error 2, Jess needs to look into this (jx0022)`
                            console.error(err)
                        }
                        whitelistMessage = `${YES_EMOJI} ${escapedMcUsername} has been added to the whitelist`
                    })
                }
            })
        }
        //ACCOUNT LINKING
        console.log(`Attempt to register ${dcId} : ${mcUsername}`)
        const mcUuid = await nameToUuid(mcUsername)
        if (mcUuid != null) {
            con.query(`INSERT INTO accountLinking VALUES (\'${dcId}\',\'${mcUuid}\')`, function (err: any, result: any, fields: any) {
                if (err) {
                    if (err.errno == 1062) {
                        accountLinkMessage = "<:maybe:1024499432781254697> This account has already been linked"
                        console.log(accountLinkMessage)
                    } else {
                        accountLinkMessage = `${NO_EMOJI} Error processing request, Jess needs to look into this`
                        console.error("errno: " + err.errno)
                        console.error(err)
                    }
                }
                else{
                    console.log("success")
                    accountLinkMessage = `${YES_EMOJI} MC account ${escapedMcUsername} linked to Discord user ${escapeFormatting(discordUsername)}`
                    console.log(accountLinkMessage)
                }
            })
        }
        else { //fail
            accountLinkMessage = `${NO_EMOJI} SQL connection error 4, Jess needs to look into this`
            console.log(accountLinkMessage)
        }


        try{
            const theGuild = await client.guilds.fetch("706923004285812849")

            // @ts-ignore
            console.log("attempting message send to " + discordUser.username)
            // @ts-ignore
            const guildInvite = await theGuild.systemChannel.createInvite({maxAge: 604800, maxUses: 1, unique: true}).catch(error => {
                // @ts-ignore
                i.channel.send("Error in generating invite link: " + error)
                personDmMessage = `${NO_EMOJI} Could not generate server invite, Jess needs to look into this`
            }).then(invite => {
                // @ts-ignore
                discordUser.send({
                    content: `Thank you for your interest and application for ${SERVER_NAME}. Your application has been approved and you have been whitelisted on the server.\n` +// @ts-ignore
                        `Please join the main server discord with this invite link: https://discord.gg/${invite.code}\n` +
                        `Other details about the server such as the IP address can be found in the #information channel. You don't need to be in the application server anymore.\n` +
                        `Welcome to ${SERVER_NAME}!`
                }).then(result => {
                    // @ts-ignore
                    personDmMessage = `${YES_EMOJI} Sent a DM to ${getDiscordDisplayName(discordUser)}`
                    console.log(`ACCEPT MESSAGE SENT OK FOR ${discordUser?.username}`)
                }).catch(error => { // @ts-ignore
                    console.log("Error in sending message: " + error)
                    personDmMessage = `${NO_EMOJI} Could not send the DM. type /accept and do manually.`
                })
            })
        }
        catch (err) {
            personDmMessage = `${NO_EMOJI} Could not generate server invite, Jess needs to look into this`
            console.log(err)
        }

        //END RESULT
        await i.update({ content: `${escapedMcUsername} was accepted by ${b.user.username}`, components: [] })

        let sleep = async (ms: number) => await new Promise(r => setTimeout(r,ms))
        try{
            await sleep(4000)
        }
        catch (err) {
        }

        const acceptEmbed = new MessageEmbed()
            .setColor("#12ce0c")
            .setTitle(`Accept status for ${escapeFormatting(mcUsername)}`)
            .setDescription(`**Added to whitelist:** ${whitelistMessage}\n` +
                `**Account linked:** ${accountLinkMessage}\n` +
                `**Person DM'd:** ${personDmMessage}`)
        console.log(`EMBED PREPARED`)

        i.channel.send({embeds: [acceptEmbed]})
    }

    if (reason == "rulereject") {
        await i.update({ content: `${escapedMcUsername} was ${RULE_PHRASE_TEXT} rejected by ${b.user.username}`, components: [] })
        await discordUser.send({
            content: `Thank you for your application to ${SERVER_NAME}! Unfortunately your application has been denied at this time for failure to read the rules. Once you've had a chance to look over them, please feel free to reapply!`
        }).then(result => {
            i.channel?.send(`${YES_EMOJI} Sent a ${RULE_PHRASE_TEXT} reject DM to ${discordUsername}`)
            console.log(`RULE REJECT MESSAGE SENT OK FOR ${discordUser?.username}: ${result}`)
            return
        }).catch(error => {
            console.log(`Error in sending message: ${error}`)
            i.channel?.send(`${NO_EMOJI} Could not send the DM. You will need to send manually (jx0023: ${error})`)
            return
        })
    }

    if (reason == "rulerejectkick") {
        messageAndKick(i, escapedMcUsername, b.user.username, discordUser, `Thank you for your application to ${SERVER_NAME}! Unfortunately your application has been denied at this time for failure to read the rules.`)
        await i.update({ content: `${escapedMcUsername} was ${RULE_PHRASE_TEXT} rejected and kicked by ${b.user.username}`, components: [] })
    }

    if (reason == "badappreject") {
        messageAndKick(i, escapedMcUsername, b.user.username, discordUser, `Thank you for your interest in ${SERVER_NAME}!\nUnfortunately, your application did not receive enough staff votes to be accepted at this server.\nHave a great day.`)
        await i.update({ content: `${escapedMcUsername} was rejected and kicked by ${b.user.username} for a bad application`, components: [] })
    }

    if (reason == "underagereject") {
        messageAndKick(i, escapedMcUsername, b.user.username, discordUser, `Thank you for your interest in ${SERVER_NAME}. Unfortunately your application has been denied at this time due to our 16+ age requirement.\nPlease feel free to reapply when you are 16!`)
        await i.update({ content: `${escapedMcUsername} was rejected and kicked by ${b.user.username} for underage application`, components: [] })
    }

    if (reason == "genericreject") {
        messageAndKick(i, escapedMcUsername, b.user.username, discordUser, `Thank you for your interest in ${SERVER_NAME}!\nUnfortunately, your application on this occasion has not been successful.\nHave a great day.`)
        await i.update({ content: `${escapedMcUsername} was rejected and kicked by ${b.user.username} for a bad application`, components: [] })
    }
}

export async function getConfirmationButton(button: MessageButton): Promise<InteractionReplyOptions> {
    const buttonLabel = button.label
    const buttonId = button.customId

    const reply: InteractionReplyOptions = {
        content: "Click the button to confirm this action.",
        ephemeral: true,
        components: [
            new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId(`${buttonId},confirm`)
                        .setLabel(`Confirm ${buttonLabel}`)
                        .setStyle('DANGER')
                )
        ]
    }
    return reply
}