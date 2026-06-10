import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BrowseListingsDto } from './browse-listings.dto';

/** Validates a raw query the way the global ValidationPipe would (transform on). */
function validate(raw: Record<string, unknown>) {
  const dto = plainToInstance(BrowseListingsDto, raw, {
    enableImplicitConversion: false,
  });
  return { dto, errors: validateSync(dto) };
}

/** The property names that failed validation. */
function failed(raw: Record<string, unknown>): string[] {
  return validate(raw).errors.map((e) => e.property);
}

describe('BrowseListingsDto', () => {
  it('accepts an empty query and applies defaults', () => {
    const { dto, errors } = validate({});
    expect(errors).toHaveLength(0);
    expect(dto.sort).toBe('newest');
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it('coerces numeric query strings to numbers', () => {
    const { dto, errors } = validate({
      minPrice: '10000',
      page: '3',
      pageSize: '50',
    });
    expect(errors).toHaveLength(0);
    expect(dto.minPrice).toBe(10000);
    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(50);
  });

  it('rejects pageSize above the max of 100', () => {
    expect(failed({ pageSize: '101' })).toContain('pageSize');
  });

  it('rejects page below 1', () => {
    expect(failed({ page: '0' })).toContain('page');
  });

  it('rejects a negative minPrice', () => {
    expect(failed({ minPrice: '-1' })).toContain('minPrice');
  });

  it('rejects an unknown sort mode', () => {
    expect(failed({ sort: 'cheapest' })).toContain('sort');
  });

  it('rejects an unknown vehicle type', () => {
    expect(failed({ type: 'spaceship' })).toContain('type');
  });

  it('accepts a valid full query', () => {
    const { errors } = validate({
      make: 'toyota',
      type: 'sedan',
      state: 'ca',
      minPrice: '10000',
      maxPrice: '25000',
      sort: 'bestDeal',
      page: '2',
      pageSize: '10',
    });
    expect(errors).toHaveLength(0);
  });
});
