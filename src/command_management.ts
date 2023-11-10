import * as DiscordJS from "discord.js"
import {client} from "./index"

export function registerCommands() {

    const testGuildID = '706923004285812849'
    const testGuild = client.guilds.cache.get(testGuildID)

    let commands

    if (testGuild) {
        commands = testGuild.commands
    }
    else {
        commands = client.application?.commands
    }

    /* PROCESS TO DELETE COMMAND*/
    /*
   // @ts-ignore
   client.application.commands.fetch('975103804766842971') // id of your command to delete
       .then( (command) => {
           console.log(`Fetched command ${command.name}`)
           // further delete it like so:
           command.delete()
           console.log(`Deleted command ${command.name}`)
       }).catch(console.error)
    */

    commands?.create({
        name: 'accept',
        description: "Creates an accept message to copy and paste"
    })

    commands?.create({
        name: 'alert',
        description: "Sends a silent alert to the staff that this text channel may need moderation attention"
    })

    commands?.create({
        name: 'museum',
        description: "Grants you a day pass to the DSMP Discord Museum"
    })

    commands?.create({
        name: 'nametouuid',
        description: "Get the UUID of a username",
        options: [{
            name: "username",
            description: "The username that you would the UUID for",
            required: true,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
        }]
    })

    commands?.create({
        name: 'getdiscordname',
        description: "Get the Discord name associated with an MC IGN",
        options: [{
            name: "mcusername",
            description: "The MC username that you would the discord name for",
            required: true,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
        }]
    })

    commands?.create({
        name: 'getminecraftname',
        description: "Get the Minecraft name associated with a Discord Name",
        options: [{
            name: "discordusername",
            description: "The players discord username",
            required: true,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.USER
        }]
    })

    commands?.create({
        name: 'register',
        description: "Connects a playername to a minecraft account",
        options: [{
            name: "discordusername",
            description: "The players discord username",
            required: true,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.USER
        },{
            name: "minecraftusername",
            description: "The players minecraft username",
            required: true,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
        }]
    })

    commands?.create({
        name: 'unlink',
        description: "removes any links for a specified name",
        options: [{
            name: "discordusername",
            description: "The players discord username",
            required: false,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.USER
        },{
            name: "minecraftusername",
            description: "The players minecraft username",
            required: false,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
        }]
    })

    commands?.create({
        name: 'bedtime',
        description: "If you wish to go to bed, type this command",
        options: [{
            name: "username",
            description: "If you're an admin, put a username here to put them to bed",
            required: false,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.USER
        }]
    })

    commands?.create({
        name: 'whitelist',
        description: "Whitelist commands",
        options: [
            {
                name: "add",
                description: "Add a username to the whitelist",
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [{
                    name: "username",
                    description: "The username that you would like to add",
                    required: true,
                    type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
                }]
            },
            {
                name: "remove",
                description: "Remove a username from the whitelist",
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [{
                    name: "username",
                    description: "The username that you would like to remove",
                    required: true,
                    type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
                }]
            },
            {
                name: "verify",
                description: "Check if a name is on the whitelist",
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [{
                    name: "username",
                    description: "The username that you would like to check",
                    required: true,
                    type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
                }]
            },
            {
                name: "list",
                description: "Get a list of the whitelist",
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            }
        ]
    })

    commands?.create({
        name: 'rolebutton',
        description: "Creates a button to manage a role for a user",
        options: [{
            name: "role",
            description: "The role to give out",
            required: true,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.ROLE
        },{
            name: "channel",
            description: "The channel to paste the button in (optional, defaults to current channel)",
            required: false,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.CHANNEL
        }]
    })

    commands?.create({
        name: 'purge',
        description: "(STAFF) Kick a player from the server",
        options: [{
            name: "mcusername",
            description: "The MC username that is to be kicked",
            required: true,
            type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
        }]
    })

}