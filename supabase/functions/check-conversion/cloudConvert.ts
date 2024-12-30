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
  console.log('Downloading converted audio from:', url);
  
  const audioResponse = await fetch(url);
  
  if (!audioResponse.ok) {
    console.error('Audio download failed:', audioResponse.statusText);
    throw new Error(`Failed to download converted audio: ${audioResponse.statusText}`);
  }

  const audioBlob = await audioResponse.blob();
  console.log('Audio file downloaded, size:', audioBlob.size);
  
  if (audioBlob.size === 0) {
    throw new Error('Downloaded audio file is empty');
  }

  return audioBlob;
}

export function getTasksStatus(tasks: CloudConvertTask[]): TaskStatus[] {
  return tasks.map(t => ({
    operation: t.operation,
    status: t.status,
    percent: t.percent
  }));
}