export type Employee = {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  department: string;
  position: string;
  hire_date: string;
  phone: string;
  email: string;
  notes: string;
  active_status: boolean;
  created_at: string;
};

export type ScheduleCategory = 'Work' | 'Sick' | 'Vacation' | 'Off' | 'Public Holiday' | 'Other';

export type Schedule = {
  id: string;
  employee_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  worked_minutes: number;
  category: ScheduleCategory;
  note: string;
  created_at: string;
  updated_at: string;
};
