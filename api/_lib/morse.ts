const TABLE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.',
}

const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(TABLE).map(([char, code]) => [code, char]))

export const MORSE_TABLE = TABLE

export function toMorse(text: string) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean)
  const skipped = new Set<string>()
  const encoded = words.map(word => {
    const letters: string[] = []
    for (const char of word) {
      if (TABLE[char]) letters.push(TABLE[char])
      else skipped.add(char)
    }
    return letters.join(' ')
  }).filter(Boolean)
  return { morse: encoded.join(' / '), skipped: [...skipped] }
}

export function fromMorse(code: string) {
  const unknown = new Set<string>()
  const words = code.trim().split(/\s*\/\s*|\s{3,}/).filter(Boolean)
  const decoded = words.map(word => word.trim().split(/\s+/).map(symbol => {
    const char = REVERSE[symbol]
    if (!char) unknown.add(symbol)
    return char ?? '?'
  }).join(''))
  return { text: decoded.join(' '), unknown: [...unknown] }
}

export function looksLikeMorse(value: string) {
  return /^[.\-\s/]+$/.test(value) && /[.\-]/.test(value)
}

export function morseAnswer(userText: string) {
  if (!/morse/i.test(userText)) return null
  const quoted = userText.match(/["“”'‘’`]([^"“”'‘’`]{1,120})["“”'‘’`]/)
  const afterColon = userText.match(/:\s*([^\n]{1,120})$/)
  const payload = (quoted?.[1] ?? afterColon?.[1] ?? '').trim()
  if (!payload) return null
  if (looksLikeMorse(payload)) {
    const { text, unknown } = fromMorse(payload)
    if (unknown.length) return `Hasil terjemahan otomatis dari Morse "${payload}": ${text} (simbol tidak dikenali: ${unknown.join(' ')}).`
    return `Hasil terjemahan otomatis dari Morse "${payload}": ${text}`
  }
  const { morse, skipped } = toMorse(payload)
  if (!morse) return null
  const note = skipped.length ? ` Karakter ${skipped.join(' ')} tidak punya kode di tabel huruf dan angka.` : ''
  return `Hasil konversi otomatis ke Morse untuk "${payload}": ${morse} (satu spasi antarhuruf, tanda / antarkata).${note}`
}
