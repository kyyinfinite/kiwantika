import { useEffect, useRef, useState, type PointerEvent, type Ref } from 'react'
import { Flag, Layers3, Sparkles, Zap, Compass as CompassIcon } from 'lucide-react'
import { gsap } from 'gsap'

const MORSE_MAP: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
}
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k])) as Record<string, string>
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]
const SEMAPHORE_POSES: Record<string, [number, number]> = {
  A:[180,135],B:[180,90],C:[180,45],D:[180,0],E:[315,180],F:[270,180],G:[225,180],
  H:[135,90],I:[135,0],J:[270,0],K:[0,135],L:[315,135],M:[270,135],N:[225,135],
  O:[45,90],P:[0,90],Q:[315,90],R:[270,90],S:[225,90],T:[0,45],U:[315,45],V:[225,0],
  W:[270,315],X:[225,315],Y:[270,45],Z:[270,225],
}
const SEMAPHORE_REVERSE = Object.fromEntries(Object.entries(SEMAPHORE_POSES).map(([letter,pose])=>[`${pose[0]}:${pose[1]}`,letter])) as Record<string,string>

export function InteractivePramukaLab() {
  const [tab, setTab] = useState<'morse' | 'semaphore' | 'cipher' | 'compass'>('morse')
  const [morseText, setMorseText] = useState('KIWANTIKA')
  const [morseInput, setMorseInput] = useState('')
  const [morseTap, setMorseTap] = useState('')
  const [semaphoreLH, setSemaphoreLH] = useState(SEMAPHORE_POSES.A[0])
  const [semaphoreRH, setSemaphoreRH] = useState(SEMAPHORE_POSES.A[1])
  const [semaphoreTarget, setSemaphoreTarget] = useState<[number, number]>([90,225])
  const [semaphoreText,setSemaphoreText]=useState('A')
  const [semaphoreIndex,setSemaphoreIndex]=useState(0)
  const [semaphorePlaying,setSemaphorePlaying]=useState(false)
  const [semaphoreDecodeBuffer,setSemaphoreDecodeBuffer]=useState('')
  const [cipherMode, setCipherMode] = useState<'AN' | 'AZ' | 'NUMBER'>('AN')
  const [cipherText, setCipherText] = useState('PRAMUKA')
  const [bearing, setBearing] = useState(0)
  const [targetBearing, setTargetBearing] = useState(135)

  const morseEncoded = morseText.toUpperCase().split('').map(ch => ch === ' ' ? '/' : MORSE_MAP[ch] || ch).join(' ')
  const morseDecoded = morseInput.trim().split(/\s+/).map(token => token === '/' ? ' ' : MORSE_REVERSE[token] || '·').join('')
  const tapDecoded = morseTap ? MORSE_REVERSE[morseTap] || '—' : '—'
  const cipherEncoded = cipherText.toUpperCase().split('').map(ch => {
    if (!/[A-Z]/.test(ch)) return ch
    if (cipherMode === 'AN') return String.fromCharCode(65 + ((ch.charCodeAt(0) - 65 + 13) % 26))
    if (cipherMode === 'AZ') return String.fromCharCode(90 - (ch.charCodeAt(0) - 65))
    return String(ch.charCodeAt(0) - 64)
  }).join(cipherMode === 'NUMBER' ? ' · ' : '')
  const compassDelta = (targetBearing - bearing + 360) % 360
  const shortestCompassDelta = Math.min(compassDelta, 360 - compassDelta)
  const compassMessage = shortestCompassDelta === 0 ? 'Tepat sasaran' : `Selisih ${shortestCompassDelta}° · ${compassDelta <= 180 ? 'searah' : 'berlawanan'} jarum jam`
  const tabs = [
    { id: 'morse' as const, label: 'Morse', icon: <Zap size={17} /> },
    { id: 'semaphore' as const, label: 'Semaphore', icon: <Flag size={17} /> },
    { id: 'cipher' as const, label: 'Sandi', icon: <Layers3 size={17} /> },
    { id: 'compass' as const, label: 'Kompas', icon: <CompassIcon size={17} /> },
  ]

  const addMorseTap = (symbol: '.' | '-') => setMorseTap(prev => `${prev}${symbol}`)
  const nextSemaphoreTarget = () => {
    const a = ANGLES[Math.floor(Math.random() * ANGLES.length)]
    let b = ANGLES[Math.floor(Math.random() * ANGLES.length)]
    if (b === a) b = ANGLES[(ANGLES.indexOf(a) + 3) % ANGLES.length]
    setSemaphoreTarget([a, b])
    setSemaphoreLH(0)
    setSemaphoreRH(0)
  }
  const semaphoreMessage=semaphoreText.toUpperCase().replace(/[^A-Z ]/g,'').slice(0,32)
  const semaphoreSequence=semaphoreMessage.split('')
  const semaphoreChar=semaphoreSequence[semaphoreIndex] || 'A'
  const autoPose=SEMAPHORE_POSES[semaphoreChar] || SEMAPHORE_POSES.A
  const activeSemaphorePose: [number, number] = semaphorePlaying ? autoPose : [semaphoreLH, semaphoreRH]
  const detectedSemaphore=SEMAPHORE_REVERSE[`${semaphoreLH}:${semaphoreRH}`] || '—'
  const semaphoreSolved=semaphoreLH===semaphoreTarget[0] && semaphoreRH===semaphoreTarget[1]
  useEffect(()=>{
    if(!semaphorePlaying || semaphoreSequence.length<1) return
    const timer=window.setInterval(()=>setSemaphoreIndex(prev=>(prev+1)%semaphoreSequence.length),1100)
    return ()=>window.clearInterval(timer)
  },[semaphorePlaying,semaphoreSequence.length])
  useEffect(()=>{
    if(!semaphorePlaying){setSemaphoreIndex(0);return}
    if(semaphoreChar===' '){ setSemaphoreLH(180); setSemaphoreRH(180); return }
    setSemaphoreLH(autoPose[0]); setSemaphoreRH(autoPose[1])
  },[semaphoreChar,semaphorePlaying])
  const applySemaphoreLetter=(letter:string)=>{ const pose=SEMAPHORE_POSES[letter] || SEMAPHORE_POSES.A; setSemaphoreLH(pose[0]); setSemaphoreRH(pose[1]); setSemaphorePlaying(false) }
  const addSemaphoreDecoded=()=>{ if(detectedSemaphore!=='—') setSemaphoreDecodeBuffer(prev=>`${prev}${detectedSemaphore}`.slice(-32)) }
  const addCipherLetter = (letter: string) => setCipherText(prev => `${prev}${letter}`.slice(-40))

  return <section className="section learning-interactive-lab" id="lab"><div className="wrap">
    <div className="learning-section-head" data-learning-reveal>
      <div><span className="eyebrow">INTERACTIVE LAB · LEARNING BY DOING</span><h2>Jangan cuma<br /><em>membaca.</em> Coba.</h2></div>
      <p>SVG sekarang menjadi alat belajar: bisa ditekan, digeser, diputar, dan dipakai untuk memecahkan tantangan.</p>
    </div>
    <div className="learning-lab-tabs" role="tablist" aria-label="Pramuka Interactive Lab">
      {tabs.map(item => <button key={item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)} role="tab" aria-selected={tab === item.id}>{item.icon}{item.label}</button>)}
    </div>

    {tab === 'morse' && <div className="learning-lab-panel">
      <div className="lab-copy"><span className="eyebrow">01 · MORSE LAB</span><h3>Tekan. Tahan. Dengarkan pola.</h3><p>SVG telegraf di sebelah kanan bisa digunakan langsung. Tap cepat menghasilkan titik; tahan menghasilkan garis.</p>
        <label>Pesan teks<input value={morseText} onChange={e => setMorseText(e.target.value.slice(0, 80))} placeholder="Contoh: KIWANTIKA" /></label>
        <div className="lab-output"><small>HASIL MORSE</small><strong>{morseEncoded || '—'}</strong></div>
        <label>Uji decode<input value={morseInput} onChange={e => setMorseInput(e.target.value)} placeholder="-.- .. .-- .- ..." /></label>
        <div className="lab-feedback"><span>HASIL</span><b>{morseInput ? morseDecoded : 'Masukkan pola Morse'}</b></div>
      </div>
      <div className="lab-visual lab-morse-visual">
        <InteractiveMorseSVG onTap={addMorseTap} sequence={morseTap} decoded={tapDecoded} onSpace={() => setMorseTap('')} />
        <p>Mode telegraf: tekan cepat = titik · tahan = garis. Tombol spasi menyelesaikan satu karakter.</p>
      </div>
    </div>}

    {tab === 'semaphore' && <div className="learning-lab-panel semaphore-advanced-panel">
      <div className="lab-copy"><span className="eyebrow">02 · SEMAPHORE STUDIO</span><h3>Ketik huruf. Orangnya berubah.</h3><p>Setiap huruf memiliki pasangan posisi kedua lengan. SVG manusia di kanan dirender dari data semaphore, sehingga pose berubah langsung saat kamu mengetik.</p>
        <label>Huruf / pesan<input value={semaphoreText} onChange={e=>{setSemaphoreText(e.target.value.toUpperCase().slice(0,32));setSemaphorePlaying(false)}} placeholder="A atau PRAMUKA" /></label>
        <div className="semaphore-letter-strip">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter=><button key={letter} type="button" className={semaphoreChar===letter&&!semaphorePlaying?'is-active':''} onClick={()=>{setSemaphoreText(letter);applySemaphoreLetter(letter)}}>{letter}</button>)}</div>
        <div className="semaphore-studio-controls"><button className="btn primary" type="button" onClick={()=>{setSemaphoreIndex(0);setSemaphorePlaying(true)}} disabled={!semaphoreSequence.length}>▶ Putar pesan</button><button className="btn secondary" type="button" onClick={()=>setSemaphorePlaying(false)}>Pause</button></div>
        <div className="lab-feedback"><span>POSE AKTIF</span><b>{semaphoreChar} · {autoPose[0]}° + {autoPose[1]}°</b><small>Sudut mengikuti perspektif pengirim: lengan kiri pengirim tampil di kanan layar. Pose diselaraskan dengan diagram semaphore standar.</small></div>
        <div className="lab-feedback"><span>DECODE DRAG</span><b>{detectedSemaphore==='—'?'Belum cocok':`Terdeteksi: ${detectedSemaphore}`}</b><small>Geser kedua ujung lengan lalu tekan “Masukkan huruf”.</small></div>
        <div className="semaphore-studio-controls"><button className="btn secondary" type="button" onClick={addSemaphoreDecoded}>Masukkan huruf</button><button className="btn secondary" type="button" onClick={()=>setSemaphoreDecodeBuffer('')}>Reset</button></div>
        <div className="lab-output"><small>HASIL DECODE</small><strong>{semaphoreDecodeBuffer||'—'}</strong></div>
        <label>Lengan kiri pengirim · {semaphoreLH}°<input type="range" min="0" max="315" step="45" value={semaphoreLH} onChange={e=>{setSemaphoreLH(Number(e.target.value));setSemaphorePlaying(false)}} /></label>
        <label>Lengan kanan pengirim · {semaphoreRH}°<input type="range" min="0" max="315" step="45" value={semaphoreRH} onChange={e=>{setSemaphoreRH(Number(e.target.value));setSemaphorePlaying(false)}} /></label>
        <div className={`lab-feedback ${semaphoreSolved?'success':''}`}><span>TANTANGAN POSISI</span><b>{semaphoreSolved?'✓ Posisi cocok':`${semaphoreTarget[0]}° + ${semaphoreTarget[1]}°`}</b></div>
        <button className="btn secondary" type="button" onClick={nextSemaphoreTarget}>Tantangan baru</button>
      </div>
      <div className="lab-visual semaphore-stage semaphore-studio-stage"><InteractiveSemaphorePerson lh={activeSemaphorePose[0]} rh={activeSemaphorePose[1]} onLH={v=>{setSemaphoreLH(v);setSemaphorePlaying(false)}} onRH={v=>{setSemaphoreRH(v);setSemaphorePlaying(false)}} solved={semaphoreSolved} /><div className="semaphore-current"><span>{semaphoreChar}</span><small>{semaphoreIndex+1}/{Math.max(semaphoreSequence.length,1)}</small></div><p>Pose manusia + dua bendera adalah SVG interaktif. Drag ujung bendera untuk mode decoder.</p></div>
    </div>}

    {tab === 'cipher' && <div className="learning-lab-panel">
      <div className="lab-copy"><span className="eyebrow">03 · SANDI LAB</span><h3>Bangun pesan dari SVG.</h3><p>Klik huruf pada alfabet visual untuk menyusun pesan. Pilih kunci AN, AZ, atau angka untuk melihat transformasinya.</p>
        <div className="lab-segmented">{(['AN', 'AZ', 'NUMBER'] as const).map(mode => <button key={mode} type="button" className={cipherMode === mode ? 'is-active' : ''} onClick={() => setCipherMode(mode)}>{mode === 'NUMBER' ? 'A=1' : mode}</button>)}</div>
        <label>Pesan<input value={cipherText} onChange={e => setCipherText(e.target.value.toUpperCase().slice(0, 40))} /></label>
        <div className="lab-output"><small>HASIL TRANSFORMASI</small><strong>{cipherEncoded || '—'}</strong></div>
        <button className="btn secondary" type="button" onClick={() => setCipherText('')}>Kosongkan</button>
      </div>
      <div className="lab-visual cipher-visual"><InteractiveCipherSVG mode={cipherMode} text={cipherText} onLetter={addCipherLetter} /><div className="cipher-lock"><Layers3 size={32} /><strong>Klik huruf.</strong><span>SVG menjadi keyboard sandi.</span></div><p>Pilih huruf langsung dari diagram untuk membangun pesan tanpa keyboard.</p></div>
    </div>}

    {tab === 'compass' && <div className="learning-lab-panel">
      <div className="lab-copy"><span className="eyebrow">04 · COMPASS LAB</span><h3>Putar kompas menuju target.</h3><p>Drag ring kompas untuk mengubah bearing. Gunakan slider sebagai kontrol alternatif. Target dibuat acak agar latihan tidak monoton.</p>
        <label>Bearing · {bearing}°<input type="range" min="0" max="359" value={bearing} onChange={e => setBearing(Number(e.target.value))} /></label>
        <label>Target · {targetBearing}°<input type="range" min="0" max="359" value={targetBearing} onChange={e => setTargetBearing(Number(e.target.value))} /></label>
        <div className={`lab-feedback ${shortestCompassDelta === 0 ? 'success' : ''}`}><span>FEEDBACK</span><b>{compassMessage}</b><small>Bearing memakai rentang 000–359°.</small></div>
        <div className="lab-button-row"><button className="btn secondary" type="button" onClick={() => setBearing(targetBearing)}>Set ke target</button><button className="btn primary" type="button" onClick={() => { setTargetBearing(Math.floor(Math.random() * 360)); setBearing(0) }}>Acak tantangan</button></div>
      </div>
      <div className="lab-visual compass-stage"><InteractiveCompassSVG bearing={bearing} target={targetBearing} onBearing={setBearing} /><p>Drag ring atau gunakan slider. Visual ini melatih konsep bearing; latihan navigasi lapangan tetap bersama pembina.</p></div>
    </div>}
    <div className="learning-lab-note"><Sparkles size={16} /><span>Interaksi visual dibuat sebagai simulator pembelajaran. Kompetensi lapangan tetap diverifikasi melalui latihan, sumber resmi, dan pembina.</span></div>
  </div></section>
}

function InteractiveMorseSVG({ onTap, sequence, decoded, onSpace }: { onTap: (symbol: '.' | '-') => void; sequence: string; decoded: string; onSpace: () => void }) {
  const pressRef = useRef<number | null>(null)
  const handleDown = () => { pressRef.current = window.setTimeout(() => { pressRef.current = null; onTap('-') }, 360) }
  const handleUp = () => { if (pressRef.current !== null) { window.clearTimeout(pressRef.current); pressRef.current = null; onTap('.') } }
  return <svg className="interactive-svg morse-machine" viewBox="0 0 620 430" role="img" aria-label="Kunci telegraf Morse interaktif">
    <defs><linearGradient id="morseMetal" x1="0" x2="1"><stop offset="0" stopColor="#d6dfd7" /><stop offset="1" stopColor="#aebcaf" /></linearGradient></defs>
    <rect x="30" y="30" width="560" height="370" rx="30" fill="#f7f4ec" stroke="#c9d7cc" strokeWidth="2" />
    <circle cx="170" cy="205" r="92" fill="#edf3ee" stroke="#9db2a2" strokeWidth="3" />
    <circle cx="170" cy="205" r="63" fill="none" stroke="#c4d2c7" strokeDasharray="5 8" />
    <rect x="355" y="115" width="155" height="90" rx="18" fill="url(#morseMetal)" stroke="#708477" strokeWidth="3" />
    <circle cx="432" cy="160" r="24" fill="#1f6847" opacity=".92" />
    <rect x="350" y="235" width="165" height="64" rx="16" fill="#fff" stroke="#d1ddd3" />
    <text x="432" y="262" textAnchor="middle" fill="#748278" fontSize="12" fontWeight="800" letterSpacing="2">KARAKTER</text>
    <text x="432" y="286" textAnchor="middle" fill="#173d2b" fontSize="24" fontWeight="900">{sequence || '—'}</text>
    <g className="morse-key-hit" tabIndex={0} role="button" aria-label="Tekan untuk titik atau tahan untuk garis" onPointerDown={handleDown} onPointerUp={handleUp} onPointerCancel={handleUp} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onTap('.') } }}>
      <ellipse cx="170" cy="205" rx="48" ry="34" fill="#b99b55" />
      <ellipse cx="170" cy="194" rx="48" ry="34" fill="#d6b768" stroke="#8f7438" strokeWidth="3" />
      <circle cx="170" cy="194" r="9" fill="#f7f4ec" />
    </g>
    <text x="170" y="328" textAnchor="middle" fill="#173d2b" fontSize="14" fontWeight="900">TAP = ·   HOLD = —</text>
    <text x="432" y="337" textAnchor="middle" fill="#173d2b" fontSize="15" fontWeight="900">{decoded === '—' ? 'Belum ada karakter' : decoded}</text>
    <g className="svg-action" tabIndex={0} role="button" aria-label="Selesaikan karakter dan kosongkan pola" onClick={onSpace} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSpace() }}>
      <rect x="355" y="355" width="155" height="30" rx="10" fill="#1f6847" />
      <text x="432" y="375" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900">SPASI / CLEAR</text>
    </g>
  </svg>
}

function InteractiveSemaphorePerson({lh,rh,onLH,onRH,solved}:{lh:number;rh:number;onLH:(v:number)=>void;onRH:(v:number)=>void;solved:boolean}) {
  const ref=useRef<SVGSVGElement|null>(null)
  const lhRef=useRef<SVGGElement|null>(null)
  const rhRef=useRef<SVGGElement|null>(null)
  const badgeRef=useRef<SVGRectElement|null>(null)
  const dragRef=useRef<'lh'|'rh'|null>(null)
  const reduceMotion=useRef(false)

  useEffect(()=>{
    reduceMotion.current=window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },[])

  const toAngle=(event:PointerEvent<SVGSVGElement>)=>{
    const svg=ref.current
    if(!svg || !dragRef.current) return 0
    const rect=svg.getBoundingClientRect()
    const x=(event.clientX-rect.left)/rect.width*520
    const y=(event.clientY-rect.top)/rect.height*620
    const [ox,oy]=dragRef.current==='lh' ? [290,285] : [230,285]
    const dx=x-ox
    const dy=y-oy
    // SVG: 0° = up, 90° = screen-right, 180° = down, 270° = screen-left.
    const visualAngle=(Math.atan2(dx,-dy)*180/Math.PI+360)%360
    // Semaphore labels are always the signaller's own left/right.
    // The person faces the viewer, therefore the signaller's RH is mirrored
    // horizontally on screen while LH is not.
    const signallerAngle=dragRef.current==='lh' ? visualAngle : (360-visualAngle)%360
    return Math.round(signallerAngle/45)*45%360
  }

  const move=(event:PointerEvent<SVGSVGElement>)=>{
    if(!dragRef.current) return
    const a=toAngle(event)
    if(dragRef.current==='lh') onLH(a)
    else onRH(a)
  }

  useEffect(()=>{
    const animateArm=(node:SVGGElement|null,angle:number,mirror:boolean,origin:[number,number])=>{
      if(!node) return
      const rotation=mirror ? -angle : angle
      if(dragRef.current || reduceMotion.current){
        gsap.set(node,{rotation,svgOrigin:`${origin[0]} ${origin[1]}`})
        return
      }
      gsap.to(node,{rotation,duration:.38,ease:'power2.out',overwrite:true,svgOrigin:`${origin[0]} ${origin[1]}`})
    }
    animateArm(lhRef.current,lh,false,[290,285])
    animateArm(rhRef.current,rh,true,[230,285])
    if(badgeRef.current){
      if(reduceMotion.current) gsap.set(badgeRef.current,{scale:solved?1.035:1,transformOrigin:'260px 557px'})
      else gsap.to(badgeRef.current,{scale:solved?1.035:1,duration:.24,ease:'power1.out',overwrite:true,transformOrigin:'260px 557px'})
    }
  },[lh,rh,solved])

  return <svg ref={ref} className="interactive-svg semaphore-person-machine" viewBox="0 0 520 620" role="img" aria-label="Figur manusia semaphore interaktif" onPointerMove={move} onPointerUp={()=>dragRef.current=null} onPointerCancel={()=>dragRef.current=null} onPointerLeave={()=>{ if(dragRef.current) dragRef.current=null }}>
    <defs>
      <filter id="semShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodOpacity=".11"/></filter>
    </defs>
    <circle cx="260" cy="300" r="238" fill="#f8fbf7" stroke="#cbd9ce" strokeWidth="2"/>
    {ANGLES.map(a=><line key={a} x1="260" y1="48" x2="260" y2="69" stroke="#cad7cd" strokeWidth="2" transform={`rotate(${a} 260 300)`}/>)}
    <g filter="url(#semShadow)">
      <circle cx="260" cy="225" r="36" fill="#173d2b"/>
      <path d="M230 268 Q260 250 290 268 L305 390 Q260 410 215 390 Z" fill="#fff" stroke="#173d2b" strokeWidth="4"/>
      <path d="M235 385 L225 500" stroke="#173d2b" strokeWidth="15" strokeLinecap="round"/>
      <path d="M285 385 L295 500" stroke="#173d2b" strokeWidth="15" strokeLinecap="round"/>
    </g>
    {/* Signaller's LH is on the viewer's right; RH is on the viewer's left. */}
    <SemaphorePersonArm ref={lhRef} angle={lh} color="#1f6847" origin={[290,285]} mirror={false} label="kiri" onPointerDown={()=>dragRef.current='lh'} />
    <SemaphorePersonArm ref={rhRef} angle={rh} color="#d4a02c" origin={[230,285]} mirror label="kanan" onPointerDown={()=>dragRef.current='rh'} />
    <circle cx="260" cy="300" r="8" fill="#d4a02c" stroke="#173d2b" strokeWidth="3"/>
    <rect ref={badgeRef} x="155" y="535" width="210" height="45" rx="14" fill={solved?'#1f6847':'#fff'} stroke="#c8d7cc"/>
    <text x="260" y="563" textAnchor="middle" fill={solved?'#fff':'#173d2b'} fontSize="13" fontWeight="900">{solved?'✓ POSE COCOK':'DRAG UJUNG BENDERA'}</text>
    <text x="260" y="31" textAnchor="middle" fill="#748278" fontSize="10" fontWeight="900" letterSpacing="1.5">PERSPEKTIF PENGIRIM</text>
  </svg>
}

function SemaphorePersonArm({angle,color,origin,mirror,onPointerDown,label,ref}:{angle:number;color:string;origin:[number,number];mirror:boolean;onPointerDown:()=>void;label:string;ref?:Ref<SVGGElement>}){
  const [ox,oy]=origin
  const rotation=mirror ? -angle : angle
  return <g ref={ref} className="semaphore-person-arm" onPointerDown={(event)=>{event.stopPropagation();onPointerDown()}} tabIndex={0} role="button" aria-label={`Lengan ${label} pengirim, ${angle} derajat`}>
    <line x1={ox} y1={oy} x2={ox} y2={oy-185} stroke={color} strokeWidth="16" strokeLinecap="round"/>
    <circle cx={ox} cy={oy-185} r="17" fill="#fff" stroke={color} strokeWidth="5"/>
    <path d={`M ${ox} ${oy-213} l ${mirror?-38:38} -12 l ${mirror?-18:18} 28 l ${mirror?-38:38} 12 z`} fill={color}/>
  </g>
}

function InteractiveCipherSVG({ mode, text, onLetter }: { mode: 'AN' | 'AZ' | 'NUMBER'; text: string; onLetter: (letter: string) => void }) {
  return <svg className="interactive-svg cipher-machine" viewBox="0 0 650 430" role="img" aria-label="Alfabet sandi interaktif">
    <rect x="24" y="24" width="602" height="382" rx="26" fill="#f7f4ec" stroke="#cad8cd" strokeWidth="2" />
    <text x="55" y="66" fill="#173d2b" fontSize="13" fontWeight="900" letterSpacing="2">KLIK HURUF UNTUK MENYUSUN PESAN</text>
    <text x="55" y="94" fill="#708077" fontSize="12">Mode: {mode === 'NUMBER' ? 'A=1' : mode}</text>
    <g transform="translate(48 120)">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, i) => {
      const x = (i % 13) * 42
      const y = Math.floor(i / 13) * 72
      const mapped = mode === 'AN' ? String.fromCharCode(65 + ((i + 13) % 26)) : mode === 'AZ' ? String.fromCharCode(90 - i) : String(i + 1)
      return <g key={letter} className="cipher-key-svg" tabIndex={0} role="button" aria-label={`${letter} menjadi ${mapped}`} onClick={() => onLetter(letter)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onLetter(letter) }}>
        <rect x={x} y={y} width="34" height="54" rx="9" fill="#fff" stroke="#c9d8cc" />
        <text x={x + 17} y={y + 22} textAnchor="middle" fill="#1f6847" fontSize="13" fontWeight="900">{letter}</text>
        <text x={x + 17} y={y + 42} textAnchor="middle" fill="#7b8a81" fontSize="10" fontWeight="800">{mapped}</text>
      </g>
    })}</g>
    <rect x="48" y="280" width="554" height="90" rx="16" fill="#edf3ee" stroke="#c8d8cb" />
    <text x="70" y="310" fill="#708077" fontSize="10" fontWeight="900" letterSpacing="1.5">PESAN SAAT INI</text>
    <text x="70" y="343" fill="#173d2b" fontSize="22" fontWeight="900" letterSpacing="2">{text || '—'}</text>
  </svg>
}

function InteractiveCompassSVG({ bearing, target, onBearing }: { bearing: number; target: number; onBearing: (v: number) => void }) {
  const ref = useRef<SVGSVGElement | null>(null)
  const update = (event: PointerEvent<SVGSVGElement>) => {
    const svg = ref.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width * 500 - 250
    const y = (event.clientY - rect.top) / rect.height * 500 - 250
    let angle = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360
    onBearing(Math.round(angle))
  }
  const delta = Math.min((target - bearing + 360) % 360, (bearing - target + 360) % 360)
  return <svg ref={ref} className="interactive-svg compass-machine" viewBox="0 0 500 500" role="img" aria-label="Kompas SVG yang dapat diputar dengan drag" onPointerDown={update} onPointerMove={e => e.buttons === 1 && update(e)}>
    <circle cx="250" cy="250" r="225" fill="#f7f4ec" stroke="#173d2b" strokeWidth="18" />
    <circle cx="250" cy="250" r="192" fill="#fff" stroke="#9db2a2" strokeWidth="3" />
    {Array.from({ length: 36 }).map((_, i) => <line key={i} x1="250" y1="66" x2="250" y2={i % 3 === 0 ? 48 : 56} stroke="#708477" strokeWidth={i % 3 === 0 ? 3 : 1.5} transform={`rotate(${i * 10} 250 250)`}/>) }
    <g transform={`rotate(${-bearing} 250 250)`}>
      <text x="250" y="92" textAnchor="middle" fill="#c23c30" fontSize="19" fontWeight="900">N</text><text x="408" y="256" textAnchor="middle" fill="#173d2b" fontSize="16" fontWeight="900">E</text><text x="250" y="421" textAnchor="middle" fill="#173d2b" fontSize="16" fontWeight="900">S</text><text x="92" y="256" textAnchor="middle" fill="#173d2b" fontSize="16" fontWeight="900">W</text>
      <path d="M250 104 L266 250 L250 228 L234 250 Z" fill="#c23c30" /><path d="M250 396 L266 250 L250 272 L234 250 Z" fill="#33453a" />
      <circle cx="250" cy="250" r="15" fill="#d4a02c" stroke="#173d2b" strokeWidth="5" />
    </g>
    <g transform={`rotate(${target} 250 250)`}><path d="M250 38 L244 55 L256 55 Z" fill="#d4a02c" /><line x1="250" y1="38" x2="250" y2="70" stroke="#d4a02c" strokeWidth="3" /></g>
    <circle cx="250" cy="250" r="228" fill="none" stroke={delta === 0 ? '#1f6847' : '#d4a02c'} strokeWidth="4" strokeDasharray="8 12" />
    <text x="250" y="470" textAnchor="middle" fill="#173d2b" fontSize="13" fontWeight="900">BEARING {String(bearing).padStart(3, '0')}° · TARGET {String(target).padStart(3, '0')}°</text>
  </svg>
}
