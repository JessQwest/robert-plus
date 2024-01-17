import {con, cpcon} from "./index"
import {
    MessageActionRow,
    MessageButton,
    MessageOptions,
    MessagePayload,
    TextBasedChannel,
    TextChannel
} from "discord.js"
import {escapeFormatting, stringToEmbeds} from "./utility"
import {QUESTION_SET_MAP, QUESTION_SET_SHOP, REQ_AGREE, REQ_OPTIONAL_TEXT} from "./zTopic_application_creator"
import {InProgressApplication} from "./zTopic_application_management"

class PlayerName {
    public rowId: number
    public username: string
    public uuid: string
    constructor(rowId: number, username: string, uuid: string) {
        this.rowId = rowId
        this.username = username
        this.uuid = uuid
    }
}

class CoParameters {
    public action: string
    public value: string
    constructor(action: string, value: string) {
        this.action = action
        this.value = value
    }
}

let playerNames: PlayerName[] = []

const LIMIT = 10

export async function coreProtectLookup(commandString: string, channel: TextBasedChannel, offset: number = 0) {
    commandString = commandString.toLowerCase()
    console.log(`coreProtectLookup called with ${commandString}`)
    let command = commandString.split(" ")
    // loop through 3rd string onwards to set parameters
    let lookupType = "" // currently only chat is an option
    let ordering = "DESC"
    let parameterObjects: CoParameters[] = [] // what actions the user has done to the query type
    let parameters: string[] = [] // the parameters to be used in the query, already in SQL form
    for (let i = 2; i < command.length; i++) {
        let currentParameter = command[i]
        let splitCurrentParameter = currentParameter.split(":")
        let action = splitCurrentParameter[0]
        let value = splitCurrentParameter[1]
        parameterObjects.push(new CoParameters(action, value))
        if (action == "action" && lookupType == "") {
            if (value == "chat") {
                lookupType = "chat"
            }
        }

        if ((action == "player" || action == "user") && lookupType == "chat") {
            let player = lookupPlayerByUsername(value)
            let playerRowId = player?.rowId
            if (playerRowId == undefined) playerRowId = -1
            parameters.push(`user = '${playerRowId}'`)
        }

        if (action == "id" && lookupType == "chat") {
            parameters.push(`rowid > ${parseInt(value)-(LIMIT/2)} AND rowid <= ${parseInt(value)+(LIMIT/2)}`)
            ordering = "ASC"
        }

        if (action == "message" && lookupType == "chat") {
            parameters.push(`message like '%${value.replace(/_/g, ' ')}%'`)
        }

        if (action == "order" && lookupType == "asc") {
            ordering = "ASC"
        }

    }

    // build query depending on lookup type
    let queryStart = ``
    let queryCountStart = `select count(*)`
    let queryEnd = ``

    if (lookupType == "chat") {
        queryStart = `select rowid, user, time, message`
        queryEnd = `from co_chat where ${parameters.join(" and ")}`
    }

    // action query against db
    if (queryStart == "") return
    try {
        let returnResult = ""
        // Use a promise to wait for the database query to complete
        let result = await new Promise((resolve, reject) => {
            let query = `${queryStart} ${queryEnd} ORDER BY time ${ordering} LIMIT ${LIMIT} OFFSET ${offset};`
            console.log(query)
            cpcon.query(query, function (err: Error | null, result: any[]) {
                if (err) {
                    console.error(err)
                    reject(err)
                } else {
                    resolve(result)
                }
            })
        })

        console.log(`${queryCountStart} ${queryEnd};`)
        let resultCount: number = await new Promise((resolve, reject) => {
            cpcon.query(`${queryCountStart} ${queryEnd};`, function (err: Error | null, result: any[]) {
                if (err) {
                    console.error(err)
                    reject(err)
                } else {
                    resolve(result[0]["count(*)"])
                }
            })
        })

        // Process the result
        // @ts-ignore
        result.forEach((record) => {
            let playerName = lookupPlayerById(record.user)
            if (playerName == undefined) return
            returnResult += `${record.rowid} <t:${record.time}:D><t:${record.time}:T> ${escapeFormatting(playerName.username)}: ${escapeFormatting(record.message)}\n`
        })

        // Post result
        if (resultCount > 0 && returnResult != "") {
            let embed = " "
            let buttons: MessageActionRow = new MessageActionRow()
            let idLookup = lookupParameterObject(parameterObjects, "id") // see if the user searched chat using an ID
            if (idLookup != undefined) {
                let id = parseInt(idLookup.value)

            } else {
                let resultString = `Total results: ${resultCount}`
                let offsetString = `Showing ${offset + 1}-${Math.min(offset + LIMIT, resultCount)}`
                let pageString = `Page ${getCurrentPage(offset)} of ${getMaxPages(resultCount)}`
                embed = `${resultString} | ${offsetString} | ${pageString}`
                buttons = generateNavigationButtons(commandString, offset, resultCount)
            }

            let embeds = stringToEmbeds(`CoreProtect Lookup`, returnResult, "#208386", embed)
            let messagePayload: MessageOptions = {embeds: embeds}
            if (buttons.components.length > 0) messagePayload.components = [buttons]
            channel.send(messagePayload)
        } else {
            channel.send("No results found")
        }
    } catch (error) {
        console.error(error)
    }
}

function getCurrentPage(offset: number): number {
    return Math.ceil(offset / LIMIT) + 1
}
function getMaxPages(resultCount: number): number {
    return Math.ceil(resultCount / LIMIT)
}

function generateNavigationButtons(commandString: string, offset: number, resultCount: number): MessageActionRow {
    const messageActionRow = new MessageActionRow()

    if (offset > 0) {
        const startButton = new MessageButton()
            .setCustomId(`coreprotect,0,${commandString}`)
            .setLabel(`First page`)
            .setStyle('SECONDARY')
        messageActionRow.addComponents(startButton)
    }
    if (offset - LIMIT > 0 && offset - LIMIT >= 0) {
        const backButton = new MessageButton()
            .setCustomId(`coreprotect,${Math.max(offset - LIMIT,0)},${commandString}`)
            .setLabel(`Previous page (${getCurrentPage(offset - LIMIT)})`)
            .setStyle('SECONDARY')
        messageActionRow.addComponents(backButton)
    }
    if (offset + LIMIT < resultCount - LIMIT) {
        const nextButton = new MessageButton()
            .setCustomId(`coreprotect,${Math.min(offset + LIMIT, resultCount-1)},${commandString}`)
            .setLabel(`Next page (${getCurrentPage(offset + LIMIT)})`)
            .setStyle('SECONDARY')
        messageActionRow.addComponents(nextButton)
    }
    if (offset + LIMIT < resultCount) {
        const finalButton = new MessageButton()
            .setCustomId(`coreprotect,${resultCount - LIMIT},${commandString}`)
            .setLabel(`Last page (${getMaxPages(resultCount)})`)
            .setStyle('SECONDARY')
        messageActionRow.addComponents(finalButton)
    }
    if (resultCount > LIMIT) {
        const customButton = new MessageButton()
            .setCustomId(`coreprotect,custom,${commandString}`)
            .setLabel(`Pick Page`)
            .setStyle('PRIMARY')
        messageActionRow.addComponents(customButton)
    }
    return messageActionRow
}

export function loadPlayerNames() {
    if (playerNames.length > 0) return

    cpcon.query(`select * from co_user`, function (err: Error | null, result: any[]) {
        if (err) {
            console.error(err)
            return
        }
        result.forEach((record) => {
            playerNames.push(new PlayerName(record.rowid, record.user, record.uuid))
            // console.log(`Loaded player ${record.rowid} ${record.user} ${record.uuid}`)
        })
    })
}

function lookupPlayerById(rowId: number): PlayerName | undefined {
    return playerNames.find(playerName => playerName.rowId == rowId)
}

function lookupPlayerByUsername(username: string): PlayerName | undefined {
    return playerNames.find(playerName => playerName.username.toLowerCase() == username.toLowerCase())
}

function lookupParameterObject (parameterObjects: CoParameters[], action: string): CoParameters | undefined {
    return parameterObjects.find(parameterObject => parameterObject.action == action)
}