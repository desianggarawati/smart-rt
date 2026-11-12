import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Bell, CalendarDays, Check, ClipboardList, Home, Landmark, LogOut, Menu, ShieldCheck, Users, Wallet } from "lucide-react";

type Resident = { id:string; full_name:string; phone:string|null; resident_type:"permanent"|"temporary"; status:string; house_id:string|null; house?:{code:string}|null };
type House = {id:string;code:string};
type Request = {id:string; full_name:string;phone:string; house_id:string;resident_type:string; status:string; house?:{code:string}|null};
type View = "home"|"bills"|"calendar"|"ledger"|"menu"|"residents"|"approvals";
const residentType = (t:string)=>t==="temporary"?"Kontrak":"Tetap";

export default function App(){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true);
 const [profile,setProfile]=useState<Resident|null>(null);
 const [houses,setHouses]=useState<House[]>([]);
 const [requests,setRequests]=useState<Request[]>([]);
 const [members,setMembers]=useState<Resident[]>([]);
 const [isAdmin,setIsAdmin]=useState(false);
 const [view,setView]=useState<View>("home");
 const [authMode,setAuthMode]=useState<"login"|"register">("login");
 const [form,setForm]=useState({full_name:"",phone:"",house_id:"",resident_type:"permanent",email:"",password:""});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [houseCode,setHouseCode]=useState("");
 const [selectedDate,setSelectedDate]=useState<number|null>(null);
 const configured=!!supabase;
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  const client=supabase;
  client.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>setSession(next));
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
  if(session?.user.user_metadata?.full_name){setForm(old=>({...old,full_name:old.full_name||String(session.user.user_metadata.full_name)}));}
 },[session?.user.id]);
 useEffect(()=>{
  if(!supabase)return;
  supabase.from("houses").select("id,code").eq("active",true).order("code").then(({data})=>setHouses((data||[]) as House[]));
 },[session]);
 useEffect(()=>{
  if(!supabase||!session){setProfile(null);setIsAdmin(false);return;}
  let cancel=false;
  const client=supabase;
  async function load(){
   const [p,admin]=await Promise.all([
    client.from("profiles").select("id,full_name,phone,resident_type,status,house_id,house:houses(code)").eq("id",session!.user.id).maybeSingle(),
    client.from("role_assignments").select("role").eq("user_id",session!.user.id).eq("role","super_admin").maybeSingle()
   ]);
   if(!cancel){setProfile(p.data as Resident|null);setIsAdmin(!!admin.data);}
  }
  void load();return ()=>{cancel=true};
 },[session]);
 async function refreshAdmin(){
  if(!supabase||!isAdmin)return;
  const [r,m,h]=await Promise.all([
   supabase.from("registration_requests").select("id,full_name,phone,house_id,resident_type,status,house:houses(code)").eq("status","pending").order("created_at"),
   supabase.from("profiles").select("id,full_name,phone,resident_type,status,house_id,house:houses(code)").order("full_name"),
   supabase.from("houses").select("id,code").order("code")
  ]);
  if(r.error||m.error||h.error){setError(r.error?.message||m.error?.message||h.error?.message||"Gagal memuat data");return;}
  setRequests((r.data||[]) as Request[]);setMembers((m.data||[]) as Resident[]);setHouses((h.data||[]) as House[]);
 }
 useEffect(()=>{if(isAdmin)void refreshAdmin()},[isAdmin]);
 async function signIn(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError("");const {error:err}=await supabase.auth.signInWithPassword({email:form.email,password:form.password});if(err)setError(err.message);setBusy(false);}
 async function register(e:FormEvent){
  e.preventDefault();if(!supabase)return;setBusy(true);setError("");
  const {data,error:err}=await supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.full_name}}});
  if(err){setError(err.message);setBusy(false);return;}
  if(!data.session){setError("Akun dibuat. Periksa email untuk verifikasi, lalu login dan lengkapi data rumah.");}
  setBusy(false);
 }
 async function submitRequest(userId:string){
  if(!supabase||!form.house_id||!form.full_name.trim()||!form.phone.trim()){setError("Nama, nomor HP, dan rumah wajib diisi.");return;}
  const {error:err}=await supabase.from("registration_requests").insert({user_id:userId,house_id:form.house_id,full_name:form.full_name.trim(),phone:form.phone.trim(),resident_type:form.resident_type});
  if(err)setError(err.message);else setError("Registrasi dikirim. Menunggu persetujuan Super Admin.");
 }
 async function adminDecision(id:string,approve:boolean){
  if(!supabase)return;setBusy(true);setError("");
  const {error:err}=await supabase.rpc("review_registration",{request_id:id,approve});
  if(err)setError(err.message);await refreshAdmin();setBusy(false);
 }
 async function addHouse(e:FormEvent){
  e.preventDefault();if(!supabase||!houseCode.trim())return;setBusy(true);setError("");
  const {error:err}=await supabase.from("houses").insert({code:houseCode.trim().toUpperCase()});
  if(err)setError(err.message);else setHouseCode("");await refreshAdmin();setBusy(false);
 }
 async function logout(){await supabase?.auth.signOut();setView("home");setProfile(null);}
 const pending=!isAdmin&&(!profile||profile.status!=="active");
 const accessLedger=!!profile&&profile.resident_type==="permanent"&&profile.status==="active"||isAdmin;
 const navigation:{key:View;name:string;icon:typeof Home}[]=[
  {key:"home",name:"Home",icon:Home},{key:"bills",name:"Tagihan",icon:Wallet},{key:"calendar",name:"Kalender",icon:CalendarDays},
  ...(accessLedger?[{key:"ledger" as View,name:"Kas RT",icon:Landmark}]:[]),{key:"menu",name:"Menu",icon:Menu}
 ];
 const tabs=(!isAdmin&&pending)?navigation.filter(x=>x.key==="home"||x.key==="menu"):navigation;
 if(loading)return <div className="min-h-screen grid place-items-center">Memuat Smart RT…</div>;
 if(!configured)return <div className="min-h-screen grid place-items-center p-6"><div className="max-w-md bg-white p-6 rounded-2xl shadow-sm"><h1 className="text-xl font-bold">Smart RT Foundation</h1><p className="mt-3 text-sm">Koneksi Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di pengaturan lingkungan hosting.</p></div></div>;
 if(!session)return <div className="min-h-screen flex justify-center items-center p-4"><div className="w-full max-w-md rounded-3xl bg-white shadow-sm overflow-hidden"><div className="bg-navy text-white p-7"><div className="flex items-center gap-2"><Home/><strong className="text-xl">smartRT</strong></div><h1 className="text-2xl font-bold mt-8">{authMode==="login"?"Selamat datang kembali":"Daftar sebagai warga"}</h1><p className="text-slate-300 mt-2">Administrasi lingkungan yang lebih mudah.</p></div><form className="p-6 space-y-3" onSubmit={authMode==="login"?signIn:register}>
 {authMode==="register"&&<><label className="block text-sm">Nama lengkap<input required className="field" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><p className="text-sm text-slate-500">Nomor HP dan pilihan rumah diisi setelah masuk, agar datanya bisa diverifikasi pengurus.</p></>}
 <label className="block text-sm">Email<input required type="email" className="field" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className="block text-sm">Password<input required type="password" minLength={8} className="field" autoComplete={authMode==="login"?"current-password":"new-password"} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
 {error&&<p role="status" className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">{error}</p>}<button disabled={busy} className="primary w-full">{busy?"Memproses…":authMode==="login"?"Masuk":"Buat akun"}</button><button type="button" className="w-full text-teal text-sm py-2" onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setError("")}}>{authMode==="login"?"Belum punya akun? Daftar":"Sudah punya akun? Masuk"}</button></form></div></div>;
 return <div className="min-h-screen max-w-lg mx-auto bg-white shadow-sm pb-24"><header className="bg-navy text-white p-6 rounded-b-3xl"><div className="flex justify-between items-center"><div className="flex items-center gap-2"><Home/><strong className="text-xl">smartRT</strong></div><div className="flex items-center gap-3"><Bell size={19}/><button aria-label="Keluar" onClick={logout}><LogOut size={19}/></button></div></div><p className="text-slate-300 text-sm mt-6">Selamat datang,</p><h1 className="text-2xl font-bold">{profile?.full_name||session.user.email}</h1><p className="text-slate-200 text-sm mt-1">Rumah {profile?.house?.code||"Belum terdaftar"} · {isAdmin?"Super Admin":residentType(profile?.resident_type||"permanent")}</p></header>
 <main className="p-5 space-y-4">
 {error&&<div role="status" className="bg-amber-50 text-amber-900 text-sm p-3 rounded-xl">{error}</div>}
 {pending&&<div className="rounded-xl bg-amber-50 border border-amber-100 p-4"><strong>Akun menunggu persetujuan</strong><p className="text-sm mt-2">Fitur warga akan terbuka setelah diverifikasi Super Admin.</p>{!profile&&<form className="space-y-2 mt-3" onSubmit={e=>{e.preventDefault();void submitRequest(session.user.id)}}><input className="field" placeholder="Nama lengkap" required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/><input className="field" placeholder="Nomor HP" required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><select className="field" required value={form.house_id} onChange={e=>setForm({...form,house_id:e.target.value})}><option value="">Pilih rumah</option>{houses.map(h=><option value={h.id} key={h.id}>{h.code}</option>)}</select><select className="field" value={form.resident_type} onChange={e=>setForm({...form,resident_type:e.target.value})}><option value="permanent">Tetap</option><option value="temporary">Kontrak</option></select><button className="primary">Kirim permintaan registrasi</button></form>}</div>}
 {view==="home"&&<><h2 className="text-lg font-bold">Ringkasan</h2>{isAdmin?<div className="grid grid-cols-2 gap-3">{[[requests.length,"Registrasi Pending"],[members.length,"Akun Warga"],[houses.length,"Rumah"]].map(([n,label])=><div key={label} className="tile"><strong className="text-2xl">{n}</strong><p className="text-sm text-slate-500">{label}</p></div>)}<button className="tile text-left" onClick={()=>setView("approvals")}><ClipboardList className="text-teal mb-2"/>Approval Warga</button><button className="tile text-left" onClick={()=>setView("residents")}><Users className="text-teal mb-2"/>Data Warga</button></div>:<><div className="bg-emerald-50 rounded-2xl p-5"><p className="text-sm text-emerald-800">Status akun</p><strong className="text-xl">{pending?"Menunggu approval":"Aktif"}</strong><p className="text-sm mt-2">Modul keuangan akan tersedia setelah tahap Finance RT.</p></div><div className="grid grid-cols-2 gap-3"><button className="tile" onClick={()=>setView("bills")}><Wallet className="text-teal mb-2"/>Tagihan</button><button className="tile" onClick={()=>setView("calendar")}><CalendarDays className="text-teal mb-2"/>Kalender</button></div></>}</>}
 {view==="approvals"&&isAdmin&&<><h2 className="text-xl font-bold">Approval Registrasi</h2>{requests.length===0?<p className="text-slate-500">Tidak ada registrasi pending.</p>:requests.map(r=><div className="tile" key={r.id}><strong>{r.full_name}</strong><p className="text-sm text-slate-500">{r.phone} · {r.house?.code||r.house_id} · {residentType(r.resident_type)}</p><div className="flex gap-2 mt-3"><button disabled={busy} className="primary" onClick={()=>adminDecision(r.id,true)}><Check size={16}/> Setujui</button><button disabled={busy} className="secondary" onClick={()=>adminDecision(r.id,false)}>Tolak</button></div></div>)}</>}
 {view==="residents"&&isAdmin&&<><h2 className="text-xl font-bold">Data Warga & Rumah</h2><form onSubmit={addHouse} className="flex gap-2"><input className="field" placeholder="Contoh: A-12" value={houseCode} onChange={e=>setHouseCode(e.target.value)}/><button className="primary" disabled={busy}>Tambah rumah</button></form><p className="text-sm text-slate-500">{houses.length} rumah terdaftar</p>{members.map(r=><div className="tile" key={r.id}><div className="flex items-start justify-between gap-2"><strong>{r.full_name}</strong><span className="text-xs rounded-full bg-emerald-100 text-emerald-900 px-2 py-1">{residentType(r.resident_type)}</span></div><p className="text-sm text-slate-500 mt-1">{r.house?.code||"—"} · {r.phone||"—"} · {r.status}</p></div>)}</>}
 {view==="bills"&&!pending&&<><h2 className="text-xl font-bold">Tagihan</h2><div className="tile"><Wallet className="text-teal mb-3"/><strong>Pembayaran belum diaktifkan</strong><p className="text-sm text-slate-500 mt-2">IPL, Iuran RT, dan custom billing tersedia pada tahap Finance RT setelah pembukuan dan approval siap.</p></div></>}
 {view==="calendar"&&!pending&&<><h2 className="text-xl font-bold">Kalender Kegiatan</h2><p className="text-sm text-slate-500">November 2026 · Tampilan awal</p><div className="grid grid-cols-7 gap-1">{["M","S","S","R","K","J","S"].map((day,i)=><span key={i} className="text-center text-slate-500 text-xs py-2">{day}</span>)}{Array.from({length:6},(_,i)=><span key={"x"+i}/>)}{Array.from({length:30},(_,i)=><button key={i} onClick={()=>setSelectedDate(i+1)} className={"rounded-lg aspect-square "+(selectedDate===i+1?"bg-teal text-white":"bg-canvas")}>{i+1}</button>)}</div>{selectedDate&&<p className="text-sm text-slate-500">{selectedDate} November: Belum ada kegiatan tersimpan.</p>}</>}
 {view==="ledger"&&accessLedger&&!pending&&<><h2 className="text-xl font-bold">Kas RT</h2><div className="tile"><Landmark className="text-teal mb-3"/><strong>Belum ada transaksi</strong><p className="text-sm text-slate-500 mt-2">Laporan akan muncul setelah modul keuangan diterapkan. Identitas pembayar dan bukti transfer tidak akan ditampilkan.</p></div></>}
 {view==="menu"&&<><h2 className="text-xl font-bold">Menu</h2>{isAdmin&&<><button className="tile w-full text-left" onClick={()=>setView("approvals")}>Persetujuan Registrasi</button><button className="tile w-full text-left" onClick={()=>setView("residents")}>Data Warga</button></>}<div className="tile"><ShieldCheck className="text-teal mb-2"/><strong>Smart RT Foundation V1</strong><p className="text-sm mt-2 text-slate-500">PKK, arisan, chat, pengumuman dan notifikasi akan diaktifkan bertahap.</p></div></>}
 </main><nav className="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-white border-t border-slate-200 grid p-2" style={{gridTemplateColumns:`repeat(${tabs.length},minmax(0,1fr))`}}>{tabs.map(t=><button key={t.key} className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs ${view===t.key?"bg-emerald-50 text-teal":"text-slate-500"}`} onClick={()=>setView(t.key)}><t.icon size={20}/>{t.name}</button>)}</nav></div>;
}
