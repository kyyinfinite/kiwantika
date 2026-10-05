import fs from 'node:fs'
import path from 'node:path'
import initSqlJs from 'sql.js'

const root = path.resolve(process.env.LEGACY_ROOT || '../legacy/webpramukasmpn1')
const files = [path.join(root,'data/pramuka.db'),path.join(root,'data/game.db')]
const SQL = await initSqlJs({ locateFile: f => new URL(`../node_modules/sql.js/dist/${f}`, import.meta.url).pathname })
for (const file of files) {
  if (!fs.existsSync(file)) { console.log(`MISSING ${file}`); continue }
  const db = new SQL.Database(fs.readFileSync(file))
  console.log(`\n# ${file}`)
  const result = db.exec("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")
  for (const row of result[0]?.values ?? []) {
    const table = row[0]
    const count = db.exec(`select count(*) from "${table.replaceAll('"','""')}"`)[0]?.values?.[0]?.[0] ?? 0
    console.log(`${table}: ${count}`)
  }
  db.close()
}
