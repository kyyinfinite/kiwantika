import { supabase } from './supabase'

const MESSAGES: Record<string, string> = {
  not_authorized: 'Kamu tidak punya izin untuk aksi ini.',
  not_authenticated: 'Silakan masuk terlebih dahulu.',
  invalid_title: 'Judul harus 3 sampai 120 karakter.',
  invalid_pin: 'PIN harus 4 sampai 8 angka.',
  invalid_time_window: 'Waktu selesai harus setelah waktu mulai.',
  invalid_start_time: 'Waktu mulai wajib diisi.',
  invalid_input: 'Data yang dikirim tidak valid.',
  invalid_status: 'Status tidak dikenal.',
  invalid_max_checkins: 'Batas peserta harus minimal 1.',
  session_not_found: 'Sesi tidak ditemukan.',
  session_not_rotating: 'Sesi ini tidak memakai QR berganti.',
  due_not_found: 'Tagihan tidak ditemukan.',
}

export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const key = Object.keys(MESSAGES).find(code => error.message.includes(code))
    throw new Error(key ? MESSAGES[key] : error.message)
  }
  return data as T
}

export const errorText = (error: unknown) => error instanceof Error ? error.message : 'Terjadi kesalahan.'
