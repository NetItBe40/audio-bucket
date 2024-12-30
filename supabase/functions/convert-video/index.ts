import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { fileName, originalName } = await req.json()
    
    if (!fileName || !originalName) {
      throw new Error('Missing required parameters')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Créer un dossier temporaire unique
    const tempDir = Deno.makeTempDirSync()
    const inputPath = `${tempDir}/input.mp4`
    const outputPath = `${tempDir}/output.mp3`

    // Télécharger le fichier depuis temp-uploads
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('temp-uploads')
      .download(fileName)

    if (downloadError) throw downloadError

    // Écrire le fichier téléchargé sur le disque
    await Deno.writeFile(inputPath, new Uint8Array(await fileData.arrayBuffer()))

    // Convertir en MP3 avec FFmpeg
    const ffmpeg = new Deno.Command("ffmpeg", {
      args: [
        "-i", inputPath,
        "-vn",
        "-acodec", "libmp3lame",
        "-ab", "128k",
        "-ar", "44100",
        outputPath
      ],
    })

    const { code, stderr } = await ffmpeg.output()
    
    if (code !== 0) {
      throw new Error(`FFmpeg failed with error: ${new TextDecoder().decode(stderr)}`)
    }

    // Lire le fichier MP3 généré
    const audioData = await Deno.readFile(outputPath)

    // Upload vers audio-recordings
    const timestamp = Date.now()
    const audioFileName = `converted-${timestamp}-${originalName.replace(/\.[^/.]+$/, '')}.mp3`
    
    const { error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(audioFileName, audioData, {
        contentType: 'audio/mpeg',
        upsert: false
      })

    if (uploadError) throw uploadError

    // Nettoyer les fichiers temporaires
    await Deno.remove(tempDir, { recursive: true })
    
    // Supprimer le fichier original de temp-uploads
    await supabase.storage
      .from('temp-uploads')
      .remove([fileName])

    return new Response(
      JSON.stringify({ audioPath: audioFileName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})