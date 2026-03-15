import React from 'react';
import { Database } from 'lucide-react';

export function Setup() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        <div className="flex items-center justify-center w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl mb-6 mx-auto">
          <Database className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Supabase Setup Required</h1>
        <p className="text-slate-600 text-center mb-8">
          Please configure your Supabase environment variables to continue.
        </p>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">1. Add Environment Variables</h3>
            <p className="text-sm text-slate-600 mb-3">Add the following to your AI Studio Secrets or <code>.env</code> file:</p>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300">
              VITE_SUPABASE_URL="your-project-url"<br/>
              VITE_SUPABASE_ANON_KEY="your-anon-key"
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">2. Run SQL Setup</h3>
            <p className="text-sm text-slate-600 mb-3">Run this SQL in your Supabase SQL Editor to create the required tables:</p>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
{`create table employees (
  id uuid default gen_random_uuid() primary key,
  employee_number text not null unique,
  first_name text not null,
  last_name text not null,
  department text,
  position text,
  hire_date date not null,
  phone text,
  email text,
  notes text,
  active_status boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table schedules (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references employees(id) on delete cascade not null,
  date date not null,
  start_time time,
  end_time time,
  break_minutes integer default 0,
  worked_minutes integer default 0,
  category text not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(employee_id, date)
);`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
