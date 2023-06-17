import { con } from "./index";

export function setupDatabaseTables(){
    con.query('CREATE TABLE IF NOT EXISTS `accountLinking` (`discordId` VARCHAR(20) NOT NULL,`minecraftUuid` VARCHAR(36) NOT NULL,PRIMARY KEY (`discordId`,`minecraftUuid`));', function (err: any, result: any, fields: any) {
        if (err) throw err
        console.log("accountLinking table created if not exists")
    })

    con.query('CREATE TABLE IF NOT EXISTS `whitelist` (`uuid` VARCHAR(60) NOT NULL, `name` VARCHAR(20) NOT NULL, `whitelisted` TINYINT NOT NULL DEFAULT 1, PRIMARY KEY (`name`));', function (err: any, result: any, fields: any) {
        if (err) throw err
        console.log("whitelist table created if not exists")
    })

    con.query('CREATE TABLE IF NOT EXISTS `rolelog` (`discordId` VARCHAR(20) NOT NULL, `roleName` VARCHAR(10) NOT NULL, `added` VARCHAR(1) NOT NULL, `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);', function (err: any, result: any, fields: any) {
        if (err) throw err
        console.log("rolelog table created if not exists")
    })
}