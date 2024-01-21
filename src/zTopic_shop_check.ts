import {MessageActionRow, MessageButton, MessageEmbed, TextBasedChannel, User} from "discord.js"
import {escapeFormatting} from "./utility"
import {con, YES_EMOJI} from "./index"
import {activeApplications, rebuildShopMessage} from "./zTopic_application_management"
import {writeData} from "./data_persistence"

export const STOCK_INSTOCK = "In stock"
export const STOCK_OUTOFSTOCK = "Out of stock (<7 days)"
export const STOCK_OUTOFSTOCK7D = "Out of stock (>7 days)"
export const STOCK_SERVICE = "Service"

let shopCheckInProgress: boolean = false
let usersInShopCheck: User[] = []
let listOfShopsToCheck: Shop[] = []
let currentShopsBeingChecked: Array<[string, Shop]> = []
let shopCheckChannel: TextBasedChannel

export class Shop {
    shopId: string
    shopOwner: string
    shopType: string
    xCoord: number
    zCoord: number
    stockLevel: string

    constructor(shopId: string, shopOwner: string, shopType: string, xCoord: number, zCoord: number, stockLevel: string) {
        this.shopId = shopId
        this.shopOwner = shopOwner
        this.shopType = shopType
        this.xCoord = xCoord
        this.zCoord = zCoord
        this.stockLevel = stockLevel
    }
}

function userCurrentlyCheckingShop(userId: string): boolean {
    return currentShopsBeingChecked.some(([id, obj]) => userId == id)
}

export function startShopCheck(channel: TextBasedChannel, startUser: User) {
    if (shopCheckInProgress) {
        console.log("Shop check already in progress")
        shopCheckChannel.send("Shop check already in progress")
        return
    }

    const startShopCheckEmbed = new MessageEmbed()
        .setColor("#0cc8ce")
        .setTitle(`New Shop Check`)
        .setDescription(`${escapeFormatting(startUser.username)} has started a shop check. If you would like to assist with the shop check, click the button below.`)

    const messageActionRow = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId(`shopcheck,join`)
                .setLabel(`Join Shop Check`)
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId(`shopcheck,cancel`)
                .setLabel(`Cancel Shop Check`)
                .setStyle('DANGER'),
        )

    usersInShopCheck = []
    shopCheckInProgress = true
    shopCheckChannel = channel

    buildShopListToCheck().then(() => {
        shopCheckChannel.send({embeds: [startShopCheckEmbed], components: [messageActionRow]})

        joinShopCheck(startUser, false)
    })


}

export function joinShopCheck(joinUser: User, announceJoin: boolean = true) {
    if (!shopCheckInProgress) {
        console.log("Shop check not in progress")
        shopCheckChannel.send(`${joinUser.username}, there is no shop check not in progress.`)
        return
    }

    if (usersInShopCheck.includes(joinUser)) {
        console.log("User already in shop check")
        getNextShopToCheck(joinUser)
        return
    }

    if (announceJoin) {
        const joinShopCheckEmbed = new MessageEmbed()
            .setColor("#0cc8ce")
            .setTitle(`New Shop Check`)
            .setDescription(`${escapeFormatting(joinUser.username)} has joined the shop check.`)

        shopCheckChannel.send({embeds: [joinShopCheckEmbed]})
    }

    usersInShopCheck.push(joinUser)

    getNextShopToCheck(joinUser)
}

export function cancelShopCheck() {
    if (!shopCheckInProgress) {
        console.log("Shop check not in progress")
        shopCheckChannel.send("Shop check not in progress")
        return
    }

    shopCheckChannel.send("The shop check has been cancelled")

    shopCheckInProgress = false
    usersInShopCheck = []
}

async function buildShopListToCheck(): Promise<void> {
    return new Promise((resolve, reject) => {
        con.query(
            `SELECT * FROM shop WHERE stockLevel != '${STOCK_SERVICE}' OR stockLevel IS NULL`,
            function (err: Error | null, result: any[]) {
                if (err) {
                    console.error(err)
                    reject(err)
                    return
                }

                result.forEach((record) => {
                    listOfShopsToCheck.push(new Shop(record.shopId, record.shopOwner, record.shopType, record.xCoord, record.zCoord, record.stockLevel))
                })

                resolve()
            }
        )
    })
}

function getNextShopToCheck(user: User) {
    if (!shopCheckInProgress) {
        console.log("Shop check not in progress")
        shopCheckChannel.send("Shop check not in progress")
        return
    }
    if (!usersInShopCheck.includes(user)) {
        console.log("User not in shop check")
        shopCheckChannel.send("User not in shop check")
        return
    }
    console.log("Getting next shop to check")
    if (listOfShopsToCheck.length == 0) {
        console.log("No more shops to check")
        if (currentShopsBeingChecked.length == 0) {
            finishShopCheck()
        }
        return
    }
    if (userCurrentlyCheckingShop(user.id)) {
        console.log("User is already checking a shop")
        return
    }

    let nextShop = listOfShopsToCheck.pop()

    if (nextShop == null || typeof nextShop == undefined) {
        console.log("nextShop is null (jx0064)")
        return
    }
    currentShopsBeingChecked.push([user.id, nextShop])

    const stockLevel = nextShop.stockLevel != null && nextShop.stockLevel != "" ? nextShop.stockLevel : "No record"

    const shopCheckEmbed = new MessageEmbed()
        .setColor("#0cc8ce")
        .setTitle(`Shop Check`)
        .setDescription(`<@${user.id}> please check the following shop:\n\nType: ${nextShop.shopType}\nOwner: ${nextShop.shopOwner}\nLocation: ${nextShop.xCoord}, ${nextShop.zCoord}\nStock level at last check: ${stockLevel}`)

    const messageActionRow = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId(`shopcheck,stock,instock,${nextShop.shopId},${user.id}`)
            .setLabel(`In stock`)
            .setStyle('SUCCESS'),
        new MessageButton()
            .setCustomId(`shopcheck,stock,outofstock,${nextShop.shopId},${user.id}`)
            .setLabel(`Out of stock (under 7 days)`)
            .setStyle('DANGER'),
        new MessageButton()
            .setCustomId(`shopcheck,stock,outofstock7d,${nextShop.shopId},${user.id}`)
            .setLabel(`Out of stock (over 7 days)`)
            .setStyle('DANGER'),
        new MessageButton()
            .setCustomId(`shopcheck,stock,service,${nextShop.shopId},${user.id}`)
            .setLabel(`Mark shop as service`)
            .setStyle('SECONDARY'),
        new MessageButton()
            .setCustomId(`shopcheck,stock,skip,${nextShop.shopId},${user.id}`)
            .setLabel(`Skip`)
            .setStyle('SECONDARY')
    )
    shopCheckChannel.send({embeds: [shopCheckEmbed], components: [messageActionRow]})
}

export function markShopStock(shopId: string, stockLevel: string, user: User): boolean {
    if (!shopCheckInProgress) {
        console.log("Shop check not in progress")
        return false
    }
    con.query(
        'UPDATE shop SET stockLevel = ? WHERE shopId = ?',
        [stockLevel, shopId],
        function (err: any, result: any, fields: any) {
            if (err) throw err
            console.log('Update successful')
            currentShopsBeingChecked = currentShopsBeingChecked.filter(([userId, shop]) => shop.shopId != shopId)
            getNextShopToCheck(user)
            return true
        }
    )
    return true
}

function finishShopCheck() {
    shopCheckInProgress = false

    const currentDate = new Date()

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: 'GMT'
    }

    const formattedDate = new Intl.DateTimeFormat('en-US', options).format(currentDate)

    const shopCheckFooter = `Shop check last completed: ${formattedDate} GMT by ${usersInShopCheck.map(user => user.username).join(", ")}`
    writeData("shopCheckInfo", shopCheckFooter)
    usersInShopCheck = []
    shopCheckChannel.send(`${YES_EMOJI} Shop check complete`)
    rebuildShopMessage()
}

export function isShopCheckInProgress() {
    return shopCheckInProgress
}