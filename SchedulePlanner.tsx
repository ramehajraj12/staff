import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Employee, Schedule } from '../types';
import { formatMinutes } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, startOfDay } from 'date-fns';
import { Clock, UserCheck, UserX, CalendarOff, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentMonth] = useState(new Date());

  const isApproved = (note: string | null) => {
    if (!note) return true;
    return !note.includes('STATUS:Pending') && !note.includes('STATUS:Rejected');
  };

  useEffect(() => {
    async function loadData() {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const [empRes, schedRes] = await Promise.all([
        supabase.from('employees').select('*').order('first_name'),
        supabase.from('schedules').select('*').gte('date', start).lte('date', end)
      ]);

      if (empRes.data) setEmployees(empRes.data);
      if (schedRes.data) setSchedules(schedRes.data);
      setLoading(false);
    }
    loadData();
  }, [currentMonth]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-500">Loading dashboard...</div>;
  }

  const stats = employees.map(emp => {
    const empSchedules = schedules.filter(s => s.employee_id === emp.id);
    
    let totalWorkedMinutes = 0;
    let sickDays = 0;
    let vacationDays = 0;
    let publicHolidays = 0;
    let offDays = 0;
    let otherDays = 0;

    empSchedules.forEach(s => {
      if (s.category === 'Work') totalWorkedMinutes += s.worked_minutes;
      if (s.category === 'Sick' && isApproved(s.note)) sickDays++;
      if (s.category === 'Vacation' && isApproved(s.note)) vacationDays++;
      if (s.category === 'Public Holiday' && isApproved(s.note)) publicHolidays++;
      if (s.category === 'Off') offDays++;
      if (s.category === 'Other') otherDays++;
    });

    return {
      ...emp,
      totalWorkedMinutes,
      sickDays,
      vacationDays,
      publicHolidays,
      offDays,
      otherDays
    };
  });

  const totalHoursAll = stats.reduce((acc, s) => acc + s.totalWorkedMinutes, 0);
  const totalSickAll = stats.reduce((acc, s) => acc + s.sickDays, 0);
  const totalVacationAll = stats.reduce((acc, s) => acc + s.vacationDays, 0);
  const totalHolidaysAll = stats.reduce((acc, s) => acc + s.publicHolidays, 0);

  // Generate chart data for the current month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const chartData = daysInMonth.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const daySchedules = schedules.filter(s => s.date === dateStr);
    
    let workedMinutes = 0;
    let sickCount = 0;
    let vacationCount = 0;
    let holidayCount = 0;

    daySchedules.forEach(s => {
      if (s.category === 'Work') workedMinutes += s.worked_minutes || 0;
      if (s.category === 'Sick' && isApproved(s.note)) sickCount++;
      if (s.category === 'Vacation' && isApproved(s.note)) vacationCount++;
      if (s.category === 'Public Holiday' && isApproved(s.note)) holidayCount++;
    });

    return {
      date: format(day, 'MMM dd'),
      hours: Math.round((workedMinutes / 60) * 10) / 10,
      sick: sickCount,
      vacation: vacationCount,
      holidays: holidayCount
    };
  });

  // Find missing clock outs (clocked in, but no clock out, and date is before today)
  const today = startOfDay(new Date());
  const missingClockOuts = schedules.filter(s => 
    s.category === 'Work' && 
    s.start_time && 
    !s.end_time && 
    isBefore(new Date(s.date), today)
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-800 tracking-tight">
            Dashboard Overview
          </h2>
          <p className="text-slate-500 mt-1">{format(currentMonth, 'MMMM yyyy')} Summary</p>
        </div>
      </div>

      {missingClockOuts.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-amber-800">Missing Clock Outs Detected</h3>
            <p className="text-sm text-amber-700 mt-1">
              {missingClockOuts.length} employee(s) forgot to clock out on previous days. Please review their timesheets in the Reports section to correct their hours.
            </p>
          </div>
        </div>
      )}

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Employees</p>
              <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Worked Time</p>
              <p className="text-2xl font-bold text-slate-900">{formatMinutes(totalHoursAll)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Sick Days</p>
              <p className="text-2xl font-bold text-slate-900">{totalSickAll}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <CalendarOff className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Vacation Days</p>
              <p className="text-2xl font-bold text-slate-900">{totalVacationAll}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-800">Hours Worked per Day</h3>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="hours" name="Hours Worked" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Employee Stats Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Employee Statistics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-100 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Worked Time</th>
                <th className="px-6 py-4">Sick Days</th>
                <th className="px-6 py-4">Vacation</th>
                <th className="px-6 py-4">Holidays</th>
                <th className="px-6 py-4">Off</th>
                <th className="px-6 py-4">Other</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold text-xs">
                        {emp.first_name[0]}{emp.last_name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{emp.department || 'No dept'} • {emp.position || 'No pos'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-medium text-indigo-600">
                    {formatMinutes(emp.totalWorkedMinutes)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      emp.sickDays > 0 ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20' : 'text-slate-500'
                    }`}>
                      {emp.sickDays}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      emp.vacationDays > 0 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'text-slate-500'
                    }`}>
                      {emp.vacationDays}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      emp.publicHolidays > 0 ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20' : 'text-slate-500'
                    }`}>
                      {emp.publicHolidays}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      emp.offDays > 0 ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' : 'text-slate-500'
                    }`}>
                      {emp.offDays}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{emp.otherDays}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                      <p>No employees found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
