import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, Trash2, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { errorText, rpc } from '../../lib/rpc'
import { useAuth } from '../auth/AuthProvider'
import { useConfirm } from '../../components/feedback'
import { Notice, Panel, StatCard, dateOnly, rupiah, todayLocal } from '../../components/mini'
import { TableSkeleton } from '../../components/Skeleton'

type Due = { id: string; amount: number; status: string; paid_at: string | null; member: { full_name: string; display_name: string | null; class_name: string | null } | null }
type Tx = { id: string; type: 'pemasukan' | 'pengeluaran'; category: string; amount: number; description: string | null; transaction_date: string; due_id: string | null }
type Summary = { balance: number; months: Array<{ month: number; income: number; expense: number }> }

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const TABS = [['iuran', 'Iuran kas'], ['transaksi', 'Transaksi'], ['ringkasan', 'Ringkasan']] as const

export function AdminFinancePage() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirm()
  const now = new Date()
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('iuran')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [amount, setAmount] = useState(5000)
  const [dues, setDues] = useState<Due[] | null>(null)
  const [txs, setTxs] = useState<Tx[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [tx, setTx] = useState({ type: 'pengeluaran', category: '', amount: '', description: '', date: todayLocal() })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadDues = async () => {
    if (!supabase) return
    const { data, error: loadError } = await supabase.from('dues')
      .select('id,amount,status,paid_at,member:profiles!member_id(full_name,display_name,class_name)')
      .eq('period_month', month).eq('period_year', year).order('status', { ascending: false })
    if (loadError) setError(loadError.message)
    setDues(((data ?? []) as unknown as Due[]).sort((a, b) => (a.member?.display_name || a.member?.full_name || '').localeCompare(b.member?.display_name || b.member?.full_name || '')))
  }
  const loadTxs = async () => {
    if (!supabase) return
    const { data, error: loadError } = await supabase.from('finance_transactions')
      .select('id,type,category,amount,description,transaction_date,due_id').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(60)
    if (loadError) setError(loadError.message)
    setTxs((data ?? []) as Tx[])
  }
  const loadSummary = async () => {
    try { setSummary(await rpc<Summary>('finance_summary', { p_year: year })) } catch (e) { setError(errorText(e)) }
  }

  useEffect(() => { setDues(null); loadDues() }, [month, year])
  useEffect(() => { if (tab === 'transaksi' && !txs) loadTxs() }, [tab])
  useEffect(() => { if (tab === 'ringkasan') loadSummary() }, [tab, year])

  const generate = async () => {
    if (!await ask(`Buat tagihan ${MONTHS[month - 1]} ${year} sebesar ${rupiah(amount)} untuk semua anggota aktif? Tagihan yang sudah ada tidak diubah.`)) return
    setError(''); setMessage('')
    try { const created = await rpc<number>('generate_monthly_dues', { p_month: month, p_year: year, p_amount: amount }); setMessage(`${created} tagihan baru dibuat.`); await loadDues() }
    catch (e) { setError(errorText(e)) }
  }

  const toggle = async (due: Due) => {
    try { await rpc('set_due_paid', { p_due_id: due.id, p_paid: due.status !== 'lunas' }); await loadDues(); setTxs(null) }
    catch (e) { setError(errorText(e)) }
  }

  const addTx = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    const { error: insertError } = await supabase.from('finance_transactions').insert({
      type: tx.type, category: tx.category.trim(), amount: Number(tx.amount), description: tx.description.trim() || null,
      transaction_date: tx.date, created_by: user?.id,
    })
    if (insertError) { setError(insertError.message); return }
    setTx({ ...tx, category: '', amount: '', description: '' }); setMessage('Transaksi disimpan.'); await loadTxs()
  }

  const removeTx = async (row: Tx) => {
    if (!supabase || !await ask(`Hapus transaksi "${row.category}" ${rupiah(row.amount)}?`)) return
    const { error: deleteError } = await supabase.from('finance_transactions').delete().eq('id', row.id)
    if (deleteError) setError(deleteError.message); else await loadTxs()
  }

  const exportTx = async () => {
    const XLSX = await import('xlsx')
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet((txs ?? []).map(row => ({
      Tanggal: row.transaction_date, Jenis: row.type, Kategori: row.category, Nominal: row.amount, Keterangan: row.description ?? '',
    }))), 'Transaksi')
    XLSX.writeFile(book, 'kas-kiwantika.xlsx')
  }

  const paid = (dues ?? []).filter(item => item.status === 'lunas')
  const collected = paid.reduce((sum, item) => sum + item.amount, 0)
  const outstanding = (dues ?? []).filter(item => item.status !== 'lunas').reduce((sum, item) => sum + item.amount, 0)
  const peak = Math.max(1, ...(summary?.months ?? []).flatMap(item => [item.income, item.expense]))

  return <div className="wrap page-pad">{dialog}
    <Link className="back-link" to="/admin">← Admin</Link>
    <div className="admin-heading"><div><span className="eyebrow">Keuangan</span><h1>Kas & iuran</h1><p className="lead">Menandai iuran lunas otomatis mencatat pemasukan kas, dan membatalkannya menghapus catatan itu.</p></div></div>
    {error && <Notice error>{error}</Notice>}
    {message && <Notice>{message}</Notice>}
    <div className="permission-tabs">{TABS.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setMessage('') }}>{label}</button>)}</div>

    {tab === 'iuran' && <>
      <div className="stat-grid">
        <StatCard icon={<Wallet />} label="Terkumpul" value={rupiah(collected)} note={`${paid.length} lunas`} tone="ok" />
        <StatCard icon={<Wallet />} label="Belum dibayar" value={rupiah(outstanding)} note={`${(dues?.length ?? 0) - paid.length} anggota`} tone="warn" />
      </div>
      <Panel title="Periode tagihan" action={<div className="admin-heading-actions">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
        <input type="number" className="year-input" value={year} onChange={e => setYear(Number(e.target.value))} />
      </div>}>
        <div className="form-row">
          <label className="field"><span>Nominal per anggota</span><input type="number" min={0} step={500} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
          <button className="btn" onClick={generate}><Plus size={16} /> Buat tagihan bulan ini</button>
        </div>
        {!dues ? <TableSkeleton rows={5} cols={3} /> : <div className="table-wrap"><table>
          <thead><tr><th>Anggota</th><th>Nominal</th><th>Status</th><th></th></tr></thead>
          <tbody>{dues.map(due => <tr key={due.id}>
            <td><strong>{due.member?.display_name || due.member?.full_name}</strong><small>{due.member?.class_name ?? ''}</small></td>
            <td>{rupiah(due.amount)}</td>
            <td><span className={`status ${due.status === 'lunas' ? 'lunas' : 'pending'}`}>{due.status}</span>{due.paid_at && <small>{dateOnly(due.paid_at)}</small>}</td>
            <td><button className={`btn small ${due.status === 'lunas' ? 'secondary' : ''}`} onClick={() => toggle(due)}>{due.status === 'lunas' ? 'Batalkan' : 'Tandai lunas'}</button></td>
          </tr>)}{!dues.length && <tr><td colSpan={4}>Belum ada tagihan untuk periode ini.</td></tr>}</tbody></table></div>}
      </Panel>
    </>}

    {tab === 'transaksi' && <div className="dashboard-grid">
      <Panel title="Catat transaksi">
        <form className="admin-form" onSubmit={addTx}>
          <div className="segmented">
            <button type="button" className={tx.type === 'pemasukan' ? 'on' : ''} onClick={() => setTx({ ...tx, type: 'pemasukan' })}>Pemasukan</button>
            <button type="button" className={tx.type === 'pengeluaran' ? 'on' : ''} onClick={() => setTx({ ...tx, type: 'pengeluaran' })}>Pengeluaran</button>
          </div>
          <label className="field"><span>Kategori</span><input value={tx.category} onChange={e => setTx({ ...tx, category: e.target.value })} placeholder="Contoh: Perlengkapan, Konsumsi" required /></label>
          <div className="form-row">
            <label className="field"><span>Nominal</span><input type="number" min={1} value={tx.amount} onChange={e => setTx({ ...tx, amount: e.target.value })} required /></label>
            <label className="field"><span>Tanggal</span><input type="date" value={tx.date} onChange={e => setTx({ ...tx, date: e.target.value })} required /></label>
          </div>
          <label className="field"><span>Keterangan</span><input value={tx.description} onChange={e => setTx({ ...tx, description: e.target.value })} /></label>
          <button className="btn"><Plus size={16} /> Simpan</button>
        </form>
      </Panel>
      <Panel title="Transaksi terbaru" action={<button className="btn small secondary" onClick={exportTx} disabled={!txs?.length}><Download size={14} /> Excel</button>}>
        {!txs ? <TableSkeleton rows={5} cols={3} /> : <div className="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Kategori</th><th>Nominal</th><th></th></tr></thead>
          <tbody>{txs.map(row => <tr key={row.id}>
            <td>{dateOnly(row.transaction_date)}</td>
            <td><strong>{row.category}</strong><small>{row.description ?? ''}</small></td>
            <td className={row.type === 'pemasukan' ? 'amount-in' : 'amount-out'}>{row.type === 'pemasukan' ? '+' : '−'}{rupiah(row.amount)}</td>
            <td>{!row.due_id && <button className="btn small danger" aria-label="Hapus" onClick={() => removeTx(row)}><Trash2 size={14} /></button>}</td>
          </tr>)}{!txs.length && <tr><td colSpan={4}>Belum ada transaksi.</td></tr>}</tbody></table></div>}
      </Panel>
    </div>}

    {tab === 'ringkasan' && <>
      <div className="stat-grid"><StatCard icon={<Wallet />} label="Saldo kas" value={rupiah(summary?.balance ?? 0)} tone="ok" /></div>
      <Panel title={`Arus kas ${year}`}>
        {!summary ? <TableSkeleton rows={6} cols={3} /> : <div className="cash-bars">{summary.months.map(item => <div className="cash-row" key={item.month}>
          <span>{MONTHS[item.month - 1].slice(0, 3)}</span>
          <div><i className="in" style={{ width: `${(item.income / peak) * 100}%` }} /><i className="out" style={{ width: `${(item.expense / peak) * 100}%` }} /></div>
          <small>{rupiah(item.income)} / {rupiah(item.expense)}</small>
        </div>)}<p className="muted"><span className="dot in" /> pemasukan <span className="dot out" /> pengeluaran</p></div>}
      </Panel>
    </>}
  </div>
}
