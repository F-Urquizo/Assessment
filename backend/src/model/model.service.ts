import { HttpException, Injectable } from '@nestjs/common';

@Injectable()
export class ModelService {
  private readonly baseUrl =
    process.env.MODEL_SERVICE_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:5050';

  private async forward(
    path: string,
    init?: RequestInit,
  ): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, init);
    } catch {
      throw new HttpException(
        { error: 'model-service unreachable' },
        503,
      );
    }
    const body = await res.json().catch(() => ({ error: 'invalid response from model-service' }));
    if (!res.ok) {
      throw new HttpException(body, res.status);
    }
    return body;
  }

  get(path: string): Promise<unknown> {
    return this.forward(path);
  }

  post(path: string, payload: unknown): Promise<unknown> {
    return this.forward(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });
  }
}
