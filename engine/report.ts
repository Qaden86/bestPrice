export function buildReport(results: any[]) {

  const ok = results.filter(x => x.finalOk === true).length;

  const fail = results.filter(x => x.finalOk === false).length;

  const skip = results.filter(x => x.finalOk === null).length;

  return {
    total: results.length,
    ok,
    fail,
    skip,
    results
  };
}