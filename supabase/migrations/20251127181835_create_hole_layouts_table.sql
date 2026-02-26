/*
  # Create hole layouts table for custom course configurations

  1. New Tables
    - `hole_layouts`
      - `id` (uuid, primary key) - Unique identifier for the layout
      - `hole_number` (integer) - The hole number (1-18)
      - `course_name` (text) - Name of the golf course
      - `features` (jsonb) - Array of hole features (tees, greens, hazards, etc.)
      - `created_at` (timestamptz) - When the layout was created
      - `updated_at` (timestamptz) - When the layout was last modified
      - `user_id` (uuid) - Reference to auth.users (optional for guest usage)
  
  2. Security
    - Enable RLS on `hole_layouts` table
    - Add policy for users to read all layouts
    - Add policy for users to insert their own layouts
    - Add policy for users to update their own layouts
    - Add policy for users to delete their own layouts
*/

CREATE TABLE IF NOT EXISTS hole_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hole_number integer NOT NULL,
  course_name text NOT NULL DEFAULT 'Custom Course',
  features jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE hole_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read hole layouts"
  ON hole_layouts
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own layouts"
  ON hole_layouts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own layouts"
  ON hole_layouts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own layouts"
  ON hole_layouts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hole_layouts_user_id ON hole_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_hole_layouts_hole_number ON hole_layouts(hole_number);
