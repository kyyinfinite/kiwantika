export type CheckInResult = {
  ok: boolean
  code?: string
  already_checked_in?: boolean
  status?: 'hadir' | 'terlambat'
  checked_in_at?: string
  session_title?: string
  member_name?: string
  attempts_left?: number
  retry_after_seconds?: number
  starts_at?: string
}

export type SessionInfo = {
  ok: boolean
  code?: string
  id?: string
  title?: string
  event_title?: string | null
  mode?: 'rotating' | 'static'
  starts_at?: string
  expires_at?: string | null
  code_valid?: boolean
}

export type ReportRow = {
  member_id: string
  name: string
  class_name: string | null
  group_name: string | null
  status: string
  method: string | null
  checked_in_at: string | null
  note: string | null
}

export type Report = {
  session: { id: string; title: string; starts_at: string; expires_at: string | null; status: string; mode: string; late_after_minutes: number }
  rows: ReportRow[]
}

export const STATUS_LABEL: Record<string, string> = {
  hadir: 'Hadir', terlambat: 'Terlambat', izin: 'Izin', sakit: 'Sakit', alpa: 'Alpa', belum_hadir: 'Belum hadir',
}

export const STATUS_OPTIONS = ['hadir', 'terlambat', 'izin', 'sakit', 'alpa'] as const

export function checkInMessage(result: CheckInResult) {
  switch (result.code) {
    case 'not_authenticated': return 'Silakan masuk terlebih dahulu.'
    case 'not_eligible': return 'Akunmu belum berstatus aktif sehingga belum bisa absen. Hubungi pembina.'
    case 'session_unavailable': return 'Sesi tidak ditemukan. QR mungkin tidak valid.'
    case 'expired': return 'Sesi absensi sudah berakhir atau ditutup.'
    case 'not_started': return 'Sesi absensi belum dimulai.'
    case 'locked': return `Terlalu banyak percobaan gagal. Coba lagi sekitar ${Math.max(1, Math.ceil((result.retry_after_seconds ?? 60) / 60))} menit lagi.`
    case 'invalid_code': return `Kode kedaluwarsa atau salah. Pindai ulang QR yang sedang tampil di layar.${result.attempts_left != null ? ` Sisa percobaan: ${result.attempts_left}.` : ''}`
    case 'invalid_pin': return `PIN salah.${result.attempts_left != null ? ` Sisa percobaan: ${result.attempts_left}.` : ''}`
    case 'limit_reached': return 'Kuota absensi untuk sesi ini sudah penuh.'
    default: return 'Absensi gagal diproses.'
  }
}

export function sessionPhase(session: { starts_at: string; expires_at: string | null; status: string }, now = Date.now()) {
  if (session.status === 'closed') return 'selesai'
  if (session.expires_at && new Date(session.expires_at).getTime() <= now) return 'selesai'
  if (new Date(session.starts_at).getTime() > now) return 'terjadwal'
  return 'berlangsung'
}
