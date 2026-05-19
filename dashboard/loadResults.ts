import { RESULTS_PATH } from '../config/path';
import { readNdjson } from '../crawler/output/readNdjson';

export function loadResultsFromFile(filePath: string) {
  return readNdjson(filePath);
}

export function loadResults() {
  return readNdjson(RESULTS_PATH);
}
