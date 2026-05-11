import { test, expect } from '@playwright/test';
import { loadResults } from '../storage/load';

test('no price mismatches', async () => {

  const results = await loadResults();

  const failed = results.filter(
    (x: any) => x.finalOk === false
  );

  console.log('FAILED:', failed);

  expect(failed).toEqual([]);
});