export interface CloudConvertTask {
  operation: string;
  status: string;
  percent?: number;
}

export interface CloudConvertJob {
  data: {
    id: string;
    status: string;
    tasks: CloudConvertTask[];
  };
}

export interface TaskStatus {
  operation: string;
  status: string;
  percent?: number;
}