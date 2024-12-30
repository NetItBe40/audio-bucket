import { CloudConvertJob, TaskStatus } from "./types.ts";

export async function checkCloudConvertJob(jobId: string): Promise<CloudConvertJob> {
  const response = await fetch(
    `https://api.cloudconvert.com/v2/jobs/${jobId}`,
    {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('CLOUDCONVERT_API_KEY')}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cloud Convert API error:', errorText);
    throw new Error(`Cloud Convert API error: ${errorText}`);
  }

  const jobData: CloudConvertJob = await response.json();
  console.log('Cloud Convert job data:', JSON.stringify(jobData, null, 2));

  if (!jobData.data) {
    console.error('Invalid job data received:', jobData);
    throw new Error('Invalid job data received from Cloud Convert');
  }

  return jobData;
}

export async function downloadConvertedFile(url: string): Promise<Blob> {
  console.log('Starting download of converted audio from:', url);
  
  try {
    const audioResponse = await fetch(url);
    
    if (!audioResponse.ok) {
      console.error('Audio download failed:', {
        status: audioResponse.status,
        statusText: audioResponse.statusText
      });
      throw new Error(`Failed to download converted audio: ${audioResponse.statusText}`);
    }

    // Log response headers
    const headers = Object.fromEntries(audioResponse.headers.entries());
    console.log('Audio response headers:', headers);

    const contentLength = audioResponse.headers.get('content-length');
    console.log('Content length from headers:', contentLength);

    const audioBlob = await audioResponse.blob();
    console.log('Audio blob received:', {
      size: audioBlob.size,
      type: audioBlob.type
    });
    
    if (audioBlob.size === 0) {
      console.error('Downloaded audio file is empty');
      // Log the response body as text for debugging
      const responseText = await audioResponse.clone().text();
      console.error('Response body:', responseText);
      throw new Error('Downloaded audio file is empty');
    }

    // Additional validation
    if (!audioBlob.type.startsWith('audio/')) {
      console.error('Invalid file type received:', audioBlob.type);
      throw new Error(`Invalid file type received: ${audioBlob.type}`);
    }

    return audioBlob;
  } catch (error) {
    console.error('Error downloading converted file:', error);
    throw error;
  }
}

export function getTasksStatus(tasks: CloudConvertTask[]): TaskStatus[] {
  return tasks.map(t => ({
    operation: t.operation,
    status: t.status,
    percent: t.percent
  }));
}