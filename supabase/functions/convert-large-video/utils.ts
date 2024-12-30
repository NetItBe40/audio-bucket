export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const handleError = (error: Error, status = 500) => {
  console.error('Error:', error)
  return new Response(
    JSON.stringify({ 
      error: error.message,
      details: error.stack
    }),
    { 
      status,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  )
}

export const validateRequest = (body: any) => {
  const { videoChunk, fileName, chunkIndex, totalChunks, userId } = body
  
  if (!videoChunk || !fileName || chunkIndex === undefined || !totalChunks || !userId) {
    throw new Error('Missing required parameters')
  }
}

export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}