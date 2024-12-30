import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { youtubeUrl } = await req.json()
    console.log('Processing YouTube URL:', youtubeUrl)

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY')
    if (!rapidApiKey) {
      throw new Error('RAPIDAPI_KEY is not set')
    }

    // Initier la conversion
    const convertUrl = `https://youtube-to-mp315.p.rapidapi.com/download?url=${encodeURIComponent(youtubeUrl)}&format=mp3&quality=0`
    const options = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
      }
    }

    const response = await fetch(convertUrl, options)
    const result = await response.json()
    console.log('Initial conversion result:', result)

    if (result.status === 'CONVERTING' && result.id) {
      let attempts = 0
      const maxAttempts = 12 // 2 minutes maximum

      while (attempts < maxAttempts) {
        await wait(10000) // 10 secondes entre chaque vérification
        
        const statusUrl = `https://youtube-to-mp315.p.rapidapi.com/status/${result.id}`
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: options.headers
        })
        
        const statusResult = await statusResponse.json()
        console.log(`Status check attempt ${attempts + 1}:`, statusResult)

        if (statusResult.status === 'AVAILABLE') {
          return new Response(
            JSON.stringify(statusResult),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (statusResult.status === 'EXPIRED' || statusResult.status === 'CONVERSION_ERROR') {
          throw new Error(`Conversion failed: ${statusResult.status}`)
        }

        attempts++
      }

      throw new Error('Conversion timeout')
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})