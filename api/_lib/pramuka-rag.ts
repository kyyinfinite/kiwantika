import { KB, type KbEntry } from './pramuka-kb.js'
import { morseAnswer } from './morse.js'

const STOPWORDS = new Set(['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'atau', 'itu', 'ini', 'apa', 'siapa', 'bagaimana', 'kapan', 'dimana', 'mengapa', 'kenapa', 'adalah', 'apakah', 'bisa', 'tolong', 'dong', 'ya', 'aku', 'saya', 'kamu', 'kak', 'min', 'tunas', 'jelaskan', 'sebutkan', 'ada', 'saja', 'sih', 'nih', 'kah', 'lah', 'pada', 'dalam', 'tentang', 'soal', 'mau', 'tahu'])

const ALIASES: Array<[RegExp, string]> = [
  [/\bdasa[\s-]?dh?arma\b/g, 'dasadarma'],
  [/\btri[\s-]?satya\b/g, 'trisatya'],
  [/\bdwi[\s-]?satya\b/g, 'dwisatya'],
  [/\bdwi[\s-]?dh?arma\b/g, 'dwidarma'],
  [/\bsemaphore\b/g, 'semafor'],
  [/\btali[\s-]?temali\b/g, 'tali temali'],
  [/\bbaris[\s-]?berbaris\b/g, 'baris berbaris'],
  [/\baba[\s-]?aba\b/g, 'aba aba'],
  [/\bpioneering\b/g, 'pionering'],
  [/\bbaden[\s-]?powell\b/g, 'baden powell'],
  [/\bkwarcab\b/g, 'kwartir cabang'],
  [/\bkwarda\b/g, 'kwartir daerah'],
  [/\bkwarnas\b/g, 'kwartir nasional'],
  [/\bkwarran\b/g, 'kwartir ranting'],
  [/\bgudep\b/g, 'gugus depan'],
]

const PRAMUKA_TERMS = /pramuka|kepanduan|pandu|siaga|penggalang|penegak|pandega|pembina|ambalan|racana|sangga|pinru|pinsa|pradana|barung|perindukan|gugus depan|gudep|kwartir|kwarcab|kwarda|kwarnas|dasa ?darma|tri ?satya|dwi ?satya|dwi ?darma|satya|darma|saka|sku|skk|tku|garuda|tunas kelapa|jambore|raimuna|simpul|tali ?temali|morse|semafor|semaphore|sandi|pbb|baris[- ]?berbaris|pionering|pioneering|baden|kmd|kml|kpd|kpl|mabigus|majelis pembimbing|among|bantara|laksana|ramu|rakit|terap/i

const NON_EXACT = /\b(arti|makna|maksud|jelaskan|penjelasan|contoh|beda|perbedaan|mengapa|kenapa|kapan|siapa|sejarah|pengamalan|menerapkan|hafal(an)? tips|cara)\b/

type Scored = { entry: KbEntry; score: number; strong: boolean }

export function normalize(text: string) {
  let value = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [pattern, replacement] of ALIASES) value = value.replace(pattern, replacement)
  return value
}

function tokens(value: string) {
  return value.split(/[\s-]+/).filter(token => token.length > 2 && !STOPWORDS.has(token))
}

const prepared = KB.map(entry => ({
  entry,
  keys: entry.keys.map(normalize),
  bag: new Set(tokens(normalize(`${entry.title} ${entry.keys.join(' ')}`))),
}))

export function isPramukaTopic(text: string) {
  return PRAMUKA_TERMS.test(text)
}

export function retrieve(messages: Array<{ role: string; content: string }>, limit = 4): { hits: Scored[]; topic: boolean } {
  const users = messages.filter(message => message.role === 'user')
  const latest = users[users.length - 1]?.content ?? ''
  const previous = users.length > 1 ? users[users.length - 2].content : ''
  const query = normalize(latest)
  const context = normalize(previous)
  const queryTokens = new Set(tokens(query))
  const contextTokens = new Set(tokens(context))
  const topic = isPramukaTopic(latest) || (queryTokens.size < 6 && isPramukaTopic(previous))

  const scored: Scored[] = []
  for (const item of prepared) {
    let score = 0
    let strong = false
    for (const key of item.keys) {
      if (key.length < 3) continue
      const pattern = new RegExp(`(^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`)
      if (pattern.test(query)) {
        score += 4 + Math.min(key.split(' ').length, 3)
        strong = true
      } else if (context && pattern.test(context) && queryTokens.size < 6) {
        score += 2
      }
    }
    for (const token of queryTokens) if (item.bag.has(token)) score += 1
    for (const token of contextTokens) if (queryTokens.size < 6 && item.bag.has(token)) score += 0.5
    if (score >= 3) scored.push({ entry: item.entry, score, strong })
  }
  scored.sort((a, b) => b.score - a.score)
  const hits = scored.slice(0, limit)
  const missing = hits.find(hit => hit.entry.id === 'topik-belum-ada')
  if (missing && hits.length > 1 && hits[0].entry.id !== 'topik-belum-ada') return { hits: hits.filter(hit => hit.entry.id !== 'topik-belum-ada'), topic }
  return { hits, topic }
}

export function knowledgeBlock(messages: Array<{ role: string; content: string }>) {
  const { hits, topic } = retrieve(messages)
  const latest = [...messages].reverse().find(message => message.role === 'user')?.content ?? ''
  const computed = morseAnswer(latest)
  const lines: string[] = []
  if (hits.length) {
    lines.push('REFERENSI KEPRAMUKAAN TERVERIFIKASI (satu-satunya dasar untuk jawaban materi Pramuka; salin teks bernomor persis):')
    for (const hit of hits) lines.push(`[${hit.entry.title}]\n${hit.entry.text}\n(Sumber: ${hit.entry.source})`)
  } else if (topic) {
    lines.push('REFERENSI KEPRAMUKAAN: tidak ditemukan entri yang cocok untuk pertanyaan ini. Katakan terus terang bahwa belum punya rujukan terverifikasi tentang hal itu, jangan menebak, dan sarankan bertanya ke pembina, Dewan Ambalan, atau buku panduan resmi Kwarnas.')
  }
  if (computed) lines.push(`HASIL KONVERSI OTOMATIS (dihitung oleh kode, pasti benar; salin apa adanya):\n${computed}`)
  return { block: lines.join('\n\n'), grounded: topic || hits.length > 0 }
}

const EXACT_PATTERN = /\b(bunyi|bunyinya|isi|isinya|teks|lafal|naskah|sebut(kan)?|tulis(kan)?|apa saja|lengkap)\b/

export function exactAnswer(messages: Array<{ role: string; content: string }>) {
  const latest = [...messages].reverse().find(message => message.role === 'user')?.content ?? ''
  const query = normalize(latest)
  if (!EXACT_PATTERN.test(query) || NON_EXACT.test(query) || query.split(' ').length > 14) return null
  const byId = (id: string) => KB.find(entry => entry.id === id)
  const pick = (ids: string[]) => ids.map(byId).filter((entry): entry is KbEntry => Boolean(entry))
  let entries: KbEntry[] = []
  if (/\bdasadarma\b/.test(query)) entries = pick(['dasadarma'])
  else if (/\bdwidarma\b/.test(query)) entries = pick(['dwidarma'])
  else if (/\bdwisatya\b/.test(query)) entries = pick(['dwisatya'])
  else if (/\btrisatya\b/.test(query)) {
    if (/penggalang/.test(query)) entries = pick(['trisatya-penggalang'])
    else if (/penegak|pandega|dewasa|pembina/.test(query)) entries = pick(['trisatya-penegak'])
    else entries = pick(['trisatya-penggalang', 'trisatya-penegak'])
  } else if (/\bsatya pramuka\b/.test(query)) entries = pick(['satya-uu'])
  if (!entries.length) return null
  const body = entries.map(entry => entry.text).join('\n\n')
  const sources = Array.from(new Set(entries.map(entry => entry.source))).join('; ')
  return `${body}\n\nSumber: ${sources}.`
}

export function coreEvidence(messages: Array<{ role: string; content: string }>) {
  const { hits, topic } = retrieve(messages)
  const real = hits.filter(hit => hit.entry.id !== 'topik-belum-ada')
  const latest = [...messages].reverse().find(message => message.role === 'user')?.content ?? ''
  const computed = morseAnswer(latest)
  const parts = real.map(hit => `[${hit.entry.title}]\n${hit.entry.text}\n(Sumber: ${hit.entry.source})`)
  if (computed) parts.push(`HASIL KONVERSI OTOMATIS (dihitung oleh kode, pasti benar; salin apa adanya):\n${computed}`)
  return { text: parts.join('\n\n'), topic, hasEvidence: parts.length > 0, unavailable: hits.some(hit => hit.entry.id === 'topik-belum-ada') }
}
