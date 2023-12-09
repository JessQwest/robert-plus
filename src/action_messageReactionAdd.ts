import * as DiscordJS from "discord.js"
import {Client, MessageReaction, PartialMessageReaction} from 'discord.js'
import {MessageActionRow, MessageButton} from "discord.js"
import {
    APPLICATION_MAJORITY_REQUIRED, APPLICATION_SHOP_MAJORITY_REQUIRED,
    NO_EMOJI_ID,
    REDSTONE_EMOJI,
    REDSTONE_EMOJI_ID, RULE_PHRASE_EMOJI,
    RULE_PHRASE_TEXT,
    staffReactThreshold,
    YES_EMOJI_ID
} from "./index"
import {unescapeFormatting} from "./utility"
import {
    InProgressApplication,
    postRegularRejectButtons,
    postRuleRejectButtons, postShopAcceptButton, postShopRejectButton
} from "./zTopic_application_management"
import {
    lookupApplicationByMessageSummaryId,
    QUESTION_SET_APPLICATION,
    QUESTION_SET_SHOP
} from "./zTopic_application_creator"

export async function messageReactionAdd(client: Client, reaction: MessageReaction | PartialMessageReaction) {
    console.log(`messageReactionAdd triggered`)

    if (reaction.message.content != null && reaction.message.content.toLowerCase().includes("what is this emoji") && reaction.emoji.name != null && reaction.emoji.id != null) {
        await reaction.message.reply(`\`<:${reaction.emoji.name.toString()}:${reaction.emoji.id.toString()}>\``)
    }

    const userApplication = lookupApplicationByMessageSummaryId(reaction.message.id)
    if (!(userApplication instanceof InProgressApplication)) {
        console.log("reaction is not for a valid application")
        return
    }
    console.log(`reaction on application: ${reaction.emoji.id}`)

    const reactionCache = reaction.message.reactions.cache

    if (reactionCache == null) {
        console.log("reactionCache is null (jx0008)")
        return
    }

    const mcUsername = userApplication.uniqueIdentifier

    const discordID: string = userApplication.discordId
    const applicationMessageID: string = userApplication.applicationMessageId

    const redstoneReactionCache = reactionCache.get(REDSTONE_EMOJI_ID) as DiscordJS.MessageReaction
    if (redstoneReactionCache != undefined && redstoneReactionCache.count != null && redstoneReactionCache.count == 1) {
        console.log(`ignoring response as it is redstoned 1 =! ${redstoneReactionCache.count} (jx0012)`)
        return
    }

    const questionSet = userApplication.questionSet
    let votesRequired: number = 1
    if (questionSet == QUESTION_SET_APPLICATION) {
        votesRequired = APPLICATION_MAJORITY_REQUIRED ? staffReactThreshold : 1
    } else if (questionSet == QUESTION_SET_SHOP) {
        votesRequired = APPLICATION_SHOP_MAJORITY_REQUIRED ? staffReactThreshold : 1
    }

    //yes votes
    if (reaction.emoji.id == YES_EMOJI_ID) {
        const yesVotes = reactionCache.get(YES_EMOJI_ID)
        if (yesVotes == null || typeof yesVotes == undefined) {
            console.log("reactionCache yes votes is null (jx0007)")
            return
        }

        console.log(`accept react for application count ${yesVotes.count - 1} of ${staffReactThreshold}`)

        if (yesVotes.count >= votesRequired + 1) {
            console.log(`${yesVotes.count - 1} exceeds threshold of ${staffReactThreshold}, posting new accept button`)

            if (questionSet == QUESTION_SET_APPLICATION) {
                const acceptButton = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setCustomId(`${unescapeFormatting(mcUsername)},${discordID},accept,${applicationMessageID}`)
                            .setLabel(`Accept ${unescapeFormatting(mcUsername)}`)
                            .setStyle('PRIMARY'),
                    )
                await reaction.message.channel.send({
                    content: `${mcUsername} has received enough votes to be accepted. Click the button to accept`,
                    components: [acceptButton]
                })
            } else if (questionSet == QUESTION_SET_SHOP) {
                postShopAcceptButton(userApplication.uniqueIdentifier, userApplication.answers[0], reaction.message.channel)
            }
            await reaction.message.react(REDSTONE_EMOJI)
        }
    }
    //votes for no
    else if (reaction.emoji.id == NO_EMOJI_ID) {
        const noVotes = reactionCache.get(NO_EMOJI_ID)
        if (noVotes == null || typeof noVotes == undefined) {
            console.log("reactionCache no votes is null (jx0007)")
            return
        }

        console.log(`deny react for application count ${noVotes.count - 1} of ${staffReactThreshold}`)

        if (noVotes.count >= votesRequired + 1) {
            console.log(`${noVotes.count - 1} exceeds threshold of ${staffReactThreshold}, posting new decline button`)

            if (questionSet == QUESTION_SET_APPLICATION) {
                postRegularRejectButtons(unescapeFormatting(mcUsername), discordID, reaction.message.channel, applicationMessageID)
            } else if (questionSet == QUESTION_SET_SHOP) {
                postShopRejectButton(userApplication.uniqueIdentifier, userApplication.answers[0], reaction.message.channel)
            }
            await reaction.message.react(REDSTONE_EMOJI)
        }
    } else if (reaction.emoji.toString() == RULE_PHRASE_EMOJI) {
        console.log(`${RULE_PHRASE_TEXT} has been reacted to a server application`)
        await reaction.message.react(REDSTONE_EMOJI)
        postRuleRejectButtons(unescapeFormatting(mcUsername), discordID, reaction.message.channel, reaction.message.id)
    }
}