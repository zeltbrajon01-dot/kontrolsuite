import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useStats() {
  const [stats, setStats] = useState({
    empleados: null, proyectos: null, tareas: null, leads: null,
    ventasMes: null, gastosMes: null, balanceMes: null,
    proyectosByEstado: [], barData: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const now      = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const [empR, proyR, tarR, leadsR, ingR, egR, proyEstR, movR] = await Promise.all([
          supabase.from('empleados').select('*', { count:'exact', head:true }).eq('estado', 'activo'),
          supabase.from('proyectos').select('*', { count:'exact', head:true }).eq('estado', 'activo'),
          supabase.from('tareas').select('*', { count:'exact', head:true }).eq('estado', 'pendiente'),
          supabase.from('leads').select('*', { count:'exact', head:true }).not('etapa', 'in', '(ganado,perdido)'),
          supabase.from('movimientos_contables').select('monto').eq('tipo','ingreso').gte('fecha', firstDay).lte('fecha', lastDay),
          supabase.from('movimientos_contables').select('monto').eq('tipo','egreso').gte('fecha', firstDay).lte('fecha', lastDay),
          supabase.from('proyectos').select('estado'),
          supabase.from('movimientos_contables').select('tipo,monto,fecha').order('fecha', { ascending:true }),
        ]);

        const ventasMes = (ingR.data || []).reduce((s, m) => s + Number(m.monto), 0);
        const gastosMes = (egR.data  || []).reduce((s, m) => s + Number(m.monto), 0);

        const byStatus = {};
        (proyEstR.data || []).forEach(p => { byStatus[p.estado] = (byStatus[p.estado] || 0) + 1; });
        const proyectosByEstado = [
          { label:'Activos',    value: byStatus['activo']     || 0, color:'#2563EB' },
          { label:'En pausa',   value: byStatus['en_pausa']   || 0, color:'#f59e0b' },
          { label:'Completados',value: byStatus['completado'] || 0, color:'#10b981' },
          { label:'Cancelados', value: byStatus['cancelado']  || 0, color:'#f43f5e' },
        ];

        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({ mes: d.toLocaleDateString('es-MX',{ month:'short' }), year:d.getFullYear(), month:d.getMonth(), ingresos:0, egresos:0 });
        }
        (movR.data || []).forEach(m => {
          const d    = new Date(m.fecha + 'T00:00:00');
          const slot = months.find(s => s.year === d.getFullYear() && s.month === d.getMonth());
          if (!slot) return;
          if (m.tipo === 'ingreso') slot.ingresos += Number(m.monto);
          else if (m.tipo === 'egreso') slot.egresos += Number(m.monto);
        });

        setStats({
          empleados: empR.count  ?? 0,
          proyectos: proyR.count ?? 0,
          tareas:    tarR.count  ?? 0,
          leads:     leadsR.count ?? 0,
          ventasMes, gastosMes, balanceMes: ventasMes - gastosMes,
          proyectosByEstado, barData: months,
        });
      } catch {
        setStats({ empleados:0, proyectos:0, tareas:0, leads:0, ventasMes:0, gastosMes:0, balanceMes:0, proyectosByEstado:[], barData:[] });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { stats, loading };
}
