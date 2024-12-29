import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { decode as base64Decode } from "https://deno.land/std@0.140.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { videoUrl } = await req.json()
    console.log('Starting video conversion for URL:', videoUrl)

    // Créer le client Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Télécharger le fichier vidéo
    const response = await fetch(videoUrl)
    if (!response.ok) throw new Error('Failed to fetch video file')
    const videoBuffer = await response.arrayBuffer()

    // Utiliser FFmpeg.wasm pour convertir la vidéo en audio
    const ffmpeg = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.7')
    const { createFFmpeg } = ffmpeg
    const ffmpegInstance = createFFmpeg({ log: true })
    await ffmpegInstance.load()

    // Écrire le fichier vidéo dans la mémoire de FFmpeg
    ffmpegInstance.FS('writeFile', 'input.mp4', new Uint8Array(videoBuffer))

    // Convertir en audio (format mp3)
    await ffmpegInstance.run('-i', 'input.mp4', '-vn', '-acodec', 'libmp3lame', 'output.mp3')

    // Lire le fichier audio résultant
    const audioData = ffmpegInstance.FS('readFile', 'output.mp3')

    // Générer un nom de fichier unique
    const fileName = `converted_${Date.now()}.mp3`

    // Uploader le fichier audio dans le bucket Supabase
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(fileName, audioData, {
        contentType: 'audio/mp3',
      })

    if (uploadError) throw uploadError

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioPath: fileName 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in video conversion:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500 
      }
    )
  }
})