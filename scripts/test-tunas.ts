import { KB } from '../api/_lib/pramuka-kb.js'
import { retrieve, exactAnswer, knowledgeBlock, normalize } from '../api/_lib/pramuka-rag.js'
import { toMorse, fromMorse, morseAnswer } from '../api/_lib/morse.js'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`)
}
const ask = (content: string) => [{ role: 'user', content }]
const top = (content: string) => retrieve(ask(content)).hits.map(hit => hit.entry.id)

const ids = KB.map(entry => entry.id)
check('id entri unik', new Set(ids).size === ids.length)
check('semua entri punya sumber', KB.every(entry => entry.source.length > 10))

const dasa = KB.find(entry => entry.id === 'dasadarma')!.text
check('dasadarma berisi sepuluh butir bernomor', (dasa.match(/^\d+\. /gm) ?? []).length === 10)
check('dasadarma butir 7 dan 10 persis', dasa.includes('7. Hemat, cermat, dan bersahaja.') && dasa.includes('10. Suci dalam pikiran, perkataan, dan perbuatan.'))
check('trisatya penggalang memakai mempersiapkan diri', KB.find(entry => entry.id === 'trisatya-penggalang')!.text.includes('mempersiapkan diri membangun masyarakat'))
check('trisatya penegak memakai ikut serta', KB.find(entry => entry.id === 'trisatya-penegak')!.text.includes('ikut serta membangun masyarakat'))
check('dwidarma memakai berbakti', KB.find(entry => entry.id === 'dwidarma')!.text.includes('Siaga berbakti pada ayah dan ibundanya'))

const cases: Array<[string, string]> = [
  ['apa bunyi dasa darma pramuka?', 'dasadarma'],
  ['Tri Satya penggalang bunyinya gimana', 'trisatya-penggalang'],
  ['bunyi tri satya penegak', 'trisatya-penegak'],
  ['dwi satya siaga', 'dwisatya'],
  ['usia pramuka penggalang berapa', 'golongan'],
  ['apa itu pradana', 'satuan-gerak'],
  ['siapa bapak pramuka indonesia', 'sejarah-1961'],
  ['kapan hari pramuka', 'identitas'],
  ['kegunaan simpul pangkal', 'tali-temali'],
  ['apa itu saka bahari', 'saka-sako'],
  ['syarat jadi pembina pramuka kmd', 'pembina-tenaga-pendidik'],
  ['apa itu sistem among', 'sistem-among'],
  ['gimana sandi semaphore huruf a', 'topik-belum-ada'],
  ['metode kepramukaan ada berapa', 'metode-prinsip'],
  ['siapa pencipta lambang tunas kelapa', 'lambang-atribut'],
]
for (const [question, expected] of cases) {
  const result = top(question)
  check(`retrieve: "${question}"`, result.includes(expected), `dapat: ${result.join(', ') || '(kosong)'}`)
}

const followUp = retrieve([
  { role: 'user', content: 'bunyi trisatya penggalang' },
  { role: 'assistant', content: '...' },
  { role: 'user', content: 'kalau yang penegak?' },
]).hits.map(hit => hit.entry.id)
check('pertanyaan lanjutan memakai konteks', followUp.includes('trisatya-penegak'), followUp.join(', '))

check('tanpa topik pramuka tidak ada referensi', knowledgeBlock(ask('resep nasi goreng enak')).block === '')
check('topik pramuka tak dikenal diberi peringatan', knowledgeBlock(ask('berapa gaji pembina pramuka zaman sekarang')).block.length > 0)

const exact = exactAnswer(ask('sebutkan bunyi dasa darma'))
check('exactAnswer dasadarma', Boolean(exact && exact.includes('10. Suci dalam pikiran')))
check('exactAnswer trisatya tanpa golongan memberi dua versi', (exactAnswer(ask('bunyi trisatya')) ?? '').includes('mempersiapkan diri') && (exactAnswer(ask('bunyi trisatya')) ?? '').includes('ikut serta'))
check('exactAnswer tidak aktif untuk pertanyaan makna', exactAnswer(ask('apa arti dasa darma ke 3')) === null)
check('exactAnswer tidak aktif untuk topik lain', exactAnswer(ask('sebutkan macam simpul')) === null)

check('morse SOS', toMorse('SOS').morse === '... --- ...')
check('morse dua kata', toMorse('Hai kak').morse === '.... .- .. / -.- .- -.-')
check('morse bolak-balik', fromMorse(toMorse('PRAMUKA 15').morse).text === 'PRAMUKA 15')
check('morseAnswer encode', (morseAnswer('tolong ubah ke morse: "AMBALAN"') ?? '').includes('.- -- -... .- .-.. .- -.'))
check('morseAnswer decode', (morseAnswer('artikan morse ini: "... --- ..."') ?? '').includes('SOS'))
check('normalize alias', normalize('Dasa-Dharma dan Tri Satya') === 'dasadarma dan trisatya')

console.log(failed ? `\n${failed} pengujian gagal` : '\nSemua pengujian lulus')
process.exit(failed ? 1 : 0)
