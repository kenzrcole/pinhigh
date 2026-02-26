import { supabase } from '../utils/supabaseClient';
import { HoleFeature } from '../data/mockHoleData';

export interface HoleLayout {
  id?: string;
  hole_number: number;
  course_name: string;
  features: HoleFeature[];
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export async function saveHoleLayout(
  holeNumber: number,
  courseName: string,
  features: HoleFeature[]
): Promise<{ success: boolean; data?: HoleLayout; error?: string }> {
  try {
    const existingLayout = await getHoleLayout(holeNumber, courseName);

    if (existingLayout.data) {
      const { data, error } = await supabase
        .from('hole_layouts')
        .update({
          features,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingLayout.data.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return { success: true, data };
    } else {
      const { data, error } = await supabase
        .from('hole_layouts')
        .insert({
          hole_number: holeNumber,
          course_name: courseName,
          features,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return { success: true, data };
    }
  } catch (error: any) {
    console.error('Error saving hole layout:', error);
    return { success: false, error: error.message };
  }
}

export async function getHoleLayout(
  holeNumber: number,
  courseName: string
): Promise<{ success: boolean; data?: HoleLayout; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('hole_layouts')
      .select('*')
      .eq('hole_number', holeNumber)
      .eq('course_name', courseName)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error loading hole layout:', error);
    return { success: false, error: error.message };
  }
}

export async function getAllHoleLayouts(
  courseName: string
): Promise<{ success: boolean; data?: HoleLayout[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('hole_layouts')
      .select('*')
      .eq('course_name', courseName)
      .order('hole_number', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error loading hole layouts:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteHoleLayout(
  holeNumber: number,
  courseName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('hole_layouts')
      .delete()
      .eq('hole_number', holeNumber)
      .eq('course_name', courseName);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting hole layout:', error);
    return { success: false, error: error.message };
  }
}

export async function resetAllHoleLayouts(
  courseName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('hole_layouts')
      .delete()
      .eq('course_name', courseName);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error resetting all hole layouts:', error);
    return { success: false, error: error.message };
  }
}
