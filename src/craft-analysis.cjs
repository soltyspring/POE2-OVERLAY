function inspectCraftCandidate(item) {
  const modifierLines = Array.isArray(item.modifierLines) ? item.modifierLines : [];
  const eligibleRarity = ['마법', '희귀'].includes(item.rarity);
  const explicitLines = modifierLines.filter(line => ['explicit', 'crafted', 'fractured', 'desecrated'].includes(line.group));
  const understoodLines = explicitLines.filter(line => line.statId);
  const unknownLines = explicitLines.filter(line => !line.statId);
  const prefixes = explicitLines.filter(line => line.side === 'prefix').length;
  const suffixes = explicitLines.filter(line => line.side === 'suffix').length;
  const hasSideMetadata = explicitLines.some(line => line.side);

  let reason;
  if (!eligibleRarity) reason = '마법·희귀 아이템만 제작 후보로 분석합니다.';
  else if (item.unidentified) reason = '미확인 아이템은 옵션을 복사할 수 없어 분석할 수 없습니다.';
  else reason = '현재 빌드에는 패치별 옵션 풀과 오브 규칙 데이터가 없어 확률·기대값은 계산하지 않습니다.';

  return {
    eligible: eligibleRarity && !item.unidentified,
    itemLevel: Number.isInteger(item.itemLevel) ? item.itemLevel : null,
    recognizedOptionLines: understoodLines.length,
    unknownOptionLines: unknownLines.length,
    prefixLines: hasSideMetadata ? prefixes : null,
    suffixLines: hasSideMetadata ? suffixes : null,
    modifierLines: explicitLines.map(line => ({ text: line.text, group: line.group, side: line.side, recognized: !!line.statId })),
    simulationAvailable: false,
    reason
  };
}

module.exports = { inspectCraftCandidate };
