import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "./utils.ts"

export class StorageManager {
  private supabase;
  
  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
  }

  async uploadChunk(fileName: string, bytes: Uint8Array, attempt = 1): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from('temp-uploads')
        .upload(fileName, bytes, {
          contentType: 'application/octet-stream',
          upsert: true
        })

      if (error) throw error
    } catch (error) {
      if (attempt < 3) {
        console.log(`Retrying upload attempt ${attempt + 1}`)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        return this.uploadChunk(fileName, bytes, attempt + 1)
      }
      throw error
    }
  }

  async downloadChunk(path: string): Promise<Uint8Array> {
    const { data, error } = await this.supabase.storage
      .from('temp-uploads')
      .download(path)
      
    if (error) throw error
    return new Uint8Array(await data.arrayBuffer())
  }

  async uploadAudio(fileName: string, audioData: Uint8Array): Promise<void> {
    const { error } = await this.supabase.storage
      .from('audio-recordings')
      .upload(fileName, audioData, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (error) throw error
  }

  async cleanup(paths: string[]): Promise<void> {
    await this.supabase.storage
      .from('temp-uploads')
      .remove(paths)
  }
}