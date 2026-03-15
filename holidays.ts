import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Employee, Schedule as ScheduleType } from '../types';
import { format } from 'date-fns';
import { Clock, LogIn, LogOut, Coffee, CalendarHeart } from 'lucide-react';
import { toast } from 'sonner';
import { getKosovoHoliday } from '../lib/holidays';

export function TimeClock() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [isManualBreakModalOpen, setIsManualBreakModalOpen] = useState(false);
  const [manualBreakStart, setManualBreakStart] = useState('12:00');
  const [manualBreakEnd, setManualBreakEnd] = useState('13:00');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadCurrentSchedule(selectedEmployee);
    } else {
      setCurrentSchedule(null);
    }
  }, [selectedEmployee]);

  async function loadEmployees() {
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').eq('active_status', true).order('first_name');
    if (data) setEmployees(data);
    setLoading(false);
  }

  async function loadCurrentSchedule(employeeId: string) {
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', dateStr)
      .single();
    
    setCurrentSchedule(data || null);
  }

  async function handleManualBreakSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSchedule) return;
    
    setActionLoading(true);
    
    const [startH, startM] = manualBreakStart.split(':').map(Number);
    const [endH, endM] = manualBreakEnd.split(':').map(Number);
    
    let breakDuration = (endH * 60 + endM) - (startH * 60 + startM);
    if (breakDuration < 0) {
      // Handle overnight break or invalid break
      breakDuration = 0;
    }
    
    const newBreakMinutes = (currentSchedule.break_minutes || 0) + breakDuration;
    
    // If they are already clocked out, we need to recalculate worked_minutes
    let newWorkedMinutes = currentSchedule.worked_minutes;
    if (currentSchedule.start_time && currentSchedule.end_time) {
      const [inH, inM] = currentSchedule.start_time.split(':').map(Number);
      const [outH, outM] = currentSchedule.end_time.split(':').map(Number);
      newWorkedMinutes = (outH * 60 + outM) - (inH * 60 + inM) - newBreakMinutes;
      if (newWorkedMinutes < 0) newWorkedMinutes = 0;
    }

    const updatedSchedule = {
      ...currentSchedule,
      break_minutes: newBreakMinutes,
      worked_minutes: newWorkedMinutes,
      updated_at: new Date().toISOString()
    };
    
    await supabase.from('schedules').upsert(updatedSchedule, { onConflict: 'employee_id,date' });
    await loadCurrentSchedule(selectedEmployee);
    
    setIsManualBreakModalOpen(false);
    setActionLoading(false);
    toast.success('Manual break logged successfully');
  }

  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          resolve(null);
        },
        { timeout: 5000 }
      );
    });
  };

  async function handleClockAction(type: 'in' | 'out' | 'break_start' | 'break_end') {
    if (!selectedEmployee) return;
    setActionLoading(true);
    
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const timeStr = format(new Date(), 'HH:mm');
    
    let locationStr = '';
    if (type === 'in' || type === 'out') {
      const loc = await getLocation();
      if (loc) {
        locationStr = `[LOC_${type.toUpperCase()}: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}]`;
      }
    }
    
    if (type === 'in') {
      const newSchedule = {
        ...(currentSchedule || {}),
        employee_id: selectedEmployee,
        date: dateStr,
        start_time: timeStr,
        category: 'Work',
        break_minutes: currentSchedule?.break_minutes || 0,
        worked_minutes: currentSchedule?.worked_minutes || 0,
        note: currentSchedule?.note ? `${currentSchedule.note} ${locationStr}`.trim() : locationStr
      };
      
      await supabase.from('schedules').upsert(newSchedule, { onConflict: 'employee_id,date' });
      toast.success(`Clocked in successfully at ${timeStr}`);
    } else if (type === 'break_start' && currentSchedule) {
      const updatedSchedule = {
        ...currentSchedule,
        note: `BREAK_START:${timeStr}`,
        updated_at: new Date().toISOString()
      };
      await supabase.from('schedules').upsert(updatedSchedule, { onConflict: 'employee_id,date' });
      toast.success(`Break started at ${timeStr}`);
    } else if (type === 'break_end' && currentSchedule) {
      let newBreakMinutes = currentSchedule.break_minutes || 0;
      
      if (currentSchedule.note && currentSchedule.note.startsWith('BREAK_START:')) {
        const breakStartTime = currentSchedule.note.split(':')[1] + ':' + currentSchedule.note.split(':')[2];
        const [startH, startM] = breakStartTime.split(':').map(Number);
        const [endH, endM] = timeStr.split(':').map(Number);
        
        const breakDuration = (endH * 60 + endM) - (startH * 60 + startM);
        if (breakDuration > 0) {
          newBreakMinutes += breakDuration;
        }
      }

      const updatedSchedule = {
        ...currentSchedule,
        break_minutes: newBreakMinutes,
        note: '', // Clear the break note
        updated_at: new Date().toISOString()
      };
      await supabase.from('schedules').upsert(updatedSchedule, { onConflict: 'employee_id,date' });
      toast.success(`Break ended at ${timeStr}`);
    } else if (type === 'out' && currentSchedule) {
      // Calculate worked minutes
      const start = currentSchedule.start_time;
      let worked_minutes = 0;
      let finalBreakMinutes = currentSchedule.break_minutes || 0;

      // If they clock out while on break, end the break first
      if (currentSchedule.note && currentSchedule.note.startsWith('BREAK_START:')) {
        const breakStartTime = currentSchedule.note.split(':')[1] + ':' + currentSchedule.note.split(':')[2];
        const [startH, startM] = breakStartTime.split(':').map(Number);
        const [endH, endM] = timeStr.split(':').map(Number);
        
        const breakDuration = (endH * 60 + endM) - (startH * 60 + startM);
        if (breakDuration > 0) {
          finalBreakMinutes += breakDuration;
        }
      }

      if (start) {
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = timeStr.split(':').map(Number);
        worked_minutes = (endH * 60 + endM) - (startH * 60 + startM) - finalBreakMinutes;
        if (worked_minutes < 0) worked_minutes = 0;
      }

      const updatedSchedule = {
        ...currentSchedule,
        end_time: timeStr,
        break_minutes: finalBreakMinutes,
        worked_minutes,
        note: currentSchedule.note ? `${currentSchedule.note.replace(/BREAK_START:\d{2}:\d{2}/, '')} ${locationStr}`.trim() : locationStr,
        updated_at: new Date().toISOString()
      };
      
      await supabase.from('schedules').upsert(updatedSchedule, { onConflict: 'employee_id,date' });
      toast.success(`Clocked out successfully at ${timeStr}`);
    }
    
    await loadCurrentSchedule(selectedEmployee);
    setActionLoading(false);
  }

  async function handleAbsence(category: string) {
    if (!selectedEmployee) return;
    setActionLoading(true);
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    
    const newSchedule = {
      employee_id: selectedEmployee,
      date: dateStr,
      category: category,
      start_time: null,
      end_time: null,
      break_minutes: 0,
      worked_minutes: 0,
      note: ''
    };
    
    await supabase.from('schedules').upsert(newSchedule, { onConflict: 'employee_id,date' });
    await loadCurrentSchedule(selectedEmployee);
    setActionLoading(false);
    toast.success(`Marked as ${category} for today`);
  }

  async function handleCancelAbsence() {
    if (!selectedEmployee || !currentSchedule) return;
    setActionLoading(true);
    await supabase.from('schedules').delete().eq('id', currentSchedule.id);
    await loadCurrentSchedule(selectedEmployee);
    setActionLoading(false);
    toast.success('Absence cancelled');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8 sm:py-12">
      <div className="text-center space-y-4">
        <h2 className="text-3xl sm:text-4xl font-semibold text-slate-800 tracking-tight">Time Clock</h2>
        <div className="text-5xl sm:text-7xl font-mono text-indigo-600 font-light tracking-tighter tabular-nums drop-shadow-sm">
          {format(currentTime, 'HH:mm:ss')}
        </div>
        <div className="text-lg sm:text-xl text-slate-500 font-medium">
          {format(currentTime, 'EEEE, MMMM d, yyyy')}
        </div>
        
        {getKosovoHoliday(currentTime) && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm font-medium border border-purple-100 shadow-sm">
            <CalendarHeart className="w-4 h-4" />
            Today is a Public Holiday: {getKosovoHoliday(currentTime)}
          </div>
        )}
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-8">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Select Employee</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-lg bg-slate-50/50 hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            <option value="">-- Choose your name --</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} ({emp.employee_number})
              </option>
            ))}
          </select>
        </div>

        {selectedEmployee && (
          <div className="space-y-6 pt-4 border-t border-slate-100">
            {currentSchedule && currentSchedule.note?.includes('PLANNED:') && !currentSchedule.start_time && (
              <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-4 py-3 rounded-xl text-center text-sm font-medium">
                Planned Shift Today: {currentSchedule.note.match(/PLANNED:([^\s]+)/)?.[1]}
              </div>
            )}
            
            {currentSchedule && currentSchedule.category !== 'Work' ? (
              <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-3">
                <div className="text-amber-800 font-medium text-lg">
                  You are marked as {currentSchedule.category} today.
                </div>
                <button 
                  onClick={handleCancelAbsence}
                  disabled={actionLoading}
                  className="text-sm text-amber-600 hover:text-amber-800 underline disabled:opacity-50"
                >
                  Cancel this status
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleClockAction('in')}
                    disabled={actionLoading || !!currentSchedule?.start_time}
                    className="flex flex-col items-center justify-center gap-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:hover:bg-emerald-50 p-6 rounded-2xl transition-colors border border-emerald-200"
                  >
                    <LogIn className="w-8 h-8" />
                    <span className="text-lg font-semibold">Clock In</span>
                    {currentSchedule?.start_time && (
                      <span className="text-sm font-medium opacity-75">In at {currentSchedule.start_time}</span>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleClockAction('out')}
                    disabled={actionLoading || !currentSchedule?.start_time || !!currentSchedule?.end_time || currentSchedule?.note?.startsWith('BREAK_START:')}
                    className="flex flex-col items-center justify-center gap-3 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 disabled:hover:bg-rose-50 p-6 rounded-2xl transition-colors border border-rose-200"
                  >
                    <LogOut className="w-8 h-8" />
                    <span className="text-lg font-semibold">Clock Out</span>
                    {currentSchedule?.end_time && (
                      <span className="text-sm font-medium opacity-75">Out at {currentSchedule.end_time}</span>
                    )}
                  </button>
                </div>

                {currentSchedule?.start_time && !currentSchedule?.end_time && (
                  <div className="pt-2">
                    {currentSchedule?.note?.startsWith('BREAK_START:') ? (
                      <button
                        onClick={() => handleClockAction('break_end')}
                        disabled={actionLoading}
                        className="w-full flex flex-col items-center justify-center gap-3 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 p-6 rounded-2xl transition-colors border border-amber-200"
                      >
                        <Coffee className="w-8 h-8" />
                        <span className="text-lg font-semibold">End Break</span>
                        <span className="text-sm font-medium opacity-75">
                          Started at {currentSchedule.note.split(':')[1]}:{currentSchedule.note.split(':')[2]}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClockAction('break_start')}
                        disabled={actionLoading}
                        className="w-full flex flex-col items-center justify-center gap-3 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 p-6 rounded-2xl transition-colors border border-blue-200"
                      >
                        <Coffee className="w-8 h-8" />
                        <span className="text-lg font-semibold">Start Break</span>
                        {currentSchedule.break_minutes > 0 && (
                          <span className="text-sm font-medium opacity-75">
                            Total break today: {currentSchedule.break_minutes}m
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                )}
                
                {currentSchedule?.start_time && (
                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={() => setIsManualBreakModalOpen(true)}
                      disabled={actionLoading}
                      className="text-sm text-slate-500 hover:text-indigo-600 underline transition-colors"
                    >
                      Log a manual break (e.g., 12:00 to 13:00)
                    </button>
                  </div>
                )}

                {!currentSchedule?.start_time && (
                  <div className="pt-6 border-t border-slate-100 text-center">
                    <p className="text-sm text-slate-500 mb-3">Not working today?</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['Sick', 'Vacation', 'Off', 'Other'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => handleAbsence(cat)}
                          disabled={actionLoading}
                          className="px-4 py-2 text-sm font-medium rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                        >
                          Mark as {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {isManualBreakModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Log Manual Break</h3>
              <button onClick={() => setIsManualBreakModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleManualBreakSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Break Start</label>
                  <input
                    type="time"
                    required
                    value={manualBreakStart}
                    onChange={e => setManualBreakStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Break End</label>
                  <input
                    type="time"
                    required
                    value={manualBreakEnd}
                    onChange={e => setManualBreakEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsManualBreakModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50"
                >
                  Save Break
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
