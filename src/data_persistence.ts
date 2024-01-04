import {con} from "./index"


export function writeData(key: string, value: string) {
     con.query('INSERT INTO data (datakey, datavalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE datavalue = ?', [key, value, value], function (err: any, result: any, fields: any) {
         if (err) throw err
         console.log(`data written: ${key} = ${value}`)
     })
}

export function readData(key: string): Promise<string> {
    return new Promise((resolve, reject) => {
        con.query(`SELECT datavalue FROM data WHERE datakey = ?`, [key], async function (err: any, result: any, fields: any) {
            if (err) return reject(err)
            if (result == null || result == "" || result.size == 0) return resolve("")

            try {
                const dataValue = result[0]['datavalue']
                resolve(dataValue)
            } catch (e) {
                console.log("ERROR IN DATA (jx0070)")
                resolve("")
            }
        })
    })
}