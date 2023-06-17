import {getDiscordDisplayName} from "./utility"
import {con, debugchannel, DEBUGMODE, lpcon} from "./index"
import {Client, GuildMember, PartialGuildMember} from "discord.js"

export async function guildMemberUpdate(client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    const ranks =[[718434756496326657,"gold"],[720848078264991765,"emerald"],[710713981186211870,"diamond"],[804897967374860288,"netherite"],[1076240598232739854,"netherite"],[801826957041860638,"birthday"]]
    const colors = [
        "905473389592993882",
        "905475025786785822",
        "905474168043208725",
        "905474890927312998",
        "905476443776118824",
        "905476781845409812",
        "905473758238752818",
        "905473609663930438",
        "905473670590378014",
        "905476317712101467",
        "905475376954900481",
        "905474718126182431",
        "905475138626134047",
        "905474465708802139",
        "905474277636194367",
        "905473838668734526",
        "905474360486289408",
        "905476521836294214",
        "905473542307610645",
        "905475825313386496"]

    var reportingChannel = "800925944399265812"
    if (DEBUGMODE) reportingChannel = "970336504364818452"

    const channel = await client.channels.cache.get(reportingChannel)

    var mcuuid = "nah"
    var dashedmcuuid = "nah"
    console.log(`player id ${oldMember.id}`)
    await con.query(`SELECT minecraftUuid FROM accountLinking WHERE discordId = '` + oldMember.id + "'", async function (err: any, result: any, fields: any) {
        if (result == null || result == "" || result.size == 0) return

        try {
            mcuuid = result[0]['minecraftUuid']
        }
        catch (e) {
            console.log("ERROR IN UUID (jx0024)")
            return
        }
        dashedmcuuid = mcuuid.substring(0, 8) + "-" + mcuuid.substring(8, 12) + "-" + mcuuid.substring(12, 16) + "-" + mcuuid.substring(16, 20) + "-" + mcuuid.substring(20);

        console.log(`mc id ${mcuuid}`)
        // Old roles Collection is higher in size than the new one. A role has been removed.
        if (oldMember.roles.cache.size > newMember.roles.cache.size) {
            // Looping through the role and checking which role was removed.
            oldMember.roles.cache.forEach(role => {
                //color removal - if member does not have netherite/netherite classic/diamond
                if (!newMember.roles.cache.has(`804897967374860288`) && !newMember.roles.cache.has(`1076240598232739854`) && !newMember.roles.cache.has(`710713981186211870`) && colors.includes(role.id) && newMember.roles.cache.has(role.id)){
                    console.log(`non donator has role ${role.name}`)
                    // @ts-ignore
                    newMember.roles.remove(role).then(channel.send(`Removed custom Discord colour ${role.name} from ${getDiscordDisplayName(newMember.user)}`));
                }
                if (!newMember.roles.cache.has(role.id)) {
                    oldMember.roles.cache.forEach(async (role) => {
                        if (!newMember.roles.cache.has(role.id)) {
                            //remove role alert
                            console.log("Role Removed", role.id);
                            //remove minecraft role
                            for (const rank of ranks){
                                if (rank[0] == role.id){
                                    console.log(`Reporting role loss to channel with id ${reportingChannel} & mcuuid = ${mcuuid}`)
                                    con.query('INSERT INTO rolelog (discordID, roleName, added) VALUES (?,?,"0")', [newMember.id, rank[1]] , function (err: any, result: any, fields: any) {
                                        if (err) throw err;
                                        console.log("added entry into database")
                                    });
                                    //check for additional netherite or netherite classic role (or wide role for debugging purpose)
                                    if (rank[1] == "netherite" && (newMember.roles.cache.has(`804897967374860288`) || newMember.roles.cache.has(`1076240598232739854`) || newMember.roles.cache.has(`885590291082522644`))){
                                        console.log("has alternate netherite, ignoring dis-assignment")
                                        return;
                                    }
                                    if (mcuuid == "nah" || dashedmcuuid == "nah") return;
                                    lpcon.query(`delete from luckperms_user_permissions where uuid = ? and permission like 'prefix%';`, [dashedmcuuid], function (err: any, result: any, fields: any) {
                                        if (result) {
                                            console.log(`deleted ${result.affectedRows} prefixes`);
                                        } else {
                                            console.log(`No prefixes deleted`);
                                        }
                                    });
                                    lpcon.query(`DELETE FROM luckperms_user_permissions WHERE replace(uuid,"-","") = ? AND permission = ?`, [mcuuid, 'group.' + rank[1]], function (err: any, result: any, fields: any) {
                                        if (result) {
                                            console.log(`deleted ${result.affectedRows} roles`);
                                            if (result.affectedRows >= 1){
                                                // @ts-ignore
                                                channel.send(`Removed in game role ${role.name} from ${getDiscordDisplayName(newMember.user)}`);
                                            }
                                        } else {
                                            console.log(`No rows deleted`);
                                        }
                                    });

                                }
                            }
                        }
                    });
                }
            });
        } else if (oldMember.roles.cache.size < newMember.roles.cache.size) {

            // Looping through the role and checking which role was added.
            newMember.roles.cache.forEach(role => {
                if (!oldMember.roles.cache.has(role.id)) {
                    console.log("Role Added", role.id);
                    for (const rank of ranks){
                        if (rank[0] == role.id){
                            console.log(`Reporting role gain to channel with id ${reportingChannel} & mcuuid = ${dashedmcuuid} discorduser ${newMember.id}`)
                            con.query('INSERT INTO rolelog (discordID, roleName, added) VALUES (?,?,"1")', [newMember.id, rank[1]] , function (err: any, result: any, fields: any) {
                                if (err) throw err
                                console.log("added entry into database")
                            })
                            lpcon.query(`INSERT INTO luckperms_user_permissions (uuid, permission, value, server, world, expiry, contexts)
                                        SELECT ?, ?, 1, 'global', 'global', 0, '{}'
                                        FROM dual
                                        WHERE NOT EXISTS (
                                          SELECT * 
                                          FROM luckperms_user_permissions 
                                          WHERE uuid = ? AND permission = ?
                                        );`, [dashedmcuuid, 'group.' + rank[1], dashedmcuuid, 'group.' + rank[1]] , function (err: any, result: any, fields: any) {
                                if (result) {
                                    console.log(`added ${result.affectedRows}`)
                                    if (result.affectedRows >= 1) {
                                        // @ts-ignore
                                        channel.send(`Added in game role ${role.name} to ${getDiscordDisplayName(newMember.user)}`)
                                    }
                                } else {
                                    console.log(`No rows deleted`)
                                }
                            })
                        }
                    }
                }
            })
        }
    })
}