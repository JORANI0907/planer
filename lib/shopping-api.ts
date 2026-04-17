import { supabase } from './supabase'
import type { ShoppingItem, ShoppingStatus } from './shopping-types'

export async function getShoppingItems(status?: ShoppingStatus): Promise<ShoppingItem[]> {
  let q = supabase.from('shopping_items').select('*')
  if (status) q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getKnownCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('shopping_items').select('category').not('category', 'is', null)
  if (error) throw error
  const set = new Set<string>()
  for (const row of data ?? []) if (row.category) set.add(row.category as string)
  return [...set]
}

export async function createShoppingItem(
  input: Partial<Omit<ShoppingItem, 'id' | 'created_at' | 'updated_at'>> & { title: string }
): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateShoppingItem(
  id: string,
  updates: Partial<Omit<ShoppingItem, 'id' | 'created_at' | 'updated_at'>>
): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function markPurchased(id: string, purchased: boolean): Promise<ShoppingItem> {
  return updateShoppingItem(id, {
    status: purchased ? 'purchased' : 'pending',
    purchased_at: purchased ? new Date().toISOString() : null,
  })
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const { error } = await supabase.from('shopping_items').delete().eq('id', id)
  if (error) throw error
}
