-- UniTimetable Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/vnuglyosnikpcagjudid/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Classes available from edupage (faculties/years/groups)
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,           -- Full name like "Informatika I. A.-15"
  faculty TEXT,                 -- "Informatika", "Biomérnöki", etc.
  year INTEGER,                 -- 1, 2, 3
  group_code TEXT,              -- "A", "B", "C", etc.
  edupage_id TEXT UNIQUE,       -- Original ID from edupage for syncing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timetable entries from scraper
CREATE TABLE IF NOT EXISTS timetable_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,   -- "Matematika I."
  teacher_code TEXT,            -- "KÁI"
  teacher_name TEXT,            -- Full name if available
  classroom TEXT,               -- "228"
  day_of_week INTEGER NOT NULL, -- 0-4 (Mon-Fri)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  week_type TEXT DEFAULT 'all', -- 'all', 'odd', 'even' (for bi-weekly)
  color TEXT,                   -- Subject color from edupage (hex)
  edupage_id TEXT,              -- Original ID for syncing
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's custom timetable selections (for planner)
CREATE TABLE IF NOT EXISTS user_selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,        -- Anonymous user ID (stored locally)
  entry_id UUID REFERENCES timetable_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_id)
);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  selected_class_id UUID REFERENCES classes(id),
  show_time_indicator BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'hu',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable_entries(day_of_week);
CREATE INDEX IF NOT EXISTS idx_user_selections_user ON user_selections(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies: Allow public read access to classes and timetable
CREATE POLICY "Classes are viewable by everyone" ON classes
  FOR SELECT USING (true);

CREATE POLICY "Timetable entries are viewable by everyone" ON timetable_entries
  FOR SELECT USING (true);

-- Policies: Allow users to manage their own selections and preferences
CREATE POLICY "Users can manage their selections" ON user_selections
  FOR ALL USING (true);

CREATE POLICY "Users can manage their preferences" ON user_preferences
  FOR ALL USING (true);

-- Grant usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
