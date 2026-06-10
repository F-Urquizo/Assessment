import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/guards';
import { ModelService } from './model.service';

// Proxy routes are unauthenticated — the Studio uses them without logging in.
@ApiTags('model')
@Public()
@Controller()
export class ModelController {
  constructor(private readonly model: ModelService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('options')
  options() {
    return this.model.get('/options');
  }

  @Get('api/intel')
  intel() {
    return this.model.get('/api/intel');
  }

  @Post('predict')
  predict(@Body() body: unknown) {
    return this.model.post('/predict', body);
  }

  @Post('analyze')
  analyze(@Body() body: unknown) {
    return this.model.post('/analyze', body);
  }

  @Post('compare')
  compare(@Body() body: unknown) {
    return this.model.post('/compare', body);
  }
}
