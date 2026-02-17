import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Debug logging
console.log('[Supabase] URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING');
console.log('[Supabase] Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}... (${supabaseAnonKey.length} chars)` : 'MISSING');

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('[Supabase] Client created successfully');
  } catch (error) {
    console.error('[Supabase] Failed to create client:', error);
  }
} else {
  console.error('Missing Supabase environment variables. Database features disabled.');
}

// Types for our database
export interface Expense {
  id?: string;
  vendor: string;
  date: string;
  amount: number;
  category: string;
  payment_method: string;
  tax: number | null;
  memo: string | null;
  image_url: string | null;
  created_at?: string;
}

/**
 * Save an expense to the database
 */
export async function saveExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
  if (!supabase) {
    throw new Error('Database not configured. Please add Supabase environment variables.');
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert([expense])
    .select()
    .single();

  if (error) {
    console.error('Error saving expense:', error);
    throw new Error(`Failed to save expense: ${error.message}`);
  }

  return data;
}

/**
 * Upload receipt image to Supabase Storage
 */
export async function uploadReceiptImage(file: File): Promise<string> {
  if (!supabase) {
    throw new Error('Database not configured. Please add Supabase environment variables.');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const extension = file.name.split('.').pop() || 'jpg';
  const filename = `receipt_${timestamp}.${extension}`;

  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading image:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('receipts')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Get all expenses, sorted by date descending
 */
export async function getExpenses(): Promise<Expense[]> {
  if (!supabase) {
    console.warn('Database not configured. Returning empty expenses.');
    return [];
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    throw new Error(`Failed to fetch expenses: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete an expense by ID
 */
export async function deleteExpense(id: string): Promise<void> {
  if (!supabase) {
    throw new Error('Database not configured. Please add Supabase environment variables.');
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting expense:', error);
    throw new Error(`Failed to delete expense: ${error.message}`);
  }
}
