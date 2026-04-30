import { useAuth } from '../../contexts/AuthContext';
import { useStats } from '../../hooks/useStats';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const TT_STYLE = { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:8, fontSize:12, fontFamily:'Montserrat,sans-serif' };

const fmtMoney = (n) => n != null
  ? new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:0 }).format(n)
  : '—';

const S = {
  card:   { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:12 },
  card2:  { backgroundColor:'var(--hy-bg-card2)', border:'1px solid var(--hy-border)', borderRadius:8 },
  label:  { fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--hy-text4)' },
};

/* ── Skeleton pulse ── */
const Sk = ({ w = 60, h = 32 }) => (
  <div style={{ height:h, width:w, borderRadius:6, backgroundColor:'var(--hy-border)', animation:'pulse 1.5s ease-in-out infinite' }} />
);

/* ── Skeleton pulse ── */

/* ── KPI card ── */
function KpiCard({ label, value, color, icon, prefix, loading }) {
  return (
    <div style={{ ...S.card, padding:'20px 22px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
      <div style={{ minWidth:0, flex:1 }}>
        <p style={{ ...S.label, marginBottom:10 }}>{label}</p>
        {loading
          ? <Sk w={70} h={30} />
          : <p style={{ margin:0, fontSize:26, fontWeight:800, color:'var(--hy-text1)', fontFamily:'Montserrat, sans-serif', lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {value ?? '—'}
            </p>
        }
      </div>
      <div style={{ width:42, height:42, borderRadius:10, backgroundColor:`${color}18`, color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </div>
    </div>
  );
}

const MODULES = [
  { to:'/rrhh',           label:'Recursos Humanos',   color:'#2563EB', emoji:'👥', desc:'Empleados, nómina, asistencia' },
  { to:'/proyectos',      label:'Proyectos y Tareas',  color:'#0ea5e9', emoji:'📁', desc:'Seguimiento y colaboración'    },
  { to:'/ventas',         label:'Ventas / CRM',        color:'#10b981', emoji:'📈', desc:'Pipeline y cotizaciones'       },
  { to:'/administracion', label:'Administración',      color:'#8b5cf6', emoji:'🏢', desc:'Gastos, presupuesto, proveedores' },
  { to:'/contabilidad',   label:'Contabilidad',        color:'#f59e0b', emoji:'💰', desc:'Ingresos, egresos, balance'    },
  { to:'/produccion',     label:'Producción',          color:'#f43f5e', emoji:'⚙️',  desc:'Órdenes e inventario'         },
];

/* ── SVG icons ── */
const IcoPersonas  = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IcoCarpeta   = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>;
const IcoCheck     = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IcoLeads     = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
const IcoIngreso   = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IcoEgreso    = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 01-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>;

/* ── DashboardPage ──────────────────────────────────────── */
export default function DashboardPage() {
  const { user }        = useAuth();
  const { stats, loading } = useStats();

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.email?.split('@')[0] ?? '';

  const totalProyectos = stats.proyectosByEstado.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ fontFamily:'Montserrat, sans-serif' }}>

      {/* Saludo */}
      <div style={{ marginBottom:28 }}>
        <h2 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800, color:'var(--hy-text1)' }}>
          {greeting}, {firstName} 👋
        </h2>
        <p style={{ margin:0, fontSize:13, color:'var(--hy-text4)' }}>
          {new Date().toLocaleDateString('es-MX',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </p>
      </div>

      {/* KPIs — 6 cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))', gap:14, marginBottom:28 }}>
        <KpiCard label="Empleados activos"  value={stats.empleados} color="#2563EB" icon={<IcoPersonas />}  loading={loading} />
        <KpiCard label="Proyectos activos"  value={stats.proyectos} color="#0ea5e9" icon={<IcoCarpeta />}   loading={loading} />
        <KpiCard label="Tareas pendientes"  value={stats.tareas}    color="#f59e0b" icon={<IcoCheck />}     loading={loading} />
        <KpiCard label="Leads en pipeline"  value={stats.leads}     color="#8b5cf6" icon={<IcoLeads />}     loading={loading} />
        <KpiCard label="Ingresos del mes"   value={fmtMoney(stats.ventasMes)} color="#10b981" icon={<IcoIngreso />} loading={loading} />
        <KpiCard label="Egresos del mes"    value={fmtMoney(stats.gastosMes)} color="#f43f5e" icon={<IcoEgreso />}  loading={loading} />
      </div>

      {/* Gráficas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:16, marginBottom:28 }}>

        {/* Líneas: ingresos vs egresos últimos 6 meses */}
        <div style={{ ...S.card, padding:'20px 24px', minWidth:0 }}>
          <p style={{ ...S.label, margin:'0 0 16px' }}>Ingresos vs Egresos — últimos 6 meses</p>
          {loading ? (
            <div style={{ height:160, display:'flex', alignItems:'flex-end', gap:8, paddingTop:8 }}>
              {[70,55,90,40,80,60].map((h, i) => (
                <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:'3px 3px 0 0', background:'var(--hy-border)', animation:'pulse 1.5s ease-in-out infinite', animationDelay:`${i*0.1}s` }} />
              ))}
            </div>
          ) : stats.barData.length === 0 ? (
            <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>
              Sin movimientos contables registrados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={stats.barData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hy-border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize:11, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false}
                  tickFormatter={n => n >= 1000 ? `$${(n/1000).toFixed(0)}k` : `$${n}`} />
                <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [fmtMoney(v), n]} cursor={{ stroke:'var(--hy-border)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, fontFamily:'Montserrat,sans-serif' }} />
                <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2.5} dot={{ r:3, fill:'#10b981' }} name="Ingresos" />
                <Line type="monotone" dataKey="egresos"  stroke="#f43f5e" strokeWidth={2.5} dot={{ r:3, fill:'#f43f5e' }} name="Egresos"  />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut: proyectos por estado */}
        <div style={{ ...S.card, padding:'20px 24px', minWidth:230 }}>
          <p style={{ ...S.label, margin:'0 0 16px' }}>Proyectos por estado</p>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:160 }}>
              <Sk w={130} h={130} />
            </div>
          ) : totalProyectos === 0 ? (
            <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:12 }}>Sin proyectos aún</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
              <div style={{ position:'relative' }}>
                <PieChart width={140} height={140}>
                  <Pie data={stats.proyectosByEstado.filter(d => d.value > 0)} cx={65} cy={65}
                    innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={3}>
                    {stats.proyectosByEstado.filter(d => d.value > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [v, n]} />
                </PieChart>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                  <span style={{ fontSize:20, fontWeight:800, color:'var(--hy-text1)', fontFamily:'Montserrat, sans-serif', display:'block', lineHeight:1 }}>{totalProyectos}</span>
                  <span style={{ fontSize:9, color:'var(--hy-text4)', textTransform:'uppercase', letterSpacing:'.5px' }}>total</span>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%' }}>
                {stats.proyectosByEstado.filter(d => d.value > 0).map((d, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:8, height:8, borderRadius:2, background:d.color, flexShrink:0, display:'inline-block' }} />
                      <span style={{ fontSize:11, color:'var(--hy-text3)' }}>{d.label}</span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--hy-text1)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Balance neto destacado */}
      {!loading && stats.balanceMes != null && (
        <div style={{ ...S.card, padding:'16px 24px', marginBottom:28, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <p style={{ ...S.label, margin:'0 0 4px' }}>Balance neto del mes</p>
            <p style={{ margin:0, fontSize:28, fontWeight:800, color: stats.balanceMes >= 0 ? '#10b981' : '#f43f5e', fontFamily:'Montserrat, sans-serif', lineHeight:1 }}>
              {fmtMoney(stats.balanceMes)}
            </p>
          </div>
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            <div style={{ textAlign:'center' }}>
              <p style={{ margin:'0 0 2px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--hy-text4)' }}>Ingresos</p>
              <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#10b981' }}>{fmtMoney(stats.ventasMes)}</p>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ margin:'0 0 2px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--hy-text4)' }}>Egresos</p>
              <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#f43f5e' }}>{fmtMoney(stats.gastosMes)}</p>
            </div>
          </div>
          <a href="/contabilidad" style={{ padding:'8px 18px', borderRadius:8, border:'1px solid var(--hy-border)', background:'none', color:'var(--hy-text2)', fontSize:13, fontWeight:600, cursor:'pointer', textDecoration:'none', whiteSpace:'nowrap' }}>
            Ver contabilidad →
          </a>
        </div>
      )}

      {/* Acceso rápido */}
      <div style={{ ...S.card, padding:'22px 24px', marginBottom:28 }}>
        <p style={{ ...S.label, marginBottom:18 }}>Acceso rápido</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(170px, 1fr))', gap:12 }}>
          {MODULES.map(({ to, label, color, emoji, desc }) => (
            <a key={to} href={to} style={{ ...S.card2, padding:'16px 14px', textDecoration:'none', display:'block', transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=color; e.currentTarget.style.backgroundColor='var(--hy-nav-hover-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--hy-border)'; e.currentTarget.style.backgroundColor='var(--hy-bg-card2)'; }}>
              <span style={{ fontSize:22 }}>{emoji}</span>
              <p style={{ margin:'8px 0 2px', fontSize:13, fontWeight:700, color:'var(--hy-text1)' }}>{label}</p>
              <p style={{ margin:0, fontSize:11, color:'var(--hy-text4)' }}>{desc}</p>
            </a>
          ))}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}
