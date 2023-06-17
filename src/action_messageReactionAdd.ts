import * as DiscordJS from "discord.js"
import {Client, MessageReaction, PartialMessageReaction} from 'discord.js'
import {MessageActionRow, MessageButton} from "discord.js"
import {
    NO_EMOJI_ID, postRegularRejectButtons, postRuleRejectButtons,
    REDSTONE_EMOJI,
    REDSTONE_EMOJI_ID, RULE_PHRASE_EMOJI,
    RULE_PHRASE_TEXT,
    staffReactThreshold,
    YES_EMOJI_ID
} from "./index";
import {unescapeFormatting} from "./utility";

export async function messageReactionAdd(client: Client, reaction: MessageReaction | PartialMessageReaction) {
    console.log(`messageReactionAdd triggered`)

    if (reaction.message.content != null && reaction.message.content.toLowerCase().includes("what is this emoji") && reaction.emoji.name != null && reaction.emoji.id != null) {
        await reaction.message.reply(reaction.emoji.name.toString() + reaction.emoji.id.toString())
    }

    if (reaction.message.embeds.length == 0) {
        console.log(`reaction on non embed: ${reaction.emoji.toString()} (jx0009)`)
        return
    }
    if (reaction.message.embeds[0].description == null || reaction.message.embeds[0].footer == null) {
        console.log(`reaction on embed missing description or footer: ${reaction.emoji.toString()} (jx0010)`)
        return
    }
    if (reaction.message.author == null) {
        console.log("reaction message author is null (jx0004)")
        return
    }
    if (reaction.message.embeds[0].title == null || reaction.message.embeds[0].title.toString() != "New Application - Please vote" || reaction.message.author.id != "969760796278157384") {
        console.log("reaction is not for a valid application")
        return
    }
    console.log(`reaction on application: ${reaction.emoji.id}`)

    const embedBlockText = reaction.message.embeds[0].description
    const usernameBlock = embedBlockText.match("IGN:\\s*.+\\s*Discord")

    if (usernameBlock == null) {
        console.log("username block text is null (jx0006)")
        return
    }

    const usernameBlockText = usernameBlock.toString()
    const reactionCache = reaction.message.reactions.cache

    if (reactionCache == null) {
        console.log("reactionCache is null (jx0008)")
        return
    }

    const mcusername = usernameBlockText.slice(5, -8)
    const discordID: string = reaction.message.embeds[0].footer.text

    const redstoneReactionCache = reactionCache.get(REDSTONE_EMOJI_ID) as DiscordJS.MessageReaction
    if (redstoneReactionCache != undefined && redstoneReactionCache.count != null && redstoneReactionCache.count == 1) {
        console.log(`ignoring response as it is redstoned 1 =! ${redstoneReactionCache.count} (jx0012)`)
        return
    }

    //yes votes
    if (reaction.emoji.id == YES_EMOJI_ID) {
        const yesVotes = reactionCache.get(YES_EMOJI_ID)
        if (yesVotes == null || typeof yesVotes == undefined) {
            console.log("reactionCache yes votes is null (jx0007)")
            return
        }

        console.log(`accept react for application count ${yesVotes.count - 1} of ${staffReactThreshold - 1}`)

        if (yesVotes.count >= staffReactThreshold) {
            console.log(`${yesVotes.count} exceeds threshold of ${staffReactThreshold}, posting new accept button`)

            const acceptButton = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId(`${unescapeFormatting(mcusername)},${discordID},accept`)
                        .setLabel(`Accept ${unescapeFormatting(mcusername)}`)
                        .setStyle('PRIMARY'),
                )
            await reaction.message.react(REDSTONE_EMOJI)
            await reaction.message.channel.send({
                content: `${mcusername} has received enough votes to be accepted. Click the button to accept`,
                components: [acceptButton]
            })
        }
    }
    //votes for no
    else if (reaction.emoji.id == NO_EMOJI_ID) {
        const noVotes = reactionCache.get(NO_EMOJI_ID)
        if (noVotes == null || typeof noVotes == undefined) {
            console.log("reactionCache no votes is null (jx0007)")
            return
        }

        console.log(`deny react for application count ${noVotes.count - 1} of ${staffReactThreshold - 1}`)

        if (noVotes.count >= staffReactThreshold) {
            console.log(`${noVotes.count} exceeds threshold of ${staffReactThreshold}, posting new decline button`)

            postRegularRejectButtons(unescapeFormatting(mcusername), discordID, reaction.message.channel)
            await reaction.message.react(REDSTONE_EMOJI)
        }
    } else if (reaction.emoji.toString() == RULE_PHRASE_EMOJI) {
        console.log(`${RULE_PHRASE_TEXT} has been reacted to a server application`)
        await reaction.message.react(REDSTONE_EMOJI)
        postRuleRejectButtons(unescapeFormatting(mcusername), discordID, reaction.message.channel)
    }
}