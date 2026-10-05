import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import initSqlJs from 'sql.js'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(process.env.LEGACY_ROOT || '../legacy/webpramukasmpn1')
const dryRun = process.argv.includes('--dry-run')
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!url || !serviceKey)) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for a real migration. Never expose the service key to the browser.')
const supabase = !dryRun ? createClient(url, serviceKey, {auth:{autoRefreshToken:false,persistSession:false}}) : null
const SQL = await initSqlJs({ locateFile: f => new URL(`../node_modules/sql.js/dist/${f}`, import.meta.url).pathname })
const db = new SQL.Database(fs.readFileSync(path.join(root,'data/pramuka.db')))
const gameDb = new SQL.Database(fs.readFileSync(path.join(root,'data/game.db')))
const q = (sql, params=[]) => { const s=db.prepare(sql); s.bind(params); const out=[]; while(s.step()) out.push(s.getAsObject()); s.free(); return out }
const gameQ = (sql, params=[]) => { const s=gameDb.prepare(sql); s.bind(params); const out=[]; while(s.step()) out.push(s.getAsObject()); s.free(); return out }
const slugify = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)
const uuidFromLegacy = (table,id) => crypto.createHash('sha256').update(`kiwantika:${table}:${id}`).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/,'$1-$2-$3-$4-$5')
const report={users:q('select * from users'),articles:q('select * from posts where is_published=1'),events:q('select * from schedules where is_active=1'),sku:q('select * from sku_items'),dues:q('select * from kas_iuran'),finance:q('select * from kas_transactions'),settings:q('select * from settings'),newsCache:q('select * from news_cache'),players:gameQ('select * from players')}
console.log(JSON.stringify({mode:dryRun?'dry-run':'migration',counts:Object.fromEntries(Object.entries(report).map(([k,v])=>[k,v.length]))},null,2))
if(dryRun) process.exit(0)

// Content migration first; author/member FKs remain nullable where the legacy account cannot be linked safely.
for (const row of report.articles) {
  const payload={title:row.title,slug:slugify(row.title)+'-'+row.id,excerpt:null,content:row.content,cover_path:row.image_url||null,category:row.category||'berita',status:'published',published_at:row.created_at}
  const {error}=await supabase.from('articles').upsert(payload,{onConflict:'slug'})
  if(error) throw new Error(`article ${row.id}: ${error.message}`)
}
for (const row of report.events) {
  const payload={title:row.title,slug:slugify(row.title)+'-'+row.id,description:row.description||null,event_type:row.tipe||'kegiatan',visibility:'public',start_at:new Date(`${row.start_date}T${row.start_time||'00:00:00'}`).toISOString(),end_at:row.end_date?new Date(`${row.end_date}T${row.end_time||'00:00:00'}`).toISOString():null,location:row.location||null,status:'published'}
  const {error}=await supabase.from('events').upsert(payload,{onConflict:'slug'})
  if(error) throw new Error(`event ${row.id}: ${error.message}`)
}
// Seed SKU catalogue. User progress is deliberately deferred until legacy users are linked to auth.users.
for (const row of report.sku) {
  const {error}=await supabase.from('sku_items').upsert({level:row.tingkatan,category:row.kategori,number:row.nomor,description:row.deskripsi},{onConflict:'level,category,number'})
  if(error) throw new Error(`sku ${row.id}: ${error.message}`)
}
// Finance is imported without user foreign keys where legacy identities are not linked.
for (const row of report.finance) {
  const {error}=await supabase.from('finance_transactions').insert({type:row.tipe,category:row.kategori,amount:row.jumlah,description:row.keterangan||null,transaction_date:row.tanggal,group_name:row.regu||null,evidence_path:row.bukti_url||null})
  if(error) throw new Error(`finance ${row.id}: ${error.message}`)
}
console.log('Migration completed for safe, non-auth-dependent records.')
console.log('Legacy auth accounts were NOT silently assigned new passwords. Review the auth migration report before creating/linking accounts.')
